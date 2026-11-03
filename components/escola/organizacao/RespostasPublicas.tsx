// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill } from "@/i18n/config";
import type { TextosDaOrganizacao } from "@/i18n/escola/organizacao";
import type { RespostaPublicaDaOuvidoria } from "@/lib/escola/banco";
import { respostasPublicas } from "./guardado-organizacao";

const MAX_RESPOSTAS = 200;

/**
 * As respostas públicas da ouvidoria (E4-12): até 200, com protocolo, assunto, data, resumo e resposta. Já vêm do banco
 * sem texto, contato ou página de quem escreveu. Sem serviço ou lista vazia, um estado vazio que ensina.
 */
export function RespostasPublicas({ s, assuntos }: { s: TextosDaOrganizacao["publicas"]; assuntos: TextosDaOrganizacao["ouvidoria"]["assuntos"] }) {
  const [estado, setEstado] = useState<"carregando" | "pronto">("carregando");
  const [lista, setLista] = useState<RespostaPublicaDaOuvidoria[]>([]);

  useEffect(() => {
    let vivo = true;
    void respostasPublicas().then((r) => {
      if (!vivo) return;
      setLista(r.slice(0, MAX_RESPOSTAS));
      setEstado("pronto");
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (estado === "carregando") return <p className="org-nota">{s.carregando}</p>;
  if (lista.length === 0)
    return (
      <p className="org-nota" data-publicas-vazio="">
        {s.vazio}
      </p>
    );
  return (
    <ul className="org-protocolos" data-publicas="">
      {lista.map((r) => (
        <li key={r.protocolo}>
          <p className="org-protocolo-codigo">{fill(s.protocolo, { protocolo: r.protocolo.toUpperCase() })}</p>
          <p className="org-nota">
            {assuntos[r.sobre] ?? r.sobre} · {fill(s.respondidaEm, { data: String(r.respondida_em).slice(0, 10) })}
          </p>
          <p>{r.resumo_publico}</p>
          <p className="org-nota">{r.resposta_publica}</p>
        </li>
      ))}
    </ul>
  );
}
