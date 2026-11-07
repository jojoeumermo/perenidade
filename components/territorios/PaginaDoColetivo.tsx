// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import Link from "@/components/Link";
import { Letreiro } from "@/components/territorios/Letreiro";
import { PlayerDoAnuncio } from "@/components/territorios/PlayerDoAnuncio";
import { originalLang, Untranslated } from "@/components/Untranslated";
import type { Dict } from "@/i18n/types";
import { localePath, type Locale } from "@/i18n/config";
import { getTracks } from "@/lib/content";
import { site } from "@/lib/site";
import { codigoDePostValido, enderecoDoVideo, temVideoLocal } from "@/lib/territorios-video";
import { ehVisual, IDENTIDADES, type Visual } from "@/lib/territorios-identidades";
import type { Territorio } from "@/lib/territorios";

const mono = "font-mono text-[0.7rem] uppercase tracking-[0.2em]";
const grosso = "font-[Arial_Black,Impact,Haettenschweiler,sans-serif]";
const cartaz = "font-[Impact,Haettenschweiler,'Arial_Narrow_Bold',Arial_Black,sans-serif] uppercase";
const grotesca = "font-sans font-black uppercase tracking-[-0.045em]";

/** O endereço de um post do Instagram a partir do código (só letras, números, hífen e sublinhado). */
const doPost = (codigo?: string) => (codigo && codigoDePostValido(codigo) ? `https://www.instagram.com/p/${codigo}/` : null);

/**
 * O que muda de uma identidade para outra fora da abertura: a letra dos títulos, a cor das bordas, a sombra dura (ou
 * nenhuma), a faixa de temas e a moldura do vídeo. As classes são literais para o Tailwind enxergar.
 */
const ESTILO: Record<Visual, { titulo: string; borda: string; sombra?: string; letreiro: string; separador: string; moldura: string }> = {
  noizocupa: { titulo: grosso, borda: "#f6e8cc", sombra: "#2a0806", letreiro: "border-y-[3px] border-[#f6e8cc] bg-[#e8a93a] text-[#3a0b08]", separador: "text-[#5e120e]", moldura: "border-[3px] border-[#f6e8cc] bg-[#2a0806] shadow-[8px_8px_0_#e8a93a]" },
  kamikaze: { titulo: cartaz, borda: "#fbf6e6", letreiro: "border-y-[3px] border-[#111010] bg-[#0a6631] text-[#ffe14d] font-[Impact,Haettenschweiler,sans-serif] uppercase", separador: "text-[#ff7eb6]", moldura: "border-[3px] border-[#ffe14d] bg-black shadow-[0_0_0_6px_#111010,0_0_0_9px_#3ddc84]" },
  desordem: { titulo: `${grosso} uppercase`, borda: "#ffd21f", sombra: "#d7261e", letreiro: "-rotate-1 border-y-[3px] border-[#0e0c0b] bg-[#ffd21f] text-[#0e0c0b] uppercase", separador: "text-[#d7261e]", moldura: "border-[3px] border-[#ffd21f] bg-black shadow-[8px_8px_0_#d7261e]" },
  noisme: { titulo: grotesca, borda: "#0a0a0a", letreiro: "border-y border-[#0a0a0a] bg-[#0a0a0a] text-white uppercase tracking-[0.12em]", separador: "text-white", moldura: "border border-[#0a0a0a] bg-white" },
};

/**
 * A página de um coletivo com identidade visual própria (NoizOcupa, Coletivo Kamikaze, Coletivo Desordem, noismemo
 * studios), preenchida com o que o coletivo publicou no Instagram (uso autorizado pelos coletivos;
 * content/territorios.json). Cada um abre do seu jeito, com a logo cedida pelo coletivo (docs/territorios/IDENTIDADES.md);
 * depois vêm a faixa de temas, a agenda e a convocação (ou o trabalho em destaque), o vídeo do anúncio, a história, as
 * campanhas, a galeria, a linha do tempo com o link de cada post, as trilhas e o crédito das imagens.
 */
export default function PaginaDoColetivo({ territorio, lang, t }: { territorio: Territorio; lang: Locale; t: Dict }) {
  const visual: Visual = ehVisual(territorio.visual) ? territorio.visual : "noizocupa";
  const id = IDENTIDADES[visual];
  const estilo = ESTILO[visual];
  const s = t.territorios;
  const to = (path: string) => localePath(lang, path);
  const instagram = `https://www.instagram.com/${territorio.instagram}/`;
  const trilhas = new Map(getTracks(lang).map((track) => [track.slug, track]));
  const daqui = territorio.trilhas.map((slug) => trilhas.get(slug)).filter((track) => track !== undefined);
  const anuncio = territorio.anuncio && codigoDePostValido(territorio.anuncio.post) ? territorio.anuncio : null;
  const local = anuncio && temVideoLocal(territorio.slug) ? enderecoDoVideo(territorio.slug) : null;
  const temas = territorio.temas;
  const numero = s.partner.replace("{n}", String(territorio.numero).padStart(2, "0"));
  const botao = "inline-flex min-h-11 items-center gap-2 border-2 px-5 py-3 font-sans font-extrabold no-underline";
  const titulo = estilo.titulo;
  const borda = estilo.borda;
  const sombra = (n: number) => (estilo.sombra ? `${n}px ${n}px 0 ${estilo.sombra}` : undefined);
  // A cor de cada bloco: no Kamikaze ela gira pela paleta dos cartazes (amarelo, verde, rosa, azul); nos outros é fixa.
  const acento = (i: number) => id.acentos[i % id.acentos.length];
  const kicker = (texto: string, i = 0) => (
    <p className={`${mono} font-bold`} style={{ color: visual === "kamikaze" ? acento(i) : id.rotulo }}>
      {texto}
    </p>
  );
  const linkDoPost = (codigo?: string, sobre?: string, cor: string = id.destaque) => {
    const href = doPost(codigo);
    return href ? (
      <a href={href} rel="noopener noreferrer" target="_blank" className="mt-3 inline-block font-sans text-sm font-bold underline underline-offset-4" style={{ color: cor }}>
        {s.anuncioAbrir}
        {sobre && <span className="sr-only"> ({sobre})</span>}
      </a>
    ) : null;
  };
  const seguir = (estiloDoBotao: CSSProperties) => (
    <a href={instagram} rel="noopener noreferrer" target="_blank" className={botao} style={estiloDoBotao}>
      {s.follow} @{territorio.instagram}
    </a>
  );
  // O aviso de idioma na cor da página.
  const aviso = (
    <div className="[&_*]:text-inherit!">
      <Untranslated lang={lang} t={t} show={lang !== "pt"} />
    </div>
  );
  /** A logo do coletivo com o crédito embaixo ("Logo cedida pelo coletivo"). */
  const logo = (moldura: string, estiloDaMoldura?: CSSProperties, legenda?: string): ReactNode =>
    territorio.logo ? (
      <figure className="mx-auto w-full max-w-[22rem]">
        <div className={moldura} style={estiloDaMoldura}>
          <Image src={territorio.logo.src} alt={territorio.logo.alt} width={480} height={480} priority sizes="(min-width: 768px) 22rem, 80vw" className="aspect-square h-auto w-full object-cover" />
        </div>
        <figcaption className={`mt-3 text-center font-sans text-xs ${legenda ?? ""}`}>{territorio.logo.credito} · @{territorio.instagram}</figcaption>
      </figure>
    ) : null;

  return (
    <div style={{ backgroundColor: id.fundo, color: id.tinta }} {...originalLang(lang === "pt")} data-identidade={visual}>
      <nav aria-label={s.title} className={visual === "noisme" ? "border-b" : "border-b-2"} style={{ borderColor: visual === "kamikaze" ? acento(1) : id.destaque }}>
        <p className={`mx-auto max-w-[78rem] px-4 py-3 sm:px-8 ${mono}`}>
          <Link href={to("/territorios")} className="underline underline-offset-2" style={{ color: id.tinta }}>{s.title}</Link> › <span>{territorio.nome}</span>
        </p>
      </nav>

      {visual === "noizocupa" && (
        /* NoizOcupa: o cartaz de rua do coletivo, o nome enorme, o lema em mostarda e a logo colada ao lado com fita. */
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.1] [background:radial-gradient(currentColor_1.5px,transparent_1.5px)] [background-size:16px_16px]" />
          <div className="relative mx-auto grid max-w-[78rem] items-center gap-12 px-4 py-14 sm:px-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <p className={`${mono} inline-block -rotate-1 border-2 px-2 py-1`} style={{ backgroundColor: id.tinta, color: id.fundo, borderColor: id.tinta }}>
                {numero}
              </p>
              <h1 className={`${grosso} mt-5 text-[clamp(2.8rem,13vw,6.6rem)] leading-[0.95] tracking-[-0.03em] [text-shadow:5px_5px_0_var(--sombra-id)]`} style={{ "--sombra-id": "#2a0806" } as CSSProperties}>
                {territorio.nome}
              </h1>
              {territorio.lema && <p className={`${grosso} mt-4 text-[clamp(1rem,3.4vw,1.35rem)] uppercase tracking-[0.12em]`} style={{ color: id.destaque }}>{territorio.lema}</p>}
              <p className="mt-6 max-w-[34rem] text-[1.4rem] font-bold leading-snug">{territorio.slogan}</p>
              <p className="mt-3 max-w-[36rem] text-[1.05rem] leading-relaxed">{territorio.sobre}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                {seguir({ backgroundColor: id.tinta, borderColor: id.tinta, color: id.fundo, boxShadow: `5px 5px 0 ${id.destaque}` })}
                {territorio.chamado && (
                  <a href="#chamado" className={botao} style={{ borderColor: id.destaque, color: id.destaque }}>
                    {territorio.chamado.titulo} ↓
                  </a>
                )}
              </div>
              {aviso}
            </div>
            {territorio.logo ? (
              <div className="relative px-3 pt-4">
                {logo("relative rotate-2 border-[3px] border-[#f6e8cc] shadow-[10px_10px_0_#2a0806]")}
                {/* Duas tiras de fita, como cartaz colado no muro. */}
                <span aria-hidden className="absolute top-1 left-6 h-6 w-20 -rotate-[8deg] bg-[#e9dcbc]/85 shadow-sm" />
                <span aria-hidden className="absolute right-4 bottom-9 h-6 w-20 -rotate-[6deg] bg-[#e9dcbc]/85 shadow-sm" />
              </div>
            ) : (
              territorio.capa && (
                <div className="relative mx-auto w-full max-w-[26rem] px-3 pt-4">
                  <Image src={territorio.capa.src} alt={territorio.capa.alt} width={960} height={960} priority sizes="(min-width: 768px) 26rem, 88vw" className="relative h-auto w-full rotate-2 border-[3px] object-cover" style={{ borderColor: id.tinta, boxShadow: `10px 10px 0 #2a0806` }} />
                </div>
              )
            )}
          </div>
        </section>
      )}

      {visual === "kamikaze" && (
        /* Kamikaze: o amarelo da logo de ponta a ponta, letra de cartaz de cinema, a logo dentro de um letreiro de
           lâmpadas coloridas (o "Em cartaz" do anúncio) e a fita de filme embaixo. */
        <section className="relative overflow-hidden bg-[#ffe100] text-[#111010]">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background:repeating-linear-gradient(-45deg,#111010_0_2px,transparent_2px_14px)]" />
          <div className="relative mx-auto grid max-w-[78rem] items-center gap-12 px-4 pt-14 pb-16 sm:px-8 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <p className={`${mono} inline-block bg-[#111010] px-2 py-1 font-bold text-[#ffe100]`}>
                <span aria-hidden>● </span>{numero}
              </p>
              <h1 className={`${cartaz} mt-5 text-[clamp(3rem,14vw,7.4rem)] leading-[0.88] tracking-[-0.01em]`}>{territorio.nome}</h1>
              <p className="mt-4 inline-block -rotate-1 bg-[#111010] px-3 py-1 text-[clamp(1.4rem,5vw,2.2rem)] font-bold italic leading-tight text-[#ff7eb6]">{territorio.slogan}</p>
              {territorio.lema && (
                <ul className="mt-5 flex flex-wrap gap-2" aria-label={territorio.lema}>
                  {territorio.lema.split(" · ").map((parte, i) => (
                    <li key={parte} className={`${mono} border-2 border-[#111010] px-2 py-1 font-bold`} style={{ backgroundColor: ["#ffffff", "#9be8bd", "#ffc2dc", "#c4e6ff"][i % 4] }}>
                      {parte}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-6 max-w-[38rem] text-[1.1rem] font-medium leading-relaxed">{territorio.sobre}</p>
              <div className="mt-7 flex flex-wrap gap-3">{seguir({ backgroundColor: "#111010", borderColor: "#111010", color: "#ffe100" })}</div>
              {aviso}
            </div>
            {logo(
              "relative bg-[#111010] p-4 [background-image:radial-gradient(circle,#ffe14d_0_3px,transparent_3.5px),radial-gradient(circle,#ff7eb6_0_3px,transparent_3.5px)] [background-position:0_0,11px_11px] [background-size:22px_22px] sm:p-5",
              undefined,
              "font-bold",
            ) ?? (territorio.capa && <Image src={territorio.capa.src} alt={territorio.capa.alt} width={720} height={1280} priority sizes="(min-width: 768px) 22rem, 88vw" className="aspect-[4/5] h-auto w-full object-cover" />)}
          </div>
          {/* A fita de filme: furos claros sobre o preto, na largura toda. */}
          <div aria-hidden className="h-7 bg-[#111010] [background-image:repeating-linear-gradient(90deg,#ffe100_0_14px,transparent_14px_30px)] [background-size:100%_10px] [background-position:0_center] [background-repeat:repeat-x]" />
        </section>
      )}

      {visual === "desordem" && (
        /* Desordem: o preto com o halo de spray amarelo da logo, as letras do nome tortas (só no desenho; o leitor de tela
           lê o nome inteiro), o lema em vermelho e a logo pendurada torta. */
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(255,210,31,0.22),transparent_65%)] blur-2xl" />
          <div aria-hidden className="pointer-events-none absolute right-0 bottom-0 h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(circle,rgba(215,38,30,0.22),transparent_65%)] blur-2xl" />
          <div className="relative mx-auto grid max-w-[78rem] items-center gap-12 px-4 py-16 sm:px-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <p className={`${mono} font-bold`} style={{ color: id.rotulo }}>
                {numero}
              </p>
              <h1 className={`${grosso} mt-5 text-[clamp(2.6rem,12vw,6.2rem)] uppercase leading-[0.95] text-[#ffd21f] [text-shadow:4px_4px_0_#d7261e]`}>
                <span className="sr-only">{territorio.nome}</span>
                <span aria-hidden className="flex flex-wrap gap-x-[0.3em]">
                  {territorio.nome.split(" ").map((palavra, p) => (
                    <span key={palavra} className="inline-flex">
                      {Array.from(palavra).map((letra, i) => (
                        <span key={i} className="inline-block" style={{ transform: `rotate(${[-6, 4, -2, 7, -4, 2, -7, 5][(i + p * 3) % 8]}deg) translateY(${[0, -4, 3, -2, 5, -3][(i + p) % 6]}px)` }}>
                          {letra}
                        </span>
                      ))}
                    </span>
                  ))}
                </span>
              </h1>
              <p className={`${grosso} mt-5 inline-block -rotate-2 bg-[#d7261e] px-3 py-1 text-[clamp(1.1rem,4vw,1.6rem)] uppercase text-white`}>{territorio.slogan}</p>
              {territorio.lema && <p className={`mt-4 ${mono}`}>{territorio.lema}</p>}
              <p className="mt-6 max-w-[38rem] text-[1.08rem] leading-relaxed">{territorio.sobre}</p>
              <div className="mt-7 flex flex-wrap gap-3">{seguir({ backgroundColor: id.destaque, borderColor: id.destaque, color: id.botaoTexto, boxShadow: "5px 5px 0 #d7261e" })}</div>
              {aviso}
            </div>
            {logo("-rotate-3 border-[3px] border-[#ffd21f] shadow-[10px_10px_0_#d7261e]")}
          </div>
        </section>
      )}

      {visual === "noisme" && (
        /* noismemo studios: ficha técnica em preto e branco. Linhas finas, o título enorme e apertado, a elipse da logo como
           selo e o cinza só nas legendas. */
        <section>
          <div className="mx-auto max-w-[78rem] px-4 pt-8 pb-14 sm:px-8">
            <dl className="grid grid-cols-2 border-y border-[#0a0a0a] font-mono text-[0.68rem] uppercase tracking-[0.16em] sm:grid-cols-4">
              {[
                [String(territorio.numero).padStart(2, "0"), s.title],
                ["@" + territorio.instagram, "Instagram"],
                [territorio.lema ?? "", "—"],
                [territorio.slogan ?? "", "—"],
              ].map(([valor, chave], i) => (
                <div key={i} className={`py-2 pr-3 ${i > 0 ? "sm:border-l sm:border-[#0a0a0a] sm:pl-3" : ""}`}>
                  <dt className="text-[#4d4d4d]">{chave}</dt>
                  <dd className="mt-0.5 font-bold">{valor}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-10 grid items-end gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <p className={`${mono} text-[#4d4d4d]`}>{numero}</p>
                <h1 className={`${grotesca} mt-4 text-[clamp(3rem,13vw,7.6rem)] leading-[0.84]`}>{territorio.nome}</h1>
                <p className="mt-6 max-w-[36rem] border-l-4 border-[#0a0a0a] pl-4 text-[1.4rem] font-bold leading-snug">{territorio.slogan}</p>
                <p className="mt-4 max-w-[38rem] text-[1.05rem] leading-relaxed">{territorio.sobre}</p>
                <div className="mt-7 flex flex-wrap gap-3">{seguir({ backgroundColor: "#0a0a0a", borderColor: "#0a0a0a", color: "#ffffff" })}</div>
                {aviso}
              </div>
              {logo("border border-[#0a0a0a]", undefined, "text-[#4d4d4d]")}
            </div>
          </div>
        </section>
      )}

      {/* A faixa dos temas: anda sempre (só para no botão, para quem pede menos movimento e no modo leve). */}
      <Letreiro temas={temas} rotulo={s.letreiroRotulo} pausar={s.letreiroPausar} retomar={s.letreiroRetomar} estilo={estilo.letreiro} separador={estilo.separador} />

      {/* A agenda e a convocação (NoizOcupa). Com a logo na abertura, o cartaz da festa fica aqui, junto da data. */}
      {territorio.agenda && (
        <section aria-labelledby="agenda-titulo" className="mx-auto max-w-[78rem] px-4 py-14 sm:px-8">
          <div className="grid gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="self-start">
              <div className="border-[3px] p-6 md:-rotate-1" style={{ backgroundColor: id.tinta, color: id.fundo, borderColor: id.tinta, boxShadow: `8px 8px 0 ${id.destaque}` }}>
                <p className={`${mono} font-bold`}>{s.agendaKicker}</p>
                <h2 id="agenda-titulo" className={`${titulo} mt-2 text-[clamp(2rem,6vw,2.8rem)] leading-[1]`}>{territorio.agenda.titulo}</h2>
                <dl className="mt-5 grid gap-3">
                  <div>
                    <dt className={mono}>{s.agendaQuando}</dt>
                    <dd className="text-xl font-bold">{territorio.agenda.quando}</dd>
                  </div>
                  <div>
                    <dt className={mono}>{s.agendaOnde}</dt>
                    <dd className="text-xl font-bold">{territorio.agenda.onde}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-[0.98rem] leading-relaxed">{territorio.agenda.como}</p>
              </div>
              {territorio.logo && territorio.capa && (
                <Image src={territorio.capa.src} alt={territorio.capa.alt} width={960} height={960} sizes="(min-width: 768px) 28rem, 92vw" className="mt-8 h-auto w-full max-w-[24rem] rotate-1 border-[3px] object-cover" style={{ borderColor: id.tinta, boxShadow: sombra(8) }} />
              )}
            </div>
            {territorio.chamado && (
              <div id="chamado" className="scroll-mt-24">
                <h2 className={`${titulo} text-[clamp(1.7rem,5vw,2.5rem)] leading-tight`} style={{ color: id.destaque }}>{territorio.chamado.titulo}</h2>
                <p className="mt-3 max-w-2xl text-[1.05rem] leading-relaxed">{territorio.chamado.texto}</p>
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {territorio.chamado.itens.map((item, i) => (
                    <li key={item.titulo} className={`border-2 p-4 ${i === territorio.chamado!.itens.length - 1 && territorio.chamado!.itens.length % 2 ? "sm:col-span-2" : ""}`} style={{ borderColor: id.tinta, backgroundColor: id.papel }}>
                      <p className={`${grosso} text-[1.05rem] uppercase leading-tight`} style={{ color: id.destaque }}>{item.titulo}</p>
                      <p className="mt-1.5 text-[0.95rem] leading-relaxed">{item.texto}</p>
                    </li>
                  ))}
                </ul>
                {territorio.chamado.apoio && <p className="mt-5 max-w-2xl border-l-4 pl-4 text-[1rem] leading-relaxed" style={{ borderColor: id.destaque }}>{territorio.chamado.apoio}</p>}
                {linkDoPost(territorio.chamado.post, territorio.chamado.titulo)}
              </div>
            )}
          </div>
        </section>
      )}

      {/* O trabalho em destaque, com a programação (Kamikaze, Desordem, noismemo). */}
      {territorio.destaque && (
        <section aria-labelledby="destaque-titulo" className={visual === "noisme" ? "border-y" : "border-y-2"} style={{ borderColor: visual === "kamikaze" ? acento(1) : borda, backgroundColor: id.papel }}>
          <div className={`mx-auto grid max-w-[78rem] gap-8 px-4 py-14 sm:px-8 ${territorio.destaque.programa ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" : ""}`}>
            <div>
              {kicker(territorio.destaque.chapeu, 1)}
              <h2 id="destaque-titulo" className={`${titulo} mt-2 max-w-4xl text-[clamp(1.8rem,5vw,2.8rem)] leading-[1.05]`} style={visual === "desordem" ? { color: id.destaque } : undefined}>{territorio.destaque.titulo}</h2>
              <p className="mt-4 max-w-2xl text-[1.05rem] leading-relaxed">{territorio.destaque.texto}</p>
              {linkDoPost(territorio.destaque.post, territorio.destaque.titulo, visual === "kamikaze" ? acento(1) : id.destaque)}
            </div>
            {territorio.destaque.programa && (
              <ol className="grid gap-3 self-start">
                {territorio.destaque.programa.map((item, i) => {
                  const cor = visual === "kamikaze" ? acento(i + 1) : id.destaque;
                  return (
                    <li key={item.hora} className="grid grid-cols-[minmax(4rem,auto)_minmax(0,1fr)] gap-4 border-l-4 py-1 pl-4" style={{ borderColor: cor }}>
                      <span className="font-mono text-2xl font-bold" style={{ color: cor }}>{item.hora}</span>
                      <span>
                        <span className="block font-bold leading-snug">{item.titulo}</span>
                        <span className="mt-1 block text-[0.95rem] leading-relaxed opacity-90">{item.texto}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </section>
      )}

      {/* O vídeo do anúncio: o arquivo do próprio site; se faltar, o Instagram, só depois do clique. */}
      {anuncio && (
        <section className="mx-auto max-w-[78rem] px-4 py-14 sm:px-8" aria-labelledby="anuncio-titulo">
          <div className={anuncio.vertical ? "grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]" : ""}>
            <div>
              {kicker(s.anuncioKicker, 2)}
              <h2 id="anuncio-titulo" className={`mt-2 text-[clamp(1.6rem,5vw,2.6rem)] leading-tight ${titulo}`}>{anuncio.titulo}</h2>
              <p className="mt-3 max-w-2xl text-[1.05rem] leading-relaxed">{anuncio.texto}</p>
            </div>
            <div className={`${anuncio.vertical ? "" : "mt-7"} p-3 sm:p-4 ${estilo.moldura}`}>
              <PlayerDoAnuncio
                post={anuncio.post}
                local={local}
                titulo={anuncio.titulo}
                tom={visual === "noisme" ? "claro" : "escuro"}
                capa={anuncio.capa}
                vertical={anuncio.vertical}
                acento={{ fundo: id.destaque, texto: id.botaoTexto }}
                textos={{ carregar: s.anuncioLoad, aviso: s.anuncioAviso, abrir: s.anuncioAbrir, quadro: s.anuncioQuadro, video: s.anuncioLocal }}
              />
            </div>
          </div>
        </section>
      )}

      {/* A história e o manifesto, nas palavras do coletivo. */}
      {(territorio.historia || territorio.citacao) && (
        <section className="border-y-2" style={{ borderColor: borda, backgroundColor: id.papel }}>
          <div className="mx-auto grid max-w-[78rem] gap-10 px-4 py-14 sm:px-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            {territorio.historia && (
              <div>
                <h2 className={`${titulo} text-[clamp(1.7rem,5vw,2.5rem)] leading-tight`} style={{ color: id.destaque }}>{territorio.historia.titulo}</h2>
                {territorio.historia.paragrafos.map((p) => (
                  <p key={p.slice(0, 32)} className="mt-4 max-w-2xl text-[1.05rem] leading-relaxed">{p}</p>
                ))}
                {linkDoPost(territorio.historia.post, territorio.historia.titulo)}
              </div>
            )}
            {territorio.citacao && (
              <figure className="self-start border-[3px] p-6 md:rotate-1" style={{ borderColor: id.tinta, boxShadow: sombra(8) }}>
                <p className={`${grosso} text-[1.2rem] uppercase leading-tight`} style={{ color: id.destaque }}>{territorio.citacao.titulo}</p>
                <blockquote className="mt-3 text-[1.15rem] leading-relaxed italic">“{territorio.citacao.texto}”</blockquote>
                <figcaption className={`mt-4 ${mono}`}>@{territorio.instagram}</figcaption>
                {linkDoPost(territorio.citacao.post, territorio.citacao.titulo)}
              </figure>
            )}
          </div>
        </section>
      )}

      {/* As campanhas, com os cartazes (Kamikaze): cada campanha na cor dos próprios cartazes. */}
      {territorio.campanhas && territorio.campanhas.length > 0 && (
        <section className="mx-auto max-w-[78rem] px-4 py-14 sm:px-8">
          <div className="grid gap-14">
            {territorio.campanhas.map((campanha, c) => {
              const cor = visual === "kamikaze" ? acento(c + 1) : id.destaque;
              return (
                <article key={campanha.titulo} aria-labelledby={`campanha-${campanha.post ?? campanha.titulo.length}`} className={visual === "kamikaze" ? "border-l-[6px] pl-5" : ""} style={visual === "kamikaze" ? { borderColor: cor } : undefined}>
                  <h2 id={`campanha-${campanha.post ?? campanha.titulo.length}`} className={`${titulo} text-[clamp(1.7rem,5vw,2.6rem)] leading-tight`}>
                    <span style={{ color: cor }}>✦ </span>
                    {campanha.titulo}
                  </h2>
                  <p className="mt-3 max-w-3xl text-[1.05rem] leading-relaxed">{campanha.texto}</p>
                  {linkDoPost(campanha.post, campanha.titulo, cor)}
                  <ul className={`mt-6 grid gap-4 ${campanha.fotos.length > 2 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 sm:max-w-[34rem]"}`}>
                    {campanha.fotos.map((foto) => (
                      <li key={foto.src}>
                        <Image src={foto.src} alt={foto.alt} width={720} height={900} sizes="(min-width: 1024px) 18rem, 46vw" className="h-auto w-full border-2 object-cover" style={{ borderColor: visual === "kamikaze" ? cor : borda }} />
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* A galeria do perfil (NoizOcupa). A primeira foto ocupa 2 × 2; com 15 fotos, 2, 3 e 6 colunas fecham as linhas
          sem buraco no fim (com 5 colunas sobravam duas casas vazias). */}
      {territorio.galeria && territorio.galeria.fotos.length > 0 && (
        <section className="mx-auto max-w-[78rem] px-4 py-14 sm:px-8" aria-labelledby="galeria-titulo">
          <h2 id="galeria-titulo" className={`${titulo} text-[clamp(1.7rem,5vw,2.5rem)] leading-tight`}>{territorio.galeria.titulo}</h2>
          <ul className="mt-7 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {territorio.galeria.fotos.map((foto, i) => (
              <li key={foto.src} className={i === 0 ? "col-span-2 row-span-2" : ""}>
                <figure>
                  <Image src={foto.src} alt={foto.alt} width={900} height={900} sizes={i === 0 ? "(min-width: 1024px) 30rem, 92vw" : "(min-width: 1024px) 15rem, 46vw"} className="aspect-square h-auto w-full border-2 object-cover" style={{ borderColor: id.tinta }} />
                  {(foto.legenda || foto.credito) && (
                    <figcaption className="mt-1.5 text-[0.82rem] leading-snug">
                      {foto.legenda}
                      {foto.credito && <span className="block opacity-80">{foto.credito}</span>}
                    </figcaption>
                  )}
                </figure>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* A linha do tempo, com o link de cada post. */}
      {territorio.marcos && territorio.marcos.itens.length > 0 && (
        <section className={visual === "noisme" ? "border-t" : "border-t-2"} style={{ borderColor: borda }} aria-labelledby="marcos-titulo">
          <div className="mx-auto max-w-[78rem] px-4 py-14 sm:px-8">
            <h2 id="marcos-titulo" className={`${titulo} text-[clamp(1.7rem,5vw,2.5rem)] leading-tight`}>{territorio.marcos.titulo}</h2>
            <ol className="mt-8 grid gap-x-8 gap-y-6 border-l-[3px] pl-6 md:grid-cols-2 md:border-l-0 md:pl-0" style={{ borderColor: id.destaque }}>
              {territorio.marcos.itens.map((marco, i) => {
                const href = doPost(marco.post);
                const cor = visual === "kamikaze" ? acento(i) : id.destaque;
                return (
                  <li key={`${marco.quando}-${marco.titulo}`} className="relative md:border-l-[3px] md:pl-6" style={{ borderColor: cor }}>
                    <span aria-hidden className="absolute top-1.5 -left-[calc(1.5rem+9px)] h-3.5 w-3.5 rounded-full border-2 md:-left-[9px]" style={{ backgroundColor: cor, borderColor: id.fundo }} />
                    <p className={mono} style={{ color: visual === "kamikaze" ? cor : id.rotulo }}>{marco.quando}</p>
                    <p className="mt-1 text-[1.15rem] font-bold leading-snug">
                      {href ? (
                        <a href={href} rel="noopener noreferrer" target="_blank" className="underline decoration-2 underline-offset-4 hover:opacity-80" style={{ textDecorationColor: cor }}>
                          {marco.titulo}
                        </a>
                      ) : (
                        marco.titulo
                      )}
                    </p>
                    <p className="mt-1 text-[0.98rem] leading-relaxed opacity-90">{marco.texto}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      )}

      {/* Quem é, só com o que o coletivo já tornou público. */}
      <section className={visual === "noisme" ? "border-y" : "border-y-2"} style={{ backgroundColor: id.papel, borderColor: borda }}>
        <div className="mx-auto grid max-w-[78rem] gap-8 px-4 py-12 sm:px-8 md:grid-cols-2">
          <div>
            <h2 className={`text-[clamp(1.6rem,4vw,2.3rem)] leading-tight ${titulo}`}>{s.people}</h2>
            <p className="mt-3 max-w-xl text-[1.05rem] leading-relaxed">{territorio.quem}</p>
          </div>
          <ul className="flex flex-wrap content-start gap-2" aria-label={s.letreiroRotulo}>
            {temas.map((tema, i) => (
              <li key={tema} className={`${visual === "noisme" ? "border" : "border-2"} px-3 py-1.5 font-sans text-sm font-bold`} style={{ borderColor: visual === "kamikaze" ? acento(i) : borda }}>
                {tema}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* As trilhas: o estudo que combina com o trabalho do coletivo. */}
      {daqui.length > 0 && (
        <section className="mx-auto max-w-[78rem] px-4 py-14 sm:px-8">
          <h2 className={`text-[clamp(1.5rem,4vw,2.4rem)] leading-tight ${titulo}`}>{s.learnKicker}</h2>
          <ul className="mt-6 grid gap-5 md:grid-cols-3">
            {daqui.map((track, i) => (
              <li key={track.slug}>
                <Link
                  href={to(`/trilhas/${track.slug}`)}
                  className={`flex h-full flex-col ${visual === "noisme" ? "border" : "border-2"} p-5 no-underline`}
                  style={{ borderColor: visual === "kamikaze" ? acento(i + 1) : borda, backgroundColor: id.papel, color: id.tinta, boxShadow: sombra(6) }}
                >
                  <span className="font-serif text-[1.45rem] font-semibold leading-[1.1]">{track.title}</span>
                  <span className="mt-2 text-sm leading-relaxed">{track.summary}</span>
                  {track.lessons.length === 0 && <span className={`mt-4 self-start border border-dashed px-1.5 py-0.5 ${mono}`}>{s.soon}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {territorio.credito && <p className="mx-auto max-w-[78rem] px-4 pb-8 font-sans text-xs leading-relaxed sm:px-8">{territorio.credito}</p>}

      <footer className={visual === "noisme" ? "border-t" : "border-t-2"} style={{ borderColor: borda }}>
        <div className="mx-auto flex max-w-[78rem] flex-wrap items-center gap-4 px-4 py-7 sm:px-8">
          <p className="min-w-[16rem] flex-1 font-serif text-2xl">{s.nextTitle}</p>
          <a href={`mailto:${site.newsletter}?subject=${encodeURIComponent(s.nextCta)}`} className={botao} style={{ borderColor: id.tinta, backgroundColor: id.tinta, color: id.fundo }}>{s.nextCta}</a>
          <Link href={to("/territorios")} className={botao} style={{ borderColor: id.tinta, color: id.tinta }}>{s.all}</Link>
        </div>
      </footer>
    </div>
  );
}
