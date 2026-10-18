// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { rpc, verifyAssistant, verifyModeration } from "@/lib/backend";
import { KEYS, setItem } from "@/lib/storage";
import { useI18n } from "../I18n";
import { Aviso, botao, botaoClaro, campo, dataHora, elo, textoDoErro, useAcao, useLista } from "./comum";

export interface Controles {
  faixa: string;
  pausa: boolean;
  motivo: string;
  /** Qualquer pessoa pode criar conta de participante da comunidade. */
  cadastro?: boolean;
}

/** O que a coordenação muda no site inteiro, na hora, sem publicar nada. */
export function Site() {
  const atual = useLista<Controles>("site");
  const [aviso, setAviso] = useState("");
  if (!atual.dados) return <Aviso texto={atual.erro || "Carregando…"} />;
  // A chave refaz os campos com o que acabou de ser guardado; o aviso mora aqui em cima para não sumir junto.
  return <Formulario key={JSON.stringify(atual.dados)} inicial={atual.dados} recarregar={atual.recarregar} aviso={aviso} setAviso={setAviso} />;
}

interface SituacaoDosEmails {
  pendentes: number;
  enviados_7_dias: number;
  falhos_7_dias: number;
  ultimo_envio: string | null;
  mais_antigo_esperando: string | null;
  ultimo_erro: string | null;
  /** Há e-mail esperando há mais de meia hora (conta do banco). */
  parado?: boolean;
}

const errosDeEnvio: Record<string, string> = {
  chave_recusada: "o serviço de envio recusou a chave",
  limite: "o limite de envios do serviço acabou por hoje",
  recusado: "o serviço recusou um endereço",
  tempo_esgotado: "o serviço demorou demais",
  sem_conexao: "a rotina não alcançou o serviço",
};

/**
 * E-mails automáticos: confirmação de candidatura e de boletim, convites, avisos de decisão. Quem envia é a rotina
 * "Enviar e-mails", de dez em dez minutos. Este cartão diz só o que o banco viu acontecer, sem endereço de ninguém.
 */
function Emails() {
  const estado = useLista<SituacaoDosEmails>("emails_situacao");
  const e = estado.dados;
  if (!e) return null;
  const parado = e.parado === true;
  return (
    <section className={parado ? "border-2 border-oxblood bg-parchment-deep p-5" : "border border-rule bg-parchment-deep p-5"}>
      <h2 className="font-serif text-xl font-semibold">E-mails automáticos</h2>
      <p className="mt-1 text-ink-soft">Confirmação de candidatura e de boletim, convites, avisos de decisão e as edições do boletim. Saem de dez em dez minutos.</p>
      <ul className="mt-3 space-y-1">
        <li>Esperando para sair: <strong>{e.pendentes}</strong>{e.mais_antigo_esperando && <span className="text-ink-soft"> · o mais antigo desde {dataHora(e.mais_antigo_esperando)}</span>}.</li>
        <li>Enviados nos últimos sete dias: <strong>{e.enviados_7_dias}</strong>{e.ultimo_envio && <span className="text-ink-soft"> · o último em {dataHora(e.ultimo_envio)}</span>}.</li>
        <li>Que não saíram depois de cinco tentativas: <strong>{e.falhos_7_dias}</strong>{e.ultimo_erro && <span className="text-ink-soft"> · último motivo: {errosDeEnvio[e.ultimo_erro] ?? e.ultimo_erro}</span>}.</li>
      </ul>
      {parado && <p className="mt-2 font-semibold text-oxblood">Há e-mails esperando há mais de meia hora: o envio não está funcionando. Confira a rotina &ldquo;Enviar e-mails&rdquo; no GitHub e a chave do serviço (guia de manutenção).</p>}
      {!e.ultimo_envio && !parado && <p className="mt-2 text-ink-soft">Nenhum e-mail saiu até agora.</p>}
    </section>
  );
}

interface Moderacao {
  aprovacao_manual: boolean;
  habilitada: boolean;
  verificacao: { em: string; chave: boolean; ok: boolean; falha: string } | null;
  ultima_avaliacao: { em: string; ok: boolean; falha: string } | null;
  esperando: number;
}

const falhas: Record<string, string> = {
  sem_chave: "a chave não está cadastrada nos segredos da função",
  chave_recusada: "o serviço recusou a chave",
  limite: "limite de requisições do serviço",
  tempo_esgotado: "o serviço demorou demais",
  sem_conexao: "a função não alcançou o serviço",
  indisponivel: "o serviço estava fora do ar",
  resposta_invalida: "o serviço respondeu algo que não se entende",
};

/**
 * Modo de segurança e estado da avaliação automática da Comunidade. São três perguntas separadas, e o painel só responde
 * "sim" ao que foi visto acontecer: está habilitada no banco? a função respondeu a um teste de verdade? alguma mensagem
 * real já passou por ela?
 */
function Moderacao() {
  const estado = useLista<Moderacao>("comunidade_controles");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const m = estado.dados;
  // Banco ainda sem esta parte: o cartão não aparece, e o resto dos controles segue igual.
  if (!m) return null;

  async function trocar(ligar: boolean) {
    setOcupado(true);
    setAviso("");
    try {
      await rpc("comunidade_modo_seguranca", { p_ligar: ligar });
      setAviso(ligar ? "Modo de segurança ligado: toda mensagem nova espera aprovação manual." : "Modo de segurança desligado.");
      estado.recarregar();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  async function testar() {
    setOcupado(true);
    setAviso("Testando…");
    const r = await verifyModeration();
    setAviso(r === null ? "A função não respondeu: ela não está publicada neste serviço, ou o serviço está fora do ar." : r.ok ? "Teste feito: a função respondeu e o serviço de avaliação devolveu um resultado." : `Teste feito, com falha: ${falhas[r.falha] ?? r.falha}.`);
    estado.recarregar();
    setOcupado(false);
  }

  const v = m.verificacao;
  const u = m.ultima_avaliacao;
  return (
    <section className={m.aprovacao_manual ? "border-2 border-oxblood bg-parchment-deep p-5" : "border border-rule bg-parchment-deep p-5"}>
      <h2 className="font-serif text-xl font-semibold">Modo de segurança: somente aprovação manual</h2>
      <p className="mt-1 text-ink-soft">
        Ligado, toda conversa e resposta nova na Comunidade espera a leitura de quem cuida dela, e nenhuma avaliação automática publica nada. Não apaga o que já está no ar, não fecha a leitura
        nem o cadastro, e não muda o Mural dos Trabalhadores nem a triagem das contribuições.
      </p>
      <p className="mt-3 font-semibold">{m.aprovacao_manual ? "Ligado: só aprovação manual." : "Desligado: vale a avaliação automática."}</p>
      <div className="mt-3">
        <button type="button" className={m.aprovacao_manual ? botaoClaro : "cursor-pointer bg-oxblood px-5 py-2.5 font-medium text-parchment disabled:cursor-not-allowed disabled:opacity-50"} disabled={ocupado} onClick={() => trocar(!m.aprovacao_manual)}>
          {m.aprovacao_manual ? "Desligar o modo de segurança" : "Ligar o modo de segurança"}
        </button>
      </div>

      <h3 className="mt-6 font-semibold">Avaliação automática</h3>
      <ul className="mt-2 space-y-1">
        <li>Regras do próprio banco (primeira camada): sempre ligadas.</li>
        <li>Segunda avaliação, habilitada no banco: <strong>{m.habilitada ? "sim" : "não"}</strong>{m.habilitada && m.aprovacao_manual ? " (sem efeito enquanto o modo de segurança estiver ligado)" : ""}.</li>
        <li>
          Função publicada e chave cadastrada: <strong>{v ? (v.chave ? "sim, no último teste" : "a função respondeu, mas sem a chave") : "nunca testado por aqui"}</strong>
          {v && <span className="text-ink-soft"> · {dataHora(v.em)}</span>}.
        </li>
        <li>
          Serviço respondendo de verdade: <strong>{v ? (v.ok ? "sim, no último teste" : `não: ${falhas[v.falha] ?? v.falha}`) : "nunca testado por aqui"}</strong>.
        </li>
        <li>
          Última mensagem real avaliada: <strong>{u ? (u.ok ? "com resultado" : `com falha (${falhas[u.falha] ?? (u.falha || "sem detalhe")})`) : "nenhuma até agora"}</strong>
          {u && <span className="text-ink-soft"> · {dataHora(u.em)}</span>}.
        </li>
        <li>Mensagens esperando leitura na fila: <strong>{m.esperando}</strong>.</li>
      </ul>
      <p className="mt-2 text-ink-soft">Habilitada não quer dizer funcionando: só o teste e a última mensagem avaliada mostram isso. A segunda avaliação se liga e desliga pelo banco (guia de manutenção).</p>
      <p className="mt-2">
        <button type="button" className={elo} disabled={ocupado} onClick={testar}>Testar agora a segunda avaliação</button>
      </p>
      <Aviso texto={aviso} />
    </section>
  );
}

interface ControlesDoAssistente {
  ligado: boolean;
  por_pessoa: number;
  por_dia: number;
  verificacao: { em: string; chave: boolean; ok: boolean; falha: string; modelo?: string } | null;
  ultimo: { em: string; ok: boolean; falha: string } | null;
  hoje: number;
  pessoas_hoje: number;
  semana: number;
  interditado: boolean;
}

const falhasDoAssistente: Record<string, string> = {
  ...falhas,
  pedido_recusado: "o serviço recusou o pedido (confira o modelo escolhido no segredo ASSISTENTE_MODELO)",
  recusa: "o modelo recusou o teste",
  vazia: "o serviço respondeu sem texto",
  cortada: "a resposta passou do tamanho e veio cortada",
  desconhecida: "falha desconhecida",
};

/**
 * Assistente de reforço: responde dúvidas quando não há voluntário, usando um serviço pago de inteligência artificial.
 * Como na moderação, o painel separa ligado no banco, testado de verdade e usado de verdade. Só coordenação e vice.
 */
function AssistenteDeReforco() {
  const estado = useLista<ControlesDoAssistente>("assistente_controles");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [limites, setLimites] = useState<{ por_pessoa: string; por_dia: string } | null>(null);
  const a = estado.dados;
  // Banco ainda sem esta parte, ou quem olha não é da coordenação: o cartão não aparece.
  if (!a) return null;
  const campos = limites ?? { por_pessoa: String(a.por_pessoa), por_dia: String(a.por_dia) };

  async function salvar(mudanca: Record<string, unknown>, sucesso: string) {
    setOcupado(true);
    setAviso("");
    try {
      await rpc("assistente_configurar", { p: mudanca });
      setAviso(sucesso);
      setLimites(null);
      estado.recarregar();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  async function testar() {
    setOcupado(true);
    setAviso("Testando…");
    const r = await verifyAssistant();
    setAviso(
      r === null
        ? "A função não respondeu: ela não está publicada neste serviço, ou o serviço está fora do ar."
        : r.ok
          ? `Teste feito: a função respondeu e o modelo ${r.modelo} devolveu uma resposta.`
          : `Teste feito, com falha: ${falhasDoAssistente[r.falha] ?? r.falha}.`,
    );
    estado.recarregar();
    setOcupado(false);
  }

  const v = a.verificacao;
  const u = a.ultimo;
  return (
    <section className="border border-rule bg-parchment-deep p-5">
      <h2 className="font-serif text-xl font-semibold">Assistente de reforço (inteligência artificial)</h2>
      <p className="mt-1 text-ink-soft">
        Ligado, a página de reforço e o resolvedor ganham um quadro &ldquo;Pergunte ao assistente&rdquo; para quem tem conta: ele explica a dúvida na hora, quando não há voluntário. Usa o Claude, da
        Anthropic, que é um serviço pago por pergunta. A pergunta e a foto vão para esse serviço; o site guarda só quantas perguntas cada pessoa fez em cada dia.
      </p>
      <p className="mt-3 font-semibold">{a.ligado ? "Ligado." : "Desligado."}{a.ligado && a.interditado ? " (Sem efeito agora: a aula de reforço está interditada.)" : ""}</p>
      <div className="mt-3">
        <button type="button" className={a.ligado ? botaoClaro : botao} disabled={ocupado} onClick={() => salvar({ ligado: !a.ligado }, a.ligado ? "Assistente desligado." : "Assistente ligado. Faça um teste abaixo para conferir a chave.")}>
          {a.ligado ? "Desligar o assistente" : "Ligar o assistente"}
        </button>
      </div>

      <form
        className="mt-5 grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar({ por_pessoa: Number(campos.por_pessoa), por_dia: Number(campos.por_dia) }, "Limites guardados.");
        }}
      >
        <label className="block">
          Perguntas por pessoa, por dia (1 a 100)
          <input type="number" min={1} max={100} required value={campos.por_pessoa} onChange={(e) => setLimites({ ...campos, por_pessoa: e.target.value })} className={campo} />
        </label>
        <label className="block">
          Teto do site inteiro, por dia (1 a 5.000)
          <input type="number" min={1} max={5000} required value={campos.por_dia} onChange={(e) => setLimites({ ...campos, por_dia: e.target.value })} className={campo} />
        </label>
        <p className="sm:col-span-2">
          <button type="submit" className={botaoClaro} disabled={ocupado || limites === null}>Guardar os limites</button>
        </p>
      </form>
      <p className="mt-2 text-ink-soft">O teto do dia é o freio de gasto: quando ele acaba, o quadro avisa que o assistente lotou e manda a pessoa ao voluntário. O dia vira à meia-noite de Brasília.</p>

      <h3 className="mt-6 font-semibold">Situação</h3>
      <ul className="mt-2 space-y-1">
        <li>
          Função publicada e chave cadastrada: <strong>{v ? (v.chave ? "sim, no último teste" : "a função respondeu, mas sem a chave") : "nunca testado por aqui"}</strong>
          {v && <span className="text-ink-soft"> · {dataHora(v.em)}{v.modelo ? ` · modelo ${v.modelo}` : ""}</span>}.
        </li>
        <li>Serviço respondendo de verdade: <strong>{v ? (v.ok ? "sim, no último teste" : `não: ${falhasDoAssistente[v.falha] ?? v.falha}`) : "nunca testado por aqui"}</strong>.</li>
        <li>
          Última pergunta de verdade: <strong>{u ? (u.ok ? "respondida" : `com falha (${falhasDoAssistente[u.falha] ?? (u.falha || "sem detalhe")})`) : "nenhuma até agora"}</strong>
          {u && <span className="text-ink-soft"> · {dataHora(u.em)}</span>}.
        </li>
        <li>Perguntas hoje: <strong>{a.hoje}</strong> de {a.por_dia}, de <strong>{a.pessoas_hoje}</strong> {a.pessoas_hoje === 1 ? "pessoa" : "pessoas"}. Nos últimos sete dias: <strong>{a.semana}</strong>.</li>
      </ul>
      <p className="mt-2 text-ink-soft">Quando o serviço falha, a pergunta não é descontada da pessoa. Como publicar a função, cadastrar a chave e quanto custa: guia de manutenção, &ldquo;Assistente de reforço&rdquo;.</p>
      <p className="mt-2">
        <button type="button" className={elo} disabled={ocupado} onClick={testar}>Testar agora o assistente</button>
      </p>
      <Aviso texto={aviso} />
    </section>
  );
}

function Formulario({ inicial, recarregar, aviso, setAviso }: { inicial: Controles; recarregar: () => void; aviso: string; setAviso: (texto: string) => void }) {
  const { t } = useI18n();
  const [faixa, setFaixa] = useState(inicial.faixa);
  const [motivo, setMotivo] = useState(inicial.motivo);
  const [ocupado, setOcupado] = useState(false);
  const cartao = "border border-rule bg-parchment-deep p-5";

  async function salvar(novo: Controles, sucesso: string) {
    setOcupado(true);
    setAviso("");
    try {
      const guardado = await rpc<Controles>("site_salvar", { p: novo });
      // Este aparelho já mostra a mudança; os outros visitantes passam a ver em poucos minutos.
      setItem(KEYS.site, JSON.stringify({ ...guardado, em: Date.now() }));
      setAviso(sucesso);
      recarregar();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className={cartao}>
        <h2 className="font-serif text-xl font-semibold">Faixa do alto</h2>
        <p className="mt-1 text-ink-soft">A linha escura que aparece no topo de todas as páginas. Serve para um chamado curto: um ato, uma campanha, um aviso. Deixe em branco para voltar ao texto de sempre.</p>
        <label className="mt-3 block">
          Texto da faixa
          <input value={faixa} onChange={(e) => setFaixa(e.target.value)} maxLength={140} placeholder={t.common.strip} className={campo} />
        </label>
        <p className="mt-1 text-right font-mono text-xs text-ink-soft">{faixa.length}/140</p>
        <p className="mt-2 text-xs uppercase tracking-widest text-ink-soft">Como vai aparecer</p>
        <p className="mt-1 bg-ink px-4 py-1.5 text-center font-mono text-xs tracking-wide text-parchment">{faixa.trim() || t.common.strip}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className={botao} disabled={ocupado || faixa.trim() === inicial.faixa} onClick={() => salvar({ faixa, pausa: inicial.pausa, motivo: inicial.motivo }, "Faixa trocada.")}>
            Guardar a faixa
          </button>
          {inicial.faixa && (
            <button type="button" className={botaoClaro} disabled={ocupado} onClick={() => salvar({ faixa: "", pausa: inicial.pausa, motivo: inicial.motivo }, "A faixa voltou ao texto de sempre.")}>
              Voltar ao texto de sempre
            </button>
          )}
        </div>
      </section>

      <section className={inicial.pausa ? "border-2 border-oxblood bg-parchment-deep p-5" : cartao}>
        <h2 className="font-serif text-xl font-semibold">Pausa geral de envios</h2>
        <p className="mt-1 text-ink-soft">
          Fecha, na hora, tudo o que o público pode enviar: anúncios do mural, pedidos de reforço, assinaturas do boletim, contribuições e mensagens da comunidade. Ler e estudar continua normal, e a equipe continua trabalhando. É o freio para um ataque de mensagens ou uma manutenção.
        </p>
        <p className="mt-3 font-semibold">{inicial.pausa ? "Os envios estão pausados agora." : "Os envios estão abertos."}</p>
        <label className="mt-3 block">
          Recado para quem visita (opcional)
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Ex.: Voltamos a receber mensagens amanhã cedo." className={campo} />
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          {inicial.pausa ? (
            <>
              <button type="button" className={botao} disabled={ocupado} onClick={() => salvar({ faixa: inicial.faixa, pausa: false, motivo: "" }, "Envios reabertos.")}>
                Reabrir os envios
              </button>
              <button type="button" className={botaoClaro} disabled={ocupado || motivo.trim() === inicial.motivo} onClick={() => salvar({ faixa: inicial.faixa, pausa: true, motivo }, "Recado trocado.")}>
                Trocar o recado
              </button>
            </>
          ) : (
            <button
              type="button"
              className="cursor-pointer bg-oxblood px-5 py-2.5 font-medium text-parchment disabled:cursor-not-allowed disabled:opacity-50"
              disabled={ocupado}
              onClick={() => {
                if (window.confirm("Pausar agora tudo o que o público pode enviar?")) void salvar({ faixa: inicial.faixa, pausa: true, motivo }, "Envios pausados.");
              }}
            >
              Pausar os envios
            </button>
          )}
        </div>
      </section>

      <section className={cartao}>
        <h2 className="font-serif text-xl font-semibold">Cadastro da comunidade</h2>
        <p className="mt-1 text-ink-soft">
          Com o cadastro aberto, qualquer pessoa cria conta com e-mail e senha para perguntar e responder na Comunidade. A conta nasce sem função nenhuma, e o que ela escreve passa pela
          avaliação da Comunidade antes de aparecer. Fechado, só entra quem recebe convite. A pausa geral de envios também fecha o cadastro enquanto durar.
        </p>
        <p className="mt-3 font-semibold">{inicial.cadastro === false ? "O cadastro está fechado: só por convite." : "O cadastro está aberto."}</p>
        <div className="mt-4">
          <button
            type="button"
            className={inicial.cadastro === false ? botao : botaoClaro}
            disabled={ocupado}
            onClick={() => salvar({ faixa: inicial.faixa, pausa: inicial.pausa, motivo: inicial.motivo, cadastro: inicial.cadastro === false }, inicial.cadastro === false ? "Cadastro reaberto." : "Cadastro fechado: só por convite.")}
          >
            {inicial.cadastro === false ? "Reabrir o cadastro" : "Fechar o cadastro"}
          </button>
        </div>
      </section>

      <Moderacao />
      <AssistenteDeReforco />
      <Emails />

      <ControlesDoChat />
      <DicionarioDoInstituto />
      <div className="lg:col-span-2">
        <Aviso texto={aviso} />
        <p className="max-w-3xl text-ink-soft">
          As mudanças valem na hora no serviço. Quem já está com o site aberto passa a ver a faixa nova em até dez minutos. Tudo o que é mexido aqui fica no registro de atividades.
        </p>
      </div>
    </div>
  );
}

interface ControleDoChat {
  fechado: boolean;
  motivo: string;
  grupos_fechados: string[];
  silenciados: string[];
}

/**
 * Desligar as conversas quando for preciso: todas de uma vez, só alguns grupos ou só algumas pessoas. Quem está
 * barrado continua lendo; a liderança nunca é barrada. Tudo fica no registro de atividades.
 */
function ControlesDoChat() {
  const dados = useLista<{ controle: ControleDoChat | null; grupos: { id: string; nome: string; tipo: string; membros: number }[]; pessoas: { id: string; nome: string }[] }>("chat_controles");
  const acao = useAcao(dados.recarregar);
  const [motivo, setMotivo] = useState("");
  const [busca, setBusca] = useState("");
  if (dados.erro) return null;
  const c: ControleDoChat = { fechado: false, motivo: "", grupos_fechados: [], silenciados: [], ...(dados.dados?.controle ?? {}) };
  const salvar = (p: Partial<ControleDoChat>, texto: string) => acao.agir("chat_controlar", { p }, texto);
  const pessoas = (dados.dados?.pessoas ?? []).filter((p) => !busca || p.nome.toLowerCase().includes(busca.toLowerCase()));
  return (
    <section className="border border-rule bg-parchment-deep p-5 lg:col-span-2">
      <h2 className="font-serif text-xl font-semibold">Conversas da equipe</h2>
      <p className="mt-1 text-ink-soft">Para quando for preciso desligar: todas as conversas, alguns grupos ou algumas pessoas. Quem está barrado continua lendo, só não escreve. A coordenação, a coordenação pedagógica e a supervisão nunca são barradas.</p>
      {!dados.dados ? (
        <p className="painel-carregando mt-3 text-ink-soft">Carregando…</p>
      ) : (
        <div className="mt-4 grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="font-semibold">Todas as conversas</h3>
            <p className="mt-1 text-ink-soft">{c.fechado ? "Fechadas agora." : "Abertas."}</p>
            {!c.fechado && (
              <label className="mt-2 block text-xs">
                Motivo (aparece para a equipe, opcional)
                <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} className={campo} />
              </label>
            )}
            <button type="button" className={`mt-3 ${c.fechado ? botao : botaoClaro}`} disabled={acao.ocupado} onClick={() => salvar(c.fechado ? { fechado: false, motivo: "" } : { fechado: true, motivo }, c.fechado ? "Conversas reabertas." : "Conversas fechadas.")}>
              {c.fechado ? "Reabrir as conversas" : "Fechar todas as conversas"}
            </button>
          </div>
          <div>
            <h3 className="font-semibold">Grupos fechados</h3>
            <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
              {dados.dados.grupos.map((g) => {
                const fechado = c.grupos_fechados.includes(g.id);
                return (
                  <li key={g.id}>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" className="h-4 w-4" checked={fechado} disabled={acao.ocupado} onChange={() => salvar({ grupos_fechados: fechado ? c.grupos_fechados.filter((id) => id !== g.id) : [...c.grupos_fechados, g.id] }, fechado ? "Grupo reaberto." : "Grupo fechado.")} />
                      <span className="min-w-0 truncate">{g.nome} <span className="text-ink-soft">· {g.tipo === "departamento" ? "departamento" : "grupo"} · {g.membros}</span></span>
                    </label>
                  </li>
                );
              })}
              {dados.dados.grupos.length === 0 && <li className="text-ink-soft">Nenhum grupo ainda.</li>}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold">Pessoas silenciadas</h3>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar pelo nome" className={`${campo} mt-2`} />
            <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
              {pessoas.map((p) => {
                const calada = c.silenciados.includes(p.id);
                return (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" className="h-4 w-4" checked={calada} disabled={acao.ocupado} onChange={() => salvar({ silenciados: calada ? c.silenciados.filter((id) => id !== p.id) : [...c.silenciados, p.id] }, calada ? "Pessoa pode escrever de novo." : "Pessoa silenciada.")} />
                      <span className="min-w-0 truncate">{p.nome}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
      <Aviso texto={acao.aviso} />
    </section>
  );
}

/** Os termos que a conferência de ortografia aceita sem apontar: nomes próprios, siglas, palavras das trilhas. */
function DicionarioDoInstituto() {
  const termos = useLista<string[]>("dicionario_termos");
  const acao = useAcao(termos.recarregar);
  const [texto, setTexto] = useState<string | null>(null);
  const atual = texto ?? (termos.dados ?? []).join("\n");
  return (
    <section className="border border-rule bg-parchment-deep p-5 lg:col-span-2">
      <h2 className="font-serif text-xl font-semibold">Dicionário do instituto</h2>
      <p className="mt-1 text-ink-soft">Uma palavra por linha. O conferidor de ortografia dos editores deixa de apontar estas palavras (nomes próprios, siglas, termos das trilhas). A revisão e a coordenação editam.</p>
      <textarea value={atual} onChange={(e) => setTexto(e.target.value)} rows={8} className={`${campo} font-mono`} spellCheck={false} />
      <p className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" className={botao} disabled={acao.ocupado || texto === null} onClick={async () => { if (await acao.agir("dicionario_salvar", { p_termos: atual.split(/\n+/).map((x) => x.trim()).filter(Boolean) }, "Dicionário guardado.")) setTexto(null); }}>Guardar</button>
        <span className="text-xs text-ink-soft">{(termos.dados ?? []).length} termos</span>
      </p>
      <Aviso texto={termos.erro || acao.aviso} />
    </section>
  );
}
