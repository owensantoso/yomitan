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
import {afterEach, describe, expect, test, vi} from 'vitest';
import {JevDisplayController} from '../ext/js/display/jev-display-controller.js';

/** @type {JSDOM[]} */
const documents = [];

afterEach(() => {
    vi.unstubAllGlobals();
    for (const dom of documents.splice(0)) { dom.window.close(); }
});

/**
 * @param {string} choice
 * @returns {import('jev').SenseResult}
 */
function result(choice = 'd1') {
    return {choice, probabilities: choice === 'd1' ? {d1: 0.8, d2: 0.1, unclear: 0.1} : {d1: 0.1, d2: 0.8, unclear: 0.1}, confidence: 0.8, model: 'jev-1.13.0', latencyMs: 25};
}

/**
 * @returns {{promise: Promise<import('jev').SenseResult>, resolve: (value: import('jev').SenseResult) => void}}
 */
function deferred() {
    /** @type {(value: import('jev').SenseResult) => void} */
    let resolve = () => {};
    /** @type {Promise<import('jev').SenseResult>} */
    const promise = new Promise((resolveFn) => { resolve = resolveFn; });
    return {promise, resolve};
}

/** */
async function settle() {
    // API promise continuation, followed by its DOM mutations.
    await Promise.resolve();
    await Promise.resolve();
}

/**
 * @param {boolean} enabled
 * @returns {Promise<{controller: JevDisplayController, document: Document, toggle: HTMLInputElement, apiCall: ReturnType<typeof vi.fn<(request: import('jev').SenseRequest) => Promise<import('jev').SenseResult>>>, storageSet: ReturnType<typeof vi.fn>, scrollIntoView: ReturnType<typeof vi.fn>, container: HTMLElement}>}
 */
async function setup(enabled = false) {
    const dom = new JSDOM('<main><div id="entries"></div></main>');
    documents.push(dom);
    const {document} = dom.window;
    const scrollIntoView = vi.fn();
    dom.window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    vi.stubGlobal('document', document);
    const storageSet = vi.fn(async () => {});
    vi.stubGlobal('chrome', {storage: {local: {get: vi.fn(async () => (enabled ? {jevSenseEnabled: true} : {})), set: storageSet}}});
    const apiCall = vi.fn(/**
                           * @param {import('jev').SenseRequest} _request
                           * @returns {Promise<import('jev').SenseResult>}
                           */ async (_request) => result(),
    );
    const controller = new JevDisplayController(/** @type {import('../ext/js/comm/api.js').API} */ (/** @type {unknown} */ ({jevEvaluate: apiCall})));
    const container = /** @type {HTMLElement} */ (document.querySelector('#entries'));
    await controller.prepare(container);
    const toggle = /** @type {HTMLInputElement} */ (document.querySelector('.jev-toggle'));
    return {controller, document, toggle, apiCall, storageSet, scrollIntoView, container};
}

/**
 * @param {Document} document
 * @param {HTMLElement} container
 * @returns {{entry: import('dictionary').TermDictionaryEntry, node: HTMLElement}}
 */
function dictionary(document, container) {
    const node = document.createElement('div');
    node.className = 'entry';
    // Two actual sense groups: the first has two synonymous English glosses.
    node.innerHTML = '<ol class="definition-list"><li class="definition-item" data-index="0" data-dictionary="JMdict"><ol class="gloss-list"><li class="gloss-item"><span class="gloss-content">to hang</span></li><li class="gloss-item"><span class="gloss-content">to suspend</span></li></ol></li><li class="definition-item" data-index="1" data-dictionary="JMdict"><ol class="gloss-list"><li class="gloss-item"><span class="gloss-content">to make a phone call</span></li></ol></li></ol>';
    container.replaceChildren(node);
    const entry = /** @type {import('dictionary').TermDictionaryEntry} */ (/** @type {unknown} */ ({type: 'term', headwords: [{term: '掛ける', reading: 'かける', sources: [{isPrimary: true}]}], definitions: [{dictionary: 'JMdict', entries: ['to hang', 'to suspend'], tags: []}, {dictionary: 'JMdict', entries: ['to make a phone call'], tags: []}]}));
    return {entry, node};
}

/**
 * @param {JevDisplayController} controller
 * @param {{entry: import('dictionary').TermDictionaryEntry, node: HTMLElement}} lookup
 */
function update(controller, lookup) {
    controller.update([lookup.entry], [lookup.node], {text: '壁に絵をかけた。', offset: 4}, 'かけた');
}

/**
 * @param {HTMLInputElement} toggle
 * @param {boolean} enabled
 * @throws {Error} Missing test window.
 */
function change(toggle, enabled) {
    toggle.checked = enabled;
    const window = toggle.ownerDocument.defaultView;
    if (window === null) { throw new Error('Missing test window.'); }
    toggle.dispatchEvent(new window.Event('change'));
}

describe('Jev display integration', () => {
    test('default off renders ordinary dictionary and sends no API requests', async () => {
        const {controller, document, container, apiCall, toggle, scrollIntoView} = await setup();
        const lookup = dictionary(document, container);
        update(controller, lookup);
        await settle();
        expect(toggle.checked).toBe(false);
        expect(apiCall).not.toHaveBeenCalled();
        expect(lookup.node.querySelectorAll('.gloss-item')).toHaveLength(3);
        expect(document.querySelectorAll('.jev-sense-winner, .jev-score')).toHaveLength(0);
        expect(scrollIntoView).not.toHaveBeenCalled();
        expect(document.querySelector('.jev-status')?.textContent).toBe('Off · dictionary only');
    });

    test('enabling ranks source sense groups, highlights a complete sense and preserves order', async () => {
        const {controller, document, container, apiCall, toggle, storageSet, scrollIntoView} = await setup();
        const lookup = dictionary(document, container);
        update(controller, lookup);
        change(toggle, true);
        await settle();
        expect(storageSet).toHaveBeenCalledWith({jevSenseEnabled: true});
        expect(apiCall).toHaveBeenCalledExactlyOnceWith({sentence: '壁に絵をかけた。', target: '掛ける', reading: 'かける', targetOffset: 4, surface: 'かけた', candidates: [{id: 'd1', text: 'to hang; to suspend'}, {id: 'd2', text: 'to make a phone call'}]});
        const definitions = lookup.node.querySelectorAll('.definition-item');
        expect(definitions[0].classList.contains('jev-sense-winner')).toBe(true);
        expect(definitions[0].querySelectorAll('.gloss-item')).toHaveLength(2);
        expect(definitions[1].classList.contains('jev-sense-winner')).toBe(false);
        expect([...lookup.node.querySelectorAll('.jev-score')].map((node) => node.textContent)).toEqual(['JEV 80%', 'JEV 10%']);
        expect(document.querySelector('.jev-status')?.textContent).toContain('Likely sense');
        expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({block: 'nearest'});
        expect(scrollIntoView.mock.contexts[0]).toBe(definitions[0]);
    });

    test('late earlier lookup cannot highlight or annotate replacement popup', async () => {
        const {controller, document, container, apiCall, scrollIntoView} = await setup(true);
        const firstReply = deferred();
        const nextReply = deferred();
        apiCall.mockReturnValueOnce(firstReply.promise).mockReturnValueOnce(nextReply.promise);
        const first = dictionary(document, container);
        update(controller, first);
        const replacement = dictionary(document, container);
        update(controller, replacement);
        nextReply.resolve(result('d2'));
        await settle();
        expect(replacement.node.querySelector('.jev-sense-winner')).toBe(replacement.node.querySelectorAll('.definition-item')[1]);
        firstReply.resolve(result('d1'));
        await settle();
        expect(first.node.querySelectorAll('.jev-sense-winner, .jev-score')).toHaveLength(0);
        expect(replacement.node.querySelectorAll('.jev-sense-winner')).toHaveLength(1);
        expect(replacement.node.querySelectorAll('.jev-score')).toHaveLength(2);
        expect(replacement.node.querySelector('.jev-sense-winner')).toBe(replacement.node.querySelectorAll('.definition-item')[1]);
        expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({block: 'nearest'});
        expect(scrollIntoView.mock.contexts[0]).toBe(replacement.node.querySelectorAll('.definition-item')[1]);
    });

    test('disabling while pending ignores the response and leaves dictionary available', async () => {
        const {controller, document, container, apiCall, toggle, storageSet, scrollIntoView} = await setup(true);
        const reply = deferred();
        apiCall.mockReturnValueOnce(reply.promise);
        const lookup = dictionary(document, container);
        update(controller, lookup);
        change(toggle, false);
        reply.resolve(result());
        await settle();
        expect(storageSet).toHaveBeenCalledWith({jevSenseEnabled: false});
        expect(apiCall).toHaveBeenCalledTimes(1);
        expect(document.querySelectorAll('.jev-sense-winner, .jev-score')).toHaveLength(0);
        expect(scrollIntoView).not.toHaveBeenCalled();
        expect(lookup.node.querySelectorAll('.gloss-item')).toHaveLength(3);
        expect(document.querySelector('.jev-status')?.textContent).toBe('Off · dictionary only');
    });

    test('bridge rejection preserves glossary and reports unavailable without a winner', async () => {
        const {controller, document, container, apiCall, scrollIntoView} = await setup(true);
        apiCall.mockRejectedValueOnce(new Error('Bridge unavailable'));
        const lookup = dictionary(document, container);
        update(controller, lookup);
        await settle();
        expect(document.querySelectorAll('.jev-sense-winner, .jev-score')).toHaveLength(0);
        expect(scrollIntoView).not.toHaveBeenCalled();
        expect(lookup.node.querySelectorAll('.gloss-content')).toHaveLength(3);
        expect(document.querySelector('.jev-status')?.textContent).toBe('JEV unavailable · dictionary still works');
    });

    test('invalid bridge distribution cannot select or annotate a sense', async () => {
        const {controller, document, container, apiCall, scrollIntoView} = await setup(true);
        apiCall.mockResolvedValueOnce({...result(), probabilities: {d1: 1, fabricated: 0}});
        const lookup = dictionary(document, container);
        update(controller, lookup);
        await settle();
        expect(document.querySelectorAll('.jev-sense-winner, .jev-score')).toHaveLength(0);
        expect(scrollIntoView).not.toHaveBeenCalled();
        expect(lookup.node.querySelectorAll('.gloss-item')).toHaveLength(3);
        expect(document.querySelector('.jev-status')?.textContent).toBe('JEV unavailable · dictionary still works');
    });

    test('unclear displays every candidate weight without declaring a winner', async () => {
        const {controller, document, container, apiCall, scrollIntoView} = await setup(true);
        apiCall.mockResolvedValueOnce({...result(), choice: 'unclear', probabilities: {d1: 0.2, d2: 0.2, unclear: 0.6}, confidence: 0.6});
        update(controller, dictionary(document, container));
        await settle();
        expect(document.querySelectorAll('.jev-sense-winner')).toHaveLength(0);
        expect(scrollIntoView).not.toHaveBeenCalled();
        expect(document.querySelectorAll('.jev-score')).toHaveLength(2);
        expect(document.querySelector('.jev-status')?.textContent).toContain('Context unclear');
    });
});
