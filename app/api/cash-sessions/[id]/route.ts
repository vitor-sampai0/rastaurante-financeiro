import { NextResponse } from "next/server";
import { z } from "zod";
import { canAdmin, canOperateCash } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";
import { audit } from "@/backend/lib/audit";
import { decimalToNumber, jsonError, requireApiContext } from "@/backend/lib/http";

const schema = z.object({ closingCounted: z.coerce.number().nonnegative(), notes: z.string().max(1000).nullable().optional() });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiContext(); if ("error" in auth) return auth.error;
  const { id } = await params;
  const session = await prisma.cashSession.findFirst({ where: { id, restaurantId: auth.ctx.restaurant.id }, include: { account: true, openedBy: { select: { name: true, email: true } }, closedBy: { select: { name: true, email: true } }, transactions: { include: { category: true, creator: { select: { name: true } } }, orderBy: { occurredAt: "asc" } } } });
  if (!session) return jsonError("Caixa não encontrado", 404);
  const income = session.transactions.filter((transaction) => transaction.type === "INCOME").reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const expense = session.transactions.filter((transaction) => transaction.type === "EXPENSE").reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const expected = Number(session.openingBalance) + income - expense;
  return NextResponse.json(decimalToNumber({ ...session, income, expense, expected, difference: session.difference ?? null }));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiContext(); if ("error" in auth) return auth.error;
  if (!canOperateCash(auth.ctx.membership.role)) return jsonError("Sem permissão", 403);
  const { id } = await params;
  const current = await prisma.cashSession.findFirst({ where: { id, restaurantId: auth.ctx.restaurant.id }, include: { transactions: { select: { type: true, amount: true } } } });
  if (!current) return jsonError("Caixa não encontrado", 404);
  if (current.status === "CLOSED") return jsonError("Caixa já fechado", 409);
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError("Dados inválidos");
  const income = current.transactions.filter((transaction) => transaction.type === "INCOME").reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const expense = current.transactions.filter((transaction) => transaction.type === "EXPENSE").reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const expected = Number(current.openingBalance) + income - expense;
  const difference = parsed.data.closingCounted - expected;
  const row = await prisma.cashSession.update({ where: { id }, data: { closingCounted: parsed.data.closingCounted.toFixed(2), expectedBalance: expected.toFixed(2), difference: difference.toFixed(2), notes: parsed.data.notes, status: "CLOSED", closedAt: new Date(), closedByUserId: auth.ctx.user.id } });
  await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "CLOSE", entity: "CashSession", entityId: id, data: { openingBalance: current.openingBalance, income, expense, expected, closingCounted: parsed.data.closingCounted, difference } });
  return NextResponse.json(decimalToNumber(row));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiContext(); if ("error" in auth) return auth.error;
  if (!canAdmin(auth.ctx.membership.role)) return jsonError("Sem permissão", 403);
  const { id } = await params; const body = await request.json().catch(() => null);
  const correction = z.object({ action: z.literal("CORRECT"), closingCounted: z.coerce.number().nonnegative(), reason: z.string().trim().min(5).max(500) }).safeParse(body);
  if (!correction.success) return jsonError("Informe o valor contado e o motivo da correção");
  const current = await prisma.cashSession.findFirst({ where: { id, restaurantId: auth.ctx.restaurant.id }, include: { transactions: { select: { type: true, amount: true } } } });
  if (!current) return jsonError("Caixa não encontrado", 404);
  if (current.status !== "CLOSED") return jsonError("Somente caixas fechados podem ser corrigidos", 409);
  const income = current.transactions.filter((transaction) => transaction.type === "INCOME").reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const expense = current.transactions.filter((transaction) => transaction.type === "EXPENSE").reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const expected = Number(current.openingBalance) + income - expense;
  const difference = correction.data.closingCounted - expected;
  const row = await prisma.cashSession.update({ where: { id }, data: { closingCounted: correction.data.closingCounted.toFixed(2), expectedBalance: expected.toFixed(2), difference: difference.toFixed(2), notes: `${current.notes ?? ""}\nCorreção administrativa: ${correction.data.reason}`.trim() } });
  await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "CORRECT", entity: "CashSession", entityId: id, data: { reason: correction.data.reason, previousClosingCounted: current.closingCounted, closingCounted: correction.data.closingCounted, expected, difference } });
  return NextResponse.json(decimalToNumber(row));
}
