import {
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
	DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { TFile, Vault } from "obsidian";
import { VaultSnapshot, FreeSyncSettings } from "./types";
import { VaultUtility } from "./vault";

export class FreeSyncStorage {
	private client: S3Client;
	private bucket: string;
	private snapshot: VaultSnapshot;
	vault: Vault;
	vaultUtility: VaultUtility;

	constructor(
		vault: Vault,
		settings: FreeSyncSettings,
		vaultUtility: VaultUtility,
		snapshot: VaultSnapshot
	) {
		this.vault = vault;
		this.snapshot = snapshot;
		this.vaultUtility = vaultUtility;
		this.bucket = settings.bucket;
		this.client = new S3Client({
			region: "auto",
			endpoint: settings.endpoint,
			credentials: {
				accessKeyId: settings.accessKeyId,
				secretAccessKey: settings.secretAccessKey,
			},
		});
	}

	async getSnapshot(): Promise<VaultSnapshot> {
		console.log("SS1");
		const snapshot = await this.client.send(
			new GetObjectCommand({
				Bucket: this.bucket,
				Key: "current_snapshot",
			})
		);
		console.log("SS2", snapshot);
		if (!snapshot.Body) {
			await this.writeSnapshot({ files: {}, deletedFiles: {} });
			return { files: {}, deletedFiles: {} };
		}
		console.log("SS3", snapshot);

		// Convert readable stream to text
		const bodyContents = await snapshot.Body.transformToString();
		return JSON.parse(bodyContents) as VaultSnapshot;
		// } catch (err) {
		// 	console.log("@@@error", err);
		// 	if (err.name === "NoSuchKey") {
		// 		await this.writeSnapshot({ files: {}, deletedFiles: {} });
		// 		return { files: {}, deletedFiles: {} };
		// 	}
		// 	throw new Error("Error Getting Storage Snapshot");
		// }
	}
	async writeSnapshot(snapshot: VaultSnapshot) {
		const put = new PutObjectCommand({
			Bucket: this.bucket,
			Key: "current_snapshot",
			Body: JSON.stringify(snapshot),
		});
		try {
			await this.client.send(put);
			console.log("Updated current_snapshot:", {
				timestamp: new Date().toISOString(),
				fileCount: Object.keys(snapshot.files).length,
				files: Object.keys(snapshot.files),
			});
		} catch (err) {
			console.error("Failed to update current_snapshot:", err.message);
			throw err;
		}
	}

	async writeFile({ file }: { file: TFile }) {
		const fileName = file.path;
		const content = new Uint8Array(await this.vault.readBinary(file));
		const put = new PutObjectCommand({
			Bucket: this.bucket,
			Key: fileName,
			Body: content,
		});
		await this.client.send(put);
	}
	async readFile(path: string): Promise<Uint8Array> {
		const response = await this.client.send(
			new GetObjectCommand({
				Bucket: this.bucket,
				Key: path,
			})
		);

		if (!response.Body) {
			throw new Error(`File not found: ${path}`);
		}

		// Use the built-in transformToByteArray instead of manual stream reading
		return await response.Body.transformToByteArray();
	}
	async deleteFile(path: string) {
		const command = new DeleteObjectCommand({
			Bucket: this.bucket,
			Key: path,
		});

		await this.client.send(command);
	}
}
