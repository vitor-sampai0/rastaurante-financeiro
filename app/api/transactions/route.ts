import { NextResponse } from "next/server";
import { z } from "zod";
import { getRestaurantContext, canWrite } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";
import { audit } from "@/backend/lib/audit";

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
  const context = await getRestaurantContext();
  if (!context) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const transactions = await prisma.transaction.findMany({ where: { restaurantId: context.restaurant.id }, orderBy: { occurredAt: "desc" }, take: 100 });
  return NextResponse.json(transactions);
}

export async function POST(request: Request) {
  const context = await getRestaurantContext();
  if (!context) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canWrite(context.membership.role)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const parsed = transactionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const data = parsed.data;
  const [category, account] = await Promise.all([
    data.categoryId ? prisma.category.findFirst({ where: { id: data.categoryId, restaurantId: context.restaurant.id } }) : null,
    data.accountId ? prisma.account.findFirst({ where: { id: data.accountId, restaurantId: context.restaurant.id } }) : null,
  ]);
  if ((data.categoryId && !category) || (data.accountId && !account)) return NextResponse.json({ error: "Referência inválida" }, { status: 400 });
  if (data.cashSessionId) {
    const cashSession = await prisma.cashSession.findFirst({ where: { id: data.cashSessionId, restaurantId: context.restaurant.id, status: "OPEN", accountId: data.accountId } });
    if (!cashSession) return NextResponse.json({ error: "Sessão de caixa inválida ou fechada" }, { status: 400 });
  }

  const transaction = await prisma.transaction.create({ data: { ...data, amount: data.amount.toFixed(2), restaurantId: context.restaurant.id, createdByUserId: context.user.id, occurredAt: data.occurredAt ?? new Date() } });
  await audit({ restaurantId: context.restaurant.id, actorUserId: context.user.id, action: "CREATE", entity: "Transaction", entityId: transaction.id, data: parsed.data });
  return NextResponse.json(transaction, { status: 201 });
}
