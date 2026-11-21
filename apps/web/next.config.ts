import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@spark/core", "@spark/db", "@spark/ai"],
  serverExternalPackages: ["postgres"],
  poweredByHeader: false,
  // Studio sends text read in the browser (notes, .md, captions) with the draft request; files go via Blob.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default config;
