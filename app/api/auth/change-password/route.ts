import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/backend/lib/session";
import { hashPassword, verifyPassword } from "@/backend/lib/security";
import { prisma } from "@/backend/lib/prisma";
import { jsonError } from "@/backend/lib/http";

const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(128) });

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Não autenticado", 401);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Senha inválida");
  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) return jsonError("Senha atual inválida", 400);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.newPassword), mustChangePassword: false } });
  return NextResponse.json({ ok: true });
}