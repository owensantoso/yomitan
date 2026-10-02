/*
 * Copyright (C) 2023-2026  Yomitan Authors
 * Copyright (C) 2016-2022  Yomichan Authors
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

import {safePerformance} from '../core/safe-performance.js';
import {collectSenseCandidates, validateSenseResult} from './jev-sense-ranking.js';

/** Adds optional contextual ranking without blocking ordinary dictionary rendering. */
export class JevDisplayController {
    /** @param {import('../comm/api.js').API} api */
    constructor(api) {
        /** @type {import('../comm/api.js').API} */
        this._api = api;
        /** @type {boolean} */
        this._enabled = false;
        /** @type {number} */
        this._generation = 0;
        /** @type {?HTMLInputElement} */
        this._toggle = null;
        /** @type {?HTMLElement} */
        this._status = null;
        /** @type {?{entries: import('dictionary').DictionaryEntry[], nodes: HTMLElement[], sentence: {text: string, offset: number}, surface: string}} */
        this._lookup = null;
    }

    /** @param {HTMLElement} container */
    async prepare(container) {
        const row = document.createElement('div');
        row.className = 'jev-toolbar scan-disable';
        const label = document.createElement('label');
        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.className = 'jev-toggle';
        label.append(toggle, document.createTextNode(' JEV context'));
        label.title = 'When enabled, sends this lookup’s sentence and dictionary senses to TypeSafe through your local bridge.';
        const status = document.createElement('span');
        status.className = 'jev-status';
        status.setAttribute('role', 'status');
        status.textContent = 'Off · dictionary only';
        row.append(label, status);
        container.before(row);
        this._toggle = toggle;
        this._status = status;
        const stored = await chrome.storage.local.get('jevSenseEnabled');
        this._enabled = stored.jevSenseEnabled === true;
        toggle.checked = this._enabled;
        toggle.addEventListener('change', () => {
            this._enabled = toggle.checked;
            void chrome.storage.local.set({jevSenseEnabled: this._enabled});
            this._clear();
            if (this._lookup !== null) { void this._rank(); }
        });
    }

    /**
     * @param {import('dictionary').DictionaryEntry[]} entries
     * @param {HTMLElement[]} nodes
     * @param {{text: string, offset: number}} sentence
     * @param {string} surface
     */
    update(entries, nodes, sentence, surface) {
        this._clear();
        this._lookup = {entries, nodes, sentence, surface};
        void this._rank();
    }

    /** Invalidates every response from a previous popup lookup. */
    reset() {
        this._clear();
        this._lookup = null;
    }

    /** */
    _clear() {
        ++this._generation;
        for (const node of document.querySelectorAll('.jev-sense-winner')) {
            node.classList.remove('jev-sense-winner');
        }
        for (const node of document.querySelectorAll('.jev-score')) { node.remove(); }
        if (this._status !== null) { this._status.textContent = this._enabled ? 'Sentence context ready' : 'Off · dictionary only'; }
    }

    /** */
    async _rank() {
        const lookup = this._lookup;
        const status = this._status;
        if (!this._enabled || lookup === null || status === null) { return; }
        const {entries, nodes, sentence, surface} = lookup;
        if (!sentence.text.trim() || sentence.text === surface) {
            status.textContent = 'No surrounding sentence · dictionary only';
            return;
        }
        const index = entries.findIndex((entry) => entry.type === 'term');
        if (index < 0 || !nodes[index]) { return; }
        const entry = entries[index];
        if (entry.type !== 'term') { return; }
        const collected = collectSenseCandidates(nodes[index], entry);
        if (collected.candidates.length < 2) {
            status.textContent = 'One dictionary sense · no ranking needed';
            return;
        }
        if (sentence.text.length > 1200) {
            status.textContent = 'Context exceeds 1,200 characters · dictionary only';
            return;
        }
        const generation = this._generation;
        status.textContent = `Scoring ${collected.candidates.length} senses…`;
        const started = safePerformance.now();
        try {
            const rawResult = await this._api.jevEvaluate({
                sentence: sentence.text,
                target: collected.target,
                reading: collected.reading,
                targetOffset: sentence.offset,
                surface,
                candidates: collected.candidates.map(({id, text}) => ({id, text})),
            });
            if (generation !== this._generation || !this._enabled) { return; }
            const result = validateSenseResult(rawResult, collected.candidates);
            const elapsed = Math.round(safePerformance.now() - started);
            if (result.choice === 'unclear') {
                status.textContent = `Context unclear · ${elapsed} ms`;
            } else {
                const winner = collected.elements.get(result.choice);
                if (!winner) { throw new Error('Response did not match this dictionary lookup.'); }
                winner.classList.add('jev-sense-winner');
                status.textContent = `Likely sense · ${elapsed} ms`;
            }
            for (const {id} of collected.candidates) {
                const element = collected.elements.get(id);
                if (!element) { continue; }
                const score = document.createElement('span');
                score.className = 'jev-score';
                score.textContent = `JEV ${Math.round(result.probabilities[id] * 100)}%`;
                score.title = `${result.model} model estimate; not calibrated accuracy. API round trip ${result.latencyMs} ms.`;
                element.prepend(score);
            }
            status.title = `${result.model}. Model estimates, not validated accuracy. Sentence only; original dictionary order preserved.`;
            // A selected sense can be far below the popup's initial viewport.
            collected.elements.get(result.choice)?.scrollIntoView({block: 'nearest'});
        } catch (error) {
            if (generation !== this._generation) { return; }
            status.textContent = 'JEV unavailable · dictionary still works';
            status.title = error instanceof Error ? error.message : 'Bridge request failed.';
        }
    }
}
