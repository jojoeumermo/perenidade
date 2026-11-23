// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A criação coletiva (/alumia/criacao; Prompt 4, itens 33, 34, 36 e 37), atrás de "alumia-p4-criacao-coletiva":
//   - rascunhos coletivos de nota ou manifesto (33) e a margem das páginas do acervo (34), só para quem é da comunidade;
//   - o estúdio de cartaz e lambe-lambe (36), desenhado neste aparelho;
//   - a zine A4 dobrável (37), montada neste aparelho.
// A aba aberta, a comunidade e a página ficam no endereço (?aba=, ?c=, ?p=), para voltar e para mandar o link a quem é da comunidade.
import "./criacao.css";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import type { PropsDaTelaDoPacote } from "../registro";
import { Cartaz } from "./Cartaz";
import { Margem } from "./Margem";
import { useTextosDaCriacao } from "./usarTextos";
import { Zine } from "./Zine";

type Aba = "margem" | "cartaz" | "zine";
const ABAS: readonly Aba[] = ["margem", "cartaz", "zine"];

export default function TelaDaCriacaoColetiva({ lang }: PropsDaTelaDoPacote) {
  const t = useTextosDaCriacao(lang);
  const busca = useSearchParams();
  const router = useRouter();
  const id = useId();
  const pedida = busca.get("aba") as Aba | null;
  const [aba, setAba] = useState<Aba>(pedida && ABAS.includes(pedida) ? pedida : "margem");
  const endereco = (a: Aba, c: string | null = null, p: string | null = null) => {
    const q = new URLSearchParams();
    if (a !== "margem") q.set("aba", a);
    if (c) q.set("c", c);
    if (p) q.set("p", p);
    const s = q.toString();
    router.replace(`/${lang}/alumia/criacao${s ? `?${s}` : ""}`, { scroll: false });
  };
  if (!t) return <div className="cc-pagina" aria-busy="true" />;
  return (
    <div className="cc-pagina">
      <header className="cc-cabeca">
        <h1 className="al-cond">{t.titulo}</h1>
        <p className="cc-chamada">{t.chamada}</p>
      </header>
      <div className="cc-abas" role="tablist" aria-label={t.abas.rotulo}>
        {ABAS.map((a) => (
          <button key={a} type="button" role="tab" id={`${id}-${a}`} aria-selected={aba === a} aria-controls={`${id}-painel`} className="cc-aba"
            onClick={() => { setAba(a); endereco(a); }}>
            {t.abas[a]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-painel`} aria-labelledby={`${id}-${aba}`}>
        {aba === "margem" && <Margem t={t} lang={lang} inicial={{ c: busca.get("c") ?? undefined, p: busca.get("p") ?? undefined }} aoMudar={(c, p) => endereco("margem", c, p)} />}
        {aba === "cartaz" && <Cartaz t={t} />}
        {aba === "zine" && <Zine t={t} />}
      </div>
    </div>
  );
}
