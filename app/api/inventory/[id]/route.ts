import { NextResponse } from "next/server";
import { z } from "zod";
import { canAdmin } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";
import { audit } from "@/backend/lib/audit";
import { decimalToNumber, jsonError, requireApiContext } from "@/backend/lib/http";

const unitSchema = z.enum(["un", "kg", "g", "L", "ml", "cx", "pct", "fd", "dz", "PP", "P", "M", "G", "GG", "XGG", "2XGG"]);
const schema = z.object({
  name: z.string().trim().min(2).max(120),
  unit: unitSchema,
  currentStock: z.coerce.number().nonnegative(),
  minimumStock: z.coerce.number().nonnegative(),
  averageCost: z.coerce.number().nonnegative(),
});

function requiresWholeQuantity(unit: string) {
  return ["un", "cx", "pct", "fd", "dz", "PP", "P", "M", "G", "GG", "XGG", "2XGG"].includes(unit);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiContext();
  if ("error" in auth) return auth.error;
  if (!canAdmin(auth.ctx.membership.role)) return jsonError("Sem permissão", 403);
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Dados inválidos");
  if (requiresWholeQuantity(parsed.data.unit) && (!Number.isInteger(parsed.data.currentStock) || !Number.isInteger(parsed.data.minimumStock))) {
    return jsonError(`O tamanho ${parsed.data.unit} aceita apenas quantidades inteiras`);
  }

  const current = await prisma.inventoryItem.findFirst({ where: { id, restaurantId: auth.ctx.restaurant.id } });
  if (!current) return jsonError("Produto não encontrado", 404);
  const movementTotal = await prisma.stockMovement.aggregate({
    where: { itemId: id },
    _sum: { quantity: true },
  });
  const hasMovements = Number(movementTotal._sum.quantity ?? 0) > 0;
  if (hasMovements && parsed.data.currentStock !== Number(current.currentStock)) {
    return jsonError("O estoque atual deve ser alterado por uma movimentação.", 409);
  }

  try {
    const row = await prisma.inventoryItem.update({
      where: { id },
      data: {
        name: parsed.data.name,
        unit: parsed.data.unit,
        currentStock: parsed.data.currentStock.toFixed(3),
        minimumStock: parsed.data.minimumStock.toFixed(3),
        averageCost: parsed.data.averageCost.toFixed(2),
      },
    });
    await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "UPDATE", entity: "InventoryItem", entityId: id, data: { before: current, after: parsed.data } });
    return NextResponse.json(decimalToNumber(row));
  } catch {
    return jsonError("Já existe um item com esse nome", 409);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiContext();
  if ("error" in auth) return auth.error;
  if (!canAdmin(auth.ctx.membership.role)) return jsonError("Sem permissão", 403);
  const { id } = await params;
  const current = await prisma.inventoryItem.findFirst({ where: { id, restaurantId: auth.ctx.restaurant.id } });
  if (!current) return jsonError("Produto não encontrado", 404);
  const movementCount = await prisma.stockMovement.count({ where: { itemId: id } });
  if (movementCount > 0) return jsonError("Produtos com movimentações não podem ser excluídos", 409);
  await prisma.inventoryItem.delete({ where: { id } });
  await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "DELETE", entity: "InventoryItem", entityId: id, data: current });
  return NextResponse.json({ success: true });
}
