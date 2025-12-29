import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['oracledb'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // ✅ Generate unique build ID on each build
  generateBuildId: async () => {
    return `build-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  },
  
  // ✅ Prevent aggressive caching during development/deployment
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: process.env.NODE_ENV === 'production' 
              ? 'public, max-age=3600, must-revalidate'  // 1 hour cache in production
              : 'no-cache, no-store, must-revalidate',    // No cache in dev
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
      {
        // Stronger cache control for API routes
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
  
  webpack: (config, { isServer }) => {
    config.externals = [...(config.externals || []), 'oracledb'];
    
    // ✅ Suppress fsevents warnings
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