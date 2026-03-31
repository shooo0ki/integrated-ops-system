"use client";

import { useAuth } from "@/frontend/contexts/auth-context";
import ProjectsClient from "./projects-client";

export default function ProjectsPage() {
  const { role } = useAuth();
  return <ProjectsClient role={role ?? "member"} />;
}
