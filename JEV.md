# Contextual sense highlighting

This fork adds an optional **JEV context** checkbox to Yomitan's real lookup popup.
The normal dictionary appears immediately. When enabled, JEV selects among the
first term entry's original dictionary senses, highlights its choice and scrolls
it into view. Dictionary order stays intact. The switch starts off.

## Try it

Start the local bridge from this repository:

```sh
node jev-bridge/server.mjs
```

Build with `npm ci --ignore-scripts`, then `npm run build -- --target chrome-dev`.
Load the unpacked `builds/yomitan-chrome-dev` contents in a separate development
extension. Import a Yomitan dictionary in Settings and enable it. The official
[JMdict English dictionary](https://github.com/yomidevs/jmdict-yomitan/releases/latest/download/JMdict_english.zip)
was used for the real browser checks. Build output is an archive; extract it to
a stable directory before using Chrome's Load unpacked.

On an ordinary Japanese page, hold Shift and hover 掛けた in
「母に電話を掛けた。」. Enable **JEV context** in the popup. The dictionary's
“to make (a call)” sense should gain a green outline and model score. In
「小さい文字が読めなくて、眼鏡を掛けた。」, the intended sense is “to put on
(glasses, etc.)”. These are demonstrations, not an accuracy benchmark.

Before: the reader chooses from the dictionary's long list. Now: the same list
remains available, with the model's suggested sense marked in its original place.

## Data flow and consent

Yomitan already performs scanning, inflection normalization, local dictionary
lookup, sentence extraction and popup rendering. The new layer preserves source
sense boundaries, with synonyms grouped into one candidate. JMdict's forms
metadata is excluded. Explicit structured dictionary sense containers are
supported; unknown structures stay whole definitions rather than invented
sub-senses.

The extension sends only the extracted sentence, exact hovered occurrence,
headword, reading and candidate wording to `127.0.0.1:4183`. The local bridge
holds the key and sends that data to TypeSafe's JEV API. No complete page is
transmitted. Enabling the checkbox opts into this remote processing. Disabling
it stops new evaluations. An already submitted request can finish remotely;
its result is discarded locally after disabling or changing the lookup.

The server makes one constrained choice call, including an `unclear` option.
Returned percentages are model option weights, **not calibrated correctness**.
The popup's elapsed time includes the local and provider round trip; it is not
pure model inference latency. No API key is stored in Chrome. No lookup logs or
persistent response cache are maintained by the bridge.

Requests are bounded to 1,200 UTF-16 code units, 200 candidates and 64 KiB.
DOM code-point offsets are converted to UTF-16 before exact-occurrence validation.
Failure, insufficient context, invalid results and stale replies leave ordinary
lookup usable. Model behavior can still be wrong or overconfident.

## Current scope

Chrome personal prototype; sentence context; first returned term entry; ordinary
Yomitan grouped output. Split output can contain only one sense in an entry and
therefore is not ranked. No paragraph/full-page retrieval, reordering, calibrated
accuracy claim, Firefox integration test, Web Store release, upstream contribution
or social publication is included.

The fork preserves upstream's broad page access permissions. Optional native
messaging and clipboard read remain upstream optional permissions; this feature
does not use or request them. The only added endpoint is the fixed loopback
bridge; its only provider endpoint is `https://api.typesafe.ai/v1/systemone`.
The key stays in the configured bridge environment file described in
[the bridge README](jev-bridge/README.md).

## Verification

```sh
npm run test:static-analysis
npm run test:unit
npm run test:unit:options
npm run test:json
npm run test:build
```

Bridge tests use a mocked provider. Collector and display tests exercise sense
mapping, stale/disabled responses, invalid distributions, unclear, scroll behavior,
emoji and repeated target offsets. Live browser evidence separately covers an
installed complete JMdict and real Shift-hover calls to TypeSafe.

Yomitan remains GPL-3.0-or-later. JMdict © EDRDG, distributed under
[CC BY-SA 4.0](https://www.edrdg.org/edrdg/licence.html).

## Browser verification notes

The verified local capture used Playwright 1.62.1 with an already installed
Chrome for Testing binary. The checkout's older Playwright 1.51 runtime failed
against that newer cached browser; no browser download was necessary. Keep that
runtime compatibility distinction when repeating the browser checks.

Yomitan's actual popup sits inside a closed shadow root. Use the popup frame from
`page.frames()` rather than searching the host page for its iframe with a frame
locator. Hold Shift until lookup renders. Newly imported dictionaries may start
disabled: verify the installed dictionary's actual enabled toggle before judging
lookup behavior.

Public popup URL state cannot authorize JEV. Only authenticated frame content
can do so. The browser consent regression embeds a public popup from an ordinary
page and changes its fragment after initialization, proving that dictionary
results can render without starting a bridge request. A checkbox change also
cannot rank that untrusted initial content. The ordinary authenticated hover
path is verified separately against the live service.
