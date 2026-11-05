// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { ReactNode } from "react";
import { type ColumnDef, Esqueleto, Tabela } from "../ui";

/**
 * Molde TABELA: muitos registros iguais, com busca, ordem por coluna e páginas. Em cima, uma barra para filtros e para o
 * botão de criar (o único botão principal da tela). Serve Voluntários, Termos assinados, Horas, Estatísticas, Boletim,
 * Registro de atividades e o Acervo por dentro.
 */
export function MoldeTabela<T>({ dados, colunas, legenda, barra, vazio, carregando = false, porPagina = 25, aoClicarLinha }: { dados: T[]; colunas: ColumnDef<T>[]; legenda: string; barra?: ReactNode; vazio?: ReactNode; carregando?: boolean; porPagina?: number; aoClicarLinha?: (linha: T) => void }) {
  if (carregando) return <Esqueleto linhas={5} rotulo={`Carregando ${legenda}`} />;
  return (
    <div className="pn-tela">
      {barra && <div className="pn-barra-ferramentas">{barra}</div>}
      <Tabela dados={dados} colunas={colunas} legenda={legenda} busca porPagina={porPagina} vazio={vazio} aoClicarLinha={aoClicarLinha} />
    </div>
  );
}
