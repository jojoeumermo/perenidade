// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/i18n/types";
import { hasBackend, rpc } from "@/lib/backend";
import { useCompleted } from "@/lib/progress";
import { site } from "@/lib/site";
import { useHydrated } from "@/lib/storage";

const codigoBonito = (codigo: string) => codigo.replace(/(.{4})(?=.)/g, "$1-");
const quando = (iso: string) => `${new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })} (Brasília)`;

export interface CertificadoDeAluno {
  codigo: string;
  nome: string;
  trilha: string;
  aulas: number;
  emitido_em: string;
}

/**
 * A folha do certificado de participação de quem estuda: a mesma folha A4 deitada do certificado de voluntariado
 * (emblema, moldura, marca-d'água, assinatura eletrônica, número para conferir). É sempre um documento em português.
 */
export function FolhaDoAluno({ c }: { c: CertificadoDeAluno }) {
  const endereco = `${site.url.replace(/^https?:\/\//, "")}/pt/certificado`;
  return (
    <article className="certificado" lang="pt-BR" translate="no">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/marca.png" alt="" className="certificado-fundo" />
      <div className="certificado-folha">
        <header>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca.png" alt="" className="certificado-emblema" />
          <p className="certificado-casa">{site.name}</p>
          <h2 className="certificado-titulo">Certificado</h2>
          <p className="certificado-subtitulo">de participação</p>
        </header>
        <div className="certificado-corpo">
          <p>O {site.name}, projeto educacional gratuito e sem fins lucrativos, certifica que</p>
          <p className="certificado-nome">{c.nome}</p>
          <p>
            concluiu a trilha de estudos <strong>“{c.trilha}”</strong>, com <strong>{c.aulas} {c.aulas === 1 ? "aula" : "aulas"}</strong>, na escola popular e gratuita do instituto.
          </p>
          <p className="certificado-lei">Certificado de participação em curso livre, emitido pela conclusão de todas as aulas da trilha.</p>
        </div>
        <ul className="certificado-assinaturas" style={{ gridTemplateColumns: "1fr" }}>
          <li style={{ width: "40%", margin: "0 auto" }}>
            <span className="certificado-selo">Emitido eletronicamente em {quando(c.emitido_em)}</span>
            <span className="certificado-assina">{site.name}</span>
            <span className="certificado-cargo">Escola popular e gratuita</span>
          </li>
        </ul>
        <footer>
          <p>
            Certificado nº {codigoBonito(c.codigo)} · emitido em {new Date(c.emitido_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · confira a autenticidade em {endereco}
          </p>
        </footer>
      </div>
    </article>
  );
}

/**
 * O selo de trilha concluída e o certificado de participação. O progresso é o do aparelho; o certificado guarda no site
 * só o nome escrito pela pessoa, a trilha e a data, para o número poder ser conferido em /certificado.
 */
export function CertificadoDaTrilha({ ids, trilha, titulo, s }: { ids: string[]; trilha: string; titulo: string; s: Dict["tracks"] }) {
  const hidratado = useHydrated();
  const feitas = useCompleted();
  const [nome, setNome] = useState("");
  const [estado, setEstado] = useState<"" | "ocupado" | "erro">("");
  const [pronto, setPronto] = useState<CertificadoDeAluno | null>(null);
  useEffect(() => {
    if (!pronto) return;
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setPronto(null);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [pronto]);
  const concluida = ids.length > 0 && ids.every((id) => feitas.has(id));
  if (!hidratado || !concluida) return null;

  async function emitir() {
    setEstado("ocupado");
    try {
      const { codigo, emitido_em } = await rpc<{ codigo: string; emitido_em: string }>("certificado_aluno_emitir", { p_nome: nome.trim(), p_trilha: trilha, p_titulo: titulo, p_aulas: ids.length });
      setPronto({ codigo, emitido_em, nome: nome.trim(), trilha: titulo, aulas: ids.length });
      setEstado("");
    } catch {
      setEstado("erro");
    }
  }

  return (
    <section className="mt-8 border-2 border-ok bg-parchment-deep p-5 font-sans text-sm">
      <p className="text-lg font-semibold text-ok">✓ {s.badge}</p>
      <p className="mt-1 text-ink-soft">{s.certLead}</p>
      {hasBackend && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block">
            {s.certName}
            <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} className="mt-1 block w-72 max-w-full border-2 border-ink bg-parchment px-3 py-2" />
          </label>
          <button type="button" disabled={nome.trim().length < 3 || estado === "ocupado"} onClick={() => void emitir()} className="cursor-pointer bg-ink px-5 py-2.5 font-medium text-parchment hover:bg-oxblood disabled:opacity-50">{s.certIssue}</button>
        </div>
      )}
      {estado === "erro" && <p className="mt-2 text-oxblood" role="status">{s.certFailed}</p>}
      {pronto && (
        <div role="dialog" aria-modal="true" aria-label={s.certTitle} className="certificado-janela fixed inset-0 z-50 overflow-y-auto bg-[#1c1712]/85 p-4 sm:p-8">
          {/* Enquanto a folha está aberta, a impressão é A4 deitada e sem margens. */}
          <style>{"@page { size: A4 landscape; margin: 0; }"}</style>
          <div className="no-print mx-auto mb-4 flex max-w-5xl flex-wrap items-center gap-3 text-[#f4ecd8]">
            <button type="button" onClick={() => window.print()} className="cursor-pointer bg-[#c21f16] px-5 py-2.5 font-bold text-white hover:bg-[#a51810]">{s.certPrint}</button>
            <button type="button" onClick={() => setPronto(null)} className="cursor-pointer border-2 border-[#f4ecd8] px-4 py-2 font-semibold">{s.certClose}</button>
            <p className="w-full text-xs opacity-80">{s.certPrintHint}</p>
          </div>
          <div className="mx-auto max-w-5xl shadow-2xl">
            <FolhaDoAluno c={pronto} />
          </div>
        </div>
      )}
    </section>
  );
}
