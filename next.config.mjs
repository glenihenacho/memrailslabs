/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
    // The retrieval stack reads the canonical markdown corpus from `knowledge/`
    // at request time (src/lib/memory/corpus.ts). Output file tracing does not
    // pick up runtime fs reads, so include the corpus in every serverless
    // function bundle, otherwise retrieval 500s with ENOENT on Vercel.
    outputFileTracingIncludes: {
      '/**': ['./knowledge/**/*.md'],
    },
  },
};

export default nextConfig;
