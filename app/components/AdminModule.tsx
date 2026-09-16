"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import HomeButton from "@/app/components/HomeButton";

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

type Role = "OWNER" | "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER";

type ColumnConfig = {
  key: string;
  label: string;
  kind?: "text" | "money" | "date" | "status" | "enum" | "relation";
  align?: "left" | "right";
};

type SelectOption = { value: string; label: string };

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

const allowedModules: Record<Role, Module[]> = {
  OWNER: ["transactions", "categories", "accounts", "cash", "suppliers", "payables", "employees", "payroll", "inventory", "team", "audit", "reports"],
  ADMIN: ["transactions", "categories", "accounts", "cash", "suppliers", "payables", "employees", "payroll", "inventory", "team", "audit", "reports"],
  MANAGER: ["transactions", "categories", "cash", "suppliers", "payables", "inventory"],
  OPERATOR: ["transactions", "cash", "suppliers", "payables", "inventory"],
  VIEWER: ["transactions", "inventory"],
};

const fields: Record<
  Exclude<Module, "audit" | "reports">,
  { name: string; label: string; type?: string; required?: boolean }[]
> = {
  transactions: [
    { name: "type", label: "Tipo", type: "select:INCOME:Entrada,EXPENSE:Saída", required: true },
    { name: "description", label: "Descrição", required: true },
    { name: "amount", label: "Valor", type: "number", required: true },
    { name: "occurredAt", label: "Data", type: "date" },
    { name: "paymentMethod", label: "Pagamento", type: "select:PIX:Pix,CASH:Dinheiro,DEBIT_CARD:Débito,CREDIT_CARD:Crédito,BANK_TRANSFER:Transferência,BOLETO:Boleto,OTHER:Outro" },
  ],
  categories: [
    { name: "name", label: "Nome", required: true },
    { name: "type", label: "Tipo", type: "select:INCOME:Receita,EXPENSE:Despesa,BOTH:Ambos", required: true },
  ],
  accounts: [
    { name: "name", label: "Nome", required: true },
    { name: "type", label: "Tipo", type: "select:CASH:Dinheiro,BANK:Banco,PIX:Pix,CARD_CLEARING:Cartão,OTHER:Outra", required: true },
    { name: "initialBalance", label: "Saldo inicial", type: "number" },
  ],
  cash: [
    { name: "accountId", label: "Conta", required: true },
    { name: "openingBalance", label: "Valor inicial", type: "number", required: true },
    { name: "notes", label: "Observações" },
  ],
  suppliers: [
    { name: "name", label: "Nome", required: true },
    { name: "document", label: "CPF/CNPJ" },
    { name: "phone", label: "Telefone" },
    { name: "email", label: "E-mail", type: "email" },
  ],
  payables: [
    { name: "description", label: "Descrição", required: true },
    { name: "amount", label: "Valor", type: "number", required: true },
    { name: "dueDate", label: "Vencimento", type: "date", required: true },
    { name: "accountId", label: "Conta" },
    { name: "supplierId", label: "Fornecedor" },
  ],
  employees: [
    { name: "name", label: "Nome", required: true },
    { name: "roleName", label: "Cargo" },
    { name: "monthlySalary", label: "Salário mensal", type: "number" },
    { name: "hiredAt", label: "Admissão", type: "date" },
  ],
  payroll: [
    { name: "employeeId", label: "Funcionário", required: true },
    { name: "referenceMonth", label: "Mês referência", type: "month", required: true },
    { name: "grossAmount", label: "Bruto", type: "number", required: true },
    { name: "deductions", label: "Descontos", type: "number" },
    { name: "dueDate", label: "Vencimento", type: "date", required: true },
  ],
  inventory: [
    { name: "name", label: "Produto", required: true },
    { name: "unit", label: "Unidade" },
    { name: "currentStock", label: "Estoque atual", type: "number" },
    { name: "minimumStock", label: "Estoque mínimo", type: "number" },
    { name: "averageCost", label: "Custo médio", type: "number" },
  ],
  team: [
    { name: "name", label: "Nome", required: true },
    { name: "email", label: "E-mail", type: "email", required: true },
    { name: "password", label: "Senha inicial", type: "password", required: true },
    { name: "role", label: "Papel", type: "select:OPERATOR:Operador,MANAGER:Gerente,ADMIN:Administrador,VIEWER:Visualização" },
  ],
};

const friendlyStatusMap: Record<string, string> = {
  INCOME: "Entrada",
  EXPENSE: "Saída",
  PENDING: "Pendente",
  PAID: "Pago",
  OVERDUE: "Vencido",
  OPEN: "Aberto",
  CLOSED: "Fechado",
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  OWNER: "Administrador",
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  OPERATOR: "Operador",
  VIEWER: "Visualização",
  CASH: "Dinheiro",
  BANK: "Banco",
  PIX: "Pix",
  DEBIT_CARD: "Débito",
  CREDIT_CARD: "Crédito",
  BANK_TRANSFER: "Transferência",
  BOLETO: "Boleto",
  OTHER: "Outro",
  BOTH: "Ambos",
};

const columnConfig: Record<Module, ColumnConfig[]> = {
  transactions: [
    { key: "occurredAt", label: "Data", kind: "date" },
    { key: "type", label: "Tipo", kind: "status" },
    { key: "description", label: "Descrição" },
    { key: "category", label: "Categoria", kind: "relation" },
    { key: "account", label: "Conta", kind: "relation" },
    { key: "paymentMethod", label: "Pagamento", kind: "enum" },
    { key: "creator", label: "Responsável", kind: "relation" },
    { key: "amount", label: "Valor", kind: "money", align: "right" },
  ],
  categories: [
    { key: "name", label: "Categoria" },
    { key: "type", label: "Tipo", kind: "enum" },
    { key: "active", label: "Status", kind: "status" },
  ],
  accounts: [
    { key: "name", label: "Conta" },
    { key: "type", label: "Tipo", kind: "enum" },
    { key: "initialBalance", label: "Saldo inicial", kind: "money", align: "right" },
    { key: "active", label: "Status", kind: "status" },
  ],
  cash: [
    { key: "account", label: "Conta", kind: "relation" },
    { key: "openedAt", label: "Abertura", kind: "date" },
    { key: "status", label: "Status", kind: "status" },
    { key: "openedBy", label: "Aberto por", kind: "relation" },
    { key: "openingBalance", label: "Valor inicial", kind: "money", align: "right" },
  ],
  suppliers: [
    { key: "name", label: "Fornecedor" },
    { key: "document", label: "CPF/CNPJ" },
    { key: "phone", label: "Telefone" },
    { key: "email", label: "E-mail" },
    { key: "active", label: "Status", kind: "status" },
  ],
  payables: [
    { key: "supplier", label: "Fornecedor", kind: "relation" },
    { key: "description", label: "Descrição" },
    { key: "dueDate", label: "Vencimento", kind: "date" },
    { key: "amount", label: "Valor", kind: "money", align: "right" },
    { key: "status", label: "Status", kind: "status" },
  ],
  employees: [
    { key: "name", label: "Nome" },
    { key: "roleName", label: "Cargo" },
    { key: "status", label: "Status", kind: "status" },
    { key: "hiredAt", label: "Admissão", kind: "date" },
    { key: "monthlySalary", label: "Salário", kind: "money", align: "right" },
  ],
  payroll: [
    { key: "employee", label: "Funcionário", kind: "relation" },
    { key: "referenceMonth", label: "Mês" },
    { key: "netAmount", label: "Valor líquido", kind: "money", align: "right" },
    { key: "status", label: "Status", kind: "status" },
    { key: "dueDate", label: "Vencimento", kind: "date" },
  ],
  inventory: [
    { key: "name", label: "Produto" },
    { key: "currentStock", label: "Quantidade", kind: "text" },
    { key: "unit", label: "Unidade" },
    { key: "averageCost", label: "Custo", kind: "money", align: "right" },
    { key: "minimumStock", label: "Mínimo" },
    { key: "status", label: "Status", kind: "status" },
  ],
  team: [
    { key: "name", label: "Nome" },
    { key: "email", label: "E-mail" },
    { key: "role", label: "Função", kind: "status" },
    { key: "active", label: "Status", kind: "status" },
    { key: "lastAccess", label: "Último acesso", kind: "date" },
  ],
  audit: [
    { key: "createdAt", label: "Data", kind: "date" },
    { key: "actor", label: "Usuário", kind: "relation" },
    { key: "action", label: "Ação" },
    { key: "entity", label: "Registro" },
  ],
  reports: [
    { key: "description", label: "Resumo" },
  ],
};

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getNestedValue(row: Record<string, unknown>, key: string) {
  if (key in row && row[key] !== null && row[key] !== undefined) return row[key];

  const nestedMap: Record<string, string[]> = {
    category: ["category", "name"],
    account: ["account", "name"],
    supplier: ["supplier", "name"],
    creator: ["creator", "name"],
    openedBy: ["openedBy", "name"],
    closedBy: ["closedBy", "name"],
    employee: ["employee", "name"],
    actor: ["actor", "name"],
  };

  const path = nestedMap[key];
  if (!path) return undefined;
  const source = row[path[0]] as Record<string, unknown> | undefined;
  if (!source) return undefined;
  return source[path[1]];
}

function translateValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Ativo" : "Inativo";
  if (typeof value === "number") return value.toLocaleString("pt-BR");
  if (typeof value === "string") {
    const normalized = value.trim();
    return friendlyStatusMap[normalized] ?? normalized;
  }
  return String(value);
}

function statusClass(value: unknown) {
  const normalized = String(value ?? "").toUpperCase();
  if (normalized === "INCOME" || normalized === "RECEITA") return "status-badge success";
  if (normalized === "EXPENSE" || normalized === "DESPESA") return "status-badge danger";
  if (normalized === "PAID" || normalized === "PAGO" || normalized === "CLOSED" || normalized === "ABERTO") return "status-badge success";
  if (normalized === "PENDING" || normalized === "PENDENTE" || normalized === "OVERDUE" || normalized === "VENCIDO") return "status-badge warning";
  return "status-badge neutral";
}

function renderCell(value: unknown, kind?: ColumnConfig["kind"]) {
  if (kind === "money") {
    const number = Number(value ?? 0);
    return <span className={number >= 0 ? "money positive" : "money negative"}>{money(number)}</span>;
  }
  if (kind === "date") return <span>{formatDate(value)}</span>;
  if (kind === "status") {
    const label = translateValue(value);
    return <span className={statusClass(value)}>{label}</span>;
  }
  if (kind === "enum") return <span>{translateValue(value)}</span>;
  if (kind === "relation") return <span>{translateValue(value)}</span>;
  if (typeof value === "number") return <span>{value.toLocaleString("pt-BR")}</span>;
  if (typeof value === "string" && value.length > 80) return <span title={value}>{value.slice(0, 80)}...</span>;
  return <span>{translateValue(value)}</span>;
}

export default function AdminModule({ module, role }: { module: Module; role: Role }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [relationshipOptions, setRelationshipOptions] = useState<Record<string, SelectOption[]>>({});
  const [paySelection, setPaySelection] = useState<{ id: string; accountId: string | null }>({ id: "", accountId: null });
  const [cashCloseSelection, setCashCloseSelection] = useState<{ id: string; value: string }>({ id: "", value: "" });
  const [passwordResetSelection, setPasswordResetSelection] = useState<{ userId: string; password: string }>({ userId: "", password: "" });

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

  useEffect(() => {
    const relevantFields = ["accountId", "supplierId", "categoryId", "employeeId", "userId", "inventoryItemId", "cashSessionId"];
    type LookupRow = Record<string, unknown> & {
      user?: Record<string, unknown>;
      account?: Record<string, unknown>;
      name?: string;
      id?: string;
      type?: string;
      roleName?: string;
      unit?: string;
      email?: string;
      openedAt?: string | Date;
    };

    const lookups: Record<string, { endpoint: string; map: (row: LookupRow) => SelectOption }> = {
      accountId: {
        endpoint: "/api/accounts",
        map: (row) => ({ value: String(row.id ?? ""), label: `${String(row.name ?? "Conta")} • ${String(row.type ?? "")}` }),
      },
      supplierId: {
        endpoint: "/api/suppliers",
        map: (row) => ({ value: String(row.id ?? ""), label: String(row.name ?? "Fornecedor") }),
      },
      categoryId: {
        endpoint: "/api/categories",
        map: (row) => ({ value: String(row.id ?? ""), label: `${String(row.name ?? "Categoria")} • ${String(row.type ?? "")}` }),
      },
      employeeId: {
        endpoint: "/api/employees",
        map: (row) => ({ value: String(row.id ?? ""), label: `${String(row.name ?? "Funcionário")} • ${String(row.roleName ?? "Cargo")}` }),
      },
      userId: {
        endpoint: "/api/team",
        map: (row) => {
          const user = (row.user ?? row) as Record<string, unknown>;
          return {
            value: String(user.id ?? row.id ?? ""),
            label: `${String(user.name ?? row.name ?? "Usuário")} • ${String(user.email ?? row.email ?? "")}`,
          };
        },
      },
      inventoryItemId: {
        endpoint: "/api/inventory",
        map: (row) => ({ value: String(row.id ?? ""), label: `${String(row.name ?? "Produto")} • ${String(row.unit ?? "")}` }),
      },
      cashSessionId: {
        endpoint: "/api/cash-sessions",
        map: (row) => {
          const account = (row.account ?? {}) as Record<string, unknown>;
          return { value: String(row.id ?? ""), label: `${String(account.name ?? "Caixa")} • ${String(row.openedAt ? formatDate(row.openedAt) : "")}` };
        },
      },
    };

    if (!showForm) return;

    const load = async () => {
      const nextOptions: Record<string, SelectOption[]> = {};
      for (const fieldName of relevantFields) {
        const lookup = lookups[fieldName];
        if (!lookup) continue;
        try {
          const response = await fetch(lookup.endpoint);
          const data = await response.json().catch(() => []);
          const rowsList = Array.isArray(data) ? data : Object.values(data ?? {});
          nextOptions[fieldName] = rowsList.map((row) => lookup.map(row as Record<string, unknown>));
        } catch {
          nextOptions[fieldName] = [];
        }
      }
      setRelationshipOptions(nextOptions);
    };

    void load();
  }, [showForm]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = event.currentTarget;
    const entries = Object.fromEntries(new FormData(form).entries());
    const data: Record<string, string | null> = Object.fromEntries(
      Object.entries(entries).map(([key, value]) => [key, value === "" ? null : String(value)]),
    );

    const normalizedData = module === "payroll" && typeof data.referenceMonth === "string" && data.referenceMonth.trim()
      ? { ...data, referenceMonth: data.referenceMonth }
      : data;

    const response = await fetch(endpoints[module], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalizedData),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(typeof result.error === "string" ? result.error.replace(/\n/g, " ") : "Não foi possível salvar");
    else {
      setMessage("Registro salvo com sucesso.");
      setShowForm(false);
      form.reset();
      void load();
    }
  }

  async function pay(id: string) {
    setPaySelection({ id, accountId: null });
  }

  async function confirmPay() {
    if (!paySelection.id || !paySelection.accountId) {
      setError("Selecione uma conta para registrar o pagamento.");
      return;
    }

    const response = await fetch(`${endpoints[module]}/${paySelection.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        module === "payables"
          ? { action: "PAY", paymentMethod: "PIX", accountId: paySelection.accountId }
          : { paymentMethod: "PIX", accountId: paySelection.accountId },
      ),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.error ?? "Não foi possível concluir o pagamento");
    else {
      setMessage("Pagamento registrado com sucesso.");
      setPaySelection({ id: "", accountId: null });
      void load();
    }
  }

  async function closeCash(id: string) {
    setCashCloseSelection({ id, value: "" });
  }

  async function confirmCloseCash() {
    if (!cashCloseSelection.id || !cashCloseSelection.value.trim()) {
      setError("Informe o valor contado no fechamento para continuar.");
      return;
    }

    const response = await fetch(`/api/cash-sessions/${cashCloseSelection.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closingCounted: cashCloseSelection.value }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.error ?? "Não foi possível fechar o caixa");
    else {
      setMessage(`Caixa fechado. Diferença: ${money(Number(result.difference ?? 0))}`);
      setCashCloseSelection({ id: "", value: "" });
      void load();
    }
  }

  async function updateTeam(userId: string, action: "resetPassword" | "toggle") {
    if (action === "toggle") {
      const response = await fetch("/api/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, active: !rows.some((row) => String(row.userId ?? row.id) === userId && row.active === false) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) setError(result.error ?? "Não foi possível atualizar o usuário");
      else {
        setMessage("Equipe atualizada com sucesso.");
        void load();
      }
      return;
    }

    setPasswordResetSelection({ userId, password: "" });
  }

  async function confirmPasswordReset() {
    if (!passwordResetSelection.userId || passwordResetSelection.password.trim().length < 8) {
      setError("Informe uma nova senha com no mínimo 8 caracteres.");
      return;
    }

    const response = await fetch("/api/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: passwordResetSelection.userId, resetPassword: passwordResetSelection.password }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.error ?? "Não foi possível atualizar o usuário");
    else {
      setMessage("Senha redefinida com sucesso.");
      setPasswordResetSelection({ userId: "", password: "" });
      void load();
    }
  }

  const formFields =
    module === "cash"
      ? fields.cash
      : module === "team"
        ? fields.team
        : fields[module as Exclude<Module, "audit" | "reports">];

  const selectedColumns = useMemo(() => columnConfig[module] ?? [], [module]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const term = search.toLowerCase();
    return rows.filter((row) =>
      selectedColumns.some((column) => {
        const value = getNestedValue(row, column.key) ?? row[column.key];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(term) || String(value).toLowerCase().includes(term);
      }),
    );
  }, [rows, search, selectedColumns]);

  if (!allowedModules[role].includes(module)) {
    return (
      <main className="admin-page">
        <p className="form-error">Você não possui permissão para acessar este módulo.</p>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Financeiro Restaurante</p>
          <h1>{labels[module]}</h1>
        </div>
        <div className="admin-header-actions">
          <HomeButton />
          <button type="button" className="primary-button compact" onClick={() => setShowForm((value) => !value)}>
            {showForm ? "Fechar" : "Novo registro"}
          </button>
        </div>
      </header>

      {message && <p className="success-message">{message}</p>}
      {error && <p className="form-error">{error}</p>}

      {showForm && formFields && (
        <form className="admin-form" onSubmit={submit}>
          {formFields.map((field) => {
            const selectOptions = relationshipOptions[field.name] ?? [];
            const isRelationshipField = /Id$/.test(field.name) || field.name === "userId" || field.name === "transactionId" || field.name === "inventoryItemId";

            return (
              <label key={field.name}>
                {field.label}
                {field.type?.startsWith("select:") ? (
                  <select name={field.name} required={field.required} defaultValue="">
                    <option value="" disabled>
                      Selecione
                    </option>
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
                ) : isRelationshipField ? (
                  <select name={field.name} required={field.required} defaultValue="">
                    <option value="" disabled>
                      Selecione {field.label.toLowerCase()}
                    </option>
                    {selectOptions.length === 0 ? (
                      <option value="" disabled>
                        Nenhum registro disponível
                      </option>
                    ) : (
                      selectOptions.map((option) => (
                        <option value={option.value} key={option.value}>
                          {option.label}
                        </option>
                      ))
                    )}
                  </select>
                ) : (
                  <input
                    name={field.name}
                    type={field.type ?? "text"}
                    required={field.required}
                    step={field.type === "number" ? "0.01" : undefined}
                    placeholder={field.type === "number" ? "R$ 0,00" : undefined}
                  />
                )}
              </label>
            );
          })}
          <button className="primary-button" type="submit">
            Salvar
          </button>
        </form>
      )}

      {paySelection.id && (
        <div className="payment-picker">
          <div className="payment-picker-inner">
            <h3>Selecionar conta do pagamento</h3>
            <label>
              Conta
              <select
                value={paySelection.accountId ?? ""}
                onChange={(event) => setPaySelection((current) => ({ ...current, accountId: event.target.value || null }))}
              >
                <option value="">Selecione a conta</option>
                {(relationshipOptions.accountId ?? []).map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="payment-actions">
              <button type="button" className="primary-button compact" onClick={confirmPay} disabled={!paySelection.accountId}>
                Confirmar pagamento
              </button>
              <button type="button" className="table-action" onClick={() => setPaySelection({ id: "", accountId: null })}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {cashCloseSelection.id && (
        <div className="payment-picker">
          <div className="payment-picker-inner">
            <h3>Fechamento do caixa</h3>
            <label>
              Valor contado
              <input
                type="number"
                min="0"
                step="0.01"
                value={cashCloseSelection.value}
                onChange={(event) => setCashCloseSelection((current) => ({ ...current, value: event.target.value }))}
                placeholder="R$ 0,00"
              />
            </label>
            <div className="payment-actions">
              <button type="button" className="primary-button compact" onClick={confirmCloseCash} disabled={!cashCloseSelection.value.trim()}>
                Confirmar fechamento
              </button>
              <button type="button" className="table-action" onClick={() => setCashCloseSelection({ id: "", value: "" })}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {passwordResetSelection.userId && (
        <div className="payment-picker">
          <div className="payment-picker-inner">
            <h3>Redefinir senha</h3>
            <label>
              Nova senha
              <input
                type="password"
                value={passwordResetSelection.password}
                onChange={(event) => setPasswordResetSelection((current) => ({ ...current, password: event.target.value }))}
                placeholder="Mínimo 8 caracteres"
              />
            </label>
            <div className="payment-actions">
              <button type="button" className="primary-button compact" onClick={confirmPasswordReset} disabled={passwordResetSelection.password.length < 8}>
                Salvar nova senha
              </button>
              <button type="button" className="table-action" onClick={() => setPasswordResetSelection({ userId: "", password: "" })}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {module === "reports" ? (
        <section className="data-panel">
          <div className="toolbar">
            <a className="primary-button compact" href="/api/export">
              Exportar movimentações
            </a>
          </div>
          <pre>{JSON.stringify(rows, null, 2)}</pre>
        </section>
      ) : (
        <section className="data-panel">
          <div className="toolbar">
            <div className="search-box">
              <input
                aria-label="Buscar registros"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome, categoria, status..."
              />
            </div>
          </div>

          {loading ? (
            <p className="empty-state">Carregando registros...</p>
          ) : filteredRows.length === 0 ? (
            <div className="empty-state-card">
              <h3>Não há registros para mostrar.</h3>
              <p>Não encontramos itens neste módulo no momento.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {selectedColumns.map((column) => (
                      <th key={column.key}>{column.label}</th>
                    ))}
                    {(module === "payables" || module === "payroll" || module === "cash" || module === "team") && <th>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, index) => {
                    const rowKey = String(row.id ?? row.name ?? `${module}-${index}`);
                    return (
                      <tr key={rowKey}>
                        {selectedColumns.map((column) => {
                          const value = getNestedValue(row, column.key) ?? row[column.key];
                          return <td key={`${rowKey}-${column.key}`}>{renderCell(value, column.kind)}</td>;
                        })}

                        {module === "cash" && (
                          <td className="actions-cell">
                            <button type="button" className="table-action" onClick={() => closeCash(String(row.id))}>Fechar caixa</button>
                            <a className="table-action" href={`/cash/${String(row.id)}`}>
                              Ver detalhes
                            </a>
                          </td>
                        )}

                        {module === "team" && (
                          <td className="actions-cell">
                            <button type="button" className="table-action" onClick={() => updateTeam(String(row.userId ?? row.id), "resetPassword")}>Redefinir senha</button>
                            <button type="button" className="table-action" onClick={() => updateTeam(String(row.userId ?? row.id), "toggle")}>Alterar acesso</button>
                          </td>
                        )}

                        {(module === "payables" || module === "payroll") && row.status !== "PAID" && (
                          <td className="actions-cell">
                            <button type="button" className="table-action" onClick={() => pay(String(row.id))}>Pagar</button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
