// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Ignore the old dist folder and cli
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@agents': './src/agents',
      '@core': './src/core',
      '@memory': './src/memory',
      '@tools': './src/tools',
      '@llm': './src/llm',
    };
    return config;
  },
};

export default nextConfig;
