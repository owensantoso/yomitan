# JMdict demo dictionary export

The included exporter reads the existing Aiko SQLite seed in read-only mode and
creates an importable Yomitan v3 dictionary ZIP. It never edits the seed. It uses
only Python's standard library and creates no service or browser profile.

Coverage is exactly three real JMdict entries: 掛ける/懸ける (1207610, 25 senses),
取る (1326980, 18 senses), and 切る (1384830, 26 senses). All 69 source senses and
their original English glosses are preserved. Alternate source spellings and
readings make 120 term rows. Each sense is one row, tagged `s1`, `s2`, etc.; the
sequence field remains the original JMdict entry number. The `v1` and `v5`
Yomitan rules enable ordinary conjugation lookup; the JMdict `v5r` part-of-speech
tag remains visible on the definition.

This is an audited demo slice, not a full dictionary. The source seed has no
sense-level kanji/reading restriction columns, so this export cannot claim full
original JMdict fidelity. Its source JMdict release date is unknown. Source
metadata and exact glosses are included in `source-senses.json` and the adjacent
receipt. Field, miscellaneous, dialect, and usage-info metadata is retained in
the audit sidecar; it is not rendered as definition tags. For general vocabulary,
import the maintained [JMdict English Yomitan dictionary](https://github.com/yomidevs/jmdict-yomitan/releases/latest/download/JMdict_english.zip)
and keep it updated through its maintained source.

From the repository root:

```sh
owen-storage-history pressure-status --quiet
python3 jev-tools/export-jmdict-slice.py --seed /absolute/path/to/aiko-seed.db --output /absolute/path/to/jmdict-jev-demo-slice.zip
node jev-tools/check-jmdict-slice.mjs /absolute/path/to/jmdict-jev-demo-slice.zip
```

The checker uses the repository's installed `ajv` and `jszip` dependencies. It
validates all three upstream v3 schemas, the complete 69-sense coverage and 120
rows, and eight actual conjugated forms against Yomitan's own Japanese
transformer. Browser dictionary import and hover rendering require the separate
extension acceptance run. Before -> Now: the Aiko seed was not an importable
Yomitan dictionary; this ZIP can be selected using Settings -> Dictionaries ->
Import. A successful import shows `JMdict JEV demo slice (3 entries)` and permits
lookup of the three covered verbs, including conjugated forms such as 掛けた.

The dictionary data is copyright James William Breen and the Electronic
Dictionary Research and Development Group. It is used under [Creative Commons
Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/), with
attribution and conversion disclosure in the ZIP's index and notice. See the
[EDRDG dictionary licence](https://www.edrdg.org/edrdg/licence.html) and
[JMdict documentation](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project).
The extension's code retains Yomitan's separate GPL-3.0-or-later licence.

## Upstream build and activation review

The inspected upstream `package.json` requires Node.js 22 or newer. `npm run
build -- --target chrome-dev --version 0.0.0.1` builds libraries, creates the
Chrome development archive in `builds/`, then restores `ext/manifest.json`.
`dev/bin/build.js --dryRun` still calls `buildLibs`, which writes `ext/lib/`
output, so it is not a fully read-only operation. The build uses the lockfile's
npm dependencies, including `esbuild` and `ajv`; the dependency install also
runs the package's Husky prepare script. One production dependency,
`yomitan-handlebars`, is pinned to a GitHub commit in `package.json`.

The upstream v3 manifest is defined in `dev/data/manifest-variants.json`, rather
than a committed `ext/manifest.json`. Content scripts match HTTP, HTTPS, and
file pages and all frames. Host access is `<all_urls>`. Required permissions are
storage, clipboardWrite, unlimitedStorage, declarativeNetRequest, scripting,
offscreen, and contextMenus. clipboardRead and nativeMessaging are optional.
The background runs as a module service worker. Its extension content security
policy allows its own scripts, WebAssembly compilation, and unrestricted
connection/media destinations. These are inspected upstream baseline
permissions, not evidence that arbitrary page content is uploaded by default.
The JEV integration's actual network/data behavior must be reviewed in its
implementation and verified separately before activation in a user profile.

No user browser profile was altered and no extension was activated by these
export or verification tools.

## Full maintained JMdict download reviewed for the integration

The main integration downloaded the maintained `JMdict_english.zip` from the
Yomitan dictionary team's stable latest-download URL. The inspected archive
identifies itself as `JMdict [2026-10-02]`, revision `JMdict.2026-10-02`. Its
15,603,737 bytes hash to SHA-256
`137c9e8c32cf0e809d46347d373332e21e4adb5d160c984ddac560c57049528b`.
The effective redirect URL was not retained, so the exact release-tag URL is
unverified. The archive identity above was checked directly from its bytes and index.

The archive contains 53 term banks, 527,263 rows, 231,301 distinct entry
sequences, one 327-tag bank, and an index. Uncompressed content totals
171,253,942 bytes. All ZIP members pass CRC verification; every member is a
JSON file with a simple filename, with no executables or nested paths. This
review inspected structure and representative entries; it did not revalidate
every full-dictionary row against all Yomitan schemas.

Unlike the demo slice's plain strings and `sN` tags, this dictionary uses
structured gloss lists and numeric source sense tags. Each sense is still a
separate definition row. English synonym list items inside that row are not
separate senses. Gloss structure can include usage notes and related-word
references. Usage notes reach the candidate text; related-word references and
examples remain in the dictionary display and are excluded from JEV choices. Some entries also
include a definition tagged `forms`, which lists alternate spellings and must
be excluded from sense choices. 掛ける/懸ける has 25 senses across two spellings,
plus two forms rows, for 52 rows. 取る has 18 senses/rows; 切る has 26 senses/rows.
All 94 actual sense-row glossary lists across these entries exactly match the
existing read-only seed.

In Yomitan's default `group` result mode, the first matched term's definition
list contains its source senses; the updated candidate collector recognizes
numeric tags and skips forms metadata. `merge` may join multiple spellings,
while `split` displays each definition as a separate result entry. The current
controller ranks only the first term result; split mode can therefore expose
one candidate and skip ranking. This integration should use `group` for the
demonstrated behavior. The full dictionary also has spelling/reading
restrictions and annotations produced by its maintained importer; the custom
seed slice cannot claim those absent source restrictions.

A read-only check rendered the actual full-dictionary 掛ける rows using Yomitan's
own glossary renderer and display templates in JSDOM. The updated collector
returned exactly 25 choices from 26 displayed definitions, excluded the spelling
list, and retained source sense numbers 4 (phone call) and 25 (the final suffix
sense). This proves the renderer-to-candidate boundary for that representative
entry. It does not replace the main task's browser import, hover, and bridge
verification.

The archive index acknowledges JMdict/EDRDG but includes no separate licence
file. Japanese/English JMdict data is covered by the linked EDRDG CC BY-SA 4.0
statement. The demo, distribution docs, and social materials should acknowledge
JMdict/EDRDG and link the licence and dictionary documentation. Keep the
maintained dictionary's update URL; the custom demo slice is intentionally
fixed coverage.
