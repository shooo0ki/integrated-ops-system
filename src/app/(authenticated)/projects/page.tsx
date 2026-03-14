import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProjectsClient from "./projects-client";

export default async function ProjectsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <ProjectsClient role={user.role} />;
}
