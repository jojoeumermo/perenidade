import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Permite "instalar" o site na tela inicial do celular.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: "Lucia",
    description: site.description,
    start_url: "/",
    display: "standalone",
    background_color: "#f4ecd8",
    theme_color: "#1f1a14",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
