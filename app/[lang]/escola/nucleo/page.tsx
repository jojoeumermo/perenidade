// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import pautaBruta from "@/content/escola/assembleia.json";
import { AssembleiaDoNucleo } from "@/components/escola/nucleo/AssembleiaDoNucleo";
import { KitDeQuemFacilita } from "@/components/escola/nucleo/KitDeQuemFacilita";
import { TelaDoNucleo } from "@/components/escola/nucleo/TelaDoNucleo";
import { loadLang } from "@/i18n";
import { textosDaTelaDoNucleo, textosDoNucleo } from "@/i18n/escola/nucleo";
import { textosDaOrganizacao } from "@/i18n/escola/organizacao";
import { textosDaTurma } from "@/i18n/escola/turma";
import { getTracks } from "@/lib/content";
import { carregarCursos } from "@/lib/escola/cursos-servidor";
import { assembleiaAberta, validarPauta } from "@/lib/escola/organizacao";
import { hojeEmBrasilia } from "@/lib/escola/tempo";
import { paginaMeta } from "@/lib/seo";
import "@/styles/escola-organizacao.css";
import "@/styles/escola-turma.css";
import "@/components/escola/nucleo/nucleo.css";

// O dia muda a situação da votação da assembleia (abre, fecha): a página se refaz a cada hora.
export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/nucleo">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const t = textosDoNucleo(lang);
  // Página fechada (só militantes): fora dos buscadores.
  return { ...paginaMeta(lang, "/escola/nucleo", t.meta.titulo, t.meta.descricao), robots: { index: false, follow: false } };
}

/**
 * /escola/nucleo (PLANO-ESCOLA.md, F4; prancha Cel-Núcleo). O layout da Escola só desenha isto para militante conferido
 * no banco; mesmo assim, o servidor manda SÓ o que é público: os textos de interface, o kit de quem facilita, a pauta
 * pública da assembleia e a lista de cursos da ficha da banca. Nome do núcleo, pauta, tarefas, presença, pergunta e
 * bancas vêm das funções do banco no navegador, depois da sessão (lib/escola/nucleo.ts), e a função recusa quem não é
 * militante (risco 1.1 do plano: o que vai como children ao componente de cliente sai no pacote RSC).
 */
export default async function Nucleo({ params }: PageProps<"/[lang]/escola/nucleo">) {
  const { lang } = await loadLang(params);
  const t = textosDaTelaDoNucleo(lang);
  const org = textosDaOrganizacao(lang);
  const turma = textosDaTurma(lang);
  const { pauta } = validarPauta(pautaBruta);
  const com = pauta && pauta.candidatas.length > 0 ? pauta : null;
  const nomes = new Map(com ? getTracks(lang).map((x) => [x.slug, x.title]) : []);
  const candidatas = (com?.candidatas ?? []).map((slug) => ({ slug, titulo: nomes.get(slug) ?? slug }));
  const cursos = carregarCursos().map((c) => ({ slug: c.slug, titulo: c.titulo }));

  return (
    <TelaDoNucleo
      lang={lang}
      t={t}
      kit={<KitDeQuemFacilita lang={lang} t={t.kit} turma={turma} cursos={cursos} />}
      assembleia={<AssembleiaDoNucleo lang={lang} t={t.assembleia} org={org} pauta={com} candidatas={candidatas} situacao={assembleiaAberta(pauta, hojeEmBrasilia())} />}
    />
  );
}
