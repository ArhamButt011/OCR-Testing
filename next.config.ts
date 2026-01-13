import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['oracledb'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  webpack: (config, { isServer }) => {
    config.externals = [...(config.externals || []), 'oracledb'];
    
    if (isServer) {
      config.externals.push({
        'fsevents': 'commonjs fsevents'
      });
    }
    
    config.ignoreWarnings = [
      { module: /node_modules\/chokidar/ }
    ];
    
    return config;
  },
  
  env: {
    MONGODB_URI: process.env.MONGODB_URI,
    DB_NAME: process.env.DB_NAME,
  },
};

export default nextConfig;