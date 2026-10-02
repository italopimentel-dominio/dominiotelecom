/** @type {import('next').NextConfig} */
const nextConfig = {
  // envio de imagens (capa, prêmio, fotos) pelas server actions
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
};
export default nextConfig;
