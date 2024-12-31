import { TFile, Vault } from "obsidian";
import { ObsidianHasher } from "./hasing";
import { FreeSyncStorage } from "./storage";
import { FileChange, VaultSnapshot } from "./types";

export class VaultUtility {
	hasher: ObsidianHasher;

	constructor(hasher: ObsidianHasher) {
		this.hasher = hasher;
	}

	async getRemoteSnapshot(storage: FreeSyncStorage): Promise<VaultSnapshot> {
		console.log("Getting remote snapshot...");
		try {
			const remoteSnapshot = await storage.getSnapshot();
			console.log("Remote snapshot:", remoteSnapshot);
			return remoteSnapshot;
		} catch (e) {
			console.error("Failed to get remote snapshot:", e);
			throw new Error("Failed to get remote snapshot");
		}
	}

	public async createRemoteSnapshot(vault: Vault, storage: FreeSyncStorage) {
		const snapshot = await this.makeSnapshot(vault);
		await storage.writeSnapshot(snapshot);
	}

	public async syncVault({
		localSnapshot,
		remoteSnapshot,
		vault,
		storage,
	}: {
		localSnapshot: VaultSnapshot;
		remoteSnapshot: VaultSnapshot;
		vault: Vault;
		storage: FreeSyncStorage;
	}) {
		const changes = this.detectChanges(localSnapshot, remoteSnapshot);

		try {
			for (const change of changes) {
				console.log("CHANGE", change);
				switch (change.type) {
					// case "delete": {
					// 	const file = this.vault.getAbstractFileByPath(
					// 		change.path
					// 	);
					// 	if (file instanceof TFile) {
					// 		await this.vault.delete(file);
					// 		console.log(`Deleted file: ${change.path}`);
					// 	}
					// 	break;
					case "upload": {
						const file = vault.getAbstractFileByPath(
							change.path
						) as TFile;
						if (file) {
							await storage.writeFile({ file });
							console.log(`Uploaded file: ${change.path}`);
						}
						break;
					}
					case "conflict": {
						// For now, let's use "newest wins" strategy
						const file = vault.getAbstractFileByPath(
							change.path
						) as TFile;
						if (file) {
							await storage.writeFile({ file });
							console.log(
								`Resolved conflict by uploading: ${change.path}`
							);
						}
						break;
					}
					case "download": {
						await this.handleDownload(change.path, vault, storage);
						break;
					}
				}
			}

			// Update remote snapshot after all changes
			const finalSnapshot = await this.makeSnapshot(vault);
			await storage.writeSnapshot(finalSnapshot);
		} catch (error) {
			console.error("Sync failed:", error);
			throw error;
		}
	}

	private detectChanges(
		localSnapshot: VaultSnapshot,
		remoteSnapshot: VaultSnapshot
	): FileChange[] {
		const localFiles = new Set(Object.keys(localSnapshot.files));
		const remoteFiles = new Set(Object.keys(remoteSnapshot.files));

		// files that exist locally but not remotely
		const upload = Array.from(
			new Set([...localFiles].filter((path) => !remoteFiles.has(path)))
		).map((path) => ({ type: "upload" as const, path }));

		// files that exist remotely but not locally
		const download = Array.from(
			new Set([...remoteFiles].filter((path) => !localFiles.has(path)))
		).map((path) => ({ type: "download" as const, path }));

		// files that exist in both but have different hashes
		const conflict = Array.from(
			new Set(
				[...localFiles].filter(
					(path) =>
						remoteFiles.has(path) &&
						localSnapshot.files[path] !== remoteSnapshot.files[path]
				)
			)
		).map((path) => ({ type: "conflict" as const, path }));

		return [...upload, ...download, ...conflict];
	}

	private async handleUpload(
		path: string,
		vault: Vault,
		storage: FreeSyncStorage
	) {
		const file = vault.getAbstractFileByPath(path) as TFile;
		if (!file) return;
		await storage.writeFile({ file });
	}

	private async handleDownload(
		path: string,
		vault: Vault,
		storage: FreeSyncStorage
	) {
		// Handle nested folder creation
		console.log(`Downloading file: ${path}`);
		const folderPath = path.substring(0, path.lastIndexOf("/"));
		if (folderPath) {
			// Split the path into folder segments
			const folders = folderPath.split("/");
			let currentPath = "";

			// Create each folder level if it doesn't exist
			for (const folder of folders) {
				currentPath += (currentPath ? "/" : "") + folder;
				const folderExists = vault.getAbstractFileByPath(currentPath);
				if (!folderExists) {
					try {
						await vault.createFolder(currentPath);
					} catch (error) {
						// Log error but continue if folder already exists
						console.log(`Note: ${error.message}`);
					}
				}
			}
		}

		// Download and create the file
		const content = await storage.readFile(path);
		await vault.createBinary(path, content);
	}

	private async handleConflict(
		path: string,
		vault: Vault,
		storage: FreeSyncStorage
	) {
		const file = vault.getAbstractFileByPath(path) as TFile;
		if (!file) return;

		// Download remote version with a different name
		const remoteContent = await storage.readFile(path);
		const conflictPath = `${path}.remote`;
		await vault.createBinary(conflictPath, remoteContent);

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

	private async cleanupBackups(path: string, vault: Vault) {
		const backupPath = `${path}.backup`;
		const remotePath = `${path}.remote`;

		const backupFile = vault.getAbstractFileByPath(backupPath);
		const remoteFile = vault.getAbstractFileByPath(remotePath);

		if (backupFile) await vault.delete(backupFile);
		if (remoteFile) await vault.delete(remoteFile);
	}

	public async handleFileChange(
		type: "create" | "modify" | "delete" | "rename",
		file: TFile,
		{ vault, storage }: { vault: Vault; storage: FreeSyncStorage },
		oldPath?: string
	) {
		// Get current snapshots
		const localSnapshot = await this.makeSnapshot(vault);

		switch (type) {
			case "create":
			case "modify": {
				await storage.writeFile({ file });
				break;
			}
			case "delete": {
				await storage.deleteFile(file.path);
				break;
			}
			case "rename": {
				if (oldPath) {
					// Delete the old file from storage
					await storage.deleteFile(oldPath);
					// Upload the file with new name
					await storage.writeFile({ file });
				}
				break;
			}
		}

		// Update the remote snapshot
		await storage.writeSnapshot(localSnapshot);
	}
}
