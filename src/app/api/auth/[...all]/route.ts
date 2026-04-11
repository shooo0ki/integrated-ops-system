export const dynamic = "force-dynamic";

import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/backend/auth";

export const { GET, POST } = toNextJsHandler(auth);
