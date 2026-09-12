"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.error ?? "Não foi possível alterar a senha"); else router.push("/dashboard");
    setBusy(false);
  }
  return <main className="auth-shell"><section className="auth-panel"><div className="panel-heading"><span className="panel-kicker">Segurança</span><h1>Defina sua senha pessoal</h1><p>A senha inicial deve ser alterada antes de continuar.</p></div><form onSubmit={submit}><label>Senha inicial<input name="currentPassword" type="password" required /></label><label>Nova senha<input name="newPassword" type="password" minLength={8} required /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? "Salvando..." : "Alterar senha"}</button></form></section></main>;
}