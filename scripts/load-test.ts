/**
 * Load & Concurrency Performance Test Script
 * Executes 100+ concurrent requests against the app server.
 */
import { performance } from "node:perf_hooks";

const BASE_URL = process.env.APP_URL || "http://localhost:4000";
const CONCURRENCY = 100;

async function runLoadTest() {
	console.log(`[Load Test] Target: ${BASE_URL}`);
	console.log(`[Load Test] Sending ${CONCURRENCY} concurrent requests to /health and / ...`);

	const startMem = process.memoryUsage().heapUsed;
	const startTime = performance.now();

	const requests = Array.from({ length: CONCURRENCY }, (_, i) => {
		const endpoint = i % 2 === 0 ? "/health" : "/";
		const clientIp = `10.0.${Math.floor(i / 25)}.${(i % 25) + 1}`;
		return fetch(`${BASE_URL}${endpoint}`, {
			headers: { "x-forwarded-for": clientIp },
		}).then((res) => ({
			status: res.status,
			ok: res.ok,
			url: endpoint,
		}));
	});

	const results = await Promise.all(requests);
	const endTime = performance.now();
	const endMem = process.memoryUsage().heapUsed;

	const durationMs = endTime - startTime;
	const successCount = results.filter((r) => r.ok).length;
	const reqPerSec = (CONCURRENCY / (durationMs / 1000)).toFixed(1);
	const memDiffKb = ((endMem - startMem) / 1024).toFixed(1);

	const statusCounts: Record<string, number> = {};
	for (const r of results) {
		const key = `${r.url} -> ${r.status}`;
		statusCounts[key] = (statusCounts[key] || 0) + 1;
	}

	console.log("--------------------------------------------------");
	console.log(`✓ Total Requests Sent : ${CONCURRENCY}`);
	console.log(`✓ Successful Responses : ${successCount}/${CONCURRENCY}`);
	console.log("Status Breakdown:", JSON.stringify(statusCounts, null, 2));
	console.log(`⏱️ Total Time Elapsed : ${durationMs.toFixed(2)} ms`);
	console.log(`⚡ Throughput           : ${reqPerSec} req/sec`);
	console.log(`🧠 Memory Heap Delta   : ${memDiffKb} KB`);
	console.log("--------------------------------------------------");

	if (successCount === CONCURRENCY) {
		console.log("SUCCESS: All load test requests passed with 100% availability!");
	} else {
		console.error("FAIL: Some requests failed during load test.");
		process.exit(1);
	}
}

runLoadTest().catch((err) => {
	console.error(err);
	process.exit(1);
});
