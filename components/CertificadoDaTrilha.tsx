// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { fill, htmlLang } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { hasBackend, rpc } from "@/lib/backend";
import { useCompleted } from "@/lib/progress";
import { useHydrated } from "@/lib/storage";
import { useI18n } from "./I18n";

const escapar = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/**
 * O selo de trilha concluída e o certificado de participação. O progresso é o do aparelho; o certificado guarda no site
 * só o nome escrito pela pessoa, a trilha e a data, para o número poder ser conferido em /certificado.
 */
export function CertificadoDaTrilha({ ids, trilha, titulo, s }: { ids: string[]; trilha: string; titulo: string; s: Dict["tracks"] }) {
  const hidratado = useHydrated();
  const feitas = useCompleted();
  const { lang } = useI18n();
  const [nome, setNome] = useState("");
  const [estado, setEstado] = useState<"" | "ocupado" | "erro">("");
  const concluida = ids.length > 0 && ids.every((id) => feitas.has(id));
  if (!hidratado || !concluida) return null;

  async function emitir() {
    setEstado("ocupado");
    try {
      const { codigo, emitido_em } = await rpc<{ codigo: string; emitido_em: string }>("certificado_aluno_emitir", { p_nome: nome.trim(), p_trilha: trilha, p_titulo: titulo, p_aulas: ids.length });
      const data = new Intl.DateTimeFormat(htmlLang[lang], { dateStyle: "long" }).format(new Date(emitido_em));
      const conferir = `${location.origin}/${lang}/certificado?codigo=${codigo}`;
      const janela = window.open("", "_blank");
      if (!janela) throw new Error("janela");
      janela.document.write(`<!doctype html><html lang="${htmlLang[lang]}"><head><meta charset="utf-8"><title>${escapar(s.certTitle)}</title><style>
        @page{size:A4 landscape;margin:0}body{margin:0;font-family:Georgia,'Times New Roman',serif;background:#f4ecd8;color:#1f1a14}
        .folha{box-sizing:border-box;width:297mm;height:210mm;padding:22mm 26mm;border:10px solid #8b1e1e;display:flex;flex-direction:column;justify-content:space-between}
        h1{font-size:34pt;margin:0;letter-spacing:.02em}.sub{font:600 11pt system-ui,sans-serif;letter-spacing:.3em;text-transform:uppercase;color:#8b1e1e}
        .texto{font-size:19pt;line-height:1.5}.nome{font-size:28pt;font-weight:700;border-bottom:2px solid #1f1a14;display:inline-block;padding:0 6mm}
        .rodape{font:10pt system-ui,sans-serif;display:flex;justify-content:space-between;gap:10mm}code{font-size:12pt}
      </style></head><body><div class="folha"><div><p class="sub">Instituto Lúcia · institutolucia.org</p><h1>${escapar(s.certTitle)}</h1></div>
      <p class="texto">${escapar(fill(s.certText, { nome: "\u0000", n: ids.length, trilha: titulo })).replace("\u0000", `<span class="nome">${escapar(nome.trim())}</span>`)}</p>
      <div class="rodape"><span>${escapar(data)}</span><span>${escapar(fill(s.certCode, { c: codigo }))}<br><code>${escapar(conferir)}</code></span></div></div>
      </body></html>`);
      janela.document.close();
      // Sem script dentro da página nova (a política de segurança do site não deixa): quem manda imprimir é esta aba.
      setTimeout(() => janela.print(), 400);
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
    </section>
  );
}
