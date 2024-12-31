import { TFile } from "obsidian";

export interface FileState {
	hash: string;
	lastModified: number;
}

export interface VaultSnapshot {
	files: {
		[path: string]: string;
	};
	deletedFiles: {
		[path: string]: number;
	};
}

export interface FreeSyncSettings {
	endpoint: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
}

export type FileChangeType =
	| "create"
	| "modify"
	| "delete"
	| "rename"
	| "conflict";

export type FileOperation = {
	file: TFile;
};

export interface FileChange {
	type: "upload" | "download" | "delete" | "conflict";
	path: string;
}

export interface SyncResult {
	success: boolean;
	changes: FileChange[];
	errors?: Error[];
}

export interface StorageProvider {
	readFile(path: string): Promise<Uint8Array>;
	writeFile(file: TFile): Promise<void>;
	getSnapshot(): Promise<VaultSnapshot>;
	writeSnapshot(snapshot: VaultSnapshot): Promise<void>;
}
