// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "@/components/Link";
import { guardarCidade } from "@/lib/rede/atos/aparelho";
import { atos } from "@/lib/rede/cliente-atos";
import { mapa as clienteDoMapa } from "@/lib/rede/mapa/cliente";
import { carregarIndice, type Indice } from "@/lib/rede/mapa/indice";
import { aoVivoLigado } from "@/lib/rede/mapa/ligado";
import { UFS, type UF } from "@/lib/rede/mapa/lugar";
import { pontosDoMapa, temAlgo, type Filtro, type PontoDoMapa } from "@/lib/rede/mapa/regras";
import type { Mapa } from "@/lib/rede/mapa/tipos";
import { preencher } from "@/lib/rede/preencher";
import type { Ato } from "@/lib/rede/tipos-atos";
import { FaixaDaPrevia, useTextosAlumia3 } from "../conversa/base3";
import type { PropsDaTelaDoPacote } from "../registro";
import { Botao } from "../ui/Botao";
import { EstadoDaAlumia } from "../ui/Estado";
import { Faixa } from "../ui/Faixa";
import { criarUsoDeTextos, diaCurto, horaCurta } from "./comum";
import { MapaDoBrasil } from "./MapaDoBrasil";
import { carregarTextosDoMapa, type TextosDoMapa } from "./textos";
import "./mapa.css";
import { PorQueSemNumero } from "../uso/PorQueSemNumero";

const useTextosDoMapa = criarUsoDeTextos(carregarTextosDoMapa);
const AO_VIVO = aoVivoLigado();
type T = TextosDoMapa;

/** As três coisas do mapa e a cor de cada uma (os ladrilhos do desenho e da lista usam as mesmas). */
export const TIPOS = ["chamados", "eventos", "nucleos"] as const;

/** O resumo de um ponto em palavras (a lista e o rótulo do ladrilho). */
function resumoDoPonto(t: T, p: Pick<PontoDoMapa, "chamados" | "chamados_ha" | "eventos" | "eventos_ha" | "nucleos_ha">, f: Filtro): string {
  const partes: string[] = [];
  if (f.chamados && p.chamados_ha) partes.push(p.chamados !== null ? preencher(t.cidade.chamados, { n: p.chamados }) : t.cidade.chamadosPoucos);
  if (f.eventos && p.eventos_ha) partes.push(p.eventos !== null ? preencher(t.cidade.eventos, { n: p.eventos }) : t.cidade.eventosPoucos);
  if (f.nucleos && p.nucleos_ha) partes.push(t.cidade.nucleos);
  return partes.join(" · ");
}

/** Os ladrilhos pequenos de um ponto (na lista e no cartão da cidade): um por tipo que há. */
function Ladrilhos({ p, f }: { p: Pick<PontoDoMapa, "chamados_ha" | "eventos_ha" | "nucleos_ha">; f: Filtro }) {
  return (
    <span className="mp-ladrilhos" aria-hidden>
      {f.chamados && p.chamados_ha && <span data-tipo="chamados" />}
      {f.eventos && p.eventos_ha && <span data-tipo="eventos" />}
      {f.nucleos && p.nucleos_ha && <span data-tipo="nucleos" />}
    </span>
  );
}

/**
 * Os próximos chamados e eventos da cidade escolhida (a mesma busca de "Perto", pela cidade escrita). O mapa junta as formas de
 * escrever a cidade (com e sem o estado); a busca de "Perto" acha uma forma por vez, então pede as três mais comuns e junta.
 */
function AtosDaCidade({ t, lang, ponto }: { t: T; lang: string; ponto: PontoDoMapa }) {
  const [estado, setEstado] = useState<{ chave: string; itens: Ato[] | null; erro: boolean } | null>(null);
  const { nome, uf } = ponto.municipio;
  useEffect(() => {
    let vivo = true;
    const formas = [...new Set([ponto.escrito, nome, uf ? `${nome} - ${uf}` : ""].map((x) => x.trim()).filter(Boolean))];
    Promise.all(formas.map((cidade) => atos.atos("perto", { cidade }))).then(
      (rs) => {
        const unicos = new Map<string, Ato>();
        for (const r of rs) for (const a of r.itens) unicos.set(a.id, a);
        const itens = [...unicos.values()].sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio)).slice(0, 5);
        if (vivo) setEstado({ chave: ponto.chave, itens, erro: false });
      },
      () => vivo && setEstado({ chave: ponto.chave, itens: null, erro: true }),
    );
    return () => {
      vivo = false;
    };
  }, [ponto.chave, ponto.escrito, nome, uf]);
  const atual = estado?.chave === ponto.chave ? estado : null;
  // O mapa contou mais do que a lista achou: diz por quê, em vez de um "nenhum" que contradiz o carimbo.
  const contados = (ponto.chamados ?? (ponto.chamados_ha ? 1 : 0)) + (ponto.eventos ?? (ponto.eventos_ha ? 1 : 0));
  const faltam = !!atual?.itens && atual.itens.length < Math.min(contados, 5);
  return (
    <section className="mp-bloco" aria-labelledby="mp-atos-titulo">
      <h3 id="mp-atos-titulo" className="mp-subtitulo al-cond">{t.cidade.atos}</h3>
      {!atual ? (
        <p className="mp-miudo" role="status">{t.cidade.atosCarregando}</p>
      ) : atual.erro ? (
        <p className="mp-miudo" role="alert">{t.cidade.atosErro}</p>
      ) : !atual.itens?.length ? (
        <p className="mp-miudo">{faltam ? t.cidade.atosMenos : t.cidade.atosVazio}</p>
      ) : (
        <ul className="mp-atos">
          {atual.itens.map((a) => (
            <li key={a.id}>
              <Link href={`/${lang}/alumia/ato/${a.id}`} className={a.situacao === "cancelado" ? "al-riscado" : undefined}>{a.titulo}</Link>
              <span className="mp-miudo">
                <time dateTime={a.inicio}>{diaCurto(lang, a.inicio)} · {horaCurta(lang, a.inicio)}</time>
              </span>
            </li>
          ))}
        </ul>
      )}
      {faltam && !!atual?.itens?.length && <p className="mp-miudo">{t.cidade.atosMenos}</p>}
      <Link href={`/${lang}/alumia/atos`} className="mp-link" onClick={() => guardarCidade(ponto.escrito)}>
        {preencher(t.cidade.verTodos, { cidade: ponto.municipio.nome })}
      </Link>
    </section>
  );
}

/**
 * O cartão da cidade escolhida: o que há, as organizações com núcleo e os próximos chamados. Ao abrir (pelo ladrilho ou pela
 * lista), rola até ele e leva o foco ao nome da cidade: no celular o cartão fica fora da vista, e o leitor de tela fica sabendo.
 */
function CartaoDaCidade({ t, lang, ponto, filtro, aoFechar }: { t: T; lang: string; ponto: PontoDoMapa; filtro: Filtro; aoFechar: () => void }) {
  const cartao = useRef<HTMLElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const quieto = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    cartao.current?.scrollIntoView({ block: "nearest", behavior: quieto ? "auto" : "smooth" });
    titulo.current?.focus({ preventScroll: true });
  }, [ponto.chave]);
  return (
    <section ref={cartao} className="mp-cartao mp-cidade" aria-labelledby="mp-cidade-titulo">
      <div className="mp-cartao-topo">
        <h2 id="mp-cidade-titulo" ref={titulo} tabIndex={-1} className="mp-cidade-nome al-cond">
          {ponto.municipio.nome} <span className="mp-uf">{ponto.municipio.uf}</span>
        </h2>
        <Botao variante="fantasma" tamanho="p" onClick={aoFechar}>{t.cidade.fechar}</Botao>
      </div>
      <ul className="mp-carimbos">
        {ponto.chamados_ha && filtro.chamados && (
          <li className="mp-carimbo" data-tipo="chamados">
            {ponto.chamados !== null ? preencher(t.cidade.chamados, { n: ponto.chamados }) : t.cidade.chamadosPoucos}
            {ponto.chamados === null ? <PorQueSemNumero lang={lang} motivo="piso" /> : null}
          </li>
        )}
        {ponto.eventos_ha && filtro.eventos && (
          <li className="mp-carimbo" data-tipo="eventos">
            {ponto.eventos !== null ? preencher(t.cidade.eventos, { n: ponto.eventos }) : t.cidade.eventosPoucos}
            {ponto.eventos === null ? <PorQueSemNumero lang={lang} motivo="piso" /> : null}
          </li>
        )}
        {ponto.nucleos_ha && filtro.nucleos && <li className="mp-carimbo" data-tipo="nucleos">{t.cidade.nucleos}</li>}
      </ul>
      {ponto.orgs.length > 0 && filtro.nucleos && (
        <section className="mp-bloco" aria-labelledby="mp-orgs-titulo">
          <h3 id="mp-orgs-titulo" className="mp-subtitulo al-cond">{t.cidade.orgs}</h3>
          <ul className="mp-orgs">
            {ponto.orgs.map((o) => (
              <li key={o.handle}>
                <Link href={`/${lang}/alumia/u/${o.handle}`}>{o.nome}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(ponto.chamados_ha || ponto.eventos_ha) && <AtosDaCidade t={t} lang={lang} ponto={ponto} />}
    </section>
  );
}

/**
 * O mapa (/alumia/mapa; frente 13B, L1-19): chamados, eventos e núcleos por cidade, no desenho do Brasil da própria Alumia (malha
 * pública do IBGE guardada no repositório, nada carregado de fora). A precisão é o município escrito; número só a partir de 3;
 * núcleo sem número. Computador primeiro: o desenho à esquerda, a cidade escolhida e a lista à direita; no celular, um embaixo do
 * outro. O desenho é só para os olhos: a lista de cidades (botões) é o caminho pelo teclado e pelo leitor de tela.
 */
export default function TelaDoMapa({ lang }: Pick<PropsDaTelaDoPacote, "lang">) {
  const t = useTextosDoMapa(lang);
  const t3 = useTextosAlumia3(lang);
  const [dados, setDados] = useState<{ mapa: Mapa; indice: Indice } | null>(null);
  const [erro, setErro] = useState(false);
  const [vez, setVez] = useState(0);
  const [filtro, setFiltro] = useState<Filtro>({ chamados: true, eventos: true, nucleos: true });
  const [uf, setUf] = useState<UF | null>(null);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const id = useId();
  const lista = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([clienteDoMapa.ler(), carregarIndice()]).then(
      ([m, indice]) => {
        if (!vivo) return;
        setDados({ mapa: m, indice });
        setErro(false);
      },
      () => vivo && setErro(true),
    );
    return () => {
      vivo = false;
    };
  }, [vez]);

  const { pontos, fora } = useMemo(() => (dados ? pontosDoMapa(dados.mapa, dados.indice) : { pontos: [], fora: [] }), [dados]);
  const visiveis = useMemo(() => pontos.filter((p) => temAlgo(p, filtro)), [pontos, filtro]);
  const naLista = uf ? visiveis.filter((p) => p.municipio.uf === uf) : visiveis;
  const ponto = escolhido ? visiveis.find((p) => p.chave === escolhido) ?? null : null;
  const porUf = useMemo(() => {
    const n = new Map<string, number>();
    for (const p of visiveis) n.set(p.municipio.uf, (n.get(p.municipio.uf) ?? 0) + 1);
    return n;
  }, [visiveis]);

  if (!t) return <p role="status" className="mp-pagina mp-miudo">…</p>;

  const escolher = (p: PontoDoMapa) => {
    setEscolhido(p.chave);
    if (uf && p.municipio.uf !== uf) setUf(p.municipio.uf);
  };
  // Fechar o cartão devolve o foco ao botão da cidade na lista (o caminho do teclado).
  const fechar = () => {
    const chave = escolhido;
    setEscolhido(null);
    if (chave) requestAnimationFrame(() => lista.current?.querySelector<HTMLButtonElement>(`button[data-chave="${CSS.escape(chave)}"]`)?.focus());
  };

  return (
    <article className="mp-pagina" aria-labelledby={`${id}-titulo`}>
      {t3 && <FaixaDaPrevia t={t3} />}
      <header className="mp-cabeca">
        <Faixa className="mp-faixa" />
        <h1 id={`${id}-titulo`} className="mp-titulo al-cond">{t.titulo}</h1>
        <p className="mp-chamada">{preencher(t.chamada, { dias: dados?.mapa.dias ?? 60 })}</p>
      </header>

      {erro ? (
        <EstadoDaAlumia erro texto={t.erro}>
          <Botao variante="contorno" onClick={() => (setErro(false), setVez((v) => v + 1))}>{t.tentar}</Botao>
        </EstadoDaAlumia>
      ) : !dados ? (
        <div className="mp-esqueleto" role="status" aria-label={t.carregando}>
          <span />
          <span />
        </div>
      ) : (
        <div className="mp-colunas">
          <div className="mp-principal">
            <fieldset className="mp-filtros">
              <legend className="mp-rotulo">{t.filtro.titulo}</legend>
              {TIPOS.map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  className="mp-filtro"
                  data-tipo={tipo}
                  aria-pressed={filtro[tipo]}
                  onClick={() => setFiltro((f) => ({ ...f, [tipo]: !f[tipo] }))}
                >
                  <span className="mp-filtro-ladrilho" aria-hidden />
                  {t.filtro[tipo]}
                </button>
              ))}
              <label className="mp-estado">
                <span className="mp-rotulo">{t.estado.rotulo}</span>
                <select value={uf ?? ""} onChange={(e) => (setUf((e.target.value || null) as UF | null), setEscolhido(null))}>
                  <option value="">{t.estado.brasil}</option>
                  {UFS.slice().sort().map((s) => (
                    <option key={s} value={s}>
                      {s}{porUf.get(s) ? ` · ${porUf.get(s)}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>

            <MapaDoBrasil
              rotulo={preencher(t.desenho, { n: visiveis.length })}
              pontos={visiveis}
              filtro={filtro}
              uf={uf}
              escolhido={escolhido}
              aoEscolherUf={(s) => (setUf(s), setEscolhido(null))}
              aoEscolherPonto={escolher}
              textosDoToque={t.toque}
              descrever={(p) => resumoDoPonto(t, p, filtro)}
            />
            {uf && (
              <Botao variante="contorno" tamanho="p" onClick={() => (setUf(null), setEscolhido(null))}>{t.estado.voltar}</Botao>
            )}

            <section className="mp-legenda" aria-labelledby={`${id}-legenda`}>
              <h2 id={`${id}-legenda`} className="mp-subtitulo al-cond">{t.legenda.titulo}</h2>
              <ul>
                {TIPOS.map((tipo) => (
                  <li key={tipo}>
                    <span className="mp-ladrilhos" aria-hidden>
                      <span data-tipo={tipo} />
                    </span>
                    {t.legenda[tipo]}
                  </li>
                ))}
              </ul>
              <p className="mp-miudo">{t.legenda.tamanho}</p>
              <p className="mp-miudo">{t.fonte}</p>
            </section>
          </div>

          <aside className="mp-lado" aria-label={t.cidades.titulo}>
            {ponto && <CartaoDaCidade t={t} lang={lang} ponto={ponto} filtro={filtro} aoFechar={fechar} />}

            <section className="mp-cartao" aria-labelledby={`${id}-cidades`}>
              <h2 id={`${id}-cidades`} className="mp-subtitulo al-cond">{uf ? preencher(t.cidades.tituloEstado, { uf }) : t.cidades.titulo}</h2>
              {naLista.length === 0 ? (
                <p className="mp-miudo">{uf ? t.estado.nenhuma : t.vazio}</p>
              ) : (
                <>
                  {!ponto && <p className="mp-miudo">{t.cidades.escolher}</p>}
                  <ul className="mp-cidades" ref={lista}>
                    {naLista.map((p) => (
                      <li key={p.chave}>
                        <button type="button" className="mp-cidade-botao" data-chave={p.chave} aria-current={p.chave === escolhido ? "true" : undefined} onClick={() => escolher(p)}>
                          <Ladrilhos p={p} f={filtro} />
                          <span className="mp-cidade-texto">
                            <strong>{p.municipio.nome}</strong> <span className="mp-uf">{p.municipio.uf}</span>
                            <span className="mp-miudo">{resumoDoPonto(t, p, filtro)}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            {fora.length > 0 && (
              <details className="mp-cartao mp-fora">
                <summary className="mp-subtitulo al-cond">{t.fora.titulo} · {fora.length}</summary>
                <p className="mp-miudo">{t.fora.texto}</p>
                <ul className="mp-cidades">
                  {fora.map((l, i) => (
                    <li key={`${l.lugar.nome}:${l.lugar.uf ?? ""}:${i}`} className="mp-fora-item">
                      <Ladrilhos p={l.lugar} f={filtro} />
                      <span className="mp-cidade-texto">
                        <strong>{l.lugar.escrito}</strong>
                        <span className="mp-miudo">
                          {l.motivo === "varios" ? preencher(t.fora.varios, { ufs: l.ufs.join(", ") }) : t.fora.nenhum}
                          {resumoDoPonto(t, l.lugar, filtro) ? ` · ${resumoDoPonto(t, l.lugar, filtro)}` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {AO_VIVO && (
              <Link href={`/${lang}/alumia/mapa/ao-vivo`} className="mp-cartao mp-aovivo">
                <span className="mp-subtitulo al-cond">{t.aoVivo}</span>
                <span className="mp-miudo">{t.aoVivoTexto}</span>
              </Link>
            )}
          </aside>
        </div>
      )}
    </article>
  );
}
