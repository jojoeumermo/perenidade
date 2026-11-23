// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Prompt 4, item 88 (atrás de "alumia-p4-pontes"): legendas ao vivo na sala de voz, só no aparelho. A opção só aparece quando o
// navegador garante o reconhecimento local (lib/rede/p4/pontes/legendas.ts); o texto fica só na tela, nada é gravado nem enviado.
import { useEffect, useRef, useState } from "react";
import { juntarLegenda, legendarFaixa, legendasNoAparelho, type LinhaDeLegenda } from "@/lib/rede/p4/pontes/legendas";
import { useTextosDasPontes } from "./usarTextos";

export interface FalaNaSala {
  usuario: string;
  audio: MediaStream | null;
}

export function LegendasDaSala({ participantes, nomes, lang }: { participantes: readonly FalaNaSala[]; nomes?: Record<string, string>; lang: string }) {
  const t = useTextosDasPontes(lang);
  const [pode, setPode] = useState<boolean | null>(null);
  const [ligadas, setLigadas] = useState(false);
  const [linhas, setLinhas] = useState<LinhaDeLegenda[]>([]);
  const paradas = useRef(new Map<string, () => void>());

  useEffect(() => {
    let vivo = true;
    legendasNoAparelho(lang).then((sim) => vivo && setPode(sim));
    return () => {
      vivo = false;
    };
  }, [lang]);

  // Liga uma legenda por faixa de quem está na sala; tira a de quem saiu; tudo para ao desligar ou sair da tela.
  useEffect(() => {
    const atuais = paradas.current;
    if (!ligadas) {
      atuais.forEach((parar) => parar());
      atuais.clear();
      return;
    }
    const presentes = new Set<string>();
    for (const p of participantes) {
      const faixa = p.audio?.getAudioTracks()[0];
      if (!faixa) continue;
      const chave = `${p.usuario}:${faixa.id}`;
      presentes.add(chave);
      if (atuais.has(chave)) continue;
      const quem = nomes?.[p.usuario] ?? "";
      atuais.set(chave, legendarFaixa(faixa, lang, (texto, final) => setLinhas((l) => juntarLegenda(l, { quem, texto, final, em: Date.now() }))));
    }
    for (const [chave, parar] of atuais) {
      if (!presentes.has(chave)) {
        parar();
        atuais.delete(chave);
      }
    }
  }, [ligadas, participantes, nomes, lang]);

  useEffect(() => {
    const atuais = paradas.current;
    return () => {
      atuais.forEach((parar) => parar());
      atuais.clear();
    };
  }, []);

  if (!t || pode === null) return null;
  if (!pode) return <p className="al-voz-sala-explica" data-p4-legendas="sem">{t.legendas.semSuporte}</p>;
  return (
    <div data-p4-legendas={ligadas ? "ligadas" : "desligadas"}>
      <button
        type="button"
        className="al-voz-botao"
        aria-pressed={ligadas}
        onClick={() => {
          setLigadas(!ligadas);
          setLinhas([]);
        }}
      >
        {ligadas ? t.legendas.desligar : t.legendas.ligar}
      </button>
      {ligadas && (
        <section aria-label={t.legendas.titulo} className="mt-2 rounded-xl bg-black/80 px-3 py-2 text-white">
          <p className="text-xs opacity-80">{t.legendas.ajuda}</p>
          <div aria-live="polite" className="text-lg leading-snug">
            {linhas.map((l, i) => (
              <p key={`${l.em}-${i}`} className={l.final ? "" : "opacity-80"}>
                <strong>{l.quem || t.legendas.alguem}:</strong> {l.texto}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
