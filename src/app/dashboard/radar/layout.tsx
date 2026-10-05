import { requireAdminUser } from "@/lib/admin/guard";
import RadarNav from "@/components/radar/radar-nav";
import { redirect } from "next/navigation";

export default async function RadarLayout({ children }: { children: React.ReactNode }) {
  const gate = await requireAdminUser();
  if (gate.error) redirect("/dashboard");
  return (
    <div>
      <RadarNav />
      {children}
    </div>
  );
}
