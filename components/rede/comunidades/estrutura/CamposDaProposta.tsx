// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { UFS, nomeDoLugar } from "@/lib/rede/estrutura/regras";
import type { TextosDaEstrutura } from "@/lib/rede/estrutura/textos";
import type { EstruturaDaProposta } from "@/lib/rede/estrutura/tipos";
import "./estrutura.css";

export interface CamposDeLugar {
  uf: string;
  municipio: string;
  bairro: string;
  mae: string;
}

export const VAZIA: CamposDeLugar = { uf: "", municipio: "", bairro: "", mae: "" };

/** O que vai para alumia_estr_proposta; nulo quando nada foi escrito (nem chama o banco). */
export function estruturaDaProposta(c: CamposDeLugar): EstruturaDaProposta | null {
  const municipio = nomeDoLugar(c.municipio);
  const mae = c.mae.trim().replace(/^.*\/c\//, "").replace(/\/.*$/, "").toLowerCase();
  if (!municipio && !mae) return null;
  return {
    ...(municipio ? { uf: c.uf, municipio, bairro: nomeDoLugar(c.bairro) ?? "" } : {}),
    ...(mae ? { mae } : {}),
  };
}

/**
 * Na proposta de comunidade nova (Propor.tsx), uma parte recolhida e opcional: a cidade e o bairro escritos e a comunidade-mãe.
 * Nada de localização do aparelho.
 */
export function CamposDaProposta({ te, valor, aoMudar }: { te: TextosDaEstrutura; valor: CamposDeLugar; aoMudar: (v: CamposDeLugar) => void }) {
  const p = te.proposta;
  const a = te.ajustar;
  const mudar = (campo: keyof CamposDeLugar, v: string) => aoMudar({ ...valor, [campo]: v });
  return (
    <details className="e10 rounded-xl border border-rule p-3" open={Boolean(valor.municipio || valor.mae)}>
      <summary className="min-h-11 cursor-pointer font-bold">{p.titulo}</summary>
      <p className="e10-nota">{p.intro}</p>
      <div className="e10-campos e10-depois">
        <div className="e10-campos e10-campos-3">
          <label className="e10-campo">
            {a.uf}
            <select value={valor.uf} onChange={(e) => mudar("uf", e.target.value)} required={Boolean(valor.municipio.trim())}>
              <option value="">{a.ufVazia}</option>
              {UFS.map((u) => <option key={u} value={u}>{u} · {te.ufs[u]}</option>)}
            </select>
          </label>
          <label className="e10-campo">
            {a.municipio}
            <input value={valor.municipio} onChange={(e) => mudar("municipio", e.target.value)} maxLength={80} placeholder={a.municipioExemplo} autoComplete="off" />
          </label>
          <label className="e10-campo">
            {a.bairro}
            <input value={valor.bairro} onChange={(e) => mudar("bairro", e.target.value)} maxLength={80} placeholder={a.bairroExemplo} autoComplete="off" disabled={!valor.municipio.trim()} />
          </label>
        </div>
        <label className="e10-campo">
          {p.maeCampo}
          <input value={valor.mae} onChange={(e) => mudar("mae", e.target.value)} placeholder={a.maeExemplo} autoCapitalize="none" spellCheck={false} maxLength={120} />
        </label>
      </div>
    </details>
  );
}
