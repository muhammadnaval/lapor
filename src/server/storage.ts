/**
 * Storage Abstraction for Local Volume & Object Storage.
 * Specified in lapor.prd Section 5 & Fase 1.
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "./config";

export interface StorageDriver {
	save(key: string, data: Buffer | Uint8Array): Promise<string>;
	read(key: string): Promise<Buffer | null>;
	delete(key: string): Promise<boolean>;
}

export class LocalStorageDriver implements StorageDriver {
	private baseDir: string;

	constructor(baseDir: string = config.upload.dir) {
		this.baseDir = baseDir;
		if (!existsSync(this.baseDir)) {
			mkdirSync(this.baseDir, { recursive: true });
		}
	}

	async save(key: string, data: Buffer | Uint8Array): Promise<string> {
		const fullPath = join(this.baseDir, key);
		mkdirSync(dirname(fullPath), { recursive: true });
		writeFileSync(fullPath, data);
		return fullPath;
	}

	async read(key: string): Promise<Buffer | null> {
		const fullPath = join(this.baseDir, key);
		if (!existsSync(fullPath)) return null;
		return readFileSync(fullPath);
	}

	async delete(key: string): Promise<boolean> {
		const fullPath = join(this.baseDir, key);
		if (!existsSync(fullPath)) return false;
		try {
			unlinkSync(fullPath);
			return true;
		} catch {
			return false;
		}
	}
}

export const storage: StorageDriver = new LocalStorageDriver();
