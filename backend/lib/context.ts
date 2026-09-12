import { Role } from "@prisma/client";
import { prisma } from "@/backend/lib/prisma";
import { getSessionUser } from "@/backend/lib/session";

export async function getRestaurantContext() {
  const user = await getSessionUser();
  if (!user) return null;

  const membership = await prisma.restaurantMember.findFirst({
    where: { userId: user.id, active: true },
    include: { restaurant: true },
    orderBy: { createdAt: "asc" },
  });

  return membership ? { user, restaurant: membership.restaurant, membership } : null;
}

export function canWrite(role: Role) {
  return new Set<Role>([Role.OWNER, Role.ADMIN, Role.MANAGER, Role.OPERATOR]).has(role);
}

export function canManage(role: Role) {
  return new Set<Role>([Role.OWNER, Role.ADMIN, Role.MANAGER]).has(role);
}

export function canAdmin(role: Role) {
  return new Set<Role>([Role.OWNER, Role.ADMIN]).has(role);
}
