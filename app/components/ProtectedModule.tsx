import { redirect } from "next/navigation";
import { getRestaurantContext } from "@/backend/lib/context";
import AdminModule from "@/app/components/AdminModule";
import type { ComponentProps } from "react";

export default async function ProtectedModule({
  module,
}: {
  module: ComponentProps<typeof AdminModule>["module"];
}) {
  if (!(await getRestaurantContext())) redirect("/");
  return <AdminModule module={module} />;
}
