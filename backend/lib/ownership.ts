import { prisma } from "@/backend/lib/prisma";

export async function refsBelongToRestaurant(restaurantId: string, refs: {
  categoryId?: string | null;
  accountId?: string | null;
  supplierId?: string | null;
  employeeId?: string | null;
  itemId?: string | null;
}) {
  const [category, account, supplier, employee, item] = await Promise.all([
    refs.categoryId ? prisma.category.findFirst({ where: { id: refs.categoryId, restaurantId } }) : null,
    refs.accountId ? prisma.account.findFirst({ where: { id: refs.accountId, restaurantId } }) : null,
    refs.supplierId ? prisma.supplier.findFirst({ where: { id: refs.supplierId, restaurantId } }) : null,
    refs.employeeId ? prisma.employee.findFirst({ where: { id: refs.employeeId, restaurantId } }) : null,
    refs.itemId ? prisma.inventoryItem.findFirst({ where: { id: refs.itemId, restaurantId } }) : null,
  ]);
  return (!refs.categoryId || !!category) && (!refs.accountId || !!account) && (!refs.supplierId || !!supplier) && (!refs.employeeId || !!employee) && (!refs.itemId || !!item);
}