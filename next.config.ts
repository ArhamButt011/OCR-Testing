import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['oracledb'],
  webpack: (config) => {
    config.externals = [...(config.externals || []), 'oracledb'];
    return config;
  },
  env: {
    MONGODB_URI: process.env.MONGODB_URI,
    DB_NAME: process.env.DB_NAME,
  },
};

export default nextConfig;
