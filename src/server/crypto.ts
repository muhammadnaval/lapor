/**
 * Application-level AES-256-GCM encryption for reporter identity fields.
 * Specified in lapor.prd Section 6 & Fase 1.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
	if (!cachedKey) {
		const secret = process.env.SESSION_SECRET || "lapor_secret_key_fallback_v1";
		cachedKey = scryptSync(secret, "lapor_salt_v1", 32);
	}
	return cachedKey;
}

export function encryptText(plainText: string): string {
	if (!plainText) return "";
	const iv = randomBytes(12);
	const key = getKey();
	const cipher = createCipheriv(ALGORITHM, key, iv);
	let encrypted = cipher.update(plainText, "utf8", "hex");
	encrypted += cipher.final("hex");
	const authTag = cipher.getAuthTag().toString("hex");

	// Format: iv:authTag:encrypted
	return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptText(cipherText: string): string {
	if (!cipherText || !cipherText.includes(":")) return cipherText;
	try {
		const [ivHex, authTagHex, encryptedHex] = cipherText.split(":");
		if (!ivHex || !authTagHex || !encryptedHex) return cipherText;

		const iv = Buffer.from(ivHex, "hex");
		const authTag = Buffer.from(authTagHex, "hex");
		const key = getKey();
		const decipher = createDecipheriv(ALGORITHM, key, iv);
		decipher.setAuthTag(authTag);

		let decrypted = decipher.update(encryptedHex, "hex", "utf8");
		decrypted += decipher.final("utf8");
		return decrypted;
	} catch {
		return "[Data Terdekripsi Gagal]";
	}
}
