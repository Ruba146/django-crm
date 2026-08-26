import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native Node modules used by the service layer (better-sqlite3) must
  // be treated as external so they are not bundled into the client/server
  // graph. They are only ever imported from server-side code.
  serverExternalPackages: ["better-sqlite3", "sqlite3"],
};

export default nextConfig;
