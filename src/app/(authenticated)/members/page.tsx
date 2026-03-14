import { getSessionUser } from "@/backend/auth";
import { redirect } from "next/navigation";
import MembersClient from "./members-client";

export default async function MembersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <MembersClient role={user.role} />;
}
