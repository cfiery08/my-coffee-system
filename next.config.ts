import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [65, 100],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "xqljcdgphbysfjjjisfx.supabase.co",
        pathname: "/storage/v1/object/public/menu-images/**",
      },
    ],
  },
};

export default nextConfig;
