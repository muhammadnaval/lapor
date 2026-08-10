/**
 * `bun run db:seed [email] [password] [role]` — create a demo user.
 * Defaults: demo@example.com / password123 / user.
 * Example: bun run db:seed admin@example.com admin123 admin
 */
import { hashPassword } from '../src/server/auth'
import { createUserWithRole, findUserByEmail } from '../src/server/db'

const email = process.argv[2] ?? "admin@mtsn3padang.sch.id";
const password = process.argv[3] ?? "AdminPadang2026!";
const role = (process.argv[4] ?? "admin").toLowerCase();
const name = process.argv[5] ?? "Super Admin MTsN 3 Kota Padang";

if (role !== "user" && role !== "admin") {
	console.error('Role must be "user" or "admin".');
	process.exit(1);
}

if (findUserByEmail.get(email)) {
	console.log(`User ${email} already exists.`);
	process.exit(0);
}

const passwordHash = await hashPassword(password);
createUserWithRole.get(name, email, passwordHash, role);
console.log(`Seeded ${name} <${email}> (password: ${password}, role: ${role})`);
