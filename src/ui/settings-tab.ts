import { App, PluginSettingTab, Setting } from 'obsidian';
import SmartConnectionPlugin from '../../main';

/**
 * Settings tab for the plugin
 */
export class SmartConnectionSettingTab extends PluginSettingTab {
	plugin: SmartConnectionPlugin;
	
	constructor(app: App, plugin: SmartConnectionPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}
	
	display(): void {
		const { containerEl } = this;
		
		containerEl.empty();
		
		containerEl.createEl('h2', { text: '智能概念关联设置' });
		
		// Entity Extraction Section
		containerEl.createEl('h3', { text: '实体提取' });
		
		new Setting(containerEl)
			.setName('启用自动实体提取')
			.setDesc('自动从笔记中提取概念实体')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAutoExtraction)
				.onChange(async (value) => {
					this.plugin.settings.enableAutoExtraction = value;
					await this.plugin.saveSettings();
					await this.plugin.rebuildIndex();
				}));
		
		new Setting(containerEl)
			.setName('最小实体长度')
			.setDesc('提取的实体名称最小字符数')
			.addText(text => text
				.setPlaceholder('2')
				.setValue(String(this.plugin.settings.minEntityLength))
				.onChange(async (value) => {
					const num = parseInt(value);
					if (!isNaN(num) && num > 0) {
						this.plugin.settings.minEntityLength = num;
						await this.plugin.saveSettings();
					}
				}));
		
		new Setting(containerEl)
			.setName('最大实体长度')
			.setDesc('提取的实体名称最大字符数')
			.addText(text => text
				.setPlaceholder('50')
				.setValue(String(this.plugin.settings.maxEntityLength))
				.onChange(async (value) => {
					const num = parseInt(value);
					if (!isNaN(num) && num > 0) {
						this.plugin.settings.maxEntityLength = num;
						await this.plugin.saveSettings();
					}
				}));
		
		// Linking Section
		containerEl.createEl('h3', { text: '自动链接' });
		
		new Setting(containerEl)
			.setName('启用自动链接')
			.setDesc('自动为识别的实体创建链接（谨慎使用）')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAutoLinking)
				.onChange(async (value) => {
					this.plugin.settings.enableAutoLinking = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('仅链接已存在的笔记')
			.setDesc('只为已存在对应笔记的实体创建链接')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.linkOnlyExistingNotes)
				.onChange(async (value) => {
					this.plugin.settings.linkOnlyExistingNotes = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('最小相似度阈值')
			.setDesc('实体关联的最小相似度（0-1之间）')
			.addSlider(slider => slider
				.setLimits(0, 1, 0.1)
				.setValue(this.plugin.settings.minSimilarityThreshold)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.minSimilarityThreshold = value;
					await this.plugin.saveSettings();
					await this.plugin.rebuildIndex();
				}));
		
		new Setting(containerEl)
			.setName('每个笔记最大建议数')
			.setDesc('每个笔记显示的最大关联实体数量')
			.addText(text => text
				.setPlaceholder('10')
				.setValue(String(this.plugin.settings.maxSuggestionsPerNote))
				.onChange(async (value) => {
					const num = parseInt(value);
					if (!isNaN(num) && num > 0) {
						this.plugin.settings.maxSuggestionsPerNote = num;
						await this.plugin.saveSettings();
					}
				}));
		
		// Display Section
		containerEl.createEl('h3', { text: '显示' });
		
		new Setting(containerEl)
			.setName('显示实体面板')
			.setDesc('在侧边栏显示概念实体面板')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showEntityPanel)
				.onChange(async (value) => {
					this.plugin.settings.showEntityPanel = value;
					await this.plugin.saveSettings();
					
					if (value) {
						await this.plugin.activateEntityPanel();
					} else {
						this.plugin.deactivateEntityPanel();
					}
				}));
		
		new Setting(containerEl)
			.setName('高亮显示实体')
			.setDesc('在编辑器中高亮显示已识别的实体')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.highlightEntities)
				.onChange(async (value) => {
					this.plugin.settings.highlightEntities = value;
					await this.plugin.saveSettings();
				}));
		
		// Advanced Section
		containerEl.createEl('h3', { text: '高级设置' });
		
		new Setting(containerEl)
			.setName('索引更新延迟（毫秒）')
			.setDesc('文件修改后延迟多久更新索引')
			.addText(text => text
				.setPlaceholder('1000')
				.setValue(String(this.plugin.settings.indexUpdateDebounceMs))
				.onChange(async (value) => {
					const num = parseInt(value);
					if (!isNaN(num) && num >= 0) {
						this.plugin.settings.indexUpdateDebounceMs = num;
						await this.plugin.saveSettings();
					}
				}));
		
		new Setting(containerEl)
			.setName('启用缓存')
			.setDesc('启用实体索引缓存以提高性能')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.cacheEnabled)
				.onChange(async (value) => {
					this.plugin.settings.cacheEnabled = value;
					await this.plugin.saveSettings();
				}));
		
		// Actions Section
		containerEl.createEl('h3', { text: '操作' });
		
		new Setting(containerEl)
			.setName('重建索引')
			.setDesc('重新扫描所有笔记并重建实体索引')
			.addButton(button => button
				.setButtonText('重建索引')
				.onClick(async () => {
					button.setDisabled(true);
					button.setButtonText('重建中...');
					
					try {
						await this.plugin.rebuildIndex();
						button.setButtonText('完成！');
						setTimeout(() => {
							button.setButtonText('重建索引');
							button.setDisabled(false);
						}, 2000);
					} catch (e) {
						console.error('Failed to rebuild index:', e);
						button.setButtonText('失败');
						setTimeout(() => {
							button.setButtonText('重建索引');
							button.setDisabled(false);
						}, 2000);
					}
				}));
	}
}

