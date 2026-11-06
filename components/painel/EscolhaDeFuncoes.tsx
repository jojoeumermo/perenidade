// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Escolher várias funções, várias disciplinas e vários departamentos para a mesma pessoa (T28). Serve a Confiar função
// (Pessoas) e ao convite pessoal (Convites). A regra de verdade (quem confia o quê a quem) é conferida no banco:
// public.papeis_conceder_varios e public.convite_criar (supabase/migracoes/20261106-pessoas-painel.sql).

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { groups } from "@/lib/areas";
import type { Role } from "@/lib/backend";
import { useI18n } from "../I18n";
import { GRUPOS_DEPARTAMENTO, papeis } from "./comum";
import { DEPARTAMENTOS_DE_PARTICIPACAO, DEPARTAMENTOS_DO_INSTITUTO, NOMES_DOS_DEPARTAMENTOS_DO_INSTITUTO } from "./departamentos-do-instituto";
import { Botao, Busca, Marca, Selecao, Selo } from "./ui";

export interface FuncaoEscolhida {
  papel: Role["papel"];
  /** Disciplina (educação, reforço…), departamento (representante) ou nada (vale para todo o site). */
  disciplina: string | null;
}

/** Funções que só existem com disciplina: sem ela, a pessoa enxergaria a fila de todas. */
export const POR_DISCIPLINA: Role["papel"][] = ["educacao", "educacao_secundaria", "mentoria"];
/** Funções sem disciplina nenhuma. */
export const SEM_DISCIPLINA: Role["papel"][] = ["vice", "supervisao", "marketing", "saude"];

/** Os departamentos que um representante pode representar (o mesmo de interno.departamento_valido no banco). */
const DEPARTAMENTOS_DE_REPRESENTANTE: { grupo: string; itens: [string, string][] }[] = [
  { grupo: "Educação, por área (reúne as disciplinas dela)", itens: Object.entries(GRUPOS_DEPARTAMENTO) },
  {
    grupo: "Departamentos de função",
    itens: (["educacao", "curadoria", "mediacao", "revisao", "traducao", "jornalismo", "marketing", "mentoria", "design", "desenvolvimento", "saude"] as const).map((id) => [id, NOMES_DOS_DEPARTAMENTOS_DO_INSTITUTO[id] ?? papeis[id]]),
  },
  { grupo: "Departamentos de participação", itens: DEPARTAMENTOS_DE_PARTICIPACAO.filter((d) => d.id !== "representantes").map((d) => [d.id, d.nome]) },
];

/** O nome curto de uma função escolhida, para a lista e os avisos. */
export function nomeDaFuncao(item: FuncaoEscolhida, nomeDaArea: (slug: string) => string): string {
  if (!item.disciplina) return papeis[item.papel];
  const alvo = item.papel === "representante" ? (GRUPOS_DEPARTAMENTO[item.disciplina] ?? NOMES_DOS_DEPARTAMENTOS_DO_INSTITUTO[item.disciplina] ?? item.disciplina) : nomeDaArea(item.disciplina);
  return `${papeis[item.papel]} · ${alvo}`;
}

export function EscolhaDeFuncoes({
  concediveis,
  escolhidas,
  aoMudar,
  departamentos,
  aoMudarDepartamentos,
  podeSensivel,
}: {
  concediveis: Role["papel"][];
  escolhidas: FuncaoEscolhida[];
  aoMudar: (lista: FuncaoEscolhida[]) => void;
  /** Os departamentos de participação marcados (Parcerias, RH…). Sem esta prop, a parte de departamentos não aparece. */
  departamentos?: string[];
  aoMudarDepartamentos?: (lista: string[]) => void;
  /** Só a coordenação põe alguém nos Revolucionários (dado sensível, LGPD art. 11). */
  podeSensivel: boolean;
}) {
  const { t } = useI18n();
  const nomeDaArea = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug;
  const [papel, setPapel] = useState<Role["papel"]>(concediveis.includes("educacao") ? "educacao" : (concediveis[0] ?? "educacao"));
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [filtro, setFiltro] = useState("");
  const precisa = POR_DISCIPLINA.includes(papel) || papel === "representante";
  const sem = SEM_DISCIPLINA.includes(papel);
  const ja = (p: Role["papel"], d: string | null) => escolhidas.some((e) => e.papel === p && e.disciplina === d);
  const trocar = (lista: string[], id: string) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
  const termo = filtro.trim().toLocaleLowerCase("pt-BR");

  function acrescentar() {
    const novas: FuncaoEscolhida[] = sem || marcadas.length === 0 ? [{ papel, disciplina: null }] : marcadas.map((d) => ({ papel, disciplina: d }));
    aoMudar([...escolhidas, ...novas.filter((n) => !ja(n.papel, n.disciplina))]);
    setMarcadas([]);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Selecao
          rotulo="Função"
          value={papel}
          onChange={(e) => {
            setPapel(e.target.value as Role["papel"]);
            setMarcadas([]);
          }}
        >
          {concediveis.map((p) => (
            <option key={p} value={p}>
              {papeis[p]}
            </option>
          ))}
        </Selecao>
        <Botao simbolo={Plus} disabled={precisa && marcadas.length === 0} onClick={acrescentar}>
          {sem || marcadas.length <= 1 ? "Acrescentar à lista" : `Acrescentar ${marcadas.length} à lista`}
        </Botao>
      </div>

      {sem ? (
        <p className="pn-ajuda">{papel === "saude" ? "Sem disciplina: o cargo vale para o Mural de Saúde." : "Esta função não tem disciplina: vale para todo o site."}</p>
      ) : papel === "representante" ? (
        <fieldset className="space-y-2">
          <legend className="pn-rotulo">Departamentos que a pessoa vai representar (marque um ou mais)</legend>
          {DEPARTAMENTOS_DE_REPRESENTANTE.map((bloco) => (
            <div key={bloco.grupo}>
              <p className="pn-rotulo-mono">{bloco.grupo}</p>
              <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
                {bloco.itens
                  .filter(([id]) => podeSensivel || id !== "revolucionarios")
                  .map(([id, nome]) => (
                    <Marca key={id} rotulo={nome} checked={marcadas.includes(id) || ja("representante", id)} disabled={ja("representante", id)} onChange={() => setMarcadas((m) => trocar(m, id))} />
                  ))}
              </div>
            </div>
          ))}
        </fieldset>
      ) : (
        <fieldset className="space-y-2">
          <legend className="pn-rotulo">{precisa ? "Disciplinas (marque uma ou mais)" : "Disciplinas (opcional: sem nenhuma, vale para todo o site)"}</legend>
          <Busca rotulo="Filtrar disciplinas" valor={filtro} aoMudar={setFiltro} placeholder="Filtrar disciplinas…" />
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-rule p-2">
            {groups.map((g) => {
              const areas = (g.areas as readonly string[]).filter((a) => !termo || nomeDaArea(a).toLocaleLowerCase("pt-BR").includes(termo));
              if (areas.length === 0) return null;
              return (
                <div key={g.id}>
                  <p className="pn-rotulo-mono">{GRUPOS_DEPARTAMENTO[`grupo-${g.id}`] ?? g.id}</p>
                  <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
                    {areas.map((a) => (
                      <Marca key={a} rotulo={nomeDaArea(a)} checked={marcadas.includes(a) || ja(papel, a)} disabled={ja(papel, a)} onChange={() => setMarcadas((m) => trocar(m, a))} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {marcadas.length > 0 && <p className="pn-ajuda">{marcadas.length === 1 ? "1 disciplina marcada." : `${marcadas.length} disciplinas marcadas.`} Agora clique em “Acrescentar à lista”.</p>}
        </fieldset>
      )}

      <div>
        <p className="pn-rotulo">Vai ser confiado</p>
        {escolhidas.length === 0 ? (
          <p className="pn-ajuda">Nada ainda. Escolha a função, marque as disciplinas e clique em “Acrescentar à lista”. Dá para juntar quantas funções quiser.</p>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-2" aria-label="Funções escolhidas">
            {escolhidas.map((item) => (
              <li key={`${item.papel}:${item.disciplina ?? ""}`}>
                <Selo tom="bordo">
                  {nomeDaFuncao(item, nomeDaArea)}
                  <button
                    type="button"
                    className="ml-1 inline-flex items-center rounded hover:text-oxblood"
                    aria-label={`Tirar da lista: ${nomeDaFuncao(item, nomeDaArea)}`}
                    onClick={() => aoMudar(escolhidas.filter((e) => e !== item))}
                  >
                    <X aria-hidden className="h-3.5 w-3.5" />
                  </button>
                </Selo>
              </li>
            ))}
          </ul>
        )}
      </div>

      {departamentos && aoMudarDepartamentos && (
        <fieldset>
          <legend className="pn-rotulo">Departamentos de participação (opcional)</legend>
          <p className="pn-ajuda">Para quem participa sem uma função de trabalho: a pessoa entra no grupo de conversa e na página do departamento.</p>
          <div className="mt-1 grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
            {DEPARTAMENTOS_DO_INSTITUTO.filter((d) => d.participacao && (podeSensivel || !d.sensivel)).map((d) => (
              <Marca key={d.id} rotulo={d.nome} ajuda={d.sensivel ? "Reservado: só a coordenação vê quem participa." : undefined} checked={departamentos.includes(d.id)} onChange={() => aoMudarDepartamentos(trocar(departamentos, d.id))} />
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
