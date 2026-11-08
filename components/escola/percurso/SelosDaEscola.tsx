// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

import type { SeloDaEscola } from "@/lib/escola/conquistas";
import { preencher } from "@/lib/escola/textos";

export interface TextosDosSelos {
  carteirinha: string;
  degrau: string;
  caderno: string;
  aulas: string;
}

export function textoDoSelo(selo: SeloDaEscola, t: TextosDosSelos): string {
  if (selo.tipo === "carteirinha") return t.carteirinha;
  if (selo.tipo === "degrau") return preencher(t.degrau, { n: selo.n });
  if (selo.tipo === "caderno") return preencher(t.caderno, { n: String(selo.n).padStart(2, "0") });
  return preencher(t.aulas, { n: selo.n });
}

/**
 * Os selos 'escola:*' com o desenho da Escola (vermelho, estrela de ouro): no perfil da Alumia (TelaDoPerfil, que recebe
 * de rede_perfil_de os selos JÁ FILTRADOS no servidor pelo público que a pessoa escolheu) e na prévia de "Mostrar na
 * Alumia". Sem link: a Escola é fechada. Cores fixas (vermelho #C21F16 com texto branco, 5,9:1), iguais no claro e no escuro.
 */
export function SelosDaEscola({ selos, t, rotulo, className = "" }: { selos: readonly SeloDaEscola[]; t: TextosDosSelos; rotulo: string; className?: string }) {
  if (selos.length === 0) return null;
  return (
    <ul aria-label={rotulo} className={className} style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: 0, padding: 0, listStyle: "none" }}>
      {selos.map((selo) => (
        <li
          key={`${selo.tipo}-${"n" in selo ? selo.n : ""}`}
          data-selo-da-escola={selo.tipo}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 6, padding: "2px 8px", background: "#C21F16", color: "#FFFFFF", fontSize: 12.5, fontWeight: 700, lineHeight: 1.5 }}
        >
          {selo.tipo === "carteirinha" && (
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 56 56">
              <path d="M28 6l6.2 14.6 15.8 1.3-12 10.4 3.7 15.5L28 39.6l-13.7 8.2 3.7-15.5-12-10.4 15.8-1.3z" fill="#F2C94C" />
            </svg>
          )}
          {textoDoSelo(selo, t)}
        </li>
      ))}
    </ul>
  );
}
