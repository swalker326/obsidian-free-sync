import {
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
	DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { TFile, Vault } from "obsidian";
import { VaultSnapshot, FreeSyncSettings } from "./types";

export class FreeSyncStorage {
	private client: S3Client;
	private bucket: string;
	vault: Vault;

	constructor(vault: Vault, settings: FreeSyncSettings) {
		this.vault = vault;
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
		try {
			const snapshot = await this.client.send(
				new GetObjectCommand({
					Bucket: this.bucket,
					Key: "current_snapshot",
				})
			);

			if (!snapshot.Body) {
				await this.writeSnapshot({ files: {} });
				return { files: {} };
			}

			// Convert readable stream to text
			const bodyContents = await snapshot.Body.transformToString();
			return JSON.parse(bodyContents) as VaultSnapshot;
		} catch (err) {
			if (err.name === "NoSuchKey") {
				await this.writeSnapshot({ files: {} });
				return { files: {} };
			}
			throw new Error(err.message);
		}
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
