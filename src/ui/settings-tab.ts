import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import SmartConnectionPlugin from '../main';
import { LanguageMode } from '../settings';

export class SmartConnectionSettingTab extends PluginSettingTab {
	plugin: SmartConnectionPlugin;

	constructor(app: App, plugin: SmartConnectionPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Smart Connection 设置'});

		new Setting(containerEl)
			.setName('语言识别模式')
			.setDesc('选择要识别的实体语言类型。更改后需要重建索引才能生效。')
			.addDropdown(dropdown => dropdown
				.addOption('mixed', '中英混合')
				.addOption('chinese_only', '仅中文')
				.addOption('english_only', '仅英文')
				.setValue(this.plugin.settings.languageMode)
				.onChange(async (value) => {
					this.plugin.settings.languageMode = value as LanguageMode;
					await this.plugin.saveSettings();
					new Notice('语言模式已更改。请重建索引以应用更改。', 5000);
				}));

		// ... other settings ...
	}
}
