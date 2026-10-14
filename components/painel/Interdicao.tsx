// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { can, type Me } from "@/lib/backend";
import { areasDeExpurgo, areasPublicas } from "@/lib/interdicao";
import { Abas, Aviso, botao, botaoClaro, campo, dataHora, rotulo, useAcao, useLista } from "./comum";

interface Estado {
  geral: boolean;
  areas: string[];
  motivo: string;
  mensagem: string;
  desde: string | null;
  por: string;
  pode_aplicar: boolean;
  historico: { acao: string; nome: string; detalhes: Record<string, unknown>; criado_em: string }[];
}

interface Pedido {
  id: string;
  tipo: "interdicao" | "liberacao" | "expurgo";
  dados: { geral?: boolean; areas?: string[]; mensagem?: string; periodo?: string; poupar_equipe?: boolean; pausar?: boolean };
  justificativa: string;
  situacao: "pendente" | "aprovado" | "recusado" | "vencido";
  nota: string;
  resultado: Record<string, unknown> | null;
  autor: string;
  meu: boolean;
  decidido_por: string;
  decidido_em: string | null;
  criado_em: string;
  vence_em: string;
}

const nomeDaArea = (id: string) => areasPublicas.find((area) => area.id === id)?.nome ?? areasDeExpurgo.find((area) => area.id === id)?.nome ?? id;
const periodos: [string, string][] = [["1h", "a última hora"], ["6h", "as últimas 6 horas"], ["24h", "as últimas 24 horas"], ["7d", "os últimos 7 dias"], ["tudo", "tudo, desde o começo"]];
const nomeDoPeriodo = (id?: string) => periodos.find(([valor]) => valor === id)?.[1] ?? id ?? "";
const nomesDosApagados: Record<string, string> = { topicos: "conversas", respostas: "respostas", votos: "votos", mural: "anúncios do mural", anotacoes: "anotações", reforco: "pedidos de reforço", contribuicoes: "contribuições na triagem", gaveta: "trabalhos da Gaveta" };
const contas = (r: Record<string, unknown> | null) =>
  Object.entries(r ?? {})
    .filter(([, valor]) => typeof valor === "number")
    .map(([chave, valor]) => `${valor} ${nomesDosApagados[chave] ?? chave}`)
    .join(" · ");
const tipos: Record<Pedido["tipo"], string> = { interdicao: "Interdição", liberacao: "Liberação", expurgo: "Expurgo" };
const situacoesDoPedido: Record<Pedido["situacao"], string> = { pendente: "esperando a coordenação", aprovado: "aprovado", recusado: "recusado", vencido: "venceu sem decisão" };

function resumoDaInterdicao(geral: boolean, areas: string[]) {
  if (geral) return "O site inteiro fora do ar (só a entrada e o painel funcionam)";
  if (areas.length) return `Fechadas: ${areas.map(nomeDaArea).join(", ")}`;
  return "Site aberto, sem interdição";
}

/** O estado atual, em destaque, e o formulário: a coordenação aplica, a supervisão pede. */
function Interditar({ estado, coordena, recarregar }: { estado: Estado; coordena: boolean; recarregar: () => void }) {
  const [geral, setGeral] = useState(estado.geral);
  const [areas, setAreas] = useState<string[]>(estado.areas);
  const [mensagem, setMensagem] = useState(estado.mensagem);
  const [motivo, setMotivo] = useState("");
  const acao = useAcao(() => {
    setMotivo("");
    recarregar();
  });
  const fechado = estado.geral || estado.areas.length > 0;
  const mudou = geral !== estado.geral || mensagem !== estado.mensagem || [...areas].sort().join() !== [...estado.areas].sort().join();
  const marcar = (id: string) => setAreas(areas.includes(id) ? areas.filter((area) => area !== id) : [...areas, id]);
  const vermelho = "cursor-pointer bg-oxblood px-5 py-2.5 font-medium text-parchment disabled:cursor-not-allowed disabled:opacity-50";

  async function aplicar(reabrir: boolean) {
    const dados = reabrir ? { geral: false, areas: [], mensagem: "" } : { geral, areas, mensagem: mensagem.trim() };
    if (coordena) {
      if (!reabrir && dados.geral && !window.confirm("Tirar o site inteiro do ar agora? Só a entrada e o painel vão continuar funcionando.")) return;
      if (await acao.agir("interdicao_definir", { p: { ...dados, motivo: motivo.trim() } }, reabrir ? "Site reaberto." : "Interdição aplicada.")) {
        if (reabrir) {
          setGeral(false);
          setAreas([]);
          setMensagem("");
        }
      }
    } else {
      await acao.agir("pedido_criar", { p_tipo: reabrir ? "liberacao" : "interdicao", p_dados: dados, p_justificativa: motivo.trim() }, "Pedido enviado. Ele só vale depois que a coordenação ou a vice-coordenação aprovar.");
    }
  }

  return (
    <div className="space-y-6">
      <section className={fechado ? "border-2 border-oxblood bg-parchment-deep p-5" : "border border-rule bg-parchment-deep p-5"}>
        <p className={rotulo}>Agora</p>
        <p className={`mt-1 font-serif text-2xl font-semibold ${fechado ? "text-oxblood" : ""}`}>{resumoDaInterdicao(estado.geral, estado.areas)}</p>
        {fechado && (
          <p className="mt-1 text-ink-soft">
            Desde {estado.desde ? dataHora(estado.desde) : "?"}{estado.por && `, por ${estado.por}`}. Motivo: {estado.motivo || "não informado"}.
            {estado.mensagem && <> Recado para o público: “{estado.mensagem}”.</>}
          </p>
        )}
        {fechado && (
          <div className="mt-3">
            <label className="block max-w-xl">
              {coordena ? "Motivo para reabrir (vai para o registro)" : "Por que reabrir agora (pelo menos 30 letras)"}
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={coordena ? 300 : 1000} className={campo} />
            </label>
            <button type="button" className={`mt-2 ${botao}`} disabled={acao.ocupado || motivo.trim().length < (coordena ? 5 : 30)} onClick={() => void aplicar(true)}>
              {coordena ? "Reabrir tudo agora" : "Pedir a reabertura"}
            </button>
          </div>
        )}
      </section>

      <section className="border border-rule bg-parchment-deep p-5">
        <h2 className="font-serif text-xl font-semibold">{coordena ? "Interditar" : "Pedir uma interdição"}</h2>
        <p className="mt-1 max-w-3xl text-ink-soft">
          O que fica fechado mostra só uma página simples dizendo que aquela parte está fora do ar por um tempo, com o recado que você escrever. Nada é apagado. As funções do banco daquela área recusam o público,
          mas quem cuida dela continua lendo e limpando pelo painel. A mudança chega a todos em até meio minuto.
          {!coordena && " O pedido só vale depois que a coordenação ou a vice-coordenação aprovar; parado, vence em 72 horas."}
        </p>
        <label className="mt-4 flex items-start gap-2 font-semibold">
          <input type="checkbox" checked={geral} onChange={(e) => setGeral(e.target.checked)} className="mt-1 h-4 w-4" />
          O site inteiro fora do ar (só a entrada e o painel continuam funcionando)
        </label>
        <fieldset className="mt-4" disabled={geral}>
          <legend className={rotulo}>Ou só algumas áreas</legend>
          <div className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {areasPublicas.map((area) => (
              <label key={area.id} className={`flex items-start gap-2 ${geral ? "opacity-50" : ""}`}>
                <input type="checkbox" checked={areas.includes(area.id)} onChange={() => marcar(area.id)} className="mt-1 h-4 w-4" />
                <span>
                  {area.nome} <span className="font-mono text-xs text-ink-soft">{area.caminhos.join(" ")}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="mt-4 block">
          Recado para o público (opcional, aparece na página fechada)
          <input value={mensagem} onChange={(e) => setMensagem(e.target.value)} maxLength={300} placeholder="Ex.: Estamos em manutenção. Voltamos ainda hoje." className={campo} />
        </label>
        <label className="mt-3 block">
          {coordena ? "Motivo (vai para o registro e para o aviso à liderança)" : "Justificativa (pelo menos 30 letras: o que está acontecendo e por que não dá para esperar)"}
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} maxLength={coordena ? 300 : 1000} className={campo} />
        </label>
        <button type="button" className={`mt-3 ${vermelho}`} disabled={acao.ocupado || !mudou || (!geral && areas.length === 0 && !fechado) || motivo.trim().length < (coordena ? 5 : 30)} onClick={() => void aplicar(false)}>
          {coordena ? "Aplicar agora" : "Enviar o pedido"}
        </button>
        <Aviso texto={acao.aviso} />
      </section>
    </div>
  );
}

/** O botão de expurgo: primeiro mostra quanto vai sumir; a coordenação confirma digitando EXPURGAR, a supervisão pede. */
function Expurgo({ coordena }: { coordena: boolean }) {
  const [areas, setAreas] = useState<string[]>(["comunidade"]);
  const [periodo, setPeriodo] = useState("24h");
  const [poupar, setPoupar] = useState(true);
  const [pausar, setPausar] = useState(false);
  const [previa, setPrevia] = useState<Record<string, unknown> | null>(null);
  const [confirmacao, setConfirmacao] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [feito, setFeito] = useState<Record<string, unknown> | null>(null);
  const acao = useAcao();
  const dados = { areas, periodo, poupar_equipe: poupar, pausar };
  const mudar = (fazer: () => void) => {
    fazer();
    setPrevia(null);
    setFeito(null);
  };

  async function verPrevia() {
    const r = await acao.agir("expurgo_previa", { p: dados }, "");
    if (r) setPrevia(r as Record<string, unknown>);
  }

  async function aplicar() {
    if (coordena) {
      const r = await acao.agir("expurgo_aplicar", { p: { ...dados, confirmacao } }, "Expurgo feito.");
      if (r) {
        setFeito(r as Record<string, unknown>);
        setPrevia(null);
        setConfirmacao("");
      }
    } else if (await acao.agir("pedido_criar", { p_tipo: "expurgo", p_dados: dados, p_justificativa: justificativa.trim() }, "Pedido de expurgo enviado. Ele só vale depois que a coordenação ou a vice-coordenação aprovar.")) {
      setJustificativa("");
      setPrevia(null);
    }
  }

  return (
    <section className="border border-rule bg-parchment-deep p-5">
      <h2 className="font-serif text-xl font-semibold">{coordena ? "Expurgo das áreas abertas" : "Pedir um expurgo"}</h2>
      <p className="mt-1 max-w-3xl text-ink-soft">
        Para uma chuva de spam que a mediação não dá conta: apaga de uma vez o que o público escreveu nas áreas escolhidas, no período escolhido. Não tem volta. O que a equipe escreveu fica, a menos que você desmarque a
        opção. Fica no registro de atividades, e a liderança é avisada.
      </p>
      <fieldset className="mt-4">
        <legend className={rotulo}>Onde</legend>
        <div className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {areasDeExpurgo.map((area) => (
            <label key={area.id} className="flex items-start gap-2">
              <input type="checkbox" checked={areas.includes(area.id)} onChange={() => mudar(() => setAreas(areas.includes(area.id) ? areas.filter((a) => a !== area.id) : [...areas, area.id]))} className="mt-1 h-4 w-4" />
              {area.nome}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          De quando
          <select value={periodo} onChange={(e) => mudar(() => setPeriodo(e.target.value))} className={campo}>
            {periodos.map(([valor, nome]) => (
              <option key={valor} value={valor}>{nome}</option>
            ))}
          </select>
        </label>
        <div className="space-y-2 pt-6">
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={poupar} onChange={(e) => mudar(() => setPoupar(e.target.checked))} className="mt-1 h-4 w-4" />
            Poupar o que foi escrito por gente da equipe
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={pausar} onChange={(e) => mudar(() => setPausar(e.target.checked))} className="mt-1 h-4 w-4" />
            Pausar os envios do público junto
          </label>
        </div>
      </div>
      <button type="button" className={`mt-4 ${botaoClaro}`} disabled={acao.ocupado || areas.length === 0} onClick={() => void verPrevia()}>
        Ver quanto seria apagado
      </button>
      {previa && (
        <div className="mt-4 border-2 border-oxblood bg-parchment p-4">
          <p className="font-semibold">Seria apagado ({nomeDoPeriodo(periodo)}): {contas(previa) || "nada"}.</p>
          {coordena ? (
            <>
              <label className="mt-3 block max-w-sm">
                Para confirmar, digite EXPURGAR
                <input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="off" className={`${campo} font-mono`} />
              </label>
              <button type="button" className="mt-3 cursor-pointer bg-oxblood px-5 py-2.5 font-medium text-parchment disabled:cursor-not-allowed disabled:opacity-50" disabled={acao.ocupado || confirmacao !== "EXPURGAR"} onClick={() => void aplicar()}>
                Apagar agora
              </button>
            </>
          ) : (
            <>
              <label className="mt-3 block">
                Justificativa (pelo menos 30 letras)
                <textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={2} maxLength={1000} className={campo} />
              </label>
              <button type="button" className={`mt-3 ${botao}`} disabled={acao.ocupado || justificativa.trim().length < 30} onClick={() => void aplicar()}>
                Pedir o expurgo
              </button>
            </>
          )}
        </div>
      )}
      {feito && <p role="status" className="mt-3 font-semibold">Apagado: {contas(feito) || "nada"}.</p>}
      <Aviso texto={acao.aviso} />
    </section>
  );
}

/** A fila de pedidos da supervisão. Coordenação e vice decidem; a supervisão acompanha os próprios e os decididos. */
function Pedidos({ coordena, depois }: { coordena: boolean; depois: () => void }) {
  const lista = useLista<Pedido[]>("pedidos_listar");
  const [notas, setNotas] = useState<Record<string, string>>({});
  const acao = useAcao(() => {
    lista.recarregar();
    depois();
  });
  const descrever = (pedido: Pedido) =>
    pedido.tipo === "liberacao"
      ? "Reabrir o site inteiro"
      : pedido.tipo === "interdicao"
        ? `${resumoDaInterdicao(Boolean(pedido.dados.geral), pedido.dados.areas ?? [])}${pedido.dados.mensagem ? ` · recado: “${pedido.dados.mensagem}”` : ""}`
        : `Apagar ${nomeDoPeriodo(pedido.dados.periodo)} em: ${(pedido.dados.areas ?? []).map(nomeDaArea).join(", ")}${pedido.dados.poupar_equipe === false ? " · sem poupar a equipe" : ""}${pedido.dados.pausar ? " · e pausar os envios" : ""}`;
  return (
    <div>
      <Aviso texto={lista.erro || acao.aviso} />
      {lista.dados?.length === 0 && <p className="text-ink-soft">Nenhum pedido.</p>}
      <ul className="space-y-3">
        {lista.dados?.map((pedido) => (
          <li key={pedido.id} className={`border bg-parchment-deep p-4 ${pedido.situacao === "pendente" ? "border-2 border-oxblood" : "border-rule"}`}>
            <p className={rotulo}>
              {tipos[pedido.tipo]} · {situacoesDoPedido[pedido.situacao]} · pedido por {pedido.autor || "alguém que saiu da equipe"} em {dataHora(pedido.criado_em)}
              {pedido.situacao === "pendente" && ` · vence em ${dataHora(pedido.vence_em)}`}
            </p>
            <p className="mt-1 font-semibold">{descrever(pedido)}</p>
            <p className="mt-1 whitespace-pre-line">{pedido.justificativa}</p>
            {pedido.situacao !== "pendente" && pedido.decidido_por && (
              <p className="mt-1 text-ink-soft">
                Decidido por {pedido.decidido_por}{pedido.decidido_em && ` em ${dataHora(pedido.decidido_em)}`}{pedido.nota && `: ${pedido.nota}`}
                {pedido.tipo === "expurgo" && pedido.resultado && ` · apagado: ${contas(pedido.resultado) || "nada"}`}
              </p>
            )}
            {coordena && pedido.situacao === "pendente" && (
              <div className="mt-3">
                <label className="block max-w-xl">
                  Nota para quem pediu (opcional)
                  <input value={notas[pedido.id] ?? ""} onChange={(e) => setNotas({ ...notas, [pedido.id]: e.target.value })} maxLength={500} className={campo} />
                </label>
                <p className="mt-2 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="cursor-pointer bg-oxblood px-5 py-2.5 font-medium text-parchment disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={acao.ocupado}
                    onClick={() => { if (window.confirm(`Aprovar e aplicar agora: ${descrever(pedido)}?`)) void acao.agir("pedido_decidir", { p_id: pedido.id, p_aprovar: true, p_nota: notas[pedido.id] ?? "" }, "Pedido aprovado e aplicado."); }}
                  >
                    Aprovar e aplicar
                  </button>
                  <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => acao.agir("pedido_decidir", { p_id: pedido.id, p_aprovar: false, p_nota: notas[pedido.id] ?? "" }, "Pedido recusado.")}>
                    Recusar
                  </button>
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const nomesDoHistorico: Record<string, string> = { interdicao: "mudou a interdição", expurgo: "fez um expurgo", pedido_supervisao_criado: "fez um pedido", pedido_supervisao_aprovado: "aprovou um pedido", pedido_supervisao_recusado: "recusou um pedido" };

/**
 * Interdição e expurgo: tirar o site (ou uma área) do ar por um tempo e apagar de uma vez uma chuva de spam. A
 * coordenação e a vice aplicam; a supervisão pede, e o pedido só vale depois da aprovação de uma das duas.
 */
export function Interdicao({ me, aoMudar }: { me: Me; /** O aviso do alto do painel se refaz quando a interdição muda. */ aoMudar?: () => void }) {
  const coordena = can(me, "coordenacao");
  const estado = useLista<Estado>("interdicao_ver");
  const pedidos = useLista<Pedido[]>("pedidos_listar");
  const [aba, setAba] = useState<"interdicao" | "expurgo" | "pedidos" | "historico">("interdicao");
  const pendentes = pedidos.dados?.filter((pedido) => pedido.situacao === "pendente").length ?? 0;
  if (!estado.dados) return <Aviso texto={estado.erro ? `${estado.erro} Se esta seção nunca abriu, falta rodar de novo o supabase/install.sql no banco.` : "Carregando…"} />;
  return (
    <div>
      <Abas
        atual={aba}
        escolher={setAba}
        opcoes={[
          { id: "interdicao" as const, nome: "Interdição" },
          { id: "expurgo" as const, nome: "Expurgo" },
          { id: "pedidos" as const, nome: "Pedidos da supervisão", conta: pendentes },
          { id: "historico" as const, nome: "Histórico" },
        ]}
      />
      {aba === "interdicao" && <Interditar key={JSON.stringify([estado.dados.geral, estado.dados.areas, estado.dados.mensagem])} estado={estado.dados} coordena={coordena} recarregar={() => { estado.recarregar(); pedidos.recarregar(); aoMudar?.(); }} />}
      {aba === "expurgo" && <Expurgo coordena={coordena} />}
      {aba === "pedidos" && <Pedidos coordena={coordena} depois={() => { estado.recarregar(); pedidos.recarregar(); aoMudar?.(); }} />}
      {aba === "historico" && (
        <ul className="divide-y divide-rule border-y border-rule">
          {estado.dados.historico.map((item, i) => (
            <li key={`${item.criado_em}-${i}`} className="py-2">
              <span className={rotulo}>{dataHora(item.criado_em)}</span>
              <p>
                <strong>{item.nome || "Alguém"}</strong> {nomesDoHistorico[item.acao] ?? item.acao}
                {item.acao === "interdicao" && <span className="text-ink-soft"> · {resumoDaInterdicao(item.detalhes.geral === true, (item.detalhes.areas as string[] | undefined) ?? [])}</span>}
                {item.acao === "expurgo" && <span className="text-ink-soft"> · {contas(item.detalhes.apagados as Record<string, unknown>) || "nada"}</span>}
                {typeof item.detalhes.justificativa === "string" && item.detalhes.justificativa && <span className="text-ink-soft"> · {item.detalhes.justificativa}</span>}
              </p>
            </li>
          ))}
          {estado.dados.historico.length === 0 && <li className="py-3 text-ink-soft">Nada registrado ainda.</li>}
        </ul>
      )}
    </div>
  );
}
