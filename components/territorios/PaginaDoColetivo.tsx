// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { CSSProperties } from "react";
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
import { IDENTIDADES } from "@/lib/territorios-identidades";
import type { Territorio } from "@/lib/territorios";

const mono = "font-mono text-[0.7rem] uppercase tracking-[0.2em]";
const grosso = "font-[Arial_Black,Impact,Haettenschweiler,sans-serif]";

/** O endereço de um post do Instagram a partir do código (só letras, números, hífen e sublinhado). */
const doPost = (codigo?: string) => (codigo && codigoDePostValido(codigo) ? `https://www.instagram.com/p/${codigo}/` : null);

/**
 * A página de um coletivo com identidade visual própria (NoizOcupa, Coletivo Kamikaze), preenchida com o que o coletivo
 * publicou no Instagram (uso autorizado pelos coletivos; content/territorios.json): a abertura com o cartaz, a faixa de
 * temas, a agenda e a convocação (ou o trabalho em destaque), o vídeo do anúncio, a história, as campanhas, a galeria, a
 * linha do tempo com o link de cada post, as trilhas e o crédito das imagens.
 */
export default function PaginaDoColetivo({ territorio, lang, t }: { territorio: Territorio; lang: Locale; t: Dict }) {
  const visual = territorio.visual === "kamikaze" ? "kamikaze" : "noizocupa";
  const kami = visual === "kamikaze";
  const id = IDENTIDADES[visual];
  const s = t.territorios;
  const to = (path: string) => localePath(lang, path);
  const instagram = `https://www.instagram.com/${territorio.instagram}/`;
  const trilhas = new Map(getTracks(lang).map((track) => [track.slug, track]));
  const daqui = territorio.trilhas.map((slug) => trilhas.get(slug)).filter((track) => track !== undefined);
  const anuncio = territorio.anuncio && codigoDePostValido(territorio.anuncio.post) ? territorio.anuncio : null;
  const local = anuncio && temVideoLocal(territorio.slug) ? enderecoDoVideo(territorio.slug) : null;
  const temas = territorio.temas;
  const botao = "inline-flex min-h-11 items-center gap-2 border-2 px-5 py-3 font-sans font-extrabold no-underline";
  const titulo = kami ? "font-serif font-bold" : grosso;
  const borda = kami ? id.destaque : id.tinta;
  const sombra = (n: number) => (kami ? undefined : `${n}px ${n}px 0 #2a0806`);
  const kicker = (texto: string) => (
    <p className={`${mono} font-bold`} style={{ color: id.rotulo }}>
      {texto}
    </p>
  );
  const linkDoPost = (codigo?: string, sobre?: string) => {
    const href = doPost(codigo);
    return href ? (
      <a href={href} rel="noopener noreferrer" target="_blank" className="mt-3 inline-block font-sans text-sm font-bold underline underline-offset-4" style={{ color: id.destaque }}>
        {s.anuncioAbrir}
        {sobre && <span className="sr-only"> ({sobre})</span>}
      </a>
    ) : null;
  };

  return (
    <div style={{ backgroundColor: id.fundo, color: id.tinta }} {...originalLang(lang === "pt")} data-identidade={visual}>
      <nav aria-label={s.title} className="border-b-2" style={{ borderColor: id.destaque }}>
        <p className={`mx-auto max-w-[78rem] px-4 py-3 sm:px-8 ${mono}`}>
          <Link href={to("/territorios")} className="underline underline-offset-2" style={{ color: id.tinta }}>{s.title}</Link> › <span>{territorio.nome}</span>
        </p>
      </nav>

      {!kami ? (
        /* NoizOcupa: o cartaz de rua do coletivo, o nome enorme, o lema em mostarda e o cartaz da festa colado ao lado. */
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.1] [background:radial-gradient(currentColor_1.5px,transparent_1.5px)] [background-size:16px_16px]" />
          <div className="relative mx-auto grid max-w-[78rem] items-center gap-12 px-4 py-14 sm:px-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <p className={`${mono} inline-block -rotate-1 border-2 px-2 py-1`} style={{ backgroundColor: id.tinta, color: id.fundo, borderColor: id.tinta }}>
                {s.partner.replace("{n}", String(territorio.numero).padStart(2, "0"))}
              </p>
              <h1 className={`${grosso} mt-5 text-[clamp(2.8rem,13vw,6.6rem)] leading-[0.95] tracking-[-0.03em] [text-shadow:5px_5px_0_var(--sombra-id)]`} style={{ "--sombra-id": "#2a0806" } as CSSProperties}>
                {territorio.nome}
              </h1>
              {territorio.lema && <p className={`${grosso} mt-4 text-[clamp(1rem,3.4vw,1.35rem)] uppercase tracking-[0.12em]`} style={{ color: id.destaque }}>{territorio.lema}</p>}
              <p className="mt-6 max-w-[34rem] text-[1.4rem] font-bold leading-snug">{territorio.slogan}</p>
              <p className="mt-3 max-w-[36rem] text-[1.05rem] leading-relaxed">{territorio.sobre}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href={instagram} rel="noopener noreferrer" target="_blank" className={botao} style={{ backgroundColor: id.tinta, borderColor: id.tinta, color: id.fundo, boxShadow: `5px 5px 0 ${id.destaque}` }}>
                  {s.follow} @{territorio.instagram}
                </a>
                {territorio.chamado && (
                  <a href="#chamado" className={botao} style={{ borderColor: id.destaque, color: id.destaque }}>
                    {territorio.chamado.titulo} ↓
                  </a>
                )}
              </div>
              {/* O aviso de idioma na cor da página (o fundo é escuro nas duas identidades, também com o site no claro). */}
              <div className="[&_*]:text-inherit!">
                <Untranslated lang={lang} t={t} show={lang !== "pt"} />
              </div>
            </div>
            {territorio.capa && (
              <div className="relative mx-auto w-full max-w-[26rem] px-3 pt-4">
                <Image src={territorio.capa.src} alt={territorio.capa.alt} width={960} height={960} priority sizes="(min-width: 768px) 26rem, 88vw" className="relative h-auto w-full rotate-2 border-[3px] object-cover" style={{ borderColor: id.tinta, boxShadow: `10px 10px 0 #2a0806` }} />
                {/* Duas tiras de fita, como cartaz colado no muro. */}
                <span aria-hidden className="absolute top-1 left-2 h-6 w-20 -rotate-[8deg] bg-[#e9dcbc]/85 shadow-sm" />
                <span aria-hidden className="absolute right-1 -bottom-2 h-6 w-20 -rotate-[6deg] bg-[#e9dcbc]/85 shadow-sm" />
              </div>
            )}
          </div>
        </section>
      ) : (
        /* Kamikaze: tela de cinema, fita de filme nas bordas, a marcação de tempo e o letreiro do anúncio. */
        <section className="relative overflow-hidden">
          <div aria-hidden className="absolute inset-x-0 top-0 h-5 opacity-80 [background:repeating-linear-gradient(90deg,#f5f1ea_0_14px,transparent_14px_28px)] [clip-path:inset(6px_0_6px_0)]" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-5 opacity-80 [background:repeating-linear-gradient(90deg,#f5f1ea_0_14px,transparent_14px_28px)] [clip-path:inset(6px_0_6px_0)]" />
          <div className="relative mx-auto grid max-w-[78rem] items-center gap-12 px-4 py-20 sm:px-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <p className={mono} style={{ color: id.destaque }}>
                <span aria-hidden>● </span>{s.partner.replace("{n}", String(territorio.numero).padStart(2, "0"))} <span aria-hidden>· 00:00:00:00</span>
              </p>
              <h1 className="mt-5 font-serif text-[clamp(2.6rem,12vw,6.4rem)] font-black leading-[0.95] tracking-[-0.03em]">{territorio.nome}</h1>
              <p className="mt-4 text-[clamp(1.6rem,6vw,2.6rem)] font-light italic leading-tight" style={{ color: id.destaque }}>{territorio.slogan}</p>
              {territorio.lema && <p className={`mt-4 ${mono}`}>{territorio.lema}</p>}
              <p className="mt-6 max-w-[40rem] text-[1.1rem] leading-relaxed">{territorio.sobre}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href={instagram} rel="noopener noreferrer" target="_blank" className={botao} style={{ backgroundColor: id.destaque, borderColor: id.destaque, color: "#0b0b10" }}>
                  {s.follow} @{territorio.instagram}
                </a>
              </div>
              <div className="[&_*]:text-inherit!">
                <Untranslated lang={lang} t={t} show={lang !== "pt"} />
              </div>
            </div>
            {territorio.capa && (
              <div className="relative mx-auto w-full max-w-[22rem] border-[10px] border-[#17171f] bg-black p-0 shadow-[0_0_0_2px_#ff2e88,0_0_60px_rgba(255,46,136,0.35)]">
                <Image src={territorio.capa.src} alt={territorio.capa.alt} width={720} height={1280} priority sizes="(min-width: 768px) 22rem, 88vw" className="aspect-[4/5] h-auto w-full object-cover object-[center_40%]" />
              </div>
            )}
          </div>
        </section>
      )}

      {/* A faixa dos temas: anda sempre (só para no botão, para quem pede menos movimento e no modo leve). */}
      <Letreiro
        temas={temas}
        rotulo={s.letreiroRotulo}
        pausar={s.letreiroPausar}
        retomar={s.letreiroRetomar}
        estilo={kami ? "border-y-2 border-[#f5f1ea] bg-[#ff2e88] text-[#0b0b10]" : "border-y-[3px] border-[#f6e8cc] bg-[#e8a93a] text-[#3a0b08]"}
        separador={kami ? "text-[#0b0b10]" : "text-[#5e120e]"}
      />

      {/* A agenda e a convocação (NoizOcupa). */}
      {territorio.agenda && (
        <section aria-labelledby="agenda-titulo" className="mx-auto max-w-[78rem] px-4 py-14 sm:px-8">
          <div className="grid gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="self-start border-[3px] p-6 md:-rotate-1" style={{ backgroundColor: id.tinta, color: id.fundo, borderColor: id.tinta, boxShadow: `8px 8px 0 ${id.destaque}` }}>
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

      {/* O trabalho em destaque, com a programação (Kamikaze). */}
      {territorio.destaque && (
        <section aria-labelledby="destaque-titulo" className="border-y-2" style={{ borderColor: borda, backgroundColor: id.papel }}>
          <div className="mx-auto grid max-w-[78rem] gap-8 px-4 py-14 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div>
              {kicker(territorio.destaque.chapeu)}
              <h2 id="destaque-titulo" className={`${titulo} mt-2 text-[clamp(1.8rem,5vw,2.8rem)] leading-[1.05]`}>{territorio.destaque.titulo}</h2>
              <p className="mt-4 max-w-xl text-[1.05rem] leading-relaxed">{territorio.destaque.texto}</p>
              {linkDoPost(territorio.destaque.post, territorio.destaque.titulo)}
            </div>
            {territorio.destaque.programa && (
              <ol className="grid gap-3 self-start">
                {territorio.destaque.programa.map((item) => (
                  <li key={item.hora} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-4 border-l-4 py-1 pl-4" style={{ borderColor: id.destaque }}>
                    <span className="font-mono text-2xl font-bold" style={{ color: id.destaque }}>{item.hora}</span>
                    <span>
                      <span className="block font-bold leading-snug">{item.titulo}</span>
                      <span className="mt-1 block text-[0.95rem] leading-relaxed opacity-90">{item.texto}</span>
                    </span>
                  </li>
                ))}
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
              {kicker(s.anuncioKicker)}
              <h2 id="anuncio-titulo" className={`mt-2 text-[clamp(1.6rem,5vw,2.6rem)] leading-tight ${titulo}`}>{anuncio.titulo}</h2>
              <p className="mt-3 max-w-2xl text-[1.05rem] leading-relaxed">{anuncio.texto}</p>
            </div>
            <div className={`${anuncio.vertical ? "" : "mt-7"} p-3 sm:p-4 ${kami ? "border-2 border-[#f5f1ea]/40 bg-black" : "border-[3px] bg-[#2a0806]"}`} style={kami ? undefined : { borderColor: id.tinta, boxShadow: `8px 8px 0 ${id.destaque}` }}>
              <PlayerDoAnuncio
                post={anuncio.post}
                local={local}
                titulo={anuncio.titulo}
                tom="escuro"
                capa={anuncio.capa}
                vertical={anuncio.vertical}
                acento={{ fundo: id.destaque, texto: id.fundo }}
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

      {/* As campanhas, com os cartazes (Kamikaze). */}
      {territorio.campanhas && territorio.campanhas.length > 0 && (
        <section className="mx-auto max-w-[78rem] px-4 py-14 sm:px-8">
          <div className="grid gap-14">
            {territorio.campanhas.map((campanha) => (
              <article key={campanha.titulo} aria-labelledby={`campanha-${campanha.post ?? campanha.titulo.length}`}>
                <h2 id={`campanha-${campanha.post ?? campanha.titulo.length}`} className={`${titulo} text-[clamp(1.7rem,5vw,2.6rem)] leading-tight`}>
                  <span style={{ color: id.destaque }}>✦ </span>
                  {campanha.titulo}
                </h2>
                <p className="mt-3 max-w-3xl text-[1.05rem] leading-relaxed">{campanha.texto}</p>
                {linkDoPost(campanha.post, campanha.titulo)}
                <ul className={`mt-6 grid gap-4 ${campanha.fotos.length > 2 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 sm:max-w-[34rem]"}`}>
                  {campanha.fotos.map((foto) => (
                    <li key={foto.src}>
                      <Image src={foto.src} alt={foto.alt} width={720} height={900} sizes="(min-width: 1024px) 18rem, 46vw" className="h-auto w-full border-2 object-cover" style={{ borderColor: borda }} />
                    </li>
                  ))}
                </ul>
              </article>
            ))}
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
        <section className="border-t-2" style={{ borderColor: borda }} aria-labelledby="marcos-titulo">
          <div className="mx-auto max-w-[78rem] px-4 py-14 sm:px-8">
            <h2 id="marcos-titulo" className={`${titulo} text-[clamp(1.7rem,5vw,2.5rem)] leading-tight`}>{territorio.marcos.titulo}</h2>
            <ol className="mt-8 grid gap-x-8 gap-y-6 border-l-[3px] pl-6 md:grid-cols-2 md:border-l-0 md:pl-0" style={{ borderColor: id.destaque }}>
              {territorio.marcos.itens.map((marco) => {
                const href = doPost(marco.post);
                return (
                  <li key={`${marco.quando}-${marco.titulo}`} className="relative md:border-l-[3px] md:pl-6" style={{ borderColor: id.destaque }}>
                    <span aria-hidden className="absolute top-1.5 -left-[calc(1.5rem+9px)] h-3.5 w-3.5 rounded-full border-2 md:-left-[9px]" style={{ backgroundColor: id.destaque, borderColor: id.fundo }} />
                    <p className={mono} style={{ color: id.rotulo }}>{marco.quando}</p>
                    <p className="mt-1 text-[1.15rem] font-bold leading-snug">
                      {href ? (
                        <a href={href} rel="noopener noreferrer" target="_blank" className="underline decoration-2 underline-offset-4 hover:opacity-80" style={{ textDecorationColor: id.destaque }}>
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
      <section className="border-y-2" style={{ backgroundColor: id.papel, borderColor: borda }}>
        <div className="mx-auto grid max-w-[78rem] gap-8 px-4 py-12 sm:px-8 md:grid-cols-2">
          <div>
            <h2 className={`text-[clamp(1.6rem,4vw,2.3rem)] leading-tight ${titulo}`}>{s.people}</h2>
            <p className="mt-3 max-w-xl text-[1.05rem] leading-relaxed">{territorio.quem}</p>
          </div>
          <ul className="flex flex-wrap content-start gap-2" aria-label={s.letreiroRotulo}>
            {temas.map((tema) => (
              <li key={tema} className="border-2 px-3 py-1.5 font-sans text-sm font-bold" style={{ borderColor: borda }}>
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
            {daqui.map((track) => (
              <li key={track.slug}>
                <Link
                  href={to(`/trilhas/${track.slug}`)}
                  className="flex h-full flex-col border-2 p-5 no-underline"
                  style={{ borderColor: borda, backgroundColor: id.papel, color: id.tinta, boxShadow: sombra(6) }}
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

      <footer className="border-t-2" style={{ borderColor: borda }}>
        <div className="mx-auto flex max-w-[78rem] flex-wrap items-center gap-4 px-4 py-7 sm:px-8">
          <p className="min-w-[16rem] flex-1 font-serif text-2xl">{s.nextTitle}</p>
          <a href={`mailto:${site.newsletter}?subject=${encodeURIComponent(s.nextCta)}`} className={botao} style={{ borderColor: id.tinta, backgroundColor: id.tinta, color: id.fundo }}>{s.nextCta}</a>
          <Link href={to("/territorios")} className={botao} style={{ borderColor: id.tinta, color: id.tinta }}>{s.all}</Link>
        </div>
      </footer>
    </div>
  );
}
