# Jev dictionary bridge

The extension sends the hovered sentence and the source dictionary's complete
sense candidates to this local service. The service makes one constrained choice
request to Jev (`jev-1.13.0`) and returns the complete probability distribution,
including `unclear`. English synonyms inside one source sense remain together.

From the repository root:

```sh
node jev-bridge/server.mjs
```

The server binds only to `127.0.0.1:4183`. It reads `TYPESAFE_API_KEY` from the
process or `TYPESAFE_ENV_FILE`, defaulting to `~/.config/yomitan-jev.env`.
Set `TYPESAFE_ENV_FILE` to an existing private environment file when appropriate.
Never copy the key into extension source, screenshots, demo records, or browser
storage.
`JEV_BRIDGE_PORT` can override the port for isolated tests; the extension currently
expects port 4183.

## Contract

`POST /api/evaluate`, with `Content-Type: application/json`:

```json
{
  "sentence": "壁に絵をかけた。",
  "target": "掛ける",
  "reading": "かける",
  "targetOffset": 4,
  "surface": "かけた",
  "candidates": [
    { "id": "d1", "text": "to hang; to suspend" },
    { "id": "d2", "text": "to make a phone call" }
  ]
}
```

`targetOffset` is a UTF-16 offset; the extension converts DOM scanner code-point
offsets before sending them. Offset and
surface are optional as a pair; when supplied, the surface must exactly match the
sentence at that offset. This distinguishes repeated occurrences and preserves
the hovered inflected form separately from the dictionary headword.

The response is `{choice, probabilities, confidence, model, latencyMs}`.
`probabilities` contains every submitted candidate ID plus `unclear`. Values
must be finite numbers between 0 and 1, sum to 1 within 0.01, and the returned
choice must have maximal weight. These are model option weights, **not calibrated
real-world certainty**. `latencyMs` measures the whole provider round trip.

## Boundaries

- At most 1,200 sentence code units, 200 candidates, 4,000 code units per candidate,
  and 64 KiB total request; no complete web page is sent.
- The fixed TypeSafe endpoint uses a 10-second timeout and refuses redirects.
  There are no automatic retries. At most two calls run concurrently and twelve
  valid evaluations start per minute.
- Host must be loopback. A present Origin must be a loopback origin or a Chrome
  extension origin. An absent Origin requires `X-Jev-Extension` with a valid
  Chrome extension ID, as background service-worker requests can omit Origin.
  Extension Origin and header must agree when both are supplied.
- Arbitrary web origins and custom-header web preflights are refused. Browser
  content scripts do not fetch this endpoint; the extension background does.
- No request text, provider body, result, or key is logged or saved. The bridge
  holds transient request state in memory only. The remote provider receives the
  supplied sentence and candidate wording on an enabled evaluation.
- `GET /api/config` reports only key readiness and model identity.

The collector maps `d1` to one rendered dictionary definition, or `d1s1` to an
explicit structured sense container. IDs are local to a rendered entry. Retain
its `elements` map with the request, and check the display's request token before
applying a response. JMdict `forms` metadata is excluded, and source sense
numbers in numeric or `sN` tags are retained in `sourceSenseNumber`.

## Verification

```sh
node --test jev-bridge/*.test.mjs
npx vitest run test/jev-sense-ranking.test.js
npx eslint ext/js/display/jev-sense-ranking.js test/jev-sense-ranking.test.js
```

Bridge tests use a mock provider and in-memory HTTP handler invocation. They do
not contact TypeSafe, open a listening socket, or spend API credits. A real
provider result and browser acceptance must be checked separately.
