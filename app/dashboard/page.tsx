import { redirect } from "next/navigation";
import { getRestaurantContext } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";

export default async function DashboardPage() {
  const context = await getRestaurantContext();
  if (!context) redirect("/");

  const [income, expense, pending, recent] = await Promise.all([
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
    prisma.transaction.findMany({
      where: { restaurantId: context.restaurant.id },
      orderBy: { occurredAt: "desc" },
      take: 8,
      select: {
        id: true,
        description: true,
        amount: true,
        type: true,
        occurredAt: true,
      },
    }),
  ]);

  const format = (value: unknown) =>
    Number(value ?? 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: context.restaurant.currency,
    });
  const balance =
    Number(income._sum.amount ?? 0) - Number(expense._sum.amount ?? 0);

  const links = [
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
  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Visão geral</p>
          <h1>{context.restaurant.name}</h1>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="switch-button">Sair</button>
        </form>
      </header>
      <nav className="module-nav">
        {links.map(([href, label]) => (
          <a href={href} key={href}>
            {label}
          </a>
        ))}
      </nav>
      <section className="metric-grid">
        <article>
          <span>Receitas</span>
          <strong>{format(income._sum.amount)}</strong>
        </article>
        <article>
          <span>Despesas</span>
          <strong>{format(expense._sum.amount)}</strong>
        </article>
        <article>
          <span>Saldo</span>
          <strong>{format(balance)}</strong>
        </article>
        <article>
          <span>Contas pendentes</span>
          <strong>{pending._count}</strong>
          <small>{format(pending._sum.amount)}</small>
        </article>
      </section>
      <section className="activity">
        <div className="section-heading">
          <div>
            <p className="panel-kicker">Movimentações</p>
            <h2>Últimos lançamentos</h2>
          </div>
          <span>{context.membership.role}</span>
        </div>
        {recent.length === 0 ? (
          <p className="empty-state">Ainda não há movimentações registradas.</p>
        ) : (
          <div className="transaction-list">
            {recent.map((transaction) => (
              <div className="transaction-row" key={transaction.id}>
                <div>
                  <strong>{transaction.description}</strong>
                  <small>
                    {transaction.occurredAt.toLocaleDateString("pt-BR")}
                  </small>
                </div>
                <strong
                  className={
                    transaction.type === "INCOME" ? "income" : "expense"
                  }
                >
                  {transaction.type === "INCOME" ? "+" : "-"}
                  {format(transaction.amount)}
                </strong>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
