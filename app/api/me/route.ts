import { NextResponse } from "next/server";
import { getRestaurantContext } from "@/backend/lib/context";

export async function GET() {
  const context = await getRestaurantContext();
  if (!context) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  return NextResponse.json({
    user: { id: context.user.id, name: context.user.name, email: context.user.email },
    restaurant: context.restaurant,
    role: context.membership.role,
  });
}
