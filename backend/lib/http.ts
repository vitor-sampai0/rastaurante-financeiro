import { NextResponse } from "next/server";
import { getRestaurantContext } from "@/backend/lib/context";

export function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function requireApiContext() {
  const context = await getRestaurantContext();
  if (!context) return { error: jsonError("Não autenticado", 401) };
  if (context.user.mustChangePassword) return { error: jsonError("Troque sua senha antes de continuar", 403) };
  return { ctx: context };
}

export function decimalToNumber<T>(value: T): T {
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber() as T;
  }
  if (Array.isArray(value)) return value.map(decimalToNumber) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decimalToNumber(item)])) as T;
  }
  return value;
}