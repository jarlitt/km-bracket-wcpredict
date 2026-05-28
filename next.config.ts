import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  async redirects() {
    return [
      {
        source: '/pools/all-offices',
        destination: '/leaderboard',
        permanent: true,
      },
      {
        source: '/pools/all-offices/:path*',
        destination: '/leaderboard',
        permanent: true,
      },
      {
        source: '/predict/thirds',
        destination: '/predict/groups?group=thirds',
        permanent: true,
      },
      {
        source: '/pools/:slug/predict',
        destination: '/predict/groups',
        permanent: true,
      },
      {
        source: '/pools/:slug/predict/:rest*',
        destination: '/predict/:rest*',
        permanent: true,
      },
      {
        source: '/pools/:slug/dashboard',
        destination: '/pools/:slug',
        permanent: true,
      },
      {
        source: '/pools',
        destination: '/leaderboard',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
