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
import { letraDesordem, letraKamikaze, letraNoisme, letraNoiz } from "@/lib/fontes-coletivos";
import { site } from "@/lib/site";
import { codigoDePostValido, enderecoDoVideo, temVideoLocal } from "@/lib/territorios-video";
import { ehVisual, IDENTIDADES, type Visual } from "@/lib/territorios-identidades";
import type { Territorio } from "@/lib/territorios";
import "@/styles/territorios-coletivos.css";

/** O endereço de um post do Instagram a partir do código (só letras, números, hífen e sublinhado). */
const doPost = (codigo?: string) => (codigo && codigoDePostValido(codigo) ? `https://www.instagram.com/p/${codigo}/` : null);
const doReel = (codigo: string) => (codigoDePostValido(codigo) ? `https://www.instagram.com/reel/${codigo}/` : null);

/** A letra de título de cada coletivo (lib/fontes-coletivos.ts): só a do coletivo da página entra no desenho. */
const LETRA: Record<Visual, string> = { noizocupa: letraNoiz.variable, kamikaze: letraKamikaze.variable, desordem: letraDesordem.variable, noisme: letraNoisme.variable };

/** A faixa de temas de cada um (as classes são literais para o Tailwind enxergar). */
const LETREIRO: Record<Visual, { estilo: string; separador: string }> = {
  noizocupa: { estilo: "border-y-[3px] border-[#f6e8cc] bg-[#e8a93a] text-[#3a0b08]", separador: "text-[#5e120e]" },
  kamikaze: { estilo: "border-y-[3px] border-[#111010] bg-[#0a6631] text-[#ffe14d] uppercase", separador: "text-[#ff7eb6]" },
  desordem: { estilo: "-rotate-1 border-y-[3px] border-[#0e0c0b] bg-[#ffd21f] text-[#0e0c0b] uppercase", separador: "text-[#d7261e]" },
  noisme: { estilo: "border-y border-[#0a0a0a] bg-[#0a0a0a] text-white uppercase tracking-[0.12em]", separador: "text-white" },
};

/** As letras do nome do Desordem, cada uma girada (só no desenho: o leitor de tela lê o nome inteiro). */
const GIRO = [-6, 4, -2, 7, -4, 2, -7, 5];
const PULO = [0, -4, 3, -2, 5, -3];

/**
 * A página de um coletivo com identidade visual própria (NoizOcupa, Coletivo Kamikaze, Coletivo Desordem, noismemo
 * studios), preenchida com o que o coletivo publicou no Instagram (uso autorizado pelos coletivos; content/territorios.json).
 * Redesenho de 08/11/2026: cada coletivo abre do seu jeito, com a logo grande (1920 px) e a sua letra; depois, na mesma
 * ordem para todos, vêm quem são, o trabalho em destaque, os vídeos, os cartazes, a agenda e os links, e a parceria com o
 * Instituto. O material de cada mundo (papel de lambe, xerox, spray, ficha técnica) está em styles/territorios-coletivos.css.
 */
export default function PaginaDoColetivo({ territorio, lang, t }: { territorio: Territorio; lang: Locale; t: Dict }) {
  const visual: Visual = ehVisual(territorio.visual) ? territorio.visual : "noizocupa";
  const id = IDENTIDADES[visual];
  const s = t.territorios;
  const to = (path: string) => localePath(lang, path);
  const instagram = `https://www.instagram.com/${territorio.instagram}/`;
  const trilhas = new Map(getTracks(lang).map((track) => [track.slug, track]));
  const daqui = territorio.trilhas.map((slug) => trilhas.get(slug)).filter((track) => track !== undefined);
  const anuncio = territorio.anuncio && codigoDePostValido(territorio.anuncio.post) ? territorio.anuncio : null;
  const local = anuncio && temVideoLocal(territorio.slug) ? enderecoDoVideo(territorio.slug) : null;
  const videos = territorio.videos ?? [];
  const numero = s.partner.replace("{n}", String(territorio.numero).padStart(2, "0"));
  // No Kamikaze a cor de cada bloco gira pela paleta dos cartazes (amarelo, verde, rosa, azul); nos outros é fixa.
  const acento = (i: number) => (visual === "kamikaze" ? id.acentos[i % id.acentos.length] : id.destaque);
  const cores = { "--col-fundo": id.fundo, "--col-papel": id.papel, "--col-tinta": id.tinta, "--col-destaque": id.destaque, "--col-rotulo": id.rotulo, "--col-botao-texto": id.botaoTexto } as CSSProperties;

  const linkDoPost = (codigo?: string, sobre?: string, cor?: string) => {
    const href = doPost(codigo);
    return href ? (
      <a href={href} rel="noopener noreferrer" target="_blank" className="col-link-post" style={cor ? { color: cor } : undefined}>
        {s.anuncioAbrir}
        {sobre && <span className="sr-only"> ({sobre})</span>}
      </a>
    ) : null;
  };
  const seguir = (
    <a href={instagram} rel="noopener noreferrer" target="_blank" className="col-botao col-botao-cheio">
      {s.follow} @{territorio.instagram}
    </a>
  );
  // O aviso de idioma na cor da página.
  const aviso = (
    <div className="[&_*]:text-inherit!">
      <Untranslated lang={lang} t={t} show={lang !== "pt"} />
    </div>
  );
  /** A logo grande (1920 px quando houver) com o crédito embaixo ("Logo cedida pelo coletivo"). */
  const logo = (moldura: string, extra?: ReactNode): ReactNode =>
    territorio.logo ? (
      <figure className="col-logo">
        <div className={`relative ${moldura}`}>
          <Image src={territorio.logo.grande ?? territorio.logo.src} alt={territorio.logo.alt} width={1920} height={1920} priority sizes="(min-width: 768px) 30rem, 86vw" className="relative z-[1] aspect-square h-auto w-full object-cover" />
          {extra}
        </div>
        <figcaption className="col-legenda mt-3 text-center">
          {territorio.logo.credito} · @{territorio.instagram}
        </figcaption>
      </figure>
    ) : null;
  const titulo = (texto: string, idDoTitulo?: string, cor?: string) => (
    <h2 id={idDoTitulo} className="col-h2" style={cor ? { color: cor } : undefined}>
      {texto}
    </h2>
  );

  return (
    <div className={`col ${LETRA[visual]}`} style={{ ...cores, backgroundColor: id.fundo, color: id.tinta }} {...originalLang(lang === "pt")} data-identidade={visual}>
      <nav aria-label={s.title} className="col-trilha">
        <p className="mx-auto max-w-[78rem] px-4 py-3 sm:px-8">
          <Link href={to("/territorios")} className="underline underline-offset-2" style={{ color: id.tinta }}>
            {s.title}
          </Link>{" "}
          › <span>{territorio.nome}</span>
        </p>
      </nav>

      {visual === "noizocupa" && (
        /* NoizOcupa: o muro vinho com grão de papel; o nome em letra gorda dos anos 70, o lema numa tira de lambe colada
           torta e a logo como um cartaz lambe-lambe, de borda rasgada, preso com fita. */
        <section className="col-abertura col-grao relative overflow-hidden">
          <div className="relative mx-auto grid max-w-[78rem] items-center gap-12 px-4 pt-10 pb-16 sm:px-8 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:pt-16 md:pb-20">
            <div className="min-w-0">
              <p className="col-selo">{numero}</p>
              <h1 className="noiz-nome mt-6">{territorio.nome}</h1>
              {territorio.lema && <p className="noiz-tira mt-6">{territorio.lema}</p>}
              <p className="mt-8 max-w-[30rem] text-[1.45rem] font-bold leading-snug text-balance">{territorio.slogan}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                {seguir}
                {territorio.chamado && (
                  <a href="#chamado" className="col-botao col-botao-vazado">
                    {territorio.chamado.titulo} ↓
                  </a>
                )}
              </div>
              {aviso}
            </div>
            <div className="relative mx-auto w-full max-w-[30rem] px-2 pt-5">
              {logo("noiz-lambe", <span aria-hidden className="noiz-vinco" />)}
              <span aria-hidden className="col-fita top-0 left-8 -rotate-[8deg]" />
              <span aria-hidden className="col-fita top-3 right-6 rotate-[6deg]" />
            </div>
          </div>
        </section>
      )}

      {visual === "kamikaze" && (
        /* Kamikaze: o amarelo puro da logo com retícula de xerox; o nome em letra de cartaz de cinema, o slogan numa tarja
           preta e a logo dentro de uma marquise de lâmpadas (amarelo e rosa), com a fita de filme embaixo. */
        <section className="col-abertura kami-abertura relative overflow-hidden">
          <div className="relative mx-auto grid max-w-[78rem] items-center gap-12 px-4 pt-10 pb-14 sm:px-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:pt-16 md:pb-20">
            <div className="min-w-0">
              <p className="kami-ingresso">{numero}</p>
              <h1 className="kami-nome mt-5">{territorio.nome}</h1>
              <p className="kami-tarja mt-5">{territorio.slogan}</p>
              {territorio.lema && (
                <ul className="mt-6 flex flex-wrap gap-2" aria-label={territorio.lema}>
                  {territorio.lema.split(" · ").map((parte, i) => (
                    <li key={parte} className="kami-chip" style={{ backgroundColor: ["#ffffff", "#9be8bd", "#ffc2dc", "#c4e6ff"][i % 4] }}>
                      {parte}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-8 flex flex-wrap gap-3">{seguir}</div>
              {aviso}
            </div>
            <div className="mx-auto w-full max-w-[30rem]">{logo("kami-marquise")}</div>
          </div>
          <div aria-hidden className="kami-filme" />
        </section>
      )}

      {visual === "desordem" && (
        /* Desordem: o preto com os halos de spray da logo; as letras do nome tortas em letra de spray, amarelas com a sombra
           vermelha deslocada; a bio com os símbolos no lugar das letras; a logo colada torta, com escorrido de tinta. */
        <section className="col-abertura deso-abertura relative overflow-hidden">
          <div className="relative mx-auto grid max-w-[78rem] items-center gap-12 px-4 pt-10 pb-16 sm:px-8 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:pt-16 md:pb-20">
            <div className="min-w-0">
              <p className="col-selo">{numero}</p>
              <h1 className="deso-nome mt-6">
                <span className="sr-only">{territorio.nome}</span>
                <span aria-hidden className="flex flex-wrap gap-x-[0.28em]">
                  {territorio.nome.split(" ").map((palavra, p) => (
                    <span key={palavra} className="inline-flex">
                      {Array.from(palavra).map((letra, i) => (
                        <span key={i} className="inline-block" style={{ transform: `rotate(${GIRO[(i + p * 3) % 8]}deg) translateY(${PULO[(i + p) % 6]}px)` }}>
                          {letra}
                        </span>
                      ))}
                    </span>
                  ))}
                </span>
              </h1>
              <p className="deso-faixa mt-6">{territorio.slogan}</p>
              {/* A bio do coletivo, do jeito que eles escrevem (o slogan acima é a mesma frase, legível). */}
              <p aria-hidden className="deso-bio mt-5">D3$0rdeπ∆nDø a Arte¡!</p>
              {territorio.lema && <p className="col-meta mt-5">{territorio.lema}</p>}
              <div className="mt-8 flex flex-wrap gap-3">{seguir}</div>
              {aviso}
            </div>
            <div className="mx-auto w-full max-w-[28rem] px-2">{logo("deso-cartaz", <span aria-hidden className="deso-escorrido" />)}</div>
          </div>
        </section>
      )}

      {visual === "noisme" && (
        /* noismemo studios: ficha técnica em preto e branco. Linhas finas, o título enorme e apertado, a elipse da logo
           repetida como selo na régua e o cinza só nas legendas. */
        <section className="col-abertura">
          <div className="mx-auto max-w-[78rem] px-4 pt-6 pb-14 sm:px-8 md:pb-20">
            <dl className="nm-ficha">
              {[
                [s.title, String(territorio.numero).padStart(2, "0")],
                ["Instagram", "@" + territorio.instagram],
                ["—", territorio.lema ?? ""],
                ["—", territorio.slogan ?? ""],
              ].map(([chave, valor], i) => (
                <div key={i}>
                  <dt>{chave}</dt>
                  <dd>{valor}</dd>
                </div>
              ))}
            </dl>
            <div aria-hidden className="nm-regua">
              {Array.from({ length: 9 }, (_, i) => (
                <svg key={i} viewBox="60 160 360 162" className="h-4 w-auto">
                  <path fillRule="evenodd" d="M60.5 241a179.5 78.5 0 1 0 359 0a179.5 78.5 0 1 0 -359 0ZM88.5 241.5a151.5 66 0 1 0 303 0a151.5 66 0 1 0 -303 0ZM126 265H163L180 235L212 265H254.5L255 239L271 265H302L306 238L322 265H360L324 205Q322 203 318 203H286L280 224L261 203H221L213 222L189 203H166Z" />
                </svg>
              ))}
            </div>
            <div className="mt-10 grid items-end gap-10 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <h1 className="nm-nome">{territorio.nome}</h1>
                <p className="nm-slogan mt-7">{territorio.slogan}</p>
                <div className="mt-8 flex flex-wrap gap-3">{seguir}</div>
                {aviso}
              </div>
              {logo("nm-prancha", <span aria-hidden className="nm-cota">FIG. 01 — NM</span>)}
            </div>
          </div>
        </section>
      )}

      {/* A faixa dos temas: anda sempre (só para no botão, para quem pede menos movimento e no modo leve). */}
      <Letreiro temas={territorio.temas} rotulo={s.letreiroRotulo} pausar={s.letreiroPausar} retomar={s.letreiroRetomar} estilo={`col-letreiro ${LETREIRO[visual].estilo}`} separador={LETREIRO[visual].separador} />

      {/* Quem são: o texto do coletivo (bio, história e manifesto), sem nada inventado. */}
      <section aria-labelledby="quem-titulo" className="col-sec">
        <div className="col-miolo grid gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            {titulo(s.quemSao, "quem-titulo")}
            <p className="col-lide mt-5">{territorio.sobre}</p>
            {territorio.historia && (
              <>
                <h3 className="col-h3 mt-9" style={{ color: acento(0) }}>{territorio.historia.titulo}</h3>
                {territorio.historia.paragrafos.map((p) => (
                  <p key={p.slice(0, 32)} className="col-texto mt-4">
                    {p}
                  </p>
                ))}
                {linkDoPost(territorio.historia.post, territorio.historia.titulo)}
              </>
            )}
            <p className="col-texto mt-6">{territorio.quem}</p>
          </div>
          <div className="grid content-start gap-8">
            {territorio.citacao && (
              <figure className="col-citacao">
                <p className="col-h3" style={{ color: id.destaque }}>{territorio.citacao.titulo}</p>
                <blockquote className="mt-3 text-[1.15rem] leading-relaxed italic">“{territorio.citacao.texto}”</blockquote>
                <figcaption className="col-meta mt-4">@{territorio.instagram}</figcaption>
                {linkDoPost(territorio.citacao.post, territorio.citacao.titulo)}
              </figure>
            )}
            <ul className="flex flex-wrap content-start gap-2" aria-label={s.letreiroRotulo}>
              {territorio.temas.map((tema, i) => (
                <li key={tema} className="col-tema" style={visual === "kamikaze" ? { borderColor: acento(i) } : undefined}>
                  {tema}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* O trabalho em destaque, com a programação (Kamikaze, Desordem, noismemo). */}
      {territorio.destaque && (
        <section aria-labelledby="destaque-titulo" className="col-sec col-papel col-grao relative">
          <div className={`col-miolo relative grid gap-10 ${territorio.destaque.programa ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" : ""}`}>
            <div className="min-w-0">
              {titulo(territorio.destaque.titulo, "destaque-titulo", visual === "desordem" ? id.destaque : undefined)}
              <p className="col-meta mt-3" style={{ color: acento(1) }}>{territorio.destaque.chapeu}</p>
              <p className="col-texto mt-5">{territorio.destaque.texto}</p>
              {linkDoPost(territorio.destaque.post, territorio.destaque.titulo, acento(1))}
            </div>
            {territorio.destaque.programa && (
              <ol className="grid gap-4 self-start">
                {territorio.destaque.programa.map((item, i) => (
                  <li key={item.hora} className="col-programa" style={{ borderColor: acento(i + 1) }}>
                    <span className="col-hora" style={{ color: acento(i + 1) }}>{item.hora}</span>
                    <span>
                      <span className="block font-bold leading-snug">{item.titulo}</span>
                      <span className="mt-1 block text-[0.97rem] leading-relaxed">{item.texto}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      )}

      {/* Os vídeos: o anúncio da parceria e os reels que o coletivo autorizou, todos servidos do próprio site. */}
      {(anuncio || videos.length > 0) && (
        <section aria-labelledby="videos-titulo" className="col-sec">
          <div className="col-miolo">
            {titulo(s.videos, "videos-titulo")}
            <div className={`mt-8 grid items-start gap-10 ${(anuncio ? 1 : 0) + videos.length === 1 ? "col-video-unico" : "md:grid-cols-2 lg:grid-cols-3"}`}>
              {anuncio && (
                <figure className="col-video">
                  <div className="col-tela">
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
                  <figcaption className="mt-4">
                    <p className="col-h3">{anuncio.titulo}</p>
                    <p className="col-texto mt-2">{anuncio.texto}</p>
                  </figcaption>
                </figure>
              )}
              {videos.map((video, i) => {
                const reel = doReel(video.reel);
                return (
                  <figure key={video.src} className="col-video" style={{ "--col-giro": `${[-1.2, 1, -0.6][i % 3]}deg` } as CSSProperties}>
                    <div className="col-tela">
                      <video controls playsInline preload="metadata" poster={video.capa} aria-label={`${s.videoRotulo}: ${video.titulo}`} className="mx-auto block aspect-[9/16] max-h-[78vh] w-full max-w-[24rem] bg-black object-contain">
                        <source src={video.src} type="video/mp4" />
                      </video>
                    </div>
                    <figcaption className="mt-4">
                      <p className="col-meta" style={{ color: acento(i + 1) }}>{video.data}</p>
                      <p className="col-h3 mt-1">{video.titulo}</p>
                      <p className="col-texto mt-2">{video.texto}</p>
                      {reel && (
                        <a href={reel} rel="noopener noreferrer" target="_blank" className="col-link-post" style={{ color: acento(i + 1) }}>
                          {s.videoOriginal}
                          <span className="sr-only"> ({video.titulo})</span>
                        </a>
                      )}
                      <p className="col-legenda mt-2">{video.credito}</p>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Os cartazes: as campanhas (Kamikaze), cada uma na cor dos próprios cartazes, e a galeria do perfil (NoizOcupa). */}
      {territorio.campanhas && territorio.campanhas.length > 0 && (
        <section className="col-sec col-papel">
          <div className="col-miolo grid gap-16">
            {territorio.campanhas.map((campanha, c) => {
              const cor = acento(c + 1);
              const idDaCampanha = `campanha-${campanha.post ?? c}`;
              return (
                <article key={campanha.titulo} aria-labelledby={idDaCampanha} className="grid gap-8 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <div className="min-w-0">
                    {titulo(campanha.titulo, idDaCampanha, cor)}
                    <p className="col-texto mt-4">{campanha.texto}</p>
                    {linkDoPost(campanha.post, campanha.titulo, cor)}
                  </div>
                  <ul className={`grid gap-4 ${campanha.fotos.length > 2 ? "grid-cols-2" : "grid-cols-2"}`}>
                    {campanha.fotos.map((foto, f) => (
                      <li key={foto.src} className="col-cartaz" style={{ "--col-giro": `${[1.2, -1, 0.6, -1.4][f % 4]}deg`, borderColor: cor } as CSSProperties}>
                        <Image src={foto.src} alt={foto.alt} width={720} height={900} sizes="(min-width: 1024px) 18rem, 46vw" className="h-auto w-full object-cover" />
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* A galeria do perfil (NoizOcupa): cartazes colados no muro, cada um num ângulo. A primeira ocupa 2 × 2; com 15
          fotos, 2, 3 e 6 colunas fecham as linhas sem buraco no fim. */}
      {territorio.galeria && territorio.galeria.fotos.length > 0 && (
        <section className="col-sec col-grao relative" aria-labelledby="galeria-titulo">
          <div className="col-miolo relative">
            {titulo(territorio.galeria.titulo, "galeria-titulo")}
            <ul className="mt-9 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-6">
              {territorio.galeria.fotos.map((foto, i) => (
                <li key={foto.src} className={i === 0 ? "col-span-2 row-span-2" : ""}>
                  <figure className="col-cartaz" style={{ "--col-giro": `${[-1.5, 1.2, -0.8, 1.6, -1.1, 0.7][i % 6]}deg` } as CSSProperties}>
                    <Image src={foto.src} alt={foto.alt} width={900} height={900} sizes={i === 0 ? "(min-width: 1024px) 30rem, 92vw" : "(min-width: 1024px) 15rem, 46vw"} className="aspect-square h-auto w-full object-cover" />
                    {(foto.legenda || foto.credito) && (
                      <figcaption className="col-legenda px-1 pt-1.5 pb-1">
                        {foto.legenda}
                        {foto.credito && <span className="block">{foto.credito}</span>}
                      </figcaption>
                    )}
                  </figure>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Agenda e links: a data marcada e a convocação (NoizOcupa), a linha do tempo com o link de cada post e o perfil. */}
      <section aria-labelledby="agenda-titulo" className="col-sec col-papel">
        <div className="col-miolo">
          {titulo(s.agendaLinks, "agenda-titulo")}
          {territorio.agenda && (
            <div className="mt-9 grid gap-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="self-start">
                <div className="col-agenda">
                  <p className="col-meta">{s.agendaKicker}</p>
                  <h3 className="col-h3 mt-2 text-[clamp(1.9rem,6vw,2.7rem)]!">{territorio.agenda.titulo}</h3>
                  <dl className="mt-5 grid gap-3">
                    <div>
                      <dt className="col-meta">{s.agendaQuando}</dt>
                      <dd className="text-xl font-bold">{territorio.agenda.quando}</dd>
                    </div>
                    <div>
                      <dt className="col-meta">{s.agendaOnde}</dt>
                      <dd className="text-xl font-bold">{territorio.agenda.onde}</dd>
                    </div>
                  </dl>
                  <p className="mt-4 text-[0.98rem] leading-relaxed">{territorio.agenda.como}</p>
                </div>
                {territorio.capa && (
                  <div className="col-cartaz mt-9 max-w-[24rem]" style={{ "--col-giro": "1.2deg" } as CSSProperties}>
                    <Image src={territorio.capa.src} alt={territorio.capa.alt} width={960} height={960} sizes="(min-width: 768px) 24rem, 92vw" className="h-auto w-full object-cover" />
                  </div>
                )}
              </div>
              {territorio.chamado && (
                <div id="chamado" className="scroll-mt-24">
                  <h3 className="col-h3 text-[clamp(1.6rem,5vw,2.3rem)]!" style={{ color: id.destaque }}>{territorio.chamado.titulo}</h3>
                  <p className="col-texto mt-3">{territorio.chamado.texto}</p>
                  <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                    {territorio.chamado.itens.map((item, i) => (
                      <li key={item.titulo} className={`col-item ${i === territorio.chamado!.itens.length - 1 && territorio.chamado!.itens.length % 2 ? "sm:col-span-2" : ""}`}>
                        <p className="col-h3 text-[1.08rem]!" style={{ color: id.destaque }}>{item.titulo}</p>
                        <p className="mt-1.5 text-[0.95rem] leading-relaxed">{item.texto}</p>
                      </li>
                    ))}
                  </ul>
                  {territorio.chamado.apoio && <p className="col-texto mt-5 border-l-2 pl-4" style={{ borderColor: id.destaque }}>{territorio.chamado.apoio}</p>}
                  {linkDoPost(territorio.chamado.post, territorio.chamado.titulo)}
                </div>
              )}
            </div>
          )}

          {territorio.marcos && territorio.marcos.itens.length > 0 && (
            <div className="mt-12">
              <h3 className="col-h3">{territorio.marcos.titulo}</h3>
              <ol className="col-linha mt-7">
                {territorio.marcos.itens.map((marco, i) => {
                  const href = doPost(marco.post);
                  const cor = acento(i);
                  return (
                    <li key={`${marco.quando}-${marco.titulo}`} style={{ "--col-ponto": cor } as CSSProperties}>
                      <p className="col-meta" style={{ color: visual === "kamikaze" ? cor : id.rotulo }}>{marco.quando}</p>
                      <p className="mt-1 text-[1.15rem] font-bold leading-snug">
                        {href ? (
                          <a href={href} rel="noopener noreferrer" target="_blank" className="underline decoration-2 underline-offset-4" style={{ textDecorationColor: cor }}>
                            {marco.titulo}
                          </a>
                        ) : (
                          marco.titulo
                        )}
                      </p>
                      <p className="mt-1 text-[0.98rem] leading-relaxed">{marco.texto}</p>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          <ul className="mt-12 flex flex-wrap gap-3" aria-label={s.agendaLinks}>
            <li>{seguir}</li>
            {territorio.pessoas.map((pessoa) => (
              <li key={pessoa.instagram}>
                <a href={`https://www.instagram.com/${pessoa.instagram}/`} rel="noopener noreferrer" target="_blank" className="col-botao col-botao-vazado">
                  {pessoa.nome} · @{pessoa.instagram}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* A parceria com o Instituto: o que o território traz e as trilhas de estudo que combinam com o trabalho dele. */}
      <section aria-labelledby="parceria-titulo" className="col-sec col-parceria">
        <div className="col-miolo">
          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {titulo(s.parceria, "parceria-titulo")}
            <div>
              <p className="col-lide">{s.parceriaTexto.replace("{nome}", territorio.nome)}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={`mailto:${site.newsletter}?subject=${encodeURIComponent(s.nextCta)}`} className="col-botao col-botao-cheio">{s.nextCta}</a>
                <Link href={to("/territorios")} className="col-botao col-botao-vazado">{s.all}</Link>
              </div>
            </div>
          </div>
          {daqui.length > 0 && (
            <>
              <h3 className="col-h3 mt-12">{s.learnKicker}</h3>
              <ul className="mt-6 grid gap-5 md:grid-cols-3">
                {daqui.map((track, i) => (
                  <li key={track.slug}>
                    <Link href={to(`/trilhas/${track.slug}`)} className="col-trilha-cartao" style={visual === "kamikaze" ? { borderColor: acento(i + 1) } : undefined}>
                      <span className="col-h3 text-[1.35rem]!">{track.title}</span>
                      <span className="mt-2 text-sm leading-relaxed">{track.summary}</span>
                      {track.lessons.length === 0 && <span className="col-meta mt-4 self-start border border-dashed px-1.5 py-0.5">{s.soon}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {territorio.credito && (
        <footer className="col-creditos">
          <p className="mx-auto max-w-[78rem] px-4 py-8 sm:px-8">{territorio.credito}</p>
        </footer>
      )}
    </div>
  );
}
