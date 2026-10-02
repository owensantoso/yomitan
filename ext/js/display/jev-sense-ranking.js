/*
 * Copyright (C) 2023-2026  Yomitan Authors
 * Copyright (C) 2019-2022  Yomichan Authors
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

/**
 * @typedef {object} JevSenseCandidate
 * @property {string} id
 * @property {string} text
 * @property {string} dictionary
 * @property {number} definitionIndex
 * @property {?number} senseIndex
 * @property {?number} sourceSenseNumber
 */

/**
 * Collect candidates from the dictionary's own sense boundaries. Plain glossary
 * strings in a definition are synonyms, not independent sense choices. Structured
 * dictionaries expose explicit sense-number metadata which Yomitan preserves as
 * data-sc-sense-number. Unknown formats remain one whole-definition candidate.
 *
 * IDs are local to this rendered entry. Keep the returned mapping with the request;
 * never apply it to a replacement popup, even when its IDs happen to be identical.
 * @param {HTMLElement} entryNode
 * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
 * @returns {{target: string, reading: string, candidates: JevSenseCandidate[], elements: Map<string, HTMLElement>, granularity: 'sense'|'definition'|'mixed'}}
 */
export function collectSenseCandidates(entryNode, dictionaryEntry) {
    const {headwords, definitions} = dictionaryEntry;
    const headword = headwords.find(({sources}) => sources.some(({isPrimary}) => isPrimary)) ?? headwords[0];
    /** @type {JevSenseCandidate[]} */
    const candidates = [];
    /** @type {Map<string, HTMLElement>} */
    const elements = new Map();
    let hasSenses = false;
    let hasDefinitions = false;
    const definitionNodes = entryNode.querySelectorAll('.definition-list > .definition-item');
    for (let definitionIndex = 0; definitionIndex < definitions.length; ++definitionIndex) {
        const definition = definitions[definitionIndex];
        // JMdict's forms rows describe spellings, not possible meanings.
        if (definition.tags.some(({name}) => name === 'forms')) { continue; }
        const sourceSenseTag = definition.tags.find(({name}) => /^s?[1-9]\d*$/.test(name));
        const sourceSenseNumber = typeof sourceSenseTag === 'undefined' ? null : Number.parseInt(sourceSenseTag.name.replace(/^s/, ''), 10);
        const definitionNode = /** @type {HTMLElement|undefined} */ (definitionNodes[definitionIndex]);
        // Fail closed when rendered order/dictionary differs from the source entry.
        if (typeof definitionNode === 'undefined' || definitionNode.dataset.index !== `${definitionIndex}` || definitionNode.dataset.dictionary !== definition.dictionary) { continue; }
        const glossList = definitionNode.querySelector('.gloss-list');
        if (glossList === null) { continue; }
        const senseNodes = [...glossList.querySelectorAll('[data-sc-sense-number]')].filter((node) => node.parentElement?.closest('[data-sc-sense-number]') === null);
        const tags = definition.tags.map(({name}) => name).join(', ');
        if (senseNodes.length > 0) {
            for (let senseIndex = 0; senseIndex < senseNodes.length; ++senseIndex) {
                const node = /** @type {HTMLElement} */ (senseNodes[senseIndex]);
                // Preserve all glossary wording in the source sense, with its usage
                // hints. Do not split nested English synonym <li> nodes into senses.
                const text = normalizeText(glossaryText(node));
                if (text.length === 0) { continue; }
                const id = `d${definitionIndex + 1}s${senseIndex + 1}`;
                candidates.push({id, text: tags.length > 0 ? `[${tags}] ${text}` : text, dictionary: definition.dictionary, definitionIndex, senseIndex, sourceSenseNumber: Number.parseInt(node.dataset.scSenseNumber ?? '', 10) || null});
                elements.set(id, node);
                hasSenses = true;
            }
        } else {
            const text = [...glossList.querySelectorAll(':scope > .gloss-item > .gloss-content')].map((node) => normalizeText(glossaryText(node))).filter((value) => value.length > 0).join('; ');
            if (text.length === 0) { continue; }
            const id = `d${definitionIndex + 1}`;
            candidates.push({id, text: tags.length > 0 ? `[${tags}] ${text}` : text, dictionary: definition.dictionary, definitionIndex, senseIndex: null, sourceSenseNumber});
            elements.set(id, definitionNode);
            if (sourceSenseNumber === null) {
                hasDefinitions = true;
            } else {
                hasSenses = true;
            }
        }
    }
    return {
        target: headword?.term ?? '',
        reading: headword?.reading ?? '',
        candidates,
        elements,
        granularity: hasSenses && hasDefinitions ? 'mixed' : (hasSenses ? 'sense' : 'definition'),
    };
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeText(value) {
    return value.replace(/\s+/g, ' ').trim();
}

/**
 * Preserve visual block boundaries when textContent would concatenate glosses.
 * @param {Node} node
 * @returns {string}
 */
function elementText(node) {
    if (node.nodeType === 3) { return node.textContent ?? ''; }
    const text = [...node.childNodes].map(elementText).join('');
    const tagName = /** @type {Element} */ (node).tagName;
    return ['LI', 'UL', 'OL', 'DIV', 'P', 'BR'].includes(tagName) ? ` ${text} ` : text;
}

/**
 * @typedef {object} JevSenseResult
 * @property {string} choice
 * @property {Record<string, number>} probabilities
 * @property {number} confidence
 * @property {string} model
 * @property {number} latencyMs
 */

/**
 * Validate the bridge reply against the exact candidates captured for this popup.
 * This complements the display's request token check; it does not replace it.
 * @param {unknown} value
 * @param {{id: string}[]} candidates
 * @returns {JevSenseResult}
 * @throws {TypeError} Invalid or mismatched bridge result.
 */
export function validateSenseResult(value, candidates) {
    const result = /** @type {Partial<JevSenseResult>|null} */ (value);
    const ids = [...candidates.map(({id}) => id), 'unclear'];
    const weights = result?.probabilities;
    if (result === null || typeof result !== 'object' || typeof result.choice !== 'string' || !ids.includes(result.choice) || typeof result.model !== 'string' || result.model.length === 0 || typeof result.latencyMs !== 'number' || !Number.isFinite(result.latencyMs) || result.latencyMs < 0 || typeof result.confidence !== 'number' || !Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 1 || typeof weights !== 'object' || weights === null || Array.isArray(weights) || Object.keys(weights).length !== ids.length || !ids.every((id) => Object.hasOwn(weights, id) && typeof weights[id] === 'number' && Number.isFinite(weights[id]) && weights[id] >= 0 && weights[id] <= 1) || Math.abs(ids.reduce((sum, id) => sum + weights[id], 0) - 1) > 0.01 || weights[result.choice] + 1e-6 < Math.max(...ids.map((id) => weights[id]))) {
        throw new TypeError('Jev returned an invalid sense distribution.');
    }
    return {choice: result.choice, probabilities: Object.fromEntries(ids.map((id) => [id, weights[id]])), confidence: result.confidence, model: result.model, latencyMs: result.latencyMs};
}

/**
 * Structured dictionaries mark their meaning text separately from references and
 * example sentences. Preserve glossary and usage notes without inventing boundaries.
 * @param {Element} node
 * @returns {string}
 */
function glossaryText(node) {
    const glossaries = /** @type {NodeListOf<HTMLElement>} */ (node.querySelectorAll('[data-sc-content="glossary"], [data-sc-content="notes"]'));
    return glossaries.length > 0 ? [...glossaries].map((element) => (element.dataset.scContent === 'notes' ? `Usage note: ${normalizeText(elementText(element))}` : normalizeText(elementText(element)))).join('; ') : elementText(node);
}

/**
 * Convert scanner code-point offsets to the UTF-16 offsets used by JavaScript
 * slicing and the bridge. URL/search offsets already use UTF-16 and stay intact.
 * @param {{text: string, offset: number, jevOffsetUnit?: 'code-point'|'utf-16'}} sentence
 * @returns {{text: string, offset: number}}
 */
export function normalizeJevSentence(sentence) {
    const {text, offset, jevOffsetUnit} = sentence;
    return {text, offset: jevOffsetUnit === 'code-point' ? [...text].slice(0, offset).join('').length : offset};
}
