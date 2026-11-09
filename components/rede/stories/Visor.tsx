// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "./stories.css";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { armazemDoAparelho, alternarSilencio, marcarVisto } from "@/lib/rede/stories/aparelho";
import { haQuanto, noAr } from "@/lib/rede/stories/tempo";
import { barrasDoProgresso, duracaoDoStory, tamanhoDoTexto } from "@/lib/rede/stories/visual";
import type { ClienteDeStories } from "@/lib/rede/cliente-stories";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import { CATEGORIAS_DE_DENUNCIA, type CategoriaDeDenuncia } from "@/lib/rede/tipos-moderacao";
import { LIMITES_DO_STORY, REACOES_DO_STORY, type FigurinhaEnquete, type ReacaoDoStory, type Story } from "@/lib/rede/tipos-stories";
import { ContagemVer } from "../figurinhas/Contagem";
import { EnqueteVer } from "../figurinhas/Enquete";
import { LinkVer } from "../figurinhas/Link";
import { PerguntaVer } from "../figurinhas/Pergunta";
import { Avatar16 } from "../ui/Avatar16";
import { FundoDoStory, estiloDaTela } from "./FundoDoStory";
import { IconeFechar, IconePausar, IconeSetaDir, IconeSetaEsq, IconeTocar, IconeTresPontos } from "./icones";
import { codigoDoErro, focarNoGrupo, indiceDaSeta, larguraDaTela, preencherStory, useAgora, useModalDosStories } from "./usar";

/** As reações da prancha (conjunto fechado, sem emoji livre: PLANO-ALUMIA §12). */
const DESENHO_DA_REACAO: Record<ReacaoDoStory, string> = { punho: "✊", chama: "\u{1F525}", coracao: "❤️" };

type Caixa = null | "menu" | "denunciar" | "apagar";

/**
 * O visor em tela cheia (prancha celular-ver-story): barras de progresso, quem publicou e para quem, pausar, mais opções e fechar;
 * o texto grande, a tarja e as figurinhas que funcionam (contagem do ato com "Me avise quando começar", enquete secreta, pergunta,
 * link); e embaixo "Responder só para…" e as três reações — tudo vai SÓ para a autora. Nada aqui conta ao servidor que eu vi:
 * o "visto" é marcado só no aparelho (PLANO-ALUMIA §6.4; LGPD art. 11, opinião política é dado sensível).
 *
 * Teclado: com o foco no visor (não num botão), setas trocam e espaço pausa; Esc fecha. O Tab não sai do visor (o que está atrás
 * fica inert). Toque: esquerda volta, direita avança, segurar pausa (soltar depois de segurar não troca de story).
 */
export function Visor({
  t,
  cliente,
  lang,
  handle,
  inicio = 0,
  fila = [],
  aoFechar,
  aoMudou,
}: {
  t: TextosDosStories;
  cliente: ClienteDeStories;
  lang: string;
  /** De quem ("eu" = os meus). */
  handle: string;
  inicio?: number;
  /** As próximas autoras da faixa, na ordem: ao acabar uma, o visor passa para a seguinte. */
  fila?: string[];
  aoFechar: () => void;
  /** Algo mudou (vi, apaguei, silenciei): a faixa relê. */
  aoMudou?: () => void;
}) {
  const [quem, setQuem] = useState(handle);
  const [stories, setStories] = useState<Story[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [i, setI] = useState(inicio);
  const [fracao, setFracao] = useState(0);
  const [pausadoPelaPessoa, setPausadoPelaPessoa] = useState(false);
  const [segurando, setSegurando] = useState(false);
  const [digitando, setDigitando] = useState(false);
  const [caixa, setCaixa] = useState<Caixa>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [resposta, setResposta] = useState("");
  const [reacaoFeita, setReacaoFeita] = useState<{ id: string; r: ReacaoDoStory } | null>(null);
  const [categoria, setCategoria] = useState<CategoriaDeDenuncia | null>(null);
  const [detalhe, setDetalhe] = useState("");
  const agora = useAgora(15_000);
  const raiz = useRef<HTMLDivElement>(null);
  const botaoMais = useRef<HTMLButtonElement>(null);
  /** Quando o dedo desceu numa área de toque: soltar depois de ~250 ms foi "segurar" (pausa), não um toque que troca. */
  const tocouEm = useRef(0);
  const idDoTitulo = useId();
  useModalDosStories(raiz);

  // Carrega os stories da autora (ou os meus). Uma leitura igual a abrir um perfil: o servidor não registra quem abriu.
  useEffect(() => {
    let vivo = true;
    (quem === "eu" ? cliente.meus() : cliente.abrir(quem))
      .then((lista) => {
        if (!vivo) return;
        setStories(lista);
        setErro(null);
      })
      .catch((e) => vivo && setErro(codigoDoErro(e)));
    return () => {
      vivo = false;
    };
  }, [cliente, quem]);

  const vivos = stories?.filter((s) => noAr(s.expira_em, agora)) ?? null;
  const atual = vivos && vivos.length > 0 ? vivos[Math.min(i, vivos.length - 1)] : null;
  const pausado = pausadoPelaPessoa || segurando || digitando || caixa !== null || ocupado;

  // Foco no visor ao abrir (o teclado já funciona) e de volta para onde estava ao fechar.
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    raiz.current?.focus();
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = rolagem;
      antes?.focus?.();
    };
  }, []);

  // Marca como visto SÓ neste aparelho.
  useEffect(() => {
    if (!atual) return;
    marcarVisto(armazemDoAparelho(), atual.id, Date.now());
    aoMudou?.();
    // aoMudou muda a cada render do pai; só o story importa aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual?.id]);

  const fracaoAtual = useRef(0);
  const zerar = () => {
    fracaoAtual.current = 0;
    setFracao(0);
    setResposta("");
  };

  const proximaAutora = useCallback(() => {
    const k = fila.indexOf(quem);
    const seguinte = quem === "eu" ? fila[0] : k >= 0 ? fila[k + 1] : undefined;
    if (seguinte) {
      setStories(null);
      setQuem(seguinte);
      setI(0);
      zerar();
    } else aoFechar();
  }, [aoFechar, fila, quem]);

  const avancar = useCallback(() => {
    if (!vivos) return;
    if (i + 1 < vivos.length) {
      setI(i + 1);
      zerar();
    } else proximaAutora();
  }, [i, proximaAutora, vivos]);

  const voltar = useCallback(() => {
    zerar();
    if (i > 0) setI(i - 1);
  }, [i]);
  const avancarAgora = useRef(avancar);
  useEffect(() => {
    avancarAgora.current = avancar;
  }, [avancar]);

  // O relógio da barra: anda só com o story à vista e sem pausa (tela escondida também pausa).
  const duracao = atual ? duracaoDoStory(atual.figurinhas) : 6000;
  useEffect(() => {
    if (!atual || pausado) return;
    let anterior = performance.now();
    let quadro = 0;
    const passo = (t0: number) => {
      const dt = document.hidden ? 0 : t0 - anterior;
      anterior = t0;
      fracaoAtual.current = Math.min(1, fracaoAtual.current + dt / duracao);
      setFracao(fracaoAtual.current);
      if (fracaoAtual.current >= 1) avancarAgora.current();
      else quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [atual, pausado, duracao]);

  // Teclado.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (e.key === "Escape") {
        e.preventDefault();
        if (caixa) setCaixa(null);
        else aoFechar();
        return;
      }
      // Espaço e setas só valem com o foco no próprio visor (ou numa área de toque): num botão, o Espaço aciona o botão
      // (WCAG 2.1.1); num campo, escreve.
      const livre = !alvo || alvo === raiz.current || alvo === document.body || alvo.classList.contains("al-st-toque");
      if (!livre || caixa) return;
      if (e.key === "ArrowRight") avancar();
      else if (e.key === "ArrowLeft") voltar();
      else if (e.key === " ") {
        e.preventDefault();
        setPausadoPelaPessoa((p) => !p);
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar, avancar, voltar, caixa]);

  // O foco acompanha a caixa aberta: o menu leva ao primeiro item, a denúncia à primeira categoria, o "apagar" ao Cancelar; ao
  // fechar qualquer uma, volta ao botão ⋯.
  const caixaAntes = useRef<Caixa>(null);
  useEffect(() => {
    const antes = caixaAntes.current;
    caixaAntes.current = caixa;
    const r = raiz.current;
    if (!r) return;
    if (caixa === "menu") r.querySelector<HTMLElement>(".al-st-menu [role=menuitem]")?.focus();
    else if (caixa === "denunciar") r.querySelector<HTMLElement>(".al-st-caixa input[type=radio]")?.focus();
    else if (caixa === "apagar") r.querySelector<HTMLElement>(".al-st-caixa .al-botao")?.focus();
    else if (antes) botaoMais.current?.focus();
  }, [caixa]);

  // Sem stories (sumiram ou nada a ver): segue para a próxima autora.
  useEffect(() => {
    if (vivos && vivos.length === 0 && !erro) {
      const id = window.setTimeout(proximaAutora, 1200);
      return () => window.clearTimeout(id);
    }
  }, [vivos, erro, proximaAutora]);

  const avisar = (texto: string) => {
    setRecado(texto);
    window.setTimeout(() => setRecado((r) => (r === texto ? null : r)), 3200);
  };

  const nome = atual?.autora.nome ?? "";
  const reagiu = reacaoFeita && atual && reacaoFeita.id === atual.id ? reacaoFeita.r : null;
  const meu = !!atual?.meu;

  async function enviarResposta(texto: string): Promise<boolean> {
    if (!atual) return false;
    setOcupado(true);
    try {
      await cliente.responder(atual.id, texto.slice(0, LIMITES_DO_STORY.resposta));
      avisar(preencherStory(t.visor.enviado, { nome }));
      return true;
    } catch {
      avisar(t.visor.erroAoEnviar);
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function reagir(r: ReacaoDoStory) {
    if (!atual || ocupado) return;
    setOcupado(true);
    try {
      await cliente.reagir(atual.id, r);
      setReacaoFeita({ id: atual.id, r });
      avisar(preencherStory(t.visor.reagiu, { reacao: t.visor.reacao[r], nome }));
    } catch {
      avisar(t.visor.erroAoEnviar);
    } finally {
      setOcupado(false);
    }
  }

  function trocarFigurinha(id: string, nova: Partial<FigurinhaEnquete> | { avisar: boolean }, tipo: "enquete" | "contagem") {
    setStories((lista) =>
      lista?.map((s) => (s.id !== id ? s : { ...s, figurinhas: s.figurinhas.map((f) => (f.tipo === tipo ? ({ ...f, ...nova } as typeof f) : f)) })) ?? null,
    );
  }

  async function votar(opcao: 0 | 1) {
    if (!atual) return;
    setOcupado(true);
    try {
      const f = await cliente.votar(atual.id, opcao);
      trocarFigurinha(atual.id, { meu_voto: f.meu_voto ?? opcao }, "enquete");
    } catch {
      avisar(t.visor.erroAoEnviar);
    } finally {
      setOcupado(false);
    }
  }

  async function pedirAviso(sim: boolean) {
    if (!atual) return;
    setOcupado(true);
    try {
      const r = await cliente.avisar(atual.id, sim);
      trocarFigurinha(atual.id, { avisar: r.avisar }, "contagem");
    } catch {
      avisar(t.visor.erroAoEnviar);
    } finally {
      setOcupado(false);
    }
  }

  async function denunciar() {
    if (!atual || !categoria) return;
    setOcupado(true);
    try {
      const r = await cliente.denunciar(atual.id, categoria, detalhe.trim());
      setCaixa(null);
      setCategoria(null);
      setDetalhe("");
      avisar(preencherStory(t.visor.denunciaEnviada, { protocolo: r.protocolo }));
    } catch {
      avisar(t.visor.erroAoEnviar);
    } finally {
      setOcupado(false);
    }
  }

  async function apagar() {
    if (!atual) return;
    setOcupado(true);
    try {
      await cliente.apagar(atual.id);
      setCaixa(null);
      setStories((lista) => lista?.filter((s) => s.id !== atual.id) ?? null);
      aoMudou?.();
      avisar(t.visor.apagado);
    } catch {
      avisar(t.visor.erroAoEnviar);
    } finally {
      setOcupado(false);
    }
  }

  function silenciar() {
    if (!atual) return;
    alternarSilencio(armazemDoAparelho(), atual.autora.handle, true);
    aoMudou?.();
    setCaixa(null);
    avisar(preencherStory(t.visor.silenciado, { nome }));
    window.setTimeout(proximaAutora, 1500);
  }

  const quando = atual ? haQuanto(atual.criado_em, agora) : null;
  const quandoTexto = !quando ? "" : quando.unidade === "agora" ? t.visor.agora : quando.unidade === "min" ? preencherStory(t.visor.min, { n: quando.n }) : preencherStory(t.visor.h, { n: Math.min(23, quando.unidade === "d" ? 23 : quando.n) });
  const barras = vivos ? barrasDoProgresso(vivos.length, Math.min(i, vivos.length - 1), fracao) : [];

  return (
    <div
      ref={raiz}
      className="al-st-visor"
      role="dialog"
      aria-modal="true"
      aria-labelledby={idDoTitulo}
      aria-describedby={`${idDoTitulo}-ajuda`}
      tabIndex={-1}
    >
      <p id={`${idDoTitulo}-ajuda`} className="sr-only">
        {t.visor.ajuda}
      </p>
      <div className="al-st-visor-palco">
        <div className="al-st-tela" style={atual ? estiloDaTela(atual.fundo.cor) : undefined}>
          {atual ? (
            <FundoDoStory
              tipo={atual.fundo.tipo}
              cor={atual.fundo.cor}
              semente={atual.id}
              url={atual.fundo.tipo === "imagem" ? atual.fundo.url : undefined}
              alt={atual.fundo.tipo === "imagem" ? atual.fundo.alt || t.visor.imagem : undefined}
            />
          ) : null}

          <ol className="al-st-barras" aria-label={atual && vivos ? preencherStory(t.visor.progresso, { i: Math.min(i, vivos.length - 1) + 1, n: vivos.length }) : undefined}>
            {barras.map((b, k) => (
              <li key={k} className="al-st-barra" aria-hidden>
                <span style={{ transform: `scaleX(${b})` }} />
              </li>
            ))}
          </ol>

          <div className="al-st-topo">
            <div className="al-st-topo-quem">
              {atual ? <Avatar16 handle={atual.autora.handle} cor={atual.autora.cor ?? undefined} tamanho={38} /> : null}
              <span className="al-st-topo-nome">
                <strong id={idDoTitulo}>
                  {atual ? (meu ? t.visor.seu : nome) : t.visor.carregando}
                  {quandoTexto ? <span> · {quandoTexto}</span> : null}
                </strong>
                {atual ? <small>{t.visor.publico[atual.publico]}</small> : null}
              </span>
            </div>
            <button
              type="button"
              className="al-st-icone"
              aria-label={pausadoPelaPessoa ? t.visor.continuar : t.visor.pausar}
              aria-pressed={pausadoPelaPessoa}
              onClick={() => setPausadoPelaPessoa((p) => !p)}
            >
              {pausadoPelaPessoa ? <IconeTocar /> : <IconePausar />}
            </button>
            <button
              type="button"
              className="al-st-icone"
              aria-label={t.visor.mais}
              ref={botaoMais}
              aria-haspopup="menu"
              aria-expanded={caixa === "menu"}
              disabled={!atual}
              onClick={() => setCaixa((c) => (c === "menu" ? null : "menu"))}
            >
              <IconeTresPontos />
            </button>
            <button type="button" className="al-st-icone" aria-label={t.visor.fechar} onClick={aoFechar}>
              <IconeFechar />
            </button>
          </div>

          {/* Toque: esquerda volta, direita avança, segurar pausa. Atrás do texto e das figurinhas. */}
          {(["esq", "dir"] as const).map((lado) => (
            <button
              key={lado}
              type="button"
              className={`al-st-toque al-st-toque-${lado}`}
              aria-label={lado === "esq" ? t.visor.anterior : t.visor.proximo}
              tabIndex={-1}
              onClick={() => {
                const segurou = tocouEm.current > 0 && performance.now() - tocouEm.current > 250;
                tocouEm.current = 0;
                if (segurou) return;
                if (lado === "esq") voltar();
                else avancar();
              }}
              onPointerDown={() => {
                tocouEm.current = performance.now();
                setSegurando(true);
              }}
              onPointerUp={() => setSegurando(false)}
              onPointerLeave={() => setSegurando(false)}
              onPointerCancel={() => {
                tocouEm.current = 0;
                setSegurando(false);
              }}
              onContextMenu={(e) => e.preventDefault()}
            />
          ))}

          {atual ? (
            <div className="al-st-miolo" style={{ "--st-tamanho": `${tamanhoDoTexto(atual.texto, larguraDaTela())}px` } as CSSProperties}>
              {atual.texto ? <h2 className="al-st-texto al-st-texto-sombra">{atual.texto}</h2> : null}
              {atual.legenda ? <p className="al-st-tarja">{atual.legenda}</p> : null}
              {atual.figurinhas.length > 0 ? (
                <div className="al-st-figurinhas">
                  {atual.figurinhas.map((f, k) =>
                    f.tipo === "contagem" ? (
                      <ContagemVer key={k} f={f} t={t.figurinha.contagem} agora={agora} lang={lang} ocupado={ocupado} aoAvisar={meu ? null : pedirAviso} />
                    ) : f.tipo === "enquete" ? (
                      <EnqueteVer key={k} f={f} t={t.figurinha.enquete} nome={nome.split(" ")[0]} meu={meu} ocupado={ocupado} aoVotar={votar} />
                    ) : f.tipo === "pergunta" ? (
                      <PerguntaVer key={k} texto={f.texto} t={t.figurinha.pergunta} nome={nome.split(" ")[0]} meu={meu} enviar={enviarResposta} aoFoco={setDigitando} />
                    ) : (
                      <LinkVer key={k} url={f.url} rotulo={f.rotulo} t={t.figurinha.link} />
                    ),
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="al-st-estado" role="status">
              {erro ? (erro === "banco" ? t.criar.erro.banco : t.visor.erro) : vivos && vivos.length === 0 ? t.visor.sumiu : t.visor.carregando}
            </p>
          )}

          {caixa === "menu" && atual ? (
            <ul
              className="al-st-menu"
              role="menu"
              aria-label={t.visor.mais}
              onKeyDown={(e) => {
                const itens = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]"));
                const k = indiceDaSeta(e.key, Math.max(0, itens.indexOf(document.activeElement as HTMLElement)), itens.length, "vertical");
                if (k === null) {
                  if (e.key === "Tab") {
                    e.preventDefault();
                    setCaixa(null);
                  }
                  return;
                }
                e.preventDefault();
                focarNoGrupo(e.target as HTMLElement, "[role=menuitem]", k);
              }}
            >
              {meu ? (
                <li role="none">
                  <button type="button" role="menuitem" tabIndex={-1} className="al-st-perigo" onClick={() => setCaixa("apagar")}>
                    {t.visor.apagar}
                  </button>
                </li>
              ) : (
                <>
                  <li role="none">
                    <button type="button" role="menuitem" tabIndex={-1} onClick={silenciar}>
                      {preencherStory(t.visor.silenciar, { nome })}
                    </button>
                  </li>
                  <li role="none">
                    <button type="button" role="menuitem" tabIndex={-1} className="al-st-perigo" onClick={() => setCaixa("denunciar")}>
                      {t.visor.denunciar}
                    </button>
                  </li>
                </>
              )}
            </ul>
          ) : null}

          {caixa === "denunciar" ? (
            <form
              className="al-st-caixa"
              aria-labelledby={`${idDoTitulo}-den`}
              onSubmit={(e) => {
                e.preventDefault();
                void denunciar();
              }}
            >
              <h2 id={`${idDoTitulo}-den`}>{t.visor.denunciaTitulo}</h2>
              <p>{t.visor.denunciaAjuda}</p>
              <fieldset>
                <legend className="sr-only">{t.visor.denunciaTitulo}</legend>
                {CATEGORIAS_DE_DENUNCIA.map((c) => (
                  <label key={c}>
                    <input type="radio" name="categoria" value={c} checked={categoria === c} onChange={() => setCategoria(c)} />
                    {t.visor.categorias[c]}
                  </label>
                ))}
              </fieldset>
              <textarea value={detalhe} maxLength={500} onChange={(e) => setDetalhe(e.target.value)} aria-label={t.visor.denunciaTitulo} />
              <div className="al-st-caixa-acoes">
                <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={() => setCaixa(null)}>
                  {t.visor.cancelar}
                </button>
                <button type="submit" className="al-botao al-botao-primario al-botao-m" disabled={!categoria || ocupado}>
                  {t.visor.denunciaEnviar}
                </button>
              </div>
            </form>
          ) : null}

          {caixa === "apagar" ? (
            <div className="al-st-caixa" role="alertdialog" aria-labelledby={`${idDoTitulo}-ap`}>
              <h2 id={`${idDoTitulo}-ap`}>{t.visor.apagarConfirma}</h2>
              <div className="al-st-caixa-acoes">
                <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={() => setCaixa(null)}>
                  {t.visor.cancelar}
                </button>
                <button type="button" className="al-botao al-botao-primario al-botao-m" disabled={ocupado} onClick={() => void apagar()}>
                  {t.visor.apagarSim}
                </button>
              </div>
            </div>
          ) : null}

          {recado ? (
            <p className="al-st-recado" role="status">
              {recado}
            </p>
          ) : null}
        </div>
        <button type="button" className="al-st-seta al-st-seta-esq" aria-label={t.visor.anterior} disabled={i === 0} onClick={voltar}>
          <IconeSetaEsq />
        </button>
        <button type="button" className="al-st-seta al-st-seta-dir" aria-label={t.visor.proximo} disabled={!atual} onClick={avancar}>
          <IconeSetaDir />
        </button>
      </div>

      <div className="al-st-rodape">
        {meu ? (
          <p className="al-st-dica" style={{ margin: "0 6px", color: "inherit" }}>
            {t.visor.respostasChegam}
          </p>
        ) : (
          <>
            <form
              className="al-st-responder"
              onSubmit={async (e) => {
                e.preventDefault();
                const r = resposta.trim();
                if (r && (await enviarResposta(r))) setResposta("");
              }}
            >
              <label htmlFor={`${idDoTitulo}-r`} className="sr-only">
                {preencherStory(t.visor.responderRotulo, { nome: nome.split(" ")[0] })}
              </label>
              <input
                id={`${idDoTitulo}-r`}
                value={resposta}
                maxLength={LIMITES_DO_STORY.resposta}
                placeholder={preencherStory(t.visor.responder, { nome: nome.split(" ")[0] })}
                disabled={!atual || ocupado}
                autoComplete="off"
                enterKeyHint="send"
                onChange={(e) => setResposta(e.target.value)}
                onFocus={() => setDigitando(true)}
                onBlur={() => setDigitando(false)}
              />
              {resposta.trim() ? (
                <button type="submit" className="al-botao al-botao-claro al-botao-m" disabled={ocupado}>
                  {t.visor.enviar}
                </button>
              ) : null}
            </form>
            <div role="group" aria-label={preencherStory(t.visor.reacoes, { nome: nome.split(" ")[0] })} style={{ display: "flex" }}>
              {REACOES_DO_STORY.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="al-st-reacao"
                  aria-label={t.visor.reacao[r]}
                  aria-pressed={reagiu === r}
                  disabled={!atual || ocupado}
                  onClick={() => void reagir(r)}
                >
                  <span aria-hidden>{DESENHO_DA_REACAO[r]}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
