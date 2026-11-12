// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// "Arrumar destaques" (B1): a dona muda a ordem da fileira, renomeia, troca a cor, escolhe a capa (uma foto do destaque),
// reordena os stories dentro dele e apaga um destaque — o banco já tinha tudo (rede_story_destaque_*), faltava a tela. Cada
// mudança vai na hora (sem "salvar tudo" para esquecer); o banco confere de novo que o destaque é dela. Teclado: os botões ↑ ↓
// e ← → fazem o mesmo que arrastar; nada depende de gesto. É uma caixa modal: o foco entra nela ao abrir, o Tab não sai dela e,
// ao fechar, o foco volta para o botão que abriu. O que o banco recusa volta na tela ao que era.
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { PALETA_DO_STORY } from "@/lib/rede/stories/visual";
import type { ClienteDeStories } from "@/lib/rede/cliente-stories";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import { CORES_DO_STORY, LIMITES_DO_STORY, type CorDoStory, type DestaqueDeStories, type Story } from "@/lib/rede/tipos-stories";
import { CapaDoDestaque } from "./CapaDoDestaque";
import { avisarDestaques, codigoDoErro, preencherStory } from "./usar";

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const trocar = <T,>(l: readonly T[], i: number, j: number): T[] => {
  const n = [...l];
  [n[i], n[j]] = [n[j], n[i]];
  return n;
};

export function ArrumarDestaques({ t, cliente, handle, aoFechar }: { t: TextosDosStories; cliente: ClienteDeStories; handle: string; aoFechar: () => void }) {
  const a = t.b1.arrumar;
  const id = useId();
  const [lista, setLista] = useState<DestaqueDeStories[] | null>(null);
  // Erro ao carregar não é o mesmo que "não há destaques": cada um tem o seu texto.
  const [erroAoCarregar, setErroAoCarregar] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [stories, setStories] = useState<{ de: string; lista: Story[]; erro?: boolean } | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [recado, setRecado] = useState("");
  const [apagando, setApagando] = useState<string | null>(null);

  const mudou = useCallback((texto: string) => {
    setRecado(texto);
    avisarDestaques();
  }, []);
  const falhou = useCallback((e: unknown) => setRecado(codigoDoErro(e) === "dadoPessoal" ? t.criar.erro.dadoPessoal : a.erro), [a.erro, t.criar.erro.dadoPessoal]);

  useEffect(() => {
    let vivo = true;
    cliente
      .destaques(handle)
      .then((l) => vivo && (setErroAoCarregar(false), setLista(l)))
      .catch(() => vivo && (setErroAoCarregar(true), setLista([])));
    return () => {
      vivo = false;
    };
  }, [cliente, handle]);

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    cliente
      .destaque(aberto)
      .then((l) => vivo && setStories({ de: aberto, lista: l }))
      .catch(() => vivo && setStories({ de: aberto, lista: [], erro: true }));
    return () => {
      vivo = false;
    };
  }, [cliente, aberto]);

  // O foco entra na caixa ao abrir (no título) e volta, ao fechar, para o que estava com ele (o botão que abriu).
  useEffect(() => {
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    titulo.current?.focus();
    return () => {
      if (antes?.isConnected) antes.focus();
    };
  }, []);

  useEffect(() => {
    const sair = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        aoFechar();
        return;
      }
      // O Tab dá a volta dentro da caixa (aria-modal de verdade).
      if (e.key !== "Tab" || !caixa.current) return;
      const focaveis = [...caixa.current.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focaveis.length === 0) {
        e.preventDefault();
        titulo.current?.focus();
        return;
      }
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const ativo = document.activeElement;
      const fora = !(ativo instanceof Node) || !caixa.current.contains(ativo) || ativo === titulo.current;
      if (e.shiftKey && (ativo === primeiro || fora)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (ativo === ultimo || (fora && ativo !== titulo.current))) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    window.addEventListener("keydown", sair, true);
    return () => window.removeEventListener("keydown", sair, true);
  }, [aoFechar]);

  async function mover(i: number, j: number) {
    if (!lista || j < 0 || j >= lista.length) return;
    const nova = trocar(lista, i, j);
    setLista(nova);
    try {
      await cliente.ordenarDestaques(nova.map((d) => d.id));
      mudou(a.salvo);
    } catch (e) {
      setLista(lista);
      falhou(e);
    }
  }

  async function renomear(d: DestaqueDeStories) {
    const titulo = (nomes[d.id] ?? d.titulo).trim();
    if (!titulo || titulo === d.titulo) return;
    try {
      const r = await cliente.salvarDestaque({ destaque: d.id, titulo, story: null });
      setLista((l) => l?.map((x) => (x.id === d.id ? { ...x, titulo: r.titulo } : x)) ?? null);
      mudou(a.salvo);
    } catch (e) {
      falhou(e);
    }
  }

  async function mudarCor(d: DestaqueDeStories, cor: CorDoStory) {
    setLista((l) => l?.map((x) => (x.id === d.id ? { ...x, cor } : x)) ?? null);
    try {
      await cliente.salvarDestaque({ destaque: d.id, titulo: null, story: null, cor });
      mudou(a.salvo);
    } catch (e) {
      // O banco recusou: a cor volta ao que era.
      setLista((l) => l?.map((x) => (x.id === d.id ? { ...x, cor: d.cor } : x)) ?? null);
      falhou(e);
    }
  }

  async function moverStory(d: string, i: number, j: number) {
    if (!stories || stories.de !== d || j < 0 || j >= stories.lista.length) return;
    const nova = trocar(stories.lista, i, j);
    setStories({ de: d, lista: nova });
    try {
      await cliente.ordenarNoDestaque(d, nova.map((s) => s.id));
      mudou(a.salvo);
    } catch (e) {
      // O banco recusou: a ordem volta ao que era.
      setStories((atual) => (atual?.de === d ? stories : atual));
      falhou(e);
    }
  }

  async function capa(d: DestaqueDeStories, s: Story | null) {
    const url = s && s.fundo.tipo === "imagem" ? s.fundo.url : undefined;
    setLista((l) => l?.map((x) => (x.id === d.id ? { ...x, capa_story: s?.id ?? null, capa: url ? { tipo: "imagem", url } : x.capa } : x)) ?? null);
    try {
      await cliente.capaDoDestaque(d.id, s?.id ?? null);
      mudou(a.salvo);
    } catch (e) {
      // O banco recusou: a capa volta ao que era.
      setLista((l) => l?.map((x) => (x.id === d.id ? { ...x, capa_story: d.capa_story, capa: d.capa } : x)) ?? null);
      falhou(e);
    }
  }

  async function apagar(d: DestaqueDeStories) {
    try {
      await cliente.apagarDestaque(d.id);
      setLista((l) => l?.filter((x) => x.id !== d.id) ?? null);
      setApagando(null);
      if (aberto === d.id) setAberto(null);
      mudou(t.destaques.apagado);
    } catch (e) {
      falhou(e);
    }
  }

  return (
    <div className="al-st-arrumar" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={`${id}-a`}>
      <div className="al-st-arrumar-caixa" ref={caixa}>
        <div className="al-st-caixa-cabeca">
          <h2 id={`${id}-t`} ref={titulo} tabIndex={-1} className="al-cond" style={{ margin: 0 }}>
            {a.titulo}
          </h2>
          <button type="button" className="al-botao al-botao-fantasma al-botao-p" onClick={aoFechar}>
            {t.destaques.fechar}
          </button>
        </div>
        <p id={`${id}-a`} className="al-st-dica">
          {a.ajuda}
        </p>
        <p role="status" className="al-st-dica" style={{ minHeight: "1.4em" }}>
          {recado}
        </p>
        {lista === null ? (
          <p role="status">{a.carregando}</p>
        ) : erroAoCarregar ? (
          <p role="alert">{a.erroCarregar}</p>
        ) : lista.length === 0 ? (
          <p className="al-st-dica">{a.vazio}</p>
        ) : (
          <ol className="al-st-arrumar-lista">
            {lista.map((d, i) => (
              <li key={d.id} className="al-st-arrumar-item-bloco">
                <div className="al-st-arrumar-item" data-aberto={aberto === d.id ? "sim" : "nao"}>
                  <span className="al-st-destaque-capa al-st-destaque-capa-p" aria-hidden style={{ "--al-st-anel": PALETA_DO_STORY[d.cor].fundo } as CSSProperties}>
                    <CapaDoDestaque d={d} />
                  </span>
                  <span className="al-st-arrumar-nome">
                    <label htmlFor={`${id}-n-${d.id}`} className="sr-only">
                      {a.nome}
                    </label>
                    <input
                      id={`${id}-n-${d.id}`}
                      type="text"
                      value={nomes[d.id] ?? d.titulo}
                      maxLength={LIMITES_DO_STORY.tituloDoDestaque}
                      onChange={(e) => setNomes((n) => ({ ...n, [d.id]: e.target.value }))}
                      onBlur={() => void renomear(d)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void renomear(d))}
                    />
                  </span>
                  <span className="al-st-arrumar-setas">
                    <button type="button" aria-label={preencherStory(a.subir, { titulo: d.titulo })} disabled={i === 0} onClick={() => void mover(i, i - 1)}>
                      ↑
                    </button>
                    <button type="button" aria-label={preencherStory(a.descer, { titulo: d.titulo })} disabled={i === lista.length - 1} onClick={() => void mover(i, i + 1)}>
                      ↓
                    </button>
                    <button type="button" aria-expanded={aberto === d.id} aria-controls={`${id}-d-${d.id}`} aria-label={`${a.stories}: ${d.titulo}`} onClick={() => setAberto((x) => (x === d.id ? null : d.id))}>
                      {aberto === d.id ? "−" : "⋯"}
                    </button>
                  </span>
                </div>
                {aberto === d.id ? (
                  <div id={`${id}-d-${d.id}`} className="al-st-arrumar-detalhe">
                    <fieldset className="al-st-guardar-cores" style={{ border: 0, margin: 0, padding: 0 }}>
                      <legend className="al-st-dica">{t.destaques.cor}</legend>
                      {CORES_DO_STORY.map((c) => (
                        <label key={c} className="al-st-cor" style={{ background: PALETA_DO_STORY[c].fundo, outline: d.cor === c ? "3px solid currentColor" : undefined, outlineOffset: 2 }}>
                          <input type="radio" name={`${id}-cor-${d.id}`} className="sr-only" checked={d.cor === c} onChange={() => void mudarCor(d, c)} />
                          <span className="sr-only">{t.criar.cor[c]}</span>
                        </label>
                      ))}
                    </fieldset>
                    <p className="al-st-dica" style={{ margin: 0 }}>
                      {a.stories} · {a.capa}: {d.capa_story ? a.capaEscolhida : a.capaPrimeira}
                    </p>
                    {stories?.de !== d.id ? (
                      <p role="status">{a.carregando}</p>
                    ) : stories.erro ? (
                      <p role="alert">{a.erroCarregar}</p>
                    ) : (
                      <ol className="al-st-arrumar-stories">
                        {stories.lista.map((s, k) => {
                          const foto = s.fundo.tipo === "imagem" ? s.fundo.url : "";
                          const ehCapa = d.capa_story === s.id;
                          return (
                            <li key={s.id} className="al-st-arrumar-story">
                              <button
                                type="button"
                                className="al-st-arrumar-miniatura"
                                data-capa={ehCapa ? "sim" : "nao"}
                                disabled={!foto}
                                aria-pressed={ehCapa}
                                aria-label={`${preencherStory(a.storyN, { n: k + 1 })}${foto ? ` · ${a.capa}` : ` · ${a.semFoto}`}`}
                                title={foto ? a.capa : a.semFoto}
                                style={{ background: PALETA_DO_STORY[s.fundo.cor].fundo }}
                                onClick={() => void capa(d, ehCapa ? null : s)}
                              >
                                {foto ? (
                                  // Endereço assinado de vida curta (o mesmo do visor).
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={foto} alt="" referrerPolicy="no-referrer" />
                                ) : (
                                  (s.texto || "·").slice(0, 24)
                                )}
                              </button>
                              <span className="al-st-arrumar-story-botoes">
                                <button type="button" aria-label={preencherStory(a.subirStory, { n: k + 1 })} disabled={k === 0} onClick={() => void moverStory(d.id, k, k - 1)}>
                                  ←
                                </button>
                                <button type="button" aria-label={preencherStory(a.descerStory, { n: k + 1 })} disabled={k === stories.lista.length - 1} onClick={() => void moverStory(d.id, k, k + 1)}>
                                  →
                                </button>
                              </span>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                    {apagando === d.id ? (
                      <div role="alertdialog" aria-labelledby={`${id}-ap-${d.id}`} className="al-st-guardar-borrar">
                        <p id={`${id}-ap-${d.id}`}>{preencherStory(t.destaques.apagarConfirma, { titulo: d.titulo })}</p>
                        <div className="al-st-caixa-acoes" style={{ justifyContent: "flex-start", marginTop: 0 }}>
                          <button type="button" className="al-botao al-botao-fantasma al-botao-p" onClick={() => setApagando(null)}>
                            {t.visor.cancelar}
                          </button>
                          <button type="button" className="al-botao al-botao-primario al-botao-p" autoFocus onClick={() => void apagar(d)}>
                            {t.visor.apagarSim}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="al-botao al-botao-contorno al-botao-p al-st-perigo" style={{ justifySelf: "start" }} onClick={() => setApagando(d.id)}>
                        {a.apagar}
                      </button>
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
