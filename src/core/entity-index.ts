import { App, TFile, Vault } from 'obsidian';
import { Entity, EntityExtractor } from './entity-extractor';
import { SmartConnectionSettings } from '../settings';
import { calculateSimilarity, jaccardSimilarity } from '../utils/text-utils';

/**
 * Represents a connection between two entities
 */
export interface EntityConnection {
	entity1: string;
	entity2: string;
	strength: number;
	sharedFiles: Set<string>;
	reason: string;
}

/**
 * Manages the global entity index across all notes
 */
export class EntityIndexManager {
	private entityIndex: Map<string, Entity> = new Map();
	private fileEntityMap: Map<string, Set<string>> = new Map();
	private connections: Map<string, EntityConnection[]> = new Map();
	private extractor: EntityExtractor;
	private updateDebounceTimer: number | null = null;
	
	constructor(
		private app: App,
		private settings: SmartConnectionSettings
	) {
		this.extractor = new EntityExtractor(settings);
	}
	
	/**
	 * Build the entire entity index from all markdown files
	 */
	async buildIndex(): Promise<void> {
		this.entityIndex.clear();
		this.fileEntityMap.clear();
		this.connections.clear();
		
		const files = this.app.vault.getMarkdownFiles();
		
		for (const file of files) {
			await this.indexFile(file);
		}
		
		// Calculate connections after indexing all files
		this.calculateConnections();
	}
	
	/**
	 * Index a single file
	 */
	async indexFile(file: TFile): Promise<void> {
		const content = await this.app.vault.read(file);
		const entities = this.extractor.extractFromContent(content, file);
		
		// Update file entity map
		const entityNames = new Set<string>();
		
		for (const [normalizedName, entity] of entities) {
			entityNames.add(normalizedName);
			
			if (this.entityIndex.has(normalizedName)) {
				// Merge with existing entity
				const existing = this.entityIndex.get(normalizedName)!;
				existing.occurrences.push(...entity.occurrences);
				entity.relatedFiles.forEach(f => existing.relatedFiles.add(f));
			} else {
				// Add new entity
				this.entityIndex.set(normalizedName, entity);
			}
		}
		
		this.fileEntityMap.set(file.path, entityNames);
	}
	
	/**
	 * Remove a file from the index
	 */
	removeFile(filePath: string): void {
		const entityNames = this.fileEntityMap.get(filePath);
		
		if (!entityNames) {
			return;
		}
		
		// Remove file from each entity's related files
		for (const entityName of entityNames) {
			const entity = this.entityIndex.get(entityName);
			if (entity) {
				entity.relatedFiles.delete(filePath);
				entity.occurrences = entity.occurrences.filter(occ => occ.file !== filePath);
				
				// Remove entity if it has no more occurrences
				if (entity.occurrences.length === 0) {
					this.entityIndex.delete(entityName);
				}
			}
		}
		
		this.fileEntityMap.delete(filePath);
		
		// Recalculate connections
		this.debouncedUpdateConnections();
	}
	
	/**
	 * Update index when a file changes
	 */
	async updateFile(file: TFile): Promise<void> {
		// Remove old data
		this.removeFile(file.path);
		
		// Re-index file
		await this.indexFile(file);
		
		// Recalculate connections
		this.debouncedUpdateConnections();
	}
	
	/**
	 * Calculate connections between entities
	 */
	private calculateConnections(): void {
		this.connections.clear();
		
		const entities = Array.from(this.entityIndex.values());
		
		for (let i = 0; i < entities.length; i++) {
			for (let j = i + 1; j < entities.length; j++) {
				const entity1 = entities[i];
				const entity2 = entities[j];
				
				const connection = this.calculateConnection(entity1, entity2);
				
				if (connection && connection.strength >= this.settings.minSimilarityThreshold) {
					if (!this.connections.has(entity1.normalizedName)) {
						this.connections.set(entity1.normalizedName, []);
					}
					if (!this.connections.has(entity2.normalizedName)) {
						this.connections.set(entity2.normalizedName, []);
					}
					
					this.connections.get(entity1.normalizedName)!.push(connection);
					this.connections.get(entity2.normalizedName)!.push(connection);
				}
			}
		}
		
		// Sort connections by strength
		for (const [_, conns] of this.connections) {
			conns.sort((a, b) => b.strength - a.strength);
		}
	}
	
	/**
	 * Calculate connection strength between two entities
	 */
	private calculateConnection(entity1: Entity, entity2: Entity): EntityConnection | null {
		const sharedFiles = new Set(
			[...entity1.relatedFiles].filter(f => entity2.relatedFiles.has(f))
		);
		
		if (sharedFiles.size === 0) {
			return null;
		}
		
		// Calculate Jaccard similarity based on shared files
		const jaccardScore = jaccardSimilarity(entity1.relatedFiles, entity2.relatedFiles);
		
		// Calculate co-occurrence strength
		const cooccurrenceScore = sharedFiles.size / Math.max(entity1.relatedFiles.size, entity2.relatedFiles.size);
		
		// Combined strength score
		const strength = (jaccardScore * 0.4) + (cooccurrenceScore * 0.6);
		
		let reason = `共现于 ${sharedFiles.size} 个笔记`;
		
		return {
			entity1: entity1.normalizedName,
			entity2: entity2.normalizedName,
			strength,
			sharedFiles,
			reason,
		};
	}
	
	/**
	 * Debounced connection update
	 */
	private debouncedUpdateConnections(): void {
		if (this.updateDebounceTimer !== null) {
			window.clearTimeout(this.updateDebounceTimer);
		}
		
		this.updateDebounceTimer = window.setTimeout(() => {
			this.calculateConnections();
			this.updateDebounceTimer = null;
		}, this.settings.indexUpdateDebounceMs);
	}
	
	/**
	 * Get entities for a specific file
	 */
	getEntitiesForFile(filePath: string): Entity[] {
		const entityNames = this.fileEntityMap.get(filePath);
		
		if (!entityNames) {
			return [];
		}
		
		return Array.from(entityNames)
			.map(name => this.entityIndex.get(name))
			.filter((entity): entity is Entity => entity !== undefined);
	}
	
	/**
	 * Get connections for a specific entity
	 */
	getConnectionsForEntity(entityName: string): EntityConnection[] {
		return this.connections.get(entityName.toLowerCase()) || [];
	}
	
	/**
	 * Get all entities
	 */
	getAllEntities(): Entity[] {
		return Array.from(this.entityIndex.values());
	}
	
	/**
	 * Get entity by name
	 */
	getEntity(name: string): Entity | undefined {
		return this.entityIndex.get(name.toLowerCase());
	}
	
	/**
	 * Update settings
	 */
	updateSettings(settings: SmartConnectionSettings): void {
		this.settings = settings;
		this.extractor.updateSettings(settings);
	}
}

