// Past eight letters, the copies inside each stroke get too small to read on
// a desktop screen.
export const MIN_WORD_LENGTH = 1;
export const MAX_WORD_LENGTH = 8;

export function normalizeWord(input) {
	return input
		.toUpperCase()
		.replace(/[^A-Z]/g, '')
		.slice(0, MAX_WORD_LENGTH);
}
