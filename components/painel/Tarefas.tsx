// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import {
  ArrowDown,
  ArrowUp,
  Bandage,
  BookPlus,
  CalendarDays,
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleDotDashed,
  Clock3,
  ExternalLink,
  Hand,
  Kanban,
  Landmark,
  Languages,
  Lightbulb,
  Link2,
  type LucideIcon,
  Plus,
  Send,
  Settings2,
  Signal,
  Sparkles,
  SquareCheck,
  Star,
  Tag,
  Undo2,
  User,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { can, type Me, rpc } from "@/lib/backend";
import { getItem, setItem } from "@/lib/storage";
import { TIPOS, type TipoDeLacuna } from "@/lib/tipos-de-tarefa";
import { useI18n } from "../I18n";
import { CampoData } from "./Campos";
import { agirOtimista, Aviso, data, dataHora, dia, textoDoErro, useAcao, useLista } from "./comum";
import { Abas, Area, Botao, Busca, CabecalhoDeSecao, Campo, Cartao, Dialogo, Esqueleto, Estatistica, Estatisticas, Faixa, ItemDeLista, Lista, Marca, Selecao, Selo, type TomDoSelo, useComandosDaSecao, Vazio } from "./ui";

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

/** O selo do tempo da tarefa (5, 15 ou 30 minutos), com o relógio. */
function SeloDeTempo({ minutos }: { minutos: number }) {
  return (
    <Selo tom={minutos === 5 ? "ok" : minutos === 15 ? "info" : "neutro"}>
      <Clock3 aria-hidden width={12} height={12} />
      <span className="tabular-nums">{minutos} min</span>
    </Selo>
  );
}

/** O cartão de uma tarefa: o que é, quanto tempo leva, o que muda e como fazer. */
function CartaoDaTarefa({ t, acoes }: { t: Tarefa; acoes?: ReactNode }) {
  const info = infoDe(t.tipo);
  return (
    <Cartao as="article" className="flex h-full flex-col">
      <p className="flex flex-wrap items-center gap-1.5">
        <Selo tom={tomDe(t.tipo)}>{info.nome}</Selo>
        <SeloDeTempo minutos={t.minutos} />
        <Selo tom={t.dificuldade === "iniciante" ? "ok" : "neutro"}>{DIFICULDADE[t.dificuldade] ?? t.dificuldade}</Selo>
      </p>
      <h3 className="pn-cartao-titulo mt-2">{t.titulo}</h3>
      {(t.detalhe || t.descricao) && <p className="pn-ajuda mt-1">{t.tipo === "traducao" ? `Para o ${IDIOMAS[t.detalhe] ?? t.detalhe}` : t.descricao || t.detalhe}</p>}
      {(t.impacto || info.impacto) && (
        <p className="mt-2 flex gap-1.5 text-sm">
          <Sparkles aria-hidden width={14} height={14} className="mt-0.5 shrink-0 text-gold" />
          <span>{t.impacto || info.impacto}</span>
        </p>
      )}
      <details className="mt-2 text-sm">
        <summary className="pn-elo cursor-pointer">Como fazer</summary>
        <p className="pn-ajuda mt-1">{info.como}</p>
        {t.alvo && (
          <a href={`/pt${t.alvo}`} target="_blank" rel="noopener noreferrer" className="pn-elo mt-1 inline-flex items-center gap-1">
            Abrir {t.alvo.startsWith("/acervo") ? "a obra" : t.alvo.startsWith("/autores") ? "a página do autor" : "a aula"}
            <ExternalLink aria-hidden width={12} height={12} />
          </a>
        )}
      </details>
      {acoes && <div className="mt-auto flex flex-wrap gap-2 pt-3">{acoes}</div>}
    </Cartao>
  );
}

/**
 * O formulário de entrega, pelo tipo da tarefa: só os campos que aquela tarefa pede. Com "naPaleta", o "Entregar" também
 * vai para a paleta (Ctrl K) enquanto a tarefa está aberta; com "aoLiberar", o "Liberar" usa a ação de quem abriu (no
 * quadro, otimista: a tarefa volta para "A fazer" na hora).
 */
export function Entrega({ t, depois, ir, naPaleta, aoLiberar }: { t: Tarefa; depois: () => void; ir: (aba: string) => void; naPaleta?: boolean; aoLiberar?: () => unknown }) {
  const acao = useAcao(depois);
  const [e, setE] = useState<Record<string, string>>(() => ({ ...t.entrega }));
  const mudar = (k: string, v: string) => setE((x) => ({ ...x, [k]: v }));
  const entregar = () => void acao.agir("tarefa_entregar", { p_id: t.id, p_entrega: e }, "Entregue ✓ Alguém da equipe revisa e você recebe um recado.");
  const liberar = () => (aoLiberar ? void aoLiberar() : void acao.agir("tarefa_liberar", { p_id: t.id }, "Liberada: a tarefa voltou para a fila. Sem problema."));
  useComandosDaSecao(naPaleta ? [{ id: "tarefa-entregar", nome: "Entregar", sobre: t.titulo, simbolo: Send, fazer: entregar }] : [], [naPaleta, t.id]);
  const campoTexto = (k: string, rotuloDoCampo: string, linhas = 3) => <Area rotulo={rotuloDoCampo} value={e[k] ?? ""} onChange={(x) => mudar(k, x.target.value)} rows={linhas} maxLength={6000} />;
  const campos = () => {
    switch (t.tipo) {
      case "ficha_ano":
        return (
          <>
            <div className="max-w-40">
              <Campo rotulo="Ano da primeira publicação" value={e.ano ?? ""} onChange={(x) => mudar("ano", x.target.value.replace(/[^\d-]/g, "").slice(0, 5))} inputMode="numeric" placeholder="1949" />
            </div>
            {campoTexto("texto", "Onde você achou (opcional)", 2)}
          </>
        );
      case "ficha_sinopse":
        return campoTexto("sinopse", "Sinopse (duas a quatro frases, com as suas palavras)", 5);
      case "licenca":
        return (
          <>
            <Selecao rotulo="Licença" value={e.licenca ?? ""} onChange={(x) => mudar("licenca", x.target.value)}>
              <option value="">Escolha</option>
              {LICENCAS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </Selecao>
            <Campo rotulo="Link onde está escrito" value={e.prova ?? ""} onChange={(x) => mudar("prova", x.target.value.trim())} placeholder="https://…" simbolo={Link2} />
            {campoTexto("texto", "Observação (opcional)", 2)}
          </>
        );
      case "link":
        return (
          <>
            <Campo rotulo="Endereço novo" value={e.url ?? ""} onChange={(x) => mudar("url", x.target.value.trim())} placeholder="https://…" simbolo={Link2} />
            {campoTexto("texto", "Observação (opcional)", 2)}
          </>
        );
      case "duplicata":
        return (
          <>
            <fieldset className="grid gap-1.5 text-sm">
              <legend className="pn-rotulo">As duas obras são</legend>
              <span className="flex flex-wrap gap-4">
                <label className="pn-marca"><input type="radio" checked={e.decisao === "mesma"} onChange={() => mudar("decisao", "mesma")} /> a mesma</label>
                <label className="pn-marca"><input type="radio" checked={e.decisao === "diferentes"} onChange={() => mudar("decisao", "diferentes")} /> diferentes</label>
              </span>
            </fieldset>
            {campoTexto("texto", "Por quê (opcional)", 2)}
          </>
        );
      case "sem_ligacao":
        return (
          <>
            <Campo rotulo="Aula em que a obra entra" value={e.aula ?? ""} onChange={(x) => mudar("aula", x.target.value.trim())} placeholder="/trilhas/…/…" />
            {campoTexto("texto", "Em que ponto da aula e por quê", 2)}
          </>
        );
      case "biografia":
        return campoTexto("biografia", "Biografia (três a seis parágrafos curtos, com as fontes no fim)", 8);
      case "imagem_alt":
        return <Campo rotulo="Descrição da imagem" value={e.alt ?? ""} onChange={(x) => mudar("alt", x.target.value)} maxLength={300} />;
      case "traducao":
        return (
          <>
            <p className="text-sm">A tradução é feita e enviada pelo editor lado a lado de Traduções. Depois de enviar, conte aqui.</p>
            <p>
              <Botao pequeno simbolo={Languages} onClick={() => ir("traducoes")}>Abrir Traduções</Botao>
            </p>
            {campoTexto("texto", "O que você enviou", 2)}
          </>
        );
      default:
        return campoTexto("texto", "O que você fez", 4);
    }
  };
  return (
    <div className="mt-3 grid gap-3 border-t border-rule pt-3">
      {t.nota_revisao && <Faixa tom="bordo">Voltou com um comentário: {t.nota_revisao}</Faixa>}
      {campos()}
      <p className="flex flex-wrap gap-2">
        <Botao variante="principal" simbolo={Send} carregando={acao.ocupado} onClick={entregar}>Entregar</Botao>
        <Botao variante="discreto" simbolo={Undo2} disabled={acao.ocupado} onClick={liberar}>Liberar</Botao>
        {t.dificuldade === "iniciante" && <Botao variante="discreto" simbolo={Hand} disabled={acao.ocupado} onClick={() => void acao.agir("tarefa_pedir_mentor", { p_id: t.id }, "Pedido enviado a um mentor: ele chama você nas Conversas.")}>Pedir ajuda a um mentor</Botao>}
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
    <section aria-labelledby="saude-titulo" className="grid gap-4">
      <CabecalhoDeSecao nivel={2} id="saude-titulo" titulo="Saúde do acervo" />
      <Estatisticas rotulo="Saúde do acervo">
        <Estatistica rotulo="Fichas completas" valor={pct === null ? "—" : `${pct}%`} tom="bordo" detalhe={s.obras ? `faltam ${s.obras - (s.fichas_completas ?? 0)} de ${s.obras} obras` : "o verificador ainda não rodou"} />
        <Estatistica
          rotulo="Aulas sem tradução"
          valor={Object.values(s.traducao_por_idioma ?? {}).reduce((a, b) => a + b, 0) || "—"}
          detalhe={Object.entries(s.traducao_por_idioma ?? {}).map(([id, n]) => `${IDIOMAS[id] ?? id}: ${n}`).join(" · ")}
        />
        <Estatistica rotulo="Licenças a conferir" valor={s.licencas_a_conferir ?? "—"} detalhe={`links quebrados: ${d.abertas.link ?? 0}`} />
        <Estatistica
          rotulo="Tarefas abertas"
          valor={Object.values(d.abertas).reduce((a, b) => a + b, 0)}
          tom={Object.keys(d.abertas).length === 0 ? "ok" : "neutro"}
          detalhe={Object.keys(d.abertas).length === 0 ? "Nenhuma: tudo em dia ✓" : Object.entries(d.abertas).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tipo, n]) => `${infoDe(tipo).nome}: ${n}`).join(" · ")}
        />
      </Estatisticas>
      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao as="div">
          <p className="font-semibold">{estaSemana > 0 ? `A equipe completou ${estaSemana} ${estaSemana === 1 ? "tarefa" : "tarefas"} desde segunda.` : "Nenhuma tarefa concluída nesta semana ainda."}</p>
          <div className="mt-3 flex h-24 items-end gap-2" role="img" aria-label={`Tarefas concluídas nas últimas semanas: ${d.semanas.map((x) => `${dia(x.semana)}: ${x.n}`).join("; ")}`}>
            {d.semanas.map((x) => (
              <div key={x.semana} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t-sm bg-ok" style={{ height: `${(80 * x.n) / maxSemana}px` }} />
                <span className="pn-rotulo-mono tabular-nums">{x.semana.slice(8, 10)}/{x.semana.slice(5, 7)}</span>
              </div>
            ))}
            {d.semanas.length === 0 && <p className="pn-ajuda">O gráfico aparece com as primeiras tarefas concluídas.</p>}
          </div>
        </Cartao>
        {d.meta && (
          <Cartao as="div">
            <p className="pn-rotulo-mono">Meta da semana</p>
            <p className="mt-1 font-semibold">{d.meta.texto}</p>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-rule" role="progressbar" aria-valuemin={0} aria-valuemax={d.meta.alvo} aria-valuenow={d.meta.feitas} aria-label="Progresso da meta">
              <div className="h-2.5 rounded-full bg-ok" style={{ width: `${Math.min(100, (100 * d.meta.feitas) / d.meta.alvo)}%` }} />
            </div>
            <p className="mt-1 text-sm tabular-nums">{d.meta.feitas} de {d.meta.alvo}</p>
          </Cartao>
        )}
      </div>
    </section>
  );
}

/** O primeiro dia: o passo a passo e um exemplo resolvido, no lugar do "comece por aqui". */
function PrimeiroDia() {
  return (
    <Cartao as="div" variante="destaque" className="mb-4">
      <p className="font-semibold">Primeiro dia por aqui? Em cinco passos:</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
        <li>Escolha quanto tempo você tem hoje (5, 15 ou 30 minutos).</li>
        <li>Pegue uma tarefa marcada como <strong>iniciante</strong> e clique em <strong>Vou fazer esta</strong>.</li>
        <li>Abra “Como fazer” e a obra ou aula da tarefa.</li>
        <li>Preencha e clique em <strong>Entregar</strong>. Alguém da equipe revisa.</li>
        <li>Você recebe um recado dizendo o que mudou no site com o seu trabalho.</li>
      </ol>
      <details className="mt-2 text-sm">
        <summary className="pn-elo cursor-pointer">Ver um exemplo resolvido</summary>
        <p className="mt-1"><strong>Tarefa:</strong> Completar o ano da obra “1984 (Nineteen Eighty-Four)”, de George Orwell.</p>
        <p><strong>O que foi feito:</strong> abri o link da obra, vi na página do Project Gutenberg “First published 1949”, escrevi <code>1949</code> no campo do ano e, em “onde você achou”, colei o endereço da página.</p>
        <p><strong>Resultado:</strong> depois da revisão, a obra passou a aparecer em 1949 na linha do tempo.</p>
      </details>
      <p className="pn-ajuda mt-2">Nada de cobrança: se não der, é só liberar a tarefa. Ela volta para a fila sem problema.</p>
    </Cartao>
  );
}

/** "Para você hoje": de 3 a 5 tarefas para o tempo que a pessoa tem, o que ela já pegou, as filas e a saúde do acervo. */
export function ParaVoceHoje({ me, ir }: { me: Me; ir: (aba: string) => void }) {
  const [minutos, setMinutos] = useState(() => Number(getItem("lucia:tarefas-minutos") ?? 15) || 15);
  const [pular, setPular] = useState<string[]>([]);
  const [descanso, setDescanso] = useState(() => getItem("lucia:tarefas-descanso") === hojeIso());
  const argumentos = { p_minutos: minutos, p_pular: pular };
  const dados = useLista<ParaMim>("tarefas_para_mim", argumentos);
  const [ocupado, setOcupado] = useState(false);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const d = dados.dados;
  const escolherMinutos = (m: number) => { setMinutos(m); setPular([]); setItem("lucia:tarefas-minutos", String(m)); };
  // Reservar é otimista: a tarefa sai das sugestões e a entrega aparece em "Continuar de onde parou" na hora.
  async function reservar(t: Tarefa) {
    setOcupado(true);
    const ok = await agirOtimista<ParaMim>({
      lista: { funcao: "tarefas_para_mim", argumentos },
      remendo: (x) => ({ ...x, sugestoes: x.sugestoes.filter((s) => s.id !== t.id), minhas: [{ ...t, status: "reservada", minha: true, reservada_por: me.nome }, ...x.minhas.filter((s) => s.id !== t.id)] }),
      funcao: "tarefa_reservar",
      argumentos: { p_id: t.id },
      sucesso: "Reservada no seu nome ✓",
    });
    setOcupado(false);
    if (ok) setAbrindo(t.id);
  }

  if ((dados.erro && !d) || d?.mostrar === false) return null;
  return (
    <div className="grid gap-8">
      <section aria-labelledby="pvh-titulo" className="grid gap-3">
        <CabecalhoDeSecao
          nivel={2}
          id="pvh-titulo"
          titulo="Para você hoje"
          acoes={
            <span className="flex gap-1" role="group" aria-label="Quanto tempo você tem">
              {[5, 15, 30].map((m) => (
                <Botao key={m} pequeno simbolo={Clock3} variante={minutos === m ? "padrao" : "discreto"} aria-pressed={minutos === m} onClick={() => escolherMinutos(m)}>
                  {m} min
                </Botao>
              ))}
            </span>
          }
        />
        {descanso ? (
          <p className="pn-ajuda">
            Combinado: hoje não. Até a próxima!{" "}
            <Botao variante="discreto" pequeno onClick={() => { setDescanso(false); setItem("lucia:tarefas-descanso", ""); }}>Mostrar mesmo assim</Botao>
          </p>
        ) : !d ? (
          <Esqueleto forma="cartoes" linhas={3} rotulo="Separando tarefas…" />
        ) : (
          <>
            {d.novato && <PrimeiroDia />}
            {d.sugestoes.length === 0 ? (
              <Faixa
                tom="ok"
                acao={
                  <>
                    {minutos < 30 && <Botao variante="discreto" pequeno onClick={() => escolherMinutos(30)}>Ver as de 30 minutos</Botao>}
                    {can(me, "traducao") || can(me, "revisao") ? null : <Botao variante="discreto" pequeno onClick={() => ir("fila")}>Ou ajude na fila de revisão</Botao>}
                  </>
                }
              >
                Nenhuma tarefa de até {minutos} minutos para você agora: a fila está em dia ✓
              </Faixa>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {d.sugestoes.map((t) => (
                  <CartaoDaTarefa
                    key={t.id}
                    t={t}
                    acoes={abrindo === t.id ? null : <Botao variante="principal" pequeno simbolo={Hand} disabled={ocupado} onClick={() => void reservar(t)}>Vou fazer esta</Botao>}
                  />
                ))}
              </div>
            )}
            <p className="flex flex-wrap gap-2">
              {d.sugestoes.length > 0 && <Botao pequeno onClick={() => setPular((p) => [...p, ...d.sugestoes.map((s) => s.id)])}>Outras sugestões</Botao>}
              <Botao variante="discreto" pequeno onClick={() => { setDescanso(true); setItem("lucia:tarefas-descanso", hojeIso()); }}>Nada para mim hoje</Botao>
              <Botao variante="discreto" pequeno onClick={() => ir("tarefas")}>Ver todas as tarefas</Botao>
            </p>
          </>
        )}
      </section>

      {d && d.minhas.length > 0 && (
        <section aria-labelledby="continuar-titulo" className="grid gap-3">
          <CabecalhoDeSecao nivel={2} id="continuar-titulo" titulo="Continuar de onde parou" />
          <div className="grid gap-3 md:grid-cols-2">
            {d.minhas.map((t) => (
              <Cartao key={t.id} as="div">
                <p className="flex flex-wrap items-center gap-1.5">
                  <Selo tom={tomDe(t.tipo)}>{infoDe(t.tipo).nome}</Selo>
                  {t.status === "entregue" ? <Selo tom="bordo">entregue, esperando revisão</Selo> : t.prazo ? <Selo tom="ouro">até {dataHora(t.prazo)}</Selo> : null}
                </p>
                <p className="pn-cartao-titulo mt-1.5">{t.titulo}</p>
                {t.status === "reservada" && <Entrega t={t} depois={dados.recarregar} ir={ir} />}
              </Cartao>
            ))}
          </div>
        </section>
      )}

      {d && (
        <section aria-labelledby="filas-titulo" className="grid gap-3">
          <CabecalhoDeSecao nivel={2} id="filas-titulo" titulo="As filas de sempre" />
          <Estatisticas>
            {can(me, "coordenacao", "curadoria", "traducao", "revisao") && <Estatistica rotulo="Traduções" valor={d.filas.traducoes} aoClicar={() => ir("traducoes")} />}
            {can(me, "coordenacao", "supervisao", "curadoria", "revisao", "educacao") && <Estatistica rotulo="Fila de revisão" valor={d.filas.revisao} tom={d.filas.revisao > 0 ? "bordo" : "neutro"} aoClicar={() => ir("fila")} />}
            {can(me, "coordenacao", "curadoria", "mediacao") && <Estatistica rotulo="Triagem" valor={d.filas.triagem} aoClicar={() => ir("triagem")} />}
            <Estatistica rotulo="Fontes abertas" valor={<ExternalLink aria-hidden width={18} height={18} />} aoClicar={() => ir("fontes")} />
          </Estatisticas>
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

/** O tom do selo de cada tipo: suave, para o título continuar mandando. */
const TOM: Record<string, TomDoSelo> = {
  ficha_ano: "ouro",
  ficha_sinopse: "ouro",
  licenca: "neutro",
  link: "neutro",
  sem_ligacao: "ok",
  revisao_aula: "ok",
  biografia: "bordo",
  traducao: "bordo",
  duplicata: "info",
  imagem_alt: "info",
  avulsa: "neutro",
};
const tomDe = (tipo: string): TomDoSelo => TOM[tipo] ?? TOM.avulsa;
const NOME_DO_STATUS: Record<string, string> = { aberta: "A fazer", reservada: "Fazendo", entregue: "Esperando revisão", aprovada: "Aprovada", concluida: "Feita", encerrada: "Encerrada" };
const TOM_DO_STATUS: Record<string, TomDoSelo> = { aberta: "neutro", reservada: "ouro", entregue: "bordo", aprovada: "ok", concluida: "ok", encerrada: "neutro" };
/** Quantos cartões cada coluna mostra antes do "mostrar mais". */
const POR_COLUNA = 12;

function SeloDoStatus({ status }: { status: string }) {
  return (
    <Selo tom={TOM_DO_STATUS[status] ?? "neutro"} ponto>
      {NOME_DO_STATUS[status] ?? status}
    </Selo>
  );
}

function Iniciais({ nome }: { nome: string }) {
  const letras = nome.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "").join("") || "?";
  return <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[0.55rem] font-bold text-parchment">{letras}</span>;
}

type Vista = "quadro" | "tabela" | "minhas" | "revisao" | "mutiroes" | "configurar";
type Ordem = { por: "titulo" | "tipo" | "minutos" | "status" | "responsavel" | "prazo"; desce: boolean };
/** Os argumentos de cada lista do quadro (a mesma chave para o useLista e para o agirOtimista). */
const argumentosDe = (tipo: string, status: string) => ({ p_tipo: tipo, p_status: status, p_pagina: 0 });

/**
 * A seção Tarefas, no jeito de uma base de dados: o mesmo conjunto visto como quadro (arrastar de "A fazer" para
 * "Fazendo" reserva a tarefa), como tabela que se ordena pelo cabeçalho ou só as minhas, com filtros por tipo, tempo e
 * nível, e cada tarefa abrindo numa janela, com as propriedades, o "como fazer" e a entrega. Revisão rápida, mutirões e
 * os controles da coordenação continuam nas outras vistas. Reservar e liberar são otimistas (a tela muda na hora e volta
 * se o banco recusar); com uma tarefa aberta, "Pegar esta tarefa", "Entregar" e "Liberar" também estão na paleta.
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
  const abertas = useLista<Tarefa[]>("tarefas_listar", argumentosDe(tipo, "aberta"));
  const reservadas = useLista<Tarefa[]>("tarefas_listar", argumentosDe(tipo, "reservada"));
  const entregues = useLista<Tarefa[]>("tarefas_listar", argumentosDe(tipo, "entregue"));
  const aprovadas = useLista<Tarefa[]>("tarefas_listar", argumentosDe(tipo, "aprovada"));
  const feitas = useLista<Tarefa[]>("tarefas_listar", argumentosDe(tipo, "concluida"));
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

  // Reservar e liberar, otimistas: a tarefa muda de coluna na hora (o remendo vai na lista onde ela está); depois as
  // listas se releem para ela aparecer na coluna nova de verdade. Se o banco recusar, ela volta e aparece o erro.
  async function reservar(t: Tarefa, sucesso = "Reservada no seu nome ✓ Abra o cartão para entregar.") {
    const ok = await agirOtimista<Tarefa[]>({
      lista: { funcao: "tarefas_listar", argumentos: argumentosDe(tipo, t.status) },
      remendo: (x) => x.map((item) => (item.id === t.id ? { ...item, status: "reservada", minha: true, reservada_por: me.nome } : item)),
      funcao: "tarefa_reservar",
      argumentos: { p_id: t.id },
      sucesso,
    });
    if (ok) recarregar();
  }
  async function liberar(t: Tarefa, sucesso = "Liberada: a tarefa voltou para a fila. Sem problema.") {
    const ok = await agirOtimista<Tarefa[]>({
      lista: { funcao: "tarefas_listar", argumentos: argumentosDe(tipo, t.status) },
      remendo: (x) => x.map((item) => (item.id === t.id ? { ...item, status: "aberta", minha: false, reservada_por: "", prazo: null } : item)),
      funcao: "tarefa_liberar",
      argumentos: { p_id: t.id },
      sucesso,
    });
    if (ok) recarregar();
  }

  // Na paleta (Ctrl K), os comandos da tarefa aberta. O "Entregar" vem da própria entrega (que tem o que foi preenchido).
  useComandosDaSecao(
    espiada
      ? [
          ...(espiada.status === "aberta" ? [{ id: "tarefa-pegar", nome: "Pegar esta tarefa", sobre: espiada.titulo, simbolo: Hand, fazer: () => reservar(espiada, "Reservada no seu nome ✓ A entrega aparece aqui embaixo.") }] : []),
          ...(espiada.status === "reservada" && (espiada.minha || coordena) ? [{ id: "tarefa-liberar", nome: "Liberar", sobre: espiada.titulo, simbolo: Undo2, fazer: () => liberar(espiada, espiada.minha ? undefined : "Liberada: a tarefa voltou para a fila.") }] : []),
        ]
      : [],
    [espiada?.id, espiada?.status, espiada?.minha, coordena],
  );

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
    acao.setAviso("");
    if (de === "aberta" && coluna === "reservada") await reservar(t);
    else if (de === "reservada" && t.minha && coluna === "aberta") await liberar(t);
    else if (de === "reservada" && t.minha && coluna === "revisao") {
      setEspiando(t.id);
      acao.setAviso("Preencha a entrega para mandar para a revisão.");
    } else acao.setAviso("Esse caminho não se faz arrastando: a revisão e o verificador do acervo levam a tarefa adiante.");
  }

  const vistas: { id: Vista; nome: string; conta?: number }[] = [
    { id: "quadro", nome: "Quadro" },
    { id: "tabela", nome: "Tabela" },
    { id: "minhas", nome: "Minhas", conta: minhas.length },
    ...(revisa ? [{ id: "revisao" as const, nome: "Revisão rápida", conta: entregues.dados?.length }] : []),
    { id: "mutiroes", nome: "Mutirões e projetos" },
    ...(coordena ? [{ id: "configurar" as const, nome: "Configurar e acompanhar" }] : []),
  ];

  const ordenadas = [...filtradas].sort((a, b) => {
    const valor = (t: Tarefa): string | number =>
      ordem.por === "titulo" ? t.titulo : ordem.por === "tipo" ? infoDe(t.tipo).nome : ordem.por === "minutos" ? t.minutos : ordem.por === "status" ? COLUNAS.findIndex((c) => c.id === colunaDe(t.status)) : ordem.por === "responsavel" ? t.reservada_por || "~" : (t.prazo ?? "~");
    const [x, y] = [valor(a), valor(b)];
    const comparado = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt");
    return ordem.desce ? -comparado : comparado;
  });

  const quem = (t: Tarefa) => (t.reservada_por ? <span className="flex items-center gap-1.5"><Iniciais nome={t.reservada_por} />{t.minha ? "Você" : t.reservada_por}</span> : null);

  const filtros = (vista === "quadro" || vista === "tabela") && (
    <div className="flex flex-wrap items-end gap-2 border-b border-rule pb-3">
      <div className="w-44 sm:w-52">
        <Busca rotulo="Buscar tarefas" valor={busca} aoMudar={setBusca} placeholder="Buscar" />
      </div>
      <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo" className="pn-campo w-auto">
        <option value="">Tipo: todos</option>
        {(Object.keys(TIPOS) as TipoDeLacuna[]).map((k) => (
          <option key={k} value={k}>{TIPOS[k].nome}</option>
        ))}
      </select>
      <span className="flex gap-1" role="group" aria-label="Tempo">
        {[5, 15, 30].map((m) => (
          <Botao key={m} pequeno variante={tempo === m ? "padrao" : "discreto"} aria-pressed={tempo === m} onClick={() => setTempo(tempo === m ? 0 : m)}>
            {m} min
          </Botao>
        ))}
      </span>
      <select value={nivel} onChange={(e) => setNivel(e.target.value)} aria-label="Nível" className="pn-campo w-auto">
        <option value="">Nível: todos</option>
        {Object.entries(DIFICULDADE).map(([k, nome]) => (
          <option key={k} value={k}>{nome}</option>
        ))}
      </select>
      {filtrando && (
        <Botao variante="discreto" pequeno simbolo={X} onClick={() => { setTipo(""); setTempo(0); setNivel(""); setBusca(""); }}>
          Limpar
        </Botao>
      )}
      <span className="pn-ajuda ml-auto self-center tabular-nums" aria-live="polite">{filtradas.length} {filtradas.length === 1 ? "tarefa" : "tarefas"}</span>
      {coordena && (
        <Botao variante="principal" pequeno simbolo={Plus} onClick={() => setCriando(true)}>
          Nova
        </Botao>
      )}
    </div>
  );

  const conteudo = (
    <div className="grid gap-3">
      {filtros}
      {erro && <Faixa tom="erro" acao={<Botao pequeno onClick={recarregar}>Tentar de novo</Botao>}>{erro}</Faixa>}
      <Aviso texto={acao.aviso} />
      {carregando && (vista === "quadro" || vista === "tabela" || vista === "minhas") && <Esqueleto forma={vista === "tabela" ? "tabela" : "cartoes"} linhas={4} rotulo="Separando tarefas…" />}

      {vista === "quadro" && !carregando && (
        <>
          <p className="pn-ajuda">Arraste um cartão de “A fazer” para “Fazendo” para pegar a tarefa; de volta, para liberar. Toque no cartão para ver tudo.</p>
          <div className="flex gap-3 overflow-x-auto pb-3">
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
                  className={`flex w-[17rem] shrink-0 flex-col rounded-[var(--pn-raio-cartao)] border border-rule bg-[var(--pn-superficie-2)] p-2 transition-colors motion-reduce:transition-none lg:w-auto lg:min-w-[14rem] lg:flex-1 ${alvo === coluna.id ? "outline-2 outline-offset-2 outline-[var(--pn-destaque-vivo)]" : ""}`}
                >
                  <header className="flex items-center gap-2 px-1 pb-2">
                    <span aria-hidden className={`h-2 w-2 rounded-full ${coluna.ponto}`} />
                    <span className="pn-rotulo-mono">{coluna.nome}</span>
                    <span className="pn-ajuda tabular-nums">{daColuna.length}</span>
                    {coluna.id === "aberta" && coordena && <Botao icone pequeno variante="discreto" simbolo={Plus} aria-label="Nova tarefa" dica="Nova tarefa" className="ml-auto" onClick={() => setCriando(true)} />}
                  </header>
                  <div className="flex flex-col gap-2">
                    {mostradas.map((t) => (
                      <CartaoDoQuadro key={t.id} t={t} abrir={setEspiando} arrastavel={t.status === "aberta" || (t.status === "reservada" && t.minha)} comecar={setArrastando} parar={() => { setArrastando(null); setAlvo(null); }} />
                    ))}
                  </div>
                  {daColuna.length > mostradas.length && (
                    <Botao variante="discreto" pequeno className="mt-2 justify-start" onClick={() => setMais([...mais, coluna.id])}>
                      Mostrar mais {daColuna.length - mostradas.length}
                    </Botao>
                  )}
                  {daColuna.length === 0 && <p className="pn-ajuda px-1 py-3">{coluna.vazio}</p>}
                </section>
              );
            })}
          </div>
        </>
      )}

      {vista === "tabela" && !carregando && (
        <div className="pn-tabela-caixa overflow-x-auto">
          <table className="pn-tabela min-w-[48rem]">
            <thead>
              <tr>
                {(
                  [
                    ["titulo", "Título", SquareCheck],
                    ["tipo", "Tipo", Tag],
                    ["minutos", "Tempo", Clock3],
                    ["status", "Status", CircleDot],
                    ["responsavel", "Quem pegou", User],
                    ["prazo", "Prazo", CalendarDays],
                  ] as const
                ).map(([id, nome, Simbolo]) => (
                  <th key={id} scope="col" aria-sort={ordem.por === id ? (ordem.desce ? "descending" : "ascending") : undefined}>
                    <button type="button" className="pn-ordenar" onClick={() => setOrdem({ por: id, desce: ordem.por === id ? !ordem.desce : false })}>
                      <Simbolo aria-hidden width={13} height={13} />
                      {nome}
                      {ordem.por === id && (ordem.desce ? <ArrowDown aria-hidden width={13} height={13} /> : <ArrowUp aria-hidden width={13} height={13} />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((t) => (
                <tr key={t.id} className="cursor-pointer" onClick={() => setEspiando(t.id)}>
                  <td className="max-w-[22rem]">
                    <button type="button" className="cursor-pointer text-left font-medium hover:underline" onClick={(e) => { e.stopPropagation(); setEspiando(t.id); }}>
                      {t.titulo}
                    </button>
                  </td>
                  <td><Selo tom={tomDe(t.tipo)}>{infoDe(t.tipo).nome}</Selo></td>
                  <td className="whitespace-nowrap"><SeloDeTempo minutos={t.minutos} /></td>
                  <td><SeloDoStatus status={t.status} /></td>
                  <td>{quem(t) ?? <span className="pn-ajuda">—</span>}</td>
                  <td className="pn-ajuda whitespace-nowrap tabular-nums">{t.prazo && t.status === "reservada" ? dataHora(t.prazo) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ordenadas.length === 0 && <Vazio titulo={filtrando ? "Nenhuma tarefa com esses filtros." : "Nenhuma tarefa por aqui."} />}
        </div>
      )}

      {vista === "minhas" && !carregando && (
        <div>
          {minhas.length === 0 ? (
            <Vazio simbolo={Kanban} titulo="Nada no seu nome agora" texto="Pegue uma tarefa no Quadro ou em “Para você hoje”, na Mesa." acao={<Botao onClick={() => escolher("quadro")}>Abrir o quadro</Botao>} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {minhas.map((t) => (
                <Cartao key={t.id} as="article">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <SeloDoStatus status={t.status} />
                    <Selo tom={tomDe(t.tipo)}>{infoDe(t.tipo).nome}</Selo>
                    {t.prazo && t.status === "reservada" && <span className="pn-ajuda tabular-nums">até {dataHora(t.prazo)}</span>}
                  </div>
                  <button type="button" className="pn-cartao-titulo mt-1.5 cursor-pointer text-left hover:underline" onClick={() => setEspiando(t.id)}>
                    {t.titulo}
                  </button>
                  {t.status === "reservada" ? <Entrega t={t} depois={recarregar} ir={ir} aoLiberar={() => liberar(t)} /> : <p className="pn-ajuda mt-2">{t.status === "aprovada" ? "Aprovada ✓ Entra no site na próxima publicação." : "Entregue ✓ Alguém da equipe revisa e você recebe um recado."}</p>}
                </Cartao>
              ))}
            </div>
          )}
        </div>
      )}

      {vista === "revisao" && revisa && <RevisaoRapida />}
      {vista === "mutiroes" && <MutiroesEProjetos me={me} />}
      {vista === "configurar" && coordena && <Configurar />}
    </div>
  );

  return (
    <div>
      <Abas rotulo="Vistas das tarefas" opcoes={vistas} valor={vista} aoMudar={escolher} painel={() => conteudo} />
      {espiada && <Espiar t={espiada} fechar={() => setEspiando(null)} ir={ir} depois={recarregar} coordena={coordena} pegar={() => reservar(espiada, "Reservada no seu nome ✓ A entrega aparece aqui embaixo.")} liberar={(sucesso) => liberar(espiada, sucesso)} />}
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
      className={`pn-cartao pn-cartao-interativo block w-full !p-3 text-left ${arrastavel ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
    >
      <span className="block font-semibold leading-snug">{t.titulo}</span>
      <span className="mt-2 flex flex-wrap gap-1">
        <Selo tom={tomDe(t.tipo)}>{infoDe(t.tipo).nome}</Selo>
        <SeloDeTempo minutos={t.minutos} />
        {t.dificuldade === "iniciante" && <Selo tom="ok">iniciante</Selo>}
      </span>
      {(t.reservada_por || (t.prazo && t.status === "reservada")) && (
        <span className="pn-ajuda mt-2 flex items-center gap-1.5">
          {t.reservada_por && (
            <>
              <Iniciais nome={t.reservada_por} />
              {t.minha ? "Você" : t.reservada_por}
            </>
          )}
          {t.prazo && t.status === "reservada" && <span className="ml-auto tabular-nums">até {dataHora(t.prazo)}</span>}
        </span>
      )}
      {t.nota_revisao && t.status === "reservada" && <span className="mt-2 block text-xs font-semibold text-oxblood">Voltou com um comentário</span>}
    </button>
  );
}

/** Uma linha de propriedade, no jeito de uma página de base de dados: o nome à esquerda, o valor à direita. */
function Propriedade({ simbolo: Simbolo, nome, children }: { simbolo: LucideIcon; nome: string; children: ReactNode }) {
  return (
    <>
      <dt className="pn-rotulo-mono flex items-center gap-2 py-1.5">
        <Simbolo aria-hidden width={13} height={13} />
        {nome}
      </dt>
      <dd className="min-w-0 py-1.5">{children}</dd>
    </>
  );
}

/** O botão de fechar no canto da janela. */
function Fechar({ fechar }: { fechar: () => void }) {
  return <Botao icone pequeno variante="discreto" simbolo={X} aria-label="Fechar" className="pn-dialogo-fechar" onClick={fechar} />;
}

/** A tarefa aberta numa janela: propriedades, o que fazer, o "como fazer" e a entrega. Esc fecha; o foco fica preso nela. */
function Espiar({ t, fechar, ir, depois, coordena, pegar, liberar }: { t: Tarefa; fechar: () => void; ir: (aba: string) => void; depois: () => void; coordena: boolean; pegar: () => Promise<void>; liberar: (sucesso?: string) => Promise<void> }) {
  const [ocupado, setOcupado] = useState(false);
  const info = infoDe(t.tipo);
  const destino = t.alvo ? (t.alvo.startsWith("/acervo") ? "a obra" : t.alvo.startsWith("/autores") ? "a página do autor" : "a aula") : "";
  const agir = async (f: () => Promise<void>) => {
    setOcupado(true);
    await f();
    setOcupado(false);
  };

  return (
    <Dialogo aberto aoMudar={(aberto) => !aberto && fechar()} titulo={t.titulo} largo>
      <Fechar fechar={fechar} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="pn-rotulo-mono min-w-0 flex-1 truncate">Tarefas / {info.nome}</span>
        {t.alvo && (
          <a href={`/pt${t.alvo}`} target="_blank" rel="noopener noreferrer" className="pn-elo inline-flex items-center gap-1 text-sm">
            <Link2 aria-hidden width={13} height={13} />
            Abrir {destino}
            <ExternalLink aria-hidden width={12} height={12} />
          </a>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-x-3 text-sm">
        <Propriedade simbolo={CircleDot} nome="Status"><SeloDoStatus status={t.status} /></Propriedade>
        <Propriedade simbolo={Tag} nome="Tipo"><Selo tom={tomDe(t.tipo)}>{info.nome}</Selo></Propriedade>
        <Propriedade simbolo={Clock3} nome="Tempo">{t.minutos} minutos</Propriedade>
        <Propriedade simbolo={Signal} nome="Nível">{DIFICULDADE[t.dificuldade] ?? t.dificuldade}</Propriedade>
        <Propriedade simbolo={User} nome="Quem pegou">{t.reservada_por ? <span className="flex items-center gap-1.5"><Iniciais nome={t.reservada_por} />{t.minha ? "Você" : t.reservada_por}</span> : <span className="pn-ajuda">Ninguém ainda</span>}</Propriedade>
        {t.prazo && t.status === "reservada" && <Propriedade simbolo={CalendarDays} nome="Prazo"><span className="tabular-nums">{dataHora(t.prazo)}</span></Propriedade>}
        {t.tipo === "traducao" && t.detalhe && <Propriedade simbolo={Languages} nome="Idioma">{IDIOMAS[t.detalhe] ?? t.detalhe}</Propriedade>}
      </dl>

      <div className="mt-4 grid gap-4 border-t border-rule pt-4">
        {(t.descricao || (t.detalhe && t.tipo !== "traducao")) && <p className="whitespace-pre-line leading-relaxed">{t.descricao || t.detalhe}</p>}
        {(t.impacto || info.impacto) && (
          <p className="flex gap-2 leading-relaxed">
            <Star aria-hidden width={16} height={16} className="mt-0.5 shrink-0 text-gold" />
            <span><strong>O que muda:</strong> {t.impacto || info.impacto}</span>
          </p>
        )}
        <Cartao as="div" variante="plano" className="flex gap-3 text-sm leading-relaxed">
          <Lightbulb aria-hidden width={18} height={18} className="mt-0.5 shrink-0 text-gold" />
          <div>
            <p className="font-semibold">Como fazer</p>
            <p className="pn-ajuda mt-1">{info.como}</p>
          </div>
        </Cartao>
      </div>

      <div className="mt-5">
        {t.status === "aberta" && (
          <div className="flex flex-wrap items-center gap-3">
            <Botao variante="principal" simbolo={Hand} carregando={ocupado} onClick={() => void agir(pegar)}>
              Vou fazer esta
            </Botao>
            <span className="pn-ajuda">Fica no seu nome por um tempo, pelo tamanho da tarefa. Se não der, é só liberar.</span>
          </div>
        )}
        {t.status === "reservada" && t.minha && (
          <section aria-label="Entrega">
            <h3 className="pn-rotulo-mono">Sua entrega</h3>
            <Entrega t={t} depois={depois} ir={ir} naPaleta aoLiberar={() => agir(() => liberar())} />
          </section>
        )}
        {t.status === "reservada" && !t.minha && (
          <p className="pn-ajuda flex flex-wrap items-center gap-2">
            Com {t.reservada_por || "alguém da equipe"} agora.
            {coordena && (
              <Botao variante="discreto" pequeno simbolo={Undo2} disabled={ocupado} onClick={() => void agir(() => liberar("Liberada: a tarefa voltou para a fila."))}>
                Liberar para a fila
              </Botao>
            )}
          </p>
        )}
        {(t.status === "entregue" || t.status === "aprovada") && Object.keys(t.entrega ?? {}).length > 0 && (
          <Cartao as="section" variante="plano" aria-label="O que foi entregue" className="text-sm">
            <h3 className="pn-rotulo-mono">O que foi entregue</h3>
            {Object.entries(t.entrega).map(([k, v]) => (
              <p key={k} className="mt-1 whitespace-pre-wrap break-words" data-original>
                <span className="pn-ajuda">{k}: </span>
                {v}
              </p>
            ))}
          </Cartao>
        )}
        {t.status === "concluida" && <Faixa tom="ok">Feita ✓ O verificador do acervo viu a lacuna sumir.</Faixa>}
      </div>
    </Dialogo>
  );
}

/** Tarefa avulsa da coordenação, como uma página nova: título, as propriedades e o texto. */
function NovaTarefa({ fechar, depois }: { fechar: () => void; depois: () => void }) {
  const acao = useAcao(depois);
  const [avulsa, setAvulsa] = useState({ titulo: "", descricao: "", minutos: "15", papel: "", impacto: "", alvo: "" });
  return (
    <Dialogo aberto aoMudar={(aberto) => !aberto && fechar()} titulo="Nova tarefa" largo>
      <Fechar fechar={fechar} />
      <form
        className="mt-3 grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await acao.agir("tarefa_criar", { p: { ...avulsa, minutos: Number(avulsa.minutos) } }, "Tarefa criada ✓ Ela já está em “A fazer”.")) fechar();
        }}
      >
        <p className="pn-rotulo-mono">Tarefas / Nova</p>
        <Campo rotulo="Título da tarefa" value={avulsa.titulo} onChange={(e) => setAvulsa({ ...avulsa, titulo: e.target.value })} placeholder="Sem título" maxLength={200} required autoFocus />
        <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <Selecao rotulo="Tempo" value={avulsa.minutos} onChange={(e) => setAvulsa({ ...avulsa, minutos: e.target.value })}>
            <option value="5">5 minutos</option>
            <option value="15">15 minutos</option>
            <option value="30">30 minutos</option>
          </Selecao>
          <Campo rotulo="Endereço" simbolo={Link2} value={avulsa.alvo} onChange={(e) => setAvulsa({ ...avulsa, alvo: e.target.value })} placeholder="/acervo/… (opcional)" maxLength={300} />
        </div>
        <Campo rotulo="O que muda" simbolo={Star} value={avulsa.impacto} onChange={(e) => setAvulsa({ ...avulsa, impacto: e.target.value })} placeholder="Quando ficar pronta…" maxLength={300} />
        <Area rotulo="Descrição" value={avulsa.descricao} onChange={(e) => setAvulsa({ ...avulsa, descricao: e.target.value })} placeholder="O que fazer, passo a passo." rows={8} maxLength={2000} />
        <div className="pn-dialogo-acoes">
          <Botao variante="discreto" onClick={fechar}>Cancelar</Botao>
          <Botao type="submit" variante="principal" simbolo={Plus} carregando={acao.ocupado} disabled={avulsa.titulo.trim().length < 3}>Criar a tarefa</Botao>
        </div>
        <Aviso texto={acao.aviso} />
      </form>
    </Dialogo>
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
    <div className="grid gap-3">
      <p className="pn-ajuda">Meta de resposta: até 48 horas depois da entrega. Ficha aprovada entra no acervo na próxima publicação; a tarefa conclui quando o verificador vê a lacuna sumir.</p>
      {lista.erro && <Faixa tom="erro" acao={<Botao pequeno onClick={lista.recarregar}>Tentar de novo</Botao>}>{lista.erro}</Faixa>}
      <Aviso texto={acao.aviso} />
      {!lista.dados && !lista.erro && <Esqueleto forma="cartoes" linhas={2} />}
      {lista.dados?.length === 0 && <Vazio simbolo={CircleCheck} titulo="Nada esperando revisão ✓" />}
      <ul className="grid gap-3">
        {lista.dados?.map((t) => (
          <li key={t.id}>
            <Cartao as="article" variante={(t.espera_horas ?? 0) > 48 ? "alerta" : "padrao"}>
              <p className="flex flex-wrap items-center gap-1.5">
                <Selo tom={tomDe(t.tipo)}>{infoDe(t.tipo).nome}</Selo>
                <span className="pn-ajuda">de {t.reservada_por || "alguém"}</span>
                <Selo tom={(t.espera_horas ?? 0) > 48 ? "aviso" : "neutro"}>
                  <Clock3 aria-hidden width={12} height={12} />
                  há {t.espera_horas ?? 0} h
                </Selo>
              </p>
              <p className="pn-cartao-titulo mt-1.5 flex items-center gap-2">
                {t.titulo}
                {t.alvo && (
                  <a href={`/pt${t.alvo}`} target="_blank" rel="noopener noreferrer" className="pn-elo" aria-label={`Abrir ${t.titulo}`}>
                    <ExternalLink aria-hidden width={14} height={14} />
                  </a>
                )}
              </p>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <div className="rounded-[var(--pn-raio)] border border-rule p-2 text-sm"><p className="pn-rotulo-mono">Antes</p><p className="whitespace-pre-wrap" data-original>{antes(t)}</p></div>
                <div className="rounded-[var(--pn-raio)] border border-ok p-2 text-sm"><p className="pn-rotulo-mono">Depois</p>{Object.entries(t.entrega).map(([k, v]) => <p key={k} className="whitespace-pre-wrap" data-original><span className="pn-ajuda">{k}: </span>{k === "prova" || k === "url" ? <a href={v} target="_blank" rel="noopener noreferrer nofollow" className="pn-elo">{v}</a> : v}</p>)}</div>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <Botao variante="principal" simbolo={CircleCheck} disabled={acao.ocupado} onClick={() => void acao.agir("tarefa_revisar", { p_id: t.id, p_aprovar: true, p_nota: notas[t.id] ?? "" }, "Aprovada ✓ A pessoa recebeu a frase do que mudou.")}>Aprovar</Botao>
                <div className="min-w-60 flex-1">
                  <Campo rotulo="Comentário (obrigatório para devolver)" value={notas[t.id] ?? ""} onChange={(e) => setNotas({ ...notas, [t.id]: e.target.value })} maxLength={600} />
                </div>
                <Botao simbolo={Undo2} disabled={acao.ocupado || (notas[t.id] ?? "").trim().length < 5} onClick={() => void acao.agir("tarefa_revisar", { p_id: t.id, p_aprovar: false, p_nota: notas[t.id] ?? "" }, "Devolvida com o comentário.")}>Devolver</Botao>
              </div>
            </Cartao>
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

/** A barra de progresso das metas (mutirão e meta da semana). */
function Progresso({ feitas, meta, rotulo }: { feitas: number; meta: number; rotulo: string }) {
  return (
    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-rule" role="progressbar" aria-valuemin={0} aria-valuemax={meta} aria-valuenow={feitas} aria-label={rotulo}>
      <div className="h-2.5 rounded-full bg-ok" style={{ width: `${Math.min(100, (100 * feitas) / meta)}%` }} />
    </div>
  );
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
      <section className="grid content-start gap-3">
        <CabecalhoDeSecao nivel={2} titulo="Mutirões" sobre="Um tema, uma data e uma meta coletiva. Quem entra vê a barra subir com o trabalho de todo mundo." />
        <ul className="grid gap-3">
          {mutiroes.dados?.map((x) => (
            <li key={x.id}>
              <Cartao as="article">
                <p className="font-semibold">{x.tema}</p>
                <p className="pn-ajuda">{dia(x.inicio)} a {dia(x.fim)} · {x.pessoas} {x.pessoas === 1 ? "pessoa" : "pessoas"}{x.tipo ? ` · ${infoDe(x.tipo).nome}` : ""}</p>
                {x.descricao && <p className="mt-1 text-sm">{x.descricao}</p>}
                <Progresso feitas={x.feitas} meta={x.meta} rotulo={`Progresso de ${x.tema}`} />
                <p className="mt-1 text-sm tabular-nums">{x.feitas} de {x.meta}</p>
                <p className="mt-2">
                  <Botao pequeno variante={x.inscrito ? "discreto" : "padrao"} disabled={acao.ocupado} onClick={() => void acao.agir("mutirao_inscrever", { p_id: x.id, p_entrar: !x.inscrito }, x.inscrito ? "Você saiu do mutirão." : "Você entrou no mutirão ✓")}>{x.inscrito ? "Sair do mutirão" : "Entrar no mutirão"}</Botao>
                </p>
                {x.reuniao && <p className="pn-ajuda mt-1">Tem sala marcada em Reuniões.</p>}
              </Cartao>
            </li>
          ))}
        </ul>
        {mutiroes.dados?.length === 0 && <Vazio titulo="Nenhum mutirão agora." />}
        {cria && (
          <Cartao titulo="Novo mutirão" nivelDoTitulo={3} className="grid gap-2">
            <Campo rotulo="Tema" value={m.tema} onChange={(e) => setM({ ...m, tema: e.target.value })} placeholder="Tema (ex.: 100 fichas de história)" maxLength={140} />
            <Area rotulo="Descrição" value={m.descricao} onChange={(e) => setM({ ...m, descricao: e.target.value })} placeholder="Descrição" rows={2} maxLength={1000} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Selecao rotulo="Tipo de tarefa" value={m.tipo} onChange={(e) => setM({ ...m, tipo: e.target.value })}>
                <option value="">Qualquer</option>
                {(Object.keys(TIPOS) as TipoDeLacuna[]).map((k) => <option key={k} value={k}>{TIPOS[k].nome}</option>)}
              </Selecao>
              <Campo rotulo="Meta" type="number" min={1} max={10000} value={m.meta} onChange={(e) => setM({ ...m, meta: e.target.value })} />
              <CampoData rotulo="Começa" valor={m.inicio} mudar={(v) => setM({ ...m, inicio: v })} className="text-sm" />
              <CampoData rotulo="Termina" valor={m.fim} mudar={(v) => setM({ ...m, fim: v })} className="text-sm" />
            </div>
            <p>
              <Botao variante="principal" simbolo={Plus} disabled={acao.ocupado || m.tema.trim().length < 3} onClick={async () => { if (await acao.agir("mutirao_salvar", { p: { ...m, meta: Number(m.meta) } }, "Mutirão criado ✓")) setM({ ...m, tema: "", descricao: "" }); }}>Criar o mutirão</Botao>
            </p>
          </Cartao>
        )}
      </section>
      <section className="grid content-start gap-3">
        <CabecalhoDeSecao nivel={2} titulo="Projetos" sobre="Para quem quer mais do que microtarefas: uma coleção nova, uma trilha inteira." />
        <ul className="grid gap-3">
          {projetos.dados?.map((x) => (
            <li key={x.id}>
              <Cartao as="article">
                <p className="font-semibold">{x.nome}</p>
                <p className="pn-ajuda">{x.responsavel ? `Responsável: ${x.responsavel}` : "Sem responsável ainda"}{x.prazo ? ` · até ${dia(x.prazo)}` : ""} · {x.feitas} de {x.tarefas} tarefas</p>
                {x.descricao && <p className="mt-1 text-sm">{x.descricao}</p>}
              </Cartao>
            </li>
          ))}
        </ul>
        {projetos.dados?.length === 0 && <Vazio titulo="Nenhum projeto ativo." />}
        {cria && (
          <Cartao titulo="Novo projeto" nivelDoTitulo={3} className="grid gap-2">
            <Campo rotulo="Nome do projeto" value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} placeholder="Nome" maxLength={140} />
            <Area rotulo="Descrição do projeto" value={p.descricao} onChange={(e) => setP({ ...p, descricao: e.target.value })} placeholder="O que é e o que precisa" rows={2} maxLength={1500} />
            <CampoData rotulo="Prazo (opcional)" valor={p.prazo} mudar={(v) => setP({ ...p, prazo: v })} className="text-sm" />
            <p>
              <Botao simbolo={Plus} disabled={acao.ocupado || p.nome.trim().length < 3} onClick={async () => { if (await acao.agir("projeto_salvar", { p }, "Projeto criado ✓")) setP({ nome: "", descricao: "", prazo: "" }); }}>Criar o projeto</Botao>
            </p>
          </Cartao>
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
      <Cartao titulo="Regras do verificador" sobre="O verificador roda a cada publicação. Regra desligada não abre tarefa nova (as abertas continuam).">
        <div className="mt-3 grid gap-3">
          {c && <Marca rotulo="Mostrar “Para você hoje” na Mesa da equipe" checked={c.mostrar !== false} disabled={acao.ocupado} onChange={() => void acao.agir("tarefas_configurar", { p: { mostrar: c.mostrar === false } }, "Guardado ✓")} />}
          {c && (
            <ul className="grid gap-1">
              {Object.entries(c.regras).map(([k, ligada]) => (
                <li key={k}><Marca rotulo={infoDe(k).nome} checked={ligada} disabled={acao.ocupado} onChange={() => void acao.agir("tarefas_configurar", { p: { regras: { [k]: !ligada } } }, "Guardado ✓")} /></li>
              ))}
            </ul>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <Campo rotulo="Tarefas novas por rodada" type="number" min={1} max={500} defaultValue={c?.max_por_ciclo} key={`c${c?.max_por_ciclo}`} onBlur={(e) => { if (Number(e.target.value) !== c?.max_por_ciclo) void acao.agir("tarefas_configurar", { p: { max_por_ciclo: Number(e.target.value) } }, "Guardado ✓"); }} />
            <Campo rotulo="Reservas por pessoa ao mesmo tempo" type="number" min={1} max={20} defaultValue={c?.max_reservas} key={`r${c?.max_reservas}`} onBlur={(e) => { if (Number(e.target.value) !== c?.max_reservas) void acao.agir("tarefas_configurar", { p: { max_reservas: Number(e.target.value) } }, "Guardado ✓"); }} />
          </div>
          <p className="flex flex-wrap items-center gap-3">
            <Botao simbolo={Settings2} onClick={() => void verificarAgora()}>Verificar agora</Botao>
            <span className="pn-ajuda" role="status">{verificando || (c?.ciclo ? `Última rodada: ${dataHora(c.ciclo.em)} (${c.ciclo.novas} novas)` : "")}</span>
          </p>
          <h3 className="pn-cartao-titulo mt-2">Meta da semana</h3>
          <Campo rotulo="Texto da meta" value={meta?.texto ?? c?.meta?.texto ?? ""} onChange={(e) => setMeta({ texto: e.target.value, alvo: meta?.alvo ?? String(c?.meta?.alvo ?? 50), tipo: meta?.tipo ?? c?.meta?.tipo ?? "" })} placeholder="Ex.: 50 fichas completas até domingo" maxLength={140} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Campo rotulo="Número da meta" type="number" min={1} value={meta?.alvo ?? String(c?.meta?.alvo ?? 50)} onChange={(e) => setMeta({ texto: meta?.texto ?? c?.meta?.texto ?? "", alvo: e.target.value, tipo: meta?.tipo ?? c?.meta?.tipo ?? "" })} />
            <Selecao rotulo="Tipo de tarefa da meta" value={meta?.tipo ?? c?.meta?.tipo ?? ""} onChange={(e) => setMeta({ texto: meta?.texto ?? c?.meta?.texto ?? "", alvo: meta?.alvo ?? String(c?.meta?.alvo ?? 50), tipo: e.target.value })}>
              <option value="">Qualquer tarefa</option>
              {(Object.keys(TIPOS) as TipoDeLacuna[]).map((k) => <option key={k} value={k}>{TIPOS[k].nome}</option>)}
            </Selecao>
          </div>
          <p className="flex gap-2">
            <Botao disabled={!meta || meta.texto.trim().length < 3} onClick={async () => { if (meta && (await acao.agir("tarefas_configurar", { p: { meta: { texto: meta.texto, alvo: Number(meta.alvo), tipo: meta.tipo } } }, "Meta guardada ✓"))) setMeta(null); }}>Guardar a meta</Botao>
            {c?.meta && <Botao variante="discreto" perigo onClick={() => void acao.agir("tarefas_configurar", { p: { meta: null } }, "Meta tirada.")}>Tirar a meta</Botao>}
          </p>
          <Aviso texto={acao.aviso || config.erro} />
        </div>
      </Cartao>

      <Cartao titulo="Visão geral da equipe">
        {v ? (
          <div className="grid gap-3">
            <Estatisticas>
              <Estatistica rotulo="Esperando revisão" valor={v.esperando_revisao} tom={v.esperando_revisao > 0 ? "bordo" : "neutro"} />
              <Estatistica rotulo="Tempo médio de revisão (30 d)" valor={`${v.revisao_horas ?? "—"} h`} />
            </Estatisticas>
            <div className="pn-tabela-caixa">
              <table className="pn-tabela pn-tabela-densa">
                <thead><tr><th scope="col">Tipo</th><th scope="col" className="text-right">Abertas</th><th scope="col" className="text-right">Reservadas</th><th scope="col" className="text-right">Feitas (30 d)</th></tr></thead>
                <tbody>{Object.entries(v.por_tipo).map(([k, x]) => <tr key={k}><td>{infoDe(k).nome}</td><td className="text-right tabular-nums">{x.abertas}</td><td className="text-right tabular-nums">{x.reservadas}</td><td className="text-right tabular-nums">{x.concluidas_30}</td></tr>)}</tbody>
              </table>
            </div>
            {v.falta_gente.length > 0 && <Faixa tom="aviso">Falta gente em: {v.falta_gente.map((k) => infoDe(k).nome).join(", ")}.</Faixa>}
            {v.paradas.length > 0 && (
              <div className="text-sm">
                <p className="font-semibold">Paradas há mais de cinco dias</p>
                <ul className="mt-1 grid gap-0.5">{v.paradas.map((x, i) => <li key={i}>{x.titulo} · {x.nome} · desde {data(x.desde)}</li>)}</ul>
              </div>
            )}
            <details className="text-sm"><summary className="pn-elo cursor-pointer">Por pessoa</summary><ul className="mt-1 grid gap-0.5">{v.por_pessoa.map((x, i) => <li key={i}>{x.nome}: {x.feitas_30} feitas em 30 dias, {x.reservadas} reservadas</li>)}</ul></details>
          </div>
        ) : visao.erro ? (
          <Faixa tom="erro" acao={<Botao pequeno onClick={visao.recarregar}>Tentar de novo</Botao>}>{visao.erro}</Faixa>
        ) : (
          <Esqueleto linhas={4} rotulo="Carregando…" />
        )}
      </Cartao>

      <Cartao titulo="Tarefa avulsa" sobre="Algo que o verificador não enxerga: escreva como uma página nova, e ela entra em “A fazer” para quem quiser pegar." className="lg:col-span-2">
        <p className="mt-3">
          <Botao variante="principal" simbolo={Plus} onClick={() => setCriando(true)}>Nova tarefa</Botao>
        </p>
        {criando && <NovaTarefa fechar={() => setCriando(false)} depois={() => { config.recarregar(); visao.recarregar(); }} />}
      </Cartao>
    </div>
  );
}

/** O selo da ficha de uma obra (completa, parcial ou faltando), sempre com a palavra. */
function SeloDaFicha({ completude }: { completude: Ficha["completude"] }) {
  if (completude === "completa") return <Selo tom="ok"><CircleCheck aria-hidden width={12} height={12} />completa</Selo>;
  if (completude === "parcial") return <Selo tom="ouro"><CircleDotDashed aria-hidden width={12} height={12} />parcial</Selo>;
  return <Selo tom="bordo"><CircleDashed aria-hidden width={12} height={12} />faltando</Selo>;
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
  const atalho = (Simbolo: LucideIcon, titulo: string, texto: string) => (
    <span className="flex items-start gap-3">
      <span aria-hidden className="pn-cabecalho-icone shrink-0"><Simbolo /></span>
      <span><span className="pn-cartao-titulo block">{titulo}</span><span className="pn-ajuda">{texto}</span></span>
    </span>
  );
  return (
    <div className="grid gap-6">
      <section className="grid gap-3 md:grid-cols-3">
        <Link href="/pt/painel?aba=escrever&tipo=obra" className="pn-cartao pn-cartao-interativo pn-cartao-destaque no-underline">
          {atalho(BookPlus, "Adicionar uma obra", "Abre Escrever › Obra para o acervo, já no formulário da ficha.")}
        </Link>
        <Cartao as="div" interativo onClick={() => setEstado("vazia")}>
          {atalho(Bandage, "Completar fichas", fichas ? `${conta("vazia")} com muita coisa faltando e ${conta("parcial")} parciais.` : "As fichas que precisam de cuidado.")}
        </Cartao>
        <a href="/pt/acervo" target="_blank" rel="noopener noreferrer" className="pn-cartao pn-cartao-interativo no-underline">
          {atalho(Landmark, "Ver o acervo público", "Como as obras aparecem para quem visita (abre em outra aba).")}
        </a>
      </section>

      <details className="pn-cartao">
        <summary className="pn-cartao-titulo cursor-pointer">Como pôr um livro no acervo, em quatro passos</summary>
        <ol className="mt-3 grid gap-4 md:grid-cols-2">
          <li className="border-l-4 border-oxblood pl-3"><strong>1. Ache uma fonte legítima.</strong> Domínio público (Project Gutenberg, Domínio Público, Wikisource, Arquivo Marxista), licença aberta (SciELO Livros, OpenStax, MEC Livros) ou, para obra protegida, a página da editora ou de uma biblioteca.</li>
          <li className="border-l-4 border-oxblood pl-3"><strong>2. Confira a licença.</strong> No Brasil, a obra entra em domínio público em 1º de janeiro do ano seguinte aos 70 anos da morte do autor (e a tradução tem direitos próprios). Livro protegido entra como <em>Direitos reservados</em>: só a ficha, com o link da editora ou biblioteca. Nunca PDF de fora da fonte.</li>
          <li className="border-l-4 border-oxblood pl-3"><strong>3. Preencha a ficha.</strong> Em Escrever › 📚 Obra para o acervo: título, autor, disciplina, licença, o link da página da obra (não do PDF) e uma sinopse curta, com as suas palavras.</li>
          <li className="border-l-4 border-oxblood pl-3"><strong>4. Revisão.</strong> Outra pessoa da curadoria confere a ficha e a licença; aprovada, a obra entra no site na próxima publicação, com capa se a fonte tiver uma aberta.</li>
        </ol>
        <p className="pn-ajuda mt-3">Exemplo: achou um livro infantil protegido? Ele entra como ficha “Direitos reservados”, com o link da editora ou de uma biblioteca pública, sem arquivo. Só a curadoria e a coordenação mexem no acervo.</p>
      </details>

      <section className="grid gap-3">
        <CabecalhoDeSecao nivel={2} titulo="As obras e as fichas" sobre="Cada obra do acervo com o selo da ficha. As que têm algo faltando já viram tarefa na fila (até o limite de cada rodada)." />
        {fichas && (
          <p className="flex flex-wrap gap-1.5" role="group" aria-label="Ficha">
            {(
              [
                ["", `Todas (${total})`, Circle],
                ["completa", `Completas (${conta("completa")})`, CircleCheck],
                ["parcial", `Parciais (${conta("parcial")})`, CircleDotDashed],
                ["vazia", `Faltando muito (${conta("vazia")})`, CircleDashed],
              ] as const
            ).map(([v, nomeDoFiltro, Simbolo]) => (
              <Botao key={v} pequeno simbolo={Simbolo} variante={estado === v ? "padrao" : "discreto"} aria-pressed={estado === v} onClick={() => setEstado(v)}>
                {nomeDoFiltro}
              </Botao>
            ))}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <Selecao rotulo="Disciplina" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">Todas</option>
            {areas.map((a) => <option key={a} value={a}>{nome(a)}</option>)}
          </Selecao>
          <Selecao rotulo="Ficha" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todas</option>
            <option value="completa">Completa ({conta("completa")})</option>
            <option value="parcial">Parcial ({conta("parcial")})</option>
            <option value="vazia">Faltando muito ({conta("vazia")})</option>
          </Selecao>
          <Busca rotulo="Buscar" rotuloVisivel valor={busca} aoMudar={setBusca} />
        </div>
        {erro && <Faixa tom="erro">{erro}</Faixa>}
        {fichas ? <p className="pn-rotulo-mono tabular-nums">{vistas.length} obras</p> : !erro && <Esqueleto linhas={6} rotulo="Carregando as obras…" />}
        {fichas && vistas.length > 0 && (
          <Lista rotulo="As obras e as fichas">
            {vistas.slice(0, 300).map((f) => (
              <ItemDeLista
                key={f.id}
                titulo={<a href={`/pt/acervo/${f.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{f.titulo}</a>}
                meta={
                  <>
                    {f.autor} · {nome(f.area)}
                    {f.faltam.length > 0 && <> · falta: {f.faltam.join(", ")}</>}
                  </>
                }
                selo={<SeloDaFicha completude={f.completude} />}
              />
            ))}
          </Lista>
        )}
        {vistas.length > 300 && <p className="pn-ajuda">Mostrando 300: use os filtros para ver as outras.</p>}
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
  if (!d) return dados.erro ? <Faixa tom="erro" acao={<Botao pequeno onClick={dados.recarregar}>Tentar de novo</Botao>}>{dados.erro}</Faixa> : <Esqueleto forma="cartoes" linhas={3} rotulo="Carregando…" />;
  const horas = (d.minutos / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  function comprovante() {
    const linhas = d!.tarefas.filter((x) => x.status !== "entregue").map((x) => `<tr><td>${new Date(x.quando).toLocaleDateString("pt-BR")}</td><td>${infoDe(x.tipo).nome}</td><td>${x.titulo.replace(/</g, "&lt;")}</td><td style="text-align:right">${x.minutos} min</td></tr>`).join("");
    // Sem "noopener": com ele o navegador devolve null e a janela do comprovante nunca recebia o texto.
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    // O comprovante é um documento impresso (não a interface do painel): tem as próprias cores e letras.
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comprovante de voluntariado</title><style>body{font-family:Georgia,serif;margin:40px;color:#1f1a14}h1{font-size:24px}table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-bottom:1px solid #ccc;padding:4px;text-align:left}p{font-size:14px}</style></head><body><h1>Instituto Lúcia — comprovante de voluntariado</h1><p><strong>${d!.nome.replace(/</g, "&lt;")}</strong> fez as tarefas abaixo como voluntária ou voluntário do Instituto Lúcia (a escola da classe trabalhadora, gratuita), somando cerca de <strong>${horas} horas</strong> estimadas.</p><table><thead><tr><th>Data</th><th>Tipo</th><th>Tarefa</th><th style="text-align:right">Tempo</th></tr></thead><tbody>${linhas}</tbody></table><p style="margin-top:24px;font-size:12px">Emitido pelo painel em ${new Date().toLocaleDateString("pt-BR")}. Tempo estimado pelo tamanho de cada tarefa. Para o certificado oficial de horas, veja Horas e certificados no painel.</p><script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section className="grid content-start gap-4">
        <Estatisticas>
          <Estatistica rotulo="Tarefas" valor={d.tarefas.length} />
          <Estatistica rotulo="Horas estimadas" valor={horas} tom="bordo" />
          <Estatistica rotulo="Envios publicados" valor={d.envios} />
        </Estatisticas>
        {(d.selos ?? []).length > 0 && (
          <p className="flex flex-wrap gap-1.5">
            {d.selos.map((s) => (
              <Selo key={s} tom="ouro">
                <Star aria-hidden width={12} height={12} />
                {s}
              </Selo>
            ))}
          </p>
        )}
        {d.tarefas.length === 0 ? (
          <Vazio titulo="Nenhuma tarefa ainda. Comece por “Para você hoje”, na Mesa." />
        ) : (
          <Lista rotulo="Minhas contribuições">
            {d.tarefas.map((x, i) => (
              <ItemDeLista
                key={i}
                titulo={<>{infoDe(x.tipo).nome}: <strong>{x.titulo}</strong></>}
                meta={<span className="tabular-nums">{x.quando ? data(x.quando) : ""}</span>}
                selo={<Selo tom={x.status === "entregue" ? "bordo" : x.status === "aprovada" ? "ouro" : "ok"}>{x.status === "entregue" ? "esperando revisão" : x.status === "aprovada" ? "aprovada, entra na próxima publicação" : "concluída"}</Selo>}
              />
            ))}
          </Lista>
        )}
        <div>
          <Botao disabled={d.tarefas.length === 0} onClick={comprovante}>Baixar o comprovante (PDF)</Botao>
          <p className="pn-ajuda mt-1">O comprovante abre pronto para imprimir: escolha “Salvar como PDF”. Nada sai do seu aparelho.</p>
        </div>
      </section>
      <Cartao as="section" titulo="Preferências" nivelDoTitulo={3} className="grid content-start gap-3 text-sm">
        <Marca rotulo="Pode citar o meu nome no agradecimento do mês e na “obra do mês”." checked={d.agradecimento_publico} onChange={(e) => void acao.agir("perfil_tarefas_salvar", { p: { agradecimento_publico: e.target.checked } }, "Guardado ✓")} />
        <Marca rotulo="Esconder os meus selos." checked={d.selos_ocultos} onChange={(e) => void acao.agir("perfil_tarefas_salvar", { p: { selos_ocultos: e.target.checked } }, "Guardado ✓")} />
        <Marca rotulo="Quero ser mentor: quem está começando pode me pedir ajuda." checked={d.mentoria_oferecida} onChange={(e) => void acao.agir("perfil_tarefas_salvar", { p: { mentoria_oferecida: e.target.checked } }, "Guardado ✓")} />
        <Campo rotulo="Habilidades e interesses (separados por vírgula)" value={habilidades ?? (d.habilidades ?? []).join(", ")} onChange={(e) => setHabilidades(e.target.value)} placeholder="história, revisão, inglês, design…" />
        <p>
          <Botao disabled={habilidades === null} onClick={async () => { if (await acao.agir("perfil_tarefas_salvar", { p: { habilidades: (habilidades ?? "").split(",").map((x) => x.trim()).filter(Boolean) } }, "Guardado ✓")) setHabilidades(null); }}>Guardar</Botao>
        </p>
        <p className="pn-ajuda">As habilidades ajudam o “Para você hoje” a escolher tarefas que combinam com você. Não há ranking de quem fez mais.</p>
        <Aviso texto={acao.aviso} />
      </Cartao>
    </div>
  );
}
