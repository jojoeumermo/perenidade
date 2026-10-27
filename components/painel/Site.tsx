// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type ReactNode, useState } from "react";
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

interface SituacaoDosEmails {
  pendentes: number;
  enviados_7_dias: number;
  falhos_7_dias: number;
  ultimo_envio: string | null;
  mais_antigo_esperando: string | null;
  ultimo_erro: string | null;
  parado?: boolean;
}
interface Moderacao {
  aprovacao_manual: boolean;
  habilitada: boolean;
  verificacao: { em: string; chave: boolean; ok: boolean; falha: string } | null;
  ultima_avaliacao: { em: string; ok: boolean; falha: string } | null;
  esperando: number;
}
interface VerificacaoDoProvedor {
  id: string;
  chave: boolean;
  ok: boolean;
  falha: string;
  modelo: string;
}
interface ControlesDoAssistente {
  ligado: boolean;
  por_pessoa: number;
  por_dia: number;
  verificacao: { em: string; chave: boolean; ok: boolean; falha: string; modelo?: string; provedores?: VerificacaoDoProvedor[] } | null;
  ultimo: { em: string; ok: boolean; falha: string; provedor?: string } | null;
  hoje: number;
  pessoas_hoje: number;
  semana: number;
  interditado: boolean;
  provedores?: { id: string; ligado: boolean }[];
  uso_provedores?: Record<string, { ok: number; falhas: number }>;
}
type Mudancas = Record<string, { nome: string; em: string }>;

const errosDeEnvio: Record<string, string> = {
  chave_recusada: "o serviço de envio recusou a chave",
  limite: "o limite de envios do serviço acabou por hoje",
  recusado: "o serviço recusou um endereço",
  tempo_esgotado: "o serviço demorou demais",
  sem_conexao: "a rotina não alcançou o serviço",
};
const falhas: Record<string, string> = {
  sem_chave: "a chave não está cadastrada nos segredos da função",
  chave_recusada: "o serviço recusou a chave",
  limite: "limite de requisições do serviço (cota do dia ou do minuto)",
  tempo_esgotado: "o serviço demorou demais",
  sem_conexao: "a função não alcançou o serviço",
  indisponivel: "o serviço estava fora do ar",
  resposta_invalida: "o serviço respondeu algo que não se entende",
  pedido_recusado: "o serviço recusou o pedido (confira o modelo no segredo)",
  recusa: "o modelo recusou o teste",
  vazia: "o serviço respondeu sem texto",
  cortada: "a resposta passou do tamanho e veio cortada",
  sem_visao: "não entende foto",
  desconhecida: "falha desconhecida",
};
const PROVEDORES: Record<string, { nome: string; plano: string; segredo: string }> = {
  anthropic: { nome: "Claude (Anthropic)", plano: "pago por pergunta", segredo: "ANTHROPIC_API_KEY" },
  groq: { nome: "Groq", plano: "plano gratuito, com limite por minuto e por dia", segredo: "GROQ_API_KEY" },
  cerebras: { nome: "Cerebras", plano: "plano gratuito, com limite diário", segredo: "CEREBRAS_API_KEY" },
  gemini: { nome: "Gemini (Google)", plano: "plano gratuito, com limite por minuto e por dia; entende foto", segredo: "GEMINI_API_KEY" },
  openrouter: { nome: "OpenRouter", plano: "modelos marcados com :free", segredo: "OPENROUTER_API_KEY" },
};

/** Selo de estado: palavra e cor, nunca só cor. */
function Selo({ tipo, children }: { tipo: "ok" | "atencao" | "erro" | "neutro"; children: ReactNode }) {
  const cor = tipo === "ok" ? "border-ok text-ok" : tipo === "atencao" ? "border-gold text-gold" : tipo === "erro" ? "border-oxblood text-oxblood" : "border-rule text-ink-soft";
  return <span className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[0.7rem] uppercase tracking-wider ${cor}`}>{tipo === "ok" ? "●" : tipo === "erro" ? "■" : "○"} {children}</span>;
}
/** Explicação longa, recolhida: o cartão mostra o essencial e o resto fica em "saiba mais". */
const SaibaMais = ({ children }: { children: ReactNode }) => (
  <details className="mt-1 text-sm text-ink-soft">
    <summary className="cursor-pointer select-none underline">Saiba mais</summary>
    <div className="mt-1 space-y-1">{children}</div>
  </details>
);
/** Quem mudou o controle por último, e quando (do registro de atividades). */
const Mudado = ({ m }: { m?: { nome: string; em: string } }) => (m ? <p className="mt-2 text-xs text-ink-soft">Mudado por último por {m.nome || "alguém da coordenação"} em {dataHora(m.em)}.</p> : null);
const Cartao = ({ titulo, selo, alerta = false, id, children }: { titulo: string; selo?: ReactNode; alerta?: boolean; id?: string; children: ReactNode }) => (
  <section id={id} className={`painel-cartao p-5 ${alerta ? "border-2 border-oxblood" : ""}`}>
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="font-serif text-xl font-semibold">{titulo}</h3>
      {selo}
    </div>
    {children}
  </section>
);

/** O que a coordenação muda no site inteiro, na hora, sem publicar nada. */
export function Site() {
  const atual = useLista<Controles>("site");
  const mudancas = useLista<Mudancas>("controles_mudancas", {}, { quieta: true });
  const [aviso, setAviso] = useState("");
  if (!atual.dados) return <Aviso texto={atual.erro || "Carregando…"} />;
  // A chave refaz os campos com o que acabou de ser guardado; o aviso mora aqui em cima para não sumir junto.
  return <Formulario key={JSON.stringify(atual.dados)} inicial={atual.dados} recarregar={() => { atual.recarregar(); mudancas.recarregar(); }} aviso={aviso} setAviso={setAviso} mudancas={mudancas.dados ?? {}} />;
}

/** O resumo do topo: tudo certo, ou a lista do que está pausado, desligado ou com falha. */
function Resumo({ site }: { site: Controles }) {
  const moderacao = useLista<Moderacao>("comunidade_controles");
  const assistente = useLista<ControlesDoAssistente>("assistente_controles");
  const emails = useLista<SituacaoDosEmails>("emails_situacao");
  const chat = useLista<{ controle: { fechado?: boolean } | null }>("chat_controles");
  const itens: [string, string][] = [];
  if (site.pausa) itens.push(["Os envios do público estão pausados.", "#pausa"]);
  if (site.cadastro === false) itens.push(["O cadastro da comunidade está fechado (só por convite).", "#cadastro"]);
  if (moderacao.dados?.aprovacao_manual) itens.push(["O modo de segurança da Comunidade está ligado (só aprovação manual).", "#moderacao"]);
  if (moderacao.dados?.verificacao && !moderacao.dados.verificacao.ok) itens.push(["O último teste da segunda avaliação da Comunidade falhou.", "#moderacao"]);
  if (emails.dados?.parado) itens.push(["Há e-mails parados há mais de meia hora: o envio não está funcionando.", "#emails"]);
  else if ((emails.dados?.falhos_7_dias ?? 0) > 0) itens.push([`${emails.dados?.falhos_7_dias} e-mail(s) não saíram nos últimos sete dias.`, "#emails"]);
  if (chat.dados?.controle?.fechado) itens.push(["As conversas da equipe estão fechadas.", "#conversas"]);
  if (assistente.dados?.ligado && assistente.dados.verificacao && !assistente.dados.verificacao.ok) itens.push(["O assistente está ligado, mas o último teste falhou.", "#assistente"]);
  if (assistente.dados?.ligado && assistente.dados.ultimo && !assistente.dados.ultimo.ok) itens.push(["A última pergunta ao assistente não foi respondida.", "#assistente"]);
  const pronto = moderacao.dados !== null || moderacao.erro;
  return (
    <section className={`painel-cartao mb-6 p-5 ${itens.length ? "border-2 border-gold" : ""}`} aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-serif text-2xl font-semibold">{itens.length ? "Atenção" : pronto ? "Tudo certo" : "Conferindo…"}</h2>
        {pronto && <Selo tipo={itens.length ? "atencao" : "ok"}>{itens.length ? `${itens.length} ${itens.length === 1 ? "ponto" : "pontos"}` : "tudo aberto e funcionando"}</Selo>}
      </div>
      {itens.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {itens.map(([texto, alvo]) => <li key={texto}><a href={alvo} className="hover:text-oxblood">{texto}</a></li>)}
        </ul>
      ) : pronto ? (
        <p className="mt-1 text-ink-soft">Envios abertos, cadastro aberto, Comunidade na avaliação automática, e-mails saindo e conversas abertas.</p>
      ) : null}
      {assistente.dados && <p className="mt-2 text-sm text-ink-soft">Assistente de reforço: {assistente.dados.ligado ? "ligado" : "desligado"}.</p>}
    </section>
  );
}

function Formulario({ inicial, recarregar, aviso, setAviso, mudancas }: { inicial: Controles; recarregar: () => void; aviso: string; setAviso: (texto: string) => void; mudancas: Mudancas }) {
  const { t } = useI18n();
  const [faixa, setFaixa] = useState(inicial.faixa);
  const [motivo, setMotivo] = useState(inicial.motivo);
  const [ocupado, setOcupado] = useState(false);

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
    <div>
      <Resumo site={inicial} />
      <Aviso texto={aviso} />

      <h2 className="mt-2 border-b-2 border-ink pb-1 font-serif text-2xl font-semibold">Segurança</h2>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Cartao id="cadastro" titulo="Cadastro da comunidade" selo={<Selo tipo={inicial.cadastro === false ? "atencao" : "ok"}>{inicial.cadastro === false ? "fechado" : "aberto"}</Selo>}>
          <p className="mt-1">{inicial.cadastro === false ? "Só entra quem recebe convite." : "Qualquer pessoa cria conta para perguntar e responder na Comunidade."}</p>
          <SaibaMais>
            <p>A conta nasce sem função nenhuma, e o que ela escreve passa pela avaliação da Comunidade antes de aparecer.</p>
            <p>A pausa geral de envios também fecha o cadastro enquanto durar.</p>
          </SaibaMais>
          <button
            type="button"
            className={`mt-3 ${inicial.cadastro === false ? botao : botaoClaro}`}
            disabled={ocupado}
            onClick={() => {
              if (inicial.cadastro !== false && !window.confirm("Fechar o cadastro? A partir de agora só entra quem receber convite. Quem já tem conta continua entrando.")) return;
              void salvar({ faixa: inicial.faixa, pausa: inicial.pausa, motivo: inicial.motivo, cadastro: inicial.cadastro === false }, inicial.cadastro === false ? "Cadastro reaberto ✓" : "Cadastro fechado: só por convite.");
            }}
          >
            {inicial.cadastro === false ? "Reabrir o cadastro" : "Fechar o cadastro"}
          </button>
          <Mudado m={mudancas.site_configurado} />
        </Cartao>
        <ModeracaoCartao mudanca={mudancas.comunidade_modo_seguranca} />
        <PrazoDasSessoes mudanca={mudancas.seguranca_sessoes} />
      </div>

      <h2 className="mt-10 border-b-2 border-ink pb-1 font-serif text-2xl font-semibold">Comunicação</h2>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Faixa do alto" selo={<Selo tipo={inicial.faixa ? "atencao" : "neutro"}>{inicial.faixa ? "com recado" : "texto de sempre"}</Selo>}>
          <p className="mt-1">A linha escura no topo de todas as páginas, para um chamado curto.</p>
          <label className="mt-3 block">
            Texto da faixa
            <input value={faixa} onChange={(e) => setFaixa(e.target.value)} maxLength={140} placeholder={t.common.strip} className={campo} />
          </label>
          <p className="mt-1 text-right font-mono text-xs text-ink-soft">{faixa.length}/140</p>
          <p className="mt-1 text-xs uppercase tracking-widest text-ink-soft">Prévia</p>
          <p className="mt-1 bg-ink px-4 py-1.5 text-center font-mono text-xs tracking-wide text-parchment">{faixa.trim() || t.common.strip}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className={botao} disabled={ocupado || faixa.trim() === inicial.faixa} onClick={() => salvar({ faixa, pausa: inicial.pausa, motivo: inicial.motivo }, "Faixa trocada ✓")}>Guardar a faixa</button>
            {inicial.faixa && <button type="button" className={botaoClaro} disabled={ocupado} onClick={() => salvar({ faixa: "", pausa: inicial.pausa, motivo: inicial.motivo }, "A faixa voltou ao texto de sempre.")}>Voltar ao texto de sempre</button>}
          </div>
          <SaibaMais><p>Quem já está com o site aberto passa a ver a faixa nova em até dez minutos.</p></SaibaMais>
        </Cartao>

        <Cartao id="pausa" titulo="Pausa geral de envios" alerta={inicial.pausa} selo={<Selo tipo={inicial.pausa ? "erro" : "ok"}>{inicial.pausa ? "pausados" : "abertos"}</Selo>}>
          <p className="mt-1">{inicial.pausa ? "O público não consegue enviar nada agora." : "O público pode enviar contribuições, mensagens, anúncios e pedidos."}</p>
          <SaibaMais>
            <p>Fecha, na hora, tudo o que o público pode enviar: anúncios do mural, pedidos de reforço, assinaturas do boletim, contribuições e mensagens da comunidade.</p>
            <p>Ler e estudar continua normal, e a equipe continua trabalhando. É o freio para um ataque de mensagens ou uma manutenção.</p>
          </SaibaMais>
          <label className="mt-3 block">
            Recado para quem visita (opcional)
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Ex.: Voltamos a receber mensagens amanhã cedo." className={campo} />
          </label>
          <div className="mt-3 flex flex-wrap gap-3">
            {inicial.pausa ? (
              <>
                <button type="button" className={botao} disabled={ocupado} onClick={() => salvar({ faixa: inicial.faixa, pausa: false, motivo: "" }, "Envios reabertos ✓")}>Reabrir os envios</button>
                <button type="button" className={botaoClaro} disabled={ocupado || motivo.trim() === inicial.motivo} onClick={() => salvar({ faixa: inicial.faixa, pausa: true, motivo }, "Recado trocado ✓")}>Trocar o recado</button>
              </>
            ) : (
              <button type="button" className="painel-botao cursor-pointer bg-oxblood px-5 py-2.5 font-semibold text-parchment disabled:cursor-not-allowed disabled:opacity-50" disabled={ocupado} onClick={() => { if (window.confirm("Pausar agora tudo o que o público pode enviar? Contribuições, mensagens da Comunidade, anúncios, pedidos de reforço e assinaturas do boletim param até alguém reabrir.")) void salvar({ faixa: inicial.faixa, pausa: true, motivo }, "Envios pausados."); }}>
                Pausar os envios
              </button>
            )}
          </div>
          <Mudado m={mudancas.site_configurado} />
        </Cartao>

        <Emails />
        <ControlesDoChat mudanca={mudancas.chat_controlado} />
        <DicionarioDoInstituto mudanca={mudancas.dicionario_salvo} />
      </div>

      <h2 className="mt-10 border-b-2 border-ink pb-1 font-serif text-2xl font-semibold">Assistente</h2>
      <div className="mt-4">
        <AssistenteDeReforco mudanca={mudancas.assistente_configurado} />
      </div>
      <p className="mt-6 max-w-3xl text-sm text-ink-soft">As mudanças valem na hora. Tudo o que é mexido aqui fica no registro de atividades, com quem mudou e quando.</p>
    </div>
  );
}

/** E-mails automáticos: o que o banco viu acontecer, sem endereço de ninguém. */
function Emails() {
  const estado = useLista<SituacaoDosEmails>("emails_situacao");
  const e = estado.dados;
  if (!e) return null;
  const parado = e.parado === true;
  return (
    <Cartao id="emails" titulo="E-mails automáticos" alerta={parado} selo={<Selo tipo={parado ? "erro" : e.falhos_7_dias > 0 ? "atencao" : e.ultimo_envio ? "ok" : "neutro"}>{parado ? "parado" : e.falhos_7_dias > 0 ? "com falhas" : e.ultimo_envio ? "saindo" : "nenhum enviado"}</Selo>}>
      <ul className="mt-2 space-y-1 text-sm">
        <li>Esperando para sair: <strong>{e.pendentes}</strong>{e.mais_antigo_esperando && <span className="text-ink-soft"> · desde {dataHora(e.mais_antigo_esperando)}</span>}.</li>
        <li>Enviados em sete dias: <strong>{e.enviados_7_dias}</strong>{e.ultimo_envio && <span className="text-ink-soft"> · o último em {dataHora(e.ultimo_envio)}</span>}.</li>
        <li>Que não saíram: <strong>{e.falhos_7_dias}</strong>{e.ultimo_erro && <span className="text-ink-soft"> · {errosDeEnvio[e.ultimo_erro] ?? e.ultimo_erro}</span>}.</li>
      </ul>
      {parado && <p className="mt-2 font-semibold text-oxblood">O envio não está funcionando. Confira a função “enviar-emails” e a chave do serviço (guia de manutenção).</p>}
      <SaibaMais><p>Confirmações de candidatura e de boletim, convites, avisos de decisão e as edições do boletim saem de minuto em minuto pela função do serviço de contas, com a rotina do GitHub de reserva. Para a entrega, veja Boletim → Configurar a entrega.</p></SaibaMais>
    </Cartao>
  );
}

/** Modo de segurança e estado da avaliação automática da Comunidade. */
function ModeracaoCartao({ mudanca }: { mudanca?: { nome: string; em: string } }) {
  const estado = useLista<Moderacao>("comunidade_controles");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const m = estado.dados;
  if (!m) return null;

  async function trocar(ligar: boolean) {
    if (ligar && !window.confirm("Ligar o modo de segurança? Toda conversa e resposta nova na Comunidade passa a esperar leitura humana antes de aparecer.")) return;
    setOcupado(true);
    setAviso("");
    try {
      await rpc("comunidade_modo_seguranca", { p_ligar: ligar });
      setAviso(ligar ? "Modo de segurança ligado." : "Modo de segurança desligado ✓");
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
    setAviso(r === null ? "A função não respondeu: ela não está publicada neste serviço, ou o serviço está fora do ar." : r.ok ? "Teste feito: a segunda avaliação respondeu ✓" : `Teste feito, com falha: ${falhas[r.falha] ?? r.falha}.`);
    estado.recarregar();
    setOcupado(false);
  }
  const v = m.verificacao;
  const u = m.ultima_avaliacao;
  return (
    <Cartao id="moderacao" titulo="Modo de segurança da Comunidade" alerta={m.aprovacao_manual} selo={<Selo tipo={m.aprovacao_manual ? "atencao" : "ok"}>{m.aprovacao_manual ? "ligado" : "desligado"}</Selo>}>
      <p className="mt-1">{m.aprovacao_manual ? "Só aprovação manual: nada novo aparece sem leitura humana." : "Vale a avaliação automática."} Na fila: <strong>{m.esperando}</strong>.</p>
      <SaibaMais>
        <p>Não apaga o que já está no ar, não fecha a leitura nem o cadastro, e não muda o Mural dos Trabalhadores nem a triagem das contribuições.</p>
        <p>Segunda avaliação habilitada no banco: <strong>{m.habilitada ? "sim" : "não"}</strong>. Último teste: <strong>{v ? (v.ok ? "respondeu" : `falhou (${falhas[v.falha] ?? v.falha})`) : "nunca testado"}</strong>{v && ` · ${dataHora(v.em)}`}. Última mensagem real: <strong>{u ? (u.ok ? "avaliada" : `falha (${falhas[u.falha] ?? u.falha})`) : "nenhuma"}</strong>{u && ` · ${dataHora(u.em)}`}.</p>
      </SaibaMais>
      <p className="mt-3 flex flex-wrap gap-3">
        <button type="button" className={m.aprovacao_manual ? botaoClaro : "painel-botao cursor-pointer bg-oxblood px-5 py-2.5 font-semibold text-parchment disabled:opacity-50"} disabled={ocupado} onClick={() => trocar(!m.aprovacao_manual)}>{m.aprovacao_manual ? "Desligar o modo de segurança" : "Ligar o modo de segurança"}</button>
        <button type="button" className={elo} disabled={ocupado} onClick={testar}>Testar a segunda avaliação</button>
      </p>
      <Aviso texto={aviso} />
      <Mudado m={mudanca} />
    </Cartao>
  );
}

/** Quanto tempo uma sessão parada continua valendo (Minha conta mostra o mesmo prazo a cada pessoa). */

function PrazoDasSessoes({ mudanca }: { mudanca?: { nome: string; em: string } }) {
  const protecao = useLista<{ sessao_dias: number }>("conta_protecao", {}, { quieta: true });
  const acao = useAcao(protecao.recarregar);
  const [dias, setDias] = useState<string | null>(null);
  const atual = protecao.dados?.sessao_dias ?? 60;
  return (
    <Cartao titulo="Sessões antigas" selo={<Selo tipo="neutro">{atual} dias</Selo>}>
      <p className="mt-1">Aparelho parado há mais que o prazo precisa entrar de novo com a senha.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">Prazo em dias (7 a 365)<input type="number" min={7} max={365} value={dias ?? String(atual)} onChange={(e) => setDias(e.target.value)} className={`${campo} max-w-32`} /></label>
        <button type="button" className={botaoClaro} disabled={acao.ocupado || dias === null} onClick={async () => { if (await acao.agir("seguranca_sessoes", { p_dias: Number(dias) }, "Prazo guardado ✓")) setDias(null); }}>Guardar</button>
      </div>
      <Aviso texto={acao.aviso} />
      <Mudado m={mudanca} />
    </Cartao>
  );
}

/**
 * Assistente de reforço: responde dúvidas quando não há voluntário. Os provedores entram na ordem escolhida aqui; se um
 * falhar (cota do dia, fora do ar), o próximo responde. Chaves só nos segredos da função, nunca no navegador nem no banco.
 */
function AssistenteDeReforco({ mudanca }: { mudanca?: { nome: string; em: string } }) {
  const estado = useLista<ControlesDoAssistente>("assistente_controles");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [limites, setLimites] = useState<{ por_pessoa: string; por_dia: string } | null>(null);
  const a = estado.dados;
  if (!a) return null;
  const campos = limites ?? { por_pessoa: String(a.por_pessoa), por_dia: String(a.por_dia) };
  const lista = a.provedores ?? [{ id: "anthropic", ligado: true }];
  const verificados = new Map((a.verificacao?.provedores ?? []).map((p) => [p.id, p]));

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
    setAviso("Testando cada provedor…");
    const r = await verifyAssistant();
    setAviso(r === null ? "A função não respondeu: ela não está publicada neste serviço, ou o serviço está fora do ar." : r.ok ? `Teste feito ✓ Pelo menos um provedor respondeu (${r.modelo}).` : `Teste feito: nenhum provedor respondeu (${falhas[r.falha] ?? r.falha}).`);
    estado.recarregar();
    setOcupado(false);
  }
  const mover = (i: number, d: number) => {
    const n = [...lista];
    const [x] = n.splice(i, 1);
    n.splice(i + d, 0, x);
    void salvar({ provedores: n }, "Ordem guardada ✓");
  };

  return (
    <Cartao id="assistente" titulo="Assistente de reforço (inteligência artificial)" selo={<Selo tipo={a.ligado ? (a.verificacao && !a.verificacao.ok ? "erro" : "ok") : "neutro"}>{a.ligado ? "ligado" : "desligado"}</Selo>}>
      <p className="mt-1">Ligado, a página de reforço e o resolvedor ganham “Pergunte ao assistente” para quem tem conta. Sempre avisa que é uma inteligência artificial.{a.ligado && a.interditado ? " Sem efeito agora: a aula de reforço está interditada." : ""}</p>
      <SaibaMais>
        <p>A pergunta e a foto vão para o provedor que responder; o site guarda só quantas perguntas cada pessoa fez em cada dia e qual provedor respondeu.</p>
        <p>Quando o provedor falha, a pergunta não é descontada da pessoa e vai para o próximo da lista.</p>
      </SaibaMais>
      <p className="mt-3">
        <button
          type="button"
          className={a.ligado ? botaoClaro : botao}
          disabled={ocupado}
          onClick={() => {
            if (a.ligado && !window.confirm("Desligar o assistente? O quadro some do site e as dúvidas voltam a ir só para os voluntários.")) return;
            if (!a.ligado && !window.confirm("Ligar o assistente? Provedores pagos (como o Claude) cobram por pergunta; os gratuitos têm limites por dia.")) return;
            void salvar({ ligado: !a.ligado }, a.ligado ? "Assistente desligado." : "Assistente ligado. Faça o teste abaixo.");
          }}
        >
          {a.ligado ? "Desligar o assistente" : "Ligar o assistente"}
        </button>
      </p>

      <h4 className="mt-5 font-semibold">Provedores, na ordem de tentativa</h4>
      <ol className="mt-2 divide-y divide-rule border-y border-rule text-sm">
        {lista.map((p, i) => {
          const info = PROVEDORES[p.id] ?? { nome: p.id, plano: "", segredo: "" };
          const v = verificados.get(p.id);
          const uso = a.uso_provedores?.[p.id];
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="w-6 text-center font-mono text-ink-soft">{i + 1}</span>
              <label className="flex min-w-48 flex-1 cursor-pointer items-start gap-2">
                <input type="checkbox" className="mt-1" checked={p.ligado} disabled={ocupado} onChange={() => void salvar({ provedores: lista.map((x) => (x.id === p.id ? { ...x, ligado: !x.ligado } : x)) }, "Guardado ✓")} />
                <span>
                  <strong>{info.nome}</strong> <span className="text-xs text-ink-soft">· {info.plano}</span>
                  <span className="block text-xs">
                    {v ? (v.chave ? (v.ok ? <span className="text-ok">✓ respondeu no teste ({v.modelo})</span> : <span className="text-oxblood">✗ {falhas[v.falha] ?? v.falha}</span>) : <span className="text-ink-soft">sem chave ({info.segredo} nos segredos da função)</span>) : <span className="text-ink-soft">ainda não testado</span>}
                    {uso ? <span className="text-ink-soft"> · hoje: {uso.ok} respondidas, {uso.falhas} falhas</span> : null}
                  </span>
                </span>
              </label>
              <span className="flex gap-1">
                <button type="button" aria-label={`Subir ${info.nome}`} disabled={ocupado || i === 0} onClick={() => mover(i, -1)} className="cursor-pointer border border-rule px-1.5 disabled:opacity-30">↑</button>
                <button type="button" aria-label={`Descer ${info.nome}`} disabled={ocupado || i === lista.length - 1} onClick={() => mover(i, 1)} className="cursor-pointer border border-rule px-1.5 disabled:opacity-30">↓</button>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-1 text-xs text-ink-soft">Só os marcados entram. As chaves ficam nos segredos da função “assistente” no serviço de contas (guia de manutenção); o painel nunca as vê.</p>

      <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void salvar({ por_pessoa: Number(campos.por_pessoa), por_dia: Number(campos.por_dia) }, "Limites guardados ✓"); }}>
        <label className="block">Perguntas por pessoa, por dia (1 a 100)<input type="number" min={1} max={100} required value={campos.por_pessoa} onChange={(e) => setLimites({ ...campos, por_pessoa: e.target.value })} className={campo} /></label>
        <label className="block">Teto do site inteiro, por dia (1 a 5.000)<input type="number" min={1} max={5000} required value={campos.por_dia} onChange={(e) => setLimites({ ...campos, por_dia: e.target.value })} className={campo} /></label>
        <p className="sm:col-span-2"><button type="submit" className={botaoClaro} disabled={ocupado || limites === null}>Guardar os limites</button></p>
      </form>

      <ul className="mt-3 space-y-1 text-sm">
        <li>Perguntas hoje: <strong>{a.hoje}</strong> de {a.por_dia}, de <strong>{a.pessoas_hoje}</strong> {a.pessoas_hoje === 1 ? "pessoa" : "pessoas"}. Em sete dias: <strong>{a.semana}</strong>.</li>
        <li>Última pergunta: <strong>{a.ultimo ? (a.ultimo.ok ? `respondida${a.ultimo.provedor ? ` por ${PROVEDORES[a.ultimo.provedor]?.nome ?? a.ultimo.provedor}` : ""}` : `com falha (${falhas[a.ultimo.falha] ?? (a.ultimo.falha || "sem detalhe")})`) : "nenhuma até agora"}</strong>{a.ultimo && <span className="text-ink-soft"> · {dataHora(a.ultimo.em)}</span>}.</li>
      </ul>
      <p className="mt-3"><button type="button" className={elo} disabled={ocupado} onClick={testar}>Testar agora cada provedor</button></p>
      <Aviso texto={aviso} />
      <Mudado m={mudanca} />
    </Cartao>
  );
}

interface ControleDoChat {
  fechado: boolean;
  motivo: string;
  grupos_fechados: string[];
  silenciados: string[];
}

/** Desligar as conversas quando for preciso: todas, alguns grupos ou algumas pessoas. A liderança nunca é barrada. */
function ControlesDoChat({ mudanca }: { mudanca?: { nome: string; em: string } }) {
  const dados = useLista<{ controle: ControleDoChat | null; grupos: { id: string; nome: string; tipo: string; membros: number }[]; pessoas: { id: string; nome: string }[] }>("chat_controles");
  const acao = useAcao(dados.recarregar);
  const [motivo, setMotivo] = useState("");
  const [busca, setBusca] = useState("");
  if (dados.erro) return null;
  const c: ControleDoChat = { fechado: false, motivo: "", grupos_fechados: [], silenciados: [], ...(dados.dados?.controle ?? {}) };
  const salvar = (p: Partial<ControleDoChat>, texto: string) => acao.agir("chat_controlar", { p }, texto);
  const pessoas = (dados.dados?.pessoas ?? []).filter((p) => !busca || p.nome.toLowerCase().includes(busca.toLowerCase()));
  return (
    <div className="lg:col-span-2">
      <Cartao id="conversas" titulo="Conversas da equipe" alerta={c.fechado} selo={<Selo tipo={c.fechado ? "erro" : c.grupos_fechados.length || c.silenciados.length ? "atencao" : "ok"}>{c.fechado ? "fechadas" : c.grupos_fechados.length || c.silenciados.length ? "com restrições" : "abertas"}</Selo>}>
        <SaibaMais><p>Quem está barrado continua lendo, só não escreve. A coordenação, a coordenação pedagógica e a supervisão nunca são barradas.</p></SaibaMais>
        {!dados.dados ? (
          <p className="painel-carregando mt-3 text-ink-soft">Carregando…</p>
        ) : (
          <div className="mt-4 grid gap-6 md:grid-cols-3">
            <div>
              <h4 className="font-semibold">Todas as conversas</h4>
              {!c.fechado && (
                <label className="mt-2 block text-xs">Motivo (aparece para a equipe, opcional)<input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} className={campo} /></label>
              )}
              <button type="button" className={`mt-3 ${c.fechado ? botao : botaoClaro}`} disabled={acao.ocupado} onClick={() => { if (!c.fechado && !window.confirm("Fechar todas as conversas da equipe? Ninguém (fora a liderança) escreve até reabrir.")) return; void salvar(c.fechado ? { fechado: false, motivo: "" } : { fechado: true, motivo }, c.fechado ? "Conversas reabertas ✓" : "Conversas fechadas."); }}>
                {c.fechado ? "Reabrir as conversas" : "Fechar todas as conversas"}
              </button>
            </div>
            <div>
              <h4 className="font-semibold">Grupos fechados</h4>
              <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                {dados.dados.grupos.map((g) => {
                  const fechado = c.grupos_fechados.includes(g.id);
                  return (
                    <li key={g.id}>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input type="checkbox" className="h-4 w-4" checked={fechado} disabled={acao.ocupado} onChange={() => salvar({ grupos_fechados: fechado ? c.grupos_fechados.filter((id) => id !== g.id) : [...c.grupos_fechados, g.id] }, fechado ? "Grupo reaberto ✓" : "Grupo fechado.")} />
                        <span className="min-w-0 truncate">{g.nome} <span className="text-ink-soft">· {g.tipo === "departamento" ? "departamento" : "grupo"} · {g.membros}</span></span>
                      </label>
                    </li>
                  );
                })}
                {dados.dados.grupos.length === 0 && <li className="text-ink-soft">Nenhum grupo ainda.</li>}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold">Pessoas silenciadas</h4>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar pelo nome" aria-label="Procurar pessoa" className={`${campo} mt-2`} />
              <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                {pessoas.map((p) => {
                  const calada = c.silenciados.includes(p.id);
                  return (
                    <li key={p.id}>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input type="checkbox" className="h-4 w-4" checked={calada} disabled={acao.ocupado} onChange={() => salvar({ silenciados: calada ? c.silenciados.filter((id) => id !== p.id) : [...c.silenciados, p.id] }, calada ? "Pessoa pode escrever de novo ✓" : "Pessoa silenciada.")} />
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
        <Mudado m={mudanca} />
      </Cartao>
    </div>
  );
}

/** Os termos que a conferência de ortografia aceita sem apontar: nomes próprios, siglas, palavras das trilhas. */
function DicionarioDoInstituto({ mudanca }: { mudanca?: { nome: string; em: string } }) {
  const termos = useLista<string[]>("dicionario_termos");
  const acao = useAcao(termos.recarregar);
  const [texto, setTexto] = useState<string | null>(null);
  const atual = texto ?? (termos.dados ?? []).join("\n");
  return (
    <div className="lg:col-span-2">
      <Cartao titulo="Dicionário do instituto" selo={<Selo tipo="neutro">{(termos.dados ?? []).length} termos</Selo>}>
        <p className="mt-1">Uma palavra por linha: o conferidor de ortografia dos editores deixa de apontar estas palavras.</p>
        <textarea value={atual} onChange={(e) => setTexto(e.target.value)} rows={8} className={`${campo} font-mono`} spellCheck={false} aria-label="Termos do dicionário" />
        <p className="mt-2 flex flex-wrap items-center gap-3">
          <button type="button" className={botao} disabled={acao.ocupado || texto === null} onClick={async () => { if (await acao.agir("dicionario_salvar", { p_termos: atual.split(/\n+/).map((x) => x.trim()).filter(Boolean) }, "Dicionário guardado ✓")) setTexto(null); }}>Guardar</button>
        </p>
        <Aviso texto={termos.erro || acao.aviso} />
        <Mudado m={mudanca} />
      </Cartao>
    </div>
  );
}
