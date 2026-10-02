/*
 * Copyright (C) 2023-2026  Yomitan Authors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import {JSDOM} from 'jsdom';
import {describe, expect, test} from 'vitest';
import {StructuredContentGenerator} from '../ext/js/display/structured-content-generator.js';
import {collectSenseCandidates, normalizeJevSentence, validateSenseResult} from '../ext/js/display/jev-sense-ranking.js';

/**
 * @param {string} html
 * @returns {HTMLElement}
 */
function entryNode(html) {
    const {document} = new JSDOM(`<div class="entry"><ol class="definition-list">${html}</ol></div>`).window;
    return /** @type {HTMLElement} */ (document.querySelector('.entry'));
}

/**
 * @param {{entries: string[], dictionary?: string}[]} definitions
 * @returns {import('dictionary').TermDictionaryEntry}
 */
function entry(definitions) {
    // These are the collector's relevant fields; full translator metadata is unused.
    return /** @type {import('dictionary').TermDictionaryEntry} */ (/** @type {unknown} */ ({
        headwords: [{term: '掛ける', reading: 'かける', sources: [{isPrimary: true}]}],
        definitions: definitions.map(({entries, dictionary = 'JMdict'}) => ({dictionary, entries, tags: []})),
    }));
}

describe('Jev dictionary candidate boundaries', () => {
    test('uses full JMdict source sense tags and glossary, excludes forms and references', () => {
        const node = entryNode('<li class="definition-item" data-index="0" data-dictionary="JMdict"><ol class="gloss-list"><li class="gloss-item"><span class="gloss-content">掛ける かける</span></li></ol></li><li class="definition-item" data-index="1" data-dictionary="JMdict"><ol class="gloss-list"><li class="gloss-item"><span class="gloss-content"></span></li></ol></li>');
        const glossary = {type: 'structured-content', content: [{tag: 'ul', data: {content: 'glossary'}, lang: 'en', content: [{tag: 'li', content: 'to hang'}, {tag: 'li', content: 'to suspend'}]}, {tag: 'ul', data: {content: 'notes'}, content: {tag: 'li', content: 'after -masu stem of verb'}}, {tag: 'ul', data: {content: 'references'}, content: {tag: 'li', content: 'See: related entry'}}]};
        const generator = new StructuredContentGenerator(/** @type {import('../ext/js/display/display-content-manager.js').DisplayContentManager} */ (/** @type {unknown} */ (null)), node.ownerDocument, /** @type {Window} */ (/** @type {unknown} */ (node.ownerDocument.defaultView)));
        const container = /** @type {HTMLElement} */ (node.querySelectorAll('.gloss-content')[1]);
        generator.appendStructuredContent(container, /** @type {import('structured-content').Content} */ (glossary.content), 'JMdict');
        const dictionaryEntry = entry([{entries: ['掛ける かける']}, {entries: []}]);
        dictionaryEntry.definitions[0].tags = [{name: 'forms', category: '', order: 0, score: 0, content: [], dictionaries: [], redundant: false}];
        dictionaryEntry.definitions[1].tags = [{name: '4', category: '', order: 0, score: 0, content: [], dictionaries: [], redundant: false}];
        const result = collectSenseCandidates(node, dictionaryEntry);
        expect(result.candidates).toHaveLength(1);
        expect(result.candidates[0].text).toBe('[4] to hang to suspend; Usage note: after -masu stem of verb');
        expect(result.candidates[0].sourceSenseNumber).toBe(4);
        expect(result.elements.get('d2')).toBe(node.querySelectorAll('.definition-item')[1]);
        expect(result.granularity).toBe('sense');
    });

    test('rejects a bridge result with unknown, missing or nonfinite option weights', () => {
        const candidates = [{id: 'd1'}, {id: 'd2'}];
        const result = {choice: 'd1', probabilities: {d1: 0.8, d2: 0.1, unclear: 0.1}, confidence: 0.8, model: 'jev-1.13.0', latencyMs: 100};
        expect(validateSenseResult(result, candidates)).toEqual(result);
        expect(() => validateSenseResult({...result, choice: 'invented'}, candidates)).toThrow(TypeError);
        expect(() => validateSenseResult({...result, probabilities: {d1: 1}}, candidates)).toThrow(TypeError);
        expect(() => validateSenseResult({...result, latencyMs: Number.NaN}, candidates)).toThrow(TypeError);
        expect(() => validateSenseResult({...result, choice: 'd2'}, candidates)).toThrow(TypeError);
        expect(() => validateSenseResult(null, candidates)).toThrow(TypeError);
    });

    test('keeps English synonyms in one plain JMdict definition', () => {
        const node = entryNode('<li class="definition-item" data-index="0" data-dictionary="JMdict"><ol class="gloss-list"><li class="gloss-item"><span class="gloss-content">to hang</span></li><li class="gloss-item"><span class="gloss-content">to suspend</span></li></ol></li><li class="definition-item" data-index="1" data-dictionary="JMdict"><ol class="gloss-list"><li class="gloss-item"><span class="gloss-content">to make a phone call</span></li></ol></li>');
        const result = collectSenseCandidates(node, entry([{entries: ['to hang', 'to suspend']}, {entries: ['to make a phone call']}]));
        expect(result.candidates.map(({id, text}) => ({id, text}))).toEqual([{id: 'd1', text: 'to hang; to suspend'}, {id: 'd2', text: 'to make a phone call'}]);
        expect(result.elements.get('d1')).toBe(node.querySelector('.definition-item'));
        expect(result.granularity).toBe('definition');
        expect(result.target).toBe('掛ける');
        expect(result.reading).toBe('かける');
    });

    test('maps Jitendex senses rather than nested glossary synonym list items', () => {
        const node = entryNode('<li class="definition-item" data-index="0" data-dictionary="Jitendex"><ol class="gloss-list"><li class="gloss-item"><span class="gloss-content structured-content"><ol><li data-sc-sense-number="1"><ul data-sc-content="glossary"><li>to hang</li><li>to suspend</li></ul></li><li data-sc-sense-number="2"><ul data-sc-content="glossary"><li>to make a phone call</li></ul></li></ol></span></li></ol></li>');
        const result = collectSenseCandidates(node, entry([{dictionary: 'Jitendex', entries: []}]));
        expect(result.candidates.map(({id, text}) => ({id, text}))).toEqual([{id: 'd1s1', text: 'to hang to suspend'}, {id: 'd1s2', text: 'to make a phone call'}]);
        expect(result.elements.get('d1s1')).toBe(node.querySelector('[data-sc-sense-number="1"]'));
        expect(result.granularity).toBe('sense');
    });

    test('unknown structured markup remains a whole definition', () => {
        const node = entryNode('<li class="definition-item" data-index="0" data-dictionary="Other"><ol class="gloss-list"><li class="gloss-item"><span class="gloss-content structured-content"><ul><li>first wording</li><li>another wording</li></ul></span></li></ol></li>');
        const result = collectSenseCandidates(node, entry([{dictionary: 'Other', entries: []}]));
        expect(result.candidates).toHaveLength(1);
        expect(result.candidates[0].text).toBe('first wording another wording');
        expect(result.candidates[0].senseIndex).toBeNull();
    });

    test('does not guess a mapping after source order or dictionary mismatches', () => {
        const node = entryNode('<li class="definition-item" data-index="0" data-dictionary="Different"><ol class="gloss-list"><li class="gloss-item"><span class="gloss-content">wrong sense</span></li></ol></li>');
        expect(collectSenseCandidates(node, entry([{entries: ['sense']}])).candidates).toEqual([]);
    });
});


describe('Jev hovered-occurrence offsets', () => {
    test('normalizes scanner code points across emoji without choosing the first repeated word', () => {
        const text = '😀彼は電話をかけた。壁に絵をかけた。';
        const surface = 'かけた';
        const utf16Offset = text.lastIndexOf(surface);
        const codePointOffset = 14;
        const normalized = normalizeJevSentence({text, offset: codePointOffset, jevOffsetUnit: 'code-point'});
        expect(codePointOffset).toBe(utf16Offset - 1);
        expect(normalized).toEqual({text, offset: utf16Offset});
        expect(normalized.text.slice(normalized.offset, normalized.offset + surface.length)).toBe(surface);
        expect(normalized.offset).toBeGreaterThan(text.indexOf(surface));
    });

    test('leaves URL/search UTF-16 offsets intact despite emoji and repeated words', () => {
        const text = '😀電話をかけた。絵をかけた。';
        const offset = text.lastIndexOf('かけた');
        expect(normalizeJevSentence({text, offset})).toEqual({text, offset});
        expect(normalizeJevSentence({text, offset, jevOffsetUnit: 'utf-16'})).toEqual({text, offset});
    });
});
