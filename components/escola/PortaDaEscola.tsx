// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import type { TextosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import { useEscola } from "@/lib/escola/acesso";
import { publicaDaEscola } from "@/lib/escola/rotas";
import { Casca } from "./casca/Casca";
import { PortaPublica } from "./porta/PortaPublica";
import { PortaVermelha } from "./porta/PortaVermelha";

/**
 * A porta da Escola Revolucionária Lúcia Maria. Desde a Escola de Formação (PLANO-ESCOLA.md, F1), só entra MILITANTE:
 * quem está no departamento Revolucionários (ou a coordenação), conferido no banco por public.escola_eu
 * (lib/escola/acesso.ts). Conta comum e visitante veem a porta vermelha (components/escola/porta/PortaVermelha.tsx);
 * conta sem militância vê também o aviso de que a inscrição está com a coordenação.
 *
 * Por que a conferência é no banco e não aqui: as páginas chegam a este componente de cliente como "children", e o que um
 * componente de servidor passa como children vai no pacote RSC da resposta mesmo quando a porta não o mostra. Por isso
 * nenhuma página da Escola põe nada de militante no HTML: tudo o que é só de militante vem de função do banco, depois
 * da sessão, e a função recusa quem não é militante. A porta só decide o que DESENHAR.
 *
 * As páginas de PUBLICAS_DA_ESCOLA (lib/escola/rotas.ts: o chamado de militantes e o manifesto) abrem para todo mundo,
 * sem conta e sem a casca. A Escola fechada é só para militantes, que já são maiores de 18 anos (a inscrição militante
 * exige; migracoes/20261106-t15-frente-militantes.sql). A revisão jurídica aberta sobre adolescentes no resto do site
 * (ECA Digital, Lei 15.211/2025, art. 24; LGPD art. 14) continua valendo para as páginas abertas.
 *
 * O servidor manda um "conferindo" neutro (igual na hidratação); sem sessão guardada, a porta aparece sem ir à rede.
 */
export function PortaDaEscola({ lang, t, children }: { lang: Locale; t: Pick<TextosDaFormacaoBase, "porta" | "casca">; children: React.ReactNode }) {
  const caminho = usePathname() ?? "";
  const escola = useEscola();
  // As páginas abertas (o chamado, o manifesto e o entrar) abrem para todo mundo, sempre no desenho da Escola: quem já é
  // militante as lê dentro da casca; os outros, na moldura da porta (PortaPublica), sem cair no papel claro do site.
  if (publicaDaEscola(caminho.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/") && escola.estado !== "militante") {
    return (
      <PortaPublica lang={lang} t={t.porta} caminho={caminho}>
        {children}
      </PortaPublica>
    );
  }
  if (escola.estado === "militante") {
    return (
      <Casca lang={lang} t={t.casca} eu={escola.eu}>
        {children}
      </Casca>
    );
  }
  if (escola.estado === "conferindo") {
    return (
      <div className="ef-conferindo" data-escola-formacao="" data-porta-da-escola="conferindo">
        <p role="status" aria-busy="true">
          {t.porta.conferindo}
        </p>
      </div>
    );
  }
  return <PortaVermelha lang={lang} t={t.porta} situacao={escola.estado} aoTentar={escola.conferirDeNovo} />;
}
