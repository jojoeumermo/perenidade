// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "./o9.css";
import { useEffect, useState } from "react";
import { moderacaoDaComunidade, tempoEscrito, type AutomodDaComunidade } from "@/lib/rede/comunidade-moderacao";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaModeracao } from "@/lib/rede/textos-moderacao";
import { useTextosMod } from "./base";

/** As frases das regras do filtro e do modo lento, na ordem em que valem. Pura: o teste e a tela usam a mesma. */
export function frasesDasRegras(sm: TextosDaModeracao, r: AutomodDaComunidade): string[] {
  const t = sm.o9.regras;
  const frases: string[] = [];
  if (r.links_max !== null) frases.push(r.links_max === 0 ? t.links0 : preencher(t.linksN, { n: r.links_max }));
  if (r.dominios.length > 0) frases.push(preencher(t.dominios, { lista: r.dominios.join(", ") }));
  if (r.conta_nova_dias !== null && r.novatos_posts !== null) frases.push(preencher(t.contaNovaFila, { dias: r.conta_nova_dias, n: r.novatos_posts }));
  else if (r.conta_nova_dias !== null) frases.push(preencher(t.contaNova, { n: r.conta_nova_dias }));
  else if (r.novatos_posts !== null) frases.push(preencher(t.novatos, { n: r.novatos_posts }));
  if (r.palavras) frases.push(t.palavras);
  if (r.lento > 0) frases.push(preencher(t.lento, { tempo: tempoEscrito(sm.o9.tempo, r.lento) }));
  return frases;
}

/**
 * "Como esta comunidade modera": as regras do filtro automático, da fila de recém-chegados e do modo lento, escritas para quem
 * escreve ali (e para quem lê antes de entrar), com a explicação da moderação e o que vale para a própria pessoa agora. A lista
 * de palavras não aparece, só que existe. Quem junta pendura este cartão na aba Sobre da página da comunidade.
 */
export function RegrasDoLugar({ slug, lang }: { slug: string; lang: string }) {
  const sm = useTextosMod(lang);
  const [regras, setRegras] = useState<{ slug: string; dado: AutomodDaComunidade | null } | null>(null);
  useEffect(() => {
    let vivo = true;
    moderacaoDaComunidade.automod(slug).then(
      (dado) => vivo && setRegras({ slug, dado }),
      () => vivo && setRegras({ slug, dado: null }),
    );
    return () => {
      vivo = false;
    };
  }, [slug]);
  if (!sm || !regras || regras.slug !== slug || !regras.dado) return null;
  const r = regras.dado;
  const t = sm.o9.regras;
  const frases = frasesDasRegras(sm, r);
  return (
    <section className="m9 m9-regras" aria-labelledby={`m9-regras-${slug}`}>
      <h3 id={`m9-regras-${slug}`} className="m9-cond">{t.titulo}</h3>
      {frases.length === 0 ? <p className="m9-nota">{t.nada}</p> : (
        <ul>
          {frases.map((f) => <li key={f}>{f}</li>)}
        </ul>
      )}
      {r.explicacao && <blockquote>{r.explicacao}</blockquote>}
      {frases.length > 0 && <p className="m9-nota">{t.nadaApaga}</p>}
      {r.para_mim.novata && <p className="m9-para-mim">{t.novata}</p>}
      {r.para_mim.lento_falta > 0 && <p className="m9-para-mim">{preencher(t.falta, { tempo: tempoEscrito(sm.o9.tempo, r.para_mim.lento_falta) })}</p>}
    </section>
  );
}

export default RegrasDoLugar;
