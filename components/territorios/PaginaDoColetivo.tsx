// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { CSSProperties } from "react";
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

/** A página de um coletivo com identidade visual própria (NoizOcupa, Coletivo Kamikaze). */
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

  return (
    <div style={{ backgroundColor: id.fundo, color: id.tinta }} {...originalLang(lang === "pt")} data-identidade={visual}>
      <nav aria-label={s.title} className="border-b-2" style={{ borderColor: id.destaque }}>
        <p className={`mx-auto max-w-[78rem] px-4 py-3 sm:px-8 ${mono}`}>
          <Link href={to("/territorios")} className="underline underline-offset-2" style={{ color: id.tinta }}>{s.title}</Link> › <span>{territorio.nome}</span>
        </p>
      </nav>

      {!kami ? (
        /* NoizOcupa: cartaz de rua, o nome enorme, adesivos inclinados e o convite da festa. */
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.12] [background:radial-gradient(currentColor_1.5px,transparent_1.5px)] [background-size:18px_18px]" />
          <div className="relative mx-auto grid max-w-[78rem] items-center gap-10 px-4 py-14 sm:px-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <p className={`${mono} inline-block -rotate-1 border-2 px-2 py-1`} style={{ backgroundColor: id.tinta, color: id.fundo, borderColor: id.tinta }}>
                {s.partner.replace("{n}", String(territorio.numero).padStart(2, "0"))}
              </p>
              <h1 className={`${grosso} mt-5 text-[clamp(2.6rem,14vw,6.4rem)] leading-[0.88] tracking-[-0.03em] [text-shadow:5px_5px_0_var(--sombra-id)]`} style={{ "--sombra-id": id.destaque } as CSSProperties}>
                {territorio.nome}
              </h1>
              <p className="mt-6 max-w-[34rem] text-[1.35rem] font-bold leading-snug">{territorio.slogan}</p>
              <p className="mt-3 max-w-[34rem] text-[1.05rem] leading-relaxed">{territorio.sobre}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={instagram} rel="noopener noreferrer" target="_blank" className={botao} style={{ backgroundColor: id.tinta, borderColor: id.tinta, color: id.fundo, boxShadow: `5px 5px 0 ${id.destaque}` }}>
                  {s.follow} @{territorio.instagram}
                </a>
              </div>
              <Untranslated lang={lang} t={t} show={lang !== "pt"} />
            </div>
            {territorio.agenda && (
              <aside aria-label={s.agendaKicker} className="relative rotate-2 border-[3px] p-6" style={{ backgroundColor: id.papel, borderColor: id.tinta, boxShadow: `8px 8px 0 ${id.tinta}` }}>
                <p className={`${mono} font-bold`} style={{ color: id.rotulo }}>{s.agendaKicker}</p>
                <h2 className={`${grosso} mt-2 text-[2.2rem] leading-[0.95]`}>{territorio.agenda.titulo}</h2>
                <dl className="mt-4 space-y-3">
                  <div>
                    <dt className={mono}>{s.agendaQuando}</dt>
                    <dd className="text-lg font-bold">{territorio.agenda.quando}</dd>
                  </div>
                  <div>
                    <dt className={mono}>{s.agendaOnde}</dt>
                    <dd className="text-lg font-bold">{territorio.agenda.onde}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-[0.95rem] leading-relaxed">{territorio.agenda.como}</p>
              </aside>
            )}
          </div>
        </section>
      ) : (
        /* Kamikaze: tela de cinema, fita de filme nas bordas e a marcação de tempo. */
        <section className="relative overflow-hidden">
          <div aria-hidden className="absolute inset-x-0 top-0 h-5 opacity-80 [background:repeating-linear-gradient(90deg,#f5f1ea_0_14px,transparent_14px_28px)] [clip-path:inset(6px_0_6px_0)]" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-5 opacity-80 [background:repeating-linear-gradient(90deg,#f5f1ea_0_14px,transparent_14px_28px)] [clip-path:inset(6px_0_6px_0)]" />
          <div className="relative mx-auto max-w-[78rem] px-4 py-20 sm:px-8">
            <p className={mono} style={{ color: id.destaque }}>
              <span aria-hidden>● </span>{s.partner.replace("{n}", String(territorio.numero).padStart(2, "0"))} <span aria-hidden>· 00:00:00:00</span>
            </p>
            <h1 className="mt-5 font-serif text-[clamp(2.6rem,12vw,6.4rem)] font-black leading-[0.9] tracking-[-0.03em]">{territorio.nome}</h1>
            <p className="mt-4 text-[clamp(1.6rem,6vw,2.6rem)] font-light italic leading-tight" style={{ color: id.destaque }}>{territorio.slogan}</p>
            <p className="mt-6 max-w-[40rem] text-[1.1rem] leading-relaxed">{territorio.sobre}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={instagram} rel="noopener noreferrer" target="_blank" className={botao} style={{ backgroundColor: id.destaque, borderColor: id.destaque, color: "#0b0b10" }}>
                {s.follow} @{territorio.instagram}
              </a>
            </div>
            <Untranslated lang={lang} t={t} show={lang !== "pt"} />
          </div>
        </section>
      )}

      <Letreiro
        temas={temas}
        rotulo={s.letreiroRotulo}
        pausar={s.letreiroPausar}
        retomar={s.letreiroRetomar}
        estilo={kami ? "border-y-2 border-[#f5f1ea] bg-[#ff2e88] text-[#0b0b10]" : "border-y-[3px] border-[#14213d] bg-[#14213d] text-[#ffd23f]"}
        separador={kami ? "text-[#0b0b10]" : "text-[#e4572e]"}
      />

      {/* O vídeo do anúncio: o arquivo local, se já foi colocado; senão o Instagram, só depois do clique. */}
      {anuncio && (
        <section className="mx-auto max-w-[78rem] px-4 py-14 sm:px-8" aria-labelledby="anuncio-titulo">
          <p className={mono} style={{ color: id.rotulo }}>{s.anuncioKicker}</p>
          <h2 id="anuncio-titulo" className={`mt-2 text-[clamp(1.6rem,5vw,2.6rem)] leading-tight ${titulo}`}>{anuncio.titulo}</h2>
          <p className="mt-2 max-w-2xl leading-relaxed">{anuncio.texto}</p>
          <div className={`mt-7 p-3 sm:p-5 ${kami ? "border-2 border-[#f5f1ea]/40 bg-black" : "border-[3px] border-[#14213d] bg-[#fff4cc]"}`} style={kami ? undefined : { boxShadow: `8px 8px 0 ${id.tinta}` }}>
            <PlayerDoAnuncio
              post={anuncio.post}
              local={local}
              titulo={anuncio.titulo}
              tom={kami ? "escuro" : "claro"}
              textos={{ carregar: s.anuncioLoad, aviso: s.anuncioAviso, abrir: s.anuncioAbrir, quadro: s.anuncioQuadro, video: s.anuncioLocal }}
            />
          </div>
        </section>
      )}

      {/* Quem é, só com o que o coletivo já tornou público. */}
      <section className="border-y-2" style={{ backgroundColor: id.papel, borderColor: kami ? id.destaque : id.tinta }}>
        <div className="mx-auto grid max-w-[78rem] gap-8 px-4 py-12 sm:px-8 md:grid-cols-2">
          <div>
            <h2 className={`text-[clamp(1.6rem,4vw,2.3rem)] leading-tight ${titulo}`}>{s.people}</h2>
            <p className="mt-3 max-w-xl text-[1.05rem] leading-relaxed">{territorio.quem}</p>
          </div>
          <ul className="flex flex-wrap content-start gap-2" aria-label={s.letreiroRotulo}>
            {temas.map((tema) => (
              <li key={tema} className="border-2 px-3 py-1.5 font-sans text-sm font-bold" style={{ borderColor: kami ? id.destaque : id.tinta }}>
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
                  style={{ borderColor: kami ? id.destaque : id.tinta, backgroundColor: id.papel, color: id.tinta, boxShadow: kami ? undefined : `6px 6px 0 ${id.tinta}` }}
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

      {territorio.credito && <p className="mx-auto max-w-[78rem] px-4 pb-8 font-sans text-xs sm:px-8">{territorio.credito}</p>}

      <footer className="border-t-2" style={{ borderColor: kami ? id.destaque : id.tinta }}>
        <div className="mx-auto flex max-w-[78rem] flex-wrap items-center gap-4 px-4 py-7 sm:px-8">
          <p className="min-w-[16rem] flex-1 font-serif text-2xl">{s.nextTitle}</p>
          <a href={`mailto:${site.newsletter}?subject=${encodeURIComponent(s.nextCta)}`} className={botao} style={{ borderColor: id.tinta, backgroundColor: id.tinta, color: id.fundo }}>{s.nextCta}</a>
          <Link href={to("/territorios")} className={botao} style={{ borderColor: id.tinta, color: id.tinta }}>{s.all}</Link>
        </div>
      </footer>
    </div>
  );
}
