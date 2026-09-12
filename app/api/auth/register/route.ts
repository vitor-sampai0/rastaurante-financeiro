import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/lib/prisma";
import { createSession } from "@/backend/lib/session";
import { hashPassword } from "@/backend/lib/security";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  restaurantName: z.string().trim().min(2).max(120),
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  try {
    const parsed = registerSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Confira os dados informados" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return NextResponse.json({ error: "Este e-mail já está cadastrado" }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: { name: parsed.data.name, email: parsed.data.email, passwordHash },
      });
      const restaurant = await transaction.restaurant.create({
        data: { name: parsed.data.restaurantName },
      });
      await transaction.restaurantMember.create({
        data: { userId: createdUser.id, restaurantId: restaurant.id, role: "OWNER" },
      });
      return createdUser;
    });

    await createSession(user.id);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Não foi possível criar o acesso" }, { status: 500 });
  }
}
