/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
    typedRoutes: true,
  },
  images: {
    domains: ['images.unsplash.com', 'via.placeholder.com', 'cdn.hostaway.com'],
    formats: ['image/webp', 'image/avif'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  async redirects() {
    // Only redirect to manager if env flag is set
    if (process.env.NEXT_PUBLIC_REDIRECT_ROOT_TO_MANAGER === 'true') {
      return [
        {
          source: '/',
          destination: '/manager',
          permanent: false,
        },
      ];
    }
    return [];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
