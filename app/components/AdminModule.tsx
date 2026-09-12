"use client";

import { FormEvent, useEffect, useState } from "react";

type Module =
  | "transactions"
  | "categories"
  | "accounts"
  | "cash"
  | "suppliers"
  | "payables"
  | "employees"
  | "payroll"
  | "inventory"
  | "team"
  | "audit"
  | "reports";
const labels: Record<Module, string> = {
  transactions: "Transações",
  categories: "Categorias",
  accounts: "Contas",
  cash: "Caixa",
  suppliers: "Fornecedores",
  payables: "Contas a pagar",
  employees: "Funcionários",
  payroll: "Folha e pagamentos",
  inventory: "Estoque",
  team: "Equipe",
  audit: "Auditoria",
  reports: "Relatórios",
};
const endpoints: Record<Module, string> = {
  transactions: "/api/transactions",
  categories: "/api/categories",
  accounts: "/api/accounts",
  cash: "/api/cash-sessions",
  suppliers: "/api/suppliers",
  payables: "/api/payables",
  employees: "/api/employees",
  payroll: "/api/payroll",
  inventory: "/api/inventory",
  team: "/api/team",
  audit: "/api/audit",
  reports: "/api/reports",
};
const fields: Record<
  Exclude<Module, "audit" | "reports">,
  { name: string; label: string; type?: string; required?: boolean }[]
> = {
  transactions: [
    {
      name: "type",
      label: "Tipo",
      type: "select:INCOME:Entrada,EXPENSE:Saída",
      required: true,
    },
    { name: "description", label: "Descrição", required: true },
    { name: "amount", label: "Valor", type: "number", required: true },
    { name: "occurredAt", label: "Data", type: "date" },
    {
      name: "paymentMethod",
      label: "Pagamento",
      type: "select:PIX:Pix,CASH:Dinheiro,DEBIT_CARD:Débito,CREDIT_CARD:Crédito,BANK_TRANSFER:Transferência,BOLETO:Boleto,OTHER:Outro",
    },
  ],
  categories: [
    { name: "name", label: "Nome", required: true },
    {
      name: "type",
      label: "Tipo",
      type: "select:INCOME:Receita,EXPENSE:Despesa,BOTH:Ambos",
      required: true,
    },
  ],
  accounts: [
    { name: "name", label: "Nome", required: true },
    {
      name: "type",
      label: "Tipo",
      type: "select:CASH:Dinheiro,BANK:Banco,PIX:Pix,CARD_CLEARING:Cartão,OTHER:Outra",
      required: true,
    },
    { name: "initialBalance", label: "Saldo inicial", type: "number" },
  ],
  cash: [
    { name: "accountId", label: "ID da conta", required: true },
    {
      name: "openingBalance",
      label: "Valor inicial",
      type: "number",
      required: true,
    },
    { name: "notes", label: "Observações" },
  ],
  suppliers: [
    { name: "name", label: "Nome", required: true },
    { name: "document", label: "Documento" },
    { name: "phone", label: "Telefone" },
    { name: "email", label: "E-mail", type: "email" },
  ],
  payables: [
    { name: "description", label: "Descrição", required: true },
    { name: "amount", label: "Valor", type: "number", required: true },
    { name: "dueDate", label: "Vencimento", type: "date", required: true },
    { name: "accountId", label: "ID da conta" },
    { name: "supplierId", label: "ID do fornecedor" },
  ],
  employees: [
    { name: "name", label: "Nome", required: true },
    { name: "roleName", label: "Cargo" },
    { name: "monthlySalary", label: "Salário mensal", type: "number" },
    { name: "hiredAt", label: "Admissão", type: "date" },
  ],
  payroll: [
    { name: "employeeId", label: "ID do funcionário", required: true },
    { name: "referenceMonth", label: "Mês (AAAA-MM)", required: true },
    { name: "grossAmount", label: "Bruto", type: "number", required: true },
    { name: "deductions", label: "Descontos", type: "number" },
    { name: "dueDate", label: "Vencimento", type: "date", required: true },
  ],
  inventory: [
    { name: "name", label: "Item", required: true },
    { name: "unit", label: "Unidade" },
    { name: "currentStock", label: "Estoque atual", type: "number" },
    { name: "minimumStock", label: "Estoque mínimo", type: "number" },
    { name: "averageCost", label: "Custo médio", type: "number" },
  ],
  team: [
    { name: "name", label: "Nome", required: true },
    { name: "email", label: "E-mail", type: "email", required: true },
    {
      name: "password",
      label: "Senha inicial",
      type: "password",
      required: true,
    },
    {
      name: "role",
      label: "Papel",
      type: "select:OPERATOR:Operador,MANAGER:Gerente,ADMIN:Administrador,VIEWER:Visualizador",
    },
  ],
};

function display(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") return "";
  return String(value);
}
export default function AdminModule({ module }: { module: Module }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  async function load() {
    setLoading(true);
    const response = await fetch(endpoints[module]);
    const data = await response.json().catch(() => []);
    if (!response.ok) setError(data.error ?? "Não foi possível carregar");
    else setRows(Array.isArray(data) ? data : (data.transactions ?? []));
    setLoading(false);
  }
  useEffect(() => {
    let active = true;
    fetch(endpoints[module])
      .then(async (response) => {
        const data = await response.json().catch(() => []);
        if (!active) return;
        if (!response.ok) setError(data.error ?? "Não foi possível carregar");
        else setRows(Array.isArray(data) ? data : (data.transactions ?? []));
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError("Não foi possível carregar");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [module]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = event.currentTarget;
    const entries = Object.fromEntries(new FormData(form).entries());
    const data: Record<string, string | null> = Object.fromEntries(
      Object.entries(entries).map(([key, value]) => [
        key,
        value === "" ? null : String(value),
      ]),
    );
    const response = await fetch(endpoints[module], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.error ?? "Não foi possível salvar");
    else {
      setMessage("Registro salvo com sucesso.");
      setShowForm(false);
      form.reset();
      void load();
    }
  }
  async function pay(id: string) {
    const response = await fetch(`${endpoints[module]}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        module === "payables"
          ? {
              action: "PAY",
              paymentMethod: "PIX",
              accountId: window.prompt("ID da conta usada no pagamento"),
            }
          : {
              paymentMethod: "PIX",
              accountId: window.prompt("ID da conta usada no pagamento"),
            },
      ),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      setError(result.error ?? "Não foi possível concluir o pagamento");
    else {
      setMessage("Pagamento registrado e saída criada.");
      void load();
    }
  }
  const formFields =
    module === "cash"
      ? fields.cash
      : module === "team"
        ? fields.team
        : fields[module as Exclude<Module, "audit" | "reports">];
  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Financeiro Restaurante</p>
          <h1>{labels[module]}</h1>
        </div>
        <button
          className="primary-button compact"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Fechar" : "Novo registro"}
        </button>
      </header>
      {message && <p className="success-message">{message}</p>}
      {error && <p className="form-error">{error}</p>}
      {showForm && formFields && (
        <form className="admin-form" onSubmit={submit}>
          {formFields.map((field) => (
            <label key={field.name}>
              {field.label}
              {field.type?.startsWith("select:") ? (
                <select name={field.name} required={field.required}>
                  {field.type
                    .slice(7)
                    .split(",")
                    .map((option) => {
                      const [value, text] = option.split(":");
                      return (
                        <option value={value} key={value}>
                          {text}
                        </option>
                      );
                    })}
                </select>
              ) : (
                <input
                  name={field.name}
                  type={field.type ?? "text"}
                  required={field.required}
                  step={field.type === "number" ? "0.01" : undefined}
                />
              )}
            </label>
          ))}
          <button className="primary-button" type="submit">
            Salvar
          </button>
        </form>
      )}
      {module === "reports" ? (
        <section className="data-panel">
          <a className="primary-button compact" href="/api/export">
            Exportar movimentações
          </a>
          <pre>{JSON.stringify(rows, null, 2)}</pre>
        </section>
      ) : (
        <section className="data-panel">
          {loading ? (
            <p className="empty-state">Carregando...</p>
          ) : rows.length === 0 ? (
            <p className="empty-state">Nenhum registro encontrado.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {Object.keys(rows[0])
                      .filter((key) => typeof rows[0][key] !== "object")
                      .slice(0, 7)
                      .map((key) => (
                        <th key={key}>{key}</th>
                      ))}
                    {(module === "payables" || module === "payroll") && (
                      <th>Ação</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={String(row.id)}>
                      {Object.keys(rows[0])
                        .filter((key) => typeof rows[0][key] !== "object")
                        .slice(0, 7)
                        .map((key) => (
                          <td key={key}>{display(row[key])}</td>
                        ))}
                      {(module === "payables" || module === "payroll") &&
                        row.status !== "PAID" && (
                          <td>
                            <button
                              className="table-action"
                              onClick={() => pay(String(row.id))}
                            >
                              Pagar
                            </button>
                          </td>
                        )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
