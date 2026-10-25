// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { can, type Me, rpc } from "@/lib/backend";
import { getItem, setItem } from "@/lib/storage";
import { TIPOS, type TipoDeLacuna } from "@/lib/tipos-de-tarefa";
import { useI18n } from "../I18n";
import { CampoData } from "./Campos";
import { Aviso, botao, botaoClaro, campo, data, dataHora, dia, elo, rotulo, textoDoErro, useAcao, useLista } from "./comum";

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
  atualizado_em?: string;
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

/** As colunas do quadro: o caminho de uma tarefa, do "a fazer" ao "feito". */
const COLUNAS = [
  { id: "aberta", nome: "A fazer", ponto: "bg-ink-soft", status: ["aberta"], vazio: "Nada aberto: a fila está em dia." },
  { id: "reservada", nome: "Fazendo", ponto: "bg-gold", status: ["reservada"], vazio: "Arraste para cá o que você vai fazer." },
  { id: "revisao", nome: "Em revisão", ponto: "bg-oxblood", status: ["entregue", "aprovada"], vazio: "Nada esperando revisão." },
  { id: "feito", nome: "Feito", ponto: "bg-ok", status: ["concluida"], vazio: "As concluídas aparecem aqui." },
] as const;
type Coluna = (typeof COLUNAS)[number]["id"];
const colunaDe = (status: string): Coluna => COLUNAS.find((c) => (c.status as readonly string[]).includes(status))?.id ?? "aberta";

/** As cores das etiquetas de tipo, no jeito de uma base de dados: suaves, para o título continuar mandando. */
const TOM: Record<string, string> = {
  ficha_ano: "bg-gold/25 text-ink",
  ficha_sinopse: "bg-gold/25 text-ink",
  licenca: "bg-ink/10 text-ink",
  link: "bg-ink/10 text-ink",
  sem_ligacao: "bg-ok/20 text-ink",
  revisao_aula: "bg-ok/20 text-ink",
  biografia: "bg-oxblood/15 text-oxblood",
  traducao: "bg-oxblood/15 text-oxblood",
  duplicata: "bg-rule text-ink",
  imagem_alt: "bg-rule text-ink",
  avulsa: "border border-rule text-ink",
};
const tomDe = (tipo: string) => TOM[tipo] ?? TOM.avulsa;
const NOME_DO_STATUS: Record<string, string> = { aberta: "A fazer", reservada: "Fazendo", entregue: "Esperando revisão", aprovada: "Aprovada", concluida: "Feita", encerrada: "Encerrada" };
const TOM_DO_STATUS: Record<string, string> = { aberta: "bg-rule text-ink", reservada: "bg-gold/25 text-ink", entregue: "bg-oxblood/15 text-oxblood", aprovada: "bg-ok/20 text-ink", concluida: "bg-ok/20 text-ink", encerrada: "bg-rule text-ink-soft" };
/** Quantos cartões cada coluna mostra antes do "mostrar mais". */
const POR_COLUNA = 12;

const DESENHOS = {
  quadro: "M4 5h4.5v14H4zM9.75 5h4.5v9h-4.5zM15.5 5H20v11h-4.5z",
  tabela: "M4 5h16v14H4zM4 10h16M4 14.5h16M9.5 5v14",
  minhas: "M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c.8-3.4 3.6-5.5 7-5.5s6.2 2.1 7 5.5",
  revisao: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  mutiroes: "M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a2.5 2.5 0 1 0 0-5M3 19.5c.6-3 2.8-5 5.5-5s4.9 2 5.5 5M15.5 14.5c2.4 0 4.3 1.8 4.9 5",
  configurar: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1.5-2-3.5-2.4.8a7 7 0 0 0-1.6-.9L14.5 4h-5L9 6.9a7 7 0 0 0-1.6.9L5 7l-2 3.5L5 12l-2 1.5L5 17l2.4-.8c.5.4 1 .7 1.6.9l.5 2.9h5l.5-2.9c.6-.2 1.1-.5 1.6-.9L19 17l2-3.5z",
  relogio: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 7.5V12l3 2",
  busca: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20",
  mais: "M12 5v14M5 12h14",
  fechar: "M6 6l12 12M18 6 6 18",
  status: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 16a4 4 0 1 0 0-8",
  tipo: "M4 12.5 11.5 5H19v7.5L11.5 20zM15 9h.01",
  nivel: "M5 19v-4M10 19v-8M15 19V8M20 19V5",
  pessoa: "M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c.8-3.4 3.6-5.5 7-5.5s6.2 2.1 7 5.5",
  prazo: "M5 6h14v14H5zM5 10h14M9 4v4M15 4v4",
  elo: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  impacto: "M12 3.5l2.4 5.3 5.6.6-4.2 3.8 1.2 5.6L12 16l-5 2.8 1.2-5.6L4 9.4l5.6-.6z",
  ideia: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  caixa: "M5 4.5h14v15H5zM8.5 12l2.5 2.5 4.5-5",
};

function Desenho({ nome, className = "h-4 w-4" }: { nome: keyof typeof DESENHOS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d={DESENHOS[nome]} />
    </svg>
  );
}

function Pilula({ children, tom = "bg-rule text-ink" }: { children: ReactNode; tom?: string }) {
  return <span className={`inline-flex max-w-full items-center gap-1 truncate rounded-sm px-1.5 py-0.5 text-xs font-medium ${tom}`}>{children}</span>;
}

function Iniciais({ nome }: { nome: string }) {
  const letras = nome.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "").join("") || "?";
  return <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[0.55rem] font-bold text-parchment">{letras}</span>;
}

type Vista = "quadro" | "tabela" | "minhas" | "revisao" | "mutiroes" | "configurar";
type Ordem = { por: "titulo" | "tipo" | "minutos" | "status" | "responsavel" | "prazo"; desce: boolean };

/**
 * A seção Tarefas, no jeito de uma base de dados: o mesmo conjunto visto como quadro (arrastar de "A fazer" para
 * "Fazendo" reserva a tarefa), como tabela que se ordena pelo cabeçalho ou só as minhas, com filtros por tipo, tempo e
 * nível, e cada tarefa abrindo ao lado, com as propriedades, o "como fazer" e a entrega. Revisão rápida, mutirões e os
 * controles da coordenação continuam nas outras vistas.
 */
export function Tarefas({ me, ir }: { me: Me; ir: (aba: string) => void }) {
  const revisa = can(me, "coordenacao", "curadoria", "revisao", "supervisao");
  const coordena = can(me, "coordenacao");
  const [vista, setVista] = useState<Vista>(() => {
    const guardada = getItem("lucia:tarefas-vista");
    return guardada === "tabela" || guardada === "minhas" ? guardada : "quadro";
  });
  const [tipo, setTipo] = useState("");
  const [tempo, setTempo] = useState(0);
  const [nivel, setNivel] = useState("");
  const [busca, setBusca] = useState("");
  const [espiando, setEspiando] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<Coluna | null>(null);
  const [mais, setMais] = useState<Coluna[]>([]);
  const [ordem, setOrdem] = useState<Ordem>({ por: "status", desce: false });
  const abertas = useLista<Tarefa[]>("tarefas_listar", { p_tipo: tipo, p_status: "aberta", p_pagina: 0 });
  const reservadas = useLista<Tarefa[]>("tarefas_listar", { p_tipo: tipo, p_status: "reservada", p_pagina: 0 });
  const entregues = useLista<Tarefa[]>("tarefas_listar", { p_tipo: tipo, p_status: "entregue", p_pagina: 0 });
  const aprovadas = useLista<Tarefa[]>("tarefas_listar", { p_tipo: tipo, p_status: "aprovada", p_pagina: 0 });
  const feitas = useLista<Tarefa[]>("tarefas_listar", { p_tipo: tipo, p_status: "concluida", p_pagina: 0 });
  const recarregar = () => {
    abertas.recarregar();
    reservadas.recarregar();
    entregues.recarregar();
    aprovadas.recarregar();
    feitas.recarregar();
  };
  const acao = useAcao(recarregar);

  const todas = useMemo(
    () => [...(abertas.dados ?? []), ...(reservadas.dados ?? []), ...(entregues.dados ?? []), ...(aprovadas.dados ?? []), ...(feitas.dados ?? [])],
    [abertas.dados, reservadas.dados, entregues.dados, aprovadas.dados, feitas.dados],
  );
  const termo = busca.trim().toLowerCase();
  const filtradas = todas.filter(
    (t) => (!tempo || t.minutos === tempo) && (!nivel || t.dificuldade === nivel) && (!termo || `${t.titulo} ${t.descricao} ${infoDe(t.tipo).nome} ${t.reservada_por}`.toLowerCase().includes(termo)),
  );
  const minhas = todas.filter((t) => t.minha && t.status !== "concluida");
  const espiada = espiando ? (todas.find((t) => t.id === espiando) ?? null) : null;
  const carregando = !abertas.dados && !abertas.erro;
  const erro = abertas.erro || reservadas.erro || entregues.erro || aprovadas.erro || feitas.erro;
  const filtrando = Boolean(tipo || tempo || nivel || termo);

  function escolher(proxima: Vista) {
    setVista(proxima);
    // Voltando de Revisão ou Configurar (onde a fila pode ter mudado), o quadro relê as tarefas.
    if (proxima === "quadro" || proxima === "tabela" || proxima === "minhas") {
      setItem("lucia:tarefas-vista", proxima);
      if (vista !== "quadro" && vista !== "tabela" && vista !== "minhas") recarregar();
    }
  }

  async function soltar(coluna: Coluna) {
    const t = todas.find((item) => item.id === arrastando);
    setArrastando(null);
    setAlvo(null);
    if (!t) return;
    const de = colunaDe(t.status);
    if (de === coluna) return;
    if (de === "aberta" && coluna === "reservada") await acao.agir("tarefa_reservar", { p_id: t.id }, "Reservada no seu nome ✓ Abra o cartão para entregar.");
    else if (de === "reservada" && t.minha && coluna === "aberta") await acao.agir("tarefa_liberar", { p_id: t.id }, "Liberada: a tarefa voltou para a fila. Sem problema.");
    else if (de === "reservada" && t.minha && coluna === "revisao") {
      setEspiando(t.id);
      acao.setAviso("Preencha a entrega para mandar para a revisão.");
    } else acao.setAviso("Esse caminho não se faz arrastando: a revisão e o verificador do acervo levam a tarefa adiante.");
  }

  const vistas: { id: Vista; nome: string; desenho: keyof typeof DESENHOS; conta?: number }[] = [
    { id: "quadro", nome: "Quadro", desenho: "quadro" },
    { id: "tabela", nome: "Tabela", desenho: "tabela" },
    { id: "minhas", nome: "Minhas", desenho: "minhas", conta: minhas.length },
    ...(revisa ? [{ id: "revisao" as const, nome: "Revisão rápida", desenho: "revisao" as const, conta: entregues.dados?.length }] : []),
    { id: "mutiroes", nome: "Mutirões e projetos", desenho: "mutiroes" },
    ...(coordena ? [{ id: "configurar" as const, nome: "Configurar e acompanhar", desenho: "configurar" as const }] : []),
  ];

  const ordenadas = [...filtradas].sort((a, b) => {
    const valor = (t: Tarefa): string | number =>
      ordem.por === "titulo" ? t.titulo : ordem.por === "tipo" ? infoDe(t.tipo).nome : ordem.por === "minutos" ? t.minutos : ordem.por === "status" ? COLUNAS.findIndex((c) => c.id === colunaDe(t.status)) : ordem.por === "responsavel" ? t.reservada_por || "~" : (t.prazo ?? "~");
    const [x, y] = [valor(a), valor(b)];
    const comparado = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt");
    return ordem.desce ? -comparado : comparado;
  });

  return (
    <div>
      <div role="tablist" aria-label="Vistas das tarefas" className="flex flex-wrap items-end gap-x-1 border-b border-rule">
        {vistas.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={vista === item.id} onClick={() => escolher(item.id)} className={`-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 px-2.5 py-2 text-sm ${vista === item.id ? "border-ink font-semibold text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}>
            <Desenho nome={item.desenho} />
            {item.nome}
            {item.conta ? <span className="rounded-full bg-oxblood px-1.5 text-[0.65rem] font-bold text-parchment">{item.conta}</span> : null}
          </button>
        ))}
      </div>

      {(vista === "quadro" || vista === "tabela") && (
        <div className="flex flex-wrap items-center gap-2 border-b border-rule py-2.5">
          <label className="relative">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-soft">
              <Desenho nome="busca" className="h-3.5 w-3.5" />
            </span>
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" aria-label="Buscar tarefas" className="w-40 rounded-md border border-rule bg-transparent py-1 pl-7 pr-2 text-sm focus:border-ink focus:outline-none sm:w-48" />
          </label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo" className={`cursor-pointer rounded-md border px-2 py-1 text-sm ${tipo ? "border-ink bg-ink text-parchment" : "border-rule bg-transparent"}`}>
            <option value="">Tipo: todos</option>
            {(Object.keys(TIPOS) as TipoDeLacuna[]).map((k) => (
              <option key={k} value={k}>{TIPOS[k].nome}</option>
            ))}
          </select>
          <span className="flex overflow-hidden rounded-md border border-rule text-sm" role="group" aria-label="Tempo">
            {[5, 15, 30].map((m) => (
              <button key={m} type="button" aria-pressed={tempo === m} onClick={() => setTempo(tempo === m ? 0 : m)} className={`cursor-pointer px-2.5 py-1 ${tempo === m ? "bg-ink text-parchment" : "hover:bg-parchment-deep"}`}>
                {m} min
              </button>
            ))}
          </span>
          <select value={nivel} onChange={(e) => setNivel(e.target.value)} aria-label="Nível" className={`cursor-pointer rounded-md border px-2 py-1 text-sm ${nivel ? "border-ink bg-ink text-parchment" : "border-rule bg-transparent"}`}>
            <option value="">Nível: todos</option>
            {Object.entries(DIFICULDADE).map(([k, nome]) => (
              <option key={k} value={k}>{nome}</option>
            ))}
          </select>
          {filtrando && (
            <button type="button" className="cursor-pointer text-sm text-ink-soft underline hover:text-ink" onClick={() => { setTipo(""); setTempo(0); setNivel(""); setBusca(""); }}>
              Limpar
            </button>
          )}
          <span className="ml-auto text-xs text-ink-soft">{filtradas.length} {filtradas.length === 1 ? "tarefa" : "tarefas"}</span>
          {coordena && (
            <button type="button" className={`${botao} inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm`} onClick={() => setCriando(true)}>
              <Desenho nome="mais" className="h-3.5 w-3.5" />
              Nova
            </button>
          )}
        </div>
      )}

      <Aviso texto={erro || acao.aviso} />
      {carregando && (vista === "quadro" || vista === "tabela" || vista === "minhas") && <p className="painel-carregando mt-4 text-ink-soft">Separando tarefas…</p>}

      {vista === "quadro" && !carregando && (
        <>
          <p className="mt-3 text-xs text-ink-soft">Arraste um cartão de “A fazer” para “Fazendo” para pegar a tarefa; de volta, para liberar. Toque no cartão para ver tudo.</p>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-3">
            {COLUNAS.map((coluna) => {
              const daColuna = filtradas.filter((t) => colunaDe(t.status) === coluna.id).sort(coluna.id === "feito" ? (a, b) => String(b.atualizado_em ?? "").localeCompare(String(a.atualizado_em ?? "")) : coluna.id === "reservada" ? (a, b) => Number(b.minha) - Number(a.minha) : () => 0);
              const mostradas = mais.includes(coluna.id) ? daColuna : daColuna.slice(0, POR_COLUNA);
              return (
                <section
                  key={coluna.id}
                  aria-label={coluna.nome}
                  onDragOver={(e) => {
                    if (!arrastando) return;
                    e.preventDefault();
                    if (alvo !== coluna.id) setAlvo(coluna.id);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAlvo(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    void soltar(coluna.id);
                  }}
                  className={`flex w-[17rem] shrink-0 flex-col rounded-lg p-2 transition-colors lg:w-auto lg:min-w-[14rem] lg:flex-1 ${alvo === coluna.id ? "bg-gold/20 outline-2 outline-dashed outline-gold" : "bg-parchment-deep"}`}
                >
                  <header className="flex items-center gap-2 px-1 pb-2 text-sm">
                    <span aria-hidden className={`h-2 w-2 rounded-full ${coluna.ponto}`} />
                    <span className="font-semibold">{coluna.nome}</span>
                    <span className="text-ink-soft">{daColuna.length}</span>
                    {coluna.id === "aberta" && coordena && (
                      <button type="button" title="Nova tarefa" aria-label="Nova tarefa" className="ml-auto cursor-pointer rounded p-0.5 text-ink-soft hover:bg-parchment hover:text-ink" onClick={() => setCriando(true)}>
                        <Desenho nome="mais" className="h-4 w-4" />
                      </button>
                    )}
                  </header>
                  <div className="flex flex-col gap-2">
                    {mostradas.map((t) => (
                      <CartaoDoQuadro key={t.id} t={t} abrir={setEspiando} arrastavel={t.status === "aberta" || (t.status === "reservada" && t.minha)} comecar={setArrastando} parar={() => { setArrastando(null); setAlvo(null); }} />
                    ))}
                  </div>
                  {daColuna.length > mostradas.length && (
                    <button type="button" className="mt-2 cursor-pointer rounded px-1 py-1 text-left text-xs text-ink-soft hover:bg-parchment hover:text-ink" onClick={() => setMais([...mais, coluna.id])}>
                      Mostrar mais {daColuna.length - mostradas.length}
                    </button>
                  )}
                  {daColuna.length === 0 && <p className="px-1 py-3 text-xs text-ink-soft">{coluna.vazio}</p>}
                </section>
              );
            })}
          </div>
        </>
      )}

      {vista === "tabela" && !carregando && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
            <thead>
              <tr className="text-xs text-ink-soft">
                {(
                  [
                    ["titulo", "Título", "caixa"],
                    ["tipo", "Tipo", "tipo"],
                    ["minutos", "Tempo", "relogio"],
                    ["status", "Status", "status"],
                    ["responsavel", "Quem pegou", "pessoa"],
                    ["prazo", "Prazo", "prazo"],
                  ] as const
                ).map(([id, nome, desenho]) => (
                  <th key={id} scope="col" className="border-b border-rule px-2 py-1.5 font-normal" aria-sort={ordem.por === id ? (ordem.desce ? "descending" : "ascending") : undefined}>
                    <button type="button" className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 hover:bg-parchment-deep hover:text-ink" onClick={() => setOrdem({ por: id, desce: ordem.por === id ? !ordem.desce : false })}>
                      <Desenho nome={desenho} className="h-3.5 w-3.5" />
                      {nome}
                      {ordem.por === id && <span aria-hidden>{ordem.desce ? "↓" : "↑"}</span>}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((t) => (
                <tr key={t.id} className="cursor-pointer border-b border-rule hover:bg-parchment-deep" onClick={() => setEspiando(t.id)}>
                  <td className="max-w-[22rem] px-3 py-2">
                    <button type="button" className="cursor-pointer text-left font-medium hover:underline" onClick={(e) => { e.stopPropagation(); setEspiando(t.id); }}>
                      {t.titulo}
                    </button>
                  </td>
                  <td className="px-3 py-2"><Pilula tom={tomDe(t.tipo)}>{infoDe(t.tipo).nome}</Pilula></td>
                  <td className="whitespace-nowrap px-3 py-2">{t.minutos} min</td>
                  <td className="px-3 py-2"><Pilula tom={TOM_DO_STATUS[t.status]}>{NOME_DO_STATUS[t.status] ?? t.status}</Pilula></td>
                  <td className="px-3 py-2">{t.reservada_por ? <span className="flex items-center gap-1.5"><Iniciais nome={t.reservada_por} />{t.minha ? "Você" : t.reservada_por}</span> : <span className="text-ink-soft">—</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink-soft">{t.prazo && t.status === "reservada" ? dataHora(t.prazo) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ordenadas.length === 0 && <p className="px-3 py-6 text-center text-ink-soft">{filtrando ? "Nenhuma tarefa com esses filtros." : "Nenhuma tarefa por aqui."}</p>}
        </div>
      )}

      {vista === "minhas" && !carregando && (
        <div className="mt-4">
          {minhas.length === 0 ? (
            <div className="rounded-lg border border-dashed border-rule px-6 py-10 text-center">
              <p className="font-serif text-xl font-semibold">Nada no seu nome agora</p>
              <p className="mt-1 text-ink-soft">Pegue uma tarefa no Quadro ou em “Para você hoje”, na Mesa.</p>
              <button type="button" className={`${botaoClaro} mt-3`} onClick={() => escolher("quadro")}>Abrir o quadro</button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {minhas.map((t) => (
                <article key={t.id} className="rounded-lg border border-rule bg-parchment-deep p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Pilula tom={TOM_DO_STATUS[t.status]}>{NOME_DO_STATUS[t.status] ?? t.status}</Pilula>
                    <Pilula tom={tomDe(t.tipo)}>{infoDe(t.tipo).nome}</Pilula>
                    {t.prazo && t.status === "reservada" && <span className="text-xs text-ink-soft">até {dataHora(t.prazo)}</span>}
                  </div>
                  <button type="button" className="mt-1.5 cursor-pointer text-left font-serif text-lg font-semibold leading-snug hover:underline" onClick={() => setEspiando(t.id)}>
                    {t.titulo}
                  </button>
                  {t.status === "reservada" ? <Entrega t={t} depois={recarregar} ir={ir} /> : <p className="mt-2 text-sm text-ink-soft">{t.status === "aprovada" ? "Aprovada ✓ Entra no site na próxima publicação." : "Entregue ✓ Alguém da equipe revisa e você recebe um recado."}</p>}
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {vista === "revisao" && revisa && <div className="mt-4"><RevisaoRapida /></div>}
      {vista === "mutiroes" && <div className="mt-4"><MutiroesEProjetos me={me} /></div>}
      {vista === "configurar" && coordena && <div className="mt-4"><Configurar /></div>}

      {espiada && <Espiar t={espiada} fechar={() => setEspiando(null)} ir={ir} depois={recarregar} coordena={coordena} />}
      {criando && <NovaTarefa fechar={() => setCriando(false)} depois={recarregar} />}
    </div>
  );
}

function CartaoDoQuadro({ t, abrir, arrastavel, comecar, parar }: { t: Tarefa; abrir: (id: string) => void; arrastavel: boolean; comecar: (id: string) => void; parar: () => void }) {
  return (
    <button
      type="button"
      draggable={arrastavel}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", t.id);
        e.dataTransfer.effectAllowed = "move";
        comecar(t.id);
      }}
      onDragEnd={parar}
      onClick={() => abrir(t.id)}
      className={`block w-full rounded-md border border-rule bg-parchment p-3 text-left shadow-[0_1px_0_var(--rule)] hover:border-ink-soft ${arrastavel ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
    >
      <span className="block font-semibold leading-snug">{t.titulo}</span>
      <span className="mt-2 flex flex-wrap gap-1">
        <Pilula tom={tomDe(t.tipo)}>{infoDe(t.tipo).nome}</Pilula>
        <Pilula>
          <Desenho nome="relogio" className="h-3 w-3" />
          {t.minutos} min
        </Pilula>
        {t.dificuldade === "iniciante" && <Pilula tom="bg-ok/20 text-ink">iniciante</Pilula>}
      </span>
      {(t.reservada_por || (t.prazo && t.status === "reservada")) && (
        <span className="mt-2 flex items-center gap-1.5 text-xs text-ink-soft">
          {t.reservada_por && (
            <>
              <Iniciais nome={t.reservada_por} />
              {t.minha ? "Você" : t.reservada_por}
            </>
          )}
          {t.prazo && t.status === "reservada" && <span className="ml-auto">até {dataHora(t.prazo)}</span>}
        </span>
      )}
      {t.nota_revisao && t.status === "reservada" && <span className="mt-2 block text-xs font-semibold text-oxblood">Voltou com um comentário</span>}
    </button>
  );
}

/** Uma linha de propriedade, no jeito de uma página de base de dados: o nome à esquerda, o valor à direita. */
function Propriedade({ desenho, nome, children }: { desenho: keyof typeof DESENHOS; nome: string; children: ReactNode }) {
  return (
    <>
      <dt className="flex items-center gap-2 py-1 text-ink-soft">
        <Desenho nome={desenho} className="h-3.5 w-3.5" />
        {nome}
      </dt>
      <dd className="min-w-0 py-1">{children}</dd>
    </>
  );
}

/** A tarefa aberta ao lado do quadro: propriedades, o que fazer, o "como fazer" e a entrega. */
function Espiar({ t, fechar, ir, depois, coordena }: { t: Tarefa; fechar: () => void; ir: (aba: string) => void; depois: () => void; coordena: boolean }) {
  const acao = useAcao(depois);
  const info = infoDe(t.tipo);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [fechar]);
  const destino = t.alvo ? (t.alvo.startsWith("/acervo") ? "a obra" : t.alvo.startsWith("/autores") ? "a página do autor" : "a aula") : "";

  // No body: a área de conteúdo do painel tem transform (da animação de entrada), que prenderia o "fixed" dentro dela.
  return createPortal(
    <div className="fixed inset-0 z-[90] flex justify-end bg-[rgba(23,19,14,0.35)]" onPointerDown={(e) => e.target === e.currentTarget && fechar()}>
      <aside role="dialog" aria-modal="true" aria-label={t.titulo} className="flex h-full w-full max-w-xl flex-col border-l border-ink bg-parchment text-ink shadow-2xl">
        <div className="flex items-center gap-2 border-b border-rule px-4 py-2 text-sm text-ink-soft">
          <span className="min-w-0 flex-1 truncate">Tarefas / {info.nome}</span>
          {t.alvo && (
            <a href={`/pt${t.alvo}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded px-2 py-1 hover:bg-parchment-deep hover:text-ink">
              <Desenho nome="elo" className="h-3.5 w-3.5" />
              Abrir {destino} ↗
            </a>
          )}
          <button type="button" onClick={fechar} aria-label="Fechar" className="cursor-pointer rounded p-1 hover:bg-parchment-deep hover:text-ink">
            <Desenho nome="fechar" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-6">
          <span aria-hidden className={`flex h-12 w-12 items-center justify-center rounded-lg ${tomDe(t.tipo)}`}>
            <Desenho nome="caixa" className="h-7 w-7" />
          </span>
          <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight [text-wrap:balance]">{t.titulo}</h2>
          <dl className="mt-5 grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-x-3 text-sm">
            <Propriedade desenho="status" nome="Status"><Pilula tom={TOM_DO_STATUS[t.status]}>{NOME_DO_STATUS[t.status] ?? t.status}</Pilula></Propriedade>
            <Propriedade desenho="tipo" nome="Tipo"><Pilula tom={tomDe(t.tipo)}>{info.nome}</Pilula></Propriedade>
            <Propriedade desenho="relogio" nome="Tempo">{t.minutos} minutos</Propriedade>
            <Propriedade desenho="nivel" nome="Nível">{DIFICULDADE[t.dificuldade] ?? t.dificuldade}</Propriedade>
            <Propriedade desenho="pessoa" nome="Quem pegou">{t.reservada_por ? <span className="flex items-center gap-1.5"><Iniciais nome={t.reservada_por} />{t.minha ? "Você" : t.reservada_por}</span> : <span className="text-ink-soft">Ninguém ainda</span>}</Propriedade>
            {t.prazo && t.status === "reservada" && <Propriedade desenho="prazo" nome="Prazo">{dataHora(t.prazo)}</Propriedade>}
            {t.tipo === "traducao" && t.detalhe && <Propriedade desenho="elo" nome="Idioma">{IDIOMAS[t.detalhe] ?? t.detalhe}</Propriedade>}
          </dl>

          <div className="mt-5 space-y-4 border-t border-rule pt-5">
            {(t.descricao || (t.detalhe && t.tipo !== "traducao")) && <p className="whitespace-pre-line leading-relaxed">{t.descricao || t.detalhe}</p>}
            {(t.impacto || info.impacto) && (
              <p className="flex gap-2 leading-relaxed">
                <Desenho nome="impacto" className="mt-0.5 h-4 w-4 text-gold" />
                <span><strong>O que muda:</strong> {t.impacto || info.impacto}</span>
              </p>
            )}
            <div className="flex gap-3 rounded-md bg-parchment-deep p-4 text-sm leading-relaxed">
              <Desenho nome="ideia" className="mt-0.5 h-5 w-5 text-gold" />
              <div>
                <p className="font-semibold">Como fazer</p>
                <p className="mt-1 text-ink-soft">{info.como}</p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            {t.status === "aberta" && (
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className={botao} disabled={acao.ocupado} onClick={() => void acao.agir("tarefa_reservar", { p_id: t.id }, "Reservada no seu nome ✓ A entrega aparece aqui embaixo.")}>
                  Vou fazer esta
                </button>
                <span className="text-xs text-ink-soft">Fica no seu nome por um tempo, pelo tamanho da tarefa. Se não der, é só liberar.</span>
              </div>
            )}
            {t.status === "reservada" && t.minha && (
              <section aria-label="Entrega">
                <h3 className={rotulo}>Sua entrega</h3>
                <Entrega t={t} depois={depois} ir={ir} />
              </section>
            )}
            {t.status === "reservada" && !t.minha && (
              <p className="text-sm text-ink-soft">
                Com {t.reservada_por || "alguém da equipe"} agora.{" "}
                {coordena && (
                  <button type="button" className={elo} disabled={acao.ocupado} onClick={() => void acao.agir("tarefa_liberar", { p_id: t.id }, "Liberada: a tarefa voltou para a fila.")}>
                    Liberar para a fila
                  </button>
                )}
              </p>
            )}
            {(t.status === "entregue" || t.status === "aprovada") && Object.keys(t.entrega ?? {}).length > 0 && (
              <section aria-label="O que foi entregue" className="rounded-md border border-rule p-4 text-sm">
                <h3 className={rotulo}>O que foi entregue</h3>
                {Object.entries(t.entrega).map(([k, v]) => (
                  <p key={k} className="mt-1 whitespace-pre-wrap break-words" data-original>
                    <span className="text-ink-soft">{k}: </span>
                    {v}
                  </p>
                ))}
              </section>
            )}
            {t.status === "concluida" && <p className="text-sm text-ok">Feita ✓ O verificador do acervo viu a lacuna sumir.</p>}
            <Aviso texto={acao.aviso} />
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

/** Tarefa avulsa da coordenação, como uma página nova: título grande, as propriedades e o texto. */
function NovaTarefa({ fechar, depois }: { fechar: () => void; depois: () => void }) {
  const acao = useAcao(depois);
  const [avulsa, setAvulsa] = useState({ titulo: "", descricao: "", minutos: "15", papel: "", impacto: "", alvo: "" });
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [fechar]);
  return createPortal(
    <div className="fixed inset-0 z-[90] flex justify-end bg-[rgba(23,19,14,0.35)]" onPointerDown={(e) => e.target === e.currentTarget && fechar()}>
      <aside role="dialog" aria-modal="true" aria-label="Nova tarefa" className="flex h-full w-full max-w-xl flex-col border-l border-ink bg-parchment text-ink shadow-2xl">
        <div className="flex items-center gap-2 border-b border-rule px-4 py-2 text-sm text-ink-soft">
          <span className="flex-1">Tarefas / Nova</span>
          <button type="button" onClick={fechar} aria-label="Fechar" className="cursor-pointer rounded p-1 hover:bg-parchment-deep hover:text-ink">
            <Desenho nome="fechar" />
          </button>
        </div>
        <form
          className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-6"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await acao.agir("tarefa_criar", { p: { ...avulsa, minutos: Number(avulsa.minutos) } }, "Tarefa criada ✓ Ela já está em “A fazer”.")) fechar();
          }}
        >
          <input value={avulsa.titulo} onChange={(e) => setAvulsa({ ...avulsa, titulo: e.target.value })} placeholder="Sem título" aria-label="Título da tarefa" maxLength={200} required autoFocus className="w-full bg-transparent font-serif text-3xl font-semibold placeholder:text-ink-soft/60 focus:outline-none" />
          <dl className="mt-5 grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-sm">
            <Propriedade desenho="relogio" nome="Tempo">
              <select value={avulsa.minutos} onChange={(e) => setAvulsa({ ...avulsa, minutos: e.target.value })} aria-label="Tempo" className="cursor-pointer rounded border border-rule bg-transparent px-2 py-1">
                <option value="5">5 minutos</option>
                <option value="15">15 minutos</option>
                <option value="30">30 minutos</option>
              </select>
            </Propriedade>
            <Propriedade desenho="elo" nome="Endereço">
              <input value={avulsa.alvo} onChange={(e) => setAvulsa({ ...avulsa, alvo: e.target.value })} placeholder="/acervo/… (opcional)" aria-label="Endereço relacionado" maxLength={300} className="w-full rounded border border-transparent bg-transparent px-2 py-1 hover:border-rule focus:border-ink focus:outline-none" />
            </Propriedade>
            <Propriedade desenho="impacto" nome="O que muda">
              <input value={avulsa.impacto} onChange={(e) => setAvulsa({ ...avulsa, impacto: e.target.value })} placeholder="Quando ficar pronta…" aria-label="Impacto" maxLength={300} className="w-full rounded border border-transparent bg-transparent px-2 py-1 hover:border-rule focus:border-ink focus:outline-none" />
            </Propriedade>
          </dl>
          <textarea value={avulsa.descricao} onChange={(e) => setAvulsa({ ...avulsa, descricao: e.target.value })} placeholder="O que fazer, passo a passo." aria-label="Descrição" rows={8} maxLength={2000} className="mt-5 w-full resize-y border-t border-rule bg-transparent pt-4 leading-relaxed focus:outline-none" />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="submit" className={botao} disabled={acao.ocupado || avulsa.titulo.trim().length < 3}>Criar a tarefa</button>
            <button type="button" className={elo} onClick={fechar}>Cancelar</button>
          </div>
          <Aviso texto={acao.aviso} />
        </form>
      </aside>
    </div>,
    document.body,
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
  const [criando, setCriando] = useState(false);
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
        <p className="mt-1 text-sm text-ink-soft">Algo que o verificador não enxerga: escreva como uma página nova, e ela entra em “A fazer” para quem quiser pegar.</p>
        <button type="button" className={`mt-3 ${botao}`} onClick={() => setCriando(true)}>Nova tarefa</button>
        {criando && <NovaTarefa fechar={() => setCriando(false)} depois={() => { config.recarregar(); visao.recarregar(); }} />}
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
  const total = (fichas ?? []).filter((f) => !area || f.area === area).length;
  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-3">
        <Link href="/pt/painel?aba=escrever&tipo=obra" className="painel-cartao flex items-start gap-3 border-2 border-oxblood p-4 hover:bg-parchment-deep">
          <span aria-hidden className="text-3xl">📚</span>
          <span><span className="block font-serif text-xl font-semibold">Adicionar uma obra</span><span className="text-sm text-ink-soft">Abre Escrever › Obra para o acervo, já no formulário da ficha.</span></span>
        </Link>
        <button type="button" onClick={() => setEstado("vazia")} className="painel-cartao flex cursor-pointer items-start gap-3 p-4 text-left hover:bg-parchment-deep">
          <span aria-hidden className="text-3xl">🩹</span>
          <span><span className="block font-serif text-xl font-semibold">Completar fichas</span><span className="text-sm text-ink-soft">{fichas ? `${conta("vazia")} com muita coisa faltando e ${conta("parcial")} parciais.` : "As fichas que precisam de cuidado."}</span></span>
        </button>
        <a href="/pt/acervo" target="_blank" rel="noopener noreferrer" className="painel-cartao flex items-start gap-3 p-4 hover:bg-parchment-deep">
          <span aria-hidden className="text-3xl">🏛️</span>
          <span><span className="block font-serif text-xl font-semibold">Ver o acervo público</span><span className="text-sm text-ink-soft">Como as obras aparecem para quem visita (abre em outra aba).</span></span>
        </a>
      </section>

      <details className="painel-cartao p-4">
        <summary className="cursor-pointer font-serif text-xl font-semibold">Como pôr um livro no acervo, em quatro passos</summary>
        <ol className="mt-3 grid gap-4 md:grid-cols-2">
          <li className="border-l-4 border-[#c21f16] pl-3"><strong>1. Ache uma fonte legítima.</strong> Domínio público (Project Gutenberg, Domínio Público, Wikisource, Arquivo Marxista), licença aberta (SciELO Livros, OpenStax, MEC Livros) ou, para obra protegida, a página da editora ou de uma biblioteca.</li>
          <li className="border-l-4 border-[#c21f16] pl-3"><strong>2. Confira a licença.</strong> No Brasil, a obra entra em domínio público em 1º de janeiro do ano seguinte aos 70 anos da morte do autor (e a tradução tem direitos próprios). Livro protegido entra como <em>Direitos reservados</em>: só a ficha, com o link da editora ou biblioteca. Nunca PDF de fora da fonte.</li>
          <li className="border-l-4 border-[#c21f16] pl-3"><strong>3. Preencha a ficha.</strong> Em Escrever › 📚 Obra para o acervo: título, autor, disciplina, licença, o link da página da obra (não do PDF) e uma sinopse curta, com as suas palavras.</li>
          <li className="border-l-4 border-[#c21f16] pl-3"><strong>4. Revisão.</strong> Outra pessoa da curadoria confere a ficha e a licença; aprovada, a obra entra no site na próxima publicação, com capa se a fonte tiver uma aberta.</li>
        </ol>
        <p className="mt-3 text-sm text-ink-soft">Exemplo: achou um livro infantil protegido? Ele entra como ficha “Direitos reservados”, com o link da editora ou de uma biblioteca pública, sem arquivo. Só a curadoria e a coordenação mexem no acervo.</p>
      </details>

      <section>
      <h2 className="font-serif text-2xl font-semibold">As obras e as fichas</h2>
      <p className="text-ink-soft">Cada obra do acervo com o selo da ficha. As que têm algo faltando já viram tarefa na fila (até o limite de cada rodada).</p>
      {fichas && (
        <p className="mt-2 flex flex-wrap gap-2 text-sm">
          {([["", `Todas (${total})`], ["completa", `✓ Completas (${conta("completa")})`], ["parcial", `◐ Parciais (${conta("parcial")})`], ["vazia", `○ Faltando muito (${conta("vazia")})`]] as const).map(([v, nomeDoFiltro]) => (
            <button key={v} type="button" aria-pressed={estado === v} onClick={() => setEstado(v)} className={`cursor-pointer border-2 px-3 py-1 ${estado === v ? "border-ink bg-ink text-parchment" : "border-ink/20 hover:border-ink"}`}>{nomeDoFiltro}</button>
          ))}
        </p>
      )}
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
      </section>
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
    // Sem "noopener": com ele o navegador devolve null e a janela do comprovante nunca recebia o texto.
    const w = window.open("", "_blank", "width=800,height=900");
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
