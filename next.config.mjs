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
  // transpilePackages on line 7 handles local @jettoptx/* resolution
  // via npm workspace symlinks — no webpack/turbo alias overrides needed
  // Future: add async headers() or rewrites() if not using vercel.json
};

export default nextConfig;
