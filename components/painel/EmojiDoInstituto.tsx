// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

import { EMOJIS_DO_INSTITUTO } from "@/lib/emojis-do-instituto";

/** Um emoji do instituto (lib/emojis-do-instituto.ts), desenhado no traço da casa. */
export function EmojiDoInstituto({ nome, className = "h-5 w-5" }: { nome: string; className?: string }) {
  const e = EMOJIS_DO_INSTITUTO[nome];
  if (!e) return <span>:{nome}:</span>;
  return (
    <svg role="img" aria-label={e.nome} viewBox="0 0 24 24" className={className} fill={e.cheio ? e.cor : "none"} stroke={e.cheio ? "none" : e.cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <title>{e.nome}</title>
      <path d={e.desenho} />
    </svg>
  );
}

/** Uma reação: o emoji de sempre, ou o desenho quando é um emoji do instituto (":estrela:"). */
export function EmojiDaReacao({ emoji, className = "h-[1.1em] w-[1.1em] inline-block align-[-0.15em]" }: { emoji: string; className?: string }) {
  if (/^:[a-z]+:$/.test(emoji)) return <EmojiDoInstituto nome={emoji.slice(1, -1)} className={className} />;
  return <>{emoji}</>;
}
