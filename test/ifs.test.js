import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LETTERS, wordSize, buildRules, scaleFactor } from '../ifs.js';

const EPSILON = 1e-9;

function mapPoint(rule, x, y) {
	return {
		x: rule.a * x + rule.b * y + rule.e,
		y: rule.c * x + rule.d * y + rule.f,
	};
}

test('wordSize of SPAM is 15 by 5', () => {
	assert.deepEqual(wordSize('SPAM'), { width: 15, height: 5 });
});

test('buildRules returns one rule per stroke of SPAM', () => {
	const strokeCount = [...'SPAM'].reduce(
		(sum, letter) => sum + LETTERS[letter].length,
		0
	);
	assert.equal(strokeCount, 17);
	assert.equal(buildRules('SPAM').length, 17);
});

test('each rule maps the word box onto its stroke', () => {
	const { width, height } = wordSize('SPAM');
	for (const rule of buildRules('SPAM')) {
		const corners = [
			mapPoint(rule, 0, 0),
			mapPoint(rule, width, 0),
			mapPoint(rule, 0, height),
			mapPoint(rule, width, height),
		];
		const xs = corners.map((corner) => corner.x);
		const ys = corners.map((corner) => corner.y);
		const { x, y, w, h } = rule.stroke;
		assert.ok(Math.abs(Math.min(...xs) - x) < EPSILON);
		assert.ok(Math.abs(Math.max(...xs) - (x + w)) < EPSILON);
		assert.ok(Math.abs(Math.min(...ys) - y) < EPSILON);
		assert.ok(Math.abs(Math.max(...ys) - (y + h)) < EPSILON);
	}
});

test('a vertical rule rotates the word counter-clockwise', () => {
	// P's left post is the first stroke of the second letter, at x = 4.
	const rule = buildRules('SPAM').find(
		(candidate) => candidate.stroke.x === 4 && candidate.stroke.h === 5
	);
	const { width, height } = wordSize('SPAM');
	const origin = mapPoint(rule, 0, 0);
	const farCorner = mapPoint(rule, width, height);
	assert.ok(Math.abs(origin.x - 5) < EPSILON);
	assert.ok(Math.abs(origin.y - 0) < EPSILON);
	assert.ok(Math.abs(farCorner.x - 4) < EPSILON);
	assert.ok(Math.abs(farCorner.y - 5) < EPSILON);
});

test('every rule shrinks', () => {
	for (const rule of buildRules('SPAM')) {
		assert.ok(scaleFactor(rule) < 1);
	}
});

test('the largest scale factor for SPAM is one third', () => {
	const largest = Math.max(...buildRules('SPAM').map(scaleFactor));
	assert.ok(Math.abs(largest - 1 / 3) < EPSILON);
});

test('probabilities sum to 1', () => {
	const total = buildRules('SPAM').reduce((sum, rule) => sum + rule.p, 0);
	assert.ok(Math.abs(total - 1) < EPSILON);
});

test('a long bar gets a higher probability than a short post', () => {
	const rules = buildRules('SPAM');
	const leftPostOfP = rules.find(
		(rule) => rule.stroke.x === 4 && rule.stroke.h === 5
	);
	const rightPostOfP = rules.find(
		(rule) => rule.stroke.x === 6 && rule.stroke.h === 3
	);
	assert.ok(leftPostOfP.p > rightPostOfP.p);
});

test('buildRules throws for a letter with no stroke data', () => {
	assert.throws(() => buildRules('SPQM'), /No stroke data for letter "Q"/);
});
