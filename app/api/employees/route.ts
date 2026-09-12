import { NextResponse } from "next/server";
import { EmploymentStatus } from "@prisma/client";
import { z } from "zod";
import { canWrite } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";
import { audit } from "@/backend/lib/audit";
import { jsonError, requireApiContext } from "@/backend/lib/http";
const schema = z.object({ name: z.string().trim().min(2).max(120), roleName: z.string().max(80).nullable().optional(), document: z.string().max(40).nullable().optional(), monthlySalary: z.coerce.number().nonnegative().nullable().optional(), status: z.enum(EmploymentStatus).default("ACTIVE"), hiredAt: z.coerce.date().nullable().optional() });
export async function GET() { const auth = await requireApiContext(); if ("error" in auth) return auth.error; return NextResponse.json(await prisma.employee.findMany({ where: { restaurantId: auth.ctx.restaurant.id }, orderBy: { name: "asc" } })); }
export async function POST(request: Request) { const auth = await requireApiContext(); if ("error" in auth) return auth.error; if (!canWrite(auth.ctx.membership.role)) return jsonError("Sem permissão", 403); const p = schema.safeParse(await request.json().catch(() => null)); if (!p.success) return jsonError("Dados inválidos"); const row = await prisma.employee.create({ data: { ...p.data, monthlySalary: p.data.monthlySalary?.toFixed(2), restaurantId: auth.ctx.restaurant.id } }); await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "CREATE", entity: "Employee", entityId: row.id, data: p.data }); return NextResponse.json(row, { status: 201 }); }