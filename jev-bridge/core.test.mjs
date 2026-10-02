import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildRequest, evaluate, parseResponse, validateInput, MODEL} from './core.mjs';

const input = {sentence: '彼は電話をかけた。壁に絵をかけた。', target: '掛ける', reading: 'かける', surface: 'かけた', targetOffset: 13, candidates: [{id: 'd1', text: 'to hang; to suspend'}, {id: 'd2', text: 'to make a phone call'}]};
input.targetOffset = input.sentence.lastIndexOf(input.surface);
const payload = {model: MODEL, answers: {sense: {type: 'choice', choice: 'd1', probabilities: {d1: 0.8, d2: 0.1, unclear: 0.1}, confidence: 0.8}}};

test('passes exact repeated occurrence and all source glosses, with explicit unclear', () => {
    const request = buildRequest(input);
    assert.equal(request.state.targetOffset, 13);
    assert.equal(request.state.surface, 'かけた');
    assert.equal(request.questions.sense.criteria.d1, 'to hang; to suspend');
    assert.deepEqual(Object.keys(request.questions.sense.criteria), ['d1', 'd2', 'unclear']);
});

test('rejects mismatched, absent, fractional, negative, or out of bounds occurrence', () => {
    for (const change of [{targetOffset: 0}, {targetOffset: -1}, {targetOffset: 0.5}, {targetOffset: 400}, {surface: '掛けた'}, {surface: undefined}, {targetOffset: undefined}]) {
        assert.throws(() => validateInput({...input, ...change}), TypeError);
    }
});

test('validates input shape, IDs and bounded context', () => {
    for (const change of [{sentence: ''}, {sentence: 'あ'.repeat(1201)}, {candidates: []}, {candidates: Array.from({length: 201}, (_, i) => ({id: `d${i}`, text: 'meaning'}))}, {candidates: [{id: 'unclear', text: 'meaning'}]}, {candidates: [{id: 'd1', text: 'one'}, {id: 'd1', text: 'two'}]}, {candidates: [{id: 'd1', text: 'あ'.repeat(4001)}]}]) {
        assert.throws(() => validateInput({...input, ...change}), TypeError);
    }
    assert.throws(() => validateInput({...input, candidates: Array.from({length: 100}, (_, i) => ({id: `d${i}`, text: 'あ'.repeat(300)}))}), /64 KiB/);
});

test('requires exact finite probability distribution and argmax choice', () => {
    assert.deepEqual(parseResponse(payload, input), {choice: 'd1', probabilities: {d1: 0.8, d2: 0.1, unclear: 0.1}, confidence: 0.8, model: MODEL});
    for (const answer of [
        {...payload.answers.sense, choice: 'invented'},
        {...payload.answers.sense, choice: 'd2'},
        {...payload.answers.sense, confidence: '0.8'},
        {...payload.answers.sense, probabilities: {d1: 1}},
        {...payload.answers.sense, probabilities: {d1: NaN, d2: 0, unclear: 0}},
        {...payload.answers.sense, probabilities: {d1: 0.8, d2: 0.1, unclear: 0.1, extra: 0}},
        {...payload.answers.sense, probabilities: {d1: 0.8, d2: 0.1, unclear: 0.5}},
    ]) assert.throws(() => parseResponse({model: MODEL, answers: {sense: answer}}, input), TypeError);
});

test('unclear remains a first class result', () => {
    const answer = {type: 'choice', choice: 'unclear', probabilities: {d1: 0.2, d2: 0.2, unclear: 0.6}, confidence: 0.6};
    assert.equal(parseResponse({model: MODEL, answers: {sense: answer}}, input).choice, 'unclear');
});

test('provider request keeps key server-side, disables redirect and sets timeout', async () => {
    const result = await evaluate(input, 'test-only-key', async (url, options) => {
        assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
        assert.equal(options.headers.Authorization, 'Bearer test-only-key');
        assert.equal(options.redirect, 'error');
        assert.ok(options.signal instanceof AbortSignal);
        assert.equal(JSON.parse(options.body).model, MODEL);
        return {ok: true, json: async () => payload};
    });
    assert.equal(result.choice, 'd1');
    assert.ok(result.latencyMs >= 0);
    assert.equal(Object.hasOwn(result, 'request'), false);
});

test('provider failures never forward bodies or retry', async () => {
    let calls = 0;
    await assert.rejects(evaluate(input, 'test-only-key', async () => { ++calls; return {ok: false, status: 429}; }), /rate limited/);
    assert.equal(calls, 1);
    await assert.rejects(evaluate(input, 'test-only-key', async () => { throw new Error('sensitive upstream data'); }), /connection failed/);
    await assert.rejects(evaluate(input, 'test-only-key', async () => ({ok: true, json: async () => ({})})), /invalid sense distribution/);
});
