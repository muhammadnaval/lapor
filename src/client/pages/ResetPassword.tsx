import { Head, Link, useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import AuthLayout from "../components/AuthLayout";
import Field from "../components/Field";

export default function ResetPassword({
	email,
	token,
}: {
	email: string;
	token: string;
}) {
	const { data, setData, post, processing, errors, clearErrors } = useForm({
		email,
		token,
		password: "",
		passwordConfirmation: "",
	});

	const submit = (e: FormEvent) => {
		e.preventDefault();
		post("/reset-password");
	};

	return (
		<AuthLayout>
			<Head title="Atur Ulang Kata Sandi" />
			<h1>Buat Kata Sandi Baru</h1>
			<p className="auth-sub">
				Atur ulang kata sandi baru untuk akun <strong>{email}</strong>.
			</p>

			<form onSubmit={submit} noValidate>
				<Field id="password" label="Kata Sandi Baru" error={errors.password}>
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
					<p className="field-hint">Minimal 8 karakter campuran huruf dan angka.</p>
				</Field>

				<Field
					id="passwordConfirmation"
					label="Konfirmasi Kata Sandi Baru"
					error={errors.passwordConfirmation}
				>
					<input
						id="passwordConfirmation"
						type="password"
						name="passwordConfirmation"
						autoComplete="new-password"
						placeholder="Ulangi kata sandi baru"
						value={data.passwordConfirmation}
						onChange={(e) => {
							clearErrors("passwordConfirmation");
							setData("passwordConfirmation", e.target.value);
						}}
					/>
				</Field>

				{errors.token ? (
					<p className="field-error" role="alert">
						{errors.token}
					</p>
				) : null}

				<button className="btn btn-primary btn-block" type="submit" disabled={processing}>
					{processing ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
				</button>
			</form>

			<p className="auth-alt">
				<Link href="/login">Kembali Ke Halaman Masuk</Link>
			</p>
		</AuthLayout>
	);
}
