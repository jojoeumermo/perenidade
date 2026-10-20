// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Abas, Aviso, botaoClaro, dataHora, rotulo, useAcao, useLista } from "./comum";

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

/** Os erros que o público relatou em /relatar-erro, para quem cuida do código: ver, marcar e anotar. */
export function ErrosRelatados() {
  const lista = useLista<Relato[]>("erros_listar");
  const acao = useAcao(lista.recarregar);
  const [aba, setAba] = useState<Relato["status"]>("novo");
  const vistos = (lista.dados ?? []).filter((r) => r.status === aba);
  return (
    <div>
      <p className="max-w-3xl text-ink-soft">O que as pessoas relataram na página “Achei um erro”. Sem endereço de rede; navegador e tela só quando a pessoa marcou.</p>
      <div className="mt-4">
        <Abas atual={aba} escolher={setAba} opcoes={(Object.keys(NOMES) as Relato["status"][]).map((id) => ({ id, nome: NOMES[id], conta: id === "novo" ? (lista.dados ?? []).filter((r) => r.status === "novo").length : undefined }))} />
      </div>
      <Aviso texto={lista.erro || acao.aviso} />
      {vistos.length === 0 && <p className="text-ink-soft">Nada aqui.</p>}
      <ul className="space-y-3">
        {vistos.map((r) => (
          <li key={r.id} className="painel-cartao p-4">
            <p className={rotulo}>{dataHora(r.criado_em)} · {r.pagina || "página não informada"}{r.tela ? ` · tela ${r.tela}` : ""}</p>
            <p className="mt-1 whitespace-pre-wrap" data-original>{r.descricao}</p>
            {r.passos && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft" data-original>{r.passos}</p>}
            {r.navegador && <p className="mt-1 font-mono text-xs text-ink-soft">{r.navegador}</p>}
            {r.contato && <p className="mt-1 text-sm">Contato: <span data-original>{r.contato}</span></p>}
            {r.nota && <p className="mt-1 text-sm">Nota: {r.nota}</p>}
            <p className="mt-3 flex flex-wrap gap-2">
              {(["visto", "resolvido", "descartado", "novo"] as const).filter((s) => s !== r.status).map((s) => (
                <button key={s} type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => { const nota = s === "resolvido" || s === "descartado" ? (window.prompt("Nota (opcional):", r.nota) ?? r.nota) : r.nota; void acao.agir("erro_mudar", { p_id: r.id, p_status: s, p_nota: nota }, "Feito."); }}>
                  {s === "novo" ? "Voltar para novos" : `Marcar como ${s}`}
                </button>
              ))}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
