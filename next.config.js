/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/invoices/\\[invoiceId\\]/accounting": ["./src/backend/fonts/**/*"],
    },
  },
};

module.exports = nextConfig;
