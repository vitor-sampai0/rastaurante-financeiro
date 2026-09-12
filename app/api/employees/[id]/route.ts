import { NextResponse } from "next/server";
import { canAdmin } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";
import { audit } from "@/backend/lib/audit";
import { jsonError, requireApiContext } from "@/backend/lib/http";
import { z } from "zod";

const schema = z.object({ name: z.string().trim().min(2).max(120).optional(), roleName: z.string().max(80).nullable().optional(), monthlySalary: z.coerce.number().nonnegative().nullable().optional(), status: z.enum(["ACTIVE", "INACTIVE"]).optional() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiContext();
  if ("error" in auth) return auth.error;
  if (!canAdmin(auth.ctx.membership.role)) return jsonError("Sem permissão", 403);
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Dados inválidos");
  const current = await prisma.employee.findFirst({ where: { id, restaurantId: auth.ctx.restaurant.id } });
  if (!current) return jsonError("Funcionário não encontrado", 404);
  const row = await prisma.employee.update({ where: { id }, data: { ...parsed.data, monthlySalary: parsed.data.monthlySalary?.toFixed(2) } });
  await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "UPDATE", entity: "Employee", entityId: id, data: parsed.data });
  return NextResponse.json(row);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiContext();
  if ("error" in auth) return auth.error;
  if (!canAdmin(auth.ctx.membership.role)) return jsonError("Sem permissão", 403);
  const { id } = await params;
  const current = await prisma.employee.findFirst({ where: { id, restaurantId: auth.ctx.restaurant.id } });
  if (!current) return jsonError("Funcionário não encontrado", 404);
  await prisma.employee.update({ where: { id }, data: { status: "INACTIVE" } });
  await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "DELETE", entity: "Employee", entityId: id });
  return NextResponse.json({ ok: true });
}
