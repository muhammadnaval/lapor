import { config } from "./config";

/**
 * Parse a request URL defensively, handling reverse proxy headers
 * (X-Forwarded-Proto/Host) & APP_URL default scheme.
 */
export function safeUrl(
	raw: string,
	headers?: Record<string, string | undefined>,
): URL {
	try {
		const url = new URL(raw);
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
		return new URL(config.appUrl);
	}
}
