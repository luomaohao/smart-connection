import { TFile } from 'obsidian';
import { SmartConnectionSettings, getPatternsForMode, getExcludePatternsForMode } from '../settings';
import { extractEntitiesWithPatterns } from '../utils/text-utils';


export interface Entity {
	name: string;
	normalizedName: string;
	occurrences: EntityOccurrence[];
	relatedFiles: Set<string>;
}

export interface EntityOccurrence {
	file: string;
	position: number;
	context: string;
}

export class EntityExtractor {
	constructor(private settings: SmartConnectionSettings) {}

	extractFromContent(content: string, file: TFile): Map<string, Entity> {
		const entities = new Map<string, Entity>();

		if (!this.settings.enableAutoExtraction) {
			return entities;
		}

		const patterns = getPatternsForMode(this.settings.languageMode);
		const excludePatterns = getExcludePatternsForMode(this.settings.languageMode);

		const extractedEntities = extractEntitiesWithPatterns(
			content,
			patterns,
			excludePatterns,
			this.settings.minEntityLength,
			this.settings.maxEntityLength
		);

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

			const occurrences = this.findOccurrences(content, entityName, file.path);
			entity.occurrences.push(...occurrences);
			entity.relatedFiles.add(file.path);
		}

		return entities;
	}

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

	private escapeRegex(str: string): string {
		return str.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
	}

	updateSettings(settings: SmartConnectionSettings): void {
		this.settings = settings;
	}
}
