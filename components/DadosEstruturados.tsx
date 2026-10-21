// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import { emTexto, type JsonLd } from "@/lib/dados-estruturados";

/** Os dados estruturados da página (JSON-LD), lidos pelos buscadores. Não executa nada: é um bloco de dados. */
export function DadosEstruturados({ dados }: { dados: JsonLd | JsonLd[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: emTexto(dados) }} />;
}
