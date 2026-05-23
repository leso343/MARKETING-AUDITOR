import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Blank Page Audits",
    short_name: "BPA",
    description:
      "Forensic Meta Ads audits that surface budget leaks, funnel gaps, and wasted spend.",
    start_url: "/",
    display: "standalone",
    background_color: "#030303",
    theme_color: "#ff0000",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
