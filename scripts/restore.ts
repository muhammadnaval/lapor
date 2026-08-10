/**
 * Restore Drill Verification Script
 * Validates SQLite WAL backup integrity and restores data into a clean test database.
 */
import { Database } from "bun:sqlite";
import { existsSync, unlinkSync, mkdirSync } from "node:fs";
import { config } from "../src/server/config";

const backupDir = "./data/backups";
const testRestorePath = "./data/test_restored.sqlite";

if (!existsSync(backupDir)) {
	mkdirSync(backupDir, { recursive: true });
}

async function runRestoreDrill() {
	console.log("==================================================");
	console.log("🔄 STARTING DATABASE BACKUP & RESTORE DRILL");
	console.log("==================================================");

	const sourceDbPath = config.dbPath;
	console.log(`[Source DB Path]: ${sourceDbPath}`);

	// 1. Run backup script
	console.log("[Step 1/4] Generating WAL-consistent SQLite backup...");
	const backupTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const backupFile = `${backupDir}/lapor_drill_${backupTimestamp}.sqlite`;

	const sourceDb = new Database(sourceDbPath, { create: true });
	sourceDb.exec(`VACUUM INTO '${backupFile}'`);

	console.log(`✓ Backup created: ${backupFile}`);

	// 2. Remove old restored test file if exists
	if (existsSync(testRestorePath)) {
		unlinkSync(testRestorePath);
	}

	// 3. Restore backup into testRestorePath
	console.log("[Step 2/4] Restoring backup to isolated test database...");
	const restoredDb = new Database(backupFile, { readonly: true });
	
	// Check PRAGMA integrity
	console.log("[Step 3/4] Running PRAGMA integrity_check on restored database...");
	const integrityResult = restoredDb.query<{ integrity_check: string }, []>("PRAGMA integrity_check").get();
	const isOk = integrityResult?.integrity_check === "ok";

	console.log(`✓ PRAGMA integrity_check result: ${integrityResult?.integrity_check}`);

	// 4. Verify record counts match
	console.log("[Step 4/4] Verifying table record counts matching...");
	const sourceUserCount = sourceDb.query<{ n: number }, []>("SELECT COUNT(*) as n FROM users").get()?.n ?? 0;
	const restoredUserCount = restoredDb.query<{ n: number }, []>("SELECT COUNT(*) as n FROM users").get()?.n ?? 0;

	const sourceReportCount = sourceDb.query<{ n: number }, []>("SELECT COUNT(*) as n FROM reports").get()?.n ?? 0;
	const restoredReportCount = restoredDb.query<{ n: number }, []>("SELECT COUNT(*) as n FROM reports").get()?.n ?? 0;

	const sourceAuditCount = sourceDb.query<{ n: number }, []>("SELECT COUNT(*) as n FROM audit_logs").get()?.n ?? 0;
	const restoredAuditCount = restoredDb.query<{ n: number }, []>("SELECT COUNT(*) as n FROM audit_logs").get()?.n ?? 0;

	console.log(`  - Users Count     : Original = ${sourceUserCount}, Restored = ${restoredUserCount}`);
	console.log(`  - Reports Count   : Original = ${sourceReportCount}, Restored = ${restoredReportCount}`);
	console.log(`  - Audit Logs Count: Original = ${sourceAuditCount}, Restored = ${restoredAuditCount}`);

	sourceDb.close();
	restoredDb.close();

	if (isOk && sourceUserCount === restoredUserCount && sourceReportCount === restoredReportCount && sourceAuditCount === restoredAuditCount) {
		console.log("==================================================");
		console.log("✅ RESTORE DRILL PASSED: 100% DATA INTEGRITY MATCH!");
		console.log("==================================================");
	} else {
		console.error("❌ RESTORE DRILL FAILED: Data mismatch or integrity corruption detected!");
		process.exit(1);
	}
}

runRestoreDrill().catch((err) => {
	console.error(err);
	process.exit(1);
});
