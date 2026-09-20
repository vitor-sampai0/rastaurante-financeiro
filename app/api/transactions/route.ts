import { NextResponse } from "next/server";
import { z } from "zod";
import { canWrite } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";
import { audit } from "@/backend/lib/audit";
import { requireApiContext } from "@/backend/lib/http";

const transactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.coerce.number().positive(),
  description: z.string().trim().min(2).max(180),
  occurredAt: z.coerce.date().optional(),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  paymentMethod: z.enum(["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD", "BANK_TRANSFER", "BOLETO", "OTHER"]).default("PIX"),
  cashSessionId: z.string().optional(),
});

export async function GET() {
  const auth = await requireApiContext();
  if ("error" in auth) return auth.error;
  const transactions = await prisma.transaction.findMany({ where: { restaurantId: auth.ctx.restaurant.id }, include: { category: true, account: true, creator: { select: { name: true } } }, orderBy: { occurredAt: "desc" }, take: 500 });
  return NextResponse.json(transactions);
}

export async function POST(request: Request) {
  const auth = await requireApiContext();
  if ("error" in auth) return auth.error;
  if (!canWrite(auth.ctx.membership.role)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const parsed = transactionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const data = parsed.data;
  const [category, account] = await Promise.all([
    data.categoryId ? prisma.category.findFirst({ where: { id: data.categoryId, restaurantId: auth.ctx.restaurant.id, active: true } }) : null,
    data.accountId ? prisma.account.findFirst({ where: { id: data.accountId, restaurantId: auth.ctx.restaurant.id, active: true } }) : null,
  ]);
  if ((data.categoryId && !category) || (data.accountId && !account)) return NextResponse.json({ error: "Referência inválida" }, { status: 400 });
  if (data.cashSessionId) {
    const cashSession = await prisma.cashSession.findFirst({ where: { id: data.cashSessionId, restaurantId: auth.ctx.restaurant.id, status: "OPEN", accountId: data.accountId } });
    if (!cashSession) return NextResponse.json({ error: "Sessão de caixa inválida ou fechada" }, { status: 400 });
  }

  const transaction = await prisma.transaction.create({ data: { ...data, amount: data.amount.toFixed(2), restaurantId: auth.ctx.restaurant.id, createdByUserId: auth.ctx.user.id, occurredAt: data.occurredAt ?? new Date() } });
  await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "CREATE", entity: "Transaction", entityId: transaction.id, data: parsed.data });
  return NextResponse.json(transaction, { status: 201 });
}
