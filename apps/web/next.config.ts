import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@spark/core"],
  poweredByHeader: false,
};

export default config;
