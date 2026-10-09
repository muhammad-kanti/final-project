import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { AdminDashboard } from "./dashboard";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/");

  return <AdminDashboard name={user.name} />;
}