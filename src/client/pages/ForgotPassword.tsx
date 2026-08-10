import { Head, Link, useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import AuthLayout from "../components/AuthLayout";
import Field from "../components/Field";

export default function ForgotPassword({ status }: { status?: string }) {
	const { data, setData, post, processing, errors, clearErrors } = useForm({
		email: "",
	});

	const submit = (e: FormEvent) => {
		e.preventDefault();
		post("/forgot-password");
	};

	return (
		<AuthLayout>
			<Head title="Pemulihan Kata Sandi" />
			<h1>Lupa Kata Sandi</h1>
			<p className="auth-sub">
				Masukkan alamat email terdaftar Anda untuk menerima tautan pemulihan kata sandi.
			</p>

			{status === "sent" ? (
				<div className="notice notice-success" role="status">
					Jika alamat email terdaftar dalam sistem, tautan pemulihan telah dikirimkan. Silakan periksa kotak masuk email Anda.
				</div>
			) : null}

			<form onSubmit={submit} noValidate>
				<Field id="email" label="Alamat Email Terdaftar" error={errors.email}>
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

				<button className="btn btn-primary btn-block" type="submit" disabled={processing}>
					{processing ? "Mengirim Tautan..." : "Kirim Tautan Pemulihan"}
				</button>
			</form>

			<p className="auth-alt">
				Ingat kata sandi Anda? <Link href="/login">Kembali Ke Halaman Masuk</Link>
			</p>
		</AuthLayout>
	);
}
