/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // Only expose NEXT_PUBLIC_* variables to the browser
    // All other variables will remain server-side only
  },
  // Ensure Azure OpenAI API keys are not exposed to the client
  serverRuntimeConfig: {
    // Server-only env vars (not exposed to the browser)
    AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_DEPLOYMENT_EMBEDDING: process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING,
    AZURE_OPENAI_DEPLOYMENT_TURBO: process.env.AZURE_OPENAI_DEPLOYMENT_TURBO,
    AZURE_OPENAI_DEPLOYMENT_GPT4: process.env.AZURE_OPENAI_DEPLOYMENT_GPT4,
    AZURE_OPENAI_DEPLOYMENT_OMNI: process.env.AZURE_OPENAI_DEPLOYMENT_OMNI,
  },
  // Public Firebase config is already prefixed with NEXT_PUBLIC_
  publicRuntimeConfig: {
    // Public env vars (exposed to the browser)
  },
  // Webpack configuration to handle OpenAI package
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle server-only packages on the client
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
