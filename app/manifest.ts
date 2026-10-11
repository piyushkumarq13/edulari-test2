import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Edulari",
    short_name: "Edulari",
    description: "Edulari - e-learning platform",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/assets/images/favicon/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/assets/images/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
  };
}
