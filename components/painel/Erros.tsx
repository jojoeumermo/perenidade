// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Bug } from "lucide-react";
import { useState } from "react";
import { dataHora, useAcao, useLista } from "./comum";
import { MoldeFila } from "./moldes";
import { Abas, Botao, Faixa, perguntarTexto, Selo, type TomDoSelo, Vazio } from "./ui";

interface Relato {
  id: string;
  pagina: string;
  descricao: string;
  passos: string;
  navegador: string;
  tela: string;
  contato: string;
  status: "novo" | "visto" | "resolvido" | "descartado";
  nota: string;
  criado_em: string;
}
const NOMES: Record<Relato["status"], string> = { novo: "Novos", visto: "Vistos", resolvido: "Resolvidos", descartado: "Descartados" };
const TOM: Record<Relato["status"], TomDoSelo> = { novo: "bordo", visto: "info", resolvido: "ok", descartado: "neutro" };

/**
 * Os erros que o público relatou em /relatar-erro, para quem cuida do código: ver, marcar e anotar. Molde Fila: a lista do
 * que chegou de um lado, o relato aberto do outro (j/k percorrem; as marcações também ficam na paleta, Ctrl K).
 */
export function ErrosRelatados() {
  const lista = useLista<Relato[]>("erros_listar");
  const acao = useAcao(lista.recarregar);
  const [aba, setAba] = useState<Relato["status"]>("novo");
  const vistos = (lista.dados ?? []).filter((r) => r.status === aba);

  // Mudar a situação de um relato (pede a nota ao resolver ou descartar, como antes).
  const mudar = async (r: Relato, s: Relato["status"]) => {
    const nota = s === "resolvido" || s === "descartado" ? ((await perguntarTexto("Nota (opcional):", r.nota)) ?? r.nota) : r.nota;
    void acao.agir("erro_mudar", { p_id: r.id, p_status: s, p_nota: nota }, "Feito.");
  };
  const rotuloDe = (s: Relato["status"]) => (s === "novo" ? "Voltar para novos" : `Marcar como ${s}`);
  const destinos = (r: Relato) => (["visto", "resolvido", "descartado", "novo"] as const).filter((s) => s !== r.status);

  return (
    <div className="pn-tela">
      <p className="pn-sobre">O que as pessoas relataram na página “Achei um erro”. Sem endereço de rede; navegador e tela só quando a pessoa marcou.</p>
      <Abas
        rotulo="Situação dos relatos"
        valor={aba}
        aoMudar={setAba}
        opcoes={(Object.keys(NOMES) as Relato["status"][]).map((id) => ({ id, nome: NOMES[id], conta: id === "novo" ? (lista.dados ?? []).filter((r) => r.status === "novo").length : undefined }))}
      />
      {(lista.erro || acao.aviso) && (
        <Faixa
          tom={lista.erro ? "erro" : "info"}
          acao={
            lista.erro ? (
              <Botao pequeno onClick={lista.recarregar}>
                Tentar de novo
              </Botao>
            ) : undefined
          }
        >
          {lista.erro || acao.aviso}
        </Faixa>
      )}
      <MoldeFila
        id="erros"
        rotulo="Relatos de erro"
        itens={vistos}
        chave={(r) => r.id}
        carregando={lista.dados === null && !lista.erro}
        vazio={<Vazio simbolo={Bug} titulo="Nada aqui." />}
        linha={(r) => (
          <span style={{ display: "grid", gap: "0.2rem", minWidth: 0 }}>
            <span className="pn-rotulo-mono">
              {dataHora(r.criado_em)} · {r.pagina || "página não informada"}
            </span>
            <span className="line-clamp-2" data-original>
              {r.descricao}
            </span>
          </span>
        )}
        comandos={(r) => destinos(r).map((s) => ({ id: `erro-${s}`, nome: rotuloDe(s), fazer: () => void mudar(r, s) }))}
        detalhe={(r) => (
          <article className="pn-secao">
            <p className="flex flex-wrap items-center gap-2">
              <Selo tom={TOM[r.status]}>{NOMES[r.status]}</Selo>
              <span className="pn-rotulo-mono">
                {dataHora(r.criado_em)} · {r.pagina || "página não informada"}
                {r.tela ? ` · tela ${r.tela}` : ""}
              </span>
            </p>
            <p className="whitespace-pre-wrap" data-original>
              {r.descricao}
            </p>
            {r.passos && (
              <p className="whitespace-pre-wrap text-sm text-ink-soft" data-original>
                {r.passos}
              </p>
            )}
            {r.navegador && <p className="font-mono text-xs text-ink-soft">{r.navegador}</p>}
            {r.contato && (
              <p className="text-sm">
                Contato: <span data-original>{r.contato}</span>
              </p>
            )}
            {r.nota && <p className="text-sm">Nota: {r.nota}</p>}
            <p className="flex flex-wrap gap-2">
              {destinos(r).map((s) => (
                <Botao key={s} disabled={acao.ocupado} onClick={() => void mudar(r, s)}>
                  {rotuloDe(s)}
                </Botao>
              ))}
            </p>
          </article>
        )}
      />
    </div>
  );
}
