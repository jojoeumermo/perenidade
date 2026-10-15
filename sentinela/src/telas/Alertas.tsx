// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
import { useState } from "react";
import { Abas, Aviso, Cartao, Carregando, Estado, Gravidade, Titulo } from "../componentes/ui.tsx";
import { analista, avisarMudanca, dono, rpc, textoDoErro, useDados, type Eu } from "../lib/backend.ts";
import { dataHora, faz, nomeRegra } from "../lib/formato.ts";
import { NovoIncidente } from "./Incidentes.tsx";

interface Alerta {
  id: number; em: string; regra: string; gravidade: string; titulo: string; resumo: string; detalhes: Record<string, unknown>; estado: string; incidente: string | null; incidente_numero: number | null; visto_nome: string | null; silenciado_ate: string | null;
}
interface Regra {
  id: string; ligada: boolean; gravidade: string; parametros: Record<string, unknown>; descricao: string;
}

export function Alertas({ eu, ir }: { eu: Eu; ir: (tela: string) => void }) {
  const [aba, setAba] = useState<"ativos" | "resolvido" | "regras">("ativos");
  const lista = useDados<Alerta[]>("alertas_listar", { p_estado: aba === "regras" ? "ativos" : aba });
  const regras = useDados<Regra[]>("regras_listar", {}, 0);
  const [aviso, setAviso] = useState("");
  const [abrindo, setAbrindo] = useState<number | null>(null);
  async function marcar(id: number, estado: string, horas?: number) {
    setAviso("");
    try {
      await rpc("alerta_marcar", { p_id: id, p_estado: estado, p_horas: horas });
      avisarMudanca();
      lista.recarregar();
    } catch (e) {
      setAviso(textoDoErro(e));
    }
  }
  async function regra(id: string, ligada: boolean) {
    try {
      await rpc("regra_salvar", { p_id: id, p_ligada: ligada });
      regras.recarregar();
    } catch (e) {
      setAviso(textoDoErro(e));
    }
  }
  return (
    <div>
      <Titulo sub="O que as regras apontaram. Ver, silenciar por um tempo, resolver ou transformar em incidente.">Alertas</Titulo>
      <Abas opcoes={[{ id: "ativos", nome: "Ativos", conta: lista.dados?.filter((a) => a.estado === "aberto").length }, { id: "resolvido", nome: "Resolvidos" }, { id: "regras", nome: "Regras" }]} atual={aba} escolher={setAba} />
      <Aviso texto={aviso} />
      {aba !== "regras" && (
        !lista.dados ? <Carregando erro={lista.erro} /> : lista.dados.length === 0 ? <Cartao><p className="font-sans text-sm text-ink-soft">{aba === "ativos" ? "Nenhum alerta ativo." : "Nenhum alerta resolvido."}</p></Cartao> : (
          <ul className="space-y-3">
            {lista.dados.map((a) => (
              <li key={a.id} className={`cartao surge ${a.gravidade === "critica" && a.estado === "aberto" ? "!border-oxblood !border-t-oxblood" : ""}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Gravidade valor={a.gravidade} />
                  <h3 className="flex-1 font-sans text-sm font-semibold">{a.titulo}</h3>
                  <Estado valor={a.estado} />
                  <span className="mono text-xs text-ink-soft">{dataHora(a.em)} · {faz(a.em)}</span>
                </div>
                <p className="mt-1 font-sans text-sm">{a.resumo}</p>
                <p className="mt-1 font-sans text-xs text-ink-soft">Regra: {nomeRegra[a.regra] ?? a.regra}{a.visto_nome ? ` · visto por ${a.visto_nome}` : ""}{a.incidente_numero ? ` · incidente #${a.incidente_numero}` : ""}{a.estado === "silenciado" && a.silenciado_ate ? ` · silenciado até ${dataHora(a.silenciado_ate)}` : ""}</p>
                {Object.keys(a.detalhes ?? {}).length > 0 && <details className="mt-1 font-sans text-xs"><summary className="cursor-pointer text-ink-soft">detalhes</summary><pre className="mono mt-1 overflow-x-auto border border-rule bg-parchment p-2">{JSON.stringify(a.detalhes, null, 1)}</pre></details>}
                {analista(eu) && a.estado !== "resolvido" && (
                  <div className="mt-2 flex flex-wrap gap-2 font-sans text-xs">
                    {a.estado === "aberto" && <button type="button" className="botao-claro !py-1 !text-xs" onClick={() => void marcar(a.id, "visto")}>Visto</button>}
                    <button type="button" className="botao-claro !py-1 !text-xs" onClick={() => void marcar(a.id, "silenciado", 24)}>Silenciar 24 h</button>
                    <button type="button" className="botao-claro !py-1 !text-xs" onClick={() => void marcar(a.id, "resolvido")}>Resolver</button>
                    {!a.incidente && <button type="button" className="botao !py-1 !text-xs" onClick={() => setAbrindo(a.id)}>Abrir incidente</button>}
                    {a.incidente && <button type="button" className="underline" onClick={() => ir("incidentes")}>ver incidente</button>}
                  </div>
                )}
                {abrindo === a.id && <div className="mt-3"><NovoIncidente eu={eu} alerta={a.id} fechar={() => setAbrindo(null)} abrir={() => { setAbrindo(null); ir("incidentes"); }} /></div>}
              </li>
            ))}
          </ul>
        )
      )}
      {aba === "regras" && (
        <Cartao titulo="Regras de alerta">
          {!regras.dados ? <Carregando erro={regras.erro} /> : (
            <ul className="divide-y divide-rule font-sans text-sm">
              {regras.dados.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={r.ligada} disabled={!dono(eu)} onChange={(e) => void regra(r.id, e.target.checked)} />
                    <span className={r.ligada ? "" : "text-ink-soft line-through"}>{nomeRegra[r.id] ?? r.id}</span>
                  </label>
                  <Gravidade valor={r.gravidade} />
                  <span className="flex-1 text-xs text-ink-soft">{r.descricao}</span>
                  {Object.keys(r.parametros).length > 0 && <span className="mono text-xs text-ink-soft">{JSON.stringify(r.parametros)}</span>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 font-sans text-xs text-ink-soft">Só o dono liga e desliga regras. Os parâmetros (limites) são ajustados pelo SQL Editor ou numa versão futura desta tela.</p>
        </Cartao>
      )}
    </div>
  );
}
