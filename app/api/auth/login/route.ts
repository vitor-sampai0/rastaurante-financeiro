import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/lib/prisma";
import { createSession } from "@/backend/lib/session";
import { verifyPassword } from "@/backend/lib/security";

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return NextResponse.json({ error: "E-mail ou senha inválidos" }, { status: 401 });
    }

    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Não foi possível concluir o login" }, { status: 500 });
  }
}
