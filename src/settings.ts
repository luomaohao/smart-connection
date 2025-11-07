export type LanguageMode = 'mixed' | 'chinese_only' | 'english_only';

export interface SmartConnectionSettings {
	// Entity extraction settings
	languageMode: LanguageMode;
	enableAutoExtraction: boolean;
	minEntityLength: number;
	maxEntityLength: number;
	entityPatterns: string[];
	excludePatterns: string[];

	// Linking settings
	enableAutoLinking: boolean;
	minSimilarityThreshold: number;
	maxSuggestionsPerNote: number;
	linkOnlyExistingNotes: boolean;

	// Display settings
	showEntityPanel: boolean;
	highlightEntities: boolean;

	// Advanced settings
	indexUpdateDebounceMs: number;
	cacheEnabled: boolean;
}

export const DEFAULT_SETTINGS: SmartConnectionSettings = {
	// Entity extraction settings
	languageMode: 'mixed',
	enableAutoExtraction: true,
	minEntityLength: 2,
	maxEntityLength: 50,
	entityPatterns: [], // Will be dynamically set based on languageMode
	excludePatterns: [], // Will be dynamically set based on languageMode

	// Linking settings
	enableAutoLinking: false, // Disabled by default for safety
	minSimilarityThreshold: 0.3,
	maxSuggestionsPerNote: 10,
	linkOnlyExistingNotes: true,

	// Display settings
	showEntityPanel: true,
	highlightEntities: false,

	// Advanced settings
	indexUpdateDebounceMs: 1000,
	cacheEnabled: true,
};

// Define patterns for each language mode
export const getPatternsForMode = (mode: LanguageMode): string[] => {
	switch (mode) {
		case 'chinese_only':
			return [
				'[\\u4e00-\\u9fff]{2,10}', // Chinese words
				'《[\\u4e00-\\u9fff\\w\\s]+》', // Quoted nouns
			];
		case 'english_only':
			return [
				'\\b[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*\\b', // Capitalized words
				'\\b[A-Z]{2,}\\b', // Acronyms
				'\\b[A-Z][a-z]+[A-Z][a-z]+(?:[A-Z][a-z]+)*\\b', // CamelCase
			];
		case 'mixed':
		default:
			return [
				'\\b[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*\\b',
				'\\b[A-Z]{2,}\\b',
				'\\b[A-Z][a-z]+[A-Z][a-z]+(?:[A-Z][a-z]+)*\\b',
				'[\\u4e00-\\u9fff]{2,10}',
				'《[\\u4e00-\\u9fff\\w\\s]+》',
				'[\\u4e00-\\u9fff]*[A-Z]{2,}[\\u4e00-\\u9fff]*',
			];
	}
};

export const getExcludePatternsForMode = (mode: LanguageMode): string[] => {
	const chineseExclusions = [
		'[\\u4e00-\\u9fff]*(的|是|在|了|和|与|或|一个|一些|这个|那个|这些|那些|我|你|他|她|它|我们|你们|他们|它们)[\\u4e00-\\u9fff]*',
		'[\\u4e00-\\u9fff]*(今天|明天|昨天|现在|以后|以前|刚刚)[\\u4e00-\\u9fff]*',
		'[\\u4e00-\\u9fff]*(但是|然而|因为|所以|如果|那么|然后)[\\u4e00-\\u9fff]*',
		'[\\u4e00-\\u9fff]*(非常|特别|十分|极其|相当|比较)[\\u4e00-\\u9fff]*',
	];

	const englishExclusions = [
		'\\b(The|This|That|These|Those|I|You|He|She|It|We|They)\\b',
		'\\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\\b',
		'\\b(January|February|March|April|May|June|July|August|September|October|November|December)\\b',
	];

	switch (mode) {
		case 'chinese_only':
			return chineseExclusions;
		case 'english_only':
			return englishExclusions;
		case 'mixed':
		default:
			return [...englishExclusions, ...chineseExclusions];
	}
};