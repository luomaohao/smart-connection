export interface SmartConnectionSettings {
	// Entity extraction settings
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
	enableAutoExtraction: true,
	minEntityLength: 2,
	maxEntityLength: 50,
	entityPatterns: [
		// Capitalized words (e.g., "Machine Learning", "JavaScript")
		'\\b[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*\\b',
		// Acronyms (e.g., "API", "HTTP")
		'\\b[A-Z]{2,}\\b',
		// CamelCase (e.g., "TypeScript", "GraphQL")
		'\\b[A-Z][a-z]+[A-Z][a-z]+(?:[A-Z][a-z]+)*\\b',
	],
	excludePatterns: [
		// Common words to exclude
		'\\b(The|This|That|These|Those|I|You|He|She|It|We|They)\\b',
		// Days and months
		'\\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\\b',
		'\\b(January|February|March|April|May|June|July|August|September|October|November|December)\\b',
	],
	
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

