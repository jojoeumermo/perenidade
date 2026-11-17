// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A etiqueta de quem escreveu, no cartão de um post de comunidade (encaixe `anexosDoCartao`): só a da lista fechada daquela
// comunidade, e só quando a pessoa escolheu ou aceitou. Os cartões de uma página pedem juntos: os ids que chegam em 40 ms vão
// numa chamada só, e a resposta fica na memória da aba até a página recarregar. Post fora de comunidade não pergunta nada.
import "./cargos.css";
import { useEffect, useState } from "react";
import type { ContextoDoEncaixe } from "../../encaixes";
import type { Post } from "@/lib/rede/tipos";
import { cargos, PREVIA_DOS_CARGOS } from "./cliente";
import { useTextosDosCargos } from "./usarTextos";

const guardadas = new Map<string, string | null>();
let fila: { id: string; avisar: (e: string | null) => void }[] = [];
let relogio: ReturnType<typeof setTimeout> | null = null;

function pedir(id: string): Promise<string | null> {
  if (guardadas.has(id)) return Promise.resolve(guardadas.get(id) ?? null);
  return new Promise((avisar) => {
    fila.push({ id, avisar });
    if (relogio) return;
    relogio = setTimeout(async () => {
      const lote = fila;
      fila = [];
      relogio = null;
      const ids = [...new Set(lote.map((x) => x.id))].slice(0, 100);
      let resposta: { post: string; etiqueta: string }[] = [];
      try {
        resposta = await cargos.etiquetasDosPosts(ids);
      } catch {
        // Sem a resposta, nenhuma etiqueta: o cartão fica como estava.
      }
      for (const id of ids) guardadas.set(id, resposta.find((r) => r.post === id)?.etiqueta ?? null);
      for (const x of lote) x.avisar(guardadas.get(x.id) ?? null);
    }, 40);
  });
}

export default function EtiquetaNoCartao({ lang, post }: ContextoDoEncaixe & { post: Post }) {
  const t = useTextosDosCargos(lang);
  const naComunidade = Boolean(post.comunidade) && !PREVIA_DOS_CARGOS;
  const [etiqueta, setEtiqueta] = useState<string | null>(() => guardadas.get(post.id) ?? null);
  useEffect(() => {
    if (!naComunidade) return;
    let vivo = true;
    pedir(post.id).then((e) => vivo && setEtiqueta(e));
    return () => {
      vivo = false;
    };
  }, [naComunidade, post.id]);
  if (!t || !naComunidade || !etiqueta) return null;
  return (
    <p className="cg-etiqueta-cartao">
      <span className="cg-so-leitor">{t.cartao.rotulo}: </span>
      <span className="cg-etiqueta-ficha al-cond">{etiqueta}</span>
    </p>
  );
}
