// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fill } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { areaSlugs } from "@/lib/areas";
import { hasBackend, rpc } from "@/lib/backend";
import { enderecoDoVideo, relogio } from "@/lib/videoaula";
import { Comentarios } from "./Comentarios";
import { EstadoVazio } from "./EstadoVazio";
import { L, useI18n } from "./I18n";
import { useTrackOptions } from "./useTrackOptions";
import { TocadorYoutube } from "./TocadorYoutube";
import { VideoPlayer } from "./VideoPlayer";

/** Uma aula em vídeo como o site recebe: sem nota, situação nem dados de quem revisou. */
interface Aula {
  id: string;
  disciplina: string;
  trilha: string | null;
  titulo: string;
  descricao: string;
  nome_autor: string;
  caminho: string;
  duracao: number;
  revisado_em: string | null;
  tem_legenda: boolean;
  tem_transcricao: boolean;
  transcricao?: string;
  legenda?: string;
  fontes?: { titulo: string; autor?: string; url?: string }[];
  /** A cópia no canal do instituto no YouTube, quando já está liberada. */
  youtube?: string | null;
}

type Estado<T> = { dados: T | null; falhou: boolean };
/** Os textos desta parte do site chegam como propriedade: só os textos comuns viajam para todas as páginas. */
type Textos = Dict["videoLessons"];

/** As aulas no ar, de uma disciplina ou de todas. */
function useAulas(disciplina: string | null): Estado<Aula[]> {
  const [estado, setEstado] = useState<Estado<Aula[]> & { de: string | null }>({ dados: null, falhou: false, de: null });
  useEffect(() => {
    let vivo = true;
    if (!hasBackend) return;
    rpc<Aula[]>("videoaulas_publicas", { p_disciplina: disciplina })
      .then((lista) => vivo && setEstado({ dados: Array.isArray(lista) ? lista : [], falhou: false, de: disciplina }))
      .catch(() => vivo && setEstado({ dados: null, falhou: true, de: disciplina }));
    return () => {
      vivo = false;
    };
  }, [disciplina]);
  if (!hasBackend) return { dados: [], falhou: false };
  // Enquanto a lista nova não chega, não mostra a da disciplina anterior.
  return estado.de === disciplina ? estado : { dados: null, falhou: false };
}

function Cartao({ aula, ativa, s }: { aula: Aula; ativa?: boolean; s: Textos }) {
  const { t } = useI18n();
  const nome = t.areas[aula.disciplina as keyof typeof t.areas]?.[0] ?? aula.disciplina;
  return (
    <li className={`border-2 p-4 ${ativa ? "border-oxblood bg-parchment-deep" : "border-ink"}`}>
      <p className="font-mono text-xs text-gold">
        {nome} · {relogio(aula.duracao)}
        {aula.tem_legenda ? " · CC" : ""}
      </p>
      <L href={`/videoaulas?v=${aula.id}`} scroll={false} className="mt-1 block font-serif text-xl font-semibold leading-snug hover:text-oxblood" lang="pt-BR" aria-current={ativa ? "true" : undefined}>
        {aula.titulo}
      </L>
      <p className="mt-1 font-sans text-sm text-ink-soft">{fill(s.by, { name: aula.nome_autor })}</p>
    </li>
  );
}

/** A aula aberta: o tocador, a descrição, a trilha e as fontes. */
function Aberta({ id, s }: { id: string; s: Textos }) {
  const { lang, t } = useI18n();
  const tracks = useTrackOptions(lang);
  const [aula, setAula] = useState<{ de: string; aula: Aula | null; endereco: string } | null>(null);
  // Com cópia no YouTube, o tocador dele vem primeiro (não gasta a cota de transferência do instituto); a cópia do
  // instituto fica a um clique, para quem não quer o Google e para quando o YouTube sair do ar.
  const [daCasa, setDaCasa] = useState(false);
  useEffect(() => {
    let vivo = true;
    rpc<Aula | null>("videoaula_ver", { p_id: id })
      .then(async (dados) => {
        const endereco = dados ? await enderecoDoVideo(dados.caminho) : "";
        if (vivo) setAula({ de: id, aula: dados, endereco });
      })
      .catch(() => vivo && setAula({ de: id, aula: null, endereco: "" }));
    return () => {
      vivo = false;
    };
  }, [id]);
  if (!aula || aula.de !== id) return <p className="mt-8 font-sans text-ink-soft" role="status">{s.loading}</p>;
  if (!aula.aula || !aula.endereco) return <p className="mt-8 font-sans text-oxblood" role="alert">{s.failed}</p>;
  const a = aula.aula;
  const trilha = a.trilha ? tracks.find((track) => track.slug === a.trilha) : null;
  return (
    <article className="mt-8" aria-labelledby="aula-aberta">
      <h2 id="aula-aberta" className="font-serif text-3xl font-semibold" lang="pt-BR">{a.titulo}</h2>
      <p className="mt-1 mb-4 font-sans text-sm text-ink-soft">
        {fill(s.by, { name: a.nome_autor })} · {t.areas[a.disciplina as keyof typeof t.areas]?.[0] ?? a.disciplina}
        {trilha && (
          <>
            {" · "}
            {s.track}:{" "}
            <L href={`/trilhas/${trilha.slug}`} className="underline hover:text-oxblood">{trilha.title}</L>
          </>
        )}
      </p>
      <div lang="pt-BR">
        {a.youtube && !daCasa ? (
          <>
            <TocadorYoutube id={a.youtube} titulo={a.titulo} textos={{ assistir: s.youtubeWatch, aviso: s.youtubeNote }} />
            <p className="mt-2 font-sans text-sm">
              <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => setDaCasa(true)}>{s.ownCopy}</button>
            </p>
            {a.transcricao && (
              <details className="mt-3">
                <summary className="cursor-pointer font-sans text-sm font-semibold">{s.transcriptTitle}</summary>
                <div className="mt-2 max-h-96 overflow-y-auto border-l-2 border-gold pl-4 whitespace-pre-line">{a.transcricao}</div>
              </details>
            )}
          </>
        ) : (
          <>
            <VideoPlayer src={aula.endereco} titulo={a.titulo} legenda={a.legenda || undefined} transcricao={a.transcricao || undefined} labels={s.player} />
            {a.youtube && (
              <p className="mt-2 font-sans text-sm">
                <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => setDaCasa(false)}>{s.backToYoutube}</button>
              </p>
            )}
          </>
        )}
      </div>
      {a.descricao && <p className="mt-4 whitespace-pre-line text-lg" lang="pt-BR">{a.descricao}</p>}
      {a.fontes && a.fontes.length > 0 && (
        <section className="mt-6 border-t border-rule pt-4 font-sans text-sm">
          <h3 className="font-mono text-xs uppercase tracking-widest text-gold">{s.sources}</h3>
          <ul className="mt-2 space-y-1 text-ink-soft">
            {a.fontes.map((fonte) => (
              <li key={`${fonte.titulo}${fonte.url ?? ""}`}>
                {fonte.autor && `${fonte.autor}. `}
                {fonte.url ? (
                  <a href={fonte.url} target="_blank" rel="noopener noreferrer" className="italic underline hover:text-oxblood">{fonte.titulo}</a>
                ) : (
                  <span className="italic">{fonte.titulo}</span>
                )}
                .
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-4 font-sans text-sm text-ink-soft">{t.lesson.license}</p>
      <Comentarios videoaula={a.id} s={s.comments} />
    </article>
  );
}

/** A página das aulas em vídeo: o filtro por disciplina, a aula aberta (?v=) e a lista. */
export function VideoaulasPublicas({ s }: { s: Textos }) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const aberta = params.get("v");
  const pedida = params.get("disciplina");
  const disciplina = pedida && (areaSlugs as readonly string[]).includes(pedida) ? pedida : null;
  const { dados, falhou } = useAulas(disciplina);

  // Ao abrir uma aula, a página sobe até o tocador.
  useEffect(() => {
    if (aberta) document.getElementById("tocador")?.scrollIntoView({ block: "start" });
  }, [aberta]);

  return (
    <div>
      {lang !== "pt" && <p className="mt-4 font-sans text-sm text-ink-soft">{s.inPortuguese}</p>}
      <div id="tocador" className="scroll-mt-6">
        {aberta && <Aberta id={aberta} s={s} />}
      </div>
      <label className="mt-10 flex flex-wrap items-center gap-3 font-sans text-sm">
        <span className="font-mono text-xs uppercase tracking-widest text-gold">{s.filter}</span>
        <select
          value={disciplina ?? ""}
          onChange={(e) => router.replace(`?${e.target.value ? `disciplina=${e.target.value}` : ""}`, { scroll: false })}
          className="border-2 border-ink bg-parchment-deep px-3 py-2"
        >
          <option value="">{s.all}</option>
          {areaSlugs.map((area) => (
            <option key={area} value={area}>
              {t.areas[area][0]}
            </option>
          ))}
        </select>
      </label>
      {falhou && <p className="mt-6 font-sans text-oxblood" role="alert">{s.failed}</p>}
      {!falhou && dados === null && <p className="mt-6 font-sans text-ink-soft" role="status">{s.loading}</p>}
      {dados?.length === 0 && <EstadoVazio textos={t.lists.empty.videoaulas} acaoHref="/voluntarios" relacionadoHref="/videos" />}
      {dados && dados.length > 0 && (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {dados.map((aula) => (
            <Cartao key={aula.id} aula={aula} ativa={aula.id === aberta} s={s} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Na estante da disciplina: as aulas em vídeo dela, com o caminho para a página das aulas. */
export function VideoaulasDaDisciplina({ disciplina, s }: { disciplina: string; s: Textos }) {
  const { dados, falhou } = useAulas(disciplina);
  return (
    <section id="aulas-em-video" className="scroll-mt-6">
      <h2 className="mt-12 border-b border-rule pb-3 text-3xl font-semibold">{s.title}</h2>
      <p className="mt-3 max-w-3xl text-ink-soft">{s.shelfLead}</p>
      {falhou && <p className="mt-4 font-sans text-oxblood">{s.failed}</p>}
      {dados && dados.length > 0 ? (
        <>
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {dados.slice(0, 6).map((aula) => (
              <Cartao key={aula.id} aula={aula} s={s} />
            ))}
          </ul>
          <p className="mt-4 font-sans text-sm">
            <L href={`/videoaulas?disciplina=${disciplina}`} className="underline hover:text-oxblood">{s.back} →</L>
          </p>
        </>
      ) : (
        dados && (
          <p className="mt-4 text-lg text-ink-soft">
            {s.empty} <L href="/voluntarios" className="underline hover:text-oxblood">{s.join}</L>
          </p>
        )
      )}
    </section>
  );
}
