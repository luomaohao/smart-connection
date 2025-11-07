import { App, TFile, Editor, MarkdownView } from 'obsidian';
import { EntityIndexManager, EntityConnection } from './entity-index';
import { Entity } from './entity-extractor';
import { SmartConnectionSettings } from '../settings';

/**
 * Represents a link suggestion
 */
export interface LinkSuggestion {
	entity: Entity;
	targetFile: string;
	reason: string;
	strength: number;
}

/**
 * Manages entity linking operations
 */
export class EntityLinker {
	constructor(
		private app: App,
		private indexManager: EntityIndexManager,
		private settings: SmartConnectionSettings
	) {}
	
	/**
	 * Get link suggestions for the current file
	 */
	async getSuggestionsForFile(file: TFile): Promise<LinkSuggestion[]> {
		const suggestions: LinkSuggestion[] = [];
		const entities = this.indexManager.getEntitiesForFile(file.path);
		
		for (const entity of entities) {
			const connections = this.indexManager.getConnectionsForEntity(entity.normalizedName);
			
			for (const connection of connections) {
				const relatedEntityName = connection.entity1 === entity.normalizedName 
					? connection.entity2 
					: connection.entity1;
				
				const relatedEntity = this.indexManager.getEntity(relatedEntityName);
				
				if (!relatedEntity) {
					continue;
				}
				
				// Find the most relevant file for this entity
				const targetFiles = Array.from(relatedEntity.relatedFiles)
					.filter(f => f !== file.path);
				
				for (const targetFile of targetFiles) {
					// Check if target file exists (if setting enabled)
					if (this.settings.linkOnlyExistingNotes) {
						const fileExists = this.app.vault.getAbstractFileByPath(targetFile);
						if (!fileExists) {
							continue;
						}
					}
					
					suggestions.push({
						entity: relatedEntity,
						targetFile,
						reason: connection.reason,
						strength: connection.strength,
					});
				}
			}
		}
		
		// Sort by strength and limit
		suggestions.sort((a, b) => b.strength - a.strength);
		
		return suggestions.slice(0, this.settings.maxSuggestionsPerNote);
	}
	
	/**
	 * Automatically insert links for entities in the editor
	 */
	async autoLinkInEditor(editor: Editor, file: TFile): Promise<number> {
		if (!this.settings.enableAutoLinking) {
			return 0;
		}
		
		const content = editor.getValue();
		const entities = this.indexManager.getEntitiesForFile(file.path);
		let linksAdded = 0;
		
		// Track already linked entities to avoid duplicate linking
		const linkedEntities = new Set<string>();
		
		// Find existing links in content
		const linkRegex = /\[\[([^\]]+)\]\]/g;
		let match;
		while ((match = linkRegex.exec(content)) !== null) {
			linkedEntities.add(match[1].toLowerCase());
		}
		
		for (const entity of entities) {
			if (linkedEntities.has(entity.normalizedName)) {
				continue;
			}
			
			// Find the best target file for this entity
			const bestTarget = this.findBestTargetFile(entity, file.path);
			
			if (bestTarget) {
				// Link only the first occurrence
				const linked = this.linkFirstOccurrence(editor, entity.name, bestTarget);
				if (linked) {
					linksAdded++;
					linkedEntities.add(entity.normalizedName);
				}
			}
		}
		
		return linksAdded;
	}
	
	/**
	 * Find the best target file for an entity
	 */
	private findBestTargetFile(entity: Entity, currentFilePath: string): string | null {
		// First, check if there's a file with the same name as the entity
		const entityFileName = entity.name.replace(/\s+/g, '-') + '.md';
		const exactMatch = this.app.vault.getAbstractFileByPath(entityFileName);
		
		if (exactMatch && exactMatch.path !== currentFilePath) {
			return entityFileName;
		}
		
		// Otherwise, find the file with the most occurrences of this entity
		const files = Array.from(entity.relatedFiles)
			.filter(f => f !== currentFilePath);
		
		if (files.length === 0) {
			return null;
		}
		
		// Count occurrences per file
		const occurrenceCounts = new Map<string, number>();
		
		for (const occurrence of entity.occurrences) {
			if (occurrence.file !== currentFilePath) {
				occurrenceCounts.set(
					occurrence.file,
					(occurrenceCounts.get(occurrence.file) || 0) + 1
				);
			}
		}
		
		// Find file with most occurrences
		let bestFile = files[0];
		let maxCount = occurrenceCounts.get(bestFile) || 0;
		
		for (const file of files) {
			const count = occurrenceCounts.get(file) || 0;
			if (count > maxCount) {
				maxCount = count;
				bestFile = file;
			}
		}
		
		return bestFile;
	}
	
	/**
	 * Link the first occurrence of an entity in the editor
	 */
	private linkFirstOccurrence(editor: Editor, entityName: string, targetFile: string): boolean {
		const content = editor.getValue();
		
		// Find first occurrence that's not already linked
		const regex = new RegExp(`(?<!\\[\\[)\\b${this.escapeRegex(entityName)}\\b(?!\\]\\])`, 'i');
		const match = regex.exec(content);
		
		if (!match) {
			return false;
		}
		
		const start = match.index;
		const end = start + entityName.length;
		
		// Get the target file name without extension for the link
		const targetName = targetFile.replace(/\.md$/, '');
		const link = `[[${targetName}|${entityName}]]`;
		
		// Replace the text
		const before = content.substring(0, start);
		const after = content.substring(end);
		const newContent = before + link + after;
		
		editor.setValue(newContent);
		
		return true;
	}
	
	/**
	 * Manually link a specific entity occurrence
	 */
	linkEntity(editor: Editor, entityName: string, targetFile: string, position: number): void {
		const content = editor.getValue();
		const start = position;
		const end = start + entityName.length;
		
		// Get the target file name without extension for the link
		const targetName = targetFile.replace(/\.md$/, '');
		const link = `[[${targetName}|${entityName}]]`;
		
		// Replace the text
		const before = content.substring(0, start);
		const after = content.substring(end);
		const newContent = before + link + after;
		
		editor.setValue(newContent);
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

