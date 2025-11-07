import { TFile } from 'obsidian';
import { SmartConnectionSettings } from '../settings';
import { extractEntitiesWithPatterns } from '../utils/text-utils';

/**
 * Represents an extracted entity
 */
export interface Entity {
	name: string;
	normalizedName: string;
	occurrences: EntityOccurrence[];
	relatedFiles: Set<string>;
}

/**
 * Represents a single occurrence of an entity
 */
export interface EntityOccurrence {
	file: string;
	position: number;
	context: string;
}

/**
 * Extracts and manages entities from note content
 */
export class EntityExtractor {
	constructor(private settings: SmartConnectionSettings) {}
	
	/**
	 * Extract entities from file content
	 */
	extractFromContent(content: string, file: TFile): Map<string, Entity> {
		const entities = new Map<string, Entity>();
		
		if (!this.settings.enableAutoExtraction) {
			return entities;
		}
		
		// Extract using configured patterns
		const extractedEntities = extractEntitiesWithPatterns(
			content,
			this.settings.entityPatterns,
			this.settings.excludePatterns,
			this.settings.minEntityLength,
			this.settings.maxEntityLength
		);
		
		// Create entity objects with occurrence information
		for (const entityName of extractedEntities) {
			const normalizedName = entityName.toLowerCase().trim();
			
			if (!entities.has(normalizedName)) {
				entities.set(normalizedName, {
					name: entityName,
					normalizedName,
					occurrences: [],
					relatedFiles: new Set([file.path]),
				});
			}
			
			const entity = entities.get(normalizedName)!;
			
			// Find all occurrences in content
			const occurrences = this.findOccurrences(content, entityName, file.path);
			entity.occurrences.push(...occurrences);
			entity.relatedFiles.add(file.path);
		}
		
		return entities;
	}
	
	/**
	 * Find all occurrences of an entity in content
	 */
	private findOccurrences(content: string, entityName: string, filePath: string): EntityOccurrence[] {
		const occurrences: EntityOccurrence[] = [];
		const regex = new RegExp(this.escapeRegex(entityName), 'g');
		let match;
		
		while ((match = regex.exec(content)) !== null) {
			const position = match.index;
			const contextStart = Math.max(0, position - 50);
			const contextEnd = Math.min(content.length, position + entityName.length + 50);
			const context = content.substring(contextStart, contextEnd);
			
			occurrences.push({
				file: filePath,
				position,
				context,
			});
		}
		
		return occurrences;
	}
	
	/**
	 * Escape special regex characters
	 */
	private escapeRegex(str: string): string {
		return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}
	
	/**
	 * Update settings
	 */
	updateSettings(settings: SmartConnectionSettings): void {
		this.settings = settings;
	}
}

