/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Engine output is generated at build time (prebuild script) and imported
  // statically. No runtime filesystem reads, no env vars required to render.
};

export default nextConfig;
