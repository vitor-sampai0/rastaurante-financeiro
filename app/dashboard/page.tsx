import { redirect } from "next/navigation";
import { canAdmin, getRestaurantContext } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";

export default async function DashboardPage() {
  const context = await getRestaurantContext();
  if (!context) redirect("/");
  if (context.user.mustChangePassword) redirect("/change-password");

  const [income, expense, pending, overdue, recent, cashSession, inventoryItems] = await Promise.all([
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { restaurantId: context.restaurant.id, type: "INCOME" },
    }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { restaurantId: context.restaurant.id, type: "EXPENSE" },
    }),
    prisma.accountsPayable.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { restaurantId: context.restaurant.id, status: "PENDING" },
    }),
    prisma.accountsPayable.count({
      where: { restaurantId: context.restaurant.id, status: "OVERDUE" },
    }),
    prisma.transaction.findMany({
      where: { restaurantId: context.restaurant.id },
      orderBy: { occurredAt: "desc" },
      take: 8,
      include: {
        category: { select: { name: true } },
        account: { select: { name: true } },
      },
    }),
    prisma.cashSession.findFirst({
      where: { restaurantId: context.restaurant.id, status: "OPEN" },
      include: {
        account: true,
        openedBy: { select: { name: true } },
      },
      orderBy: { openedAt: "desc" },
    }),
    prisma.inventoryItem.findMany({
      where: { restaurantId: context.restaurant.id, active: true },
      select: { currentStock: true, minimumStock: true },
    }),
  ]);

  const format = (value: unknown) =>
    Number(value ?? 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: context.restaurant.currency,
    });
  const balance =
    Number(income._sum.amount ?? 0) - Number(expense._sum.amount ?? 0);
  const isAdmin = canAdmin(context.membership.role);
  const lowStock = inventoryItems.filter((item) => Number(item.currentStock) <= Number(item.minimumStock)).length;

  const adminLinks = [
    ["/transactions", "Transações"],
    ["/categories", "Categorias"],
    ["/accounts", "Contas"],
    ["/cash", "Caixa"],
    ["/payables", "Contas a pagar"],
    ["/suppliers", "Fornecedores"],
    ["/employees", "Funcionários"],
    ["/payroll", "Folha"],
    ["/inventory", "Estoque"],
    ["/team", "Equipe"],
    ["/audit", "Auditoria"],
    ["/reports", "Relatórios"],
  ];
  const operationalLinks = [
    ["/transactions", "Transações"],
    ["/cash", "Caixa"],
    ["/suppliers", "Fornecedores"],
    ["/payables", "Contas a pagar"],
    ["/inventory", "Estoque"],
  ];
  const links = canAdmin(context.membership.role)
    ? adminLinks
    : operationalLinks;

  const cashTransactions = cashSession
    ? await prisma.transaction.findMany({ where: { restaurantId: context.restaurant.id, cashSessionId: cashSession.id }, select: { type: true, amount: true } })
    : [];
  const currentCash = cashSession
    ? Number(cashSession.openingBalance) + cashTransactions.reduce((sum, transaction) => sum + (transaction.type === "INCOME" ? Number(transaction.amount) : -Number(transaction.amount)), 0)
    : 0;

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Visão geral</p>
          <h1>{context.restaurant.name}</h1>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="switch-button" type="submit">
            Sair
          </button>
        </form>
      </header>

      <nav className="module-nav">
        {links.map(([href, label]) => (
          <a href={href} key={href}>
            {label}
          </a>
        ))}
      </nav>

      {isAdmin && (
        <section className="metric-grid">
          <article>
            <span>Receitas</span>
            <strong>{format(income._sum.amount)}</strong>
            <small>Acumulado</small>
          </article>
          <article>
            <span>Despesas</span>
            <strong>{format(expense._sum.amount)}</strong>
            <small>Último ciclo</small>
          </article>
          <article>
            <span>Saldo</span>
            <strong>{format(balance)}</strong>
            <small>Disponível</small>
          </article>
          <article>
            <span>Contas pendentes</span>
            <strong>{pending._count}</strong>
            <small>{format(pending._sum.amount)}</small>
          </article>
          <article>
            <span>Contas vencidas</span>
            <strong>{overdue}</strong>
            <small>Precisam de atenção</small>
          </article>
          <article>
            <span>Caixa atual</span>
            <strong>{format(currentCash)}</strong>
            <small>{cashSession?.account?.name ?? "Sem caixa aberto"}</small>
          </article>
          <article>
            <span>Estoque baixo</span>
            <strong>{lowStock}</strong>
            <small>Itens no limite</small>
          </article>
        </section>
      )}

      <section className="activity">
        <div className="section-heading">
          <div>
            <p className="panel-kicker">Movimentações</p>
            <h2>Recentes</h2>
          </div>
          <span>{context.membership.role}</span>
        </div>

        {recent.length === 0 ? (
          <div className="empty-state-card">
            <h3>Não há movimentações neste período.</h3>
            <p>
              Registre sua primeira movimentação para manter o caixa e o
              financeiro organizados.
            </p>
          </div>
        ) : (
          <div className="transaction-list">
            {recent.map((transaction) => (
              <div className="transaction-row" key={transaction.id}>
                <div className="transaction-info">
                  <strong>{transaction.description}</strong>
                  <small>
                    {transaction.occurredAt.toLocaleDateString("pt-BR")} •{" "}
                    {transaction.category?.name ?? "Sem categoria"} •{" "}
                    {transaction.account?.name ?? "Sem conta"}
                  </small>
                </div>
                <div className="transaction-amount">
                  <span
                    className={
                      transaction.type === "INCOME"
                        ? "status-badge success"
                        : "status-badge danger"
                    }
                  >
                    {transaction.type === "INCOME" ? "Entrada" : "Saída"}
                  </span>
                  <strong
                    className={
                      transaction.type === "INCOME" ? "income" : "expense"
                    }
                  >
                    {transaction.type === "INCOME" ? "+" : "-"}
                    {format(transaction.amount)}
                  </strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
