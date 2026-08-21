/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  serverExternalPackages: ["@resvg/resvg-js", "pdfkit", "svg-to-pdfkit"]
};

export default nextConfig;
