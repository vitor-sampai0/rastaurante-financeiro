import { notFound, redirect } from "next/navigation";
import { getRestaurantContext } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";
import PrintButton from "@/app/components/PrintButton";

export default async function CashDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getRestaurantContext();
  if (!context) redirect("/");
  if (context.user.mustChangePassword) redirect("/change-password");
  const { id } = await params;
  const session = await prisma.cashSession.findFirst({ where: { id, restaurantId: context.restaurant.id }, include: { account: true, openedBy: { select: { name: true } }, closedBy: { select: { name: true } }, transactions: { include: { category: true, creator: { select: { name: true } } }, orderBy: { occurredAt: "asc" } } } });
  if (!session) notFound();
  const income = session.transactions.filter((transaction) => transaction.type === "INCOME").reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const expense = session.transactions.filter((transaction) => transaction.type === "EXPENSE").reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const expected = Number(session.openingBalance) + income - expense;
  const format = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: context.restaurant.currency });
  return <main className="admin-page printable-report"><header className="admin-header"><div><p className="eyebrow">Resumo do caixa</p><h1>{context.restaurant.name}</h1></div><PrintButton /></header><section className="data-panel"><p><strong>Caixa:</strong> {session.account.name}</p><p><strong>Aberto por:</strong> {session.openedBy.name} em {session.openedAt.toLocaleString("pt-BR")}</p><p><strong>Valor inicial:</strong> {format(Number(session.openingBalance))}</p><div className="metric-grid"><article><span>Entradas</span><strong>{format(income)}</strong></article><article><span>Saídas</span><strong>{format(expense)}</strong></article><article><span>Valor esperado</span><strong>{format(Number(session.expectedBalance ?? expected))}</strong></article><article><span>Valor contado</span><strong>{session.closingCounted === null ? "Em aberto" : format(Number(session.closingCounted))}</strong></article></div><p className={Number(session.difference ?? 0) < 0 ? "form-error" : "success-message"}><strong>{session.difference === null ? "Sessão aberta" : Number(session.difference) < 0 ? `FALTA DE CAIXA: ${format(Math.abs(Number(session.difference)))}` : Number(session.difference) > 0 ? `SOBRA DE CAIXA: ${format(Number(session.difference))}` : "Diferença: R$ 0,00"}</strong></p>{session.closedBy && <p><strong>Fechado por:</strong> {session.closedBy.name} em {session.closedAt?.toLocaleString("pt-BR")}</p>}<h2>Movimentações</h2><div className="table-wrap"><table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Usuário</th></tr></thead><tbody>{session.transactions.map((transaction) => <tr key={transaction.id}><td>{transaction.occurredAt.toLocaleString("pt-BR")}</td><td>{transaction.type === "INCOME" ? "Entrada" : "Saída"}</td><td>{transaction.description}</td><td>{transaction.category?.name ?? "-"}</td><td>{format(Number(transaction.amount))}</td><td>{transaction.creator.name}</td></tr>)}</tbody></table></div></section></main>;
}
