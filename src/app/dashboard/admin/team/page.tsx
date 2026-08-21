import { requireAdminUser } from "@/lib/admin/guard";
import { redirect } from "next/navigation";
import TeamAdminApp from "@/components/admin/team-admin-app";

export default async function TeamPage() {
  const gate = await requireAdminUser();
  if (gate.error) redirect("/auth");
  return <TeamAdminApp />;
}
