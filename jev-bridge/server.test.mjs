import assert from 'node:assert/strict';
import {PassThrough, Readable} from 'node:stream';
import {test} from 'node:test';
import {createBridgeServer} from './server.mjs';

const extensionId = 'a'.repeat(32);
const input = {sentence: '絵をかけた。', target: '掛ける', reading: 'かける', surface: 'かけた', targetOffset: 2, candidates: [{id: 'd1', text: 'to hang; to suspend'}]};
const result = {choice: 'd1', probabilities: {d1: 0.9, unclear: 0.1}, confidence: 0.9, model: 'jev-1.13.0', latencyMs: 10};

// Exercise the HTTP request handler without opening a socket or making calls.
function request(server, {method = 'POST', url = '/api/evaluate', body = JSON.stringify(input), bodyStream, headers = {}} = {}) {
    return new Promise((resolve) => {
        const req = bodyStream ?? Readable.from([Buffer.from(body)]);
        req.method = method;
        req.url = url;
        req.headers = {host: '127.0.0.1:4183', origin: `chrome-extension://${extensionId}`, 'content-type': 'application/json', ...headers};
        const responseHeaders = {};
        let status;
        const res = {
            setHeader: (name, value) => { responseHeaders[name] = value; },
            writeHead: (value, values) => { status = value; Object.assign(responseHeaders, values); },
            end: (value) => resolve({status, headers: responseHeaders, body: value ? JSON.parse(value) : null}),
        };
        server.emit('request', req, res);
    });
}

test('permits extension requests and sends only normalized input to provider', async () => {
    const server = createBridgeServer({apiKey: 'test-only-key', evaluateImpl: async (value, key) => { assert.deepEqual(value, input); assert.equal(key, 'test-only-key'); return result; }});
    const response = await request(server);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, result);
    assert.equal(response.headers['Access-Control-Allow-Origin'], `chrome-extension://${extensionId}`);
    assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('permits originless extension worker only with valid custom header', async () => {
    const server = createBridgeServer({apiKey: 'test-only-key', evaluateImpl: async () => result});
    assert.equal((await request(server, {headers: {origin: undefined, 'x-jev-extension': extensionId}})).status, 200);
    assert.equal((await request(server, {headers: {origin: undefined}})).status, 403);
    assert.equal((await request(server, {headers: {origin: undefined, 'x-jev-extension': 'invalid'}})).status, 403);
    assert.equal((await request(server, {headers: {'x-jev-extension': 'b'.repeat(32)}})).status, 403);
});

test('rejects web origin, DNS rebinding host and permissive header preflight', async () => {
    const server = createBridgeServer({apiKey: 'test-only-key', evaluateImpl: async () => result});
    assert.equal((await request(server, {headers: {origin: 'https://malicious.example'}})).status, 403);
    assert.equal((await request(server, {headers: {host: 'malicious.example:4183'}})).status, 403);
    assert.equal((await request(server, {method: 'OPTIONS', headers: {'access-control-request-headers': 'x-jev-extension'}})).status, 403);
    assert.equal((await request(server, {method: 'OPTIONS', headers: {'access-control-request-headers': 'content-type'}})).status, 204);
});

test('rejects invalid body/content type before a paid call', async () => {
    let calls = 0;
    const server = createBridgeServer({apiKey: 'test-only-key', evaluateImpl: async () => { ++calls; return result; }});
    assert.equal((await request(server, {body: '{'})).status, 400);
    assert.equal((await request(server, {body: JSON.stringify({...input, sentence: 'あ'.repeat(1201)})})).status, 400);
    assert.equal((await request(server, {body: 'x'.repeat(65537)})).status, 400);
    assert.equal((await request(server, {headers: {'content-type': 'text/plain'}})).status, 415);
    assert.equal(calls, 0);
});

test('caps paid calls and recovers after the rate window', async () => {
    let time = 1;
    let calls = 0;
    const server = createBridgeServer({apiKey: 'test-only-key', clock: () => time, evaluateImpl: async () => { ++calls; return result; }});
    for (let i = 0; i < 12; ++i) assert.equal((await request(server)).status, 200);
    assert.equal((await request(server)).status, 429);
    assert.equal(calls, 12);
    time += 60001;
    assert.equal((await request(server)).status, 200);
});

test('caps in-flight evaluations and releases slots after failures', async () => {
    let finish;
    const pending = new Promise((resolve) => { finish = resolve; });
    const server = createBridgeServer({apiKey: 'test-only-key', evaluateImpl: async () => { await pending; return result; }});
    const one = request(server);
    const two = request(server);
    assert.equal((await request(server)).status, 429);
    finish();
    assert.equal((await one).status, 200);
    assert.equal((await two).status, 200);
    assert.equal((await request(server)).status, 200);
});

test('configuration reports readiness without key and refuses unconfigured evaluation', async () => {
    const server = createBridgeServer();
    const config = await request(server, {method: 'GET', url: '/api/config', headers: {origin: undefined}});
    assert.deepEqual(config.body, {ready: false, model: 'jev-1.13.0'});
    assert.equal((await request(server)).status, 503);
});


test('two deferred bodies cannot both spend the last minute-limit slot', async () => {
    let calls = 0;
    const server = createBridgeServer({apiKey: 'test-only-key', clock: () => 1, evaluateImpl: async () => { ++calls; return result; }});
    for (let i = 0; i < 11; ++i) assert.equal((await request(server)).status, 200);
    const firstBody = new PassThrough();
    const secondBody = new PassThrough();
    const first = request(server, {bodyStream: firstBody});
    const second = request(server, {bodyStream: secondBody});
    // Both requests pass admission while the earlier eleven calls fill the
    // window, then validation completes after the asynchronous body boundary.
    firstBody.end(JSON.stringify(input));
    secondBody.end(JSON.stringify(input));
    const statuses = (await Promise.all([first, second])).map(({status}) => status).sort();
    assert.deepEqual(statuses, [200, 429]);
    assert.equal(calls, 12);
});
