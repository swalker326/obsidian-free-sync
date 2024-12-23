import { TFile, Vault } from "obsidian";
import { ObsidianHasher } from "./hasing";
import { FreeSyncStorage } from "./storage";
import { FileChange, VaultSnapshot } from "./types";

export class VaultUtility {
	hasher: ObsidianHasher;
	storage: FreeSyncStorage;
	vault: Vault;
	constructor(hasher: ObsidianHasher, storage: FreeSyncStorage, vault: Vault) {
		this.hasher = hasher;
		this.storage = storage;
		this.vault = vault;
	}

	public async getRemoteSnapshot(): Promise<VaultSnapshot> {
		const remoteSnapshot = await this.storage.getSnapshot();
		return remoteSnapshot;
	}

	public async createRemoteSnapshot(vault: Vault) {
		const snapshot = await this.makeSnapshot(vault);
		await this.storage.writeSnapshot(snapshot);
	}

	public async syncVault({
		localSnapshot,
		remoteSnapshot,
	}: {
		localSnapshot: VaultSnapshot;
		remoteSnapshot: VaultSnapshot;
	}) {
		const changes = this.detectChanges(localSnapshot, remoteSnapshot);

		try {
			for (const change of changes) {
				switch (change.type) {
					case "delete": {
						const file = this.vault.getAbstractFileByPath(change.path);
						if (file instanceof TFile) {
							await this.vault.delete(file);
							console.log(`Deleted file: ${change.path}`);
						}
						break;
					}
					case "upload": {
						const file = this.vault.getAbstractFileByPath(change.path) as TFile;
						if (file) {
							await this.storage.writeFile({ file });
							console.log(`Uploaded file: ${change.path}`);
						}
						break;
					}
					case "conflict": {
						// For now, let's use "newest wins" strategy
						const file = this.vault.getAbstractFileByPath(change.path) as TFile;
						if (file) {
							await this.storage.writeFile({ file });
							console.log(`Resolved conflict by uploading: ${change.path}`);
						}
						break;
					}
				}
			}

			// Update remote snapshot after all changes
			const finalSnapshot = await this.makeSnapshot(this.vault);
			await this.storage.writeSnapshot(finalSnapshot);
		} catch (error) {
			console.error("Sync failed:", error);
			throw error;
		}
	}

	private detectChanges(
		localSnapshot: VaultSnapshot,
		remoteSnapshot: VaultSnapshot,
	): FileChange[] {
		const changes: FileChange[] = [];
		const localFiles = new Set(Object.keys(localSnapshot.files));
		const remoteFiles = new Set(Object.keys(remoteSnapshot.files));

		// Files that exist locally
		for (const path of localFiles) {
			if (!remoteFiles.has(path)) {
				// New local file - needs upload
				changes.push({ type: "upload", path });
			} else if (localSnapshot.files[path] !== remoteSnapshot.files[path]) {
				// File exists in both but different hash - conflict
				changes.push({ type: "conflict", path });
			}
		}

		// Files that exist remotely
		for (const path of remoteFiles) {
			if (!localFiles.has(path)) {
				// File exists remotely but not locally - needs deletion or download
				changes.push({ type: "delete", path });
			}
		}

		console.log("Detected changes:", changes);
		return changes;
	}

	private async handleUpload(path: string) {
		const file = this.vault.getAbstractFileByPath(path) as TFile;
		if (!file) return;
		await this.storage.writeFile({ file });
	}

	private async handleDownload(path: string) {
		// Handle nested folder creation
		const folderPath = path.substring(0, path.lastIndexOf("/"));
		if (folderPath) {
			// Split the path into folder segments
			const folders = folderPath.split("/");
			let currentPath = "";

			// Create each folder level if it doesn't exist
			for (const folder of folders) {
				currentPath += (currentPath ? "/" : "") + folder;
				const folderExists = this.vault.getAbstractFileByPath(currentPath);
				if (!folderExists) {
					try {
						await this.vault.createFolder(currentPath);
					} catch (error) {
						// Log error but continue if folder already exists
						console.log(`Note: ${error.message}`);
					}
				}
			}
		}

		// Download and create the file
		const content = await this.storage.readFile(path);
		await this.vault.createBinary(path, content);
	}

	private async handleConflict(path: string) {
		const file = this.vault.getAbstractFileByPath(path) as TFile;
		if (!file) return;

		// Download remote version with a different name
		const remoteContent = await this.storage.readFile(path);
		const conflictPath = `${path}.remote`;
		await this.vault.createBinary(conflictPath, remoteContent);

		// Keep local version as is
		// User can manually resolve the conflict
	}

	//make a snapshot of the current vault
	public async makeSnapshot(vault: Vault): Promise<VaultSnapshot> {
		const snapshot = { files: {} } as VaultSnapshot;

		// Recursively get all markdown and other files from the vault
		const allFiles = vault.getFiles();

		for (const file of allFiles) {
			try {
				const hash = await this.hasher.calculateHash(file);
				snapshot.files[file.path] = hash;
				console.log(`Added to snapshot: ${file.path}`); // Debug logging
			} catch (error) {
				console.error(`Failed to hash file ${file.path}:`, error);
			}
		}

		// Debug logging
		console.log("Snapshot contains:", {
			totalFiles: Object.keys(snapshot.files).length,
			paths: Object.keys(snapshot.files),
		});

		return snapshot;
	}

	private async cleanupBackups(path: string) {
		const backupPath = `${path}.backup`;
		const remotePath = `${path}.remote`;

		const backupFile = this.vault.getAbstractFileByPath(backupPath);
		const remoteFile = this.vault.getAbstractFileByPath(remotePath);

		if (backupFile) await this.vault.delete(backupFile);
		if (remoteFile) await this.vault.delete(remoteFile);
	}

	public async handleFileChange(
		type: "create" | "modify" | "delete" | "rename",
		file: TFile,
		oldPath?: string,
	) {
		// Get current snapshots
		const localSnapshot = await this.makeSnapshot(this.vault);
		const remoteSnapshot = await this.getRemoteSnapshot();

		switch (type) {
			case "create":
			case "modify": {
				await this.storage.writeFile({ file });
				break;
			}
			case "delete": {
				await this.storage.deleteFile(file.path);
				break;
			}
			case "rename": {
				if (oldPath) {
					// Delete the old file from storage
					await this.storage.deleteFile(oldPath);
					// Upload the file with new name
					await this.storage.writeFile({ file });
				}
				break;
			}
		}

		// Update the remote snapshot
		await this.storage.writeSnapshot(localSnapshot);
	}
}
