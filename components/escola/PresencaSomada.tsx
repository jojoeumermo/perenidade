// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import type pt from "@/i18n/escola/presenca/pt.json";
import { hasBackend } from "@/lib/backend";
import { type PresencaDeHoje, presencaHoje } from "@/lib/escola/banco";

export type TextosDaPresenca = typeof pt;

/**
 * Presença somada (D1-14): frases sem pessoa e sem ranking, com as somas anônimas do banco (escola_presenca_hoje):
 * aulas abertas hoje, aulas terminadas nos últimos 7 dias e matrículas do mês. Um pedido por visita.
 * Sem o serviço, não ocupa espaço nenhum. Com ele, a altura de três linhas fica reservada desde o primeiro desenho, para
 * a página não pular quando os números chegam; linha com zero não aparece, e com tudo zero (ou falha) o espaço fica vazio.
 * Quem monta: a entrada da Escola (E4-08) e o quadro de avisos (E4-09). Textos em i18n/escola/presenca/*.json, lidos no
 * servidor e passados por `s`.
 */
export function PresencaSomada({ s, lang }: { s: TextosDaPresenca; lang: Locale }) {
  const [numeros, setNumeros] = useState<PresencaDeHoje | null>(null);

  useEffect(() => {
    if (!hasBackend) return;
    let vivo = true;
    void presencaHoje().then((r) => {
      if (vivo) setNumeros(r);
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (!hasBackend) return null;

  const formato = new Intl.NumberFormat(lang);
  const plural = new Intl.PluralRules(lang);
  const frase = (n: number, varios: string, um: string) => (plural.select(n) === "one" ? um : varios).replace("{n}", formato.format(n));
  const linhas = numeros
    ? [
        numeros.aulasHoje > 0 && frase(numeros.aulasHoje, s.abertas, s.abertasUma),
        numeros.aulasTerminadas7d > 0 && frase(numeros.aulasTerminadas7d, s.terminadas, s.terminadasUma),
        numeros.matriculasMes > 0 && frase(numeros.matriculasMes, s.matriculas, s.matriculasUma),
      ].filter((linha): linha is string => Boolean(linha))
    : [];

  return (
    // O rótulo só vai quando há frases: uma região vazia com nome viraria um marco mudo para o leitor de tela.
    <section aria-label={linhas.length > 0 ? s.rotulo : undefined} data-presenca-somada="" className="min-h-28 font-sans text-sm text-ink-soft">
      {linhas.length > 0 && (
        <>
          <ul className="space-y-1">
            {linhas.map((linha) => (
              <li key={linha}>{linha}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs">{s.nota}</p>
        </>
      )}
    </section>
  );
}
