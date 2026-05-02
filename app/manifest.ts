import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Heritage Cooperative",
    short_name: "Heritage Coop",
    description: "Save daily. Build wealth. Access loans.",
    id: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#059669",
    orientation: "portrait",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    screenshots: [
      {
        src: "/screenshots/screenshot-1.png",
        sizes: "484x1025",
        type: "image/png",
        // @ts-ignore — Next.js type doesn't include form_factor yet
        form_factor: "narrow",
      },
      {
        src: "/screenshots/screenshot-2.png",
        sizes: "1343x598",
        type: "image/png",
        // @ts-ignore — Next.js type doesn't include form_factor yet
        form_factor: "wide",
      },
    ],
  };
}
