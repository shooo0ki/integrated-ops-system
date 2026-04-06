/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/api/invoices/\\[invoiceId\\]/accounting": ["./src/backend/fonts/**/*"],
  },
};

module.exports = nextConfig;
