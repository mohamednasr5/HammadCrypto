import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // For GitHub Pages deployment, use 'export' for static HTML
  // For Vercel/Node deployment, use 'standalone'
  output: process.env.NEXT_STATIC_EXPORT === 'true' ? 'export' : 'standalone',

  // GitHub Pages serves from /repo-name/ path
  // Uncomment and set your repo name if deploying to GitHub Pages:
  // basePath: '/hammad-crypto',

  // Required for static export with images
  images: {
    unoptimized: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
