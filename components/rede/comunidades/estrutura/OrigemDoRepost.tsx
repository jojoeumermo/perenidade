// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { estrutura as cliente } from "@/lib/rede/estrutura/cliente";
import type { OrigemDoRepost as Origem } from "@/lib/rede/estrutura/tipos";
import { preencher } from "@/lib/rede/preencher";
import { enderecos, type Post } from "@/lib/rede/tipos";
import type { ContextoDoEncaixe } from "../../encaixes";
import { useTextosEstrutura } from "./base";
import "./estrutura.css";

// Os cartões da linha pedem a origem juntos: os ids que chegam no mesmo instante vão numa chamada só (até 50), e a resposta fica
// guardada por post enquanto a aba vive.
const guardadas = new Map<string, Origem | null>();
let fila: { id: string; avisar: (o: Origem | null) => void }[] = [];
let marcada = false;

function pedirOrigem(id: string): Promise<Origem | null> {
  if (guardadas.has(id)) return Promise.resolve(guardadas.get(id) ?? null);
  return new Promise((avisar) => {
    fila.push({ id, avisar });
    if (marcada) return;
    marcada = true;
    queueMicrotask(() => {
      const todos = fila;
      fila = [];
      marcada = false;
      for (let i = 0; i < todos.length; i += 50) {
        const lote = todos.slice(i, i + 50);
        cliente.origens([...new Set(lote.map((x) => x.id))]).then(
          (lista) => {
            for (const x of lote) {
              const o = lista.find((r) => r.post === x.id) ?? null;
              guardadas.set(x.id, o);
              x.avisar(o);
            }
          },
          () => lote.forEach((x) => x.avisar(null)),
        );
      }
    });
  });
}

/**
 * Embaixo do texto do cartão (encaixe anexosDoCartao): "Trazido de Moradia Zona Leste" num post levado de outra comunidade. Só
 * pergunta ao banco quando o post cita outro e está numa comunidade; nunca diz quem trouxe.
 */
export function OrigemDoRepost({ lang, post }: ContextoDoEncaixe & { post: Post }) {
  const candidato = Boolean(post.citado && post.comunidade);
  const te = useTextosEstrutura(lang, candidato);
  const [origem, setOrigem] = useState<Origem | null>(candidato ? (guardadas.get(post.id) ?? null) : null);

  useEffect(() => {
    if (!candidato) return;
    let vivo = true;
    void pedirOrigem(post.id).then((o) => vivo && setOrigem(o));
    return () => {
      vivo = false;
    };
  }, [candidato, post.id]);

  if (!te || !origem) return null;
  const o = te.origem;
  return (
    <p className="e10-origem">
      <span aria-hidden>↪</span>
      {origem.origem ? (
        <span>
          {preencher(o.trazido, { nome: "" }).trim()}{" "}
          <Link href={enderecos.comunidade(lang, origem.origem.slug)}>{origem.origem.nome}</Link>
        </span>
      ) : origem.restrita ? (
        <span>{o.restrita}</span>
      ) : (
        <span>{o.perfil}</span>
      )}
    </p>
  );
}

export default OrigemDoRepost;
