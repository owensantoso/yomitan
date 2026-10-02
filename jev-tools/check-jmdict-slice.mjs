import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import Ajv from 'ajv';
import JSZip from 'jszip';
import {japaneseTransforms} from '../ext/js/language/ja/japanese-transforms.js';
import {LanguageTransformer} from '../ext/js/language/language-transformer.js';

const archivePath = process.argv[2];
assert.ok(archivePath, 'Pass the generated dictionary ZIP path');
const zip = await JSZip.loadAsync(await fs.readFile(archivePath));
const load = async (name) => JSON.parse(await zip.file(name).async('string'));
const ajv = new Ajv({allowUnionTypes: true, strict: false});
for (const [file, schema] of [
    ['index.json', 'dictionary-index-schema.json'],
    ['term_bank_1.json', 'dictionary-term-bank-v3-schema.json'],
    ['tag_bank_1.json', 'dictionary-tag-bank-v3-schema.json'],
]) {
    const data = await load(file);
    const validator = ajv.compile(JSON.parse(await fs.readFile(new URL(`../ext/data/schemas/${schema}`, import.meta.url), 'utf8')));
    assert.ok(validator(data), `${file}: ${JSON.stringify(validator.errors)}`);
}
const terms = await load('term_bank_1.json');
const provenance = await load('source-senses.json');
assert.equal(provenance.entryCount, 3);
assert.equal(provenance.sourceSenseCount, 69);
assert.equal(terms.length, 120);
for (const entry of provenance.entries) {
    for (const sense of entry.senses) {
        const rows = terms.filter((row) => row[6] === entry.entSeq && row[2].split(' ')[0] === `s${sense.position + 1}`);
        assert.equal(rows.length, entry.forms.length);
        for (const row of rows) {
            assert.deepEqual(row[5], sense.glosses, `Source glosses altered: ${sense.id}`);
        }
    }
}
const transformer = new LanguageTransformer();
transformer.addDescriptor(japaneseTransforms);
for (const [surface, term, rule] of [
    ['掛けた', '掛ける', 'v1'],
    ['掛けます', '掛ける', 'v1'],
    ['取った', '取る', 'v5'],
    ['取っている', '取る', 'v5'],
    ['取らない', '取る', 'v5'],
    ['切った', '切る', 'v5'],
    ['切って', '切る', 'v5'],
    ['切られた', '切る', 'v5'],
]) {
    const flags = transformer.getConditionFlagsFromPartsOfSpeech([rule]);
    assert.ok(transformer.transform(surface).some((result) => result.text === term && LanguageTransformer.conditionsMatch(result.conditions, flags)), `Missing deinflection ${surface} -> ${term}`);
    assert.ok(terms.some((row) => row[0] === term && row[3] === rule), `Missing import rule ${term} ${rule}`);
}
console.log('PASS: Yomitan v3 index/term/tag schemas, 69 preserved senses, 120 rows, 8 conjugated forms via upstream Japanese transformer.');
