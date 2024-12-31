import {
	App,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TAbstractFile,
	TFile,
	debounce,
} from "obsidian";
import { ObsidianHasher } from "utils/hasing";
import { FreeSyncStorage } from "utils/storage";
import { VaultUtility } from "utils/vault";
import { FreeSyncSettings, VaultSnapshot } from "./utils/types";

const DEFAULT_SETTINGS: FreeSyncSettings = {
	endpoint: "",
	accessKeyId: "",
	secretAccessKey: "",
	bucket: "free-sync",
};

export default class FreeSync extends Plugin {
	settings: FreeSyncSettings;
	private hasher: ObsidianHasher;
	private snapshot: VaultSnapshot;
	private storage: FreeSyncStorage;
	private vaultUtility: VaultUtility;

	async onload() {
		await this.loadSettings();
		this.hasher = new ObsidianHasher(this.app.vault);
		this.vaultUtility = new VaultUtility(this.hasher);
		this.storage = new FreeSyncStorage(
			this.app.vault,
			this.settings,
			this.vaultUtility,
			this.snapshot
		);

		// Initial sync when layout is ready
		this.app.workspace.onLayoutReady(async () => {
			new Notice("Starting initial vault sync...");
			// Get remote snapshot first
			console.log("this.vaultUtility", this.vaultUtility);
			const remoteSnapshot = await this.vaultUtility.getRemoteSnapshot(
				this.storage
			);
			// If remote has files but local is new, do initial download
			if (Object.keys(remoteSnapshot.files).length > 0) {
				new Notice("Found existing remote vault, downloading files...");

				// Create local snapshot
				this.snapshot = await this.vaultUtility.makeSnapshot(
					this.app.vault
				);

				// Sync vault (this will download missing files)
				await this.vaultUtility.syncVault({
					localSnapshot: this.snapshot,
					remoteSnapshot,
					vault: this.app.vault,
					storage: this.storage,
				});

				new Notice("Initial sync completed");
			} else {
				new Notice("No remote vault found, creating new snapshot...");
				// Create initial snapshot from local files
				await this.vaultUtility.createRemoteSnapshot(
					this.app.vault,
					this.storage
				);
				new Notice("Initial snapshot created");
			}
			// } catch (error) {
			// 	new Notice(`Initial sync failed: ${error.message}`);
			// 	console.error("Initial sync error:", error);
			// }
		});

		const ribbonIconEl = this.addRibbonIcon(
			"dice",
			"FreeSync Plugin",
			(evt: MouseEvent) => {
				// Called when the user clicks the icon.
				new Notice("This is a notice!");
			}
		);
		// Perform additional things with the ribbon
		ribbonIconEl.addClass("my-plugin-ribbon-class");

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("Status Bar Text");

		// // This adds an editor command that can perform some operation on the current editor instance
		// this.addCommand({
		// 	id: "sample-editor-command",
		// 	name: "Sample editor command",
		// 	editorCallback: (editor: Editor, view: MarkdownView) => {
		// 		console.log(editor.getSelection());
		// 		editor.replaceSelection("Sample Editor Command");
		// 	},
		// });
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		// this.addCommand({
		// 	id: "sync-vault",
		// 	name: "sync the local vault with the remote vault",
		// 	callback: async () => {
		// 		try {
		// 			const localSnapshot = await this.vaultUtility.makeSnapshot(
		// 				this.app.vault
		// 			);
		// 			const remoteSnapshot =
		// 				await this.vaultUtility.getRemoteSnapshot();
		// 			await this.vaultUtility.syncVault({
		// 				localSnapshot,
		// 				remoteSnapshot,
		// 			});
		// 			new Notice("Sync completed successfully");
		// 		} catch (error) {
		// 			new Notice(`Sync failed: ${error.message}`);
		// 			console.error("Sync error:", error);
		// 		}
		// 	},
		// });

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new FreeSyncSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, "click", (evt: MouseEvent) => {
			console.log("click", evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
		);

		// Add a sync command
		this.addCommand({
			id: "sync-vault",
			name: "Sync Vault",
			callback: async () => {
				try {
					const localSnapshot = await this.vaultUtility.makeSnapshot(
						this.app.vault
					);
					const remoteSnapshot =
						await this.vaultUtility.getRemoteSnapshot(this.storage);
					await this.vaultUtility.syncVault({
						localSnapshot,
						remoteSnapshot,
						vault: this.app.vault,
						storage: this.storage,
					});
					new Notice("Sync completed successfully");
				} catch (error) {
					new Notice(`Sync failed: ${error.message}`);
					console.error("Sync error:", error);
				}
			},
		});

		// Register file event handlers
		this.registerEvent(
			this.app.vault.on("create", (file) =>
				this.handleFileChange("create", file)
			)
		);
		this.registerEvent(
			this.app.vault.on("modify", (file) =>
				this.handleFileChange("modify", file)
			)
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) =>
				this.handleFileChange("delete", file)
			)
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) =>
				this.handleFileChange("rename", file, oldPath)
			)
		);
	}

	private handleFileChange = debounce(
		async (
			type: "create" | "modify" | "delete" | "rename",
			file: TAbstractFile,
			oldPath?: string
		) => {
			try {
				if (file instanceof TFile) {
					await this.vaultUtility.handleFileChange(
						type,
						file,
						{ vault: this.app.vault, storage: this.storage },
						oldPath
					);
				}
			} catch (error) {
				console.error(`Error handling file ${type}: ${error.message}`);
			}
		},
		1000,
		true
	);

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async reinitializeStorage() {
		this.storage = new FreeSyncStorage(
			this.app.vault,
			this.settings,
			this.vaultUtility,
			this.snapshot
		);
		this.vaultUtility = new VaultUtility(this.hasher);
	}
}

class FreeSyncModal extends Modal {
	// biome-ignore lint/complexity/noUselessConstructor: <explanation>
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText("Woah!");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class FreeSyncSettingTab extends PluginSettingTab {
	plugin: FreeSync;

	constructor(app: App, plugin: FreeSync) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("R2 Endpoint")
			.setDesc("Your Cloudflare R2 endpoint URL")
			.addText((text) =>
				text
					.setPlaceholder("https://xxx.r2.cloudflarestorage.com")
					.setValue(this.plugin.settings.endpoint)
					.onChange(async (value) => {
						this.plugin.settings.endpoint = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Access Key ID")
			.setDesc("Your R2 access key ID")
			.addText((text) =>
				text
					.setPlaceholder("Enter access key ID")
					.setValue(this.plugin.settings.accessKeyId)
					.onChange(async (value) => {
						this.plugin.settings.accessKeyId = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Secret Access Key")
			.setDesc("Your R2 secret access key")
			.addText((text) =>
				text
					.setPlaceholder("Enter secret access key")
					.setValue(this.plugin.settings.secretAccessKey)
					.onChange(async (value) => {
						this.plugin.settings.secretAccessKey = value;
						await this.plugin.saveSettings();
					})
			)
			.setClass("secret-input");

		new Setting(containerEl)
			.setName("Bucket Name")
			.setDesc("R2 bucket name")
			.addText((text) =>
				text
					.setPlaceholder("free-sync")
					.setValue(this.plugin.settings.bucket)
					.onChange(async (value) => {
						this.plugin.settings.bucket = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
