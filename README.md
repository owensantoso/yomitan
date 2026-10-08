# Yomitan Context

A [Yomitan](https://github.com/yomidevs/yomitan) fork that highlights the dictionary meaning most likely to fit the sentence you're reading.

Yomitan already handles word scanning, dictionary lookup and the popup. This fork adds an optional contextual layer: it asks Jev to choose among the dictionary's existing senses, then highlights the suggested sense in its original position. It does not generate new definitions or hide the other meanings.

**The implementation is on [`feat/jev-sense-highlighting`](https://github.com/owensantoso/yomitan-context/tree/feat/jev-sense-highlighting).** The default `master` branch keeps the upstream code plus this fork's README; switch to the feature branch before building.

## Demo

A word such as 掛ける can have many dictionary senses. With ordinary lookup, you choose from the whole list. With **JEV context** enabled, the same list stays visible and the suggested meaning gains a highlight.

[Watch or download the 46-second demo](https://github.com/owensantoso/yomitan-context/blob/feat/jev-sense-highlighting/docs/media/yomitan-context-demo.mp4) · MP4, 1.5 MB. The existing video combines explanatory illustrations with recordings of the working popup.

**Phone call:** 母に電話を掛けた。 → “to make (a call)”

![Actual Yomitan popup for 母に電話を掛けた。, highlighting the phone-call sense](https://raw.githubusercontent.com/owensantoso/yomitan-context/refs/heads/feat/jev-sense-highlighting/docs/media/phone-sense.png)

**Glasses:** 小さい文字が読めなくて、眼鏡を掛けた。 → “to put on (glasses, etc.)”

![Actual Yomitan popup for 小さい文字が読めなくて、眼鏡を掛けた。, highlighting the glasses sense](https://raw.githubusercontent.com/owensantoso/yomitan-context/refs/heads/feat/jev-sense-highlighting/docs/media/glasses-sense.png)

The popup scrolls the selected sense into view. If Jev chooses `unclear`, no meaning is highlighted. The screenshots and video demonstrate the interaction; their scores and individual round-trip times are not an accuracy or speed benchmark.

### Related experiment: Aiko Sense Lab

[Open Aiko Sense Lab](https://macnos.tailafa155.ts.net:8478/) — **private Tailscale access required**. This earlier, separate experiment follows a sentence through four panels: the target word, sentence context, all candidate senses, and the English wording within the selected sense. Choose 掛ける, 取る or 切る and an example sentence to inspect the recorded results; **Run Jev** submits a new live request. It explores the underlying selection behavior rather than the Yomitan popup.

## Try the fork in Chrome

This is a personal Chrome prototype. The upstream browser-store versions do not include this feature.

Requirements: Node.js 22 or newer, npm, a TypeSafe application programming interface (API) key, and a Yomitan dictionary.

```sh
git clone --branch feat/jev-sense-highlighting https://github.com/owensantoso/yomitan-context.git
cd yomitan-context
npm ci --ignore-scripts
npm run build -- --target chrome-dev
```

1. Extract `builds/yomitan-chrome-dev.zip` into a stable directory. In Chrome's extension manager, enable Developer mode and choose **Load unpacked** for that directory. Use a separate Chrome profile when trying the prototype so it does not interfere with an existing Yomitan setup.
2. Import a dictionary in Yomitan Settings and enable it. The live demonstration used the full [JMdict English dictionary](https://github.com/yomidevs/jmdict-yomitan/releases/latest/download/JMdict_english.zip).
3. Configure the local bridge's key in a private environment file, following the [bridge README](https://github.com/owensantoso/yomitan-context/blob/feat/jev-sense-highlighting/jev-bridge/README.md). Keep the key out of Chrome and the repository. From the repository root, run `node jev-bridge/server.mjs` and leave the bridge running.
4. Hold Shift and hover over 掛けた in either example sentence. Enable **JEV context** in the popup. A successful result highlights the matching dictionary sense and shows the model's score.

The context switch starts off. Ordinary dictionary lookup remains available when the bridge is unavailable or a request fails.

## Where processing happens

The current implementation uses remote Jev inference. When you enable contextual highlighting, the extension sends the extracted sentence, exact hovered occurrence, headword, reading and candidate senses through a loopback bridge at `127.0.0.1:4183` to TypeSafe's Jev service. It does not send the complete page. The bridge keeps the API key outside Chrome and does not persist lookup text or results.

The displayed scores are model option weights, not calibrated correctness. Jev can choose the wrong meaning. The name describes the contextual feature; an on-device backend has not been implemented.

## Scope and development

The current prototype uses sentence context and the first returned term entry in Yomitan's grouped output. Paragraph context, definition reordering, broader accuracy evaluation, Firefox verification and a browser-store release are outside the current implementation.

- [Feature behavior, data flow and verification](https://github.com/owensantoso/yomitan-context/blob/feat/jev-sense-highlighting/JEV.md)
- [Local bridge configuration and tests](https://github.com/owensantoso/yomitan-context/blob/feat/jev-sense-highlighting/jev-bridge/README.md)
- [Demo video and carousel source](https://github.com/owensantoso/yomitan-context/blob/feat/jev-sense-highlighting/jev-media/README-v2.md)
- [Upstream Yomitan documentation](https://yomitan.wiki)
- [Development setup](CONTRIBUTING.md#setup)

## Credits and license

Built on [Yomitan](https://github.com/yomidevs/yomitan), the successor to [Yomichan](https://github.com/FooSoft/yomichan). The scanner, dictionaries, popup and existing learning tools come from upstream; this fork adds contextual sense highlighting.

The code remains [GNU General Public License version 3 or later](LICENSE). JMdict is © EDRDG, distributed under [Creative Commons Attribution-ShareAlike 4.0](https://www.edrdg.org/edrdg/licence.html). The upstream third-party library and audio attributions are retained below.

## Third-Party Libraries

Yomitan uses several third-party libraries to function.

<!-- The following table is generated using the command `npm run license-report:markdown`. -->

| Name                | License type | Link                                                                   |
| :------------------ | :----------- | :--------------------------------------------------------------------- |
| @resvg/resvg-wasm   | MPL-2.0      | git+ssh://git@github.com/yisibl/resvg-js.git                           |
| @zip.js/zip.js      | BSD-3-Clause | git+https://github.com/gildas-lormeau/zip.js.git                       |
| dexie               | Apache-2.0   | git+https://github.com/dexie/Dexie.js.git                              |
| dexie-export-import | Apache-2.0   | git+https://github.com/dexie/Dexie.js.git                              |
| hangul-js           | MIT          | git://github.com/e-/Hangul.js.git                                      |
| kanji-processor     | n/a          | https://registry.npmjs.org/kanji-processor/-/kanji-processor-1.0.2.tgz |
| parse5              | MIT          | git://github.com/inikulin/parse5.git                                   |
| yomitan-handlebars  | MIT          | n/a                                                                    |
| linkedom            | ISC          | git+https://github.com/WebReflection/linkedom.git                      |

## Attribution

`fallback-bloop.mp3` is provided by [UNIVERSFIELD](https://pixabay.com/sound-effects/error-8-206492/) and licensed under the [Pixabay Content License](https://pixabay.com/service/license-summary/).
