// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 43. "Neste dia na luta" no topo da linha da Alumia: o mesmo "Neste dia" do site (app/api/neste-dia), com o fato de luta do dia.
// O aparelho só fala com o nosso servidor (/api/neste-dia), que busca a Wikipédia com cache e põe primeiro a lista da equipe;
// nunca pede nada à Wikipédia direto. "Fechar por hoje" fica só neste aparelho (a data de hoje, nada mais). O link do fato abre
// sem levar de onde veio.
import "./memoria.css";
import { useEffect, useState } from "react";
import type { ContextoDoEncaixe } from "../encaixes";
import { CHAVE_DO_QUADRO, chaveDoDia, fatoDoDiaNaLuta, type FatoDaLuta } from "@/lib/rede/memoria/regras";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import { useTextosDaMemoria } from "./textos";

function guarda(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function fechadoHoje(dia: string): boolean {
  try {
    return guarda()?.getItem(CHAVE_DO_QUADRO) === dia;
  } catch {
    return false;
  }
}

export default function NesteDiaNaLuta({ lang }: ContextoDoEncaixe) {
  const t = useTextosDaMemoria(lang);
  const [dia] = useState(() => chaveDoDia());
  const [fechado, setFechado] = useState(() => fechadoHoje(dia));
  const [fato, setFato] = useState<FatoDaLuta | null>(null);

  useEffect(() => {
    if (fechado) return;
    let vivo = true;
    fetch(`/api/neste-dia?lang=${encodeURIComponent(lang)}`, { credentials: "omit" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: unknown) => vivo && setFato(fatoDoDiaNaLuta(d)))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang, fechado]);

  if (!t || fechado || !fato) return null;

  function fechar() {
    try {
      guarda()?.setItem(CHAVE_DO_QUADRO, dia);
    } catch {
      // Sem armazenamento: fecha só nesta visita.
    }
    setFechado(true);
  }

  return (
    <aside className="ml-quadro" aria-labelledby="ml-neste-dia">
      <h2 id="ml-neste-dia">{t.neste.titulo}{fato.dia ? ` · ${preencher(t.neste.outroDia, { dia: fato.dia })}` : ""}</h2>
      <p><strong>{fato.ano}.</strong> {fato.texto}</p>
      <div className="ml-acoes">
        <a href={fato.link} target="_blank" rel="noopener noreferrer nofollow">{t.neste.fonte}</a>
        <Botao variante="fantasma" tamanho="p" onClick={fechar}>{t.neste.fechar}</Botao>
      </div>
    </aside>
  );
}
