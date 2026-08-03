import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // kb/ markdown is read with fs at runtime by the agent; make sure the
  // serverless trace bundles it for every route.
  outputFileTracingIncludes: {
    "/api/chat": ["./kb/**/*"],
  },
};

export default nextConfig;
