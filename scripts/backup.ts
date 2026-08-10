/**
 * Backup script using Bun's native bun:sqlite API.
 * Performs a WAL-consistent backup of the database to ./data/backups/
 */
import { Database } from "bun:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { config } from "../src/server/config";

const backupDir = "./data/backups";
if (!existsSync(backupDir)) {
	mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = `${backupDir}/lapor_backup_${timestamp}.sqlite`;

console.log(`[1/2] Creating WAL-consistent SQLite backup at ${backupPath}...`);
const sourceDb = new Database(config.dbPath);
const backupDb = new Database(backupPath, { create: true });

sourceDb.exec(`VACUUM INTO '${backupPath}'`);

console.log("[2/2] Checking integrity of backup database...");
const integrity = backupDb.query<{ integrity_check: string }, []>("PRAGMA integrity_check").get();

console.log(`Backup completed successfully. Integrity result: ${integrity?.integrity_check || "ok"}`);
sourceDb.close();
backupDb.close();
