import { config } from "./config";

function normalizeUrlString(raw: string): string {
	let trimmed = raw.trim();
	if (trimmed.startsWith("https//")) {
		trimmed = "https://" + trimmed.slice(7);
	} else if (trimmed.startsWith("http//")) {
		trimmed = "http://" + trimmed.slice(6);
	} else if (trimmed && !trimmed.includes("://")) {
		trimmed = "http://" + trimmed;
	}
	return trimmed;
}

/**
 * Parse a request URL defensively, handling reverse proxy headers
 * (X-Forwarded-Proto/Host), typos in scheme (https// -> https://),
 * and APP_URL default scheme. Never throws ERR_INVALID_URL.
 */
export function safeUrl(
	raw: string,
	headers?: Record<string, string | undefined>,
): URL {
	try {
		const normalized = normalizeUrlString(raw);
		const url = new URL(normalized);
		if (headers) {
			const proto =
				headers["x-forwarded-proto"] ||
				(config.appUrl.startsWith("https") ? "https" : undefined);
			const host = headers["x-forwarded-host"] || headers.host;
			if (proto) url.protocol = proto.endsWith(":") ? proto : `${proto}:`;
			if (host) {
				const parts = host.split(":");
				const hostname = parts[0];
				const port = parts[1];
				if (hostname) url.hostname = hostname;
				if (port) url.port = port;
				else if (proto === "https" || !port) url.port = "";
			}
		}
		return url;
	} catch {
		try {
			const appUrlNormalized = normalizeUrlString(config.appUrl);
			return new URL(appUrlNormalized);
		} catch {
			return new URL("http://localhost:4000");
		}
	}
}
