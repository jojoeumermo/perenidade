// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { type Me } from "@/lib/backend";
import { Aviso, botao, botaoClaro, campo, data, elo, useAcao, useLista } from "./comum";

// O mapa de núcleos (uma das ideias do painel) e as conquistas da equipe. O núcleo fica só com cidade e estado: o
// painel não guarda endereço nem nome de participante (supabase/install.sql, "Núcleos e conquistas da equipe").

interface Nucleo {
  id: string;
  nome: string;
  cidade: string;
  uf: string;
  tipo: string;
  encontros: string;
  pessoas: number | null;
  ativo: boolean;
  acompanha: string;
  atualizado_em: string;
  mexo: boolean;
  publico: boolean;
  ponto: string;
  contato: string;
  /** Quem pode pôr no mapa público do site (coordenação e vice). */
  publica: boolean;
}

/** O Brasil em quadradinhos, um por estado, mais ou menos onde cada um fica no mapa (linha, coluna). */
const MAPA: [string, number, number][] = [
  ["RR", 0, 2], ["AP", 0, 4],
  ["AM", 1, 1], ["PA", 1, 3], ["MA", 1, 4], ["CE", 1, 5], ["RN", 1, 6],
  ["AC", 2, 0], ["RO", 2, 1], ["MT", 2, 2], ["TO", 2, 3], ["PI", 2, 4], ["PE", 2, 5], ["PB", 2, 6],
  ["MS", 3, 2], ["GO", 3, 3], ["DF", 3, 4], ["BA", 3, 5], ["AL", 3, 6],
  ["SP", 4, 3], ["MG", 4, 4], ["ES", 4, 5], ["SE", 4, 6],
  ["PR", 5, 3], ["RJ", 5, 4],
  ["SC", 6, 3],
  ["RS", 7, 3],
];
const TIPOS: [string, string][] = [
  ["bairro", "No bairro"],
  ["escola", "Na escola"],
  ["trabalho", "No trabalho"],
  ["universidade", "Na universidade"],
  ["online", "Pela internet"],
  ["outro", "Outro"],
];
const nomeDoTipo = Object.fromEntries(TIPOS);

export function Nucleos({ me }: { me: Me }) {
  const lista = useLista<Nucleo[]>("nucleos_listar");
  const acao = useAcao(lista.recarregar);
  const [uf, setUf] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [novo, setNovo] = useState<{ nome: string; cidade: string; uf: string; tipo: string; encontros: string; pessoas: string } | null>(null);
  const ativos = (lista.dados ?? []).filter((n) => n.ativo);
  const porUf = (sigla: string) => ativos.filter((n) => n.uf === sigla).length;
  const maior = Math.max(1, ...MAPA.map(([s]) => porUf(s)));
  const vistos = (lista.dados ?? []).filter((n) => !uf || n.uf === uf);

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-ink-soft">
        Os núcleos são grupos que fazem as aulas juntos: no bairro, na escola, no trabalho. Por segurança, o painel guarda só a cidade, o estado e quem da equipe acompanha: nada de endereço nem nome de quem participa.
      </p>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section aria-label="Mapa dos núcleos por estado">
          <div className="grid grid-cols-7 gap-1" style={{ gridTemplateRows: "repeat(8, minmax(0, 1fr))" }}>
            {MAPA.map(([sigla, linha, coluna]) => {
              const n = porUf(sigla);
              const forca = n === 0 ? 0 : 0.25 + 0.75 * (n / maior);
              return (
                <button
                  key={sigla}
                  type="button"
                  onClick={() => setUf(uf === sigla ? null : sigla)}
                  aria-pressed={uf === sigla}
                  title={`${sigla}: ${n} ${n === 1 ? "núcleo" : "núcleos"}`}
                  style={{ gridRow: linha + 1, gridColumn: coluna + 1, backgroundColor: n ? `rgba(194, 31, 22, ${forca})` : undefined }}
                  className={`flex aspect-square cursor-pointer flex-col items-center justify-center border-2 text-[0.7rem] font-bold ${uf === sigla ? "border-ink" : "border-rule"} ${n ? "text-white" : "bg-parchment-deep text-ink-soft"}`}
                >
                  {sigla}
                  {n > 0 && <span className="font-mono text-[0.62rem]">{n}</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            {ativos.length} {ativos.length === 1 ? "núcleo ativo" : "núcleos ativos"}. Clique num estado para filtrar.
            {uf && (
              <>
                {" "}
                <button type="button" className={elo} onClick={() => setUf(null)}>Ver todos</button>
              </>
            )}
          </p>
        </section>

        <section aria-label="Núcleos" className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-serif text-2xl font-semibold">{uf ? `Núcleos em ${uf}` : "Todos os núcleos"}</h2>
            {!novo && <button type="button" className={botao} onClick={() => setNovo({ nome: "", cidade: "", uf: uf ?? "", tipo: "bairro", encontros: "", pessoas: "" })}>＋ Cadastrar um núcleo</button>}
          </div>
          {novo && (
            <form
              className="mt-3 space-y-3 border-2 border-ink bg-folha p-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await acao.agir("nucleo_salvar", { p_id: null, p: novo }, "Núcleo cadastrado. Você aparece como quem acompanha.");
                if (ok !== null) setNovo(null);
              }}
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem]">
                <label className="block text-sm">
                  Nome do núcleo
                  <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} maxLength={80} className={campo} placeholder="Núcleo da laje" />
                </label>
                <label className="block text-sm">
                  Cidade
                  <input value={novo.cidade} onChange={(e) => setNovo({ ...novo, cidade: e.target.value })} maxLength={80} className={campo} />
                </label>
                <label className="block text-sm">
                  Estado
                  <select value={novo.uf} onChange={(e) => setNovo({ ...novo, uf: e.target.value })} className={campo}>
                    <option value="">—</option>
                    {[...MAPA.map(([s]) => s)].sort().map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    <option value="EX">Exterior</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_8rem]">
                <label className="block text-sm">
                  Onde se encontra
                  <select value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })} className={campo}>
                    {TIPOS.map(([id, nome]) => (
                      <option key={id} value={id}>{nome}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Quando (sem endereço)
                  <input value={novo.encontros} onChange={(e) => setNovo({ ...novo, encontros: e.target.value })} maxLength={200} className={campo} placeholder="sábados às 15h" />
                </label>
                <label className="block text-sm">
                  Quantas pessoas
                  <input type="number" min={1} max={500} value={novo.pessoas} onChange={(e) => setNovo({ ...novo, pessoas: e.target.value })} className={campo} />
                </label>
              </div>
              <Aviso texto={acao.aviso} />
              <p className="flex gap-2">
                <button type="submit" className={botao} disabled={acao.ocupado || novo.nome.trim().length < 3 || novo.cidade.trim().length < 2 || !novo.uf}>Cadastrar</button>
                <button type="button" className={botaoClaro} onClick={() => setNovo(null)}>Cancelar</button>
              </p>
            </form>
          )}
          {!novo && <Aviso texto={lista.erro || acao.aviso} />}
          {lista.dados && vistos.length === 0 && <p className="mt-3 text-ink-soft">{uf ? "Nenhum núcleo neste estado ainda." : "Nenhum núcleo cadastrado ainda. Conhece um? Cadastre."}</p>}
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {vistos.map((n) => (
              <li key={n.id} className={`border-2 border-ink p-3 ${n.ativo ? "bg-folha" : "bg-parchment-deep opacity-70"}`}>
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-prelo-texto">{n.cidade} · {n.uf} · {nomeDoTipo[n.tipo] ?? n.tipo}</p>
                <p className="font-semibold">{n.nome}{!n.ativo && " (parado)"}</p>
                <p className="text-xs text-ink-soft">
                  {[n.encontros, n.pessoas ? `${n.pessoas} pessoas` : "", n.acompanha ? `acompanhado por ${n.acompanha}` : "", `atualizado em ${data(n.atualizado_em)}`].filter(Boolean).join(" · ")}
                </p>
                {n.publico && <p className="mt-1 text-xs font-semibold text-[#2f6b3a]">No mapa público do site{n.ponto ? ` · ${n.ponto}` : ""}</p>}
                {n.mexo && (
                  <p className="mt-1 flex flex-wrap gap-x-3">
                    <button type="button" className={`${elo} text-xs`} disabled={acao.ocupado} onClick={() => void acao.agir("nucleo_salvar", { p_id: n.id, p: { ativo: !n.ativo } }, n.ativo ? "Marcado como parado." : "Marcado como ativo de novo.")}>
                      {n.ativo ? "Marcar como parado" : "Voltou a se encontrar"}
                    </button>
                    <button type="button" className={`${elo} text-xs`} onClick={() => setEditando(editando === n.id ? null : n.id)}>Ponto público e contato</button>
                    {n.publica && (
                      <button type="button" className={`${elo} text-xs`} disabled={acao.ocupado} onClick={() => void acao.agir("nucleo_salvar", { p_id: n.id, p: { publico: !n.publico } }, n.publico ? "Saiu do mapa público." : "Está no mapa público do site.")}>
                        {n.publico ? "Tirar do mapa público" : "Pôr no mapa público"}
                      </button>
                    )}
                  </p>
                )}
                {editando === n.id && <PontoEContato nucleo={n} acao={acao} fechar={() => setEditando(null)} />}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <p className="text-xs text-ink-soft">Quem cadastrou, quem acompanha e a coordenação mudam o núcleo. {me.papeis.length > 0 ? "Para formar um núcleo, o percurso Consciência de classe tem o roteiro dos encontros." : ""}</p>
    </div>
  );
}

/**
 * O que o núcleo mostra se a coordenação o puser no mapa público: um ponto de encontro público (praça, biblioteca,
 * sindicato) e o contato do próprio núcleo. Nunca a casa ou o telefone de alguém.
 */
function PontoEContato({ nucleo, acao, fechar }: { nucleo: Nucleo; acao: ReturnType<typeof useAcao>; fechar: () => void }) {
  const [ponto, setPonto] = useState(nucleo.ponto);
  const [contato, setContato] = useState(nucleo.contato);
  return (
    <form
      className="mt-2 space-y-2 border-t border-rule pt-2 text-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        if ((await acao.agir("nucleo_salvar", { p_id: nucleo.id, p: { ponto, contato } }, "Guardado.")) !== null) fechar();
      }}
    >
      <label className="block">
        Ponto de encontro público (opcional)
        <input value={ponto} onChange={(e) => setPonto(e.target.value)} maxLength={120} className={campo} placeholder="Biblioteca comunitária, praça, sede do sindicato" />
      </label>
      <label className="block">
        Contato do núcleo (opcional)
        <input value={contato} onChange={(e) => setContato(e.target.value)} className={campo} placeholder="https://instagram.com/…" inputMode="url" />
      </label>
      <p className="text-xs text-ink-soft">Nunca a casa nem o telefone de uma pessoa: só lugar público e contato do próprio núcleo.</p>
      <p className="flex gap-2">
        <button type="submit" className={botao} disabled={acao.ocupado}>Guardar</button>
        <button type="button" className={botaoClaro} onClick={fechar}>Cancelar</button>
      </p>
    </form>
  );
}

interface Conquistas {
  aulas: number;
  aulas_mes: number;
  materias: number;
  videoaulas: number;
  horas: number;
  horas_mes: number;
  pessoas: number;
  pedidos_feitos_mes: number;
  nucleos: number;
}

/** Na Mesa: o que a equipe inteira já fez. Nada por pessoa, sem ranking. */
export function ConquistasDaEquipe() {
  const c = useLista<Conquistas>("conquistas_da_equipe", {}, { quieta: true }).dados;
  if (!c) return null;
  const numeros: [number, string][] = (
    [
      [c.aulas, "aulas no ar"],
      [c.videoaulas, "aulas em vídeo"],
      [c.materias, "matérias no jornal"],
      [c.horas, "horas de voluntariado"],
      [c.pessoas, "pessoas na equipe"],
      [c.nucleos, "núcleos de estudo"],
    ] as [number, string][]
  ).filter(([n]) => n > 0);
  if (numeros.length === 0) return null;
  return (
    <section aria-labelledby="conquistas" className="border-2 border-ink bg-[#1f1a14] p-5 text-[#f4ecd8]">
      <p id="conquistas" className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-[#e0837a]">O que a equipe já fez junto</p>
      <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {numeros.map(([n, nome]) => (
          <div key={nome}>
            <dd className="font-serif text-3xl font-semibold leading-none">{n.toLocaleString("pt-BR")}</dd>
            <dt className="mt-1 text-xs text-[#cdbb91]">{nome}</dt>
          </div>
        ))}
      </dl>
      {(c.aulas_mes > 0 || c.horas_mes > 0 || c.pedidos_feitos_mes > 0) && (
        <p className="mt-3 text-sm text-[#e9dcbc]">
          Este mês: {[c.aulas_mes ? `${c.aulas_mes} aulas aprovadas` : "", c.horas_mes ? `${c.horas_mes} horas` : "", c.pedidos_feitos_mes ? `${c.pedidos_feitos_mes} pedidos entre departamentos resolvidos` : ""].filter(Boolean).join(" · ")}.
        </p>
      )}
    </section>
  );
}
