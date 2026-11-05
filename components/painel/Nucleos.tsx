// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Globe, MapPin, Pause, Pencil, Play, Plus } from "lucide-react";
import { useState } from "react";
import { type Me } from "@/lib/backend";
import { Aviso, data, useAcao, useLista } from "./comum";
import { Botao, CabecalhoDeSecao, Campo, Cartao, Esqueleto, Estatistica, Estatisticas, Selecao, Selo, Vazio } from "./ui";

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
    <div className="pn-tela">
      <p className="max-w-3xl text-sm text-ink-soft">
        Os núcleos são grupos que fazem as aulas juntos: no bairro, na escola, no trabalho. Por segurança, o painel guarda só a cidade, o estado e quem da equipe acompanha: nada de endereço nem nome de quem participa.
      </p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Cartao aria-label="Mapa dos núcleos por estado" className="self-start">
          <div className="grid grid-cols-7 gap-1" style={{ gridTemplateRows: "repeat(8, minmax(0, 1fr))" }}>
            {MAPA.map(([sigla, linha, coluna]) => {
              const n = porUf(sigla);
              const forca = n === 0 ? 0 : 0.25 + 0.75 * (n / maior);
              // A faixa de 60% a 75% de bordô no tema claro não dá contraste AA nem com texto escuro nem com branco:
              // abaixo de 75%, a mistura vai de 15% a 60% (texto escuro); de 75% para cima, texto branco.
              const mistura = forca >= 0.75 ? forca : 0.15 + 0.45 * ((forca - 0.25) / 0.5);
              const escolhido = uf === sigla;
              return (
                <button
                  key={sigla}
                  type="button"
                  onClick={() => setUf(escolhido ? null : sigla)}
                  aria-pressed={escolhido}
                  title={`${sigla}: ${n} ${n === 1 ? "núcleo" : "núcleos"}`}
                  // A intensidade do bordô diz quantos núcleos há; o número escrito diz o mesmo (nunca só a cor).
                  style={{
                    gridRow: linha + 1,
                    gridColumn: coluna + 1,
                    backgroundColor: n ? `color-mix(in srgb, var(--pn-destaque) ${Math.round(mistura * 100)}%, var(--pn-superficie))` : "var(--pn-superficie-2)",
                    color: n ? (forca >= 0.75 ? "var(--pn-sobre-destaque)" : "var(--pn-texto)") : "var(--pn-texto-mudo)",
                    borderColor: escolhido ? "var(--pn-texto)" : "var(--pn-borda)",
                    boxShadow: escolhido ? "0 0 0 1px var(--pn-texto)" : undefined,
                  }}
                  className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md border text-[0.7rem] font-bold transition-colors"
                >
                  {sigla}
                  {n > 0 && <span className="font-mono text-[0.62rem] tabular-nums">{n}</span>}
                </button>
              );
            })}
          </div>
          <p className="pn-ajuda mt-3">
            {ativos.length} {ativos.length === 1 ? "núcleo ativo" : "núcleos ativos"}. Clique num estado para filtrar.
            {uf && (
              <>
                {" "}
                <Botao variante="discreto" pequeno onClick={() => setUf(null)}>
                  Ver todos
                </Botao>
              </>
            )}
          </p>
        </Cartao>

        <section aria-label="Núcleos" className="min-w-0 space-y-3">
          <CabecalhoDeSecao
            titulo={uf ? `Núcleos em ${uf}` : "Todos os núcleos"}
            simbolo={MapPin}
            acoes={
              !novo && (
                <Botao variante="principal" simbolo={Plus} onClick={() => setNovo({ nome: "", cidade: "", uf: uf ?? "", tipo: "bairro", encontros: "", pessoas: "" })}>
                  Cadastrar um núcleo
                </Botao>
              )
            }
          />
          {novo && (
            <Cartao as="div">
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const ok = await acao.agir("nucleo_salvar", { p_id: null, p: novo }, "Núcleo cadastrado. Você aparece como quem acompanha.");
                  if (ok !== null) setNovo(null);
                }}
              >
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem]">
                  <Campo rotulo="Nome do núcleo" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} maxLength={80} placeholder="Núcleo da laje" />
                  <Campo rotulo="Cidade" value={novo.cidade} onChange={(e) => setNovo({ ...novo, cidade: e.target.value })} maxLength={80} />
                  <Selecao rotulo="Estado" value={novo.uf} onChange={(e) => setNovo({ ...novo, uf: e.target.value })}>
                    <option value="">—</option>
                    {[...MAPA.map(([s]) => s)].sort().map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    <option value="EX">Exterior</option>
                  </Selecao>
                </div>
                <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_8rem]">
                  <Selecao rotulo="Onde se encontra" value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })}>
                    {TIPOS.map(([id, nome]) => (
                      <option key={id} value={id}>
                        {nome}
                      </option>
                    ))}
                  </Selecao>
                  <Campo rotulo="Quando (sem endereço)" value={novo.encontros} onChange={(e) => setNovo({ ...novo, encontros: e.target.value })} maxLength={200} placeholder="sábados às 15h" />
                  <Campo rotulo="Quantas pessoas" type="number" min={1} max={500} value={novo.pessoas} onChange={(e) => setNovo({ ...novo, pessoas: e.target.value })} />
                </div>
                <Aviso texto={acao.aviso} />
                <p className="flex gap-2">
                  <Botao type="submit" variante="principal" disabled={novo.nome.trim().length < 3 || novo.cidade.trim().length < 2 || !novo.uf} carregando={acao.ocupado}>
                    Cadastrar
                  </Botao>
                  <Botao onClick={() => setNovo(null)}>Cancelar</Botao>
                </p>
              </form>
            </Cartao>
          )}
          {!novo && <Aviso texto={lista.erro || acao.aviso} />}
          {!lista.dados && !lista.erro && <Esqueleto forma="cartoes" linhas={4} />}
          {lista.dados && vistos.length === 0 && <Vazio simbolo={MapPin} titulo={uf ? "Nenhum núcleo neste estado ainda." : "Nenhum núcleo cadastrado ainda. Conhece um? Cadastre."} />}
          <ul className="grid gap-3 sm:grid-cols-2">
            {vistos.map((n) => (
              <li key={n.id}>
                <Cartao as="article" variante={n.ativo ? "padrao" : "plano"} className={n.ativo ? "h-full" : "h-full opacity-70"}>
                  <p className="pn-rotulo-mono">
                    {n.cidade} · {n.uf} · {nomeDoTipo[n.tipo] ?? n.tipo}
                  </p>
                  <p className="mt-1 font-semibold">
                    {n.nome}
                    {!n.ativo && " (parado)"}
                  </p>
                  <p className="pn-ajuda">{[n.encontros, n.pessoas ? `${n.pessoas} pessoas` : "", n.acompanha ? `acompanhado por ${n.acompanha}` : "", `atualizado em ${data(n.atualizado_em)}`].filter(Boolean).join(" · ")}</p>
                  {n.publico && (
                    <p className="mt-2">
                      <Selo tom="ok" ponto>
                        No mapa público do site{n.ponto ? ` · ${n.ponto}` : ""}
                      </Selo>
                    </p>
                  )}
                  {n.mexo && (
                    <p className="mt-2 flex flex-wrap gap-1">
                      <Botao variante="discreto" pequeno simbolo={n.ativo ? Pause : Play} disabled={acao.ocupado} onClick={() => void acao.agir("nucleo_salvar", { p_id: n.id, p: { ativo: !n.ativo } }, n.ativo ? "Marcado como parado." : "Marcado como ativo de novo.")}>
                        {n.ativo ? "Marcar como parado" : "Voltou a se encontrar"}
                      </Botao>
                      <Botao variante="discreto" pequeno simbolo={Pencil} aria-expanded={editando === n.id} onClick={() => setEditando(editando === n.id ? null : n.id)}>
                        Ponto público e contato
                      </Botao>
                      {n.publica && (
                        <Botao variante="discreto" pequeno simbolo={Globe} disabled={acao.ocupado} onClick={() => void acao.agir("nucleo_salvar", { p_id: n.id, p: { publico: !n.publico } }, n.publico ? "Saiu do mapa público." : "Está no mapa público do site.")}>
                          {n.publico ? "Tirar do mapa público" : "Pôr no mapa público"}
                        </Botao>
                      )}
                    </p>
                  )}
                  {editando === n.id && <PontoEContato nucleo={n} acao={acao} fechar={() => setEditando(null)} />}
                </Cartao>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <p className="pn-ajuda">Quem cadastrou, quem acompanha e a coordenação mudam o núcleo. {me.papeis.length > 0 ? "Para formar um núcleo, o percurso Consciência de classe tem o roteiro dos encontros." : ""}</p>
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
      className="mt-3 space-y-2 border-t border-rule pt-3 text-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        if ((await acao.agir("nucleo_salvar", { p_id: nucleo.id, p: { ponto, contato } }, "Guardado.")) !== null) fechar();
      }}
    >
      <Campo rotulo="Ponto de encontro público (opcional)" value={ponto} onChange={(e) => setPonto(e.target.value)} maxLength={120} placeholder="Biblioteca comunitária, praça, sede do sindicato" />
      <Campo rotulo="Contato do núcleo (opcional)" value={contato} onChange={(e) => setContato(e.target.value)} placeholder="https://instagram.com/…" inputMode="url" />
      <p className="pn-ajuda">Nunca a casa nem o telefone de uma pessoa: só lugar público e contato do próprio núcleo.</p>
      <p className="flex gap-2">
        <Botao type="submit" pequeno carregando={acao.ocupado}>
          Guardar
        </Botao>
        <Botao pequeno onClick={fechar}>
          Cancelar
        </Botao>
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
    <section aria-labelledby="conquistas" className="space-y-2">
      <p id="conquistas" className="pn-rotulo-mono">
        O que a equipe já fez junto
      </p>
      <Estatisticas>
        {numeros.map(([n, nome]) => (
          <Estatistica key={nome} rotulo={nome} valor={n.toLocaleString("pt-BR")} />
        ))}
      </Estatisticas>
      {(c.aulas_mes > 0 || c.horas_mes > 0 || c.pedidos_feitos_mes > 0) && (
        <p className="pn-ajuda">
          Este mês: {[c.aulas_mes ? `${c.aulas_mes} aulas aprovadas` : "", c.horas_mes ? `${c.horas_mes} horas` : "", c.pedidos_feitos_mes ? `${c.pedidos_feitos_mes} pedidos entre departamentos resolvidos` : ""].filter(Boolean).join(" · ")}.
        </p>
      )}
    </section>
  );
}
