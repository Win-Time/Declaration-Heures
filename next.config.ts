import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // `X-Robots-Tag` couvre aussi ce qui n'est pas du HTML (image de
        // partage, réponses d'API) et vaut pour les robots qui ne lisent pas
        // la balise meta.
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
