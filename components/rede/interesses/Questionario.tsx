// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O questionário de interesses (onda 11, 11F), em cinco passos e um resumo: o que a pessoa veio fazer, as pautas, o estudo,
// conversa ou conteúdo, e o ritmo. Serve ao cadastro (components/rede/entrada/Formularios.tsx, entre o pedido e o envio) e aos
// Ajustes (./AjustesDosInteresses.tsx). Não chama o servidor: quem usa decide o que fazer com as respostas (guardar só no
// aparelho, lib/rede/interesses.ts). Cada passo pode ser pulado, e o questionário inteiro também.
import { useEffect, useId, useRef, useState } from "react";
import {
  CONVERSAS, ESTUDOS, FORA_DO_RITMO_MS, INTERESSES_VAZIOS, interessesNaLinha, OBJETIVOS, PAUTAS, RITMOS,
  type Conversa, type Estudo, type Interesses, type Objetivo, type Pauta, type Ritmo,
} from "@/lib/rede/interesses";
import { preencher } from "@/lib/rede/preencher";
import { useTextosDosInteresses, type TextosDosInteresses } from "./textos";
import "./interesses.css";

const PASSOS = ["objetivos", "pautas", "estudos", "conversa", "ritmo"] as const;
type Passo = (typeof PASSOS)[number];

function alternar<T>(lista: readonly T[], x: T): T[] {
  return lista.includes(x) ? lista.filter((y) => y !== x) : [...lista, x];
}

/** Os ladrilhos do caminho: um por passo, aceso quando já passou. */
function Ladrilhos({ agora, total, rotulo }: { agora: number; total: number; rotulo: string }) {
  return (
    <div className="in-ladrilhos" role="img" aria-label={rotulo}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} data-e={i < agora ? "feito" : i === agora ? "agora" : "falta"} />
      ))}
    </div>
  );
}

/** O resumo do que muda na linha, com as palavras da tela. Exportado para os Ajustes mostrarem o mesmo. */
export function ResumoDosInteresses({ t, i }: { t: TextosDosInteresses; i: Interesses }) {
  const f = interessesNaLinha(i);
  const horas = FORA_DO_RITMO_MS[i.ritmo] / 3_600_000;
  const nomes = t.resumo.tiposNomes as Record<string, string>;
  const sobe = Boolean(f.tipos?.length || f.tags?.length || f.estudo || f.nucleos);
  return (
    <div className="in-resumo">
      {!sobe && !f.conteudo ? (
        <p>{t.resumo.nada}</p>
      ) : (
        <>
          {sobe && (
            <>
              <p className="in-resumo-rotulo in-cond">{t.resumo.sobem}</p>
              <ul className="in-resumo-lista">
                {f.tipos?.length ? (
                  <li>
                    <b>{t.resumo.tipos}:</b> {f.tipos.map((x) => nomes[x] ?? x).join(", ")}
                  </li>
                ) : null}
                {f.estudo && <li>{t.resumo.estudo}</li>}
                {f.nucleos && <li>{t.resumo.nucleos}</li>}
                {f.tags?.length ? (
                  <li>
                    <b>{t.resumo.temas}:</b>{" "}
                    <span className="in-temas">
                      {f.tags.map((x) => (
                        <span key={x} className="in-tema">#{x}</span>
                      ))}
                    </span>
                  </li>
                ) : null}
              </ul>
            </>
          )}
          {f.conteudo && <p>{t.resumo.conteudo}</p>}
        </>
      )}
      <p className="in-cinza">{preencher(t.resumo.ritmo, { horas })}</p>
    </div>
  );
}

export function Questionario({
  lang,
  inicial,
  aoTerminar,
  aoPular,
  rotuloDoFim,
  comLinkDaRegra = false,
}: {
  lang: string;
  inicial: Interesses | null;
  aoTerminar: (i: Interesses) => void;
  aoPular: () => void;
  rotuloDoFim?: string;
  /** Mostra o link para "Como a linha é montada" no resumo (fora do cadastro, onde a página já abre). */
  comLinkDaRegra?: boolean;
}) {
  const t = useTextosDosInteresses(lang);
  const [i, setI] = useState<Interesses>(inicial ?? INTERESSES_VAZIOS);
  const [n, setN] = useState(0);
  const titulo = useRef<HTMLHeadingElement>(null);
  const primeiro = useRef(true);
  const id = useId();

  // O foco segue para o título do passo novo (teclado e leitor de tela continuam dali); não na primeira montagem.
  useEffect(() => {
    if (primeiro.current) {
      primeiro.current = false;
      return;
    }
    titulo.current?.focus();
  }, [n]);

  if (!t) return <div className="in-quadro in-carregando" aria-busy="true" />;
  const total = PASSOS.length;
  const passo: Passo | null = n < total ? PASSOS[n] : null;
  const ir = (k: number) => setN(Math.max(0, Math.min(total, k)));

  return (
    <section className="in-quadro" aria-labelledby={`${id}-titulo`}>
      <div className="in-faixa" aria-hidden />
      <div className="in-alto">
        {/* Um ladrilho por pergunta: o resumo não conta como passo (nele, os cinco ficam feitos). */}
        <Ladrilhos agora={n} total={total} rotulo={passo ? preencher(t.passo, { n: n + 1, total }) : t.resumo.titulo} />
        <span className="in-passo in-cond" aria-hidden>
          {passo ? preencher(t.passo, { n: n + 1, total }) : t.resumo.titulo}
        </span>
      </div>

      {passo ? (
        <fieldset className="in-pergunta">
          <legend className="in-sr">{t.perguntas[passo].titulo}</legend>
          <h3 id={`${id}-titulo`} ref={titulo} tabIndex={-1} className="in-titulo in-cond">
            {t.perguntas[passo].titulo}
          </h3>
          {n === 0 && <p className="in-chamada">{t.chamada}</p>}
          <p className="in-ajuda">{t.perguntas[passo].ajuda}</p>

          {passo === "objetivos" && (
            <div className="in-ladrilhos-grandes">
              {OBJETIVOS.map((o: Objetivo) => (
                <label key={o} className="in-opcao in-opcao-grande" data-marcada={i.objetivos.includes(o) ? "" : undefined}>
                  <input type="checkbox" checked={i.objetivos.includes(o)} onChange={() => setI({ ...i, objetivos: alternar(i.objetivos, o) })} />
                  <span>
                    <strong>{t.objetivos[o].nome}</strong>
                    <small>{t.objetivos[o].texto}</small>
                  </span>
                </label>
              ))}
            </div>
          )}

          {passo === "pautas" && (
            <div className="in-pilulas">
              {PAUTAS.map((p: Pauta) => (
                <label key={p} className="in-opcao in-pilula" data-marcada={i.pautas.includes(p) ? "" : undefined}>
                  <input type="checkbox" checked={i.pautas.includes(p)} onChange={() => setI({ ...i, pautas: alternar(i.pautas, p) })} />
                  <span>{t.pautas[p]}</span>
                </label>
              ))}
            </div>
          )}

          {passo === "estudos" && (
            <div className="in-pilulas">
              {ESTUDOS.map((e: Estudo) => (
                <label key={e} className="in-opcao in-pilula" data-marcada={i.estudos.includes(e) ? "" : undefined}>
                  <input type="checkbox" checked={i.estudos.includes(e)} onChange={() => setI({ ...i, estudos: alternar(i.estudos, e) })} />
                  <span>{t.estudos[e]}</span>
                </label>
              ))}
            </div>
          )}

          {passo === "conversa" && (
            <div className="in-ladrilhos-grandes in-tres">
              {CONVERSAS.map((c: Conversa) => (
                <label key={c} className="in-opcao in-opcao-grande" data-marcada={i.conversa === c ? "" : undefined}>
                  <input type="radio" name={`${id}-conversa`} checked={i.conversa === c} onChange={() => setI({ ...i, conversa: c })} />
                  <span>
                    <strong>{t.conversas[c].nome}</strong>
                    <small>{t.conversas[c].texto}</small>
                  </span>
                </label>
              ))}
            </div>
          )}

          {passo === "ritmo" && (
            <div className="in-ladrilhos-grandes in-tres">
              {RITMOS.map((r: Ritmo) => (
                <label key={r} className="in-opcao in-opcao-grande" data-marcada={i.ritmo === r ? "" : undefined}>
                  <input type="radio" name={`${id}-ritmo`} checked={i.ritmo === r} onChange={() => setI({ ...i, ritmo: r })} />
                  <span>
                    <strong>{t.ritmos[r].nome}</strong>
                    <small>{t.ritmos[r].texto}</small>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      ) : (
        <div className="in-pergunta">
          <h3 id={`${id}-titulo`} ref={titulo} tabIndex={-1} className="in-titulo in-cond">
            {t.resumo.titulo}
          </h3>
          <ResumoDosInteresses t={t} i={i} />
          {comLinkDaRegra && (
            <a className="in-link" href={`/${lang}/alumia/como-a-linha`}>
              {t.resumo.como}
            </a>
          )}
        </div>
      )}

      <p className="in-aparelho">
        <svg aria-hidden viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
          <path d="M11 18.5h2" />
        </svg>
        <span>{t.aparelho}</span>
      </p>

      <div className="in-botoes">
        {n > 0 && (
          <button type="button" className="in-botao in-botao-contorno" onClick={() => ir(n - 1)}>
            {t.voltar}
          </button>
        )}
        {passo ? (
          <>
            <button type="button" className="in-botao in-botao-cheio" onClick={() => ir(n + 1)}>
              {n === total - 1 ? t.verResumo : t.proximo}
            </button>
            <button type="button" className="in-botao in-botao-texto" onClick={() => ir(n + 1)}>
              {t.pularPergunta}
            </button>
          </>
        ) : (
          <button type="button" className="in-botao in-botao-cheio" onClick={() => aoTerminar(i)}>
            {rotuloDoFim ?? t.concluir}
          </button>
        )}
        <button type="button" className="in-botao in-botao-texto in-pular" onClick={aoPular}>
          {t.pularTudo}
        </button>
      </div>
    </section>
  );
}
