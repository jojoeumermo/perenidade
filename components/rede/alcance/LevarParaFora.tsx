// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// "Levar para fora", no menu "mais" do cartão (encaixe acoesDoCartao, frente 13C). Abre uma folha com três partes:
//   · a ARTE em PNG do post, desenhada aqui no aparelho (lib/rede/alcance/arte.ts), com o fundo e o formato que a pessoa escolhe e,
//     se ela quiser, o QR do link na própria arte;
//   · o QR do ATO (quando o post é um chamado) ou do post, também feito aqui;
//   · o CARTÃO para colar em outro site: só quando a rota do cartão responde (o banco deixou o post sair), com o código do quadro
//     com sandbox e a prévia de como fica.
// A arte só aparece para post aberto à internet ou da própria pessoa (lib/rede/alcance/regras.ts). Nada vai a serviço de fora.
// Prompt 4, item 120 (com "alumia-p4-cartao-do-post"): a arte vira a imagem para Instagram e WhatsApp. Só post aberto à internet
// (nem o restrito da própria pessoa: a imagem circula fora sem a trava de quem vê), o formato vem do destino (feed, stories,
// conversa, status), a pessoa pode esconder quem escreveu e o pé leva o endereço da Alumia e o @institutoluciaorg. Compartilhar
// usa só o compartilhar do próprio aparelho (navigator.share); sem ele, baixa o PNG.
// A folha abre no corpo da página (portal), com a pele da Alumia; Esc fecha e o foco volta ao "mais".
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PALETA_CREME, PALETA_NOITE, TAMANHOS, desenharArte, type Formato, type MatrizDoQr } from "@/lib/rede/alcance/arte";
import { PREVIA_DO_ALCANCE, rotaResponde } from "@/lib/rede/alcance/cliente";
import { codigoParaColar, postEhAto, postPodeSair, postPodeVirarArte, rotasDoAlcance } from "@/lib/rede/alcance/regras";
import type { TextosDoAlcance } from "@/lib/rede/alcance/textos";
import { preencher } from "@/lib/rede/preencher";
import type { Post } from "@/lib/rede/tipos";
import type { ContextoDoEncaixe } from "../encaixes";
import { cartaoP4Ligado } from "@/lib/rede/p4/cartao/ligado";
import { autoriaDaImagem, DESTINOS_DA_IMAGEM, postPodeVirarImagem, rodapeDaImagem, type DestinoDaImagem } from "@/lib/rede/p4/cartao/regras";
import { useTextosDoCartaoP4, type TextosDoCartaoP4 } from "../p4/cartao/usar";
import { baixarArquivo, copiarTexto, enderecoDaTela, origemAqui, useQr, useTextosDoAlcance } from "./usar";
import "./alcance.css";

function Icone() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <path d="M14 3h7v7M21 3l-8 8M3 14v7h7" />
    </svg>
  );
}

/** O grupo "cartão do post" do Prompt 4 está ligado nesta montagem (a arte segue a regra do item 120)? */
const P4 = cartaoP4Ligado();

/** A arte pode sair deste post? Com o item 120 ligado, só post aberto à internet; sem ele, a regra da frente 13C. */
function arteDoPost(post: Post): boolean {
  return P4 ? postPodeVirarImagem(post) : postPodeVirarArte(post);
}

/** O post tem alguma coisa que pode ir para fora? (Na prévia, os posts de exemplo também, para conferir a tela.) */
export function temOQueLevar(post: Post): boolean {
  return PREVIA_DO_ALCANCE || arteDoPost(post) || postPodeSair(post) || postEhAto(post);
}

export function LevarParaFora({ lang, post }: ContextoDoEncaixe & { post: Post }) {
  const [aberto, setAberto] = useState(false);
  const volta = useRef<HTMLElement | null>(null);
  const [pele, setPele] = useState<Record<string, string>>({});
  const t = useTextosDoAlcance(lang, temOQueLevar(post));
  if (!t || !temOQueLevar(post)) return null;
  function abrir(e: React.MouseEvent<HTMLButtonElement>) {
    const casca = e.currentTarget.closest<HTMLElement>('[data-al="2"]');
    setPele(Object.fromEntries(["data-al", "data-al-tema", "data-al-sem-numeros"].flatMap((n) => (casca?.hasAttribute(n) ? [[n, casca.getAttribute(n) ?? ""]] : []))));
    const menu = e.currentTarget.closest("details");
    volta.current = menu?.querySelector("summary") ?? null;
    menu?.removeAttribute("open");
    setAberto(true);
  }
  function fechar() {
    setAberto(false);
    requestAnimationFrame(() => volta.current?.focus());
  }
  return (
    <div onClick={(e) => e.stopPropagation()} className="contents">
      <button type="button" className="al2-acao justify-start" onClick={abrir}>
        <Icone />
        {t.acao.botao}
      </button>
      {aberto && typeof document !== "undefined" && createPortal(<Folha lang={lang} post={post} t={t} pele={pele} aoFechar={fechar} />, document.body)}
    </div>
  );
}

/** "16 NOV" no idioma da página. */
function dataDoCarimbo(iso: string, lang: string): string {
  try {
    const d = new Date(iso);
    const dia = new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : lang, { day: "numeric" }).format(d);
    const mes = new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : lang, { month: "short" }).format(d).replace(/\.$/, "");
    return `${dia} ${mes}`.toUpperCase();
  } catch {
    return iso.slice(0, 10);
  }
}

function Folha({ lang, post, t, pele, aoFechar }: { lang: string; post: Post; t: TextosDoAlcance; pele: Record<string, string>; aoFechar: () => void }) {
  const id = useId();
  const caixa = useRef<HTMLDivElement | null>(null);
  const ato = postEhAto(post);
  const arteLiberada = PREVIA_DO_ALCANCE || arteDoPost(post);
  const link = enderecoDaTela(lang, ato ? `/ato/${post.id}` : `/p/${post.id}`);
  const qr = useQr(link);
  const [copiou, setCopiou] = useState<"" | "link" | "codigo" | "falhou">("");

  useEffect(() => {
    caixa.current?.querySelector<HTMLElement>("button, input, a")?.focus();
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aoFechar]);

  async function copiar(texto: string, qual: "link" | "codigo") {
    const ok = await copiarTexto(texto);
    setCopiou(ok ? qual : "falhou");
    if (ok) setTimeout(() => setCopiou(""), 2500);
  }

  return (
    <div {...pele} className="al-pele alc-fundo" onClick={aoFechar}>
      <div ref={caixa} className="alc alc-folha" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} onClick={(e) => e.stopPropagation()}>
        <header className="alc-folha-topo">
          <span className="al-faixa" aria-hidden />
          <div className="alc-folha-cabeca">
            <h2 id={`${id}-t`} className="alc-cond alc-folha-titulo">
              {t.folha.titulo}
            </h2>
            <button type="button" className="al-botao al-botao-fantasma al-botao-p" onClick={aoFechar}>
              {t.folha.fechar}
            </button>
          </div>
          <p className="alc-nota">{t.folha.intro}</p>
        </header>

        <div className="alc-folha-corpo">
          {arteLiberada ? <ParteDaArte lang={lang} post={post} t={t} link={link} ato={ato} /> : null}

          <section className="alc-parte" aria-labelledby={`${id}-qr`}>
            <h3 id={`${id}-qr`} className="alc-cond alc-parte-titulo">
              <i aria-hidden className="alc-ladrilho" />
              {ato ? t.qr.tituloAto : t.qr.tituloPost}
            </h3>
            <div className="alc-qr-linha">
              <span className="alc-qr">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element -- QR feito no aparelho, em data URL.
                  <img src={qr} alt={preencher(t.qr.alt, { nome: post.titulo || post.autor.codinome })} width={168} height={168} />
                ) : (
                  <span className="alc-nota" role="status">{qr === "" ? t.qr.falhou : t.qr.fazendo}</span>
                )}
              </span>
              <div className="alc-qr-lado">
                <p className="alc-nota">{t.qr.ajuda}</p>
                <code className="alc-endereco">{link}</code>
                <div className="alc-acoes">
                  <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => void copiar(link, "link")}>
                    {copiou === "link" ? t.folha.copiado : t.folha.copiar}
                  </button>
                  {qr ? (
                    <button type="button" className="al-botao al-botao-fantasma al-botao-p" onClick={() => baixarArquivo(qr, `alumia-qr-${post.id.slice(0, 8)}.png`)}>
                      {t.qr.baixar}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <ParteDoCartao lang={lang} post={post} t={t} copiou={copiou === "codigo"} aoCopiar={(c) => void copiar(c, "codigo")} />
          {copiou === "falhou" ? (
            <p className="alc-erro" role="alert">
              {t.folha.naoCopiou}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ParteDaArte({ lang, post, t, link, ato }: { lang: string; post: Post; t: TextosDoAlcance; link: string; ato: boolean }) {
  const id = useId();
  const t4 = useTextosDoCartaoP4(lang, P4);
  const [fundo, setFundo] = useState<"noite" | "creme">("noite");
  const [formatoEscolhido, setFormato] = useState<Formato>("retrato");
  const [destino, setDestino] = useState<DestinoDaImagem>(DESTINOS_DA_IMAGEM[0].destino);
  const [semAutora, setSemAutora] = useState(false);
  const [comQr, setComQr] = useState(ato);
  const [arte, setArte] = useState<{ chave: string; url: string } | null>(null);
  const lugar = useRef<HTMLDivElement | null>(null);
  // Com o item 120, o formato vem do destino; sem ele, da escolha de sempre.
  const formato: Formato = t4 ? (DESTINOS_DA_IMAGEM.find((d) => d.destino === destino)?.formato ?? "retrato") : formatoEscolhido;
  const esconder = Boolean(t4) && semAutora;
  const chave = `${fundo}|${formato}|${comQr}|${esconder}|${t4 ? "p4" : ""}`;

  const desenhar = useCallback(async () => {
    const canvas = document.createElement("canvas");
    const { largura, altura } = TAMANHOS[formato];
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("sem_canvas");
    const familia = getComputedStyle(lugar.current ?? document.body).fontFamily || "sans-serif";
    try {
      await Promise.all([document.fonts.load(`900 64px ${familia}`), document.fonts.load(`400 32px ${familia}`)]);
    } catch {
      // sem a fonte: desenha com a do sistema
    }
    let matriz: MatrizDoQr | null = null;
    if (comQr) {
      const q = await import("qrcode");
      const m = q.create(link, { errorCorrectionLevel: "M" }).modules;
      matriz = { tamanho: m.size, escuro: (l, k) => Boolean(m.get(l, k)) };
    }
    const autoria = autoriaDaImagem(post, esconder);
    desenharArte(ctx, formato, fundo === "noite" ? PALETA_NOITE : PALETA_CREME, {
      titulo: post.titulo,
      texto: post.texto,
      aviso: post.aviso,
      codinome: autoria.codinome,
      handle: autoria.handle,
      comunidade: post.comunidade ? post.comunidade.replace(/-/g, " ") : null,
      carimbo: ato && post.chamado?.quando ? dataDoCarimbo(post.chamado.quando, lang) : null,
      qr: comQr ? link : null,
      marca: t.arte.marca,
      chamada: t.arte.chamada,
      rotuloAviso: t.cartao.aviso.replace(/:?\s*\{aviso\}$/, ""),
      rodape: t4 ? rodapeDaImagem(enderecoDaTela(lang, "/")) : null,
    }, familia, matriz);
    return canvas.toDataURL("image/png");
  }, [fundo, formato, comQr, link, lang, post, t, ato, esconder, t4]);

  useEffect(() => {
    let vivo = true;
    desenhar()
      .then((url) => vivo && setArte({ chave, url }))
      .catch(() => vivo && setArte({ chave, url: "" }));
    return () => {
      vivo = false;
    };
  }, [desenhar, chave]);

  const pronta = arte && arte.chave === chave ? arte.url : null;
  const { largura, altura } = TAMANHOS[formato];
  return (
    <section className="alc-parte" aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="alc-cond alc-parte-titulo">
        <i aria-hidden className="alc-ladrilho" />
        {t.arte.titulo}
      </h3>
      <p className="alc-nota">{t.arte.ajuda}</p>
      <div className="alc-arte" ref={lugar}>
        <div className="alc-arte-previa" data-formato={formato}>
          {pronta ? (
            // eslint-disable-next-line @next/next/no-img-element -- arte feita no aparelho, em data URL.
            <img src={pronta} alt={preencher(t.arte.alt, { codinome: esconder ? "" : post.autor.codinome })} width={largura} height={altura} />
          ) : (
            <span className="alc-nota" role="status">{pronta === "" ? t.arte.falhou : t.arte.fazendo}</span>
          )}
        </div>
        <div className="alc-arte-opcoes">
          <fieldset className="alc-escolhas">
            <legend>{t.arte.fundo}</legend>
            {(["noite", "creme"] as const).map((f) => (
              <label key={f} className="alc-escolha">
                <input type="radio" name={`${id}-fundo`} checked={fundo === f} onChange={() => setFundo(f)} />
                <i aria-hidden className={`alc-amostra alc-amostra-${f}`} />
                {f === "noite" ? t.arte.noite : t.arte.creme}
              </label>
            ))}
          </fieldset>
          {t4 ? (
            <DestinosDaImagem id={id} t4={t4} destino={destino} aoEscolher={setDestino} semAutora={semAutora} aoEsconder={setSemAutora} />
          ) : (
            <fieldset className="alc-escolhas">
              <legend>{t.arte.formato}</legend>
              {(["retrato", "quadrado"] as const).map((f) => (
                <label key={f} className="alc-escolha">
                  <input type="radio" name={`${id}-formato`} checked={formato === f} onChange={() => setFormato(f)} />
                  {f === "retrato" ? t.arte.retrato : t.arte.quadrado}
                </label>
              ))}
            </fieldset>
          )}
          <label className="alc-escolha alc-marcar">
            <input type="checkbox" checked={comQr} onChange={(e) => setComQr(e.target.checked)} />
            {t.arte.comQr}
          </label>
          {t4 && pronta ? (
            <button type="button" className="al-botao al-botao-primario al-botao-m" onClick={() => void compartilharImagem(pronta, `alumia-${post.id.slice(0, 8)}.png`)}>
              {t4.imagem.compartilhar}
            </button>
          ) : null}
          <button type="button" className={`al-botao ${t4 ? "al-botao-contorno" : "al-botao-primario"} al-botao-m`} disabled={!pronta} onClick={() => pronta && baixarArquivo(pronta, `alumia-${post.id.slice(0, 8)}.png`)}>
            {t.arte.baixar}
          </button>
          {t4 ? <p className="alc-nota">{t4.imagem.ajuda}</p> : null}
        </div>
      </div>
    </section>
  );
}

/** Prompt 4, item 120: para onde vai a imagem (o formato de cada destino) e esconder quem escreveu. */
function DestinosDaImagem({ id, t4, destino, aoEscolher, semAutora, aoEsconder }: { id: string; t4: TextosDoCartaoP4; destino: DestinoDaImagem; aoEscolher: (d: DestinoDaImagem) => void; semAutora: boolean; aoEsconder: (sim: boolean) => void }) {
  return (
    <>
      <fieldset className="alc-escolhas">
        <legend>{t4.imagem.destino}</legend>
        {DESTINOS_DA_IMAGEM.map((d) => (
          <label key={d.destino} className="alc-escolha">
            <input type="radio" name={`${id}-destino`} checked={destino === d.destino} onChange={() => aoEscolher(d.destino)} />
            {t4.imagem.destinos[d.destino]}
          </label>
        ))}
      </fieldset>
      <label className="alc-escolha alc-marcar">
        <input type="checkbox" checked={semAutora} onChange={(e) => aoEsconder(e.target.checked)} />
        {t4.imagem.semAutora}
      </label>
    </>
  );
}

/** Compartilha a imagem pelo compartilhar do próprio aparelho (a pessoa escolhe o app); sem ele, baixa o PNG. */
async function compartilharImagem(dataUrl: string, nome: string): Promise<void> {
  try {
    // O data URL é a imagem feita aqui: o fetch só o lê da memória, nada vai à rede.
    const blob = await (await fetch(dataUrl)).blob();
    const arquivo = new File([blob], nome, { type: "image/png" });
    if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [arquivo] }) && navigator.share) {
      await navigator.share({ files: [arquivo] });
      return;
    }
  } catch (e) {
    // A pessoa fechou a folha de compartilhar: nada a fazer.
    if ((e as Error)?.name === "AbortError") return;
  }
  baixarArquivo(dataUrl, nome);
}

function ParteDoCartao({ lang, post, t, copiou, aoCopiar }: { lang: string; post: Post; t: TextosDoAlcance; copiou: boolean; aoCopiar: (codigo: string) => void }) {
  const id = useId();
  const endereco = rotasDoAlcance.cartao(origemAqui(), post.id, lang);
  const [sai, setSai] = useState<boolean | null>(null);
  const podeTentar = PREVIA_DO_ALCANCE || postPodeSair(post);
  useEffect(() => {
    if (!podeTentar) return;
    let vivo = true;
    rotaResponde(endereco, true).then((ok) => vivo && setSai(ok));
    return () => {
      vivo = false;
    };
  }, [endereco, podeTentar]);
  const estado = podeTentar ? sai : false;
  const codigo = codigoParaColar(endereco, preencher(t.embed.tituloDoQuadro, { codinome: post.autor.codinome }));
  return (
    <section className="alc-parte" aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="alc-cond alc-parte-titulo">
        <i aria-hidden className="alc-ladrilho" />
        {t.embed.titulo}
      </h3>
      {estado === null ? (
        <p className="alc-nota" role="status">{t.embed.conferindo}</p>
      ) : !estado ? (
        <p className="alc-vazio">{t.embed.indisponivel}</p>
      ) : (
        <>
          <p className="alc-nota">{t.embed.ajuda}</p>
          <label className="alc-campo">
            {t.embed.rotulo}
            <textarea readOnly value={codigo} rows={3} onFocus={(e) => e.currentTarget.select()} />
          </label>
          <div className="alc-acoes">
            <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => aoCopiar(codigo)}>
              {copiou ? t.folha.copiado : t.embed.copiar}
            </button>
          </div>
          <p className="alc-sub">{t.embed.previa}</p>
          {/* "Carregando" fica atrás do quadro: some quando a página do quadro se pinta por cima. */}
          <div className="alc-quadro-caixa">
            <p className="alc-quadro-carregando" aria-hidden>{t.embed.carregando}</p>
            <iframe className="alc-quadro" src={endereco} title={preencher(t.embed.tituloDoQuadro, { codinome: post.autor.codinome })} sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" />
          </div>
        </>
      )}
    </section>
  );
}
