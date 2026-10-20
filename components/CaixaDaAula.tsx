// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { localePath } from "@/i18n/config";
import { areaLabs, areaTools, LABS, tools, universalTools, type AreaSlug, type ToolId } from "@/lib/areas";
import { secaoDaFerramenta } from "@/lib/ferramentas/secoes";
import { Caixa } from "./Caixa";

/**
 * Monta a caixa de ferramentas de uma aula, trilha ou estante: primeiro as que a aula sugere, depois as da disciplina,
 * por fim as universais. Só os textos dessas ferramentas seguem para o navegador.
 */
export function CaixaDaAula({ t, lang, area, sugeridas = [] }: { t: Dict; lang: Locale; area: AreaSlug; sugeridas?: ToolId[] }) {
  const lista = [...new Set([...sugeridas, ...((areaTools[area] ?? []) as ToolId[]), ...universalTools])].filter((id): id is ToolId => (tools as readonly string[]).includes(id));
  const textos = t.tools as unknown as Record<string, unknown>;
  const s = Object.fromEntries([...new Set(lista.map((id) => secaoDaFerramenta[id]))].map((secao) => [secao, textos[secao]]));
  const nomes = Object.fromEntries(lista.map((id) => [id, (t.toolNames as Record<string, string[]>)[id]]));
  // Os laboratórios da disciplina (Linux, IDE, simulações…) entram na mesma caixa, depois das ferramentas.
  const textosDosLabs = t.labs as unknown as Record<string, string>;
  const laboratorios = (areaLabs[area] ?? []).map((id) => ({ id, nome: textosDosLabs[id] ?? id, caminho: localePath(lang, LABS[id]) }));
  return <Caixa ferramentas={lista} sugeridas={sugeridas} area={area} nomes={nomes} s={{ ...s, box: t.tools.box }} lang={lang} laboratorios={laboratorios} />;
}
