/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  transpilePackages: ['nouislider'],
  experimental: {
    externalDir: true
  }
}

module.exports = nextConfig
