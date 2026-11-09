// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "./stories.css";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as EventoDePonteiro } from "react";
import { checarTexto } from "@/lib/rede/publicar/checagem";
import { desenhoEmImagem, refazerImagem, type Traco } from "@/lib/rede/stories/imagem";
import { alternarFigurinha, linkSeguro, PALETA_DO_STORY, tamanhoDoTexto } from "@/lib/rede/stories/visual";
import type { ClienteDeStories } from "@/lib/rede/cliente-stories";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import {
  CORES_DO_STORY, LIMITES_DO_STORY, PUBLICOS_DO_STORY, TIPOS_DE_FIGURINHA,
  type AtoParaContagem, type CorDoStory, type Figurinha, type PedidoDeStory, type PublicoDoStory, type TipoDeFigurinha,
} from "@/lib/rede/tipos-stories";
import { ContagemEditar } from "../figurinhas/Contagem";
import { EnqueteEditar } from "../figurinhas/Enquete";
import { LinkEditar } from "../figurinhas/Link";
import { PerguntaEditar } from "../figurinhas/Pergunta";
import { FundoDoStory, estiloDaTela } from "./FundoDoStory";
import { IconeFechar } from "./icones";
import { codigoDoErro, focarNoGrupo, indiceDaSeta, larguraDaTela, preencherStory, useAgora, useModalDosStories } from "./usar";

type Modo = "texto" | "desenhar" | "figurinha";

/** O desenho de cada tipo no botão (prancha: "2D" dourado, "?" papel, "A|B" verde-água, "↗" rosa). */
const ICONE_DO_TIPO: Record<TipoDeFigurinha, { texto: string; cor: string }> = {
  contagem: { texto: "2D", cor: "var(--al-dourado, #ffc21a)" },
  pergunta: { texto: "?", cor: "var(--al-texto, #f3efe6)" },
  enquete: { texto: "A|B", cor: "var(--al-com-1, #1fc2b5)" },
  link: { texto: "↗", cor: "var(--al-com-2, #ff5c8a)" },
};

/** Uma figurinha nova, com o que a prancha já mostra preenchido. */
function figurinhaNova(tipo: TipoDeFigurinha, t: TextosDosStories): Figurinha {
  switch (tipo) {
    case "contagem":
      return { tipo, ato: null, titulo: "", inicio: "" };
    case "pergunta":
      return { tipo, texto: "" };
    case "enquete":
      return { tipo, pergunta: "", opcoes: [t.figurinha.enquete.padraoA, t.figurinha.enquete.padraoB] };
    case "link":
      return { tipo, url: "", rotulo: "" };
  }
}

/** O que falta numa figurinha para publicar (a chave do erro), ou nulo. */
function faltaNaFigurinha(f: Figurinha): "ato" | "pergunta" | "enquete" | "link" | null {
  if (f.tipo === "contagem") return f.ato ? null : "ato";
  if (f.tipo === "pergunta") return f.texto.trim() ? null : "pergunta";
  if (f.tipo === "enquete") return f.pergunta.trim() && f.opcoes.every((o) => o.trim()) ? null : "enquete";
  return linkSeguro(f.url) ? null : "link";
}

/**
 * Criar um story (prancha celular-criar-story): "Aa Texto", "Desenhar" e "Figurinha" no alto; o texto grande com a barra dourada
 * e as 6 cores; as figurinhas (Contagem, Pergunta, Enquete, Link) que vão para o story e funcionam nele; "Quem vê" (Seguidores,
 * Comunidade, Próximos); a regra "Some em 24 h. Não vai para o Fediverso. Ninguém vê quem assistiu."; Galeria e Publicar.
 * A imagem e o desenho são refeitos no aparelho (sem metadado nem GPS) antes de sair.
 */
export function Criar({
  t,
  cliente,
  postRef = null,
  aoFechar,
  aoPublicar,
}: {
  t: TextosDosStories;
  cliente: ClienteDeStories;
  /** "Pôr no story": o post de onde veio. */
  postRef?: string | null;
  aoFechar: () => void;
  aoPublicar: () => void;
}) {
  const [modo, setModo] = useState<Modo>("texto");
  const [cor, setCor] = useState<CorDoStory>("azul");
  const [corDoTraco, setCorDoTraco] = useState<CorDoStory>("dourado");
  const [texto, setTexto] = useState("");
  const [legenda, setLegenda] = useState("");
  const [figurinhas, setFigurinhas] = useState<Figurinha[]>([]);
  const [publico, setPublico] = useState<PublicoDoStory>("seguidores");
  const [tracos, setTracos] = useState<Traco[]>([]);
  const [imagem, setImagem] = useState<{ blob: Blob; url: string } | null>(null);
  const [alt, setAlt] = useState("");
  const [atos, setAtos] = useState<AtoParaContagem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [linkInvalido, setLinkInvalido] = useState(false);
  const [estado, setEstado] = useState<"editando" | "publicando" | "publicado">("editando");
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const desenhando = useRef<Traco | null>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const painelFigurinhas = useRef<HTMLHeadingElement>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const campoDoTexto = useRef<HTMLTextAreaElement>(null);
  const agora = useAgora(30_000);
  const id = useId();

  const mexeu = texto.trim() !== "" || legenda.trim() !== "" || figurinhas.length > 0 || tracos.length > 0 || imagem !== null;

  // Os atos para a contagem: só quando a pessoa liga a figurinha.
  const querAtos = figurinhas.some((f) => f.tipo === "contagem");
  useEffect(() => {
    if (!querAtos || atos) return;
    cliente.atos().then(setAtos).catch(() => setAtos([]));
  }, [querAtos, atos, cliente]);

  useModalDosStories(raiz);

  // Prende a rolagem da página de trás e devolve o foco ao fechar. Abre escrevendo, com o cursor dourado no texto (prancha).
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    (campoDoTexto.current ?? raiz.current)?.focus({ preventScroll: true });
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = rolagem;
      antes?.focus?.();
    };
  }, []);

  // Solta o endereço local da imagem quando ela sai.
  useEffect(() => () => (imagem ? URL.revokeObjectURL(imagem.url) : undefined), [imagem]);

  const fechar = () => (mexeu && estado !== "publicado" ? setConfirmarSaida(true) : aoFechar());

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (confirmarSaida) setConfirmarSaida(false);
      else if (mexeu && estado !== "publicado") setConfirmarSaida(true);
      else aoFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar, confirmarSaida, estado, mexeu]);

  function escolherModo(m: Modo) {
    setModo(m);
    if (m === "figurinha") painelFigurinhas.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (m === "figurinha") painelFigurinhas.current?.focus();
  }

  function alternar(tipo: TipoDeFigurinha) {
    setErro(null);
    const antes = figurinhas.length;
    const nova = alternarFigurinha(figurinhas, figurinhaNova(tipo, t));
    if (nova.length === antes && !figurinhas.some((f) => f.tipo === tipo)) setErro(t.criar.limiteDeFigurinhas);
    setFigurinhas(nova);
  }

  const mudarFigurinha = (tipo: TipoDeFigurinha, novo: Partial<Figurinha>) =>
    setFigurinhas((lista) => lista.map((f) => (f.tipo === tipo ? ({ ...f, ...novo } as Figurinha) : f)));

  // ── Desenhar: traços em coordenadas de 0 a 1, para caberem em qualquer tela e na imagem final 1080 × 1920. ──
  const ponto = (e: EventoDePonteiro<SVGSVGElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  const comecar = (e: EventoDePonteiro<SVGSVGElement>) => {
    if (modo !== "desenhar") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    desenhando.current = { cor: PALETA_DO_STORY[corDoTraco].fundo, pontos: [ponto(e)] };
    setTracos((l) => [...l, desenhando.current as Traco]);
  };
  const mover = (e: EventoDePonteiro<SVGSVGElement>) => {
    const atual = desenhando.current;
    if (!atual) return;
    atual.pontos.push(ponto(e));
    setTracos((l) => [...l.slice(0, -1), { ...atual, pontos: [...atual.pontos] }]);
  };
  const terminar = () => {
    desenhando.current = null;
  };

  async function aoEscolherImagem(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    try {
      const blob = await refazerImagem(arquivo);
      if (imagem) URL.revokeObjectURL(imagem.url);
      setImagem({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      setErro(e instanceof Error && e.message === "grande" ? t.criar.erro.grande : t.criar.erro.invalida);
    }
  }

  async function publicar() {
    setErro(null);
    setLinkInvalido(false);
    if (!mexeu || (!texto.trim() && tracos.length === 0 && !imagem && figurinhas.length === 0)) return setErro(t.criar.vazio);
    for (const f of figurinhas) {
      const falta = faltaNaFigurinha(f);
      if (falta) {
        if (falta === "link") setLinkInvalido(true);
        return setErro(t.criar.erro[falta]);
      }
    }
    // Dado pessoal no texto, na tarja ou nas figurinhas: bloqueia aqui; o banco confere de novo (LGPD art. 6º, III).
    const tudo = [texto, legenda, ...figurinhas.map((f) => (f.tipo === "pergunta" ? f.texto : f.tipo === "enquete" ? `${f.pergunta} ${f.opcoes.join(" ")}` : f.tipo === "link" ? f.rotulo : ""))].join("\n");
    if (checarTexto(tudo).bloqueia.length > 0) return setErro(t.criar.erro.dadoPessoal);

    setEstado("publicando");
    try {
      let caminho: string | null = null;
      if (tracos.length > 0) caminho = await cliente.enviarImagem(await desenhoEmImagem(PALETA_DO_STORY[cor].fundo, tracos, imagem?.blob));
      else if (imagem) caminho = await cliente.enviarImagem(imagem.blob);
      const pedido: PedidoDeStory = {
        publico,
        fundo: { tipo: caminho ? "imagem" : "listras", cor },
        texto: texto.trim().slice(0, LIMITES_DO_STORY.texto),
        legenda: legenda.trim() ? legenda.trim().slice(0, LIMITES_DO_STORY.legenda) : null,
        imagem: caminho,
        alt: caminho ? alt.trim() || null : null,
        figurinhas: figurinhas.map((f) => (f.tipo === "link" ? { ...f, url: linkSeguro(f.url) ?? "" } : f)),
        post_ref: postRef,
      };
      await cliente.publicar(pedido);
      setEstado("publicado");
      aoPublicar();
    } catch (e) {
      setEstado("editando");
      const c = codigoDoErro(e);
      setErro(e instanceof Error && e.message === "grande" ? t.criar.erro.grande : t.criar.erro[c as keyof typeof t.criar.erro] ?? t.criar.erro.falha);
    }
  }

  // No "criar" o texto fica um pouco menor que no visor (a prancha: "PLENÁRIA DO / NÚCLEO LESTE" em 2 linhas, com as cores e a
  // figurinha acima da dobra).
  const tamanho = tamanhoDoTexto(texto || t.criar.textoVazio, larguraDaTela(460), 0.76);

  // O campo cresce só com o texto (a barra dourada tem a altura do que está escrito): mede de novo a cada letra e a cada tamanho.
  useLayoutEffect(() => {
    const c = campoDoTexto.current;
    if (!c) return;
    c.style.height = "auto";
    c.style.height = `${c.scrollHeight}px`;
  }, [texto, tamanho]);
  const restam = LIMITES_DO_STORY.texto - [...texto].length;

  return (
    <div ref={raiz} className="al-st-criar" role="dialog" aria-modal="true" aria-labelledby={`${id}-titulo`} tabIndex={-1}>
      <h1 id={`${id}-titulo`} className="sr-only">
        {t.criar.titulo}
      </h1>
      {cliente.previa ? <p className="al-st-previa">{t.previa}</p> : null}
      <div className="al-st-criar-grade">
        {/* ── A tela do story, como vai ficar ── */}
        <div className="al-st-tela" style={estiloDaTela(cor, { "--st-tamanho": `${tamanho}px` } as CSSProperties)}>
          <FundoDoStory tipo={imagem ? "imagem" : "listras"} cor={cor} semente="criar" url={imagem?.url} alt={alt} />
          <svg
            className="al-st-desenho"
            data-ativo={modo === "desenhar" ? "sim" : "nao"}
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            role={modo === "desenhar" ? "img" : undefined}
            aria-label={modo === "desenhar" ? t.criar.desenho : undefined}
            aria-hidden={modo === "desenhar" ? undefined : true}
            onPointerDown={comecar}
            onPointerMove={mover}
            onPointerUp={terminar}
            onPointerCancel={terminar}
          >
            {tracos.map((tr, k) => (
              <polyline
                key={k}
                points={tr.pontos.map(([x, y]) => `${x * 1000},${y * 1000}`).join(" ")}
                fill="none"
                stroke={tr.cor}
                strokeWidth={6}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          <div className="al-st-criar-topo" role="toolbar" aria-label={t.criar.modos} style={{ position: "relative", zIndex: 5 }}>
            <button type="button" className="al-st-icone" aria-label={t.criar.fechar} onClick={fechar}>
              <IconeFechar />
            </button>
            <button type="button" className="al-st-modo" aria-pressed={modo === "texto"} onClick={() => escolherModo("texto")}>
              <span aria-hidden>{t.criar.modoTextoAa} </span>
              {t.criar.modoTexto}
            </button>
            <button type="button" className="al-st-modo" aria-pressed={modo === "desenhar"} onClick={() => escolherModo("desenhar")}>
              {t.criar.modoDesenhar}
            </button>
            <button type="button" className="al-st-modo" aria-pressed={modo === "figurinha"} onClick={() => escolherModo("figurinha")}>
              {t.criar.modoFigurinha}
            </button>
          </div>

          <div className="al-st-escrita" style={{ zIndex: modo === "desenhar" ? 0 : 3 }}>
            <label htmlFor={`${id}-texto`} className="sr-only">
              {t.criar.texto}
            </label>
            <textarea
              id={`${id}-texto`}
              ref={campoDoTexto}
              className="al-st-texto"
              rows={1}
              value={texto}
              maxLength={LIMITES_DO_STORY.texto}
              placeholder={t.criar.textoVazio}
              aria-describedby={`${id}-restam`}
              onChange={(e) => setTexto(e.target.value)}
            />
            <span id={`${id}-restam`} className="al-st-restam" aria-live="polite">
              {restam <= 30 ? preencherStory(t.criar.restam, { n: restam }) : ""}
            </span>
            {texto.trim() || legenda ? (
              <p className="al-st-tarja" data-vazia={legenda ? "nao" : "sim"}>
                <label htmlFor={`${id}-tarja`} className="sr-only">
                  {t.criar.tarja}
                </label>
                <input id={`${id}-tarja`} value={legenda} maxLength={LIMITES_DO_STORY.legenda} placeholder={t.criar.tarjaVazia} onChange={(e) => setLegenda(e.target.value)} />
              </p>
            ) : null}
          </div>

          <fieldset className="al-st-cores" role="radiogroup" style={{ position: "relative", zIndex: 5 }}>
            <legend>{modo === "desenhar" ? t.criar.coresDoTraco : t.criar.cores}</legend>
            {CORES_DO_STORY.map((c, k) => {
              const escolhida = modo === "desenhar" ? corDoTraco === c : cor === c;
              const escolher = (x: CorDoStory) => (modo === "desenhar" ? setCorDoTraco(x) : setCor(x));
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={escolhida}
                  aria-label={t.criar.cor[c]}
                  tabIndex={escolhida ? 0 : -1}
                  className="al-st-cor"
                  style={{ background: PALETA_DO_STORY[c].fundo }}
                  onClick={() => escolher(c)}
                  onKeyDown={(e) => {
                    const n = indiceDaSeta(e.key, k, CORES_DO_STORY.length);
                    if (n === null) return;
                    e.preventDefault();
                    escolher(CORES_DO_STORY[n]);
                    focarNoGrupo(e.currentTarget, "[role=radio]", n);
                  }}
                />
              );
            })}
          </fieldset>

          {modo === "desenhar" ? (
            <div className="al-st-desenho-acoes">
              <button type="button" className="al-st-modo" disabled={tracos.length === 0} onClick={() => setTracos((l) => l.slice(0, -1))}>
                {t.criar.desfazer}
              </button>
              <button type="button" className="al-st-modo" disabled={tracos.length === 0} onClick={() => setTracos([])}>
                {t.criar.limpar}
              </button>
            </div>
          ) : null}

          {figurinhas.length > 0 ? (
            <div className="al-st-palco-figurinhas" style={{ position: "relative", zIndex: modo === "desenhar" ? 0 : 3 }}>
              {figurinhas.map((f) => (
                <div key={f.tipo} style={{ position: "relative" }} className={f.tipo === "enquete" ? "al-fg-enquete-caixa" : undefined}>
                  {f.tipo === "contagem" ? (
                    <ContagemEditar t={t.figurinha.contagem} atos={atos} ato={f.ato} agora={agora} aoEscolher={(a) => mudarFigurinha("contagem", { ato: a.id, titulo: a.titulo, inicio: a.inicio })} />
                  ) : f.tipo === "pergunta" ? (
                    <PerguntaEditar texto={f.texto} t={t.figurinha.pergunta} aoMudar={(x) => mudarFigurinha("pergunta", { texto: x })} />
                  ) : f.tipo === "enquete" ? (
                    <EnqueteEditar pergunta={f.pergunta} opcoes={f.opcoes} t={t.figurinha.enquete} aoMudar={(p, o) => mudarFigurinha("enquete", { pergunta: p, opcoes: o })} />
                  ) : (
                    <LinkEditar
                      url={f.url}
                      rotulo={f.rotulo}
                      t={t.figurinha.link}
                      invalido={linkInvalido ? t.criar.erro.link : null}
                      aoMudar={(u, r) => {
                        setLinkInvalido(false);
                        mudarFigurinha("link", { url: u, rotulo: r });
                      }}
                    />
                  )}
                  <button type="button" className="al-fg-tirar" aria-label={preencherStory(t.criar.figurinhaLigada, { nome: t.criar.tipo[f.tipo] })} onClick={() => alternar(f.tipo)}>
                    <IconeFechar />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* ── O painel: figurinhas, quem vê, a regra, galeria e publicar ── */}
        <div className="al-st-painel">
          <h2 ref={painelFigurinhas} tabIndex={-1} className="al-cond al-st-titulo-secao">
            {t.criar.figurinhas}
          </h2>
          <ul className="al-st-tipos">
            {TIPOS_DE_FIGURINHA.map((tipo) => (
              <li key={tipo}>
                <button type="button" className="al-st-tipo" aria-pressed={figurinhas.some((f) => f.tipo === tipo)} onClick={() => alternar(tipo)}>
                  <span className="al-st-tipo-icone al-cond" aria-hidden style={{ color: ICONE_DO_TIPO[tipo].cor }}>
                    {ICONE_DO_TIPO[tipo].texto}
                  </span>
                  {t.criar.tipo[tipo]}
                </button>
              </li>
            ))}
          </ul>

          <fieldset className="al-st-quem" role="radiogroup" aria-describedby={`${id}-regra`}>
            <legend className="al-cond al-st-titulo-secao">{t.criar.quemVe}</legend>
            {PUBLICOS_DO_STORY.map((p, k) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={publico === p}
                tabIndex={publico === p ? 0 : -1}
                className="al-st-quem-op"
                title={t.criar.publicoAjuda[p]}
                onClick={() => setPublico(p)}
                onKeyDown={(e) => {
                  const n = indiceDaSeta(e.key, k, PUBLICOS_DO_STORY.length);
                  if (n === null) return;
                  e.preventDefault();
                  setPublico(PUBLICOS_DO_STORY[n]);
                  focarNoGrupo(e.currentTarget, "[role=radio]", n);
                }}
              >
                {t.criar.publico[p]}
              </button>
            ))}
          </fieldset>
          <p className="al-st-dica">{t.criar.publicoAjuda[publico]}</p>
          <p id={`${id}-regra`} className="al-st-regra">
            {t.criar.regra}
          </p>
          {postRef ? <p className="al-st-dica">{t.criar.deUmPost}</p> : null}

          {imagem ? (
            <>
              <label className="al-st-alt">
                {t.criar.alt}
                <input value={alt} maxLength={200} onChange={(e) => setAlt(e.target.value)} />
              </label>
              <p className="al-st-dica">{t.criar.semMetadado}</p>
              <button type="button" className="al-botao al-botao-fantasma al-botao-p" style={{ justifySelf: "start", marginTop: 8 }} onClick={() => setImagem(null)}>
                {t.criar.tirarImagem}
              </button>
            </>
          ) : null}

          {erro ? (
            <p className="al-st-erro-criar" role="alert">
              {erro}
            </p>
          ) : null}
          {estado === "publicado" ? (
            <p className="al-st-feito" role="status">
              {t.criar.publicado}
            </p>
          ) : null}

          <div className="al-st-acoes">
            <input
              ref={galeria}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                void aoEscolherImagem(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button type="button" className="al-botao al-botao-contorno al-botao-m al-st-galeria" onClick={() => galeria.current?.click()}>
              {imagem ? t.criar.trocarImagem : t.criar.galeria}
            </button>
            <button type="button" className="al-botao al-botao-primario al-botao-m" disabled={estado !== "editando"} aria-busy={estado === "publicando"} onClick={() => void publicar()}>
              {estado === "publicando" ? t.criar.publicando : t.criar.publicar}
            </button>
          </div>
        </div>
      </div>

      {confirmarSaida ? (
        <div className="al-st-caixa" role="alertdialog" aria-labelledby={`${id}-sair`} style={{ position: "fixed", zIndex: 90 }}>
          <h2 id={`${id}-sair`}>{t.criar.descartar}</h2>
          <div className="al-st-caixa-acoes">
            <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={() => setConfirmarSaida(false)}>
              {t.criar.descartarNao}
            </button>
            <button type="button" className="al-botao al-botao-primario al-botao-m" onClick={aoFechar}>
              {t.criar.descartarSim}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
