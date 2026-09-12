import { NextResponse } from "next/server";
import { z } from "zod";
import { canAdmin } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";
import { refsBelongToRestaurant } from "@/backend/lib/ownership";
import { audit } from "@/backend/lib/audit";
import { decimalToNumber, jsonError, requireApiContext } from "@/backend/lib/http";

const schema = z.object({ employeeId: z.string(), referenceMonth: z.string().min(7).max(7), grossAmount: z.coerce.number().positive(), deductions: z.coerce.number().nonnegative().default(0), dueDate: z.coerce.date(), notes: z.string().max(1000).nullable().optional() });

export async function GET() {
  const auth = await requireApiContext();
  if ("error" in auth) return auth.error;
  if (!canAdmin(auth.ctx.membership.role)) return jsonError("Sem permissão", 403);
  return NextResponse.json(decimalToNumber(await prisma.payrollEntry.findMany({ where: { restaurantId: auth.ctx.restaurant.id }, include: { employee: true }, orderBy: { dueDate: "desc" } })));
}

export async function POST(request: Request) {
  const auth = await requireApiContext();
  if ("error" in auth) return auth.error;
  if (!canAdmin(auth.ctx.membership.role)) return jsonError("Sem permissão", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !(await refsBelongToRestaurant(auth.ctx.restaurant.id, { employeeId: parsed.data?.employeeId }))) return jsonError("Dados inválidos");
  const row = await prisma.payrollEntry.create({ data: { ...parsed.data, grossAmount: parsed.data.grossAmount.toFixed(2), deductions: parsed.data.deductions.toFixed(2), netAmount: (parsed.data.grossAmount - parsed.data.deductions).toFixed(2), restaurantId: auth.ctx.restaurant.id } });
  await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "CREATE", entity: "PayrollEntry", entityId: row.id, data: parsed.data });
  return NextResponse.json(decimalToNumber(row), { status: 201 });
}
