// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Ban, History, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { can, type Me } from "@/lib/backend";
import { areasDeExpurgo, areasPublicas } from "@/lib/interdicao";
import { dataHora, useAcao, useLista } from "./comum";
import { MoldeConfiguracao } from "./moldes";
import { Abas, Area, Botao, Campo, Cartao, confirmarFrase, Esqueleto, Faixa, ItemDeLista, Lista, Marca, Selecao, Selo, type TomDoSelo, Vazio } from "./ui";

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
const periodos: [string, string][] = [
  ["1h", "a última hora"],
  ["6h", "as últimas 6 horas"],
  ["24h", "as últimas 24 horas"],
  ["7d", "os últimos 7 dias"],
  ["tudo", "tudo, desde o começo"],
];
const nomeDoPeriodo = (id?: string) => periodos.find(([valor]) => valor === id)?.[1] ?? id ?? "";
const nomesDosApagados: Record<string, string> = { topicos: "conversas", respostas: "respostas", votos: "votos", mural: "anúncios do mural", anotacoes: "anotações", reforco: "pedidos de reforço", contribuicoes: "contribuições na triagem", gaveta: "trabalhos da Gaveta" };
const contas = (r: Record<string, unknown> | null) =>
  Object.entries(r ?? {})
    .filter(([, valor]) => typeof valor === "number")
    .map(([chave, valor]) => `${valor} ${nomesDosApagados[chave] ?? chave}`)
    .join(" · ");
const tipos: Record<Pedido["tipo"], string> = { interdicao: "Interdição", liberacao: "Liberação", expurgo: "Expurgo" };
const situacoesDoPedido: Record<Pedido["situacao"], string> = { pendente: "esperando a coordenação", aprovado: "aprovado", recusado: "recusado", vencido: "venceu sem decisão" };
const tomDoPedido: Record<Pedido["situacao"], TomDoSelo> = { pendente: "bordo", aprovado: "ok", recusado: "erro", vencido: "neutro" };

function resumoDaInterdicao(geral: boolean, areas: string[]) {
  if (geral) return "O site inteiro fora do ar (só a entrada e o painel funcionam)";
  if (areas.length) return `Fechadas: ${areas.map(nomeDaArea).join(", ")}`;
  return "Site aberto, sem interdição";
}

/** O recado de uma ação (sucesso ou erro do banco), numa faixa que o leitor de tela anuncia com calma. */
const Recado = ({ texto }: { texto: string }) => <div aria-live="polite">{texto && <Faixa tom="info">{texto}</Faixa>}</div>;

/**
 * O estado atual, em destaque (faixa do que está no ar), e o formulário no molde Configuração: a coordenação aplica, a
 * supervisão pede. "Descartar" volta o formulário ao que está valendo.
 */
function Interditar({ estado, coordena, recarregar }: { estado: Estado; coordena: boolean; recarregar: () => void }) {
  const [geral, setGeral] = useState(estado.geral);
  const [areas, setAreas] = useState<string[]>(estado.areas);
  const [mensagem, setMensagem] = useState(estado.mensagem);
  const [motivo, setMotivo] = useState("");
  const campoDoMotivo = useRef<HTMLTextAreaElement>(null);
  const acao = useAcao(() => {
    setMotivo("");
    recarregar();
  });
  const fechado = estado.geral || estado.areas.length > 0;
  const mudou = geral !== estado.geral || mensagem !== estado.mensagem || [...areas].sort().join() !== [...estado.areas].sort().join();
  const marcar = (id: string) => setAreas(areas.includes(id) ? areas.filter((area) => area !== id) : [...areas, id]);
  const motivoBasta = motivo.trim().length >= (coordena ? 5 : 30);
  // Depois de uma tentativa sem motivo, o campo diz o que falta (antes o botão só ficava apagado, sem explicar).
  const [tentou, setTentou] = useState(false);

  async function aplicar(reabrir: boolean) {
    const dados = reabrir ? { geral: false, areas: [], mensagem: "" } : { geral, areas, mensagem: mensagem.trim() };
    if (coordena) {
      if (!reabrir && dados.geral && !(await confirmarFrase("Tirar o site inteiro do ar agora? Só a entrada e o painel vão continuar funcionando."))) return;
      if (await acao.agir("interdicao_definir", { p: { ...dados, motivo: motivo.trim() } }, reabrir ? "Site reaberto." : "Interdição aplicada.")) {
        if (reabrir) {
          setGeral(false);
          setAreas([]);
          setMensagem("");
        }
      }
    } else {
      await acao.agir("pedido_criar", { p_tipo: reabrir ? "liberacao" : "interdicao", p_dados: dados, p_justificativa: motivo.trim() }, "Pedido enviado. Ele só vale depois que a coordenação ou a coordenação pedagógica aprovar.");
    }
  }

  return (
    <div className="pn-tela">
      <Faixa tom={fechado ? "aviso" : "ok"} titulo={resumoDaInterdicao(estado.geral, estado.areas)}>
        <span className="pn-rotulo-mono">Agora</span>
        {fechado && (
          <p>
            Desde {estado.desde ? dataHora(estado.desde) : "?"}
            {estado.por && `, por ${estado.por}`}. Motivo: {estado.motivo || "não informado"}.{estado.mensagem && <> Recado para o público: “{estado.mensagem}”.</>}
          </p>
        )}
      </Faixa>
      {fechado && (
        <Cartao variante="alerta">
          <div className="pn-secao" style={{ maxWidth: "36rem" }}>
            <Campo rotulo={coordena ? "Motivo para reabrir (vai para o registro)" : "Por que reabrir agora (pelo menos 30 letras)"} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={coordena ? 300 : 1000} />
            <div>
              <Botao disabled={acao.ocupado || !motivoBasta} onClick={() => void aplicar(true)}>
                {coordena ? "Reabrir tudo agora" : "Pedir a reabertura"}
              </Botao>
            </div>
          </div>
        </Cartao>
      )}

      <MoldeConfiguracao
        sujo={mudou && (geral || areas.length > 0 || fechado)}
        salvando={acao.ocupado}
        rotuloSalvar={coordena ? "Aplicar agora" : "Enviar o pedido"}
        aoDescartar={() => {
          setGeral(estado.geral);
          setAreas(estado.areas);
          setMensagem(estado.mensagem);
        }}
        aoSalvar={() => {
          // O motivo é obrigatório (5 letras para a coordenação, 30 para o pedido): sem ele, o foco vai para o campo.
          setTentou(!motivoBasta);
          if (!motivoBasta) campoDoMotivo.current?.focus();
          else void aplicar(false);
        }}
        grupos={[
          {
            id: "o-que",
            titulo: coordena ? "Interditar" : "Pedir uma interdição",
            sobre: `O que fica fechado mostra só uma página simples dizendo que aquela parte está fora do ar por um tempo, com o recado que você escrever. Nada é apagado. As funções do banco daquela área recusam o público, mas quem cuida dela continua lendo e limpando pelo painel. A mudança chega a todos em até meio minuto.${!coordena ? " O pedido só vale depois que a coordenação ou a coordenação pedagógica aprovar; parado, vence em 72 horas." : ""}`,
            campos: (
              <>
                <Marca rotulo="O site inteiro fora do ar (só a entrada e o painel continuam funcionando)" checked={geral} onChange={(e) => setGeral(e.target.checked)} />
                <fieldset disabled={geral}>
                  <legend className="pn-rotulo-mono">Ou só algumas áreas</legend>
                  <div className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {areasPublicas.map((area) => (
                      <label key={area.id} className={`pn-marca items-start ${geral ? "opacity-50" : ""}`}>
                        <input type="checkbox" checked={areas.includes(area.id)} onChange={() => marcar(area.id)} className="mt-1" />
                        <span>
                          {area.nome} <span className="font-mono text-xs text-ink-soft">{area.caminhos.join(" ")}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            ),
          },
          {
            id: "recado",
            titulo: "Recado e motivo",
            campos: (
              <>
                <Campo rotulo="Recado para o público (opcional, aparece na página fechada)" value={mensagem} onChange={(e) => setMensagem(e.target.value)} maxLength={300} placeholder="Ex.: Estamos em manutenção. Voltamos ainda hoje." />
                <Area ref={campoDoMotivo} rotulo={coordena ? "Motivo (vai para o registro e para o aviso à liderança)" : "Justificativa (pelo menos 30 letras: o que está acontecendo e por que não dá para esperar)"} value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} maxLength={coordena ? 300 : 1000} erro={tentou && !motivoBasta ? (coordena ? "Escreva o motivo (pelo menos 5 letras)." : "Escreva a justificativa (pelo menos 30 letras).") : undefined} />
                <Recado texto={acao.aviso} />
              </>
            ),
          },
        ]}
      />
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
    } else if (await acao.agir("pedido_criar", { p_tipo: "expurgo", p_dados: dados, p_justificativa: justificativa.trim() }, "Pedido de expurgo enviado. Ele só vale depois que a coordenação ou a coordenação pedagógica aprovar.")) {
      setJustificativa("");
      setPrevia(null);
    }
  }

  return (
    <Cartao
      titulo={coordena ? "Expurgo das áreas abertas" : "Pedir um expurgo"}
      sobre="Para uma chuva de spam que a mediação não dá conta: apaga de uma vez o que o público escreveu nas áreas escolhidas, no período escolhido. Não tem volta. O que a equipe escreveu fica, a menos que você desmarque a opção. Fica no registro de atividades, e a liderança é avisada."
    >
      <div className="pn-secao">
        <fieldset>
          <legend className="pn-rotulo-mono">Onde</legend>
          <div className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {areasDeExpurgo.map((area) => (
              <Marca key={area.id} rotulo={area.nome} checked={areas.includes(area.id)} onChange={() => mudar(() => setAreas(areas.includes(area.id) ? areas.filter((a) => a !== area.id) : [...areas, area.id]))} />
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <Selecao rotulo="De quando" value={periodo} onChange={(e) => mudar(() => setPeriodo(e.target.value))}>
            {periodos.map(([valor, nome]) => (
              <option key={valor} value={valor}>
                {nome}
              </option>
            ))}
          </Selecao>
          <div className="space-y-2 sm:pt-6">
            <Marca rotulo="Poupar o que foi escrito por gente da equipe" checked={poupar} onChange={(e) => mudar(() => setPoupar(e.target.checked))} />
            <Marca rotulo="Pausar os envios do público junto" checked={pausar} onChange={(e) => mudar(() => setPausar(e.target.checked))} />
          </div>
        </div>
        <div>
          <Botao disabled={acao.ocupado || areas.length === 0} onClick={() => void verPrevia()}>
            Ver quanto seria apagado
          </Botao>
        </div>
        {previa && (
          <Cartao variante="alerta" as="div">
            <div className="pn-secao">
              <p className="font-semibold">
                Seria apagado ({nomeDoPeriodo(periodo)}): {contas(previa) || "nada"}.
              </p>
              {coordena ? (
                <>
                  <div style={{ maxWidth: "24rem" }}>
                    <Campo rotulo="Para confirmar, digite EXPURGAR" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="off" className="font-mono" />
                  </div>
                  <div>
                    <Botao variante="principal" simbolo={Trash2} disabled={acao.ocupado || confirmacao !== "EXPURGAR"} onClick={() => void aplicar()}>
                      Apagar agora
                    </Botao>
                  </div>
                </>
              ) : (
                <>
                  <Area rotulo="Justificativa (pelo menos 30 letras)" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={2} maxLength={1000} />
                  <div>
                    <Botao variante="principal" disabled={acao.ocupado || justificativa.trim().length < 30} onClick={() => void aplicar()}>
                      Pedir o expurgo
                    </Botao>
                  </div>
                </>
              )}
            </div>
          </Cartao>
        )}
        {feito && <Faixa tom="ok">Apagado: {contas(feito) || "nada"}.</Faixa>}
        <Recado texto={acao.aviso} />
      </div>
    </Cartao>
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
    <div className="pn-tela">
      {lista.erro && (
        <Faixa
          tom="erro"
          acao={
            <Botao pequeno onClick={lista.recarregar}>
              Tentar de novo
            </Botao>
          }
        >
          {lista.erro}
        </Faixa>
      )}
      <Recado texto={acao.aviso} />
      {lista.dados === null && !lista.erro && <Esqueleto forma="cartoes" linhas={2} />}
      {lista.dados?.length === 0 && <Vazio titulo="Nenhum pedido." />}
      {lista.dados?.map((pedido) => (
        <Cartao key={pedido.id} as="article" variante={pedido.situacao === "pendente" ? "alerta" : "padrao"}>
          <div className="pn-secao">
            <p className="flex flex-wrap items-center gap-2">
              <Selo tom={tomDoPedido[pedido.situacao]} ponto={pedido.situacao === "pendente"}>
                {tipos[pedido.tipo]} · {situacoesDoPedido[pedido.situacao]}
              </Selo>
              <span className="pn-rotulo-mono">
                pedido por {pedido.autor || "alguém que saiu da equipe"} em {dataHora(pedido.criado_em)}
                {pedido.situacao === "pendente" && ` · vence em ${dataHora(pedido.vence_em)}`}
              </span>
            </p>
            <p className="font-semibold">{descrever(pedido)}</p>
            <p className="whitespace-pre-line" data-original>
              {pedido.justificativa}
            </p>
            {pedido.situacao !== "pendente" && pedido.decidido_por && (
              <p className="text-ink-soft">
                Decidido por {pedido.decidido_por}
                {pedido.decidido_em && ` em ${dataHora(pedido.decidido_em)}`}
                {pedido.nota && `: ${pedido.nota}`}
                {pedido.tipo === "expurgo" && pedido.resultado && ` · apagado: ${contas(pedido.resultado) || "nada"}`}
              </p>
            )}
            {coordena && pedido.situacao === "pendente" && (
              <div className="pn-secao" style={{ maxWidth: "36rem" }}>
                <Campo rotulo="Nota para quem pediu (opcional)" value={notas[pedido.id] ?? ""} onChange={(e) => setNotas({ ...notas, [pedido.id]: e.target.value })} maxLength={500} />
                <p className="flex flex-wrap gap-2">
                  <Botao
                    variante="principal"
                    disabled={acao.ocupado}
                    onClick={async () => {
                      if (await confirmarFrase(`Aprovar e aplicar agora: ${descrever(pedido)}?`)) void acao.agir("pedido_decidir", { p_id: pedido.id, p_aprovar: true, p_nota: notas[pedido.id] ?? "" }, "Pedido aprovado e aplicado.");
                    }}
                  >
                    Aprovar e aplicar
                  </Botao>
                  <Botao disabled={acao.ocupado} onClick={() => acao.agir("pedido_decidir", { p_id: pedido.id, p_aprovar: false, p_nota: notas[pedido.id] ?? "" }, "Pedido recusado.")}>
                    Recusar
                  </Botao>
                </p>
              </div>
            )}
          </div>
        </Cartao>
      ))}
    </div>
  );
}

const nomesDoHistorico: Record<string, string> = { interdicao: "mudou a interdição", expurgo: "fez um expurgo", pedido_supervisao_criado: "fez um pedido", pedido_supervisao_aprovado: "aprovou um pedido", pedido_supervisao_recusado: "recusou um pedido" };

type AbaDaInterdicao = "interdicao" | "expurgo" | "pedidos" | "historico";

/**
 * Interdição e expurgo: tirar o site (ou uma área) do ar por um tempo e apagar de uma vez uma chuva de spam. A
 * coordenação e a vice aplicam; a supervisão pede, e o pedido só vale depois da aprovação de uma das duas.
 */
export function Interdicao({ me, aoMudar }: { me: Me; /** O aviso do alto do painel se refaz quando a interdição muda. */ aoMudar?: () => void }) {
  const coordena = can(me, "coordenacao");
  const estado = useLista<Estado>("interdicao_ver");
  const pedidos = useLista<Pedido[]>("pedidos_listar");
  const [aba, setAba] = useState<AbaDaInterdicao>("interdicao");
  const pendentes = pedidos.dados?.filter((pedido) => pedido.situacao === "pendente").length ?? 0;
  if (!estado.dados) {
    return estado.erro ? (
      <Faixa
        tom="erro"
        acao={
          <Botao pequeno onClick={estado.recarregar}>
            Tentar de novo
          </Botao>
        }
      >
        {`${estado.erro} Se esta seção nunca abriu, falta rodar de novo o supabase/install.sql no banco.`}
      </Faixa>
    ) : (
      <Esqueleto forma="cartoes" linhas={2} rotulo="Carregando…" />
    );
  }
  const dados = estado.dados;
  return (
    <Abas<AbaDaInterdicao>
      rotulo="Interdição e expurgo"
      valor={aba}
      aoMudar={setAba}
      opcoes={[
        { id: "interdicao", nome: "Interdição" },
        { id: "expurgo", nome: "Expurgo" },
        { id: "pedidos", nome: "Pedidos da supervisão", conta: pendentes },
        { id: "historico", nome: "Histórico" },
      ]}
      painel={(id) =>
        id === "interdicao" ? (
          <Interditar
            key={JSON.stringify([dados.geral, dados.areas, dados.mensagem])}
            estado={dados}
            coordena={coordena}
            recarregar={() => {
              estado.recarregar();
              pedidos.recarregar();
              aoMudar?.();
            }}
          />
        ) : id === "expurgo" ? (
          <Expurgo coordena={coordena} />
        ) : id === "pedidos" ? (
          <Pedidos
            coordena={coordena}
            depois={() => {
              estado.recarregar();
              pedidos.recarregar();
              aoMudar?.();
            }}
          />
        ) : dados.historico.length === 0 ? (
          <Vazio simbolo={History} titulo="Nada registrado ainda." />
        ) : (
          <Lista rotulo="Histórico">
            {dados.historico.map((item, i) => (
              <ItemDeLista
                key={`${item.criado_em}-${i}`}
                simbolo={item.acao === "expurgo" ? Trash2 : item.acao === "interdicao" ? Ban : History}
                titulo={
                  <>
                    <strong>{item.nome || "Alguém"}</strong> {nomesDoHistorico[item.acao] ?? item.acao}
                  </>
                }
                meta={
                  <>
                    {dataHora(item.criado_em)}
                    {item.acao === "interdicao" && <> · {resumoDaInterdicao(item.detalhes.geral === true, (item.detalhes.areas as string[] | undefined) ?? [])}</>}
                    {item.acao === "expurgo" && <> · {contas(item.detalhes.apagados as Record<string, unknown>) || "nada"}</>}
                    {typeof item.detalhes.justificativa === "string" && item.detalhes.justificativa && <> · {item.detalhes.justificativa}</>}
                  </>
                }
              />
            ))}
          </Lista>
        )
      }
    />
  );
}
