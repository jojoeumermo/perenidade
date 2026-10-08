// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import type { MetadataRoute } from "next";
import pt from "@/i18n/pt.json";
import { site } from "@/lib/site";

// Permite "instalar" o site na tela inicial do celular.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: "Lúcia",
    description: pt.meta.description,
    start_url: "/",
    display: "standalone",
    background_color: "#f4ecd8",
    theme_color: "#1f1a14",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
