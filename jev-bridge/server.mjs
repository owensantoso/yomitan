import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {evaluate, MAX_BODY_BYTES, MODEL, validateInput} from './core.mjs';

const HOST = '127.0.0.1';
export const DEFAULT_ENV_FILE = join(homedir(), '.config', 'yomitan-jev.env');

export async function loadApiKey(envFile = process.env.TYPESAFE_ENV_FILE || DEFAULT_ENV_FILE) {
    if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY;
    try {
        const contents = await readFile(envFile, 'utf8');
        return contents.match(/^(?:export\s+)?TYPESAFE_API_KEY\s*=\s*(.*)$/m)?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2') || '';
    } catch {
        return '';
    }
}

function send(res, status, value) {
    res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
    res.end(JSON.stringify(value));
}

export function allowedOrigin(origin, localPort) {
    return typeof origin === 'string' && (/^chrome-extension:\/\/[a-p]{32}$/.test(origin) || origin === `http://${HOST}:${localPort}` || origin === `http://localhost:${localPort}`);
}

async function bodyJson(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) throw new TypeError('Request exceeds 64 KiB.');
        chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

// API key, transient lookups, and results stay in memory. No request logging,
// disk caching, retry fan-out, or public web page CORS is enabled.
export function createBridgeServer({apiKey = '', evaluateImpl = evaluate, clock = Date.now} = {}) {
    let active = 0;
    let recentRuns = [];
    const server = createServer(async (req, res) => {
        const address = server.address();
        const port = typeof address === 'object' && address !== null ? address.port : 4183;
        if (![`${HOST}:${port}`, `localhost:${port}`].includes(req.headers.host)) return send(res, 403, {error: 'Host is not allowed.'});
        const origin = req.headers.origin;
        if (typeof origin !== 'undefined' && !allowedOrigin(origin, port)) return send(res, 403, {error: 'Origin is not allowed.'});
        if (req.url === '/api/config' && req.method === 'GET') return send(res, 200, {ready: Boolean(apiKey), model: MODEL});
        if (req.url !== '/api/evaluate') return send(res, 404, {error: 'Not found.'});
        const extensionId = req.headers['x-jev-extension'];
        const extensionHeader = typeof extensionId === 'string' && /^[a-p]{32}$/.test(extensionId);
        const extensionOrigin = typeof origin === 'string' && origin.startsWith('chrome-extension://');
        // Chrome service workers can omit Origin. A custom header cannot be sent
        // by a cross-origin web page without preflight, which is denied below.
        if (typeof origin === 'undefined' ? (!extensionHeader || req.method === 'OPTIONS') : (!allowedOrigin(origin, port) || (extensionOrigin && extensionHeader && origin !== `chrome-extension://${extensionId}`))) {
            return send(res, 403, {error: 'A permitted extension or loopback origin is required.'});
        }
        if (typeof origin === 'string') {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Vary', 'Origin');
        }
        if (req.method === 'OPTIONS') {
            if ((req.headers['access-control-request-headers'] ?? '').toLowerCase().split(',').some((header) => header.trim() !== 'content-type')) return send(res, 403, {error: 'Requested headers are not allowed.'});
            res.setHeader('Access-Control-Allow-Methods', 'POST');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            return send(res, 204, null);
        }
        if (req.method !== 'POST') return send(res, 405, {error: 'Method not allowed.'});
        if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) return send(res, 415, {error: 'Use application/json.'});
        if (!apiKey) return send(res, 503, {error: 'TypeSafe key is not configured on this server.'});
        recentRuns = recentRuns.filter((time) => clock() - time < 60000);
        if (active >= 2 || recentRuns.length >= 12) return send(res, 429, {error: 'Bridge limit reached: two concurrent requests and twelve runs per minute.'});
        ++active;
        try {
            const input = validateInput(await bodyJson(req));
            // Body reads yield. Reserve a paid-call slot after validation without
            // another await so concurrent bodies cannot both take the last slot.
            const now = clock();
            recentRuns = recentRuns.filter((time) => now - time < 60000);
            if (recentRuns.length >= 12) return send(res, 429, {error: 'Bridge limit reached: twelve runs per minute.'});
            recentRuns.push(now);
            return send(res, 200, await evaluateImpl(input, apiKey));
        } catch (error) {
            const status = error instanceof TypeError || error instanceof SyntaxError ? 400 : 502;
            // Only known, non-secret errors enter responses; provider bodies aren't forwarded.
            return send(res, status, {error: error instanceof Error ? error.message : 'Evaluation failed.'});
        } finally {
            --active;
        }
    });
    server.requestTimeout = 10000;
    server.headersTimeout = 10000;
    return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const apiKey = await loadApiKey();
    const port = Number(process.env.JEV_BRIDGE_PORT || 4183);
    if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid JEV_BRIDGE_PORT.');
    createBridgeServer({apiKey}).listen(port, HOST, () => console.log(`Jev bridge listening on http://${HOST}:${port} (${apiKey ? 'key configured' : 'key unavailable'})`));
}
