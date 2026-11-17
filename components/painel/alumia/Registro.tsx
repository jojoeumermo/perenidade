// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Botao } from "@/components/rede/ui/Botao";
import { rpc } from "@/lib/backend";
import { nomeDaAcaoNoRegistro } from "@/lib/rede/admin/tipos";
import type { LinhaDoRegistro, RegistroDoPainel } from "@/lib/rede/painel/tipos";
import { Campo, Estado, Etiqueta, Nota, quando, Quadro, textoDoErroDaAlumia, Titulo, useDado } from "./pecas";

interface Filtros {
  acao: string;
  busca: string;
  de: string;
  ate: string;
  pagina: number;
}
const VAZIO: Filtros = { acao: "", busca: "", de: "", ate: "", pagina: 0 };
const PAPEL: Record<string, string> = { coordenacao: "coordenação", admin: "admin", sistema: "sistema" };

/**
 * Uma célula da planilha: entre aspas, com as aspas dobradas. Texto que começa com =, +, - ou @ ganha um apóstrofo na frente,
 * para o programa de planilha não tratar como fórmula (o motivo é texto escrito por gente).
 */
export function celulaCsv(valor: unknown): string {
  let texto = valor === null || valor === undefined ? "" : typeof valor === "object" ? JSON.stringify(valor) : String(valor);
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return `"${texto.replaceAll('"', '""')}"`;
}

export function registroEmCsv(linhas: LinhaDoRegistro[]): string {
  const cabeca = ["numero", "quando", "quem", "papel", "acao", "nome_da_acao", "tipo_do_alvo", "alvo", "referencia", "motivo", "detalhes"];
  const corpo = linhas.map((l) => [l.id, l.quando, l.quem, l.papel, l.acao, nomeDaAcaoNoRegistro(l.acao), l.alvo_tipo ?? "", l.alvo, l.referencia ?? "", l.motivo, l.detalhes ?? {}].map(celulaCsv).join(";"));
  // O BOM faz o Excel abrir em UTF-8; ponto e vírgula é o separador das planilhas em português.
  return `﻿${[cabeca.map(celulaCsv).join(";"), ...corpo].join("\r\n")}\r\n`;
}

/**
 * O registro: toda ação do painel, com quem fez, o quê, em quem ou em quê, quando e por quê. Só entra linha nova: o banco barra
 * mudar, apagar e esvaziar. Ler aqui e exportar em planilha (a exportação também vira uma linha do registro).
 */
export function Registro() {
  const [rascunho, setRascunho] = useState<Filtros>(VAZIO);
  const [filtros, setFiltros] = useState<Filtros>(VAZIO);
  const leitura = useDado<RegistroDoPainel>("alumia_painel_registro", { p: filtros });
  const [exportando, setExportando] = useState({ ocupado: false, aviso: "" });
  const itens = leitura.dados?.itens ?? [];
  const mudar = (parte: Partial<Filtros>) => setRascunho((r) => ({ ...r, ...parte }));

  async function exportar() {
    setExportando({ ocupado: true, aviso: "" });
    try {
      const tudo = await rpc<RegistroDoPainel>("alumia_painel_registro", { p: { ...filtros, pagina: 0, tudo: true } });
      const arquivo = new Blob([registroEmCsv(tudo.itens)], { type: "text/csv;charset=utf-8" });
      const endereco = URL.createObjectURL(arquivo);
      const elo = document.createElement("a");
      elo.href = endereco;
      elo.download = `alumia-registro-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(elo);
      elo.click();
      elo.remove();
      URL.revokeObjectURL(endereco);
      setExportando({ ocupado: false, aviso: `${tudo.itens.length} linhas exportadas${tudo.mais ? " (as 5.000 mais novas: afine o filtro por data para pegar as anteriores)" : ""}.` });
      leitura.recarregar();
    } catch (erro) {
      setExportando({ ocupado: false, aviso: textoDoErroDaAlumia(erro) });
    }
  }

  return (
    <div className="ap-tela">
      <Titulo nome="Registro" sobre="Quem fez, o quê, quando e por quê. O registro não se altera nem se apaga: nem a coordenação consegue. A planilha exportada leva nomes e motivos: guarde como documento interno.">
        <Botao variante="claro" tamanho="p" disabled={exportando.ocupado} onClick={() => void exportar()}>
          {exportando.ocupado ? "Exportando…" : "Exportar planilha (CSV)"}
        </Botao>
      </Titulo>
      {exportando.aviso ? <Nota>{exportando.aviso}</Nota> : null}
      <Quadro>
        <form
          className="ap-filtros ap-filtros-registro"
          onSubmit={(e) => {
            e.preventDefault();
            setFiltros({ ...rascunho, pagina: 0 });
          }}
        >
          <Campo rotulo="Ação">
            <select className="ap-entrada" value={rascunho.acao} onChange={(e) => mudar({ acao: e.target.value })}>
              <option value="">Todas</option>
              {(leitura.dados?.acoes ?? []).map((a) => (
                <option key={a} value={a}>
                  {nomeDaAcaoNoRegistro(a)}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Quem, alvo ou palavra do motivo" largo>
            <input className="ap-entrada" value={rascunho.busca} maxLength={80} onChange={(e) => mudar({ busca: e.target.value })} />
          </Campo>
          <Campo rotulo="De">
            <input className="ap-entrada" type="date" value={rascunho.de} onChange={(e) => mudar({ de: e.target.value })} />
          </Campo>
          <Campo rotulo="Até">
            <input className="ap-entrada" type="date" value={rascunho.ate} onChange={(e) => mudar({ ate: e.target.value })} />
          </Campo>
          <Botao type="submit" variante="contorno">
            Filtrar
          </Botao>
        </form>
      </Quadro>
      <Estado leitura={leitura} eVazio={Boolean(leitura.dados) && itens.length === 0} vazio="Nenhuma linha com esse filtro." />
      {itens.length > 0 ? (
        <Quadro>
          <div className="ap-tabela-caixa">
            <table className="ap-tabela">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Quando</th>
                  <th>Quem</th>
                  <th>O quê</th>
                  <th>Em quem ou em quê</th>
                  <th>Por quê</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((l) => (
                  <tr key={l.id}>
                    <td data-nome="Nº" className="ap-miudo">
                      {l.id}
                    </td>
                    <td data-nome="Quando" style={{ whiteSpace: "nowrap" }}>
                      {quando(l.quando)}
                    </td>
                    <td data-nome="Quem">
                      {l.quem || "—"} <Etiqueta tom={l.papel === "coordenacao" ? "papel" : l.papel === "admin" ? "dourado" : undefined}>{PAPEL[l.papel] ?? l.papel}</Etiqueta>
                    </td>
                    <td data-nome="O quê" className="ap-forte">
                      {nomeDaAcaoNoRegistro(l.acao)}
                    </td>
                    <td data-nome="Em quem ou em quê">
                      {l.alvo || "—"}
                      {l.alvo_tipo ? <span className="ap-miudo"> · {l.alvo_tipo}</span> : null}
                    </td>
                    <td data-nome="Por quê" className="ap-quebra">
                      {l.motivo || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ap-linha-acoes">
            {filtros.pagina > 0 ? (
              <Botao variante="contorno" tamanho="p" onClick={() => setFiltros((f) => ({ ...f, pagina: f.pagina - 1 }))}>
                Mais novas
              </Botao>
            ) : null}
            {leitura.dados?.mais ? (
              <Botao variante="contorno" tamanho="p" onClick={() => setFiltros((f) => ({ ...f, pagina: f.pagina + 1 }))}>
                Mais antigas
              </Botao>
            ) : null}
          </div>
        </Quadro>
      ) : null}
    </div>
  );
}
