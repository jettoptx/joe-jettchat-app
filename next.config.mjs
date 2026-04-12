/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  serverExternalPackages: ["tweetnacl"],
  transpilePackages: ["@jettoptx/auth", "@jettoptx/chat"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "abs.twimg.com" },
      { protocol: "https", hostname: "**.convex.cloud" }, // for any Convex assets if needed
    ],
  },
  // Webpack alias kept for compatibility; Turbopack alias added below
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@jettoptx/auth": "./packages/jettoptx-auth",
      "@jettoptx/chat": "./packages/jettoptx-chat",
    };
    return config;
  },
  experimental: {
    turbo: {
      resolveAlias: {
        "@jettoptx/auth": "./packages/jettoptx-auth",
        "@jettoptx/chat": "./packages/jettoptx-chat",
      },
    },
  },
  // Future: add async headers() or rewrites() if not using vercel.json
};

export default nextConfig;
