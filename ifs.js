export const LETTER_WIDTH = 3;
export const LETTER_HEIGHT = 5;
export const LETTER_GAP = 1;

// Posts overlap the bars they connect. Longer posts give the rotated
// copies more room, so the nested word is easier to read.
export const LETTERS = {
	S: [
		{ x: 0, y: 0, w: 3, h: 1 },
		{ x: 2, y: 0, w: 1, h: 3 },
		{ x: 0, y: 2, w: 3, h: 1 },
		{ x: 0, y: 2, w: 1, h: 3 },
		{ x: 0, y: 4, w: 3, h: 1 },
	],
	P: [
		{ x: 0, y: 0, w: 1, h: 5 },
		{ x: 0, y: 2, w: 3, h: 1 },
		{ x: 2, y: 2, w: 1, h: 3 },
		{ x: 0, y: 4, w: 3, h: 1 },
	],
	A: [
		{ x: 0, y: 0, w: 1, h: 5 },
		{ x: 2, y: 0, w: 1, h: 5 },
		{ x: 0, y: 2, w: 3, h: 1 },
		{ x: 0, y: 4, w: 3, h: 1 },
	],
	M: [
		{ x: 0, y: 0, w: 1, h: 5 },
		{ x: 1, y: 2, w: 1, h: 3 },
		{ x: 2, y: 0, w: 1, h: 5 },
		{ x: 0, y: 4, w: 3, h: 1 },
	],
};

export function wordSize(word) {
	return {
		width: word.length * (LETTER_WIDTH + LETTER_GAP) - LETTER_GAP,
		height: LETTER_HEIGHT,
	};
}

function strokesForWord(word) {
	const strokes = [];
	[...word].forEach((letter, index) => {
		const letterStrokes = LETTERS[letter];
		if (!letterStrokes) {
			throw new Error(`No stroke data for letter "${letter}"`);
		}
		const offset = index * (LETTER_WIDTH + LETTER_GAP);
		for (const stroke of letterStrokes) {
			strokes.push({ ...stroke, x: stroke.x + offset });
		}
	});
	return strokes;
}

function horizontalRule(stroke, width, height) {
	return {
		a: stroke.w / width,
		b: 0,
		c: 0,
		d: stroke.h / height,
		e: stroke.x,
		f: stroke.y,
	};
}

// Rotating 90 degrees counter-clockwise makes the word read bottom to top.
// The word's bottom-left corner lands on the stroke's bottom-right corner.
function verticalRule(stroke, width, height) {
	return {
		a: 0,
		b: -stroke.w / height,
		c: stroke.h / width,
		d: 0,
		e: stroke.x + stroke.w,
		f: stroke.y,
	};
}

export function scaleFactor({ a, b, c, d }) {
	const sumOfSquares = a * a + b * b + c * c + d * d;
	const determinant = a * d - b * c;
	const discriminant = Math.sqrt(
		Math.max(0, sumOfSquares * sumOfSquares - 4 * determinant * determinant)
	);
	return Math.sqrt((sumOfSquares + discriminant) / 2);
}

export function buildRules(word) {
	const { width, height } = wordSize(word);
	const strokes = strokesForWord(word);
	const totalArea = strokes.reduce((sum, stroke) => sum + stroke.w * stroke.h, 0);

	return strokes.map((stroke) => {
		const isVertical = stroke.h > stroke.w;
		const rule = isVertical
			? verticalRule(stroke, width, height)
			: horizontalRule(stroke, width, height);
		rule.p = (stroke.w * stroke.h) / totalArea;
		rule.stroke = stroke;

		// A rule that does not shrink makes the chaos game diverge.
		if (scaleFactor(rule) >= 1) {
			throw new Error(`Rule for stroke ${JSON.stringify(stroke)} does not shrink`);
		}
		return rule;
	});
}

export function pickRule(rules, r) {
	let cumulative = 0;
	for (const rule of rules) {
		cumulative += rule.p;
		if (r < cumulative) {
			return rule;
		}
	}
	// Floating-point rounding can leave the sum just below 1.
	return rules[rules.length - 1];
}

export function applyRule(rule, point) {
	return {
		x: rule.a * point.x + rule.b * point.y + rule.e,
		y: rule.c * point.x + rule.d * point.y + rule.f,
	};
}

// The first points have not reached the fractal yet, so burnIn skips them.
export function iterate(rules, count, burnIn, rand) {
	const points = [];
	let point = { x: 0, y: 0 };
	for (let i = 0; i < count; i++) {
		point = applyRule(pickRule(rules, rand()), point);
		if (i >= burnIn) {
			points.push(point);
		}
	}
	return points;
}
