import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import { EntityIndexManager } from '../core/entity-index';
import { Entity } from '../core/entity-extractor';

export const ENTITY_PANEL_VIEW_TYPE = 'smart-connection-entity-panel';

/**
 * Entity panel view showing related entities for the current note
 */
export class EntityPanelView extends ItemView {
	private currentFile: TFile | null = null;
	private indexManager: EntityIndexManager;
	
	constructor(leaf: WorkspaceLeaf, indexManager: EntityIndexManager) {
		super(leaf);
		this.indexManager = indexManager;
	}
	
	getViewType(): string {
		return ENTITY_PANEL_VIEW_TYPE;
	}
	
	getDisplayText(): string {
		return '概念实体';
	}
	
	getIcon(): string {
		return 'network';
	}
	
	async onOpen(): Promise<void> {
		this.renderPanel();
		
		// Register for file change events
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				this.updateCurrentFile();
			})
		);
		
		// Initial update
		this.updateCurrentFile();
	}
	
	async onClose(): Promise<void> {
		// Cleanup
	}
	
	/**
	 * Update the current file being displayed
	 */
	private updateCurrentFile(): void {
		const activeFile = this.app.workspace.getActiveFile();
		
		if (activeFile !== this.currentFile) {
			this.currentFile = activeFile;
			this.renderPanel();
		}
	}
	
	/**
	 * Render the panel
	 */
	private renderPanel(): void {
		const container = this.containerEl.children[1];
		container.empty();
		
		container.addClass('smart-connection-panel');
		
		if (!this.currentFile) {
			container.createEl('div', {
				text: '没有打开的笔记',
				cls: 'smart-connection-empty'
			});
			return;
		}
		
		// Get entities for current file
		const entities = this.indexManager.getEntitiesForFile(this.currentFile.path);
		
		if (entities.length === 0) {
			container.createEl('div', {
				text: '当前笔记中没有发现概念实体',
				cls: 'smart-connection-empty'
			});
			return;
		}
		
		// Header
		const header = container.createEl('div', { cls: 'smart-connection-header' });
		header.createEl('h4', { text: '发现的实体' });
		header.createEl('span', { 
			text: `${entities.length} 个`, 
			cls: 'smart-connection-count' 
		});
		
		// Entity list
		const listContainer = container.createEl('div', { cls: 'smart-connection-list' });
		
		for (const entity of entities) {
			this.renderEntity(listContainer, entity);
		}
	}
	
	/**
	 * Render a single entity
	 */
	private renderEntity(container: HTMLElement, entity: Entity): void {
		const entityEl = container.createEl('div', { cls: 'smart-connection-entity' });

		// Entity header with name and actions
		const headerEl = entityEl.createEl('div', { cls: 'smart-connection-entity-header' });

		// Entity name with click-to-copy functionality
		const nameEl = headerEl.createEl('div', { cls: 'smart-connection-entity-name' });
		const nameTextEl = nameEl.createEl('span', {
			text: entity.name,
			cls: 'smart-connection-entity-text'
		});

		// Add copy functionality
		nameTextEl.addEventListener('click', () => {
			navigator.clipboard.writeText(entity.name).then(() => {
				// Show temporary success indicator
				const originalText = nameTextEl.textContent;
				nameTextEl.textContent = '✓ 已复制';
				setTimeout(() => {
					nameTextEl.textContent = originalText;
				}, 1000);
			});
		});

		// Stats section
		const statsEl = headerEl.createEl('div', { cls: 'smart-connection-entity-stats' });

		// Occurrence count with icon
		const occurrenceEl = statsEl.createEl('span', {
			cls: 'smart-connection-entity-occurrence'
		});
		occurrenceEl.createEl('span', { text: '📝' });
		occurrenceEl.createEl('span', { text: `${entity.occurrences.length}` });

		// File count with icon
		const filesEl = statsEl.createEl('span', {
			cls: 'smart-connection-entity-files'
		});
		filesEl.createEl('span', { text: '📁' });
		filesEl.createEl('span', { text: `${entity.relatedFiles.size}` });

		// Get connections
		const connections = this.indexManager.getConnectionsForEntity(entity.normalizedName);

		if (connections.length > 0) {
			// Connections section with strength visualization
			const connectionsEl = entityEl.createEl('div', {
				cls: 'smart-connection-connections'
			});

			const connectionsHeader = connectionsEl.createEl('div', {
				cls: 'smart-connection-connections-header'
			});
			connectionsHeader.createEl('span', {
				text: '相关实体',
				cls: 'smart-connection-connections-label'
			});
			connectionsHeader.createEl('span', {
				text: `${connections.length} 个`,
				cls: 'smart-connection-connections-count'
			});

			const connectionsList = connectionsEl.createEl('div', {
				cls: 'smart-connection-connections-list'
			});

			// Show top 5 connections
			const topConnections = connections.slice(0, 5);

			for (const connection of topConnections) {
				const relatedEntityName = connection.entity1 === entity.normalizedName
					? connection.entity2
					: connection.entity1;

				const relatedEntity = this.indexManager.getEntity(relatedEntityName);

				if (relatedEntity) {
					const connEl = connectionsList.createEl('div', {
						cls: 'smart-connection-connection-item'
					});

					// Strength indicator
					const strengthBar = connEl.createEl('div', {
						cls: 'smart-connection-strength-bar'
					});
					const strengthFill = strengthBar.createEl('div', {
						cls: 'smart-connection-strength-fill'
					});
					strengthFill.style.width = `${Math.round(connection.strength * 100)}%`;

					const linkEl = connEl.createEl('a', {
						text: relatedEntity.name,
						cls: 'smart-connection-connection-link'
					});

					linkEl.addEventListener('click', (e) => {
						e.preventDefault();
						this.navigateToEntity(relatedEntity);
					});

					connEl.createEl('span', {
						text: `${Math.round(connection.strength * 100)}%`,
						cls: 'smart-connection-connection-strength'
					});
				}
			}

			if (connections.length > 5) {
				const moreEl = connectionsList.createEl('div', {
					cls: 'smart-connection-more'
				});
				moreEl.createEl('span', { text: '⋯' });
				moreEl.createEl('span', { text: `还有 ${connections.length - 5} 个相关实体` });
			}
		}
	}
	
	/**
	 * Navigate to the file containing an entity
	 */
	private async navigateToEntity(entity: Entity): Promise<void> {
		// Find the first file containing this entity (excluding current file)
		const targetFilePath = Array.from(entity.relatedFiles)
			.find(f => f !== this.currentFile?.path);
		
		if (!targetFilePath) {
			return;
		}
		
		const file = this.app.vault.getAbstractFileByPath(targetFilePath);
		
		if (file instanceof TFile) {
			await this.app.workspace.getLeaf().openFile(file);
		}
	}
	
	/**
	 * Refresh the panel
	 */
	refresh(): void {
		this.renderPanel();
	}
}

