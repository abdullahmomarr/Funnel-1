/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the tracing root to this app (a stray lockfile in a parent dir would
  // otherwise be auto-selected and mislead serverless file tracing).
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
