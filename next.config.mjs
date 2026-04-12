/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["tweetnacl"],
  },
  transpilePackages: ["@jettoptx/auth", "@jettoptx/chat"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "abs.twimg.com" },
    ],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@jettoptx/auth": "./packages/jettoptx-auth",
      "@jettoptx/chat": "./packages/jettoptx-chat",
    };
    return config;
  },
};

export default nextConfig;
