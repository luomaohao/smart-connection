import { Plugin, Notice, MarkdownView, TFile } from 'obsidian';
import { SmartConnectionSettings, DEFAULT_SETTINGS } from './settings';
import { EntityIndexManager } from './core/entity-index';
import { EntityLinker, LinkSuggestion } from './core/entity-linker';
import { EntityPanelView, ENTITY_PANEL_VIEW_TYPE } from './ui/entity-panel';
import { SmartConnectionSettingTab } from './ui/settings-tab';

export default class SmartConnectionPlugin extends Plugin {
	settings: SmartConnectionSettings;
	indexManager: EntityIndexManager;
	entityLinker: EntityLinker;
	
	async onload() {
		await this.loadSettings();
		
		// Initialize core components
		this.indexManager = new EntityIndexManager(this.app, this.settings);
		this.entityLinker = new EntityLinker(this.app, this.indexManager, this.settings);
		
		// Register entity panel view
		this.registerView(
			ENTITY_PANEL_VIEW_TYPE,
			(leaf) => new EntityPanelView(leaf, this.indexManager)
		);
		
		// Add ribbon icon
		this.addRibbonIcon('network', '智能概念关联', async () => {
			await this.activateEntityPanel();
		});
		
		// Add commands
		this.addCommand({
			id: 'rebuild-entity-index',
			name: '重建实体索引',
			callback: async () => {
				await this.rebuildIndex();
			}
		});
		
		this.addCommand({
			id: 'show-entity-panel',
			name: '显示实体面板',
			callback: async () => {
				await this.activateEntityPanel();
			}
		});
		
		this.addCommand({
			id: 'show-link-suggestions',
			name: '显示链接建议',
			editorCallback: async (editor, view) => {
				const file = view.file;
				if (!file) {
					new Notice('没有打开的文件');
					return;
				}
				
				await this.showLinkSuggestions(file);
			}
		});
		
		this.addCommand({
			id: 'auto-link-entities',
			name: '自动链接实体',
			editorCallback: async (editor, view) => {
				const file = view.file;
				if (!file) {
					new Notice('没有打开的文件');
					return;
				}
				
				const linksAdded = await this.entityLinker.autoLinkInEditor(editor, file);
				new Notice(`已添加 ${linksAdded} 个链接`);
				
				// Update index after linking
				await this.indexManager.updateFile(file);
			}
		});
		
		this.addCommand({
			id: 'show-entity-stats',
			name: '显示实体统计',
			callback: () => {
				this.showEntityStats();
			}
		});
		
		// Add settings tab
		this.addSettingTab(new SmartConnectionSettingTab(this.app, this));
		
		// Register event handlers
		this.registerEvent(
			this.app.vault.on('create', async (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					await this.indexManager.indexFile(file);
				}
			})
		);
		
		this.registerEvent(
			this.app.vault.on('modify', async (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					await this.indexManager.updateFile(file);
				}
			})
		);
		
		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					this.indexManager.removeFile(file.path);
				}
			})
		);
		
		this.registerEvent(
			this.app.vault.on('rename', async (file, oldPath) => {
				if (file instanceof TFile && file.extension === 'md') {
					this.indexManager.removeFile(oldPath);
					await this.indexManager.indexFile(file);
				}
			})
		);
		
		// Build initial index
		new Notice('正在构建实体索引...');
		await this.indexManager.buildIndex();
		new Notice('实体索引构建完成！');
		
		// Show entity panel if enabled
		if (this.settings.showEntityPanel) {
			await this.activateEntityPanel();
		}
	}
	
	onunload() {
		// Cleanup
		this.deactivateEntityPanel();
	}
	
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	
	async saveSettings() {
		await this.saveData(this.settings);
		
		// Update components with new settings
		if (this.indexManager) {
			this.indexManager.updateSettings(this.settings);
		}
		if (this.entityLinker) {
			this.entityLinker.updateSettings(this.settings);
		}
	}
	
	/**
	 * Rebuild the entire entity index
	 */
	async rebuildIndex(): Promise<void> {
		new Notice('正在重建实体索引...');
		
		try {
			await this.indexManager.buildIndex();
			new Notice('实体索引重建完成！');
			
			// Refresh entity panel if open
			this.refreshEntityPanel();
		} catch (e) {
			console.error('Failed to rebuild index:', e);
			new Notice('索引重建失败，请查看控制台');
		}
	}
	
	/**
	 * Activate the entity panel
	 */
	async activateEntityPanel(): Promise<void> {
		const { workspace } = this.app;
		
		let leaf = workspace.getLeavesOfType(ENTITY_PANEL_VIEW_TYPE)[0];
		
		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				await rightLeaf.setViewState({
					type: ENTITY_PANEL_VIEW_TYPE,
					active: true,
				});
				leaf = rightLeaf;
			}
		}
		
		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}
	
	/**
	 * Deactivate the entity panel
	 */
	deactivateEntityPanel(): void {
		const { workspace } = this.app;
		const leaves = workspace.getLeavesOfType(ENTITY_PANEL_VIEW_TYPE);
		
		for (const leaf of leaves) {
			leaf.detach();
		}
	}
	
	/**
	 * Refresh the entity panel
	 */
	private refreshEntityPanel(): void {
		const { workspace } = this.app;
		const leaves = workspace.getLeavesOfType(ENTITY_PANEL_VIEW_TYPE);
		
		for (const leaf of leaves) {
			const view = leaf.view;
			if (view instanceof EntityPanelView) {
				view.refresh();
			}
		}
	}
	
	/**
	 * Show link suggestions for a file
	 */
	private async showLinkSuggestions(file: TFile): Promise<void> {
		const suggestions = await this.entityLinker.getSuggestionsForFile(file);
		
		if (suggestions.length === 0) {
			new Notice('当前笔记没有找到链接建议');
			return;
		}
		
		// Create a modal or notice with suggestions
		let message = '链接建议:\n\n';
		
		for (let i = 0; i < Math.min(suggestions.length, 5); i++) {
			const suggestion = suggestions[i];
			message += `${i + 1}. ${suggestion.entity.name} → ${suggestion.targetFile}\n`;
			message += `   相关度: ${Math.round(suggestion.strength * 100)}% (${suggestion.reason})\n\n`;
		}
		
		if (suggestions.length > 5) {
			message += `还有 ${suggestions.length - 5} 个建议...`;
		}
		
		new Notice(message, 10000);
	}
	
	/**
	 * Show entity statistics
	 */
	private showEntityStats(): void {
		const entities = this.indexManager.getAllEntities();
		const totalFiles = this.app.vault.getMarkdownFiles().length;
		
		let totalOccurrences = 0;
		for (const entity of entities) {
			totalOccurrences += entity.occurrences.length;
		}
		
		const message = `实体统计信息:\n\n` +
			`总实体数: ${entities.length}\n` +
			`总出现次数: ${totalOccurrences}\n` +
			`笔记总数: ${totalFiles}\n` +
			`平均每个笔记实体数: ${(totalOccurrences / totalFiles).toFixed(2)}`;
		
		new Notice(message, 8000);
	}
}

