import { Head, Link, useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import AuthLayout from "../components/AuthLayout";
import Field from "../components/Field";

export default function Register({ googleEnabled }: { googleEnabled: boolean }) {
	const { data, setData, post, processing, errors, clearErrors } = useForm({
		name: "",
		email: "",
		password: "",
	});

	const submit = (e: FormEvent) => {
		e.preventDefault();
		post("/register");
	};

	return (
		<AuthLayout>
			<Head title="Pendaftaran Akun Petugas" />
			<h1>Pendaftaran Akun Petugas</h1>
			<p className="auth-sub">
				Daftarkan akun petugas layanan atau pengelola triase internal madrasah.
			</p>

			{googleEnabled ? (
				<>
					<a className="btn btn-block btn-google" href="/auth/google">
						Daftar dengan Akun Google
					</a>
					<div className="divider">atau menggunakan email</div>
				</>
			) : null}

			<form onSubmit={submit} noValidate>
				<Field id="name" label="Nama Lengkap" error={errors.name}>
					<input
						id="name"
						type="text"
						name="name"
						autoComplete="name"
						placeholder="Masukkan nama lengkap Anda"
						value={data.name}
						onChange={(e) => {
							clearErrors("name");
							setData("name", e.target.value);
						}}
					/>
				</Field>

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
						autoComplete="new-password"
						placeholder="Minimal 8 karakter"
						value={data.password}
						onChange={(e) => {
							clearErrors("password");
							setData("password", e.target.value);
						}}
					/>
					<p className="field-hint">Kata sandi minimal terdiri dari 8 karakter.</p>
				</Field>

				<button className="btn btn-primary btn-block" type="submit" disabled={processing}>
					{processing ? "Membuat Akun..." : "Buat Akun Petugas"}
				</button>
			</form>

			<p className="auth-alt">
				Sudah memiliki akun? <Link href="/login">Masuk Di Sini</Link>
			</p>
		</AuthLayout>
	);
}
