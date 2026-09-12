import { NextResponse } from "next/server";
import { z } from "zod";
import { canManage, canWrite } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";
import { audit } from "@/backend/lib/audit";
import { refsBelongToRestaurant } from "@/backend/lib/ownership";
import { decimalToNumber, jsonError, requireApiContext } from "@/backend/lib/http";
const editSchema = z.object({ description: z.string().trim().min(2).max(180).optional(), amount: z.coerce.number().positive().optional(), dueDate: z.coerce.date().optional(), supplierId: z.string().nullable().optional(), categoryId: z.string().nullable().optional(), accountId: z.string().nullable().optional(), notes: z.string().max(1000).nullable().optional() });
const paySchema = z.object({ action: z.literal("PAY"), paidAt: z.coerce.date().optional(), paymentMethod: z.enum(["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD", "BANK_TRANSFER", "BOLETO", "OTHER"]), accountId: z.string().min(1) });
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiContext(); if ("error" in auth) return auth.error; if (!canWrite(auth.ctx.membership.role)) return jsonError("Sem permissão", 403); const { id } = await params; const current = await prisma.accountsPayable.findFirst({ where: { id, restaurantId: auth.ctx.restaurant.id } }); if (!current) return jsonError("Conta não encontrada", 404); const body = await request.json().catch(() => null);
  const payment = paySchema.safeParse(body);
  if (payment.success) {
    if (current.status === "PAID") return jsonError("Esta conta já foi paga", 409);
    if (!(await refsBelongToRestaurant(auth.ctx.restaurant.id, { accountId: payment.data.accountId }))) return jsonError("Conta inválida", 400);
    const paidAt = payment.data.paidAt ?? new Date();
    const result = await prisma.$transaction(async (tx) => { const transaction = await tx.transaction.create({ data: { restaurantId: auth.ctx.restaurant.id, createdByUserId: auth.ctx.user.id, type: "EXPENSE", description: `Pagamento: ${current.description}`, amount: current.amount, occurredAt: paidAt, paymentMethod: payment.data.paymentMethod, categoryId: current.categoryId, accountId: payment.data.accountId, reference: `PAYABLE:${id}`, notes: current.notes } }); return tx.accountsPayable.update({ where: { id }, data: { status: "PAID", paidAt, paymentMethod: payment.data.paymentMethod, accountId: payment.data.accountId, transactionId: transaction.id } }); });
    await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "PAY", entity: "AccountsPayable", entityId: id, data: { transactionId: result.transactionId } }); return NextResponse.json(decimalToNumber(result));
  }
  const parsed = editSchema.safeParse(body); if (!parsed.success) return jsonError("Dados inválidos"); if (!(await refsBelongToRestaurant(auth.ctx.restaurant.id, parsed.data))) return jsonError("Referência inválida", 400); const data = { ...parsed.data, amount: parsed.data.amount?.toFixed(2) }; const row = await prisma.accountsPayable.update({ where: { id }, data }); await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "UPDATE", entity: "AccountsPayable", entityId: id, data: parsed.data }); return NextResponse.json(decimalToNumber(row));
}
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) { const auth = await requireApiContext(); if ("error" in auth) return auth.error; if (!canManage(auth.ctx.membership.role)) return jsonError("Sem permissão", 403); const { id } = await params; const row = await prisma.accountsPayable.findFirst({ where: { id, restaurantId: auth.ctx.restaurant.id } }); if (!row) return jsonError("Conta não encontrada", 404); if (row.status === "PAID") return jsonError("Conta paga não pode ser excluída", 409); await prisma.accountsPayable.delete({ where: { id } }); await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "DELETE", entity: "AccountsPayable", entityId: id }); return NextResponse.json({ ok: true }); }