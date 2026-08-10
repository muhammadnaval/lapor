import { Head, Link, useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import AuthLayout from "../components/AuthLayout";
import Field from "../components/Field";

export default function Login({
	googleEnabled,
	notice,
}: {
	googleEnabled: boolean;
	notice?: string | null;
}) {
	const { data, setData, post, processing, errors, clearErrors } = useForm({
		email: "",
		password: "",
	});

	const submit = (e: FormEvent) => {
		e.preventDefault();
		post("/login");
	};

	return (
		<AuthLayout>
			<Head title="Masuk Akun Petugas" />
			<h1>Masuk Akun Petugas</h1>
			<p className="auth-sub">
				Masuk ke portal manajemen dan triase laporan LAPOR MTsN 3 Kota Padang.
			</p>

			{notice ? (
				<div
					className={`notice ${notice.includes("hanya") ? "notice-info" : "notice-success"}`}
					role="status"
				>
					{notice}
				</div>
			) : null}

			{googleEnabled ? (
				<>
					<a className="btn btn-block btn-google" href="/auth/google">
						Masuk dengan Akun Google
					</a>
					<div className="divider">atau menggunakan email</div>
				</>
			) : null}

			<form onSubmit={submit} noValidate>
				<Field id="email" label="Alamat Email" error={errors.email}>
					<input
						id="email"
						type="email"
						name="email"
						autoComplete="email"
						placeholder="nama@email.com"
						value={data.email}
						onChange={(e) => {
							clearErrors("email");
							setData("email", e.target.value);
						}}
					/>
				</Field>

				<Field id="password" label="Kata Sandi" error={errors.password}>
					<input
						id="password"
						type="password"
						name="password"
						autoComplete="current-password"
						placeholder="Masukkan kata sandi"
						value={data.password}
						onChange={(e) => {
							clearErrors("password");
							setData("password", e.target.value);
						}}
					/>
				</Field>

				<div className="form-row">
					<Link href="/forgot-password" className="link-small">
						Lupa kata sandi Anda?
					</Link>
				</div>

				<button className="btn btn-primary btn-block" type="submit" disabled={processing}>
					{processing ? "Memproses Masuk..." : "Masuk Akun"}
				</button>
			</form>

			<div
				style={{
					marginTop: "1.5rem",
					padding: "0.85rem 1rem",
					background: "var(--surface-subtle, rgba(0,0,0,0.03))",
					borderRadius: "8px",
					border: "1px solid var(--border)",
					fontSize: "0.85rem",
					color: "var(--muted)",
					textAlign: "center",
					lineHeight: "1.4",
				}}
			>
				🔒 <strong>Pendaftaran Akun:</strong> Akun baru hanya dapat dibuat oleh Administrator Sistem.
			</div>

			<div style={{ marginTop: "1.25rem", textAlign: "center" }}>
				<Link
					href="/"
					style={{
						fontSize: "0.88rem",
						fontWeight: 600,
						color: "var(--primary)",
						textDecoration: "none",
						display: "inline-flex",
						alignItems: "center",
						gap: "0.35rem",
					}}
				>
					← Kembali ke Beranda Utama
				</Link>
			</div>
		</AuthLayout>
	);
}
