import { NextResponse } from "next/server";
import { CategoryType } from "@prisma/client";
import { z } from "zod";
import { canManage } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";
import { audit } from "@/backend/lib/audit";
import { jsonError, requireApiContext } from "@/backend/lib/http";

const schema = z.object({ name: z.string().trim().min(2).max(80), type: z.enum(CategoryType) });
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function GET() {
  const auth = await requireApiContext();
  if ("error" in auth) return auth.error;
  return NextResponse.json(await prisma.category.findMany({ where: { restaurantId: auth.ctx.restaurant.id }, orderBy: { name: "asc" } }));
}

export async function POST(request: Request) {
  const auth = await requireApiContext();
  if ("error" in auth) return auth.error;
  if (!canManage(auth.ctx.membership.role)) return jsonError("Sem permissão", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Dados inválidos");
  const slug = slugify(parsed.data.name);
  try {
    const row = await prisma.category.create({ data: { ...parsed.data, slug, restaurantId: auth.ctx.restaurant.id } });
    await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "CREATE", entity: "Category", entityId: row.id, data: parsed.data });
    return NextResponse.json(row, { status: 201 });
  } catch { return jsonError("Já existe uma categoria com nome equivalente", 409); }
}