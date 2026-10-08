import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	LETTERS,
	letterWidth,
	wordSize,
	buildRules,
	scaleFactor,
	pickRule,
	applyRule,
	iterate,
} from '../ifs.js';

const EPSILON = 1e-9;

function mapPoint(rule, x, y) {
	return {
		x: rule.a * x + rule.b * y + rule.e,
		y: rule.c * x + rule.d * y + rule.f,
	};
}

// Left and right x of each letter of SPAM. M is 5 units wide.
const SPAM_LETTER_BOXES = [
	[0, 3],
	[4, 7],
	[8, 11],
	[12, 17],
];

function isDiagonal(stroke) {
	return 'from' in stroke;
}

test('M is 5 units wide and the other letters are 3', () => {
	assert.equal(letterWidth('M'), 5);
	assert.equal(letterWidth('S'), 3);
	assert.equal(letterWidth('P'), 3);
	assert.equal(letterWidth('A'), 3);
});

test('wordSize of SPAM is 17 by 5', () => {
	assert.deepEqual(wordSize('SPAM'), { width: 17, height: 5 });
});

test('buildRules returns one rule per stroke of SPAM', () => {
	const strokeCount = [...'SPAM'].reduce(
		(sum, letter) => sum + LETTERS[letter].length,
		0
	);
	assert.equal(strokeCount, 17);
	assert.equal(buildRules('SPAM').length, 17);
});

test('each axis rule maps the word box onto its stroke', () => {
	const { width, height } = wordSize('SPAM');
	const axisRules = buildRules('SPAM').filter((rule) => !isDiagonal(rule.stroke));
	for (const rule of axisRules) {
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

test('a diagonal rule maps the word middle line onto the stroke centerline', () => {
	const { width, height } = wordSize('SPAM');
	const diagonalRules = buildRules('SPAM').filter((rule) => isDiagonal(rule.stroke));
	assert.equal(diagonalRules.length, 2);
	for (const rule of diagonalRules) {
		const { from, to, thickness } = rule.stroke;
		const start = mapPoint(rule, 0, height / 2);
		const end = mapPoint(rule, width, height / 2);
		assert.ok(Math.abs(start.x - from[0]) < EPSILON);
		assert.ok(Math.abs(start.y - from[1]) < EPSILON);
		assert.ok(Math.abs(end.x - to[0]) < EPSILON);
		assert.ok(Math.abs(end.y - to[1]) < EPSILON);
		// The word's bottom edge sits half a thickness to the right of the
		// direction of travel, and its top edge half a thickness to the left.
		const bottom = mapPoint(rule, 0, 0);
		const top = mapPoint(rule, 0, height);
		assert.ok(Math.abs(Math.hypot(bottom.x - top.x, bottom.y - top.y) - thickness) < EPSILON);
		const directionX = to[0] - from[0];
		const directionY = to[1] - from[1];
		const cross = directionX * (top.y - bottom.y) - directionY * (top.x - bottom.x);
		assert.ok(cross > 0);
	}
});

test('every rule keeps the word inside its letter box', () => {
	const { width, height } = wordSize('SPAM');
	for (const rule of buildRules('SPAM')) {
		const [left, right] = SPAM_LETTER_BOXES[rule.letter];
		for (const [x, y] of [[0, 0], [width, 0], [0, height], [width, height]]) {
			const corner = mapPoint(rule, x, y);
			assert.ok(corner.x >= left - EPSILON && corner.x <= right + EPSILON);
			assert.ok(corner.y >= -EPSILON && corner.y <= height + EPSILON);
		}
	}
});

test('every rule shrinks', () => {
	for (const rule of buildRules('SPAM')) {
		assert.ok(scaleFactor(rule) < 1);
	}
});

test('the largest scale factor for SPAM is 5/17', () => {
	// The 1x5 posts stretch the 17-unit word along 5 units.
	const largest = Math.max(...buildRules('SPAM').map(scaleFactor));
	assert.ok(Math.abs(largest - 5 / 17) < EPSILON);
});

test('probabilities sum to 1', () => {
	const total = buildRules('SPAM').reduce((sum, rule) => sum + rule.p, 0);
	assert.ok(Math.abs(total - 1) < EPSILON);
});

test('a long post gets a higher probability than a short post', () => {
	const rules = buildRules('SPAM');
	const leftPostOfP = rules.find(
		(rule) => rule.stroke.x === 4 && rule.stroke.h === 5
	);
	const rightPostOfP = rules.find(
		(rule) => rule.stroke.x === 6 && rule.stroke.h === 2
	);
	assert.ok(leftPostOfP.p > rightPostOfP.p);
});

test('no two axis strokes of a letter overlap', () => {
	// Overlapping strokes stack two copies of the word on the same cells,
	// which blends their colors into mud. Diagonals have no grid cells, so
	// only the axis strokes are checked.
	for (const [letter, strokes] of Object.entries(LETTERS)) {
		const covered = new Set();
		for (const { x, y, w, h } of strokes.filter((stroke) => !isDiagonal(stroke))) {
			for (let cx = x; cx < x + w; cx++) {
				for (let cy = y; cy < y + h; cy++) {
					const cell = `${cx},${cy}`;
					assert.ok(!covered.has(cell), `${letter} covers ${cell} twice`);
					covered.add(cell);
				}
			}
		}
	}
});

test('every letter from A to Z has stroke data', () => {
	for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
		assert.ok(LETTERS[letter]?.length > 0, `${letter} has no strokes`);
	}
});

test('every letter keeps its copies inside its own box', () => {
	for (const letter of Object.keys(LETTERS)) {
		// A doubled letter, so the test also checks the offset of the second.
		const word = letter + letter;
		const { width, height } = wordSize(word);
		const firstLetterRules = buildRules(word).filter((rule) => rule.letter === 0);
		for (const rule of firstLetterRules) {
			for (const [x, y] of [[0, 0], [width, 0], [0, height], [width, height]]) {
				const corner = mapPoint(rule, x, y);
				assert.ok(
					corner.x >= -EPSILON && corner.x <= letterWidth(letter) + EPSILON,
					`${letter} stroke ${JSON.stringify(rule.stroke)} leaves the box`
				);
				assert.ok(corner.y >= -EPSILON && corner.y <= height + EPSILON);
			}
		}
	}
});

test('every diagonal reads left to right', () => {
	// A diagonal that runs right to left puts its copy upside down.
	for (const [letter, strokes] of Object.entries(LETTERS)) {
		for (const stroke of strokes.filter(isDiagonal)) {
			assert.ok(stroke.to[0] > stroke.from[0], `${letter} diagonal runs right to left`);
		}
	}
});

test('every letter can be drawn as a one-letter word', () => {
	// A full-width bar splits into several copies, so even a single letter shrinks.
	for (const letter of Object.keys(LETTERS)) {
		assert.ok(buildRules(letter).every((rule) => scaleFactor(rule) < 1), letter);
	}
});

// How much a rule squashes the word: its largest scale over its smallest.
// 1 means the copy keeps the word's proportions.
function squash(rule) {
	const largest = scaleFactor(rule);
	const smallest = Math.abs(rule.a * rule.d - rule.b * rule.c) / largest;
	return largest / smallest;
}

test('a long stroke in a short word holds several copies of the word', () => {
	// YZ is 7 by 5, so Z's 3x1 top bar holds two 1.5x1 copies. Z starts at x = 4.
	const topBarCopies = buildRules('YZ')
		.filter((rule) => rule.letter === 1 && !isDiagonal(rule.stroke) && rule.stroke.y === 4)
		.map((rule) => rule.stroke);
	assert.deepEqual(topBarCopies, [
		{ x: 4, y: 4, w: 1.5, h: 1, letter: 1 },
		{ x: 5.5, y: 4, w: 1.5, h: 1, letter: 1 },
	]);
});

test('every stroke of SPAM holds a single copy', () => {
	assert.equal(buildRules('SPAM').length, 17);
});

test('copies of a vertical stroke stay rotated', () => {
	// The 1x5 posts of HI split into copies, and each copy still reads upward.
	const postRules = buildRules('HI').filter(
		(rule) => rule.letter === 0 && rule.stroke.h > rule.stroke.w
	);
	assert.ok(postRules.length > 2);
	for (const rule of postRules) {
		assert.equal(rule.a, 0);
		assert.ok(rule.b < 0);
	}
});

test('copies of a diagonal stroke follow its centerline', () => {
	// The left diagonal of Y runs from (0.5, 4.5) to (1.5, 2.5) and splits in two.
	const pieces = buildRules('YZ')
		.filter((rule) => rule.letter === 0 && isDiagonal(rule.stroke))
		.map((rule) => rule.stroke)
		.filter((stroke) => stroke.from[0] < 1.5);
	assert.equal(pieces.length, 2);
	assert.deepEqual(pieces[0].from, [0.5, 4.5]);
	assert.deepEqual(pieces[0].to, [1, 3.5]);
	assert.deepEqual(pieces[1].from, [1, 3.5]);
	assert.deepEqual(pieces[1].to, [1.5, 2.5]);
});

test('no copy in a two-letter word is squashed by more than 1.5', () => {
	for (const rule of buildRules('YZ')) {
		assert.ok(squash(rule) <= 1.5 + EPSILON, `${JSON.stringify(rule.stroke)} squashes ${squash(rule)}`);
	}
});

test('probabilities still sum to 1 when strokes split', () => {
	const total = buildRules('YZ').reduce((sum, rule) => sum + rule.p, 0);
	assert.ok(Math.abs(total - 1) < EPSILON);
});

test('buildRules throws for a letter with no stroke data', () => {
	assert.throws(() => buildRules('SP1M'), /No stroke data for letter "1"/);
});

// A small linear congruential generator, so the test points are repeatable.
function seededRandom(seed) {
	let state = seed;
	return () => {
		state = (state * 1664525 + 1013904223) % 4294967296;
		return state / 4294967296;
	};
}

test('pickRule with r = 0 returns the first rule', () => {
	const rules = buildRules('SPAM');
	assert.equal(pickRule(rules, 0), rules[0]);
});

test('pickRule with r just below 1 returns the last rule', () => {
	const rules = buildRules('SPAM');
	assert.equal(pickRule(rules, 0.999999999), rules[rules.length - 1]);
});

test('applyRule maps the origin to the rule offset', () => {
	const rule = { a: 0.5, b: 0, c: 0, d: 0.5, e: 2, f: 3 };
	assert.deepEqual(applyRule(rule, { x: 0, y: 0 }), { x: 2, y: 3 });
	assert.deepEqual(applyRule(rule, { x: 4, y: 2 }), { x: 4, y: 4 });
});

function collect(rules, count, burnIn, rand) {
	const points = [];
	iterate(rules, count, burnIn, rand, (x, y, letter) => {
		points.push({ x, y, letter });
	});
	return points;
}

test('buildRules tags each rule with its letter index', () => {
	const rules = buildRules('SPAM');
	assert.equal(rules[0].letter, 0);
	assert.equal(rules[rules.length - 1].letter, 3);
	assert.deepEqual(
		[...new Set(rules.map((rule) => rule.letter))],
		[0, 1, 2, 3]
	);
});

test('iterate visits count minus burnIn points', () => {
	const points = collect(buildRules('SPAM'), 1000, 20, seededRandom(1));
	assert.equal(points.length, 980);
});

test('every point from iterate lies inside the word box', () => {
	const { width, height } = wordSize('SPAM');
	const points = collect(buildRules('SPAM'), 5000, 20, seededRandom(42));
	for (const { x, y } of points) {
		assert.ok(x >= -EPSILON && x <= width + EPSILON);
		assert.ok(y >= -EPSILON && y <= height + EPSILON);
	}
});

test('iterate reports the letter of the rule applied before the last one', () => {
	// Alternate between the first rule (an S stroke) and the last rule (an M stroke).
	let calls = 0;
	const alternate = () => (calls++ % 2 === 0 ? 0 : 0.999999999);
	const points = collect(buildRules('SPAM'), 6, 2, alternate);
	// Steps 2..5 apply S, M, S, M, so the rule before each is M, S, M, S.
	assert.deepEqual(
		points.map((point) => point.letter),
		[3, 0, 3, 0]
	);
});
