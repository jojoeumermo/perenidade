// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { can, type Me, rpc } from "@/lib/backend";
import { getItem, setItem } from "@/lib/storage";
import { TIPOS, type TipoDeLacuna } from "@/lib/tipos-de-tarefa";
import { useI18n } from "../I18n";
import { CampoData } from "./Campos";
import { Abas, Aviso, botao, botaoClaro, campo, data, dataHora, dia, elo, rotulo, textoDoErro, useAcao, useLista } from "./comum";

export interface Tarefa {
  id: string;
  tipo: string;
  alvo: string;
  titulo: string;
  descricao: string;
  detalhe: string;
  minutos: 5 | 15 | 30;
  dificuldade: "iniciante" | "intermediario" | "avancado";
  papel: string;
  impacto: string;
  origem: string;
  status: string;
  prazo: string | null;
  entrega: Record<string, string>;
  nota_revisao: string;
  minha: boolean;
  reservada_por: string;
  entregue_em?: string;
  espera_horas?: number;
}
interface ParaMim {
  sugestoes: Tarefa[];
  minhas: Tarefa[];
  filas: { revisao: number; triagem: number; traducoes: number };
  saude: { obras?: number; fichas_completas?: number; licencas_a_conferir?: number; aulas?: number; traducao_por_idioma?: Record<string, number>; em?: string };
  abertas: Record<string, number>;
  semanas: { semana: string; n: number }[];
  meta: { texto: string; alvo: number; tipo: string; feitas: number } | null;
  novato: boolean;
  mentores: number;
  mostrar?: boolean;
}

const infoDe = (tipo: string) => TIPOS[tipo as TipoDeLacuna] ?? TIPOS.avulsa;
const DIFICULDADE: Record<string, string> = { iniciante: "iniciante", intermediario: "intermediária", avancado: "avançada" };
const IDIOMAS: Record<string, string> = { en: "inglês", es: "espanhol", zh: "chinês", ru: "russo", fr: "francês" };
const LICENCAS = ["Domínio público", "CC BY", "CC BY-SA", "CC BY-NC", "CC BY-NC-SA", "CC BY-ND", "CC BY-NC-ND", "CC0", "Direitos reservados"];
const hojeIso = () => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`; };

/** O cartão de uma tarefa: o que é, quanto tempo leva, o que muda e como fazer. */
function CartaoDaTarefa({ t, acoes }: { t: Tarefa; acoes?: React.ReactNode }) {
  const info = infoDe(t.tipo);
  return (
    <article className="painel-cartao flex flex-col p-4">
      <p className={rotulo}>{info.nome} · {t.minutos} min · {DIFICULDADE[t.dificuldade] ?? t.dificuldade}</p>
      <h3 className="mt-1 font-serif text-lg font-semibold leading-snug">{t.titulo}</h3>
      {(t.detalhe || t.descricao) && <p className="mt-1 text-sm text-ink-soft">{t.tipo === "traducao" ? `Para o ${IDIOMAS[t.detalhe] ?? t.detalhe}` : t.descricao || t.detalhe}</p>}
      {(t.impacto || info.impacto) && <p className="mt-2 text-sm">✦ {t.impacto || info.impacto}</p>}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer underline">Como fazer</summary>
        <p className="mt-1 text-ink-soft">{info.como}</p>
        {t.alvo && <a href={`/pt${t.alvo}`} target="_blank" rel="noopener noreferrer" className={`${elo} mt-1 inline-block`}>Abrir {t.alvo.startsWith("/acervo") ? "a obra" : t.alvo.startsWith("/autores") ? "a página do autor" : "a aula"} ↗</a>}
      </details>
      {acoes && <div className="mt-auto flex flex-wrap gap-3 pt-3">{acoes}</div>}
    </article>
  );
}

/** O formulário de entrega, pelo tipo da tarefa: só os campos que aquela tarefa pede. */
export function Entrega({ t, depois, ir }: { t: Tarefa; depois: () => void; ir: (aba: string) => void }) {
  const acao = useAcao(depois);
  const [e, setE] = useState<Record<string, string>>(() => ({ ...t.entrega }));
  const mudar = (k: string, v: string) => setE((x) => ({ ...x, [k]: v }));
  const campoTexto = (k: string, rotuloDoCampo: string, linhas = 3) => (
    <label className="block text-sm">{rotuloDoCampo}<textarea value={e[k] ?? ""} onChange={(x) => mudar(k, x.target.value)} rows={linhas} maxLength={6000} className={campo} /></label>
  );
  const campos = () => {
    switch (t.tipo) {
      case "ficha_ano":
        return (<><label className="block text-sm">Ano da primeira publicação<input value={e.ano ?? ""} onChange={(x) => mudar("ano", x.target.value.replace(/[^\d-]/g, "").slice(0, 5))} inputMode="numeric" placeholder="1949" className={`${campo} max-w-32`} /></label>{campoTexto("texto", "Onde você achou (opcional)", 2)}</>);
      case "ficha_sinopse":
        return campoTexto("sinopse", "Sinopse (duas a quatro frases, com as suas palavras)", 5);
      case "licenca":
        return (<><label className="block text-sm">Licença<select value={e.licenca ?? ""} onChange={(x) => mudar("licenca", x.target.value)} className={campo}><option value="">Escolha</option>{LICENCAS.map((l) => <option key={l} value={l}>{l}</option>)}</select></label><label className="block text-sm">Link onde está escrito<input value={e.prova ?? ""} onChange={(x) => mudar("prova", x.target.value.trim())} placeholder="https://…" className={campo} /></label>{campoTexto("texto", "Observação (opcional)", 2)}</>);
      case "link":
        return (<><label className="block text-sm">Endereço novo<input value={e.url ?? ""} onChange={(x) => mudar("url", x.target.value.trim())} placeholder="https://…" className={campo} /></label>{campoTexto("texto", "Observação (opcional)", 2)}</>);
      case "duplicata":
        return (<><fieldset className="text-sm"><legend>As duas obras são</legend><label className="mr-4"><input type="radio" checked={e.decisao === "mesma"} onChange={() => mudar("decisao", "mesma")} /> a mesma</label><label><input type="radio" checked={e.decisao === "diferentes"} onChange={() => mudar("decisao", "diferentes")} /> diferentes</label></fieldset>{campoTexto("texto", "Por quê (opcional)", 2)}</>);
      case "sem_ligacao":
        return (<><label className="block text-sm">Aula em que a obra entra<input value={e.aula ?? ""} onChange={(x) => mudar("aula", x.target.value.trim())} placeholder="/trilhas/…/…" className={campo} /></label>{campoTexto("texto", "Em que ponto da aula e por quê", 2)}</>);
      case "biografia":
        return campoTexto("biografia", "Biografia (três a seis parágrafos curtos, com as fontes no fim)", 8);
      case "imagem_alt":
        return <label className="block text-sm">Descrição da imagem<input value={e.alt ?? ""} onChange={(x) => mudar("alt", x.target.value)} maxLength={300} className={campo} /></label>;
      case "traducao":
        return (<><p className="text-sm">A tradução é feita e enviada pelo editor lado a lado de Traduções. Depois de enviar, conte aqui.</p><button type="button" className={botaoClaro} onClick={() => ir("traducoes")}>Abrir Traduções</button>{campoTexto("texto", "O que você enviou", 2)}</>);
      default:
        return campoTexto("texto", "O que você fez", 4);
    }
  };
  return (
    <div className="mt-3 space-y-2 border-t border-rule pt-3">
      {t.nota_revisao && <p className="border-l-4 border-oxblood pl-2 text-sm">Voltou com um comentário: {t.nota_revisao}</p>}
      {campos()}
      <p className="flex flex-wrap gap-3">
        <button type="button" className={botao} disabled={acao.ocupado} onClick={() => void acao.agir("tarefa_entregar", { p_id: t.id, p_entrega: e }, "Entregue ✓ Alguém da equipe revisa e você recebe um recado.")}>Entregar</button>
        <button type="button" className={elo} disabled={acao.ocupado} onClick={() => void acao.agir("tarefa_liberar", { p_id: t.id }, "Liberada: a tarefa voltou para a fila. Sem problema.")}>Liberar</button>
        {t.dificuldade === "iniciante" && <button type="button" className={elo} disabled={acao.ocupado} onClick={() => void acao.agir("tarefa_pedir_mentor", { p_id: t.id }, "Pedido enviado a um mentor: ele chama você nas Conversas.")}>Pedir ajuda a um mentor</button>}
      </p>
      <Aviso texto={acao.aviso} />
    </div>
  );
}

/** Os cartões da saúde do acervo e do trabalho da equipe, com o gráfico das semanas e a meta coletiva. */
function Saude({ d }: { d: ParaMim }) {
  const s = d.saude;
  const pct = s.obras ? Math.round((100 * (s.fichas_completas ?? 0)) / s.obras) : null;
  const maxSemana = Math.max(1, ...d.semanas.map((x) => x.n));
  // A segunda-feira desta semana (o banco agrupa as semanas a partir da segunda).
  const [segunda] = useState(() => { const h = new Date(); h.setDate(h.getDate() - ((h.getDay() + 6) % 7)); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`; });
  const estaSemana = d.semanas.find((x) => x.semana === segunda)?.n ?? 0;
  return (
    <section aria-labelledby="saude-titulo">
      <h2 id="saude-titulo" className="jornal-secao"><span className="jornal-editoria">Saúde do acervo</span></h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="painel-cartao p-4"><p className={rotulo}>Fichas completas</p><p className="font-sans text-4xl font-black text-oxblood">{pct === null ? "—" : `${pct}%`}</p><p className="text-sm text-ink-soft">{s.obras ? `faltam ${s.obras - (s.fichas_completas ?? 0)} de ${s.obras} obras` : "o verificador ainda não rodou"}</p></div>
        <div className="painel-cartao p-4"><p className={rotulo}>Aulas sem tradução</p><ul className="mt-1 text-sm">{Object.entries(s.traducao_por_idioma ?? {}).map(([id, n]) => <li key={id}>{IDIOMAS[id] ?? id}: <strong>{n}</strong></li>)}</ul></div>
        <div className="painel-cartao p-4"><p className={rotulo}>Licenças a conferir</p><p className="font-sans text-4xl font-black">{s.licencas_a_conferir ?? "—"}</p><p className="text-sm text-ink-soft">links quebrados: {d.abertas.link ?? 0}</p></div>
        <div className="painel-cartao p-4"><p className={rotulo}>Tarefas abertas</p><ul className="mt-1 text-sm">{Object.entries(d.abertas).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tipo, n]) => <li key={tipo}>{infoDe(tipo).nome}: <strong>{n}</strong></li>)}{Object.keys(d.abertas).length === 0 && <li className="text-ok">Nenhuma: tudo em dia ✓</li>}</ul></div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="painel-cartao p-4">
          <p className="font-semibold">{estaSemana > 0 ? `A equipe completou ${estaSemana} ${estaSemana === 1 ? "tarefa" : "tarefas"} desde segunda.` : "Nenhuma tarefa concluída nesta semana ainda."}</p>
          <div className="mt-3 flex h-24 items-end gap-2" role="img" aria-label={`Tarefas concluídas nas últimas semanas: ${d.semanas.map((x) => `${dia(x.semana)}: ${x.n}`).join("; ")}`}>
            {d.semanas.map((x) => <div key={x.semana} className="flex flex-1 flex-col items-center gap-1"><div className="w-full bg-ok" style={{ height: `${(80 * x.n) / maxSemana}px` }} /><span className="font-mono text-[0.6rem] text-ink-soft">{x.semana.slice(8, 10)}/{x.semana.slice(5, 7)}</span></div>)}
            {d.semanas.length === 0 && <p className="text-sm text-ink-soft">O gráfico aparece com as primeiras tarefas concluídas.</p>}
          </div>
        </div>
        {d.meta && (
          <div className="painel-cartao p-4">
            <p className={rotulo}>Meta da semana</p>
            <p className="font-semibold">{d.meta.texto}</p>
            <div className="mt-2 h-3 bg-rule" role="progressbar" aria-valuemin={0} aria-valuemax={d.meta.alvo} aria-valuenow={d.meta.feitas} aria-label="Progresso da meta"><div className="h-3 bg-ok" style={{ width: `${Math.min(100, (100 * d.meta.feitas) / d.meta.alvo)}%` }} /></div>
            <p className="mt-1 text-sm">{d.meta.feitas} de {d.meta.alvo}</p>
          </div>
        )}
      </div>
    </section>
  );
}

/** O primeiro dia: o passo a passo e um exemplo resolvido, no lugar do "comece por aqui". */
function PrimeiroDia() {
  return (
    <div className="painel-cartao mb-4 p-4">
      <p className="font-semibold">Primeiro dia por aqui? Em cinco passos:</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
        <li>Escolha quanto tempo você tem hoje (5, 15 ou 30 minutos).</li>
        <li>Pegue uma tarefa marcada como <strong>iniciante</strong> e clique em <strong>Vou fazer esta</strong>.</li>
        <li>Abra “Como fazer” e a obra ou aula da tarefa.</li>
        <li>Preencha e clique em <strong>Entregar</strong>. Alguém da equipe revisa.</li>
        <li>Você recebe um recado dizendo o que mudou no site com o seu trabalho.</li>
      </ol>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer underline">Ver um exemplo resolvido</summary>
        <p className="mt-1"><strong>Tarefa:</strong> Completar o ano da obra “1984 (Nineteen Eighty-Four)”, de George Orwell.</p>
        <p><strong>O que foi feito:</strong> abri o link da obra, vi na página do Project Gutenberg “First published 1949”, escrevi <code>1949</code> no campo do ano e, em “onde você achou”, colei o endereço da página.</p>
        <p><strong>Resultado:</strong> depois da revisão, a obra passou a aparecer em 1949 na linha do tempo.</p>
      </details>
      <p className="mt-2 text-xs text-ink-soft">Nada de cobrança: se não der, é só liberar a tarefa. Ela volta para a fila sem problema.</p>
    </div>
  );
}

/** "Para você hoje": de 3 a 5 tarefas para o tempo que a pessoa tem, o que ela já pegou, as filas e a saúde do acervo. */
export function ParaVoceHoje({ me, ir }: { me: Me; ir: (aba: string) => void }) {
  const [minutos, setMinutos] = useState(() => Number(getItem("lucia:tarefas-minutos") ?? 15) || 15);
  const [pular, setPular] = useState<string[]>([]);
  const [descanso, setDescanso] = useState(() => getItem("lucia:tarefas-descanso") === hojeIso());
  const dados = useLista<ParaMim>("tarefas_para_mim", { p_minutos: minutos, p_pular: pular });
  const acao = useAcao(dados.recarregar);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const d = dados.dados;
  const escolherMinutos = (m: number) => { setMinutos(m); setPular([]); setItem("lucia:tarefas-minutos", String(m)); };

  if ((dados.erro && !d) || d?.mostrar === false) return null;
  return (
    <div className="space-y-8">
      <section aria-labelledby="pvh-titulo">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="pvh-titulo" className="jornal-secao"><span className="jornal-editoria">Para você hoje</span></h2>
          <span className="flex gap-1" role="group" aria-label="Quanto tempo você tem">
            {[5, 15, 30].map((m) => <button key={m} type="button" aria-pressed={minutos === m} onClick={() => escolherMinutos(m)} className={`cursor-pointer border px-3 py-1 text-sm ${minutos === m ? "border-ink bg-ink text-parchment" : "border-rule"}`}>{m} min</button>)}
          </span>
        </div>
        {descanso ? (
          <p className="mt-3 text-ink-soft">Combinado: hoje não. Até a próxima! <button type="button" className={elo} onClick={() => { setDescanso(false); setItem("lucia:tarefas-descanso", ""); }}>Mostrar mesmo assim</button></p>
        ) : !d ? (
          <p className="painel-carregando mt-3 text-ink-soft">Separando tarefas…</p>
        ) : (
          <>
            {d.novato && <div className="mt-4"><PrimeiroDia /></div>}
            {d.sugestoes.length === 0 ? (
              <p className="mt-4 border-2 border-ok bg-parchment-deep p-4">Nenhuma tarefa de até {minutos} minutos para você agora: a fila está em dia ✓ {minutos < 30 && <button type="button" className={elo} onClick={() => escolherMinutos(30)}>Ver as de 30 minutos</button>} {can(me, "traducao") || can(me, "revisao") ? "" : <button type="button" className={elo} onClick={() => ir("fila")}>Ou ajude na fila de revisão</button>}</p>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {d.sugestoes.map((t) => (
                  <div key={t.id}>
                    <CartaoDaTarefa
                      t={t}
                      acoes={abrindo === t.id ? null : <button type="button" className={botao} disabled={acao.ocupado} onClick={async () => { if (await acao.agir("tarefa_reservar", { p_id: t.id }, "Reservada no seu nome ✓")) setAbrindo(t.id); }}>Vou fazer esta</button>}
                    />
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 flex flex-wrap gap-3">
              {d.sugestoes.length > 0 && <button type="button" className={botaoClaro} onClick={() => setPular((p) => [...p, ...d.sugestoes.map((s) => s.id)])}>Outras sugestões</button>}
              <button type="button" className={elo} onClick={() => { setDescanso(true); setItem("lucia:tarefas-descanso", hojeIso()); }}>Nada para mim hoje</button>
              <button type="button" className={elo} onClick={() => ir("tarefas")}>Ver todas as tarefas</button>
            </p>
            <Aviso texto={acao.aviso} />
          </>
        )}
      </section>

      {d && d.minhas.length > 0 && (
        <section aria-labelledby="continuar-titulo">
          <h2 id="continuar-titulo" className="jornal-secao"><span className="jornal-editoria">Continuar de onde parou</span></h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {d.minhas.map((t) => (
              <div key={t.id} className="painel-cartao p-4">
                <p className={rotulo}>{infoDe(t.tipo).nome} · {t.status === "entregue" ? "entregue, esperando revisão" : t.prazo ? `até ${dataHora(t.prazo)}` : ""}</p>
                <p className="font-serif text-lg font-semibold">{t.titulo}</p>
                {t.status === "reservada" && <Entrega t={t} depois={dados.recarregar} ir={ir} />}
              </div>
            ))}
          </div>
        </section>
      )}

      {d && (
        <section aria-labelledby="filas-titulo">
          <h2 id="filas-titulo" className="jornal-secao"><span className="jornal-editoria">As filas de sempre</span></h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {can(me, "coordenacao", "curadoria", "traducao", "revisao") && <button type="button" className={botaoClaro} onClick={() => ir("traducoes")}>Traduções <span className="font-mono">({d.filas.traducoes})</span></button>}
            {can(me, "coordenacao", "supervisao", "curadoria", "revisao", "educacao") && <button type="button" className={botaoClaro} onClick={() => ir("fila")}>Fila de revisão <span className="font-mono">({d.filas.revisao})</span></button>}
            {can(me, "coordenacao", "curadoria", "mediacao") && <button type="button" className={botaoClaro} onClick={() => ir("triagem")}>Triagem <span className="font-mono">({d.filas.triagem})</span></button>}
            <button type="button" className={botaoClaro} onClick={() => ir("fontes")}>Fontes abertas</button>
          </div>
        </section>
      )}

      {d && <Saude d={d} />}
    </div>
  );
}

/** A seção Tarefas: a fila inteira, as minhas, a revisão rápida, mutirões e projetos, e os controles da coordenação. */
export function Tarefas({ me, ir }: { me: Me; ir: (aba: string) => void }) {
  const revisa = can(me, "coordenacao", "curadoria", "revisao", "supervisao");
  const coordena = can(me, "coordenacao");
  const [aba, setAba] = useState<"fila" | "minhas" | "revisao" | "mutiroes" | "configurar">("fila");
  return (
    <div>
      <Abas
        atual={aba}
        escolher={setAba}
        opcoes={[
          { id: "fila" as const, nome: "Fila" },
          { id: "minhas" as const, nome: "Minhas" },
          ...(revisa ? [{ id: "revisao" as const, nome: "Revisão rápida" }] : []),
          { id: "mutiroes" as const, nome: "Mutirões e projetos" },
          ...(coordena ? [{ id: "configurar" as const, nome: "Configurar e acompanhar" }] : []),
        ]}
      />
      {aba === "fila" && <Fila ir={ir} />}
      {aba === "minhas" && <Minhas ir={ir} />}
      {aba === "revisao" && revisa && <RevisaoRapida />}
      {aba === "mutiroes" && <MutiroesEProjetos me={me} />}
      {aba === "configurar" && coordena && <Configurar />}
    </div>
  );
}

function Fila({ ir }: { ir: (aba: string) => void }) {
  const [tipo, setTipo] = useState("");
  const [pagina, setPagina] = useState(0);
  const lista = useLista<Tarefa[]>("tarefas_listar", { p_tipo: tipo, p_status: "aberta", p_pagina: pagina });
  const acao = useAcao(lista.recarregar);
  return (
    <div>
      <label className="block max-w-sm text-sm">Tipo<select value={tipo} onChange={(e) => { setTipo(e.target.value); setPagina(0); }} className={campo}><option value="">Todos</option>{(Object.keys(TIPOS) as TipoDeLacuna[]).map((k) => <option key={k} value={k}>{TIPOS[k].nome}</option>)}</select></label>
      <Aviso texto={lista.erro || acao.aviso} />
      {lista.dados?.length === 0 ? (
        <p className="mt-4 border-2 border-ok bg-parchment-deep p-4">Nada aberto{tipo ? " deste tipo" : ""}: a fila está em dia ✓ {tipo && <button type="button" className={elo} onClick={() => setTipo("")}>Ver os outros tipos</button>}</p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.dados?.map((t) => <CartaoDaTarefa key={t.id} t={t} acoes={<button type="button" className={botao} disabled={acao.ocupado} onClick={async () => { if (await acao.agir("tarefa_reservar", { p_id: t.id }, "Reservada ✓ Ela está em “Minhas”.")) ir("tarefas"); }}>Vou fazer esta</button>} />)}
        </div>
      )}
      <p className="mt-4 flex gap-3">
        {pagina > 0 && <button type="button" className={botaoClaro} onClick={() => setPagina((p) => p - 1)}>← Anteriores</button>}
        {(lista.dados?.length ?? 0) === 50 && <button type="button" className={botaoClaro} onClick={() => setPagina((p) => p + 1)}>Próximas →</button>}
      </p>
    </div>
  );
}

function Minhas({ ir }: { ir: (aba: string) => void }) {
  const reservadas = useLista<Tarefa[]>("tarefas_listar", { p_tipo: "", p_status: "reservada", p_pagina: 0 });
  const minhas = (reservadas.dados ?? []).filter((t) => t.minha);
  return (
    <div>
      {minhas.length === 0 ? <p className="text-ink-soft">Você não tem tarefa reservada. Pegue uma na Fila ou em “Para você hoje”, na Mesa.</p> : (
        <div className="grid gap-3 md:grid-cols-2">
          {minhas.map((t) => (
            <div key={t.id} className="painel-cartao p-4">
              <p className={rotulo}>{infoDe(t.tipo).nome} · {t.prazo ? `até ${dataHora(t.prazo)}` : ""}</p>
              <p className="font-serif text-lg font-semibold">{t.titulo}</p>
              <details className="text-sm"><summary className="cursor-pointer underline">Como fazer</summary><p className="mt-1 text-ink-soft">{infoDe(t.tipo).como}</p>{t.alvo && <a href={`/pt${t.alvo}`} target="_blank" rel="noopener noreferrer" className={elo}>Abrir ↗</a>}</details>
              <Entrega t={t} depois={reservadas.recarregar} ir={ir} />
            </div>
          ))}
        </div>
      )}
      <Aviso texto={reservadas.erro} />
    </div>
  );
}

interface Ficha {
  id: string;
  titulo: string;
  autor: string;
  area: string;
  licenca: string;
  ano: string;
  url: string;
  faltam: string[];
  completude: "completa" | "parcial" | "vazia";
}

/** Revisão rápida: o antes (o que está no acervo) e o depois (a entrega), aprovar ou devolver com um comentário curto. */
function RevisaoRapida() {
  const lista = useLista<Tarefa[]>("tarefas_revisao");
  const acao = useAcao(lista.recarregar);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [fichas, setFichas] = useState<Map<string, Ficha>>(new Map());
  useEffect(() => {
    let vivo = true;
    fetch("/pt/acervo-fichas.json").then((r) => (r.ok ? r.json() : [])).then((l: Ficha[]) => vivo && setFichas(new Map(l.map((f) => [`/acervo/${f.id}`, f])))).catch(() => null);
    return () => { vivo = false; };
  }, []);
  const antes = (t: Tarefa) => {
    const f = fichas.get(t.alvo);
    if (!f) return t.detalhe || "—";
    if (t.tipo === "ficha_ano") return f.ano || "(sem ano)";
    if (t.tipo === "licenca") return f.licenca;
    if (t.tipo === "link") return f.url;
    return `${f.titulo} · ${f.autor}`;
  };
  return (
    <div>
      <p className="text-sm text-ink-soft">Meta de resposta: até 48 horas depois da entrega. Ficha aprovada entra no acervo na próxima publicação; a tarefa conclui quando o verificador vê a lacuna sumir.</p>
      <Aviso texto={lista.erro || acao.aviso} />
      {lista.dados?.length === 0 && <p className="mt-3 border-2 border-ok bg-parchment-deep p-4">Nada esperando revisão ✓</p>}
      <ul className="mt-3 space-y-3">
        {lista.dados?.map((t) => (
          <li key={t.id} className={`painel-cartao p-4 ${(t.espera_horas ?? 0) > 48 ? "border-2 border-gold" : ""}`}>
            <p className={rotulo}>{infoDe(t.tipo).nome} · de {t.reservada_por || "alguém"} · há {t.espera_horas ?? 0} h</p>
            <p className="font-serif text-lg font-semibold">{t.titulo} {t.alvo && <a href={`/pt${t.alvo}`} target="_blank" rel="noopener noreferrer" className={`${elo} text-sm`}>↗</a>}</p>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div className="border border-rule p-2 text-sm"><p className={rotulo}>Antes</p><p className="whitespace-pre-wrap" data-original>{antes(t)}</p></div>
              <div className="border border-ok p-2 text-sm"><p className={rotulo}>Depois</p>{Object.entries(t.entrega).map(([k, v]) => <p key={k} className="whitespace-pre-wrap" data-original><span className="text-ink-soft">{k}: </span>{k === "prova" || k === "url" ? <a href={v} target="_blank" rel="noopener noreferrer nofollow" className={elo}>{v}</a> : v}</p>)}</div>
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <button type="button" className={botao} disabled={acao.ocupado} onClick={() => void acao.agir("tarefa_revisar", { p_id: t.id, p_aprovar: true, p_nota: notas[t.id] ?? "" }, "Aprovada ✓ A pessoa recebeu a frase do que mudou.")}>Aprovar</button>
              <label className="min-w-60 flex-1 text-sm">Comentário (obrigatório para devolver)<input value={notas[t.id] ?? ""} onChange={(e) => setNotas({ ...notas, [t.id]: e.target.value })} maxLength={600} className={campo} /></label>
              <button type="button" className={botaoClaro} disabled={acao.ocupado || (notas[t.id] ?? "").trim().length < 5} onClick={() => void acao.agir("tarefa_revisar", { p_id: t.id, p_aprovar: false, p_nota: notas[t.id] ?? "" }, "Devolvida com o comentário.")}>Devolver</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface Mutirao {
  id: string;
  tema: string;
  descricao: string;
  tipo: string;
  meta: number;
  inicio: string;
  fim: string;
  reuniao: string | null;
  pessoas: number;
  inscrito: boolean;
  feitas: number;
}
interface Projeto {
  id: string;
  nome: string;
  descricao: string;
  responsavel: string;
  prazo: string | null;
  tarefas: number;
  feitas: number;
}

function MutiroesEProjetos({ me }: { me: Me }) {
  const cria = can(me, "coordenacao", "curadoria");
  const mutiroes = useLista<Mutirao[]>("mutiroes_listar");
  const projetos = useLista<Projeto[]>("projetos_listar");
  const acao = useAcao(() => { mutiroes.recarregar(); projetos.recarregar(); });
  const [m, setM] = useState({ tema: "", descricao: "", tipo: "", meta: "50", inicio: hojeIso(), fim: hojeIso() });
  const [p, setP] = useState({ nome: "", descricao: "", prazo: "" });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h2 className="font-serif text-2xl font-semibold">Mutirões</h2>
        <p className="text-sm text-ink-soft">Um tema, uma data e uma meta coletiva. Quem entra vê a barra subir com o trabalho de todo mundo.</p>
        <ul className="mt-3 space-y-3">
          {mutiroes.dados?.map((x) => (
            <li key={x.id} className="painel-cartao p-4">
              <p className="font-semibold">{x.tema}</p>
              <p className="text-xs text-ink-soft">{dia(x.inicio)} a {dia(x.fim)} · {x.pessoas} {x.pessoas === 1 ? "pessoa" : "pessoas"}{x.tipo ? ` · ${infoDe(x.tipo).nome}` : ""}</p>
              {x.descricao && <p className="mt-1 text-sm">{x.descricao}</p>}
              <div className="mt-2 h-2.5 bg-rule" role="progressbar" aria-valuemin={0} aria-valuemax={x.meta} aria-valuenow={x.feitas} aria-label={`Progresso de ${x.tema}`}><div className="h-2.5 bg-ok" style={{ width: `${Math.min(100, (100 * x.feitas) / x.meta)}%` }} /></div>
              <p className="mt-1 text-sm">{x.feitas} de {x.meta}</p>
              <button type="button" className={`mt-2 ${x.inscrito ? elo : botaoClaro}`} disabled={acao.ocupado} onClick={() => void acao.agir("mutirao_inscrever", { p_id: x.id, p_entrar: !x.inscrito }, x.inscrito ? "Você saiu do mutirão." : "Você entrou no mutirão ✓")}>{x.inscrito ? "Sair do mutirão" : "Entrar no mutirão"}</button>
              {x.reuniao && <p className="mt-1 text-xs text-ink-soft">Tem sala marcada em Reuniões.</p>}
            </li>
          ))}
          {mutiroes.dados?.length === 0 && <li className="text-ink-soft">Nenhum mutirão agora.</li>}
        </ul>
        {cria && (
          <div className="painel-cartao mt-4 space-y-2 p-4">
            <p className="font-semibold">Novo mutirão</p>
            <input value={m.tema} onChange={(e) => setM({ ...m, tema: e.target.value })} placeholder="Tema (ex.: 100 fichas de história)" aria-label="Tema" maxLength={140} className={campo} />
            <textarea value={m.descricao} onChange={(e) => setM({ ...m, descricao: e.target.value })} placeholder="Descrição" aria-label="Descrição" rows={2} maxLength={1000} className={campo} />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-sm">Tipo de tarefa<select value={m.tipo} onChange={(e) => setM({ ...m, tipo: e.target.value })} className={campo}><option value="">Qualquer</option>{(Object.keys(TIPOS) as TipoDeLacuna[]).map((k) => <option key={k} value={k}>{TIPOS[k].nome}</option>)}</select></label>
              <label className="block text-sm">Meta<input type="number" min={1} max={10000} value={m.meta} onChange={(e) => setM({ ...m, meta: e.target.value })} className={campo} /></label>
              <CampoData rotulo="Começa" valor={m.inicio} mudar={(v) => setM({ ...m, inicio: v })} className="text-sm" />
              <CampoData rotulo="Termina" valor={m.fim} mudar={(v) => setM({ ...m, fim: v })} className="text-sm" />
            </div>
            <button type="button" className={botao} disabled={acao.ocupado || m.tema.trim().length < 3} onClick={async () => { if (await acao.agir("mutirao_salvar", { p: { ...m, meta: Number(m.meta) } }, "Mutirão criado ✓")) setM({ ...m, tema: "", descricao: "" }); }}>Criar o mutirão</button>
          </div>
        )}
      </section>
      <section>
        <h2 className="font-serif text-2xl font-semibold">Projetos</h2>
        <p className="text-sm text-ink-soft">Para quem quer mais do que microtarefas: uma coleção nova, uma trilha inteira.</p>
        <ul className="mt-3 space-y-3">
          {projetos.dados?.map((x) => (
            <li key={x.id} className="painel-cartao p-4">
              <p className="font-semibold">{x.nome}</p>
              <p className="text-xs text-ink-soft">{x.responsavel ? `Responsável: ${x.responsavel}` : "Sem responsável ainda"}{x.prazo ? ` · até ${dia(x.prazo)}` : ""} · {x.feitas} de {x.tarefas} tarefas</p>
              {x.descricao && <p className="mt-1 text-sm">{x.descricao}</p>}
            </li>
          ))}
          {projetos.dados?.length === 0 && <li className="text-ink-soft">Nenhum projeto ativo.</li>}
        </ul>
        {cria && (
          <div className="painel-cartao mt-4 space-y-2 p-4">
            <p className="font-semibold">Novo projeto</p>
            <input value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} placeholder="Nome" aria-label="Nome do projeto" maxLength={140} className={campo} />
            <textarea value={p.descricao} onChange={(e) => setP({ ...p, descricao: e.target.value })} placeholder="O que é e o que precisa" aria-label="Descrição do projeto" rows={2} maxLength={1500} className={campo} />
            <CampoData rotulo="Prazo (opcional)" valor={p.prazo} mudar={(v) => setP({ ...p, prazo: v })} className="text-sm" />
            <button type="button" className={botao} disabled={acao.ocupado || p.nome.trim().length < 3} onClick={async () => { if (await acao.agir("projeto_salvar", { p }, "Projeto criado ✓")) setP({ nome: "", descricao: "", prazo: "" }); }}>Criar o projeto</button>
          </div>
        )}
        <Aviso texto={acao.aviso || mutiroes.erro || projetos.erro} />
      </section>
    </div>
  );
}

interface ConfigDasTarefas {
  regras: Record<string, boolean>;
  max_por_ciclo: number;
  max_reservas: number;
  meta: { texto: string; alvo: number; tipo: string } | null;
  mostrar?: boolean;
  ciclo?: { em: string; novas: number; encerradas: number; concluidas: number } | null;
}
interface VisaoGeral {
  por_tipo: Record<string, { abertas: number; reservadas: number; entregues: number; concluidas_30: number }>;
  por_pessoa: { nome: string; reservadas: number; feitas_30: number }[];
  revisao_horas: number | null;
  esperando_revisao: number;
  paradas: { titulo: string; nome: string; desde: string }[];
  falta_gente: string[];
}

function Configurar() {
  const config = useLista<ConfigDasTarefas>("tarefas_painel_config");
  const visao = useLista<VisaoGeral>("tarefas_visao_geral");
  const acao = useAcao(() => { config.recarregar(); visao.recarregar(); });
  const [meta, setMeta] = useState<{ texto: string; alvo: string; tipo: string } | null>(null);
  const [avulsa, setAvulsa] = useState({ titulo: "", descricao: "", minutos: "15", papel: "", impacto: "", alvo: "" });
  const [verificando, setVerificando] = useState("");
  const c = config.dados;
  const v = visao.dados;
  async function verificarAgora() {
    setVerificando("Lendo o verificador do site publicado…");
    try {
      const d = await (await fetch("/pt/lacunas.json")).json();
      const r = await rpc<{ novas: number; concluidas: number; encerradas: number }>("tarefas_sincronizar", { p_lacunas: d.lacunas, p_saude: d.saude });
      setVerificando(`Feito ✓ ${r.novas} novas, ${r.concluidas} concluídas, ${r.encerradas} encerradas.`);
      config.recarregar();
      visao.recarregar();
    } catch (erro) {
      setVerificando(textoDoErro(erro));
    }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="painel-cartao p-5">
        <h2 className="font-serif text-xl font-semibold">Regras do verificador</h2>
        <p className="text-sm text-ink-soft">O verificador roda a cada publicação. Regra desligada não abre tarefa nova (as abertas continuam).</p>
        {c && <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={c.mostrar !== false} disabled={acao.ocupado} onChange={() => void acao.agir("tarefas_configurar", { p: { mostrar: c.mostrar === false } }, "Guardado ✓")} /> Mostrar “Para você hoje” na Mesa da equipe</label>}
        {c && (
          <ul className="mt-3 space-y-1 text-sm">
            {Object.entries(c.regras).map(([k, ligada]) => (
              <li key={k}><label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={ligada} disabled={acao.ocupado} onChange={() => void acao.agir("tarefas_configurar", { p: { regras: { [k]: !ligada } } }, "Guardado ✓")} /> {infoDe(k).nome}</label></li>
            ))}
          </ul>
        )}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block text-sm">Tarefas novas por rodada<input type="number" min={1} max={500} defaultValue={c?.max_por_ciclo} key={`c${c?.max_por_ciclo}`} onBlur={(e) => { if (Number(e.target.value) !== c?.max_por_ciclo) void acao.agir("tarefas_configurar", { p: { max_por_ciclo: Number(e.target.value) } }, "Guardado ✓"); }} className={campo} /></label>
          <label className="block text-sm">Reservas por pessoa ao mesmo tempo<input type="number" min={1} max={20} defaultValue={c?.max_reservas} key={`r${c?.max_reservas}`} onBlur={(e) => { if (Number(e.target.value) !== c?.max_reservas) void acao.agir("tarefas_configurar", { p: { max_reservas: Number(e.target.value) } }, "Guardado ✓"); }} className={campo} /></label>
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-3"><button type="button" className={botaoClaro} onClick={() => void verificarAgora()}>Verificar agora</button><span className="text-sm" role="status">{verificando || (c?.ciclo ? `Última rodada: ${dataHora(c.ciclo.em)} (${c.ciclo.novas} novas)` : "")}</span></p>
        <h3 className="mt-5 font-semibold">Meta da semana</h3>
        <div className="mt-2 grid gap-2">
          <input value={meta?.texto ?? c?.meta?.texto ?? ""} onChange={(e) => setMeta({ texto: e.target.value, alvo: meta?.alvo ?? String(c?.meta?.alvo ?? 50), tipo: meta?.tipo ?? c?.meta?.tipo ?? "" })} placeholder="Ex.: 50 fichas completas até domingo" aria-label="Texto da meta" maxLength={140} className={campo} />
          <div className="grid gap-2 sm:grid-cols-2">
            <input type="number" min={1} value={meta?.alvo ?? String(c?.meta?.alvo ?? 50)} onChange={(e) => setMeta({ texto: meta?.texto ?? c?.meta?.texto ?? "", alvo: e.target.value, tipo: meta?.tipo ?? c?.meta?.tipo ?? "" })} aria-label="Número da meta" className={campo} />
            <select value={meta?.tipo ?? c?.meta?.tipo ?? ""} onChange={(e) => setMeta({ texto: meta?.texto ?? c?.meta?.texto ?? "", alvo: meta?.alvo ?? String(c?.meta?.alvo ?? 50), tipo: e.target.value })} aria-label="Tipo de tarefa da meta" className={campo}><option value="">Qualquer tarefa</option>{(Object.keys(TIPOS) as TipoDeLacuna[]).map((k) => <option key={k} value={k}>{TIPOS[k].nome}</option>)}</select>
          </div>
          <p className="flex gap-3">
            <button type="button" className={botaoClaro} disabled={!meta || meta.texto.trim().length < 3} onClick={async () => { if (meta && (await acao.agir("tarefas_configurar", { p: { meta: { texto: meta.texto, alvo: Number(meta.alvo), tipo: meta.tipo } } }, "Meta guardada ✓"))) setMeta(null); }}>Guardar a meta</button>
            {c?.meta && <button type="button" className={elo} onClick={() => void acao.agir("tarefas_configurar", { p: { meta: null } }, "Meta tirada.")}>Tirar a meta</button>}
          </p>
        </div>
        <Aviso texto={acao.aviso || config.erro} />
      </section>

      <section className="painel-cartao p-5">
        <h2 className="font-serif text-xl font-semibold">Visão geral da equipe</h2>
        {v ? (
          <>
            <p className="mt-1 text-sm">Esperando revisão: <strong>{v.esperando_revisao}</strong> · tempo médio de revisão nos últimos 30 dias: <strong>{v.revisao_horas ?? "—"} h</strong></p>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs text-ink-soft"><tr><th className="font-normal">Tipo</th><th className="text-right font-normal">Abertas</th><th className="text-right font-normal">Reservadas</th><th className="text-right font-normal">Feitas (30 d)</th></tr></thead>
              <tbody className="divide-y divide-rule">{Object.entries(v.por_tipo).map(([k, x]) => <tr key={k}><td className="py-1">{infoDe(k).nome}</td><td className="text-right">{x.abertas}</td><td className="text-right">{x.reservadas}</td><td className="text-right">{x.concluidas_30}</td></tr>)}</tbody>
            </table>
            {v.falta_gente.length > 0 && <p className="mt-2 text-sm text-oxblood">Falta gente em: {v.falta_gente.map((k) => infoDe(k).nome).join(", ")}.</p>}
            {v.paradas.length > 0 && <div className="mt-2 text-sm"><p className="font-semibold">Paradas há mais de cinco dias</p><ul>{v.paradas.map((x, i) => <li key={i}>{x.titulo} · {x.nome} · desde {data(x.desde)}</li>)}</ul></div>}
            <details className="mt-2 text-sm"><summary className="cursor-pointer underline">Por pessoa</summary><ul className="mt-1">{v.por_pessoa.map((x, i) => <li key={i}>{x.nome}: {x.feitas_30} feitas em 30 dias, {x.reservadas} reservadas</li>)}</ul></details>
          </>
        ) : <p className="text-sm text-ink-soft">{visao.erro || "Carregando…"}</p>}
      </section>

      <section className="painel-cartao p-5 lg:col-span-2">
        <h2 className="font-serif text-xl font-semibold">Tarefa avulsa</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input value={avulsa.titulo} onChange={(e) => setAvulsa({ ...avulsa, titulo: e.target.value })} placeholder="Título" aria-label="Título da tarefa" maxLength={200} className={campo} />
          <input value={avulsa.alvo} onChange={(e) => setAvulsa({ ...avulsa, alvo: e.target.value })} placeholder="Endereço relacionado (opcional, ex.: /acervo/…)" aria-label="Endereço relacionado" maxLength={300} className={campo} />
          <textarea value={avulsa.descricao} onChange={(e) => setAvulsa({ ...avulsa, descricao: e.target.value })} placeholder="O que fazer" aria-label="Descrição" rows={2} maxLength={2000} className={`${campo} sm:col-span-2`} />
          <select value={avulsa.minutos} onChange={(e) => setAvulsa({ ...avulsa, minutos: e.target.value })} aria-label="Tempo" className={campo}><option value="5">5 minutos</option><option value="15">15 minutos</option><option value="30">30 minutos</option></select>
          <input value={avulsa.impacto} onChange={(e) => setAvulsa({ ...avulsa, impacto: e.target.value })} placeholder="O que muda quando ficar pronta" aria-label="Impacto" maxLength={300} className={campo} />
        </div>
        <button type="button" className={`mt-2 ${botao}`} disabled={acao.ocupado || avulsa.titulo.trim().length < 3} onClick={async () => { if (await acao.agir("tarefa_criar", { p: { ...avulsa, minutos: Number(avulsa.minutos) } }, "Tarefa criada ✓")) setAvulsa({ titulo: "", descricao: "", minutos: "15", papel: "", impacto: "", alvo: "" }); }}>Criar a tarefa</button>
      </section>
    </div>
  );
}

/** "Acervo por dentro": cada obra com o selo da ficha (completa, parcial, vazia), com filtros, para escolher o que cuidar. */
export function AcervoPorDentro() {
  const { t } = useI18n();
  const [fichas, setFichas] = useState<Ficha[] | null>(null);
  const [erro, setErro] = useState("");
  const [area, setArea] = useState("");
  const [estado, setEstado] = useState("");
  const [busca, setBusca] = useState("");
  useEffect(() => {
    let vivo = true;
    fetch("/pt/acervo-fichas.json").then((r) => (r.ok ? r.json() : Promise.reject(new Error()))).then((l: Ficha[]) => vivo && setFichas(l)).catch(() => vivo && setErro("A lista não carregou: ela é montada junto com o site."));
    return () => { vivo = false; };
  }, []);
  const nome = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug;
  const areas = [...new Set((fichas ?? []).map((f) => f.area))].sort();
  const termo = busca.trim().toLowerCase();
  const vistas = (fichas ?? []).filter((f) => (!area || f.area === area) && (!estado || f.completude === estado) && (!termo || `${f.titulo} ${f.autor}`.toLowerCase().includes(termo)));
  const conta = (c: string) => (fichas ?? []).filter((f) => f.completude === c && (!area || f.area === area)).length;
  return (
    <div>
      <p className="text-ink-soft">Cada obra do acervo com o selo da ficha. As que têm algo faltando já viram tarefa na fila (até o limite de cada rodada).</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">Disciplina<select value={area} onChange={(e) => setArea(e.target.value)} className={campo}><option value="">Todas</option>{areas.map((a) => <option key={a} value={a}>{nome(a)}</option>)}</select></label>
        <label className="block text-sm">Ficha<select value={estado} onChange={(e) => setEstado(e.target.value)} className={campo}><option value="">Todas</option><option value="completa">Completa ({conta("completa")})</option><option value="parcial">Parcial ({conta("parcial")})</option><option value="vazia">Faltando muito ({conta("vazia")})</option></select></label>
        <label className="block text-sm">Buscar<input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} className={campo} /></label>
      </div>
      <Aviso texto={erro} />
      {fichas ? <p className="mt-2 font-mono text-xs text-ink-soft">{vistas.length} obras</p> : !erro && <p className="painel-carregando mt-3 text-ink-soft">Carregando as obras…</p>}
      <ul className="mt-2 divide-y divide-rule border-y border-rule text-sm">
        {vistas.slice(0, 300).map((f) => (
          <li key={f.id} className="flex flex-wrap items-baseline gap-x-3 py-2">
            <span className={`border px-1.5 text-xs ${f.completude === "completa" ? "border-ok text-ok" : f.completude === "parcial" ? "border-gold text-gold" : "border-oxblood text-oxblood"}`}>{f.completude === "completa" ? "✓ completa" : f.completude === "parcial" ? "◐ parcial" : "○ faltando"}</span>
            <a href={`/pt/acervo/${f.id}`} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-oxblood">{f.titulo}</a>
            <span className="text-ink-soft">{f.autor} · {nome(f.area)}</span>
            {f.faltam.length > 0 && <span className="text-xs text-ink-soft">falta: {f.faltam.join(", ")}</span>}
          </li>
        ))}
      </ul>
      {vistas.length > 300 && <p className="mt-2 text-sm text-ink-soft">Mostrando 300: use os filtros para ver as outras.</p>}
    </div>
  );
}

interface Contribuicoes {
  nome: string;
  tarefas: { titulo: string; tipo: string; minutos: number; status: string; quando: string; alvo: string }[];
  envios: number;
  minutos: number;
  selos: string[];
  selos_ocultos: boolean;
  agradecimento_publico: boolean;
  habilidades: string[];
  mentoria_oferecida: boolean;
}

/** "Minhas contribuições": o que a pessoa fez, horas estimadas, selos (escondíveis), preferências e o comprovante em PDF. */
export function MinhasContribuicoes() {
  const dados = useLista<Contribuicoes>("minhas_contribuicoes", {}, { quieta: true });
  const acao = useAcao(dados.recarregar);
  const [habilidades, setHabilidades] = useState<string | null>(null);
  const d = dados.dados;
  if (!d) return <Aviso texto={dados.erro || "Carregando…"} />;
  const horas = (d.minutos / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  function comprovante() {
    const linhas = d!.tarefas.filter((x) => x.status !== "entregue").map((x) => `<tr><td>${new Date(x.quando).toLocaleDateString("pt-BR")}</td><td>${infoDe(x.tipo).nome}</td><td>${x.titulo.replace(/</g, "&lt;")}</td><td style="text-align:right">${x.minutos} min</td></tr>`).join("");
    const w = window.open("", "_blank", "noopener,width=800,height=900");
    if (!w) return;
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comprovante de voluntariado</title><style>body{font-family:Georgia,serif;margin:40px;color:#1f1a14}h1{font-size:24px}table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-bottom:1px solid #ccc;padding:4px;text-align:left}p{font-size:14px}</style></head><body><h1>Instituto Lúcia — comprovante de voluntariado</h1><p><strong>${d!.nome.replace(/</g, "&lt;")}</strong> fez as tarefas abaixo como voluntária ou voluntário do Instituto Lúcia (escola e biblioteca comunitária, gratuita), somando cerca de <strong>${horas} horas</strong> estimadas.</p><table><thead><tr><th>Data</th><th>Tipo</th><th>Tarefa</th><th style="text-align:right">Tempo</th></tr></thead><tbody>${linhas}</tbody></table><p style="margin-top:24px;font-size:12px">Emitido pelo painel em ${new Date().toLocaleDateString("pt-BR")}. Tempo estimado pelo tamanho de cada tarefa. Para o certificado oficial de horas, veja Horas e certificados no painel.</p><script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="painel-cartao p-4"><p className={rotulo}>Tarefas</p><p className="font-sans text-4xl font-black">{d.tarefas.length}</p></div>
          <div className="painel-cartao p-4"><p className={rotulo}>Horas estimadas</p><p className="font-sans text-4xl font-black">{horas}</p></div>
          <div className="painel-cartao p-4"><p className={rotulo}>Envios publicados</p><p className="font-sans text-4xl font-black">{d.envios}</p></div>
        </div>
        {(d.selos ?? []).length > 0 && <p className="mt-3 flex flex-wrap gap-2">{d.selos.map((s) => <span key={s} className="border border-gold px-2 py-0.5 text-xs text-gold">★ {s}</span>)}</p>}
        <ul className="mt-4 divide-y divide-rule border-y border-rule text-sm">
          {d.tarefas.map((x, i) => <li key={i} className="flex flex-wrap gap-x-3 py-2"><span className="font-mono text-xs text-ink-soft">{x.quando ? data(x.quando) : ""}</span><span>{infoDe(x.tipo).nome}: <strong>{x.titulo}</strong></span><span className="text-xs text-ink-soft">{x.status === "entregue" ? "esperando revisão" : x.status === "aprovada" ? "aprovada, entra na próxima publicação" : "concluída"}</span></li>)}
          {d.tarefas.length === 0 && <li className="py-2 text-ink-soft">Nenhuma tarefa ainda. Comece por “Para você hoje”, na Mesa.</li>}
        </ul>
        <p className="mt-3"><button type="button" className={botaoClaro} disabled={d.tarefas.length === 0} onClick={comprovante}>Baixar o comprovante (PDF)</button></p>
        <p className="mt-1 text-xs text-ink-soft">O comprovante abre pronto para imprimir: escolha “Salvar como PDF”. Nada sai do seu aparelho.</p>
      </section>
      <aside className="painel-cartao space-y-3 p-4 text-sm">
        <p className="font-semibold">Preferências</p>
        <label className="flex cursor-pointer items-start gap-2"><input type="checkbox" className="mt-1" checked={d.agradecimento_publico} onChange={(e) => void acao.agir("perfil_tarefas_salvar", { p: { agradecimento_publico: e.target.checked } }, "Guardado ✓")} /> Pode citar o meu nome no agradecimento do mês e na “obra do mês”.</label>
        <label className="flex cursor-pointer items-start gap-2"><input type="checkbox" className="mt-1" checked={d.selos_ocultos} onChange={(e) => void acao.agir("perfil_tarefas_salvar", { p: { selos_ocultos: e.target.checked } }, "Guardado ✓")} /> Esconder os meus selos.</label>
        <label className="flex cursor-pointer items-start gap-2"><input type="checkbox" className="mt-1" checked={d.mentoria_oferecida} onChange={(e) => void acao.agir("perfil_tarefas_salvar", { p: { mentoria_oferecida: e.target.checked } }, "Guardado ✓")} /> Quero ser mentor: quem está começando pode me pedir ajuda.</label>
        <label className="block">Habilidades e interesses (separados por vírgula)<input value={habilidades ?? (d.habilidades ?? []).join(", ")} onChange={(e) => setHabilidades(e.target.value)} placeholder="história, revisão, inglês, design…" className={campo} /></label>
        <button type="button" className={botaoClaro} disabled={habilidades === null} onClick={async () => { if (await acao.agir("perfil_tarefas_salvar", { p: { habilidades: (habilidades ?? "").split(",").map((x) => x.trim()).filter(Boolean) } }, "Guardado ✓")) setHabilidades(null); }}>Guardar</button>
        <p className="text-xs text-ink-soft">As habilidades ajudam o “Para você hoje” a escolher tarefas que combinam com você. Não há ranking de quem fez mais.</p>
        <Aviso texto={acao.aviso} />
      </aside>
    </div>
  );
}
