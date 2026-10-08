import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWord, MIN_WORD_LENGTH, MAX_WORD_LENGTH } from '../word.js';

test('normalizeWord uppercases letters', () => {
	assert.equal(normalizeWord('spam'), 'SPAM');
});

test('normalizeWord drops everything that is not a letter', () => {
	assert.equal(normalizeWord('Hi 2u!'), 'HIU');
});

test('normalizeWord drops accented letters', () => {
	assert.equal(normalizeWord('café'), 'CAF');
});

test('normalizeWord keeps at most the maximum number of letters', () => {
	assert.equal(normalizeWord('abcdefghijk'), 'ABCDEFGH');
	assert.equal(MAX_WORD_LENGTH, 8);
});

test('normalizeWord returns an empty string for no letters', () => {
	assert.equal(normalizeWord('123 !?'), '');
});

test('the minimum word length is 1', () => {
	assert.equal(MIN_WORD_LENGTH, 1);
});
