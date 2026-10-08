// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // O painel e a entrada não têm nada para os buscadores.
  return { rules: { userAgent: "*", allow: "/", disallow: ["/*/painel", "/*/entrar"] }, sitemap: `${site.url}/sitemap.xml` };
}
