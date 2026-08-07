/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Assets alojados en R2. Pasar por el optimizador de Next es importante:
    // el PNG original del logo pesa ~12 MB y se sirve reescalado a ~pocos KB.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-a6844436cdf343eca77a9769bb10e73e.r2.dev',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;
