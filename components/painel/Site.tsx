// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ArrowDown, ArrowUp, Bot, Mail, MessagesSquare, ShieldCheck, SpellCheck2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { rpc, verifyAssistant, verifyModeration } from "@/lib/backend";
import { KEYS, setItem } from "@/lib/storage";
import { useI18n } from "../I18n";
import { dataHora, textoDoErro, useAcao, useLista } from "./comum";
import { Area, Botao, Busca, CabecalhoDeSecao, Campo, Cartao as CartaoDoPainel, confirmarFrase, Esqueleto, Faixa, Marca, Selo as SeloDoPainel, type TomDoSelo } from "./ui";

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

/** Selo de estado: palavra e cor, nunca só cor (o Selo de ui/, com o ponto). */
const TOM: Record<"ok" | "atencao" | "erro" | "neutro", TomDoSelo> = { ok: "ok", atencao: "aviso", erro: "erro", neutro: "neutro" };
function Selo({ tipo, children }: { tipo: "ok" | "atencao" | "erro" | "neutro"; children: ReactNode }) {
  return (
    <SeloDoPainel tom={TOM[tipo]} ponto={tipo !== "neutro"}>
      {children}
    </SeloDoPainel>
  );
}
/** O recado de uma ação (sucesso ou erro do banco): uma faixa curta, anunciada com calma. */
const Recado = ({ texto }: { texto: string }) => <div aria-live="polite">{texto && <Faixa tom="info">{texto}</Faixa>}</div>;
/** Explicação longa, recolhida: o cartão mostra o essencial e o resto fica em "saiba mais". */
const SaibaMais = ({ children }: { children: ReactNode }) => (
  <details className="text-sm text-ink-soft">
    <summary className="pn-elo cursor-pointer select-none">Saiba mais</summary>
    <div className="mt-1 space-y-1">{children}</div>
  </details>
);
/** Quem mudou o controle por último, e quando (do registro de atividades). */
const Mudado = ({ m }: { m?: { nome: string; em: string } }) => (m ? <p className="pn-ajuda">Mudado por último por {m.nome || "alguém da coordenação"} em {dataHora(m.em)}.</p> : null);
/** O cartão de um controle: título em Garamond com o selo do estado à direita; com "alerta", a moldura de alerta. */
const Cartao = ({ titulo, selo, alerta = false, id, children }: { titulo: string; selo?: ReactNode; alerta?: boolean; id?: string; children: ReactNode }) => (
  <CartaoDoPainel id={id} titulo={titulo} nivelDoTitulo={3} acoes={selo} variante={alerta ? "alerta" : "padrao"} style={{ scrollMarginTop: "4rem" }}>
    <div className="pn-secao">{children}</div>
  </CartaoDoPainel>
);

/** O que a coordenação muda no site inteiro, na hora, sem publicar nada. */
export function Site() {
  const atual = useLista<Controles>("site");
  const mudancas = useLista<Mudancas>("controles_mudancas", {}, { quieta: true });
  const [aviso, setAviso] = useState("");
  if (!atual.dados) {
    return atual.erro ? (
      <Faixa
        tom="erro"
        acao={
          <Botao pequeno onClick={atual.recarregar}>
            Tentar de novo
          </Botao>
        }
      >
        {atual.erro}
      </Faixa>
    ) : (
      <Esqueleto forma="cartoes" linhas={4} rotulo="Carregando…" />
    );
  }
  // A chave refaz os campos com o que acabou de ser guardado; o aviso mora aqui em cima para não sumir junto.
  return (
    <Formulario
      key={JSON.stringify(atual.dados)}
      inicial={atual.dados}
      recarregar={() => {
        atual.recarregar();
        mudancas.recarregar();
      }}
      aviso={aviso}
      setAviso={setAviso}
      mudancas={mudancas.dados ?? {}}
    />
  );
}

/** O resumo do topo: tudo certo, ou a lista do que está pausado, desligado ou com falha (numa faixa, com os atalhos). */
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
    <div aria-live="polite">
      <Faixa
        tom={itens.length ? "aviso" : pronto ? "ok" : "info"}
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            {itens.length ? "Atenção" : pronto ? "Tudo certo" : "Conferindo…"}
            {pronto && <Selo tipo={itens.length ? "atencao" : "ok"}>{itens.length ? `${itens.length} ${itens.length === 1 ? "ponto" : "pontos"}` : "tudo aberto e funcionando"}</Selo>}
          </span>
        }
      >
        {itens.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5">
            {itens.map(([texto, alvo]) => (
              <li key={texto}>
                <a href={alvo} className="pn-elo">
                  {texto}
                </a>
              </li>
            ))}
          </ul>
        ) : pronto ? (
          <p>Envios abertos, cadastro aberto, Comunidade na avaliação automática, e-mails saindo e conversas abertas.</p>
        ) : null}
        {assistente.dados && <p className="text-sm">Assistente de reforço: {assistente.dados.ligado ? "ligado" : "desligado"}.</p>}
      </Faixa>
    </div>
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
    <div className="pn-tela">
      <Resumo site={inicial} />
      <Recado texto={aviso} />

      <CabecalhoDeSecao titulo="Segurança" simbolo={ShieldCheck} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao id="cadastro" titulo="Cadastro da comunidade" alerta={inicial.cadastro === false} selo={<Selo tipo={inicial.cadastro === false ? "atencao" : "ok"}>{inicial.cadastro === false ? "fechado" : "aberto"}</Selo>}>
          <p>{inicial.cadastro === false ? "Só entra quem recebe convite." : "Qualquer pessoa cria conta para perguntar e responder na Comunidade."}</p>
          <SaibaMais>
            <p>A conta nasce sem função nenhuma, e o que ela escreve passa pela avaliação da Comunidade antes de aparecer.</p>
            <p>A pausa geral de envios também fecha o cadastro enquanto durar.</p>
          </SaibaMais>
          <div>
            <Botao
              variante={inicial.cadastro === false ? "principal" : "padrao"}
              perigo={inicial.cadastro !== false}
              disabled={ocupado}
              onClick={async () => {
                if (inicial.cadastro !== false && !(await confirmarFrase("Fechar o cadastro? A partir de agora só entra quem receber convite. Quem já tem conta continua entrando."))) return;
                void salvar({ faixa: inicial.faixa, pausa: inicial.pausa, motivo: inicial.motivo, cadastro: inicial.cadastro === false }, inicial.cadastro === false ? "Cadastro reaberto ✓" : "Cadastro fechado: só por convite.");
              }}
            >
              {inicial.cadastro === false ? "Reabrir o cadastro" : "Fechar o cadastro"}
            </Botao>
          </div>
          <Mudado m={mudancas.site_configurado} />
        </Cartao>
        <ModeracaoCartao mudanca={mudancas.comunidade_modo_seguranca} />
        <PrazoDasSessoes mudanca={mudancas.seguranca_sessoes} />
      </div>

      <CabecalhoDeSecao titulo="Comunicação" simbolo={Mail} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao titulo="Faixa do alto" selo={<Selo tipo={inicial.faixa ? "atencao" : "neutro"}>{inicial.faixa ? "com recado" : "texto de sempre"}</Selo>}>
          <p>A linha escura no topo de todas as páginas, para um chamado curto.</p>
          <div>
            <Campo rotulo="Texto da faixa" value={faixa} onChange={(e) => setFaixa(e.target.value)} maxLength={140} placeholder={t.common.strip} />
            <p className="pn-ajuda text-right tabular-nums">{faixa.length}/140</p>
          </div>
          <div>
            <p className="pn-rotulo-mono">Prévia</p>
            <p className="mt-1 bg-ink px-4 py-1.5 text-center font-mono text-xs tracking-wide text-parchment">{faixa.trim() || t.common.strip}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Botao disabled={ocupado || faixa.trim() === inicial.faixa} onClick={() => salvar({ faixa, pausa: inicial.pausa, motivo: inicial.motivo }, "Faixa trocada ✓")}>
              Guardar a faixa
            </Botao>
            {inicial.faixa && (
              <Botao variante="discreto" disabled={ocupado} onClick={() => salvar({ faixa: "", pausa: inicial.pausa, motivo: inicial.motivo }, "A faixa voltou ao texto de sempre.")}>
                Voltar ao texto de sempre
              </Botao>
            )}
          </div>
          <SaibaMais>
            <p>Quem já está com o site aberto passa a ver a faixa nova em até dez minutos.</p>
          </SaibaMais>
        </Cartao>

        <Cartao id="pausa" titulo="Pausa geral de envios" alerta={inicial.pausa} selo={<Selo tipo={inicial.pausa ? "erro" : "ok"}>{inicial.pausa ? "pausados" : "abertos"}</Selo>}>
          <p>{inicial.pausa ? "O público não consegue enviar nada agora." : "O público pode enviar contribuições, mensagens, anúncios e pedidos."}</p>
          <SaibaMais>
            <p>Fecha, na hora, tudo o que o público pode enviar: anúncios do mural, pedidos de reforço, assinaturas do boletim, contribuições e mensagens da comunidade.</p>
            <p>Ler e estudar continua normal, e a equipe continua trabalhando. É o freio para um ataque de mensagens ou uma manutenção.</p>
          </SaibaMais>
          <Campo rotulo="Recado para quem visita (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Ex.: Voltamos a receber mensagens amanhã cedo." />
          <div className="flex flex-wrap gap-2">
            {inicial.pausa ? (
              <>
                <Botao variante="principal" disabled={ocupado} onClick={() => salvar({ faixa: inicial.faixa, pausa: false, motivo: "" }, "Envios reabertos ✓")}>
                  Reabrir os envios
                </Botao>
                <Botao disabled={ocupado || motivo.trim() === inicial.motivo} onClick={() => salvar({ faixa: inicial.faixa, pausa: true, motivo }, "Recado trocado ✓")}>
                  Trocar o recado
                </Botao>
              </>
            ) : (
              <Botao
                perigo
                disabled={ocupado}
                onClick={async () => {
                  if (await confirmarFrase("Pausar agora tudo o que o público pode enviar? Contribuições, mensagens da Comunidade, anúncios, pedidos de reforço e assinaturas do boletim param até alguém reabrir.")) void salvar({ faixa: inicial.faixa, pausa: true, motivo }, "Envios pausados.");
                }}
              >
                Pausar os envios
              </Botao>
            )}
          </div>
          <Mudado m={mudancas.site_configurado} />
        </Cartao>

        <Emails />
        <ControlesDoChat mudanca={mudancas.chat_controlado} />
        <DicionarioDoInstituto mudanca={mudancas.dicionario_salvo} />
      </div>

      <CabecalhoDeSecao titulo="Assistente" simbolo={Bot} />
      <AssistenteDeReforco mudanca={mudancas.assistente_configurado} />
      <p className="pn-ajuda" style={{ maxWidth: "48rem" }}>
        As mudanças valem na hora. Tudo o que é mexido aqui fica no registro de atividades, com quem mudou e quando.
      </p>
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
      <ul className="space-y-1 text-sm">
        <li>
          Esperando para sair: <strong className="tabular-nums">{e.pendentes}</strong>
          {e.mais_antigo_esperando && <span className="text-ink-soft"> · desde {dataHora(e.mais_antigo_esperando)}</span>}.
        </li>
        <li>
          Enviados em sete dias: <strong className="tabular-nums">{e.enviados_7_dias}</strong>
          {e.ultimo_envio && <span className="text-ink-soft"> · o último em {dataHora(e.ultimo_envio)}</span>}.
        </li>
        <li>
          Que não saíram: <strong className="tabular-nums">{e.falhos_7_dias}</strong>
          {e.ultimo_erro && <span className="text-ink-soft"> · {errosDeEnvio[e.ultimo_erro] ?? e.ultimo_erro}</span>}.
        </li>
      </ul>
      {parado && <Faixa tom="erro">O envio não está funcionando. Confira a função “enviar-emails” e a chave do serviço (guia de manutenção).</Faixa>}
      <SaibaMais>
        <p>Confirmações de candidatura e de boletim, convites, avisos de decisão e as edições do boletim saem de minuto em minuto pela função do serviço de contas, com a rotina do GitHub de reserva. Para a entrega, veja Boletim → Configurar a entrega.</p>
      </SaibaMais>
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
    if (ligar && !(await confirmarFrase("Ligar o modo de segurança? Toda conversa e resposta nova na Comunidade passa a esperar leitura humana antes de aparecer."))) return;
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
      <p>
        {m.aprovacao_manual ? "Só aprovação manual: nada novo aparece sem leitura humana." : "Vale a avaliação automática."} Na fila: <strong className="tabular-nums">{m.esperando}</strong>.
      </p>
      <SaibaMais>
        <p>Não apaga o que já está no ar, não fecha a leitura nem o cadastro, e não muda o Mural dos Trabalhadores nem a triagem das contribuições.</p>
        <p>
          Segunda avaliação habilitada no banco: <strong>{m.habilitada ? "sim" : "não"}</strong>. Último teste: <strong>{v ? (v.ok ? "respondeu" : `falhou (${falhas[v.falha] ?? v.falha})`) : "nunca testado"}</strong>
          {v && ` · ${dataHora(v.em)}`}. Última mensagem real: <strong>{u ? (u.ok ? "avaliada" : `falha (${falhas[u.falha] ?? u.falha})`) : "nenhuma"}</strong>
          {u && ` · ${dataHora(u.em)}`}.
        </p>
      </SaibaMais>
      <div className="flex flex-wrap gap-2">
        <Botao perigo={!m.aprovacao_manual} disabled={ocupado} onClick={() => trocar(!m.aprovacao_manual)}>
          {m.aprovacao_manual ? "Desligar o modo de segurança" : "Ligar o modo de segurança"}
        </Botao>
        <Botao variante="discreto" disabled={ocupado} onClick={testar}>
          Testar a segunda avaliação
        </Botao>
      </div>
      <Recado texto={aviso} />
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
      <p>Aparelho parado há mais que o prazo precisa entrar de novo com a senha.</p>
      <div className="flex flex-wrap items-end gap-2">
        <Campo rotulo="Prazo em dias (7 a 365)" type="number" min={7} max={365} value={dias ?? String(atual)} onChange={(e) => setDias(e.target.value)} className="max-w-32" />
        <Botao
          disabled={acao.ocupado || dias === null}
          onClick={async () => {
            if (await acao.agir("seguranca_sessoes", { p_dias: Number(dias) }, "Prazo guardado ✓")) setDias(null);
          }}
        >
          Guardar
        </Botao>
      </div>
      <Recado texto={acao.aviso} />
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
    <Cartao id="assistente" titulo="Assistente de reforço (inteligência artificial)" alerta={Boolean(a.ligado && a.verificacao && !a.verificacao.ok)} selo={<Selo tipo={a.ligado ? (a.verificacao && !a.verificacao.ok ? "erro" : "ok") : "neutro"}>{a.ligado ? "ligado" : "desligado"}</Selo>}>
      <p>
        Ligado, a página de reforço e o resolvedor ganham “Pergunte ao assistente” para quem tem conta. Sempre avisa que é uma inteligência artificial.
        {a.ligado && a.interditado ? " Sem efeito agora: a aula de reforço está interditada." : ""}
      </p>
      <SaibaMais>
        <p>A pergunta e a foto vão para o provedor que responder; o site guarda só quantas perguntas cada pessoa fez em cada dia e qual provedor respondeu.</p>
        <p>Quando o provedor falha, a pergunta não é descontada da pessoa e vai para o próximo da lista.</p>
      </SaibaMais>
      <div>
        <Botao
          perigo={a.ligado}
          disabled={ocupado}
          onClick={async () => {
            if (a.ligado && !(await confirmarFrase("Desligar o assistente? O quadro some do site e as dúvidas voltam a ir só para os voluntários."))) return;
            if (!a.ligado && !(await confirmarFrase("Ligar o assistente? Provedores pagos (como o Claude) cobram por pergunta; os gratuitos têm limites por dia."))) return;
            void salvar({ ligado: !a.ligado }, a.ligado ? "Assistente desligado." : "Assistente ligado. Faça o teste abaixo.");
          }}
        >
          {a.ligado ? "Desligar o assistente" : "Ligar o assistente"}
        </Botao>
      </div>

      <h4 className="pn-rotulo-mono">Provedores, na ordem de tentativa</h4>
      <ol className="pn-lista pn-lista-plana text-sm">
        {lista.map((p, i) => {
          const info = PROVEDORES[p.id] ?? { nome: p.id, plano: "", segredo: "" };
          const v = verificados.get(p.id);
          const uso = a.uso_provedores?.[p.id];
          return (
            <li key={p.id} className="pn-item" style={{ flexWrap: "wrap", minHeight: "var(--pn-linha)", height: "auto", paddingBlock: "0.5rem" }}>
              <span className="w-6 text-center font-mono text-ink-soft tabular-nums">{i + 1}</span>
              <label className="pn-marca flex min-w-48 flex-1 cursor-pointer items-start gap-2">
                <input type="checkbox" className="mt-1" checked={p.ligado} disabled={ocupado} onChange={() => void salvar({ provedores: lista.map((x) => (x.id === p.id ? { ...x, ligado: !x.ligado } : x)) }, "Guardado ✓")} />
                <span>
                  <strong>{info.nome}</strong> <span className="text-xs text-ink-soft">· {info.plano}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                    {v ? (
                      v.chave ? (
                        v.ok ? (
                          <SeloDoPainel tom="ok" ponto>
                            respondeu no teste ({v.modelo})
                          </SeloDoPainel>
                        ) : (
                          <SeloDoPainel tom="erro" ponto>
                            {falhas[v.falha] ?? v.falha}
                          </SeloDoPainel>
                        )
                      ) : (
                        <span className="text-ink-soft">sem chave ({info.segredo} nos segredos da função)</span>
                      )
                    ) : (
                      <span className="text-ink-soft">ainda não testado</span>
                    )}
                    {uso ? (
                      <span className="text-ink-soft">
                        {" "}
                        · hoje: {uso.ok} respondidas, {uso.falhas} falhas
                      </span>
                    ) : null}
                  </span>
                </span>
              </label>
              <span className="flex gap-1">
                <Botao icone pequeno simbolo={ArrowUp} aria-label={`Subir ${info.nome}`} dica={`Subir ${info.nome}`} disabled={ocupado || i === 0} onClick={() => mover(i, -1)} />
                <Botao icone pequeno simbolo={ArrowDown} aria-label={`Descer ${info.nome}`} dica={`Descer ${info.nome}`} disabled={ocupado || i === lista.length - 1} onClick={() => mover(i, 1)} />
              </span>
            </li>
          );
        })}
      </ol>
      <p className="pn-ajuda">Só os marcados entram. As chaves ficam nos segredos da função “assistente” no serviço de contas (guia de manutenção); o painel nunca as vê.</p>

      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar({ por_pessoa: Number(campos.por_pessoa), por_dia: Number(campos.por_dia) }, "Limites guardados ✓");
        }}
      >
        <Campo rotulo="Perguntas por pessoa, por dia (1 a 100)" type="number" min={1} max={100} required value={campos.por_pessoa} onChange={(e) => setLimites({ ...campos, por_pessoa: e.target.value })} />
        <Campo rotulo="Teto do site inteiro, por dia (1 a 5.000)" type="number" min={1} max={5000} required value={campos.por_dia} onChange={(e) => setLimites({ ...campos, por_dia: e.target.value })} />
        <p className="sm:col-span-2">
          <Botao type="submit" disabled={ocupado || limites === null}>
            Guardar os limites
          </Botao>
        </p>
      </form>

      <ul className="space-y-1 text-sm">
        <li>
          Perguntas hoje: <strong className="tabular-nums">{a.hoje}</strong> de {a.por_dia}, de <strong className="tabular-nums">{a.pessoas_hoje}</strong> {a.pessoas_hoje === 1 ? "pessoa" : "pessoas"}. Em sete dias: <strong className="tabular-nums">{a.semana}</strong>.
        </li>
        <li>
          Última pergunta: <strong>{a.ultimo ? (a.ultimo.ok ? `respondida${a.ultimo.provedor ? ` por ${PROVEDORES[a.ultimo.provedor]?.nome ?? a.ultimo.provedor}` : ""}` : `com falha (${falhas[a.ultimo.falha] ?? (a.ultimo.falha || "sem detalhe")})`) : "nenhuma até agora"}</strong>
          {a.ultimo && <span className="text-ink-soft"> · {dataHora(a.ultimo.em)}</span>}.
        </li>
      </ul>
      <div>
        <Botao variante="discreto" disabled={ocupado} onClick={testar}>
          Testar agora cada provedor
        </Botao>
      </div>
      <Recado texto={aviso} />
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
        <SaibaMais>
          <p>Quem está barrado continua lendo, só não escreve. A coordenação, a coordenação pedagógica e a supervisão nunca são barradas.</p>
        </SaibaMais>
        {!dados.dados ? (
          <Esqueleto linhas={3} rotulo="Carregando…" />
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            <div className="pn-secao" style={{ alignContent: "start" }}>
              <h4 className="pn-rotulo-mono">
                <MessagesSquare aria-hidden className="mr-1 inline h-3.5 w-3.5" />
                Todas as conversas
              </h4>
              {!c.fechado && <Campo rotulo="Motivo (aparece para a equipe, opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} />}
              <div>
                <Botao
                  variante={c.fechado ? "principal" : "padrao"}
                  perigo={!c.fechado}
                  disabled={acao.ocupado}
                  onClick={async () => {
                    if (!c.fechado && !(await confirmarFrase("Fechar todas as conversas da equipe? Ninguém (fora a liderança) escreve até reabrir."))) return;
                    void salvar(c.fechado ? { fechado: false, motivo: "" } : { fechado: true, motivo }, c.fechado ? "Conversas reabertas ✓" : "Conversas fechadas.");
                  }}
                >
                  {c.fechado ? "Reabrir as conversas" : "Fechar todas as conversas"}
                </Botao>
              </div>
            </div>
            <div className="pn-secao" style={{ alignContent: "start" }}>
              <h4 className="pn-rotulo-mono">Grupos fechados</h4>
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {dados.dados.grupos.map((g) => {
                  const fechado = c.grupos_fechados.includes(g.id);
                  return (
                    <li key={g.id}>
                      <Marca
                        rotulo={`${g.nome} · ${g.tipo === "departamento" ? "departamento" : "grupo"} · ${g.membros}`}
                        checked={fechado}
                        disabled={acao.ocupado}
                        onChange={() => salvar({ grupos_fechados: fechado ? c.grupos_fechados.filter((id) => id !== g.id) : [...c.grupos_fechados, g.id] }, fechado ? "Grupo reaberto ✓" : "Grupo fechado.")}
                      />
                    </li>
                  );
                })}
                {dados.dados.grupos.length === 0 && <li className="text-ink-soft">Nenhum grupo ainda.</li>}
              </ul>
            </div>
            <div className="pn-secao" style={{ alignContent: "start" }}>
              <h4 className="pn-rotulo-mono">Pessoas silenciadas</h4>
              <Busca rotulo="Procurar pessoa" valor={busca} aoMudar={setBusca} placeholder="Procurar pelo nome" />
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {pessoas.map((p) => {
                  const calada = c.silenciados.includes(p.id);
                  return (
                    <li key={p.id}>
                      <Marca rotulo={p.nome} checked={calada} disabled={acao.ocupado} onChange={() => salvar({ silenciados: calada ? c.silenciados.filter((id) => id !== p.id) : [...c.silenciados, p.id] }, calada ? "Pessoa pode escrever de novo ✓" : "Pessoa silenciada.")} />
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
        <Recado texto={acao.aviso} />
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
        <p>
          <SpellCheck2 aria-hidden className="mr-1 inline h-4 w-4 text-ink-soft" />
          Uma palavra por linha: o conferidor de ortografia dos editores deixa de apontar estas palavras.
        </p>
        <Area rotulo="Termos do dicionário" value={atual} onChange={(e) => setTexto(e.target.value)} rows={8} className="font-mono" spellCheck={false} />
        <div>
          <Botao
            disabled={acao.ocupado || texto === null}
            onClick={async () => {
              if (
                await acao.agir(
                  "dicionario_salvar",
                  {
                    p_termos: atual
                      .split(/\n+/)
                      .map((x) => x.trim())
                      .filter(Boolean),
                  },
                  "Dicionário guardado ✓",
                )
              )
                setTexto(null);
            }}
          >
            Guardar
          </Botao>
        </div>
        {termos.erro && (
          <Faixa
            tom="erro"
            acao={
              <Botao pequeno onClick={termos.recarregar}>
                Tentar de novo
              </Botao>
            }
          >
            {termos.erro}
          </Faixa>
        )}
        <Recado texto={acao.aviso} />
        <Mudado m={mudanca} />
      </Cartao>
    </div>
  );
}
