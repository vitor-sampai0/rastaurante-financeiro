import { NextResponse } from "next/server";
import { AccountType } from "@prisma/client";
import { z } from "zod";
import { canManage } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";
import { audit } from "@/backend/lib/audit";
import { decimalToNumber, jsonError, requireApiContext } from "@/backend/lib/http";

const schema = z.object({ name: z.string().trim().min(2).max(80), type: z.enum(AccountType), initialBalance: z.coerce.number().default(0) });

export async function GET() {
  const auth = await requireApiContext();
  if ("error" in auth) return auth.error;
  const rows = await prisma.account.findMany({ where: { restaurantId: auth.ctx.restaurant.id }, include: { transactions: { select: { type: true, amount: true } } }, orderBy: { name: "asc" } });
  return NextResponse.json(decimalToNumber(rows.map(({ transactions, ...account }) => ({ ...account, balance: Number(account.initialBalance) + transactions.reduce((sum, transaction) => sum + (transaction.type === "INCOME" ? Number(transaction.amount) : -Number(transaction.amount)), 0) }))));
}

export async function POST(request: Request) {
  const auth = await requireApiContext();
  if ("error" in auth) return auth.error;
  if (!canManage(auth.ctx.membership.role)) return jsonError("Sem permissão", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Dados inválidos");
  try {
    const row = await prisma.account.create({ data: { ...parsed.data, initialBalance: parsed.data.initialBalance.toFixed(2), restaurantId: auth.ctx.restaurant.id } });
    await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "CREATE", entity: "Account", entityId: row.id, data: parsed.data });
    return NextResponse.json(decimalToNumber(row), { status: 201 });
  } catch { return jsonError("Já existe uma conta com esse nome", 409); }
}