import { auth } from "@/lib/auth/auth";
import { canAccessCrm, isAdminRole } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import CrmClientsApp from "@/components/crm/crm-clients-app";

export default async function CrmPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!canAccessCrm(role)) redirect("/auth");
  return <CrmClientsApp isAdmin={isAdminRole(role)} />;
}
