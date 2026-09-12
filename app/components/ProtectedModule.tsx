import { redirect } from "next/navigation";
import { getRestaurantContext } from "@/backend/lib/context";
import AdminModule from "@/app/components/AdminModule";
import type { ComponentProps } from "react";

export default async function ProtectedModule({
  module,
}: {
  module: ComponentProps<typeof AdminModule>["module"];
}) {
  const context = await getRestaurantContext();
  if (!context) redirect("/");
  if (context.user.mustChangePassword) redirect("/change-password");
  return <AdminModule module={module} role={context.membership.role} />;
}
