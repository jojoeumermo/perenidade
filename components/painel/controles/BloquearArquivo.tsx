// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { data, useLista } from "../comum";
import { MoldeTabela } from "../moldes";
import { Botao, Campo, type ColumnDef, confirmar, Esqueleto, Faixa, notificar } from "../ui";
import { ehSha256, emHexadecimal } from "./regras";
import { useControle } from "./usarControle";

interface Bloqueado {
  sha256: string;
  motivo: string;
  criado_em: string;
}

/** Calcula o SHA-256 de um arquivo neste aparelho. O arquivo não sai daqui: só a impressão digital vai ao banco. */
async function impressaoDigital(arquivo: File): Promise<string> {
  const bytes = await arquivo.arrayBuffer();
  return emHexadecimal(await crypto.subtle.digest("SHA-256", bytes));
}

/**
 * Bloquear arquivo: a rotina de publicação recusa qualquer arquivo com esta impressão digital (SHA-256), mesmo que alguém
 * o envie de novo com outro nome (public.arquivo_bloquear, curadoria, coordenação e vice). Serve para o que não pode ir ao
 * site: material de terceiros sem licença (Lei 9.610/1998, direitos autorais), dado de pessoa ou arquivo com algo embutido.
 * A impressão digital é calculada aqui, no aparelho da pessoa; o arquivo não é enviado. Desbloquear desfaz um engano.
 */
export function BloquearArquivo() {
  const lista = useLista<Bloqueado[]>("arquivos_bloqueados_ver", {}, { quieta: true });
  const { executar, ocupado } = useControle(lista.recarregar);
  const [hash, setHash] = useState("");
  const [motivo, setMotivo] = useState("");
  const [nomeEscolhido, setNomeEscolhido] = useState("");
  const [calculando, setCalculando] = useState(false);
  const valor = hash.trim().toLowerCase();
  const erro = valor && !ehSha256(valor) ? "A impressão digital tem 64 letras e números (a-f, 0-9)." : "";

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setCalculando(true);
    try {
      setHash(await impressaoDigital(arquivo));
      setNomeEscolhido(arquivo.name);
      if (!motivo) setMotivo(`Arquivo ${arquivo.name.slice(0, 80)}`);
    } catch {
      notificar.erro("Não deu para ler o arquivo neste navegador. Cole a impressão digital à mão.");
    } finally {
      setCalculando(false);
    }
  }
  async function bloquear() {
    if (!ehSha256(valor)) return;
    const certo = await confirmar({ titulo: "Bloquear este arquivo?", texto: "A rotina de publicação passa a recusar qualquer arquivo igual a este, com qualquer nome.", confirmar: "Bloquear", perigo: true });
    if (!certo) return;
    const r = await executar("arquivo_bloquear", { p_sha256: valor, p_motivo: motivo.trim().slice(0, 200) }, "Arquivo bloqueado.");
    if (r) {
      setHash("");
      setMotivo("");
      setNomeEscolhido("");
    }
  }
  async function desbloquear(b: Bloqueado) {
    const certo = await confirmar({ titulo: "Desbloquear este arquivo?", texto: "Ele volta a poder ser publicado se a coordenação aprovar.", confirmar: "Desbloquear" });
    if (certo) await executar("arquivo_desbloquear", { p_sha256: b.sha256 }, "Arquivo desbloqueado.");
  }

  const colunas: ColumnDef<Bloqueado>[] = [
    { accessorKey: "sha256", header: "Impressão digital (SHA-256)", cell: ({ getValue }) => <code style={{ overflowWrap: "anywhere", fontSize: "0.78rem" }}>{String(getValue())}</code> },
    { accessorKey: "motivo", header: "Motivo" },
    { accessorKey: "criado_em", header: "Desde", cell: ({ getValue }) => data(String(getValue())) },
    {
      id: "acoes",
      header: () => <span className="sr-only">Ações</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <Botao pequeno disabled={ocupado} onClick={() => void desbloquear(row.original)}>
          Desbloquear
        </Botao>
      ),
    },
  ];

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <form
        className="pn-cartao"
        style={{ display: "grid", gap: "0.8rem", maxWidth: "46rem" }}
        onSubmit={(e) => {
          e.preventDefault();
          void bloquear();
        }}
      >
        <h3 className="pn-cartao-titulo">Bloquear um arquivo</h3>
        <p className="pn-ajuda">Escolha o arquivo: a impressão digital é calculada aqui, no seu aparelho, e o arquivo não é enviado a lugar nenhum. Ou cole a impressão digital que já tem.</p>
        <div>
          <label className="pn-rotulo" htmlFor="bloquear-arquivo-escolha">
            Arquivo
          </label>
          <input id="bloquear-arquivo-escolha" type="file" className="pn-campo" disabled={calculando} onChange={(e) => void escolher(e.target.files?.[0])} />
          {nomeEscolhido && <p className="pn-ajuda">{calculando ? "Calculando…" : `Pronto: ${nomeEscolhido}`}</p>}
        </div>
        <Campo rotulo="Impressão digital (SHA-256)" value={hash} onChange={(e) => setHash(e.target.value)} spellCheck={false} autoComplete="off" style={{ fontFamily: "var(--pn-fonte-mono)" }} erro={erro} />
        <Campo rotulo="Motivo" value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} ajuda="Até 200 letras. Fica só para a equipe (por exemplo, sem licença, dado pessoal)." />
        <div>
          <Botao type="submit" variante="principal" disabled={ocupado || calculando || !ehSha256(valor)}>
            Bloquear arquivo
          </Botao>
        </div>
      </form>

      {!lista.dados ? (
        lista.erro ? (
          <Faixa
            tom="erro"
            acao={
              <Botao pequeno onClick={lista.recarregar}>
                Tentar de novo
              </Botao>
            }
          >
            {lista.erro}
          </Faixa>
        ) : (
          <Esqueleto />
        )
      ) : (
        <MoldeTabela dados={lista.dados} colunas={colunas} legenda="Arquivos bloqueados" porPagina={20} />
      )}
    </div>
  );
}
