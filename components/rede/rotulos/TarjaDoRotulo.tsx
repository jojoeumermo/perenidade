// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A tarja no cartão do post, só para quem assina algum rotulador: "Marcado por <rotulador> · <rótulo>". O banco devolve só as marcas
// dos rotuladores que esta pessoa assina, nunca nos posts dela, e nunca diz quem marcou. Os cartões de uma página pedem juntos: os
// ids que chegam em 40 ms vão numa chamada só, e a resposta fica guardada na memória da aba até a página recarregar.
import "./rotulos.css";
import { useEffect, useState } from "react";
import type { ContextoDoEncaixe } from "../encaixes";
import type { Post } from "@/lib/rede/tipos";
import { type MarcaNoPost, rotulos } from "./cliente";
import { por, type TextosDosRotulos } from "./textos";
import { useTextosDosRotulos } from "./usarTextos";

const guardadas = new Map<string, MarcaNoPost[]>();
let fila: { id: string; avisar: (m: MarcaNoPost[]) => void }[] = [];
let relogio: ReturnType<typeof setTimeout> | null = null;

function pedir(id: string): Promise<MarcaNoPost[]> {
  const ja = guardadas.get(id);
  if (ja) return Promise.resolve(ja);
  return new Promise((avisar) => {
    fila.push({ id, avisar });
    if (relogio) return;
    relogio = setTimeout(async () => {
      const lote = fila;
      fila = [];
      relogio = null;
      const ids = [...new Set(lote.map((x) => x.id))].slice(0, 100);
      let resposta: { post: string; marcas: MarcaNoPost[] }[] = [];
      try {
        resposta = await rotulos.dosPosts(ids);
      } catch {
        // Sem a resposta, nenhuma tarja: o cartão fica como estava.
      }
      for (const id of ids) guardadas.set(id, resposta.find((r) => r.post === id)?.marcas ?? []);
      for (const x of lote) x.avisar(guardadas.get(x.id) ?? []);
    }, 40);
  });
}

function Tarja({ t, marcas }: { t: TextosDosRotulos["rotulos"]; marcas: MarcaNoPost[] }) {
  return (
    <div className="rt-tarja" role="note" aria-label={t.tarjaRotulo}>
      {marcas.map((m) => (
        <span key={`${m.rotulador}-${m.rotulo}`} style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem" }}>
          <strong>{por(t.tarja, { nome: m.tipo === "mediacao" ? t.mediacao : (m.nome ?? "") })}</strong>
          <span className="rt-selo rt-selo-rotulo al-cond">{t.nomes[m.rotulo].nome}</span>
          {m.da_conta && <span>({t.tarjaConta})</span>}
          {m.contestado && <span className="rt-selo rt-selo-dourado al-cond">{t.tarjaContestada}</span>}
        </span>
      ))}
    </div>
  );
}

/** O anexo do cartão (encaixe `anexosDoCartao`): nada para quem não é membro, nada sem marca. */
export default function TarjaDoRotulo({ lang, situacao, post }: ContextoDoEncaixe & { post: Post }) {
  const t = useTextosDosRotulos(lang);
  const membro = situacao.logado && situacao.membro && !situacao.suspenso;
  const [marcas, setMarcas] = useState<MarcaNoPost[]>(() => guardadas.get(post.id) ?? []);
  useEffect(() => {
    if (!membro) return;
    let vivo = true;
    pedir(post.id).then((m) => vivo && setMarcas(m));
    return () => {
      vivo = false;
    };
  }, [membro, post.id]);
  if (!t || !membro || marcas.length === 0) return null;
  return <Tarja t={t.rotulos} marcas={marcas} />;
}
