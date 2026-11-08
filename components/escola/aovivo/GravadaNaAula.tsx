// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { TextosDoAoVivo } from "@/i18n/escola/aovivo";
import { lerGravacoes } from "@/lib/escola/aovivo";
import type { AulaAoVivoDaEscola } from "@/lib/escola/contratos";
import { preencher } from "@/lib/escola/textos";
import { TocadorDaEscola } from "./TocadorDaEscola";
import "./aovivo.css";

/**
 * "Aula gravada" dentro da aula do caderno: as aulas ao vivo da Escola ligadas a esta aula ("caderno/aula") que já
 * terminaram com vídeo no YouTube (escola_gravacoes, só militante). Sem gravação, ou sem a função no banco, nada aparece.
 * A mais nova toca aqui; as outras viram botões que trocam o vídeo.
 */
export function GravadaNaAula({ cadernoAula, lang, t }: { cadernoAula: string; lang: Locale; t: TextosDoAoVivo["gravacao"] & { assistir: string; aviso: string } }) {
  const [gravacoes, setGravacoes] = useState<AulaAoVivoDaEscola[]>([]);
  const [escolhida, setEscolhida] = useState(0);
  useEffect(() => {
    let vivo = true;
    void lerGravacoes(cadernoAula).then((lido) => vivo && lido.ok && setGravacoes(lido.dados.filter((g) => g.youtube)));
    return () => {
      vivo = false;
    };
  }, [cadernoAula]);

  if (gravacoes.length === 0) return null;
  const atual = gravacoes[Math.min(escolhida, gravacoes.length - 1)];
  const dia = (iso: string) => new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : lang, { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
  return (
    <section aria-labelledby="ea-gravada-titulo" className="ea-gravada">
      <h2 id="ea-gravada-titulo" className="ef-t">
        {t.titulo}
      </h2>
      <p>
        {t.texto} {preencher(t.de, { dia: dia(atual.inicio) })}.
      </p>
      <TocadorDaEscola key={atual.id} id={atual.youtube} titulo={atual.titulo} lang={lang} aoVivo={false} textos={{ assistir: t.assistir, aviso: t.aviso, semVideo: "" }} />
      <p className="ea-nao-repasse">{t.naoRepasse}</p>
      {gravacoes.length > 1 && (
        <ul aria-label={t.outras}>
          {gravacoes.map((g, i) => (
            <li key={g.id}>
              <button type="button" className={i === escolhida ? "ef-botao-ouro" : "ef-botao-vazado"} aria-pressed={i === escolhida} onClick={() => setEscolhida(i)} style={{ minHeight: 42 }}>
                {dia(g.inicio)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
