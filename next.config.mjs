/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/netsuite",
  output: "standalone", // Recommended for production
  async rewrites() {
    return [
      {
        source: "/:path*",
        destination: "/:path*",
      },
      // Handle API routes
      {
        source: "/api/:path*",
        destination: "/api/:path*",
      },
    ];
  },
};

export default nextConfig;
