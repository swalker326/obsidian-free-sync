import { TFile, Vault } from "obsidian";

// files stored in r2 path/name.version(hash).ext
export interface FileSnapshot {
	name: string;
	path: string;
	hash: string;
	lastModified: number;
}

interface HashError {
	error: string;
	path: string;
	timestamp: Date;
}

export class ObsidianHasher {
	private vault: Vault;

	constructor(vault: Vault) {
		this.vault = vault;
	}

	/**
	 * Calculate SHA-256 hash of a TFile
	 */
	public async calculateHash(file: TFile): Promise<string> {
		try {
			// Get the file contents as ArrayBuffer

			// Calculate hash using Web Crypto API
			const content = await this.vault.readBinary(file);
			const hashBuffer = await crypto.subtle.digest("SHA-256", content);
			const hashArray = Array.from(new Uint8Array(hashBuffer));
			const hashHex = hashArray
				.map((byte) => byte.toString(16).padStart(2, "0"))
				.join("");

			return hashHex;
		} catch (error) {
			throw this.createError(file.path, error);
		}
	}

	/**
	 * Compare two TFiles
	 */
	public async compareFiles(fileA: TFile, fileB: TFile): Promise<boolean> {
		try {
			// Quick comparison first using size and mtime
			if (fileA.stat.size !== fileB.stat.size) {
				return false;
			}

			const [hashA, hashB] = await Promise.all([
				this.calculateHash(fileA),
				this.calculateHash(fileB),
			]);
			return hashA === hashB;
		} catch (error) {
			throw this.createError(
				`${fileA.path}, ${fileB.path}`,
				"Error comparing files",
			);
		}
	}

	/**
	 * Batch hash multiple files
	 */
	// public async hashFiles(files: TFile[]): Promise<Record<string, TFileHash>> {
	// 	const results: Record<string, TFileHash> = {};

	// 	await Promise.all(
	// 		files.map(async (file) => {
	// 			try {
	// 				results[file.path] = await this.calculateHash(file);
	// 			} catch (error) {
	// 				console.error(`Error hashing ${file.path}:`, error);
	// 			}
	// 		})
	// 	);

	// 	return results;
	// }

	/**
	 * Check if a file needs to be synced based on stored hash
	 */
	public async needsSync(file: TFile, storedHash: string): Promise<boolean> {
		try {
			const currentHash = await this.calculateHash(file);
			return currentHash !== storedHash;
		} catch (error) {
			throw this.createError(file.path, "Error checking sync status");
		}
	}

	/**
	 * Create formatted error object
	 */
	private createError(path: string, error: unknown): HashError {
		return {
			error: error instanceof Error ? error.message : String(error),
			path,
			timestamp: new Date(),
		};
	}
}

// Example usage in your plugin:
/*
export default class SyncPlugin extends Plugin {
    private hasher: ObsidianHasher;

    async onload() {
        this.hasher = new ObsidianHasher(this.app.vault);

        // Example: Hash a specific file
        const file = this.app.vault.getAbstractFileByPath('path/to/note.md') as TFile;
        if (file) {
            const hash = await this.hasher.calculateHash(file);
            console.log('File hash:', hash);
        }

        // Example: Batch hash multiple files
        const markdownFiles = this.app.vault.getMarkdownFiles();
        const hashes = await this.hasher.hashFiles(markdownFiles);
        console.log('All hashes:', hashes);
    }
}
*/

// export async function handleFileChange(file: TFile, hasher: ObsidianHasher) {
// 	const currentHash = await hasher.calculateHash(file);
// 	const snapshot = await getSnapshot();

// 	if (
// 		!snapshot.files[file.path] ||
// 		snapshot.files[file.path].hash !== currentHash
// 	) {
// 		// File is new or modified
// 		if (snapshot.files[file.path]) {
// 			// Existing file - handle versioning
// 			await createNewVersion(file, snapshot.files[file.path]);
// 		}

// 		// Upload to R2
// 		await uploadToR2(file);

// 		// Update snapshot
// 		snapshot.files[file.path] = {
// 			path: file.path,
// 			hash: currentHash,
// 			lastModified: Date.now(),
// 			version: (snapshot.files[file.path]?.version || 0) + 1,
// 			size: file.size,
// 		};

// 		await saveSnapshot(snapshot);
// 	}
// }

// export async function syncVault() {
// 	const localSnapshot = await getLocalSnapshot();
// 	const remoteSnapshot = await getRemoteSnapshot();

// 	// Find files that differ
// 	const diffFiles = findDifferentFiles(localSnapshot, remoteSnapshot);

// 	for (const file of diffFiles) {
// 		if (shouldDownload(file, localSnapshot, remoteSnapshot)) {
// 			await downloadFromR2(file);
// 		} else {
// 			await uploadToR2(file);
// 		}
// 	}
// }
