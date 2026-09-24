/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@agentmesh/sdk"],
  experimental: { typedRoutes: false },
  async rewrites() {
    return [
      { source: "/api/control-plane/:path*", destination: `${process.env.CONTROL_PLANE_URL || "http://localhost:3002"}/:path*` },
      { source: "/api/gateway/:path*", destination: `${process.env.GATEWAY_URL || "http://localhost:3001"}/:path*` },
    ];
  },
};

export default nextConfig;
