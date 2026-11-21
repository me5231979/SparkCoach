import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@spark/core", "@spark/db", "@spark/ai"],
  serverExternalPackages: ["postgres"],
  poweredByHeader: false,
};

export default config;
