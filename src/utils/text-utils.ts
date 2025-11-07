/**
 * Text processing utilities for entity extraction and analysis
 */

/**
 * Calculate cosine similarity between two texts
 */
export function calculateSimilarity(text1: string, text2: string): number {
	const words1 = tokenize(text1);
	const words2 = tokenize(text2);
	
	if (words1.length === 0 || words2.length === 0) {
		return 0;
	}
	
	const vector1 = createTfIdfVector(words1);
	const vector2 = createTfIdfVector(words2);
	
	return cosineSimilarity(vector1, vector2);
}

/**
 * Tokenize text into words (Chinese only)
 */
export function tokenize(text: string, mode: 'mixed' | 'chinese_only' | 'english_only' = 'mixed'): string[] {
	const normalized = text.toLowerCase();
	let tokens: string[] = [];

	switch (mode) {
		case 'chinese_only':
			// Extract Chinese characters only and split them individually
			tokens = (normalized.match(/[\u4e00-\u9fff]/g) || []);
			break;
		case 'english_only':
			// Standard English tokenization
			tokens = normalized.replace(/[^\w\s]/g, ' ').split(/\s+/);
			break;
		case 'mixed':
		default:
			// Combined tokenization
			tokens = normalized
				.replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
				.split(/(\s+|(?=[\u4e00-\u9fff])|(?<=[\u4e00-\u9fff]))/);
			break;
	}

	return tokens.map(t => t.trim()).filter(t => t.length > 0);
}

/**
 * Create TF-IDF vector from words
 */
function createTfIdfVector(words: string[]): Map<string, number> {
	const vector = new Map<string, number>();
	const total = words.length;
	
	for (const word of words) {
		vector.set(word, (vector.get(word) || 0) + 1 / total);
	}
	
	return vector;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(v1: Map<string, number>, v2: Map<string, number>): number {
	let dotProduct = 0;
	let magnitude1 = 0;
	let magnitude2 = 0;
	
	const allKeys = new Set([...v1.keys(), ...v2.keys()]);
	
	for (const key of allKeys) {
		const val1 = v1.get(key) || 0;
		const val2 = v2.get(key) || 0;
		
		dotProduct += val1 * val2;
		magnitude1 += val1 * val1;
		magnitude2 += val2 * val2;
	}
	
	if (magnitude1 === 0 || magnitude2 === 0) {
		return 0;
	}
	
	return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
}

/**
 * Extract entities from text using regex patterns
 */
export function extractEntitiesWithPatterns(
	text: string,
	patterns: string[],
	excludePatterns: string[],
	minLength: number,
	maxLength: number
): Set<string> {
	const entities = new Set<string>();
	
	// Apply extraction patterns
	for (const patternStr of patterns) {
		try {
			const regex = new RegExp(patternStr, 'g');
			const matches = text.match(regex);
			
			if (matches) {
				for (const match of matches) {
					const trimmed = match.trim();
					if (trimmed.length >= minLength && trimmed.length <= maxLength) {
						entities.add(trimmed);
					}
				}
			}
		} catch (e) {
			console.error(`Invalid regex pattern: ${patternStr}`, e);
		}
	}
	
	// Apply exclusion patterns
	for (const patternStr of excludePatterns) {
		try {
			const regex = new RegExp(patternStr, 'gi');
			for (const entity of entities) {
				if (regex.test(entity)) {
					entities.delete(entity);
				}
			}
		} catch (e) {
			console.error(`Invalid exclusion pattern: ${patternStr}`, e);
		}
	}
	
	return entities;
}

/**
 * Calculate Jaccard similarity between two sets
 */
export function jaccardSimilarity<T>(set1: Set<T>, set2: Set<T>): number {
	const intersection = new Set([...set1].filter(x => set2.has(x)));
	const union = new Set([...set1, ...set2]);
	
	if (union.size === 0) {
		return 0;
	}
	
	return intersection.size / union.size;
}

/**
 * Normalize entity name for comparison
 */
export function normalizeEntity(entity: string): string {
	return entity.toLowerCase().trim();
}

