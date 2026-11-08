// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaBiblioteca } from "@/i18n/escola/biblioteca";
import { preencher } from "@/lib/escola/textos";
import type { Prateleira } from "./prateleiras";

/** Uma leitura guiada pronta para a tela (montada no servidor a partir de content/escola/leituras e do Acervo). */
export interface LeituraDaBiblioteca {
  obra: string;
  titulo: string;
  /** "Karl Marx e Friedrich Engels, 1848" (autor e ano do Acervo), ou vazio. */
  autoria: string;
}

/**
 * A tela Biblioteca (prancha Biblioteca, 07/11), na ordem da prancha: título e busca, leitura guiada, prateleiras por
 * caderno e memória e lutas. Tudo aqui é público (as mesmas leituras e páginas abertas do site): nada de militante passa
 * por esta tela. A busca leva ao Acervo do site com a palavra (formulário comum, sem guardar nada).
 */
export function TelaDaBiblioteca({ lang, t, leituras, prateleiras }: { lang: Locale; t: TextosDaBiblioteca["biblioteca"]; leituras: LeituraDaBiblioteca[]; prateleiras: Prateleira[] }) {
  return (
    <div className="ef6-tela" data-escola-escura="" data-tela-da-escola="biblioteca">
      <div className="ef6-topo">
        <h1 className="ef-t ef6-h1">{t.titulo}</h1>
        <form role="search" action={localePath(lang, "/acervo")} method="get" className="ef6-busca">
          <label htmlFor="ef6-busca" className="sr-only">
            {t.buscarRotulo}
          </label>
          <input id="ef6-busca" name="q" type="search" placeholder={t.buscarDica} autoComplete="off" enterKeyHint="search" minLength={3} maxLength={120} />
          <button type="submit" className="sr-only">
            {t.buscarBotao}
          </button>
        </form>
      </div>

      <section aria-labelledby="ef6-leitura" className="ef6-secao ef6-secao-primeira">
        <h2 id="ef6-leitura" className="ef-t ef6-h2">
          {t.leituraGuiada}
        </h2>
        {leituras.length === 0 ? (
          <p className="ef6-nota">{t.nenhuma}</p>
        ) : (
          <>
            <ul className="ef6-leituras">
              {leituras.map((l) => (
                <li key={l.obra}>
                  <Link href={localePath(lang, `/escola/leituras/${l.obra}`)} className="ef6-leitura">
                    <span aria-hidden className="ef6-capa">
                      {l.titulo}
                    </span>
                    <span className="ef6-leitura-corpo">
                      <span className="ef6-olho">{t.comRoteiro}</span>
                      <span className="ef-t ef6-leitura-titulo">{l.titulo}</span>
                      <span className="ef6-leitura-linha">{l.autoria ? `${l.autoria} · ${t.leituraTexto}` : t.leituraTexto}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {leituras.length === 1 && <p className="ef6-nota">{t.soUma}</p>}
          </>
        )}
      </section>

      {prateleiras.length > 0 && (
        <section aria-labelledby="ef6-caderno" className="ef6-secao">
          <h2 id="ef6-caderno" className="ef-t ef6-h2">
            {t.porCaderno}
          </h2>
          <ul className="ef6-prateleiras">
            {prateleiras.map((p) => (
              <li key={p.n}>
                <Link href={localePath(lang, p.caminho)} className="ef6-livro">
                  <span className="ef6-olho" style={{ color: p.cor }}>
                    {preencher(t.caderno, { n: p.n })}
                  </span>
                  <span className="ef-t ef6-livro-nome">{p.nome}</span>
                  <span className="ef6-livro-itens">{p.itens}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="ef6-memoria" className="ef6-secao ef6-memoria">
        <h2 id="ef6-memoria" className="ef-t ef6-h2">
          {t.memoria}
        </h2>
        <Link href={localePath(lang, "/escola/lutas")} className="ef6-luta" style={{ background: "#E8604C" }}>
          <span className="ef-t ef6-luta-titulo">{t.lutas.titulo}</span>
          <span>{t.lutas.texto}</span>
        </Link>
        <Link href={localePath(lang, "/escola/vozes")} className="ef6-luta" style={{ background: "#EA7A24" }}>
          <span className="ef-t ef6-luta-titulo">{t.vozes.titulo}</span>
          <span>{t.vozes.texto}</span>
        </Link>
        <Link href={localePath(lang, "/estantes/formacao-militante")} className="ef6-luta" style={{ background: "#F1EEE6" }}>
          <span className="ef-t ef6-luta-titulo">{t.acervo.titulo}</span>
          <span>{t.acervo.texto}</span>
        </Link>
      </section>
    </div>
  );
}
