import { createAuthClient } from "better-auth/react";

const baseURL = process.env.NEXT_PUBLIC_APP_URL;
if (!baseURL) {
  throw new Error("NEXT_PUBLIC_APP_URL environment variable is not set");
}

export const authClient = createAuthClient({ baseURL });
