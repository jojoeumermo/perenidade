// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill, localePath } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { hasBackend, rpc } from "@/lib/backend";
import type { Caderno, Fonte } from "@/lib/caderno";

type S = Dict["notebook"];
export interface ReferenciaDoSite {
  titulo: string;
  origem: string;
}
interface Pronto {
  id: string;
  titulo: string;
  descricao: string;
  fontes: ReferenciaDoSite[];
}

const elo = "cursor-pointer underline hover:text-oxblood";
export const enderecoDoSite = /^\/[a-z0-9/-]{1,200}$/;

/** O texto de uma página do site para o caderno: aulas têm a versão em texto puro; o resto, o índice da busca. */
export async function textoDoSite(lang: string, origem: string): Promise<{ titulo: string; texto: string } | null> {
  try {
    const r = await fetch(`${localePath(lang, origem)}/texto`);
    if (!r.ok) return null;
    const linhas = (await r.text()).split("\n");
    return { titulo: linhas[0]?.trim() || origem, texto: linhas.slice(2).join("\n").replace(/\n---\n[^\n]*\n?$/, "") };
  } catch {
    return null;
  }
}

/** Monta um caderno novo com as páginas do site pedidas (uma aula, a trilha inteira ou um caderno pronto). */
export async function montarCaderno(lang: string, titulo: string, referencias: ReferenciaDoSite[], novoId: () => string): Promise<Caderno> {
  const fontes: Fonte[] = [];
  for (const ref of referencias.filter((r) => enderecoDoSite.test(r.origem)).slice(0, 30)) {
    const lido = await textoDoSite(lang, ref.origem);
    if (lido) fontes.push({ id: novoId(), titulo: ref.titulo || lido.titulo, tipo: ref.origem.startsWith("/trilhas/") ? "aula" : "site", texto: lido.texto, origem: ref.origem, ativa: true });
  }
  return { id: novoId(), titulo: titulo.slice(0, 80), fontes, notas: "", criado: Date.now(), atualizado: Date.now() };
}

/** A lista pública dos cadernos prontos (montados por voluntários e revisados). */
export function CadernosProntos({ s, usar }: { s: S; usar: (titulo: string, fontes: ReferenciaDoSite[]) => void }) {
  const [lista, setLista] = useState<Pronto[]>([]);
  useEffect(() => {
    if (!hasBackend) return;
    let vivo = true;
    rpc<Pronto[]>("cadernos_prontos_listar")
      .then((r) => vivo && setLista(r))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  if (!lista.length) return null;
  return (
    <section className="border-2 border-ink bg-parchment-deep p-3">
      <p className="font-mono text-xs uppercase tracking-widest text-gold">{s.readyTitle}</p>
      <p className="mt-1 text-xs text-ink-soft">{s.readyLead}</p>
      <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto">
        {lista.map((c) => (
          <li key={c.id} className="border border-rule bg-parchment p-2">
            <p className="font-semibold">{c.titulo}</p>
            {c.descricao && <p className="text-xs text-ink-soft">{c.descricao}</p>}
            <p className="text-xs text-ink-soft">
              {fill(s.readySources, { n: c.fontes.length })} ·{" "}
              <button type="button" className={elo} onClick={() => usar(c.titulo, c.fontes)}>{s.readyUse}</button>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface NaFila extends Pronto {
  status: string;
  nota: string;
  autor: string;
}

/** No painel: publicar o caderno aberto como "caderno pronto" e, para quem revisa, a fila dos que esperam. */
export function PublicarCadernoPronto({ caderno }: { caderno: Caderno }) {
  const [aberto, setAberto] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [aviso, setAviso] = useState("");
  const [fila, setFila] = useState<NaFila[]>([]);
  const [volta, setVolta] = useState(0);
  const doSite = caderno.fontes.filter((f) => enderecoDoSite.test(f.origem));
  useEffect(() => {
    let vivo = true;
    rpc<NaFila[]>("cadernos_prontos_fila")
      .then((r) => vivo && setFila(r))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [volta]);
  async function enviar() {
    try {
      await rpc("caderno_pronto_enviar", { p: { titulo: caderno.titulo, descricao, fontes: doSite.map((f) => ({ titulo: f.titulo, origem: f.origem })) } });
      setAviso("Enviado para a revisão. Quando for publicado, aparece em Cadernos prontos para todo mundo.");
      setAberto(false);
      setVolta((v) => v + 1);
    } catch {
      setAviso("Não deu para enviar agora. Confira o título e se há fontes do site.");
    }
  }
  async function decidir(id: string, publicar: boolean) {
    const nota = publicar ? "" : (window.prompt("Recado para quem montou (por que não publicar):") ?? "");
    try {
      await rpc("caderno_pronto_decidir", { p_id: id, p_publicar: publicar, p_nota: nota });
      setVolta((v) => v + 1);
    } catch {
      setAviso("Não deu para decidir agora.");
    }
  }
  const paraRevisar = fila.filter((c) => c.status === "pendente");
  return (
    <section className="border-2 border-ink bg-parchment-deep p-3 text-xs">
      <p className="font-mono uppercase tracking-widest text-gold">Caderno pronto</p>
      {!aberto ? (
        <button type="button" className={`mt-2 ${elo}`} disabled={doSite.length === 0} onClick={() => setAberto(true)}>
          Publicar este caderno como “caderno pronto”
        </button>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-ink-soft">Vão as {doSite.length} fontes do site (textos colados e arquivos ficam de fora). Passa pela revisão antes de aparecer.</p>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={500} rows={2} placeholder="Para quem é e como usar (opcional)" className="w-full border border-rule bg-parchment px-2 py-1" />
          <button type="button" className="cursor-pointer bg-ink px-3 py-1.5 font-semibold text-parchment hover:bg-oxblood" onClick={() => void enviar()}>Enviar para a revisão</button>
        </div>
      )}
      {doSite.length === 0 && <p className="mt-1 text-ink-soft">Junte fontes do site (aulas, obras) para poder publicar.</p>}
      {paraRevisar.length > 0 && (
        <div className="mt-3">
          <p className="font-semibold">Esperando revisão</p>
          <ul className="mt-1 space-y-2">
            {paraRevisar.map((c) => (
              <li key={c.id} className="border border-rule bg-parchment p-2">
                <p className="font-semibold">{c.titulo}</p>
                <p className="text-ink-soft">{c.autor} · {c.fontes.map((f) => f.titulo).join(", ")}</p>
                <p className="mt-1 flex gap-3">
                  <button type="button" className={elo} onClick={() => void decidir(c.id, true)}>Publicar</button>
                  <button type="button" className={elo} onClick={() => void decidir(c.id, false)}>Não publicar</button>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {fila.some((c) => c.status !== "pendente") && (
        <ul className="mt-2 space-y-1 text-ink-soft">
          {fila.filter((c) => c.status !== "pendente").slice(0, 5).map((c) => (
            <li key={c.id}>{c.titulo}: {c.status === "publicado" ? "publicado" : c.status === "recusado" ? `não publicado${c.nota ? ` (${c.nota})` : ""}` : c.status}</li>
          ))}
        </ul>
      )}
      {aviso && <p className="mt-2" role="status">{aviso}</p>}
    </section>
  );
}
