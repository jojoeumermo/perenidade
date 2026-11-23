// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Prompt 4, item 83: o cartão de vídeo ou áudio de um post de fora. A miniatura já veio pela rota-proxy (MidiaDeFora); aqui só o
// rótulo (de que servidor é) e o link para o site de origem, com o aviso honesto de que lá o servidor vê o acesso.
import { cartaoDeMidia, type MidiaParaOCartao } from "@/lib/rede/p4/pontes/midia-de-fora";
import { por } from "./textos";
import { useTextosDasPontes } from "./usarTextos";

export function CartaoDeMidiaDeFora({ post, lang }: { post: { midia?: readonly MidiaParaOCartao[] | null; servidor: string; url?: string | null }; lang: string }) {
  const c = cartaoDeMidia(post);
  const t = useTextosDasPontes(lang, !!c);
  if (!c || !t) return null;
  const rotulo = por(c.tipo === "video" ? t.midia.video : t.midia.audio, { servidor: c.servidor });
  return (
    <div className="mt-2 rounded-xl border border-[var(--al-superficie-2)] bg-[var(--al-superficie)] px-3 py-2 text-sm" data-p4-midia={c.tipo}>
      <p className="font-semibold text-[var(--al-texto)]">{rotulo}</p>
      {c.pagina ? (
        <a href={c.pagina} rel="noopener noreferrer nofollow" referrerPolicy="no-referrer" target="_blank" className="inline-flex min-h-[44px] items-center font-semibold underline">
          {c.tipo === "video" ? t.midia.abrir : t.midia.ouvir}
        </a>
      ) : null}
      <p className="text-[0.8125rem] text-[var(--al-texto-2)]">{t.midia.aviso}</p>
    </div>
  );
}
