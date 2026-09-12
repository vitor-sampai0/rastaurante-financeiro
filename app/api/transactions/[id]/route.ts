import { NextResponse } from "next/server";
import { z } from "zod";
import { canManage, canWrite } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";
import { audit } from "@/backend/lib/audit";
import { refsBelongToRestaurant } from "@/backend/lib/ownership";
import { decimalToNumber, jsonError, requireApiContext } from "@/backend/lib/http";

const schema = z.object({ type: z.enum(["INCOME", "EXPENSE"]).optional(), description: z.string().trim().min(2).max(180).optional(), amount: z.coerce.number().positive().optional(), occurredAt: z.coerce.date().optional(), categoryId: z.string().nullable().optional(), accountId: z.string().nullable().optional(), paymentMethod: z.enum(["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD", "BANK_TRANSFER", "BOLETO", "OTHER"]).optional(), notes: z.string().max(1000).nullable().optional() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiContext(); if ("error" in auth) return auth.error;
  if (!canWrite(auth.ctx.membership.role)) return jsonError("Sem permissão", 403);
  const { id } = await params;
  const current = await prisma.transaction.findFirst({ where: { id, restaurantId: auth.ctx.restaurant.id } });
  if (!current) return jsonError("Movimentação não encontrada", 404);
  if (current.reference?.startsWith("PAYABLE:") || current.reference?.startsWith("PAYROLL:")) return jsonError("Movimentações automáticas não podem ser alteradas", 409);
  const parsed = schema.partial().safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError("Dados inválidos");
  if (!(await refsBelongToRestaurant(auth.ctx.restaurant.id, parsed.data))) return jsonError("Referência inválida", 400);
  const data = { ...parsed.data, amount: parsed.data.amount?.toFixed(2) };
  const row = await prisma.transaction.update({ where: { id }, data });
  await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "UPDATE", entity: "Transaction", entityId: id, data: { before: current, after: parsed.data } });
  return NextResponse.json(decimalToNumber(row));
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiContext(); if ("error" in auth) return auth.error;
  if (!canManage(auth.ctx.membership.role)) return jsonError("Sem permissão", 403);
  const { id } = await params; const row = await prisma.transaction.findFirst({ where: { id, restaurantId: auth.ctx.restaurant.id } });
  if (!row) return jsonError("Movimentação não encontrada", 404);
  if (row.reference?.startsWith("PAYABLE:") || row.reference?.startsWith("PAYROLL:")) return jsonError("Movimentações automáticas não podem ser excluídas", 409);
  await prisma.transaction.delete({ where: { id } });
  await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "DELETE", entity: "Transaction", entityId: id });
  return NextResponse.json({ ok: true });
}