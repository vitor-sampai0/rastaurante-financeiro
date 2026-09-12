import { NextResponse } from "next/server";
import { z } from "zod";
import { canWrite } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";
import { audit } from "@/backend/lib/audit";
import { jsonError, requireApiContext } from "@/backend/lib/http";

const schema = z.object({ name: z.string().trim().min(2).max(120), document: z.string().max(40).nullable().optional(), phone: z.string().max(40).nullable().optional(), email: z.string().email().nullable().optional(), notes: z.string().max(1000).nullable().optional() });
export async function GET() { const auth = await requireApiContext(); if ("error" in auth) return auth.error; return NextResponse.json(await prisma.supplier.findMany({ where: { restaurantId: auth.ctx.restaurant.id, active: true }, orderBy: { name: "asc" } })); }
export async function POST(request: Request) { const auth = await requireApiContext(); if ("error" in auth) return auth.error; if (!canWrite(auth.ctx.membership.role)) return jsonError("Sem permissão", 403); const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return jsonError("Dados inválidos"); const row = await prisma.supplier.create({ data: { ...parsed.data, restaurantId: auth.ctx.restaurant.id } }); await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "CREATE", entity: "Supplier", entityId: row.id, data: parsed.data }); return NextResponse.json(row, { status: 201 }); }