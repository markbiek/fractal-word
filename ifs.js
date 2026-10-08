export const LETTER_WIDTH = 3;
export const LETTER_HEIGHT = 5;
export const LETTER_GAP = 1;

// An axis stroke is a rectangle { x, y, w, h }. A diagonal stroke is a
// centerline { from: [x, y], to: [x, y], thickness }, and the word reads from
// `from` to `to`.
//
// No two axis strokes of a letter cover the same cell. Overlapping strokes stack
// two copies of the word in one place and blend their colors. The cost is
// that P and A need a 1x1 crossbar, which holds only a squashed copy.
export const LETTERS = {
	S: [
		{ x: 0, y: 4, w: 3, h: 1 },
		{ x: 0, y: 2, w: 1, h: 2 },
		{ x: 1, y: 2, w: 2, h: 1 },
		{ x: 2, y: 0, w: 1, h: 2 },
		{ x: 0, y: 0, w: 2, h: 1 },
	],
	P: [
		{ x: 0, y: 0, w: 1, h: 5 },
		{ x: 1, y: 4, w: 2, h: 1 },
		{ x: 2, y: 2, w: 1, h: 2 },
		{ x: 1, y: 2, w: 1, h: 1 },
	],
	A: [
		{ x: 0, y: 4, w: 3, h: 1 },
		{ x: 0, y: 0, w: 1, h: 4 },
		{ x: 2, y: 0, w: 1, h: 4 },
		{ x: 1, y: 2, w: 1, h: 1 },
	],
	M: [
		{ x: 0, y: 0, w: 1, h: 5 },
		{ from: [1.5, 4.5], to: [2.5, 1.5], thickness: 1 },
		{ from: [2.5, 1.5], to: [3.5, 4.5], thickness: 1 },
		{ x: 4, y: 0, w: 1, h: 5 },
	],
};

// M needs room for the V between its posts.
const LETTER_WIDTHS = { M: 5 };

export function letterWidth(letter) {
	return LETTER_WIDTHS[letter] ?? LETTER_WIDTH;
}

export function wordSize(word) {
	const lettersWidth = [...word].reduce((sum, letter) => sum + letterWidth(letter), 0);
	return {
		width: lettersWidth + (word.length - 1) * LETTER_GAP,
		height: LETTER_HEIGHT,
	};
}

function isDiagonal(stroke) {
	return 'from' in stroke;
}

function shiftStroke(stroke, offset) {
	if (isDiagonal(stroke)) {
		return {
			...stroke,
			from: [stroke.from[0] + offset, stroke.from[1]],
			to: [stroke.to[0] + offset, stroke.to[1]],
		};
	}
	return { ...stroke, x: stroke.x + offset };
}

function strokeArea(stroke) {
	if (isDiagonal(stroke)) {
		const length = Math.hypot(stroke.to[0] - stroke.from[0], stroke.to[1] - stroke.from[1]);
		return length * stroke.thickness;
	}
	return stroke.w * stroke.h;
}

function strokesForWord(word) {
	const strokes = [];
	let offset = 0;
	[...word].forEach((letter, index) => {
		const letterStrokes = LETTERS[letter];
		if (!letterStrokes) {
			throw new Error(`No stroke data for letter "${letter}"`);
		}
		for (const stroke of letterStrokes) {
			strokes.push({ ...shiftStroke(stroke, offset), letter: index });
		}
		offset += letterWidth(letter) + LETTER_GAP;
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

// The word's baseline runs along the centerline, and the word's up direction
// points to the left of travel. The middle line of the word lands on the
// centerline, so the word fills half the thickness on each side.
function diagonalRule(stroke, width, height) {
	const [fromX, fromY] = stroke.from;
	const length = Math.hypot(stroke.to[0] - fromX, stroke.to[1] - fromY);
	const alongX = (stroke.to[0] - fromX) / length;
	const alongY = (stroke.to[1] - fromY) / length;
	const upX = -alongY;
	const upY = alongX;
	return {
		a: (alongX * length) / width,
		b: (upX * stroke.thickness) / height,
		c: (alongY * length) / width,
		d: (upY * stroke.thickness) / height,
		e: fromX - (upX * stroke.thickness) / 2,
		f: fromY - (upY * stroke.thickness) / 2,
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

function ruleForStroke(stroke, width, height) {
	if (isDiagonal(stroke)) {
		return diagonalRule(stroke, width, height);
	}
	if (stroke.h > stroke.w) {
		return verticalRule(stroke, width, height);
	}
	return horizontalRule(stroke, width, height);
}

export function buildRules(word) {
	const { width, height } = wordSize(word);
	const strokes = strokesForWord(word);
	const totalArea = strokes.reduce((sum, stroke) => sum + strokeArea(stroke), 0);

	return strokes.map((stroke) => {
		const rule = ruleForStroke(stroke, width, height);
		rule.p = strokeArea(stroke) / totalArea;
		rule.stroke = stroke;
		rule.letter = stroke.letter;

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

// The last rule applied picks the big stroke a point sits in. The rule
// before it picks the stroke of the small word inside that stroke, so its
// letter tells the page which small letter the point belongs to.
// The first points have not reached the fractal yet, so burnIn skips them.
export function iterate(rules, count, burnIn, rand, visit) {
	let point = { x: 0, y: 0 };
	let lastRule = rules[0];
	for (let i = 0; i < count; i++) {
		const previousRule = lastRule;
		lastRule = pickRule(rules, rand());
		point = applyRule(lastRule, point);
		if (i >= burnIn) {
			visit(point.x, point.y, previousRule.letter);
		}
	}
}
