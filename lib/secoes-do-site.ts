// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { ligado } from "@/lib/recursos";
import { textosDoEstudo } from "@/lib/textos-estudo";

export interface SecaoDoSite {
  title: string;
  items: { label: string; path: string; description: string; short: string }[];
}

type Item = [string, string, string];

/**
 * Tudo o que não cabe no menu do topo, por objetivo. A mesma lista abre na janela do "Mais" (no cabeçalho e nas
 * abas do celular) e na página /explorar, que fica para quem navega sem JavaScript.
 */
export function secoesDoSite(lang: Locale, t: Dict): SecaoDoSite[] {
  const n = t.nav;
  // Recursos novos (lib/recursos.ts): só entram na lista quando ligados.
  const novos = textosDoEstudo(lang).s;
  const d = t.more.items as Record<string, string>;
  const curtas = t.more.short as Record<string, string>;
  // A descrição curta (duas ou três palavras) vai ao lado do nome na janela do "Mais"; a longa fica na dica e no celular.
  const itens = (lista: Item[]) => lista.map(([label, path, description]) => ({ label, path, description, short: curtas[path] ?? "" }));
  const se = (recurso: Parameters<typeof ligado>[0], item: Item): Item[] => (ligado(recurso) ? [item] : []);
  return [
    {
      title: t.lists.study,
      items: itens([
        [n.disciplines, "/trilhas", t.tracks.lead],
        [n.despertar, "/despertar", d.despertar],
        [n.start, "/comecar", d.start],
        [n.questions, "/perguntas", d.questions],
        [n.library, "/acervo", t.library.lead],
        [n.live, "/ao-vivo", d.live],
        [n.videoLessons, "/videoaulas", d.videoLessons],
        [n.videos, "/videos", d.videos],
        [n.notebook, "/caderno", d.notebook],
        ...se("meu-estudo", [novos.meuEstudo.titulo, "/meu-estudo", novos.meuEstudo.descricao]),
        ...se("nivelamento", [novos.nivelamento.titulo, "/nivelamento", novos.nivelamento.descricao]),
        ...se("turma", [novos.turma.titulo, "/turma", novos.turma.descricao]),
        ...se("professores", [novos.professores.titulo, "/professores", novos.professores.descricao]),
        ...se("guia-contribuir", [novos.guia.titulo, "/contribuir/guia", novos.guia.descricao]),
        [n.tutoring, "/reforco", d.tutoring],
        [n.tools, "/ferramentas", d.tools],
        [n.labs, "/laboratorios", t.labs.lead],
        [n.freeRoom, "/sala-livre", d.freeRoom],
        [n.questionBank, "/questoes", t.lists.bankLead],
        [n.glossary, "/glossario", d.glossary],
        [n.authors, "/autores", d.authors],
        [n.sources, "/guia", d.sources],
        [n.drawer, "/gaveta", d.drawer],
      ]),
    },
    {
      title: t.lists.inform,
      items: itens([
        [n.journal, "/jornal", d.journal],
        [n.news, "/noticias", d.news],
        [n.podcasts, "/podcasts", d.podcasts],
        [n.radio, "/radio", d.radio],
        [n.factCheck, "/checagens", d.factCheck],
        [n.fallacies, "/falacias", d.fallacies],
        [n.debates, "/debates", d.debates],
        [n.data, "/dados", d.data],
        [n.timeline, "/linha-do-tempo", d.timeline],
        [n.gallery, "/galeria", d.gallery],
        [n.memorial, "/memorial", d.memorial],
        [n.materials, "/materiais", d.materials],
        [n.mural, "/mural", d.mural],
        [n.community, "/comunidade", d.community ?? n.community],
        [n.territories, "/territorios", d.territories],
        [t.receba.menu, "/receba", t.receba.menuDescricao],
        [n.health, "/saude", d.health],
        [n.rightsGuide, "/direitos", d.rightsGuide],
        [n.reportBug, "/relatar-erro", d.bugs],
      ]),
    },
    {
      title: t.lists.help,
      items: itens([
        [n.volunteers, "/voluntarios", d.volunteers],
        [n.contribute, "/contribuir", d.contribute],
        [n.support, "/apoie", d.support],
        [n.contributors, "/contribuidores", d.contributors],
        [n.conduct, "/conduta", d.conduct],
        [n.usePolicy, "/uso", d.usePolicy],
        [n.copyright, "/direitos-autorais", d.copyright],
      ]),
    },
    {
      title: t.lists.about,
      items: itens([
        [n.about, "/sobre", d.about],
        [n.team, "/quem-somos", d.team ?? n.team],
        [n.dedication, "/dedicatoria", d.dedication],
        [n.myData, "/meus-dados", d.myData],
        [n.privacy, "/privacidade", d.privacy],
        [n.terms, "/termos", d.terms],
      ]),
    },
  ];
}
