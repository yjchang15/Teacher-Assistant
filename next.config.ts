import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native/WASM server deps out of the bundle so they resolve their own
  // asset files (PGlite WASM, postgres driver) at runtime.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
};

export default nextConfig;
