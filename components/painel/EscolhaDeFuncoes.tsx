// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Escolher várias funções, várias disciplinas e vários departamentos para a mesma pessoa (T28). Serve a Confiar função
// (Pessoas) e ao convite pessoal (Convites). A regra de verdade (quem confia o quê a quem) é conferida no banco:
// public.papeis_conceder_varios e public.convite_criar (supabase/migracoes/20261106-pessoas-painel.sql).

import { Plus, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import territoriosDoSite from "@/content/territorios.json";
import { groups } from "@/lib/areas";
import type { Role } from "@/lib/backend";
import { useI18n } from "../I18n";
import { GRUPOS_DEPARTAMENTO, oQueFaz, papeis } from "./comum";
import { DEPARTAMENTOS_DE_PARTICIPACAO, DEPARTAMENTOS_DO_INSTITUTO, NOMES_DOS_DEPARTAMENTOS_DO_INSTITUTO } from "./departamentos-do-instituto";
import { Botao, Busca, Marca, Selecao, Selo } from "./ui";

export interface FuncaoEscolhida {
  papel: Role["papel"];
  /** Disciplina (educação, reforço…), departamento (representante) ou nada (vale para todo o site). */
  disciplina: string | null;
}

/** Funções que só existem com disciplina: sem ela, a pessoa enxergaria a fila de todas. */
export const POR_DISCIPLINA: Role["papel"][] = ["educacao", "educacao_secundaria", "mentoria"];
/** O parceiro do instituto é por território (a página dele em Territórios), como o representante é por departamento. */
const TERRITORIOS = (territoriosDoSite.territorios as { slug: string; nome: string }[]).map((t) => [t.slug, t.nome] as [string, string]);
const nomeDoTerritorio = (slug: string) => TERRITORIOS.find(([id]) => id === slug)?.[1] ?? slug;

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
  const alvo =
    item.papel === "representante"
      ? (GRUPOS_DEPARTAMENTO[item.disciplina] ?? NOMES_DOS_DEPARTAMENTOS_DO_INSTITUTO[item.disciplina] ?? item.disciplina)
      : item.papel === "parceiro"
        ? nomeDoTerritorio(item.disciplina)
        : nomeDaArea(item.disciplina);
  return `${papeis[item.papel]} · ${alvo}`;
}

/**
 * Um passo numerado do "dar funções": pessoa → função → disciplinas (ou território, ou departamento) → departamentos → confirmar.
 * As telas que usam a escolha (Pessoas, Convites) põem o primeiro e o último passo; os do meio ficam aqui.
 */
export function Passo({ n, titulo, ajuda, children }: { n: number; titulo: string; ajuda?: ReactNode; children?: ReactNode }) {
  return (
    <section className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 gap-y-2" aria-label={`Passo ${n}: ${titulo}`}>
      <span aria-hidden className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--pn-borda-forte)] font-mono text-xs font-bold">
        {n}
      </span>
      <div className="min-w-0 space-y-2">
        <div>
          <p className="pn-rotulo" style={{ marginBottom: 0 }}>
            {titulo}
          </p>
          {ajuda && <p className="pn-ajuda">{ajuda}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

export function EscolhaDeFuncoes({
  concediveis,
  escolhidas,
  aoMudar,
  departamentos,
  aoMudarDepartamentos,
  podeSensivel,
  primeiroPasso = 1,
}: {
  concediveis: Role["papel"][];
  escolhidas: FuncaoEscolhida[];
  aoMudar: (lista: FuncaoEscolhida[]) => void;
  /** Os departamentos de participação marcados (Parcerias, RH…). Sem esta prop, a parte de departamentos não aparece. */
  departamentos?: string[];
  aoMudarDepartamentos?: (lista: string[]) => void;
  /** Só a coordenação põe alguém nos Revolucionários (dado sensível, LGPD art. 11). */
  podeSensivel: boolean;
  /** O número do passo "Função" (o passo antes dele, a pessoa ou o e-mail, fica na tela que usa a escolha). */
  primeiroPasso?: number;
}) {
  const { t } = useI18n();
  const nomeDaArea = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug;
  const [papel, setPapel] = useState<Role["papel"]>(concediveis.includes("educacao") ? "educacao" : (concediveis[0] ?? "educacao"));
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [filtro, setFiltro] = useState("");
  const precisa = POR_DISCIPLINA.includes(papel) || papel === "representante" || papel === "parceiro";
  const sem = SEM_DISCIPLINA.includes(papel);
  const ja = (p: Role["papel"], d: string | null) => escolhidas.some((e) => e.papel === p && e.disciplina === d);
  const trocar = (lista: string[], id: string) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
  const termo = filtro.trim().toLocaleLowerCase("pt-BR");

  function acrescentar() {
    const novas: FuncaoEscolhida[] = sem || marcadas.length === 0 ? [{ papel, disciplina: null }] : marcadas.map((d) => ({ papel, disciplina: d }));
    aoMudar([...escolhidas, ...novas.filter((n) => !ja(n.papel, n.disciplina))]);
    setMarcadas([]);
  }

  const marcadasNoGrupo = (areas: readonly string[]) => areas.filter((a) => marcadas.includes(a)).length;

  return (
    <div className="space-y-5">
      <Passo n={primeiroPasso} titulo="Função" ajuda={oQueFaz[papel]}>
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
      </Passo>

      <Passo
        n={primeiroPasso + 1}
        titulo={papel === "representante" ? "Departamentos que a pessoa vai representar" : papel === "parceiro" ? "Território do coletivo" : "Disciplinas"}
        ajuda={
          sem
            ? papel === "saude"
              ? "Sem disciplina: o cargo vale para o Mural de Saúde."
              : "Esta função não tem disciplina: vale para todo o site."
            : papel === "parceiro"
              ? "A pessoa posta as novidades e edita a página deste território, e só dele."
              : precisa
                ? "Marque um ou mais."
                : "Opcional: sem nenhuma, vale para todo o site."
        }
      >
        {sem ? null : papel === "representante" ? (
          <fieldset className="space-y-2">
            <legend className="sr-only">Departamentos que a pessoa vai representar</legend>
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
        ) : papel === "parceiro" ? (
          <fieldset>
            <legend className="sr-only">Território do coletivo</legend>
            <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
              {TERRITORIOS.map(([id, nome]) => (
                <Marca key={id} rotulo={nome} checked={marcadas.includes(id) || ja("parceiro", id)} disabled={ja("parceiro", id)} onChange={() => setMarcadas((m) => trocar(m, id))} />
              ))}
            </div>
          </fieldset>
        ) : (
          <fieldset className="space-y-2">
            <legend className="sr-only">Disciplinas</legend>
            <Busca rotulo="Filtrar disciplinas" valor={filtro} aoMudar={setFiltro} placeholder="Filtrar disciplinas…" />
            {/* Uma área por vez: a lista inteira aberta era longa demais. A busca abre as áreas em que achou alguma coisa. */}
            <div className="divide-y divide-[var(--pn-borda)] rounded-md border border-rule">
              {groups.map((g) => {
                const areas = (g.areas as readonly string[]).filter((a) => !termo || nomeDaArea(a).toLocaleLowerCase("pt-BR").includes(termo));
                if (areas.length === 0) return null;
                const n = marcadasNoGrupo(g.areas as readonly string[]);
                return (
                  <details key={`${g.id}-${termo ? "busca" : "lista"}`} open={Boolean(termo) || n > 0} className="px-2 py-1.5">
                    <summary className="flex cursor-pointer items-center justify-between gap-2 rounded py-1 font-semibold">
                      <span className="min-w-0 flex-1">{GRUPOS_DEPARTAMENTO[`grupo-${g.id}`] ?? g.id}</span>
                      <span className="pn-ajuda shrink-0 font-normal">
                        {n > 0 ? `${n} ${n === 1 ? "marcada" : "marcadas"} · ` : ""}
                        {areas.length} {areas.length === 1 ? "disciplina" : "disciplinas"}
                      </span>
                    </summary>
                    <div className="grid gap-x-4 pb-1 sm:grid-cols-2 lg:grid-cols-3">
                      {areas.map((a) => (
                        <Marca key={a} rotulo={nomeDaArea(a)} checked={marcadas.includes(a) || ja(papel, a)} disabled={ja(papel, a)} onChange={() => setMarcadas((m) => trocar(m, a))} />
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </fieldset>
        )}
        <p>
          <Botao simbolo={Plus} disabled={precisa && marcadas.length === 0} onClick={acrescentar}>
            {sem || marcadas.length <= 1 ? "Acrescentar à lista" : `Acrescentar ${marcadas.length} à lista`}
          </Botao>
        </p>
        <div>
          <p className="pn-rotulo-mono">Vai ser confiado</p>
          {escolhidas.length === 0 ? (
            <p className="pn-ajuda">Nada ainda. Escolha a função, marque o que for preciso e clique em “Acrescentar à lista”. Dá para juntar quantas funções quiser.</p>
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
      </Passo>

      {departamentos && aoMudarDepartamentos && (
        <Passo n={primeiroPasso + 2} titulo="Departamentos de participação (opcional)" ajuda="Para quem participa sem uma função de trabalho: a pessoa entra no grupo de conversa e na página do departamento.">
          <fieldset>
            <legend className="sr-only">Departamentos de participação</legend>
            <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
              {DEPARTAMENTOS_DO_INSTITUTO.filter((d) => d.participacao && (podeSensivel || !d.sensivel)).map((d) => (
                <Marca key={d.id} rotulo={d.nome} ajuda={d.sensivel ? "Reservado: só a coordenação vê quem participa." : undefined} checked={departamentos.includes(d.id)} onChange={() => aoMudarDepartamentos(trocar(departamentos, d.id))} />
              ))}
            </div>
          </fieldset>
        </Passo>
      )}
    </div>
  );
}
