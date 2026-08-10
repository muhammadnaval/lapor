/**
 * Email & Channel Notification Service Abstraction.
 * Specified in lapor.prd & Implementation Plan.
 */
import { db } from "./db";
import { sendMail } from "./mailer";

export interface QueueNotificationOptions {
	reportId?: number | null;
	recipientEmail: string;
	type: string;
	subject: string;
	body: string;
}

const insertNotificationQuery = db.query<
	{ id: number },
	[number | null, string, string, string, string]
>(
	`INSERT INTO notifications (report_id, recipient_email, type, subject, body) VALUES (?, ?, ?, ?, ?) RETURNING id`,
);

const listPendingNotificationsQuery = db.query<{
	id: number;
	reportId: number | null;
	recipientEmail: string;
	type: string;
	subject: string;
	body: string;
	status: string;
	retryCount: number;
}, []>(
	`SELECT id, report_id AS reportId, recipient_email AS recipientEmail, type, subject, body, status, retry_count AS retryCount FROM notifications WHERE status = 'pending' AND retry_count < 3 LIMIT 10`,
);

const updateNotificationStatusQuery = db.query<null, [string, number, number]>(
	`UPDATE notifications SET status = ?, retry_count = ? WHERE id = ?`,
);

export function queueNotification(options: QueueNotificationOptions): number {
	const result = insertNotificationQuery.get(
		options.reportId || null,
		options.recipientEmail,
		options.type,
		options.subject,
		options.body,
	);
	return result?.id || 0;
}

export async function processNotificationQueue(): Promise<number> {
	const pending = listPendingNotificationsQuery.all();
	let sentCount = 0;

	for (const item of pending) {
		try {
			await sendMail({
				to: item.recipientEmail,
				subject: item.subject,
				text: item.body,
			});
			updateNotificationStatusQuery.run("sent", item.retryCount + 1, item.id);
			sentCount++;
		} catch {
			updateNotificationStatusQuery.run(
				item.retryCount + 1 >= 3 ? "failed" : "pending",
				item.retryCount + 1,
				item.id,
			);
		}
	}

	return sentCount;
}
