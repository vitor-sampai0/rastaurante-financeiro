import { NextResponse } from "next/server";
import { StockMovementType } from "@prisma/client";
import { z } from "zod";
import { canWrite } from "@/backend/lib/context";
import { prisma } from "@/backend/lib/prisma";
import { audit } from "@/backend/lib/audit";
import { decimalToNumber, jsonError, requireApiContext } from "@/backend/lib/http";
const schema = z.object({ itemId: z.string(), type: z.enum(StockMovementType), quantity: z.coerce.number().positive(), unitCost: z.coerce.number().nonnegative().optional(), reason: z.string().trim().min(1).max(500) });

function requiresWholeQuantity(unit: string) {
	return ["un", "cx", "pct", "fd", "dz"].includes(unit);
}
export async function GET() {
	const auth = await requireApiContext();
	if ("error" in auth) return auth.error;

	const movements = (await prisma.stockMovement.findMany({
		where: { restaurantId: auth.ctx.restaurant.id },
		include: { item: true },
		orderBy: { occurredAt: "desc" },
		take: 500,
	})).reverse();
	const audits = await prisma.auditLog.findMany({
		where: { restaurantId: auth.ctx.restaurant.id, entity: "StockMovement" },
		include: { actor: { select: { name: true } } },
	});
	const auditByMovementId = new Map(audits.map((audit) => [audit.entityId, audit.actor.name]));
	const totalDeltaByItem = new Map<string, number>();
	const startingStockByItem = new Map<string, number>();

	for (const movement of movements) {
		const delta = movement.type === "IN" ? Number(movement.quantity) : -Number(movement.quantity);
		totalDeltaByItem.set(movement.itemId, (totalDeltaByItem.get(movement.itemId) ?? 0) + delta);
		startingStockByItem.set(movement.itemId, Number(movement.item.currentStock));
	}

	for (const [itemId, totalDelta] of totalDeltaByItem) {
		startingStockByItem.set(itemId, (startingStockByItem.get(itemId) ?? 0) - totalDelta);
	}

	const stockAfterByMovement = new Map<string, number>();
	const stockAfterByItem = new Map<string, number>();
	for (const movement of movements) {
		const stockAfter = (stockAfterByItem.get(movement.itemId) ?? startingStockByItem.get(movement.itemId) ?? 0) + (movement.type === "IN" ? Number(movement.quantity) : -Number(movement.quantity));
		stockAfterByItem.set(movement.itemId, stockAfter);
		stockAfterByMovement.set(movement.id, stockAfter);
	}

	const enriched = movements.map((movement) => {
		return {
			...movement,
			stockBefore: (stockAfterByMovement.get(movement.id) ?? Number(movement.item.currentStock)) - (movement.type === "IN" ? Number(movement.quantity) : -Number(movement.quantity)),
			stockAfter: stockAfterByMovement.get(movement.id) ?? Number(movement.item.currentStock),
			actor: { name: auditByMovementId.get(movement.id) ?? "Usuário do sistema" },
		};
	});

	return NextResponse.json(decimalToNumber(enriched.reverse()));
}
export async function POST(request: Request) {
	const auth = await requireApiContext();
	if ("error" in auth) return auth.error;
	if (!canWrite(auth.ctx.membership.role)) return jsonError("Sem permissão", 403);
	const p = schema.safeParse(await request.json().catch(() => null));
	if (!p.success) return jsonError("Dados inválidos");
	const item = await prisma.inventoryItem.findFirst({ where: { id: p.data.itemId, restaurantId: auth.ctx.restaurant.id, active: true } });
	if (!item) return jsonError("Item inválido", 400);
	if (requiresWholeQuantity(item.unit) && !Number.isInteger(p.data.quantity)) return jsonError(`A unidade ${item.unit} aceita apenas quantidades inteiras`);
	const delta = p.data.type === "IN" ? p.data.quantity : -p.data.quantity;
	const nextStock = Number(item.currentStock) + delta;
	if (nextStock < 0) return jsonError("Estoque insuficiente", 409);
	const row = await prisma.$transaction(async (tx) => {
		const movement = await tx.stockMovement.create({ data: { ...p.data, quantity: p.data.quantity.toFixed(3), unitCost: p.data.unitCost?.toFixed(2), restaurantId: auth.ctx.restaurant.id } });
		await tx.inventoryItem.update({ where: { id: item.id }, data: { currentStock: nextStock.toFixed(3), averageCost: p.data.type === "IN" && p.data.unitCost ? ((Number(item.averageCost) * Number(item.currentStock) + p.data.unitCost * p.data.quantity) / Math.max(nextStock, 1)).toFixed(2) : item.averageCost } });
		return movement;
	});
	await audit({ restaurantId: auth.ctx.restaurant.id, actorUserId: auth.ctx.user.id, action: "CREATE", entity: "StockMovement", entityId: row.id, data: p.data });
	return NextResponse.json(decimalToNumber(row), { status: 201 });
}