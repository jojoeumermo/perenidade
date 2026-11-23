// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// "Buscar nos posts cifrados" (R1): na comunidade fechada e no núcleo, a busca que o servidor não consegue fazer, feita
// neste aparelho (./busca-local.ts). Antes de baixar, a tela diz os tetos (posts, dias, memória) e que o texto aberto fica só na
// memória da aba. "Apagar da memória" solta tudo; sair da tela também. Nada é guardado no navegador e o termo não sai daqui.
import { useId, useRef, useState } from "react";
import Link from "@/components/Link";
import { enderecos, type PaginaDaLinha, type Post } from "@/lib/rede/tipos";
import { postCifrado } from "../publicar/restrito/grupo";
import { ABERTOS_NA_PREVIA } from "../publicar/restrito/previa";
import { baixarParaBusca, LIMITES, procurar, type Achado, type Baixados } from "./busca-local";
import { encher, useTextosDoUso } from "./textos";
import "./uso.css";

const MB = Math.round(LIMITES.bytes / (1024 * 1024));

export function BuscaNoAparelho({ lang, pagina, previa }: { lang: string; pagina: (cursor: string | null) => Promise<PaginaDaLinha>; previa: boolean }) {
  const t = useTextosDoUso(lang);
  const id = useId();
  const [termo, setTermo] = useState("");
  const [baixados, setBaixados] = useState<Baixados | null>(null);
  const [andando, setAndando] = useState<number | null>(null);
  const [achados, setAchados] = useState<{ termo: string; lista: Achado[] } | null>(null);
  const [erro, setErro] = useState("");
  // A busca em curso: trocar de tela ou apagar no meio descarta o que chegar depois.
  const vez = useRef(0);
  if (!t) return null;

  async function buscar() {
    if (!t) return;
    const alvo = termo.trim();
    if (alvo.length < 2) return setErro(t.busca.curto);
    setErro("");
    let base = baixados;
    if (!base) {
      const minha = ++vez.current;
      setAndando(0);
      try {
        base = await baixarParaBusca<Post>(
          {
            pagina,
            cifrado: (p) => postCifrado(p),
            abrir: previa ? async (p) => ABERTOS_NA_PREVIA[p.id] ?? null : async (p) => (await import("../publicar/restrito/aparelho")).abrirNoAparelho(p),
          },
          LIMITES,
          Date.now(),
          (n) => minha === vez.current && setAndando(n),
        );
      } catch {
        if (minha === vez.current) {
          setAndando(null);
          setErro(t.busca.falha);
        }
        return;
      }
      if (minha !== vez.current) return;
      setAndando(null);
      setBaixados(base);
    }
    setAchados({ termo: alvo, lista: procurar(base.itens, alvo) });
  }

  const apagar = () => {
    vez.current++;
    setBaixados(null);
    setAchados(null);
    setAndando(null);
    setErro("");
  };

  const parada =
    baixados?.parou === "posts"
      ? encher(t.busca.paradoPosts, { posts: LIMITES.posts })
      : baixados?.parou === "dias"
        ? encher(t.busca.paradoDias, { dias: LIMITES.dias })
        : baixados?.parou === "memoria"
          ? encher(t.busca.paradoMemoria, { mb: MB })
          : null;

  return (
    <section className="al-uso-bloco" aria-labelledby={`${id}-t`} style={{ marginInline: "18px" }}>
      <p className="al-uso-rotulo">{t.busca.rotulo}</p>
      <h2 id={`${id}-t`} className="al-uso-titulo">{t.busca.titulo}</h2>
      <p className="al-uso-texto">{t.busca.explica}</p>
      <p className="al-uso-miudo">{encher(t.busca.limites, { posts: LIMITES.posts, dias: LIMITES.dias, mb: MB })}</p>
      <form
        role="search"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void buscar();
        }}
      >
        <div className="al-busca-local-linha">
          <label className="al-uso-campo">
            <span>{t.busca.campo}</span>
            <input type="search" value={termo} maxLength={80} onChange={(e) => setTermo(e.target.value)} autoComplete="off" spellCheck={false} />
          </label>
          <button type="submit" className="al-botao al-botao-primario al-botao-m" disabled={andando !== null} aria-busy={andando !== null || undefined}>
            {t.busca.buscar}
          </button>
          {baixados ? (
            <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={apagar}>
              {t.busca.limpar}
            </button>
          ) : null}
        </div>
      </form>
      <div aria-live="polite">
        {andando !== null ? <p className="al-uso-nota">{encher(t.busca.buscando, { n: andando })}</p> : null}
        {erro ? <p className="al-uso-erro">{erro}</p> : null}
        {achados && baixados ? (
          <p className="al-uso-nota">
            {achados.lista.length > 0
              ? encher(t.busca.resultado, { achados: achados.lista.length, abertos: baixados.itens.length, termo: achados.termo })
              : encher(t.busca.nada, { abertos: baixados.itens.length, termo: achados.termo })}
          </p>
        ) : null}
        {baixados && parada ? <p className="al-uso-miudo">{parada}</p> : null}
        {baixados && baixados.fechados > 0 ? <p className="al-uso-miudo">{encher(t.busca.fechados, { n: baixados.fechados })}</p> : null}
      </div>
      {achados && achados.lista.length > 0 ? (
        <ul className="al-busca-local-resultados">
          {achados.lista.slice(0, 50).map((a) => (
            <li key={a.id}>
              <p>
                {a.antes}
                <mark>{a.achado}</mark>
                {a.depois}
              </p>
              <Link href={enderecos.post(lang, a.id)}>{t.busca.abrir}</Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
