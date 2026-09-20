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
  OWNER: [
    "transactions",
    "categories",
    "accounts",
    "cash",
    "suppliers",
    "payables",
    "employees",
    "payroll",
    "inventory",
    "team",
    "audit",
    "reports",
  ],
  ADMIN: [
    "transactions",
    "categories",
    "accounts",
    "cash",
    "suppliers",
    "payables",
    "employees",
    "payroll",
    "inventory",
    "team",
    "audit",
    "reports",
  ],
  MANAGER: [
    "transactions",
    "categories",
    "cash",
    "suppliers",
    "payables",
    "inventory",
  ],
  OPERATOR: ["transactions", "cash", "suppliers", "payables", "inventory"],
  VIEWER: ["transactions", "inventory"],
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
    { name: "categoryId", label: "Categoria" },
    { name: "accountId", label: "Conta" },
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
    { name: "accountId", label: "Conta", required: true },
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
    { name: "document", label: "CPF/CNPJ" },
    { name: "phone", label: "Telefone" },
    { name: "email", label: "E-mail", type: "email" },
  ],
  payables: [
    { name: "description", label: "Descrição", required: true },
    { name: "amount", label: "Valor", type: "number", required: true },
    { name: "dueDate", label: "Vencimento", type: "date", required: true },
    { name: "categoryId", label: "Categoria" },
    { name: "accountId", label: "Conta" },
    { name: "supplierId", label: "Fornecedor" },
  ],
  employees: [
    { name: "name", label: "Nome", required: true },
    { name: "roleName", label: "Cargo" },
    { name: "document", label: "CPF/CNPJ" },
    { name: "monthlySalary", label: "Salário mensal", type: "number" },
    { name: "hiredAt", label: "Admissão", type: "date" },
    { name: "status", label: "Status", type: "select:ACTIVE:Ativo,INACTIVE:Inativo" },
  ],
  payroll: [
    { name: "employeeId", label: "Funcionário", required: true },
    {
      name: "referenceMonth",
      label: "Mês referência",
      type: "month",
      required: true,
    },
    { name: "grossAmount", label: "Bruto", type: "number", required: true },
    { name: "deductions", label: "Descontos", type: "number" },
    { name: "dueDate", label: "Vencimento", type: "date", required: true },
  ],
  inventory: [
    { name: "name", label: "Produto", required: true },
    {
      name: "unit",
      label: "Tamanho",
      type: "select:PP:PP,P:P,M:M,G:G,GG:GG,XGG:XGG,2XGG:2XGG",
      required: true,
    },
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
      type: "select:OPERATOR:Operador,MANAGER:Gerente,ADMIN:Administrador,VIEWER:Visualização",
    },
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
  NORMAL: "Estoque normal",
  LOW: "Estoque baixo",
  OUT_OF_STOCK: "Sem estoque",
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
    {
      key: "initialBalance",
      label: "Saldo inicial",
      kind: "money",
      align: "right",
    },
    { key: "active", label: "Status", kind: "status" },
  ],
  cash: [
    { key: "account", label: "Conta", kind: "relation" },
    { key: "openedAt", label: "Abertura", kind: "date" },
    { key: "status", label: "Status", kind: "status" },
    { key: "openedBy", label: "Aberto por", kind: "relation" },
    {
      key: "openingBalance",
      label: "Valor inicial",
      kind: "money",
      align: "right",
    },
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
    { key: "currentStock", label: "Estoque atual", kind: "text" },
    { key: "averageCost", label: "Custo", kind: "money", align: "right" },
    { key: "minimumStock", label: "Estoque mínimo", kind: "text" },
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
  reports: [{ key: "description", label: "Resumo" }],
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

function formatQuantity(value: unknown, unit: string, sign = "") {
  return (
    <span className="inventory-quantity">
      <strong>
        {sign}
        {Number(value ?? 0).toLocaleString("pt-BR")}
      </strong>
      <small>{unit}</small>
    </span>
  );
}

function requiresWholeQuantity(unit: string) {
  return ["un", "cx", "pct", "fd", "dz"].includes(unit);
}

function getNestedValue(row: Record<string, unknown>, key: string) {
  if (key in row && row[key] !== null && row[key] !== undefined)
    return row[key];

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
  if (normalized === "INCOME" || normalized === "RECEITA")
    return "status-badge success";
  if (normalized === "EXPENSE" || normalized === "DESPESA")
    return "status-badge danger";
  if (
    normalized === "PAID" ||
    normalized === "PAGO" ||
    normalized === "CLOSED" ||
    normalized === "ABERTO"
  )
    return "status-badge success";
  if (
    normalized === "PENDING" ||
    normalized === "PENDENTE" ||
    normalized === "OVERDUE" ||
    normalized === "VENCIDO"
  )
    return "status-badge warning";
  if (normalized === "OUT_OF_STOCK") return "status-badge danger";
  if (normalized === "LOW") return "status-badge warning";
  if (normalized === "NORMAL") return "status-badge success";
  return "status-badge neutral";
}

function renderCell(value: unknown, kind?: ColumnConfig["kind"]) {
  if (kind === "money") {
    const number = Number(value ?? 0);
    return (
      <span className={number >= 0 ? "money positive" : "money negative"}>
        {money(number)}
      </span>
    );
  }
  if (kind === "date") return <span>{formatDate(value)}</span>;
  if (kind === "status") {
    const label = translateValue(value);
    return <span className={statusClass(value)}>{label}</span>;
  }
  if (kind === "enum") return <span>{translateValue(value)}</span>;
  if (kind === "relation") return <span>{translateValue(value)}</span>;
  if (typeof value === "number")
    return <span>{value.toLocaleString("pt-BR")}</span>;
  if (typeof value === "string" && value.length > 80)
    return <span title={value}>{value.slice(0, 80)}...</span>;
  return <span>{translateValue(value)}</span>;
}

function canEditModule(module: Module, role: Role) {
  if (module === "accounts" || module === "employees" || module === "inventory") return role === "OWNER" || role === "ADMIN";
  if (module === "payroll") return role === "OWNER" || role === "ADMIN";
  if (module === "categories" || module === "transactions" || module === "payables") return role === "OWNER" || role === "ADMIN" || role === "MANAGER";
  return module === "suppliers" && role !== "VIEWER";
}

function canDeleteModule(module: Module, role: Role) {
  if (module === "accounts" || module === "employees" || module === "inventory") return role === "OWNER" || role === "ADMIN";
  if (module === "payroll") return role === "OWNER" || role === "ADMIN";
  return (module === "categories" || module === "transactions" || module === "payables" || module === "suppliers") && (role === "OWNER" || role === "ADMIN" || role === "MANAGER");
}

export default function AdminModule({
  module,
  role,
}: {
  module: Module;
  role: Role;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [relationshipOptions, setRelationshipOptions] = useState<
    Record<string, SelectOption[]>
  >({});
  const [paySelection, setPaySelection] = useState<{
    id: string;
    accountId: string | null;
  }>({ id: "", accountId: null });
  const [cashCloseSelection, setCashCloseSelection] = useState<{
    id: string;
    value: string;
  }>({ id: "", value: "" });
  const [passwordResetSelection, setPasswordResetSelection] = useState<{
    userId: string;
    password: string;
  }>({ userId: "", password: "" });
  const [inventoryMovements, setInventoryMovements] = useState<
    Record<string, unknown>[]
  >([]);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [movementForm, setMovementForm] = useState({
    itemId: "",
    type: "IN",
    quantity: "",
    reason: "",
  });
  const [movementLoading, setMovementLoading] = useState(false);
  const [editingMovement, setEditingMovement] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [editingInventoryItem, setEditingInventoryItem] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);

  async function loadInventoryMovements() {
    const response = await fetch("/api/inventory/movements");
    const data = await response.json().catch(() => []);
    if (response.ok && Array.isArray(data)) setInventoryMovements(data);
  }

  async function load() {
    setLoading(true);
    const response = await fetch(endpoints[module]);
    const data = await response.json().catch(() => []);
    if (!response.ok) setError(data.error ?? "Não foi possível carregar");
    else setRows(Array.isArray(data) ? data : (data.transactions ?? []));
    setLoading(false);
    if (module === "inventory") void loadInventoryMovements();
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
        if (module === "inventory") void loadInventoryMovements();
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
    const relevantFields = [
      "accountId",
      "supplierId",
      "categoryId",
      "employeeId",
      "userId",
      "inventoryItemId",
      "cashSessionId",
    ];
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

    const lookups: Record<
      string,
      { endpoint: string; map: (row: LookupRow) => SelectOption }
    > = {
      accountId: {
        endpoint: "/api/accounts",
        map: (row) => ({
          value: String(row.id ?? ""),
          label: `${String(row.name ?? "Conta")} • ${String(row.type ?? "")}`,
        }),
      },
      supplierId: {
        endpoint: "/api/suppliers",
        map: (row) => ({
          value: String(row.id ?? ""),
          label: String(row.name ?? "Fornecedor"),
        }),
      },
      categoryId: {
        endpoint: "/api/categories",
        map: (row) => ({
          value: String(row.id ?? ""),
          label: `${String(row.name ?? "Categoria")} • ${String(row.type ?? "")}`,
        }),
      },
      employeeId: {
        endpoint: "/api/employees",
        map: (row) => ({
          value: String(row.id ?? ""),
          label: `${String(row.name ?? "Funcionário")} • ${String(row.roleName ?? "Cargo")}`,
        }),
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
        map: (row) => ({
          value: String(row.id ?? ""),
          label: `${String(row.name ?? "Produto")} • ${String(row.unit ?? "")}`,
        }),
      },
      cashSessionId: {
        endpoint: "/api/cash-sessions",
        map: (row) => {
          const account = (row.account ?? {}) as Record<string, unknown>;
          return {
            value: String(row.id ?? ""),
            label: `${String(account.name ?? "Caixa")} • ${String(row.openedAt ? formatDate(row.openedAt) : "")}`,
          };
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
          const rowsList = Array.isArray(data)
            ? data
            : Object.values(data ?? {});
          nextOptions[fieldName] = rowsList.map((row) =>
            lookup.map(row as Record<string, unknown>),
          );
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
      Object.entries(entries).map(([key, value]) => [
        key,
        value === "" ? null : String(value),
      ]),
    );

    const normalizedData =
      module === "payroll" &&
      typeof data.referenceMonth === "string" &&
      data.referenceMonth.trim()
        ? { ...data, referenceMonth: data.referenceMonth }
        : data;

    const currentEdit = module === "inventory" ? editingInventoryItem : editingRow;
    const response = await fetch(
      currentEdit ? `${endpoints[module]}/${String(currentEdit.id)}` : endpoints[module],
      {
        method: currentEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizedData),
      },
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      setError(
        typeof result.error === "string"
          ? result.error.replace(/\n/g, " ")
          : "Não foi possível salvar",
      );
    else {
      setMessage(
        currentEdit ? "Registro atualizado com sucesso." : "Registro salvo com sucesso.",
      );
      setShowForm(false);
      setEditingInventoryItem(null);
      setEditingRow(null);
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
          ? {
              action: "PAY",
              paymentMethod: "PIX",
              accountId: paySelection.accountId,
            }
          : { paymentMethod: "PIX", accountId: paySelection.accountId },
      ),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      setError(result.error ?? "Não foi possível concluir o pagamento");
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

    const response = await fetch(
      `/api/cash-sessions/${cashCloseSelection.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closingCounted: cashCloseSelection.value }),
      },
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      setError(result.error ?? "Não foi possível fechar o caixa");
    else {
      setMessage(
        `Caixa fechado. Diferença: ${money(Number(result.difference ?? 0))}`,
      );
      setCashCloseSelection({ id: "", value: "" });
      void load();
    }
  }

  async function updateTeam(
    userId: string,
    action: "resetPassword" | "toggle",
  ) {
    if (action === "toggle") {
      const response = await fetch("/api/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          active: !rows.some(
            (row) =>
              String(row.userId ?? row.id) === userId && row.active === false,
          ),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        setError(result.error ?? "Não foi possível atualizar o usuário");
      else {
        setMessage("Equipe atualizada com sucesso.");
        void load();
      }
      return;
    }

    setPasswordResetSelection({ userId, password: "" });
  }

  async function confirmPasswordReset() {
    if (
      !passwordResetSelection.userId ||
      passwordResetSelection.password.trim().length < 8
    ) {
      setError("Informe uma nova senha com no mínimo 8 caracteres.");
      return;
    }

    const response = await fetch("/api/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: passwordResetSelection.userId,
        resetPassword: passwordResetSelection.password,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      setError(result.error ?? "Não foi possível atualizar o usuário");
    else {
      setMessage("Senha redefinida com sucesso.");
      setPasswordResetSelection({ userId: "", password: "" });
      void load();
    }
  }

  const selectedInventoryItem = rows.find(
    (row) => String(row.id) === movementForm.itemId,
  );
  const movementQuantity = Number(movementForm.quantity);
  const selectedStock = Number(selectedInventoryItem?.currentStock ?? 0);
  const previewStock =
    movementForm.type === "IN"
      ? selectedStock + movementQuantity
      : selectedStock - movementQuantity;
  const movementIsValid =
    Boolean(selectedInventoryItem) &&
    Number.isFinite(movementQuantity) &&
    movementQuantity > 0 &&
    movementForm.reason.trim().length > 0 &&
    (!requiresWholeQuantity(String(selectedInventoryItem?.unit ?? "un")) ||
      Number.isInteger(movementQuantity)) &&
    (movementForm.type === "IN" || movementQuantity <= selectedStock);

  async function confirmMovement() {
    if (!movementIsValid) {
      setError(
        movementForm.type === "OUT" && movementQuantity > selectedStock
          ? "Estoque insuficiente para esta saída."
          : "Informe produto, quantidade positiva e motivo.",
      );
      return;
    }

    setMovementLoading(true);
    setError("");
    const response = await fetch(
      editingMovement
        ? `/api/inventory/movements/${String(editingMovement.id)}`
        : "/api/inventory/movements",
      {
        method: editingMovement ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: movementForm.itemId,
          type: movementForm.type,
          quantity: movementQuantity,
          reason: movementForm.reason.trim(),
        }),
      },
    );
    const result = await response.json().catch(() => ({}));
    setMovementLoading(false);

    if (!response.ok) {
      setError(
        result.error === "Estoque insuficiente"
          ? "Estoque insuficiente para esta saída."
          : (result.error ?? "Não foi possível registrar a movimentação."),
      );
      return;
    }

    setMessage(
      editingMovement
        ? "Movimentação atualizada com sucesso."
        : `${movementForm.type === "IN" ? "Entrada" : "Saída"} registrada com sucesso.`,
    );
    setMovementForm({ itemId: "", type: "IN", quantity: "", reason: "" });
    setEditingMovement(null);
    setShowMovementForm(false);
    await Promise.all([load(), loadInventoryMovements()]);
  }

  function editMovement(movement: Record<string, unknown>) {
    if (role !== "OWNER" && role !== "ADMIN") return;
    setEditingMovement(movement);
    setMovementForm({
      itemId: String(movement.itemId ?? ""),
      type: String(movement.type ?? "IN"),
      quantity: String(movement.quantity ?? ""),
      reason: String(movement.reason ?? ""),
    });
    setShowMovementForm(true);
  }

  async function deleteMovement(movement: Record<string, unknown>) {
    if (role !== "OWNER" && role !== "ADMIN") return;
    if (!window.confirm("Tem certeza que deseja excluir esta movimentação?"))
      return;
    setError("");
    const response = await fetch(
      `/api/inventory/movements/${String(movement.id)}`,
      {
        method: "DELETE",
      },
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error ?? "Não foi possível excluir a movimentação.");
      return;
    }
    setMessage("Movimentação excluída com sucesso.");
    await Promise.all([load(), loadInventoryMovements()]);
  }

  function editInventoryItem(item: Record<string, unknown>) {
    if (role !== "OWNER" && role !== "ADMIN") return;
    setEditingInventoryItem(item);
    setShowForm(true);
  }

  function editRow(row: Record<string, unknown>) {
    if (!canEditModule(module, role)) return;
    if (module === "inventory") return editInventoryItem(row);
    setEditingRow(row);
    setShowForm(true);
  }

  async function deleteRow(row: Record<string, unknown>) {
    if (!canDeleteModule(module, role)) return;
    if (!window.confirm("Tem certeza que deseja excluir este registro?")) return;
    setError("");
    const response = await fetch(`${endpoints[module]}/${String(row.id)}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error ?? "Não foi possível excluir este registro.");
      return;
    }
    setMessage("Registro excluído com sucesso.");
    await load();
  }

  async function deleteInventoryItem(item: Record<string, unknown>) {
    if (role !== "OWNER" && role !== "ADMIN") return;
    if (!window.confirm("Tem certeza que deseja excluir este produto?")) return;
    const response = await fetch(`/api/inventory/${String(item.id)}`, {
      method: "DELETE",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error ?? "Não foi possível excluir o produto.");
      return;
    }
    setMessage("Produto excluído com sucesso.");
    await load();
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
        return (
          String(value).toLowerCase().includes(term) ||
          String(value).toLowerCase().includes(term)
        );
      }),
    );
  }, [rows, search, selectedColumns]);

  if (!allowedModules[role].includes(module)) {
    return (
      <main className="admin-page">
        <p className="form-error">
          Você não possui permissão para acessar este módulo.
        </p>
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
          {module === "inventory" && (
            <button
              type="button"
              className="primary-button compact"
              onClick={() => setShowMovementForm(true)}
            >
              Movimentar estoque
            </button>
          )}
          <button
            type="button"
            className="primary-button compact"
            onClick={() => setShowForm((value) => !value)}
          >
            {showForm ? "Fechar" : "Novo registro"}
          </button>
        </div>
      </header>

      {message && <p className="success-message">{message}</p>}
      {error && <p className="form-error">{error}</p>}

      {module === "inventory" && showMovementForm && (
        <div
          className="movement-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="movement-title"
        >
          <div className="movement-modal-content">
            <div className="section-heading">
              <div>
                <p className="panel-kicker">Estoque</p>
                <h2 id="movement-title">
                  {editingMovement
                    ? "Editar movimentação"
                    : "Movimentar estoque"}
                </h2>
              </div>
              <button
                type="button"
                className="table-action"
                onClick={() => {
                  setShowMovementForm(false);
                  setEditingMovement(null);
                }}
              >
                Fechar
              </button>
            </div>

            <label>
              Produto
              <select
                value={movementForm.itemId}
                onChange={(event) =>
                  setMovementForm((current) => ({
                    ...current,
                    itemId: event.target.value,
                  }))
                }
              >
                <option value="">Selecione o produto</option>
                {rows.map((row) => (
                  <option value={String(row.id)} key={String(row.id)}>
                    {String(row.name)} • Estoque:{" "}
                    {Number(row.currentStock ?? 0).toLocaleString("pt-BR")}{" "}
                    {String(row.unit ?? "un")}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Tipo
              <select
                value={movementForm.type}
                onChange={(event) =>
                  setMovementForm((current) => ({
                    ...current,
                    type: event.target.value,
                  }))
                }
              >
                <option value="IN">Entrada</option>
                <option value="OUT">Saída</option>
              </select>
            </label>

            <label>
              Quantidade ({String(selectedInventoryItem?.unit ?? "un")})
              <input
                type="number"
                min={
                  requiresWholeQuantity(
                    String(selectedInventoryItem?.unit ?? "un"),
                  )
                    ? "1"
                    : "0.001"
                }
                step={
                  requiresWholeQuantity(
                    String(selectedInventoryItem?.unit ?? "un"),
                  )
                    ? "1"
                    : "0.001"
                }
                value={movementForm.quantity}
                onChange={(event) =>
                  setMovementForm((current) => ({
                    ...current,
                    quantity: event.target.value,
                  }))
                }
                placeholder="0"
              />
            </label>

            <label>
              Motivo
              <input
                value={movementForm.reason}
                onChange={(event) =>
                  setMovementForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
                placeholder="Informe o motivo"
                maxLength={500}
              />
            </label>

            {selectedInventoryItem &&
              movementForm.quantity &&
              Number.isFinite(movementQuantity) &&
              movementQuantity > 0 && (
                <div
                  className={`movement-preview ${
                    movementForm.type === "OUT" &&
                    movementQuantity > selectedStock
                      ? "movement-preview-error"
                      : ""
                  }`}
                >
                  <span>
                    Estoque atual:{" "}
                    <strong>
                      {selectedStock.toLocaleString("pt-BR")}{" "}
                      {String(selectedInventoryItem.unit ?? "un")}
                    </strong>
                  </span>
                  <span>
                    {movementForm.type === "IN" ? "Entrada" : "Saída"}:{" "}
                    <strong>
                      {movementForm.type === "IN" ? "+" : "-"}
                      {movementQuantity.toLocaleString("pt-BR")}{" "}
                      {String(selectedInventoryItem.unit ?? "un")}
                    </strong>
                  </span>
                  <span>
                    Novo estoque:{" "}
                    <strong>
                      {previewStock.toLocaleString("pt-BR")}{" "}
                      {String(selectedInventoryItem.unit ?? "un")}
                    </strong>
                  </span>
                </div>
              )}

            <div className="payment-actions">
              <button
                type="button"
                className="table-action"
                onClick={() => {
                  setShowMovementForm(false);
                  setEditingMovement(null);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button compact"
                onClick={confirmMovement}
                disabled={!movementIsValid || movementLoading}
              >
                {movementLoading ? "Registrando..." : "Confirmar movimentação"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && formFields && (
        <form className="admin-form" onSubmit={submit}>
          {formFields.map((field) => {
            const selectOptions = relationshipOptions[field.name] ?? [];
            const isRelationshipField =
              /Id$/.test(field.name) ||
              field.name === "userId" ||
              field.name === "transactionId" ||
              field.name === "inventoryItemId";
            const editingValue = (module === "inventory" ? editingInventoryItem : editingRow)?.[field.name];

            return (
              <label key={field.name}>
                {field.label}
                {field.type?.startsWith("select:") ? (
                  <select
                    name={field.name}
                    required={field.required}
                    defaultValue={String(editingValue ?? "")}
                  >
                    <option value="" disabled>
                      Selecione
                    </option>
                    {field.name === "unit" &&
                      editingValue !== null &&
                      editingValue !== undefined &&
                      !["PP", "P", "M", "G", "GG", "XGG", "2XGG"].includes(
                        String(editingValue),
                      ) && (
                        <option value={String(editingValue)} hidden>
                          {String(editingValue)}
                        </option>
                      )}
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
                  <select
                    name={field.name}
                    required={field.required}
                    defaultValue=""
                  >
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
                    defaultValue={
                      editingValue === null || editingValue === undefined
                        ? ""
                        : String(editingValue)
                    }
                    step={field.type === "number" ? "0.01" : undefined}
                    placeholder={
                      field.type === "number" ? "R$ 0,00" : undefined
                    }
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
                onChange={(event) =>
                  setPaySelection((current) => ({
                    ...current,
                    accountId: event.target.value || null,
                  }))
                }
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
              <button
                type="button"
                className="primary-button compact"
                onClick={confirmPay}
                disabled={!paySelection.accountId}
              >
                Confirmar pagamento
              </button>
              <button
                type="button"
                className="table-action"
                onClick={() => setPaySelection({ id: "", accountId: null })}
              >
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
                onChange={(event) =>
                  setCashCloseSelection((current) => ({
                    ...current,
                    value: event.target.value,
                  }))
                }
                placeholder="R$ 0,00"
              />
            </label>
            <div className="payment-actions">
              <button
                type="button"
                className="primary-button compact"
                onClick={confirmCloseCash}
                disabled={!cashCloseSelection.value.trim()}
              >
                Confirmar fechamento
              </button>
              <button
                type="button"
                className="table-action"
                onClick={() => setCashCloseSelection({ id: "", value: "" })}
              >
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
                onChange={(event) =>
                  setPasswordResetSelection((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="Mínimo 8 caracteres"
              />
            </label>
            <div className="payment-actions">
              <button
                type="button"
                className="primary-button compact"
                onClick={confirmPasswordReset}
                disabled={passwordResetSelection.password.length < 8}
              >
                Salvar nova senha
              </button>
              <button
                type="button"
                className="table-action"
                onClick={() =>
                  setPasswordResetSelection({ userId: "", password: "" })
                }
              >
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
          {rows.length === 0 ? (
            <p className="empty-state">Nenhuma movimentação encontrada.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Conta</th>
                    <th>Pagamento</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={String(row.id ?? `report-${index}`)}>
                      <td>{formatDate(row.occurredAt)}</td>
                      <td>{renderCell(row.type, "status")}</td>
                      <td>{String(row.description ?? "-")}</td>
                      <td>
                        {renderCell(
                          getNestedValue(row, "category"),
                          "relation",
                        )}
                      </td>
                      <td>
                        {renderCell(getNestedValue(row, "account"), "relation")}
                      </td>
                      <td>{renderCell(row.paymentMethod, "enum")}</td>
                      <td>{renderCell(row.amount, "money")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
                    {(module === "payables" ||
                      module === "payroll" ||
                      module === "cash" ||
                      module === "team" ||
                      (module === "inventory" &&
                        (role === "OWNER" || role === "ADMIN")) ||
                      (["categories", "accounts", "suppliers", "employees", "transactions"] as Module[]).includes(module) &&
                        (canEditModule(module, role) || canDeleteModule(module, role))) && (
                      <th>Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, index) => {
                    const rowKey = String(
                      row.id ?? row.name ?? `${module}-${index}`,
                    );
                    return (
                      <tr key={rowKey}>
                        {selectedColumns.map((column) => {
                          const value =
                            module === "inventory" && column.key === "status"
                              ? Number(row.currentStock ?? 0) === 0
                                ? "OUT_OF_STOCK"
                                : Number(row.currentStock ?? 0) <=
                                    Number(row.minimumStock ?? 0)
                                  ? "LOW"
                                  : "NORMAL"
                              : (getNestedValue(row, column.key) ??
                                row[column.key]);
                          return (
                            <td key={`${rowKey}-${column.key}`}>
                              {module === "inventory" &&
                              (column.key === "currentStock" ||
                                column.key === "minimumStock")
                                ? formatQuantity(
                                    value,
                                    String(row.unit ?? "un"),
                                  )
                                : renderCell(value, column.kind)}
                            </td>
                          );
                        })}

                        {module === "cash" && (
                          <td className="actions-cell">
                            <button
                              type="button"
                              className="table-action"
                              onClick={() => closeCash(String(row.id))}
                            >
                              Fechar caixa
                            </button>
                            <a
                              className="table-action"
                              href={`/cash/${String(row.id)}`}
                            >
                              Ver detalhes
                            </a>
                          </td>
                        )}

                        {module === "team" && (
                          <td className="actions-cell">
                            <button
                              type="button"
                              className="table-action"
                              onClick={() =>
                                updateTeam(
                                  String(row.userId ?? row.id),
                                  "resetPassword",
                                )
                              }
                            >
                              Redefinir senha
                            </button>
                            <button
                              type="button"
                              className="table-action"
                              onClick={() =>
                                updateTeam(
                                  String(row.userId ?? row.id),
                                  "toggle",
                                )
                              }
                            >
                              Alterar acesso
                            </button>
                          </td>
                        )}

                        {(module === "payables" || module === "payroll") &&
                          row.status !== "PAID" && (
                            <td className="actions-cell">
                              <button
                                type="button"
                                className="table-action"
                                onClick={() => pay(String(row.id))}
                              >
                                Pagar
                              </button>
                              {canEditModule(module, role) && <button type="button" className="table-action" onClick={() => editRow(row)}>Editar</button>}
                              {canDeleteModule(module, role) && <button type="button" className="table-action danger-action" onClick={() => void deleteRow(row)}>Excluir</button>}
                            </td>
                          )}
                        {module === "inventory" &&
                          (role === "OWNER" || role === "ADMIN") && (
                            <td className="actions-cell">
                              <button
                                type="button"
                                className="table-action"
                                onClick={() => editInventoryItem(row)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="table-action danger-action"
                                onClick={() => void deleteInventoryItem(row)}
                              >
                                Excluir
                              </button>
                            </td>
                          )}
                        {(["categories", "accounts", "suppliers", "employees", "transactions"] as Module[]).includes(module) &&
                          (canEditModule(module, role) || canDeleteModule(module, role)) && (
                            <td className="actions-cell">
                              {canEditModule(module, role) && <button type="button" className="table-action" onClick={() => editRow(row)}>Editar</button>}
                              {canDeleteModule(module, role) && <button type="button" className="table-action danger-action" onClick={() => void deleteRow(row)}>Excluir</button>}
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

      {module === "inventory" && (
        <section className="data-panel inventory-history-panel">
          <div className="section-heading">
            <div>
              <p className="panel-kicker">Rastreabilidade</p>
              <h2>Histórico de movimentações</h2>
            </div>
          </div>
          {inventoryMovements.length === 0 ? (
            <p className="empty-state">Nenhuma movimentação registrada.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Movimentação</th>
                    <th>Quantidade</th>
                    <th>Motivo</th>
                    <th>Estoque anterior</th>
                    <th>Estoque após</th>
                    <th>Data</th>
                    <th>Usuário</th>
                    {(role === "OWNER" || role === "ADMIN") && <th>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {inventoryMovements.map((movement) => {
                    const item = movement.item as
                      | Record<string, unknown>
                      | undefined;
                    const actor = movement.actor as
                      | Record<string, unknown>
                      | undefined;
                    const isEntry = movement.type === "IN";
                    const unit = String(item?.unit ?? "un");
                    return (
                      <tr key={String(movement.id)}>
                        <td>{String(item?.name ?? "Produto")}</td>
                        <td>
                          <span
                            className={`movement-badge ${isEntry ? "entry" : "exit"}`}
                          >
                            <span aria-hidden="true">●</span>
                            {isEntry ? "Entrada" : "Saída"}
                          </span>
                        </td>
                        <td>
                          {formatQuantity(
                            movement.quantity,
                            unit,
                            isEntry ? "+" : "−",
                          )}
                        </td>
                        <td>{String(movement.reason ?? "-")}</td>
                        <td>{formatQuantity(movement.stockBefore, unit)}</td>
                        <td>
                          <span className="inventory-current-stock">
                            {formatQuantity(movement.stockAfter, unit)}
                          </span>
                        </td>
                        <td>{formatDate(movement.occurredAt)}</td>
                        <td>{String(actor?.name ?? "Usuário do sistema")}</td>
                        {(role === "OWNER" || role === "ADMIN") && (
                          <td className="actions-cell">
                            <button
                              type="button"
                              className="table-action"
                              onClick={() => editMovement(movement)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="table-action danger-action"
                              onClick={() => void deleteMovement(movement)}
                            >
                              Excluir
                            </button>
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
