// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { loadLang } from "@/i18n";
import { htmlLang, localePath } from "@/i18n/config";
import { getArticles } from "@/lib/content";
import { materiaEmDestaque } from "@/lib/jornal/selecao";

export const revalidate = 3600;

/**
 * O Jornal dentro do aplicativo (aba Eu): a lista das matérias, a mais nova primeiro, com a em destaque no topo. Sem matéria
 * mostra o aviso "no prelo". Abrir uma matéria ainda leva à página dela no site (o leitor inteiro, com fontes e "Leia
 * também", mora lá): pendência registrada, não tratada como pronta.
 */
export default async function JornalDoApp({ params }: PageProps<"/[lang]/app/eu/jornal">) {
  const { lang, t } = await loadLang(params);
  const s = t.journal;
  const materias = getArticles(lang);
  const destaque = materiaEmDestaque(materias);
  const data = new Intl.DateTimeFormat(htmlLang[lang], { day: "numeric", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
  const outras = materias.filter((m) => m.slug !== destaque?.slug);
  const cartao = (m: (typeof materias)[number], tipo: "destaque" | "normal") => (
    <li key={m.slug}>
      <Link href={localePath(lang, `/jornal/${m.slug}`)} className={`app-cartao app-jornal-materia${tipo === "destaque" ? " app-jornal-destaque" : ""}`} data-materia={m.slug}>
        {tipo === "destaque" && <span className="app-jornal-selo">{s.featured}</span>}
        <span className="app-cartao-titulo app-cartao-titulo-menor">{m.title}</span>
        <span className="app-cartao-texto">{m.subtitle}</span>
        <span className="app-cartao-aux">
          {data.format(new Date(m.date))} · {m.author}
        </span>
      </Link>
    </li>
  );
  return (
    <div className="app-hub app-jornal-tela">
      <header className="app-hub-cabeca">
        <h1>{s.title}</h1>
        <p>{s.lead}</p>
      </header>
      {materias.length === 0 ? (
        <section className="app-estado app-estado-vazio" data-jornal-vazio="">
          <p>{s.empty}</p>
        </section>
      ) : (
        <ol className="app-jornal-lista">
          {destaque && cartao(destaque, "destaque")}
          {outras.map((m) => cartao(m, "normal"))}
        </ol>
      )}
    </div>
  );
}
