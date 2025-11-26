// next.config.ts
import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['oracledb'],
  typescript: {
    ignoreBuildErrors: true, // ✅ Disable TypeScript errors
  },
  eslint: {
    ignoreDuringBuilds: true, // ✅ Disable ESLint errors
  },
  webpack: (config, { isServer }) => {
    config.externals = [...(config.externals || []), 'oracledb'];
    return config;
  },
  env: {
    MONGODB_URI: process.env.MONGODB_URI,
    DB_NAME: process.env.DB_NAME,
  },
};

export default nextConfig;