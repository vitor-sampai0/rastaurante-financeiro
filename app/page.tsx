"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const payload = {
        email: String(form.get("email")),
        password: String(form.get("password")),
        ...(registering && {
          name: String(form.get("name")),
          restaurantName: String(form.get("restaurantName")),
        }),
      };
      const response = await fetch(
        registering ? "/api/auth/register" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const contentType = response.headers.get("content-type") ?? "";
      const result = contentType.includes("application/json")
        ? await response.json()
        : null;
      if (!response.ok)
        setError(result?.error ?? "Não foi possível concluir a operação");
      else
        router.push(
          result?.mustChangePassword ? "/change-password" : "/dashboard",
        );
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <p className="eyebrow">Financeiro Restaurante</p>
        <h1>Clareza para cada decisão do seu salão.</h1>
        <p>
          Controle caixa, contas, estoque e equipe em um único lugar, com dados
          reais do seu restaurante.
        </p>
      </section>
      <section className="auth-panel">
        <div className="panel-heading">
          <span className="panel-kicker">
            {registering ? "Primeiro acesso" : "Área restrita"}
          </span>
          <h2>{registering ? "Crie seu espaço" : "Bem-vindo de volta"}</h2>
          <p>
            {registering
              ? "Cadastre o restaurante e o usuário proprietário."
              : "Entre para acompanhar a operação financeira."}
          </p>
        </div>
        <form onSubmit={submit}>
          {registering && (
            <>
              <label>
                Seu nome
                <input name="name" required minLength={2} />
              </label>
              <label>
                Nome do restaurante
                <input name="restaurantName" required minLength={2} />
              </label>
            </>
          )}
          <label>
            E-mail
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            Senha
            <input
              name="password"
              type="password"
              required
              minLength={registering ? 8 : 6}
              autoComplete={registering ? "new-password" : "current-password"}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" disabled={busy}>
            {busy ? "Aguarde..." : registering ? "Criar acesso" : "Entrar"}
          </button>
        </form>
        <button
          className="switch-button"
          type="button"
          onClick={() => {
            setRegistering(!registering);
            setError("");
          }}
        >
          {registering ? "Já tenho uma conta" : "Ainda não tenho uma conta"}
        </button>
      </section>
    </main>
  );
}
