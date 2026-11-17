// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A marca pequena ao lado do @ de quem escolheu aparecer com nome e foto. Diz duas coisas a quem lê: que foi escolha da pessoa e
// que a Alumia não confere documento (o nome é declarado). Só é desenhada, e só baixa os textos, quando o @ está em público.
import { useIdentidadePublica } from "@/lib/rede/fotos-publicas";
import { useTextosDaIdentidade } from "./textos";
import "./identidade.css";

function Marca({ lang }: { lang: string }) {
  const t = useTextosDaIdentidade(lang);
  if (!t) return null;
  return (
    <span className="ali-selo" title={t.selo.titulo}>
      <svg aria-hidden viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
        <circle cx="12" cy="8.5" r="4" />
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
      </svg>
      {t.selo.rotulo}
      <span className="sr-only">. {t.selo.titulo}</span>
    </span>
  );
}

export function SeloDeIdentidade({ handle, lang }: { handle: string; lang: string }) {
  const publica = useIdentidadePublica(handle);
  return publica ? <Marca lang={lang} /> : null;
}
