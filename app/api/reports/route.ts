import { NextResponse } from "next/server";
import { canAdmin } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";
import { decimalToNumber, jsonError, requireApiContext } from "@/backend/lib/http";

export async function GET(request: Request) {
  const auth = await requireApiContext();
  if ("error" in auth) return auth.error;
  if (!canAdmin(auth.ctx.membership.role)) return jsonError("Sem permissão", 403);
  const url = new URL(request.url); const from = url.searchParams.get("from"); const to = url.searchParams.get("to");
  const occurredAt = from || to ? { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}) } : undefined;
  const where = { restaurantId: auth.ctx.restaurant.id, ...(occurredAt ? { occurredAt } : {}) };
  const [transactions, categories, payables] = await Promise.all([prisma.transaction.findMany({ where, include: { category: true, account: true }, orderBy: { occurredAt: "desc" } }), prisma.category.findMany({ where: { restaurantId: auth.ctx.restaurant.id }, orderBy: { name: "asc" } }), prisma.accountsPayable.findMany({ where: { restaurantId: auth.ctx.restaurant.id }, orderBy: { dueDate: "asc" } })]);
  return NextResponse.json(decimalToNumber({ transactions, categories, payables }));
}
