import { StockMovementType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canAdmin } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";
import { decimalToNumber, jsonError, requireApiContext } from "@/backend/lib/http";

const schema = z.object({
  itemId: z.string().min(1),
  type: z.enum(StockMovementType),
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().nonnegative().optional(),
  reason: z.string().trim().min(1).max(500),
});

type StockSnapshot = {
  itemId: string;
  baseStock: number;
};

function requiresWholeQuantity(unit: string) {
  return ["un", "cx", "pct", "fd", "dz"].includes(unit);
}

function validateQuantityForUnit(quantity: number, unit: string) {
  return !requiresWholeQuantity(unit) || Number.isInteger(quantity);
}

async function getStockSnapshot(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], itemId: string) {
  const item = await tx.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) return null;
  const movements = await tx.stockMovement.findMany({ where: { itemId }, select: { type: true, quantity: true } });
  const movementDelta = movements.reduce(
    (total, movement) => total + (movement.type === "IN" ? Number(movement.quantity) : -Number(movement.quantity)),
    0,
  );
  return { itemId, baseStock: Number(item.currentStock) - movementDelta } satisfies StockSnapshot;
}

async function recalculateStock(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  snapshot: StockSnapshot,
) {
  const movements = await tx.stockMovement.findMany({
    where: { itemId: snapshot.itemId },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: { type: true, quantity: true },
  });
  const currentStock = movements.reduce(
    (total, movement) => total + (movement.type === "IN" ? Number(movement.quantity) : -Number(movement.quantity)),
    snapshot.baseStock,
  );
  if (currentStock < 0) throw new Error("Estoque insuficiente");
  await tx.inventoryItem.update({
    where: { id: snapshot.itemId },
    data: { currentStock: currentStock.toFixed(3) },
  });
  return currentStock;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível atualizar a movimentação";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiContext();
  if ("error" in auth) return auth.error;
  if (!canAdmin(auth.ctx.membership.role)) return jsonError("Sem permissão", 403);

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Dados inválidos");

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.stockMovement.findFirst({
        where: { id, restaurantId: auth.ctx.restaurant.id },
        include: { item: true },
      });
      if (!current) throw new Error("Movimentação não encontrada");

      const targetItem = await tx.inventoryItem.findFirst({
        where: { id: parsed.data.itemId, restaurantId: auth.ctx.restaurant.id, active: true },
      });
      if (!targetItem) throw new Error("Produto inválido");
      if (!validateQuantityForUnit(parsed.data.quantity, targetItem.unit)) {
        throw new Error(`A unidade ${targetItem.unit} aceita apenas quantidades inteiras`);
      }

      const itemIds = [...new Set([current.itemId, parsed.data.itemId])];
      const snapshots = (await Promise.all(itemIds.map((itemId) => getStockSnapshot(tx, itemId)))).filter(
        (snapshot): snapshot is StockSnapshot => snapshot !== null,
      );

      await tx.stockMovement.update({
        where: { id },
        data: {
          itemId: parsed.data.itemId,
          type: parsed.data.type,
          quantity: parsed.data.quantity.toFixed(3),
          unitCost: parsed.data.unitCost?.toFixed(2),
          reason: parsed.data.reason,
        },
      });

      for (const snapshot of snapshots) await recalculateStock(tx, snapshot);

      const updated = await tx.stockMovement.findUnique({ where: { id }, include: { item: true } });
      if (!updated) throw new Error("Movimentação não encontrada");
      await tx.auditLog.create({
        data: {
          restaurantId: auth.ctx.restaurant.id,
          actorUserId: auth.ctx.user.id,
          action: "UPDATE",
          entity: "StockMovement",
          entityId: id,
          data: { before: current, after: parsed.data },
        },
      });
      return updated;
    });
    return NextResponse.json(decimalToNumber(result));
  } catch (error) {
    const message = errorMessage(error);
    return jsonError(message, message === "Estoque insuficiente" ? 409 : message === "Movimentação não encontrada" ? 404 : 400);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiContext();
  if ("error" in auth) return auth.error;
  if (!canAdmin(auth.ctx.membership.role)) return jsonError("Sem permissão", 403);

  const { id } = await params;
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.stockMovement.findFirst({
        where: { id, restaurantId: auth.ctx.restaurant.id },
        include: { item: true },
      });
      if (!current) throw new Error("Movimentação não encontrada");

      const snapshot = await getStockSnapshot(tx, current.itemId);
      await tx.stockMovement.delete({ where: { id } });
      if (snapshot) await recalculateStock(tx, snapshot);
      await tx.auditLog.create({
        data: {
          restaurantId: auth.ctx.restaurant.id,
          actorUserId: auth.ctx.user.id,
          action: "DELETE",
          entity: "StockMovement",
          entityId: id,
          data: { movement: current },
        },
      });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = errorMessage(error);
    return jsonError(message, message === "Movimentação não encontrada" ? 404 : 400);
  }
}
