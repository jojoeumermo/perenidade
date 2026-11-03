// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DebateDaTurma } from "@/components/escola/agentes/DebateDaTurma";
import { Entrevista } from "@/components/escola/agentes/Entrevista";
import { Moldura } from "@/components/escola/agentes/Moldura";
import { Oratoria } from "@/components/escola/agentes/Oratoria";
import { Papelada } from "@/components/escola/agentes/Papelada";
import { RascunhoDoEducador } from "@/components/escola/agentes/RascunhoDoEducador";
import { RevisaoDeConteudo } from "@/components/escola/agentes/RevisaoDeConteudo";
import { TraducaoSupervisionada } from "@/components/escola/agentes/TraducaoSupervisionada";
import { loadLang } from "@/i18n";
import { textosDoAcompanhante } from "@/i18n/escola/acompanhante";
import { textosDosAgentes } from "@/i18n/escola/agentes";
import { AGENTES, agenteDe } from "@/lib/escola/agentes";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";

type Props = { params: Promise<{ lang: string; agente: string }> };

// Os 7 agentes saem na montagem (sem leitura de disco, sem rede); outro nome dá 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return AGENTES.map((a) => ({ agente: a.chave }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { agente } = await params;
  const a = agenteDe(agente);
  if (!a) notFound();
  const s = textosDosAgentes(lang);
  const t = s[a.chave];
  return paginaMeta(lang, a.caminho, `${t.titulo} · ${textosDaBase(lang).meta.titulo}`, t.lead);
}

/** Um agente (E4-16, docs/escola/agentes.md). Os 5 que usam o servidor dizem o que vai antes do botão; revisão e tradução ficam no aparelho. */
export default async function PaginaDoAgente({ params }: Props) {
  const { lang } = await loadLang(params);
  const { agente } = await params;
  const a = agenteDe(agente);
  if (!a) notFound();
  const s = textosDosAgentes(lang);
  const acompanhante = textosDoAcompanhante(lang);
  const t = s[a.chave];
  return (
    <Moldura lang={lang} eyebrow={textosDaBase(lang).meta.titulo} chave={a.chave} titulo={t.titulo} lead={t.lead} usaServidor={a.usaServidor} comum={s.comum}>
      {a.chave === "entrevista" && <Entrevista s={s.entrevista} comum={s.comum} a={acompanhante} />}
      {a.chave === "oratoria" && <Oratoria s={s.oratoria} comum={s.comum} a={acompanhante} />}
      {a.chave === "papelada" && <Papelada s={s.papelada} comum={s.comum} a={acompanhante} />}
      {a.chave === "turma" && <DebateDaTurma s={s.turma} comum={s.comum} a={acompanhante} />}
      {a.chave === "educador" && <RascunhoDoEducador s={s.educador} comum={s.comum} a={acompanhante} />}
      {a.chave === "revisao" && <RevisaoDeConteudo s={s.revisao} />}
      {a.chave === "traducao" && <TraducaoSupervisionada s={s.traducao} />}
    </Moldura>
  );
}
