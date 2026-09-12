import { NextResponse } from "next/server";
import { canAdmin } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";
import { jsonError, requireApiContext } from "@/backend/lib/http";
export async function GET() { const auth = await requireApiContext(); if ("error" in auth) return auth.error; if (!canAdmin(auth.ctx.membership.role)) return jsonError("Sem permissão", 403); return NextResponse.json(await prisma.auditLog.findMany({ where: { restaurantId: auth.ctx.restaurant.id }, include: { actor: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 500 })); }