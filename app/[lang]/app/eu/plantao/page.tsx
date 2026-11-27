// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDoPlantao } from "@/i18n/plantao";
import { ligado } from "@/lib/recursos";

/**
 * O Plantão de dúvidas dentro do aplicativo (aba Eu): os mesmos canais e textos da página do site, em cartões de uma
 * coluna. O canal da comunidade (Alumia) não aparece aqui: o aplicativo instalado não leva à Alumia. Cada canal abre a
 * página dele no site (pendência registrada). Nenhum canal novo e nenhum horário inventado.
 */
export default async function PlantaoDoApp({ params }: PageProps<"/[lang]/app/eu/plantao">) {
  const { lang, t } = await loadLang(params);
  const p = textosDoPlantao(lang);
  const to = (caminho: string) => localePath(lang, caminho);
  const d = t.more.items as Record<string, string>;
  const canais = [
    { id: "reforco", href: "/reforco", titulo: t.tutoring.title, oque: t.tutoring.lead, ...p.canais.reforco },
    { id: "assistente", href: "/reforco", titulo: t.tutoring.assistant.title, oque: t.tutoring.assistant.lead, ...p.canais.assistente, extra: ligado("escola") ? { href: "/escola/acompanhante", texto: p.canais.assistente.acompanhante } : null },
    { id: "aovivo", href: "/ao-vivo", titulo: t.live.title, oque: t.live.lead, ...p.canais.aovivo },
    { id: "grupo", href: "/estudo-em-grupo", titulo: t.studyGroup.title, oque: t.studyGroup.lead, ...p.canais.grupo },
  ];
  return (
    <div className="app-hub app-plantao-tela">
      <header className="app-hub-cabeca">
        <h1>{p.titulo}</h1>
        <p>{p.lead}</p>
      </header>
      <p className="app-cartao app-plantao-aviso" data-plantao-sem-horario="">{p.semHorario}</p>
      <h2 className="app-titulo-secao">{p.antesTitulo}</h2>
      <p className="app-plantao-texto">{p.antesTexto}</p>
      <ul className="app-plantao-atalhos">
        {[
          [t.nav.search, "/busca"],
          [t.nav.questions, "/perguntas"],
          [t.nav.glossary, "/glossario"],
        ].map(([texto, href]) => (
          <li key={href}>
            <Link href={to(href)} className="app-cartao app-plantao-atalho">{texto}</Link>
          </li>
        ))}
      </ul>
      <p className="app-plantao-texto">{d.questions}</p>
      <h2 className="app-titulo-secao">{p.canaisTitulo}</h2>
      <ul className="app-plantao-canais">
        {canais.map((c) => (
          <li key={c.id} className="app-cartao app-plantao-canal" data-canal={c.id}>
            <h3 className="app-cartao-titulo app-cartao-titulo-menor">{c.titulo}</h3>
            <p className="app-plantao-quem">{c.quem}</p>
            <p className="app-cartao-texto">{c.oque}</p>
            <p className="app-cartao-texto"><strong>{p.comoFunciona}.</strong> {c.como}</p>
            <Link href={to(c.href)} className="app-plantao-abrir">{p.abrir}: {c.titulo}</Link>
            {"extra" in c && c.extra && <Link href={to(c.extra.href)} className="app-plantao-abrir">{c.extra.texto}</Link>}
          </li>
        ))}
      </ul>
      <h2 className="app-titulo-secao">{p.paraEnsinarTitulo}</h2>
      <div className="app-cartao app-plantao-canal" data-canal="salalivre">
        <h3 className="app-cartao-titulo app-cartao-titulo-menor">{t.nav.freeRoom}</h3>
        <p className="app-plantao-quem">{p.canais.salalivre.quem}</p>
        <p className="app-cartao-texto">{t.salaLivre.description}</p>
        <p className="app-cartao-texto"><strong>{p.comoFunciona}.</strong> {p.canais.salalivre.como}</p>
        <Link href={to("/sala-livre")} className="app-plantao-abrir">{p.abrir}: {t.nav.freeRoom}</Link>
      </div>
    </div>
  );
}
