// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { MetadataRoute } from "next";
import pt from "@/i18n/pt.json";
import { montarManifesto } from "@/lib/manifesto";

// Permite "instalar" o site na tela inicial do celular e abri-lo como um aplicativo.
// Este é o manifesto padrão (português, /manifest.webmanifest). Cada idioma tem o seu em /[lang]/manifest.webmanifest,
// ligado pelo layout do idioma (app/[lang]/layout.tsx), com o start_url no próprio idioma.
export default function manifest(): MetadataRoute.Manifest {
  return montarManifesto("pt", pt);
}
