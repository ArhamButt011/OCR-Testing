import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['oracledb'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // ✅ Generate completely unique build ID every time
  generateBuildId: async () => {
    return `build-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  },
  
  // ✅ NUCLEAR cache prevention
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store',
          },
        ],
      },
      {
        // Extra aggressive for static files
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ];
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