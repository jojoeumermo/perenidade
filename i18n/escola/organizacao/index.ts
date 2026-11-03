// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { escolher } from "../../../lib/escola/textos";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";

// Os textos da organização estudantil da Escola (Etapa 4, pacote E4-12), nos 6 idiomas: assembleia, Roda do semestre,
// roteiro do núcleo, ouvidoria e educador do mês. Só o servidor importa este arquivo: a página escolhe o idioma e passa a
// parte de cada componente por props. Componente de cliente importa daqui só o tipo.

export type TextosDaOrganizacao = typeof pt;

const TEXTOS = { pt, en, es, fr, ru, zh } satisfies Record<string, TextosDaOrganizacao>;

export function textosDaOrganizacao(lang: string): TextosDaOrganizacao {
  return escolher(TEXTOS, lang);
}
