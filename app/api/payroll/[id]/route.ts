import { NextResponse } from "next/server";
import { z } from "zod";
import { canAdmin } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";
import { audit } from "@/backend/lib/audit";
import { decimalToNumber, jsonError, requireApiContext } from "@/backend/lib/http";

const schema = z.object({ accountId: z.string(), paymentMethod: z.enum(["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD", "BANK_TRANSFER", "BOLETO", "OTHER"]), paidAt: z.coerce.date().optional() });
const editSchema = z.object({ employeeId: z.string().min(1), referenceMonth: z.string().regex(/^\d{4}-\d{2}$/), grossAmount: z.coerce.number().positive(), deductions: z.coerce.number().nonnegative(), dueDate: z.coerce.date(), notes: z.string().max(1000).nullable().optional() }).refine((data) => data.deductions <= data.grossAmount, { path: ["deductions"], message: "Os descontos não podem superar o valor bruto" });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiContext(); if ("error" in auth) return auth.error;
  if (!canAdmin(auth.ctx.membership.role)) return jsonError("Sem permissão", 403);
  const { id } = await params; const body = await request.json().catch(() => null); const parsed = schema.safeParse(body);
  const current = await prisma.payrollEntry.findFirst({ where: { id, restaurantId: auth.ctx.restaurant.id } }); if (!current) return jsonError("Folha não encontrada", 404); if (current.status === "PAID") return jsonError("Pagamento já realizado", 409);
  if (!parsed.success) {
    const edit = editSchema.safeParse(body);
    if (!edit.success) return jsonError("Dados inválidos");
    const employee = await prisma.employee.findFirst({ where: { id: edit.data.employeeId, restaurantId: auth.ctx.restaurant.id, status: "ACTIVE" } });
    if (!employee) return jsonError("Funcionário inválido", 400);
    const row = await prisma.payrollEntry.update({ where: { id }, data: { ...edit.data, grossAmount: edit.data.grossAmount.toFixed(2), deductions: edit.data.deductions.toFixed(2), netAmount: (edit.data.grossAmount - edit.data.deductions).toFixed(2) } });
    await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "UPDATE", entity: "PayrollEntry", entityId: id, data: edit.data });
    return NextResponse.json(decimalToNumber(row));
  }
  const account = await prisma.account.findFirst({ where: { id: parsed.data.accountId, restaurantId: auth.ctx.restaurant.id, active: true } }); if (!account) return jsonError("Conta inválida", 400);
  const paidAt = parsed.data.paidAt ?? new Date();
  const result = await prisma.$transaction(async (tx) => { const transaction = await tx.transaction.create({ data: { restaurantId: auth.ctx.restaurant.id, createdByUserId: auth.ctx.user.id, type: "EXPENSE", description: "Pagamento de funcionário", amount: current.netAmount, occurredAt: paidAt, paymentMethod: parsed.data.paymentMethod, accountId: parsed.data.accountId, reference: `PAYROLL:${id}`, notes: current.notes } }); return tx.payrollEntry.update({ where: { id }, data: { status: "PAID", paidAt, transactionId: transaction.id } }); });
  await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "PAY", entity: "PayrollEntry", entityId: id });
  return NextResponse.json(decimalToNumber(result));
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiContext(); if ("error" in auth) return auth.error;
  if (!canAdmin(auth.ctx.membership.role)) return jsonError("Sem permissão", 403);
  const { id } = await params;
  const current = await prisma.payrollEntry.findFirst({ where: { id, restaurantId: auth.ctx.restaurant.id } });
  if (!current) return jsonError("Folha não encontrada", 404);
  if (current.status === "PAID") return jsonError("Folha paga não pode ser excluída", 409);
  await prisma.payrollEntry.delete({ where: { id } });
  await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "DELETE", entity: "PayrollEntry", entityId: id });
  return NextResponse.json({ ok: true });
}
