// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { abrirSessao, agendarTexto, aoChegarNoChat, cancelarAgendada, apagarConversa, apagarMensagem, confiarNaIdentidade, editarMensagem, encaminharTexto, destravarHistorico, lerOrganizacao, mudarOrganizacao, ORGANIZACAO_VAZIA, type OrganizacaoDaConversa, depoisDeBuraco, enviarTexto, type Eu, type MensagemAberta, mensagensDaConversa, ordemDaConversa, type Sessao } from "@/lib/rede/chat-chaveiro";
import { codigoDeSeguranca, MAX_CARACTERES, metadeDoCodigo, textoCabe } from "@/lib/rede/chat-privado";
import { aoApagarTudoDoChat } from "@/lib/rede/chat/gaveta";
import { codigoComMetadeEscondida, conferirMetadeDe, conferirQr, metadeDaOutraPessoa } from "@/lib/rede/chat/verificacao";
import { chat, type ConversaDoChat, PREVIA_DO_CHAT, type Prazo } from "@/lib/rede/cliente-chat";
import type { ProvaDeFranquia } from "@/lib/rede/franquia/protocolo";
import { provaDeExemplo } from "@/lib/rede/franquia/previa";
import { carregarTextosMod, type TextosDaModeracao } from "@/lib/rede/textos-moderacao";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDoChat } from "@/lib/rede/textos-chat";
import type { ImagemDePerfil } from "@/lib/rede/tipos-perfil";
import { codigoEmGrupos } from "@/lib/sigilo";
import Link from "@/components/Link";
import { enderecos } from "@/lib/rede/tipos";
import { Avatar } from "../perfil/Avatar";
import { botaoForte, botaoLeve, botaoPerigo, erroDoChat } from "./comum";
import { Confirmar, type PedidoDeConfirmacao } from "./Confirmar";
import { MenuDaMensagem, type ItemDoMenu } from "./MenuDaMensagem";
import { DenunciaComProva } from "../franquia/DenunciaComProva";
import { Denuncia } from "./Denuncia";
import { LeitorDeQr, QrDoCodigo, temCamera } from "./Qr";
import { ligado } from "@/lib/recursos";
import { carregarTextosDoAnexo, type TextosDoAnexo } from "@/lib/rede/textos-chat-anexo";
import { AnexoNaMensagem, AnexoNoCompositor } from "./AnexoCifrado";
import { carregarTextosDaConversaP4, type TextosDaConversaP4 } from "@/lib/rede/textos-p4-conversa";
import { Encaminhar, MarcaDeEncaminhada } from "./Encaminhar";
import { AgendarEnvio } from "./AgendarEnvio";
import { PosicaoNaMensagem } from "../perto/PosicaoNaMensagem";
import { AvisoDeAtendimento } from "../conta/AbaAtendimento";
import { RespostasNoChat } from "../conta/RespostasRapidas";
import { ReleiaNoChat } from "../conta/NoChat";
import { BotoesDaChamada } from "../chamada/BotoesDaChamada";

const PRAZOS: Prazo[] = [1, 7, 30];
const INTERVALO = 8000;

/** "some em 3 dias", no idioma da pessoa. */
function quandoSome(lang: string, expira: string): string {
  const ms = Date.parse(expira) - Date.now();
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  const horas = ms / 3_600_000;
  return horas < 1 ? rtf.format(Math.max(1, Math.round(ms / 60_000)), "minute") : horas < 48 ? rtf.format(Math.round(horas), "hour") : rtf.format(Math.round(horas / 24), "day");
}

/** Os sessenta números em doze grupos, com largura fixa para comparar de olho. */
function Grupos({ grupos, rotulo }: { grupos: string[]; rotulo: string }) {
  return (
    <p className="max-w-[15rem] font-mono text-base leading-relaxed tracking-wide" aria-label={rotulo}>
      {/* O espaço entre os grupos: leitor de tela e "copiar" recebem grupos de cinco, não sessenta números colados. */}
      {grupos.map((grupo, i) => (
        <Fragment key={i}>
          <span className="inline-block w-[4.4rem]">{grupo}</span>{i < grupos.length - 1 ? " " : ""}
        </Fragment>
      ))}
    </p>
  );
}

/**
 * A identidade de alguém que estava VERIFICADA mudou: um clique não basta. A tela só segue se a pessoa comparar de verdade:
 * lendo o QR da outra com a câmera, ou digitando os seis grupos que a tela da OUTRA pessoa marca como "seus" (a metade que vem
 * da identidade dela), conferidos contra a metade calculada da identidade nova (`metadeDaNova`), em qualquer posição. Nem a minha
 * metade nem "os grupos X a Y da tela dela" servem: os dois conferem com uma identidade falsa (lib/rede/chat/verificacao.ts).
 */
function CompararDeNovo({ t, nome, codigo, minhaMetade, metadeDaNova, aoConferir }: { t: TextosDoChat; nome: string; codigo: string; minhaMetade: string; metadeDaNova: string; aoConferir: () => void }) {
  // Só para esconder na tela a metade que precisa ser ouvida; a conferência não depende da posição.
  const daOutra = metadeDaOutraPessoa(codigo, minhaMetade);
  const [digitado, setDigitado] = useState("");
  const [aviso, setAviso] = useState("");
  const [lendo, setLendo] = useState(false);
  const id = "alumia-chat-grupo-do-codigo";
  // A câmera só liga com o toque da pessoa.
  const lerQr = temCamera() && !lendo && <button type="button" onClick={() => { setAviso(""); setLendo(true); }} className={botaoLeve}>{t.acoes.qrLer}</button>;
  return (
    <div className="mt-3 space-y-3">
      {daOutra && <Grupos grupos={codigoComMetadeEscondida(codigo, daOutra.inicio)} rotulo={t.acoes.codigo} />}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (conferirMetadeDe(metadeDaNova, digitado)) aoConferir();
          else setAviso(t.conversa.grupoErrado);
        }}
      >
        <label htmlFor={id} className="w-full text-sm">{preencher(t.conversa.grupoPedido, { nome })}</label>
        <input
          id={id}
          value={codigoEmGrupos(digitado)}
          onChange={(e) => setDigitado(e.target.value.replace(/[^0-9]/g, "").slice(0, 30))}
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          aria-label={preencher(t.conversa.grupoRotulo, { nome })}
          className="min-h-11 w-full max-w-[22rem] rounded-md border border-rule bg-white px-3 font-mono tracking-wider text-[#1f1a14]"
        />
        <button type="submit" disabled={digitado.length !== 30} className={botaoLeve}>{t.conversa.grupoConferir}</button>
        {lerQr}
      </form>
      {lendo && (
        <LeitorDeQr
          t={t}
          fechar={() => setLendo(false)}
          aoLer={(texto) => {
            setLendo(false);
            const r = conferirQr(texto, codigo);
            if (r === "confere") aoConferir();
            else setAviso(r === "nao_confere" ? t.acoes.qrNaoConfere : t.acoes.qrOutro);
          }}
        />
      )}
      {aviso && <p role="alert" className="font-semibold">{aviso}</p>}
    </div>
  );
}

/** Uma conversa aberta: mensagens decifradas no aparelho, escrever, opções (prazo, código de segurança e QR, bloquear, denunciar, apagar). */
export function Conversa({ lang, t, s, eu, conversa, aoVoltar, aoApagar }: { lang: string; t: TextosDoChat; s: TextosDaRede; eu: Eu; conversa: ConversaDoChat; aoVoltar: () => void; aoApagar: () => void }) {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [mensagens, setMensagens] = useState<MensagemAberta[]>([]);
  const [temMais, setTemMais] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [opcoes, setOpcoes] = useState(false);
  const [prazo, setPrazo] = useState<Prazo>(conversa.prazo_dias);
  const [bloqueio, setBloqueio] = useState(conversa.bloqueio);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [codigoNovo, setCodigoNovo] = useState<{ identidade: string; codigo: string; minhaMetade: string; metadeDaNova: string } | null>(null);
  // Os seis grupos que vêm da MINHA identidade: o que eu dito quando a outra pessoa precisa comparar de novo.
  const [meusGrupos, setMeusGrupos] = useState<string | null>(null);
  const [lendoQr, setLendoQr] = useState(false);
  const [avisoDoCodigo, setAvisoDoCodigo] = useState("");
  const [denunciando, setDenunciando] = useState(false);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  // Os textos da moderação, só quando a pessoa abre a denúncia (a denúncia com prova usa os mesmos textos da denúncia de post).
  const [sm, setSm] = useState<TextosDaModeracao | null>(null);
  useEffect(() => {
    if (!denunciando || sm) return;
    let vivo = true;
    carregarTextosMod(lang).then((x) => vivo && setSm(x)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [denunciando, sm, lang]);
  // Temporária (minutos; null = o prazo da conversa), "ver uma vez", e as de ver uma vez já abertas nesta tela.
  const [temporaria, setTemporaria] = useState<number | null>(null);
  const [umaVez, setUmaVez] = useState(false);
  const [abertasUmaVez, setAbertasUmaVez] = useState<Set<string>>(new Set());
  // O histórico deste aparelho está travado com senha: a tela pede a senha antes de mostrar.
  const [travado, setTravado] = useState(false);
  const [senhaDaTrava, setSenhaDaTrava] = useState("");
  // A organização desta conversa (só neste aparelho) e o "até onde eu tinha lido" quando a conversa abriu.
  const [org, setOrg] = useState<OrganizacaoDaConversa>(ORGANIZACAO_VAZIA);
  const [lidaAoAbrir, setLidaAoAbrir] = useState<string | null>(null);
  // A janela de confirmação da Alumia (no lugar do confirm() do navegador), a mensagem sendo editada e as que estão saindo agora.
  const [confirmacao, setConfirmacao] = useState<PedidoDeConfirmacao | null>(null);
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);
  const [saindo, setSaindo] = useState<{ id: string; texto: string; quando: string }[]>([]);
  // Áudio e vídeo curto (Prompt 4, itens 137 e 138): os botões só com "alumia-p4-anexo-cifrado" ligado; os textos carregam quando
  // há botão ou anexo na conversa (um anexo recebido antes de desligar continua aparecendo, e o depósito responde que sumiu).
  const comAnexo = ligado("alumia-p4-anexo-cifrado");
  const [ta, setTa] = useState<TextosDoAnexo | null>(null);
  const precisaDosTextosDoAnexo = comAnexo || mensagens.some((m) => m.anexo !== undefined);
  useEffect(() => {
    if (!precisaDosTextosDoAnexo || ta) return;
    let vivo = true;
    carregarTextosDoAnexo(lang).then((x) => vivo && setTa(x)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [precisaDosTextosDoAnexo, ta, lang]);
  // O lote da conversa do Prompt 4 (itens 13 a 21), atrás de "alumia-p4-conversa": os textos só carregam com a flag ligada.
  const comConversaP4 = ligado("alumia-p4-conversa");
  // As chamadas de voz e de vídeo do Prompt 4 (itens 139 e 140), atrás de "alumia-p4-chamadas": só com o chat novo deste aparelho.
  const comChamadas = ligado("alumia-p4-chamadas") && !PREVIA_DO_CHAT;
  const [tc, setTc] = useState<TextosDaConversaP4 | null>(null);
  // Envio agendado (item 18): a janela da hora, aberta pelo botão do campo.
  const [agendando, setAgendando] = useState(false);
  useEffect(() => {
    if (!comConversaP4 || tc) return;
    let vivo = true;
    carregarTextosDaConversaP4(lang).then((x) => vivo && setTc(x)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [comConversaP4, tc, lang]);
  // O encaminhamento aberto (item 14): o texto, a contagem que ele traz e as outras conversas abertas deste aparelho.
  const [encaminhando, setEncaminhando] = useState<{ texto: string; contagem: number | undefined; conversas: ConversaDoChat[] } | null>(null);
  // A marca d'água da proteção contra print (item 13 com o item 1): o codinome de quem lê, neste aparelho.
  const minhaMarca = eu.chat?.estado.codinome ?? "";
  const campo = useRef<HTMLTextAreaElement>(null);
  const primeiraNaoLida = useRef<HTMLLIElement>(null);
  const fim = useRef<HTMLDivElement>(null);
  const sessaoRef = useRef<Sessao | null>(null);

  const juntar = useCallback((novas: MensagemAberta[]) => {
    setMensagens((atual) => {
      const porId = new Map(atual.map((m) => [m.id, m]));
      for (const m of novas) porId.set(m.id, m);
      return [...porId.values()].sort((a, b) => a.criado_em.localeCompare(b.criado_em));
    });
  }, []);

  const buscar = useCallback(
    async (atual: Sessao, substituir = false) => {
      // O histórico mora neste aparelho: busca a caixa selada, guarda o que chegou e lê daqui.
      const abertas = await mensagensDaConversa(atual);
      // A outra pessoa ainda não tinha mandado o aperto de mão: confere de novo (ele pode ter chegado agora).
      if (atual.aguardandoOutro) {
        const usada = await abrirSessao(eu, atual.conversa, atual.outro, atual);
        sessaoRef.current = usada;
        setSessao(usada);
      }
      if (substituir) {
        setMensagens([...abertas].sort((a, b) => a.criado_em.localeCompare(b.criado_em)));
        setTemMais(abertas.length >= 100);
      } else juntar(abertas);
    },
    [eu, juntar],
  );

  // Abre a sessão (identidade, chaves) e as mensagens; depois, a cada 8 s com a aba visível.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        if (bloqueio || !conversa.pode_escrever) {
          // Mesmo bloqueada, a pessoa pode apagar ou denunciar; ler, não (o servidor fecha).
          return;
        }
        const nova = await abrirSessao(eu, conversa.id, conversa.com.id);
        if (!vivo) return;
        sessaoRef.current = nova;
        setSessao(nova);
        const organizacao = await lerOrganizacao(eu.usuario, conversa.id).catch(() => ORGANIZACAO_VAZIA);
        if (!vivo) return;
        setOrg(organizacao);
        setLidaAoAbrir(organizacao.lidaAte || "");
        await buscar(nova, true);
      } catch (e) {
        if (!vivo) return;
        if ((e as { code?: string })?.code === "historico_travado") setTravado(true);
        else setErro(erroDoChat(t, s, e));
      }
    })();
    const id = window.setInterval(() => {
      const atual = sessaoRef.current;
      if (atual && document.visibilityState === "visible") void buscar(atual).catch(() => undefined);
    }, INTERVALO);
    return () => {
      vivo = false;
      window.clearInterval(id);
    };
  }, [eu, conversa.id, conversa.com.id, conversa.pode_escrever, bloqueio, buscar, t, s]);


  // A agenda das caixas acabou de buscar esta conversa (ou a sincronia): relê o histórico deste aparelho na hora, sem esperar a volta
  // da tela. Nada vai ao servidor por isso: o horário das buscas é o da agenda.
  useEffect(
    () =>
      aoChegarNoChat((qual) => {
        const atual = sessaoRef.current;
        if (atual && (qual === conversa.id || qual === "sincronia")) void buscar(atual).catch(() => undefined);
      }),
    [conversa.id, buscar],
  );

  // "Sair rápido": o rascunho e as mensagens abertas somem da memória desta tela na hora.
  useEffect(
    () =>
      aoApagarTudoDoChat(() => {
        sessaoRef.current = null;
        setSessao(null);
        setMensagens([]);
        setSaindo([]);
        setEditando(null);
        setTexto("");
        setCodigo(null);
        setCodigoNovo(null);
      }),
    [],
  );

  // A identidade de alguém verificado mudou: calcula o código com a identidade NOVA, para comparar de novo.
  const identidadeNova = sessao?.exigeComparar ? sessao.mudou : null;
  useEffect(() => {
    if (!identidadeNova) return;
    let vivo = true;
    void Promise.all([codigoDeSeguranca(eu.identidade.publica, identidadeNova), metadeDoCodigo(eu.identidade.publica), metadeDoCodigo(identidadeNova)])
      .then(([codigo, minhaMetade, metadeDaNova]) => vivo && setCodigoNovo({ identidade: identidadeNova, codigo, minhaMetade, metadeDaNova }))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [identidadeNova, eu.identidade.publica]);
  // Só vale o código calculado para a identidade que está na tela agora.
  const paraComparar = identidadeNova && codigoNovo?.identidade === identidadeNova ? codigoNovo : null;

  // "Até onde li": avança com o que está na tela (só neste aparelho; a outra pessoa nunca sabe).
  const ultimaDaOutra = mensagens.filter((m) => m.autor !== eu.usuario).reduce((maior, m) => (m.criado_em > maior ? m.criado_em : maior), "");
  useEffect(() => {
    if (!ultimaDaOutra || lidaAoAbrir === null) return;
    void mudarOrganizacao(eu.usuario, conversa.id, (o) => (ultimaDaOutra > o.lidaAte ? { ...o, lidaAte: ultimaDaOutra } : o)).then(setOrg, () => undefined);
  }, [ultimaDaOutra, lidaAoAbrir, eu.usuario, conversa.id]);
  const idDaPrimeiraNaoLida = lidaAoAbrir === null ? null : (mensagens.find((m) => m.autor !== eu.usuario && m.criado_em > lidaAoAbrir)?.id ?? null);
  useEffect(() => {
    if (idDaPrimeiraNaoLida) primeiraNaoLida.current?.scrollIntoView({ block: "center" });
  }, [idDaPrimeiraNaoLida]);
  useEffect(() => {
    if (!denunciando && !idDaPrimeiraNaoLida) fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length, denunciando, idDaPrimeiraNaoLida]);

  async function organizar(mudar: (o: OrganizacaoDaConversa) => OrganizacaoDaConversa) {
    try {
      setOrg(await mudarOrganizacao(eu.usuario, conversa.id, mudar));
    } catch (e) {
      setErro(erroDoChat(t, s, e));
    }
  }

  const faltas = useMemo(() => depoisDeBuraco(mensagens), [mensagens]);
  // Dentro de cada pessoa, a ordem em que ela escreveu (o servidor não consegue mexer nela); a hora do servidor só intercala.
  const ordem = useMemo(() => ordemDaConversa(mensagens, eu.usuario), [mensagens, eu.usuario]);

  async function carregarMais() {
    const atual = sessaoRef.current;
    if (!atual || !mensagens.length) return;
    try {
      const lista = await mensagensDaConversa(atual, mensagens[0].criado_em);
      juntar(lista);
      setTemMais(lista.length >= 100);
    } catch (e) {
      setErro(erroDoChat(t, s, e));
    }
  }

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    const atual = sessaoRef.current;
    if (!atual || !textoCabe(texto)) return;
    if (editando) return salvarEdicao(atual);
    // A mensagem aparece na hora, marcada "saindo…", e o campo fica livre: com o ritmo da R3, ela pode esperar até 30 s pelo
    // instante dela (lib/rede/caixas/ritmo.ts). As de uma conversa saem uma por vez, na ordem (a fila do chat).
    const escrito = texto;
    const opcoesDaVez = { prazoDias: prazo, minutos: temporaria, umaVez };
    const saida = { id: `saindo-${crypto.randomUUID()}`, texto: escrito, quando: new Date().toISOString() };
    setSaindo((l) => [...l, saida]);
    setTexto("");
    setUmaVez(false);
    setErro("");
    try {
      const usada = await enviarTexto(atual, escrito, opcoesDaVez);
      if (usada !== atual) {
        sessaoRef.current = usada;
        setSessao(usada);
      }
      await buscar(usada);
    } catch (erroDoEnvio) {
      setErro(erroDoChat(t, s, erroDoEnvio));
      // Não saiu: o texto volta para o campo (se a pessoa ainda não começou outro), para não se perder.
      setTexto((agora) => (agora ? agora : escrito));
    } finally {
      setSaindo((l) => l.filter((x) => x.id !== saida.id));
    }
  }

  /** Agenda o texto do campo (item 18): fica só neste aparelho até a hora; o campo se esvazia. */
  async function agendar(quando: number) {
    const atual = sessaoRef.current;
    if (!atual || !textoCabe(texto)) return;
    await agendarTexto(atual, texto, new Date(quando));
    setTexto("");
    setErro("");
    await buscar(atual, true);
  }

  async function desistirDaAgendada(m: MensagemAberta) {
    const atual = sessaoRef.current;
    if (!atual) return;
    try {
      await cancelarAgendada(atual, m.id);
      setMensagens((l) => l.filter((x) => x.id !== m.id));
    } catch (e) {
      setErro(erroDoChat(t, s, e));
    }
  }

  async function salvarEdicao(atual: Sessao) {
    if (!editando || ocupado) return;
    const novo = texto.trim();
    if (novo === editando.texto.trim()) {
      setEditando(null);
      setTexto("");
      return;
    }
    setOcupado(true);
    setErro("");
    try {
      await editarMensagem(atual, editando.id, novo);
      setEditando(null);
      setTexto("");
      await buscar(atual, true);
    } catch (erroDaEdicao) {
      setErro(erroDoChat(t, s, erroDaEdicao));
    } finally {
      setOcupado(false);
    }
  }

  function comecarEdicao(m: MensagemAberta) {
    setEditando({ id: m.id, texto: m.texto ?? "" });
    setTexto(m.texto ?? "");
    requestAnimationFrame(() => campo.current?.focus());
  }

  function cancelarEdicao() {
    setEditando(null);
    setTexto("");
  }

  /**
   * Aceita a identidade nova. `comparou`: leu o QR ou digitou os números certos (obrigatório se a conversa estava verificada).
   * `identidade`: aquela para a qual o código comparado foi calculado; se o servidor trocou de novo no meio, o chaveiro recusa.
   */
  async function confiar(comparou: boolean, identidade?: string) {
    const atual = sessaoRef.current;
    if (!atual?.mudou) return;
    try {
      await confiarNaIdentidade(atual, identidade ?? atual.mudou, comparou);
      const nova = await abrirSessao(eu, conversa.id, conversa.com.id, atual);
      sessaoRef.current = nova;
      setSessao(nova);
      setCodigo(null);
      await buscar(nova, true);
    } catch (e) {
      setErro(erroDoChat(t, s, e));
    }
  }

  async function mostrarCodigo() {
    const atual = sessaoRef.current;
    const outra = atual?.confiadas[conversa.com.id];
    if (!atual || !outra) return;
    setAvisoDoCodigo("");
    const [doPar, meus] = await Promise.all([codigoDeSeguranca(eu.identidade.publica, outra), metadeDoCodigo(eu.identidade.publica)]);
    setCodigo(doPar);
    setMeusGrupos(meus);
  }

  async function marcarVerificado() {
    const atual = sessaoRef.current;
    const outra = atual?.confiadas[conversa.com.id];
    if (!atual || !outra) return;
    await confiarNaIdentidade(atual, outra, true);
    const nova = { ...atual, verificado: true };
    sessaoRef.current = nova;
    setSessao(nova);
  }

  /** Faz uma ação da conversa. Com `confirmar`, pergunta antes na janela da Alumia (o confirm() do navegador saiu). */
  async function agir(fazer: () => Promise<unknown>, confirmar?: { pergunta: string; sim: string }) {
    if (ocupado) return;
    if (confirmar) {
      setConfirmacao({ ...confirmar, fazer: () => void agir(fazer) });
      return;
    }
    setOcupado(true);
    setErro("");
    try {
      await fazer();
    } catch (e) {
      setErro(erroDoChat(t, s, e));
    } finally {
      setOcupado(false);
    }
  }

  /** O que o menu de uma mensagem oferece. Lembrar: qualquer uma com texto. Editar e apagar para todos: só as minhas. */
  function itensDaMensagem(m: MensagemAberta, minha: boolean): ItemDoMenu[] {
    const itens: ItemDoMenu[] = [];
    if (m.texto === null) return [{ rotulo: t.conversa.apagarParaMim, perigo: true, fazer: () => apagarDaTela(m, "aqui") }];
    // Anexo e pedido de ajuda (Prompt 4, item 7): sem editar nem lembrar (não há texto); apagar para mim, e para todos se for meu.
    if (m.anexo !== undefined || m.posicao !== undefined) {
      itens.push({ rotulo: t.conversa.apagarParaMim, perigo: true, fazer: () => apagarDaTela(m, "aqui") });
      if (minha) itens.push({ rotulo: t.conversa.apagarParaTodos, perigo: true, fazer: () => apagarDaTela(m, "todos") });
      return itens;
    }
    // Agendada (item 18): ainda não saiu deste aparelho; só dá para desistir.
    if (m.agendada) {
      if (tc) itens.push({ rotulo: tc.agendar.desistir, perigo: true, fazer: () => desistirDaAgendada(m) });
      return itens;
    }
    if (minha && !m.umaVez) itens.push({ rotulo: t.conversa.editar, fazer: () => comecarEdicao(m) });
    // Encaminhar (item 14): só texto que não é de ver uma vez nem está na fila; a lista é a das conversas abertas deste aparelho.
    if (tc && !m.umaVez && !m.pendente && m.texto) {
      const textoDaMensagem = m.texto;
      itens.push({
        rotulo: tc.encaminhar.acao,
        fazer: () =>
          void chat
            .conversas()
            .then((todas) => setEncaminhando({ texto: textoDaMensagem, contagem: m.encaminhada, conversas: todas.filter((c) => c.id !== conversa.id && c.situacao === "aberta" && c.pode_escrever) }))
            .catch((e) => setErro(erroDoChat(t, s, e))),
      });
    }
    if (!m.umaVez) {
      itens.push({
        rotulo: t.organizar.lembrar,
        fazer: () => void organizar((o) => ({ ...o, lembretes: [...o.lembretes, { id: crypto.randomUUID(), quando: new Date(Date.now() + 3_600_000).toISOString(), trecho: (m.texto ?? "").slice(0, 140) }] })),
      });
    }
    itens.push({ rotulo: t.conversa.apagarParaMim, perigo: true, fazer: () => apagarDaTela(m, "aqui") });
    if (minha) itens.push({ rotulo: t.conversa.apagarParaTodos, perigo: true, fazer: () => apagarDaTela(m, "todos") });
    return itens;
  }

  function apagarDaTela(m: MensagemAberta, modo: "todos" | "aqui") {
    void agir(
      async () => {
        if (sessaoRef.current) await apagarMensagem(sessaoRef.current, m.id, modo);
        setMensagens((atual) => atual.filter((x) => x.id !== m.id));
        if (editando?.id === m.id) cancelarEdicao();
      },
      { pergunta: modo === "todos" ? t.conversa.apagarMensagemConfirma : t.conversa.apagarParaMimConfirma, sim: t.conversa.apagarSim },
    );
  }

  const restam = MAX_CARACTERES - [...texto].length;
  // A denúncia com prova é de texto: o anexo não entra (a prova dele exigiria entregar a chave do arquivo à moderação).
  const doOutro = mensagens.filter((m) => m.autor !== eu.usuario && m.texto !== null && !m.repetida && m.anexo === undefined && m.posicao === undefined);
  // A denúncia com prova (onda R2): a mensagem do chat novo traz a prova da franquia (contrato da conversa a dois: o campo `prova`,
  // montado com provaDoPacote ao abrir). Na prévia, uma prova de exemplo. Sem prova em nenhuma, a denúncia de antes.
  const provaDe = (m: MensagemAberta): ProvaDeFranquia | null =>
    m.prova ?? (PREVIA_DO_CHAT && m.texto ? provaDeExemplo(m.id, m.texto) : null);
  const comProva = doOutro.some((m) => provaDe(m) !== null);

  return (
    <div className="flex min-h-[70vh] flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-rule bg-parchment px-[18px] py-3">
        <button type="button" onClick={aoVoltar} className="min-h-11 min-w-11 rounded-full hover:bg-parchment-deep" aria-label={t.conversa.voltar}>
          <svg aria-hidden viewBox="0 0 24 24" className="mx-auto h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        {/* A foto e o nome abrem o perfil da pessoa (antes não havia como chegar ao perfil pela conversa). Sem @nome, sem link. */}
        {conversa.com.handle ? (
          <Link href={enderecos.perfil(lang, conversa.com.handle)} className="shrink-0 rounded-full" aria-hidden tabIndex={-1}>
            <Avatar usuario={conversa.com.id} imagem={conversa.com.avatar as ImagemDePerfil | null} codinome={conversa.com.codinome} tamanho={40} />
          </Link>
        ) : (
          <Avatar usuario={conversa.com.id} imagem={conversa.com.avatar as ImagemDePerfil | null} codinome={conversa.com.codinome} tamanho={40} />
        )}
        <div className="min-w-0 flex-1">
          {conversa.com.handle ? (
            <Link href={enderecos.perfil(lang, conversa.com.handle)} className="block truncate font-semibold hover:underline">
              {conversa.com.codinome}
            </Link>
          ) : (
            <p className="truncate font-semibold">{conversa.com.codinome}</p>
          )}
          <p className="flex items-center gap-1 truncate text-xs text-ink-soft">
            <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 11V8a6 6 0 1 1 12 0v3M5 11h14v10H5z" />
            </svg>
            {conversa.com.handle ? `@${conversa.com.handle}` : ""}
            {sessao?.verificado ? ` · ${t.acoes.jaVerificado}` : ""}
          </p>
          {/* Não verificada fica visível (depois do "Sair rápido", todas as verificações se perdem) e leva direto ao código. */}
          {sessao && !sessao.verificado && !sessao.mudou && !sessao.semChaveDoOutro ? (
            <button
              type="button"
              onClick={() => {
                setOpcoes(true);
                void mostrarCodigo();
              }}
              title={t.acoes.verificarAgora}
              className="-my-2 flex min-h-9 max-w-full items-center gap-1 text-left text-xs font-semibold text-[#8a4b00] dark:text-[#f2b33d]"
            >
              <span aria-hidden>!</span>
              <span className="truncate underline decoration-dotted underline-offset-2">{t.acoes.naoVerificado}</span>
              <span className="sr-only">: {t.acoes.verificarAgora}</span>
            </button>
          ) : null}
        </div>
        {comChamadas && sessao?.eu.chat && (
          <BotoesDaChamada
            lang={lang}
            conversa={conversa.id}
            nome={conversa.com.codinome}
            pronta={!sessao.mudou && !sessao.foraDoRegistro && !sessao.aguardandoOutro && !sessao.semChaveDoOutro && !!conversa.pode_escrever}
          />
        )}
        {/* No celular, só o ícone (o nome da pessoa e o "Não verificada" precisam do espaço); o nome do botão fica para o leitor de tela. */}
        <button type="button" onClick={() => setOpcoes((x) => !x)} aria-expanded={opcoes} aria-label={t.acoes.rotulo} title={t.acoes.rotulo} className={`${botaoLeve} shrink-0 max-sm:min-w-11 max-sm:px-0`}>
          <svg aria-hidden viewBox="0 0 24 24" className="mx-auto h-5 w-5 sm:hidden" fill="currentColor">
            <circle cx="12" cy="5" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="12" cy="19" r="1.8" />
          </svg>
          <span className="max-sm:hidden">{t.acoes.rotulo}</span>
        </button>
      </header>

      {opcoes && (
        <div className="space-y-4 border-b border-rule bg-parchment-deep px-[18px] py-4 text-sm">
          <label className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{t.acoes.prazo}</span>
            <select
              value={prazo}
              disabled={ocupado}
              onChange={(e) => {
                const dias = Number(e.target.value) as Prazo;
                void agir(async () => {
                  await chat.prazo(conversa.id, dias);
                  setPrazo(dias);
                  if (sessaoRef.current) await buscar(sessaoRef.current, true);
                });
              }}
              className="min-h-11 rounded-md border border-rule bg-parchment px-2"
            >
              {PRAZOS.map((d) => (
                <option key={d} value={d}>{d === 1 ? t.acoes.dia : preencher(t.acoes.dias, { n: d })}</option>
              ))}
            </select>
            <span className="text-xs text-ink-soft">{t.acoes.prazoExplica}</span>
          </label>

          {sessao && !sessao.semChaveDoOutro && !sessao.mudou && (
            <div>
              <button type="button" onClick={() => void mostrarCodigo()} className={botaoLeve}>{t.acoes.codigo}</button>
              {codigo && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-ink-soft">{t.acoes.codigoExplica}</p>
                  <div className="flex flex-wrap items-start gap-4">
                    <QrDoCodigo codigo={codigo} rotulo={t.acoes.qrRotulo} />
                    <Grupos grupos={codigoEmGrupos(codigo).split(" ")} rotulo={t.acoes.codigo} />
                  </div>
                  {sessao?.carimbo && <p className="text-xs text-ink-soft">{preencher(t.registro.carimbo, { carimbo: sessao.carimbo })}</p>}
                  {meusGrupos && (
                    <div>
                      <p className="text-xs text-ink-soft">{t.acoes.meusGrupos}</p>
                      <Grupos grupos={codigoEmGrupos(meusGrupos).split(" ")} rotulo={t.acoes.meusGrupos} />
                    </div>
                  )}
                  {lendoQr && (
                    <LeitorDeQr
                      t={t}
                      fechar={() => setLendoQr(false)}
                      aoLer={(texto) => {
                        setLendoQr(false);
                        const r = conferirQr(texto, codigo);
                        if (r === "confere") void marcarVerificado().then(() => setAvisoDoCodigo(t.acoes.qrConfere)).catch(() => undefined);
                        else setAvisoDoCodigo(r === "nao_confere" ? t.acoes.qrNaoConfere : t.acoes.qrOutro);
                      }}
                    />
                  )}
                  {avisoDoCodigo && <p role="status" className="font-semibold">{avisoDoCodigo}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    {temCamera() && !lendoQr && (
                      <button type="button" onClick={() => { setAvisoDoCodigo(""); setLendoQr(true); }} className={botaoLeve}>{t.acoes.qrLer}</button>
                    )}
                    {sessao.verificado ? (
                      <p className="text-xs font-semibold">{t.acoes.jaVerificado}</p>
                    ) : (
                      <button type="button" onClick={() => void marcarVerificado()} className={botaoLeve}>{t.acoes.verificado}</button>
                    )}
                  </div>
                  <p className="text-xs text-ink-soft">{t.acoes.negavel}</p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3 border-b border-rule pb-4 text-sm">
            <p className="text-xs text-ink-soft">{t.organizar.soAqui}</p>
            <label className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{t.organizar.pasta}</span>
              <input value={org.pasta} maxLength={30} onChange={(e) => setOrg({ ...org, pasta: e.target.value })} onBlur={() => void organizar((o) => ({ ...o, pasta: org.pasta }))} className="min-h-10 rounded-md border border-rule bg-parchment px-2" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-semibold">{t.organizar.nota}</span>
              <textarea value={org.nota} maxLength={2000} rows={3} onChange={(e) => setOrg({ ...org, nota: e.target.value })} onBlur={() => void organizar((o) => ({ ...o, nota: org.nota }))} className="rounded-md border border-rule bg-parchment px-2 py-1" />
            </label>
            <label className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{t.organizar.soneca}</span>
              <select
                value=""
                onChange={(e) => {
                  const horas = Number(e.target.value);
                  void organizar((o) => ({ ...o, sonecaAte: horas > 0 ? new Date(Date.now() + horas * 3_600_000).toISOString() : "" }));
                }}
                className="min-h-10 rounded-md border border-rule bg-parchment px-2"
              >
                <option value="" disabled>{org.sonecaAte > new Date().toISOString() ? preencher(t.organizar.silenciadaAte, { quando: new Date(org.sonecaAte).toLocaleString(lang, { dateStyle: "short", timeStyle: "short" }) }) : t.organizar.escolha}</option>
                <option value="1">{t.organizar.umaHora}</option>
                <option value="8">{t.organizar.oitoHoras}</option>
                <option value="24">{t.organizar.umDia}</option>
                <option value="168">{t.organizar.umaSemana}</option>
                <option value="0">{t.organizar.desligar}</option>
              </select>
            </label>
            {org.lembretes.length > 0 && (
              <div>
                <p className="font-semibold">{t.organizar.lembretes}</p>
                <ul className="mt-1 space-y-1">
                  {org.lembretes.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center gap-2">
                      <span>{new Date(l.quando).toLocaleString(lang, { dateStyle: "short", timeStyle: "short" })}: “{l.trecho}”</span>
                      <button type="button" className="inline-flex min-h-11 items-center underline" onClick={() => void organizar((o) => ({ ...o, lembretes: o.lembretes.filter((x) => x.id !== l.id) }))}>{t.organizar.dispensar}</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={ocupado}
              onClick={() =>
                void agir(async () => {
                  // Bloquear troca o passe das minhas caixas desta conversa, sem avisar: o que a pessoa mandar cai fora. O servidor
                  // não fica sabendo quem bloqueou quem.
                  await chat.bloquear(conversa.com.id, !bloqueio);
                  setBloqueio(!bloqueio);
                }, bloqueio ? undefined : { pergunta: t.acoes.bloquearConfirma, sim: t.acoes.bloquear })
              }
              className={botaoLeve}
            >
              {bloqueio ? t.acoes.desbloquear : t.acoes.bloquear}
            </button>
            <button type="button" disabled={ocupado} onClick={() => { setDenunciando(true); setOpcoes(false); }} className={botaoLeve}>
              {t.acoes.denunciar}
            </button>
            <button type="button" disabled={ocupado} onClick={() => void agir(async () => { await apagarConversa(sessaoRef.current, eu, conversa.id); aoApagar(); }, { pergunta: t.acoes.apagarConfirma, sim: t.conversa.apagarSim })} className={botaoPerigo}>
              {t.acoes.apagar}
            </button>
          </div>
        </div>
      )}

      {encaminhando && tc && (
        <Encaminhar
          t={tc.encaminhar}
          conversas={encaminhando.conversas}
          contagem={encaminhando.contagem}
          aoEncaminhar={(ids) => encaminharTexto(eu, ids, encaminhando.texto, encaminhando.contagem)}
          aoFechar={() => setEncaminhando(null)}
        />
      )}
      {denunciando && comProva && sm && (
        <div className="border-b border-rule px-[18px] py-4">
          <DenunciaComProva
            s={s}
            sm={sm}
            autor={{ handle: conversa.com.handle ?? "", nome: conversa.com.codinome }}
            mensagens={doOutro.map((m) => ({ id: m.id, texto: m.texto as string, quando: new Date(m.criado_em).toLocaleString(lang, { dateStyle: "short", timeStyle: "short" }), prova: provaDe(m) }))}
            aoDenunciar={async (p) => {
              if (PREVIA_DO_CHAT) return { protocolo: "EXEMPLO-2611" };
              const { denunciarComProva } = await import("@/lib/rede/franquia/cliente");
              return denunciarComProva({ ...p, autor: conversa.com.handle ?? "" });
            }}
            aoFechar={() => {
              setDenunciando(false);
              setMarcadas(new Set());
            }}
          />
        </div>
      )}
      {denunciando && !comProva && (
        <Denuncia
          t={t}
          s={s}
          conversa={conversa.id}
          trechos={doOutro.filter((m) => marcadas.has(m.id)).map((m) => m.texto as string)}
          aoFechar={(bloqueou) => {
            setDenunciando(false);
            setMarcadas(new Set());
            if (bloqueou) setBloqueio(true);
          }}
        />
      )}

      {sessao?.mudou && (
        <div role="alert" className="border-b border-rule bg-[#fff4d6] px-[18px] py-3 text-sm text-[#1f1a14]">
          {sessao.exigeComparar ? (
            <>
              <p className="font-semibold">{preencher(t.conversa.mudouVerificada, { nome: conversa.com.codinome })}</p>
              {paraComparar && <CompararDeNovo t={t} nome={conversa.com.codinome} codigo={paraComparar.codigo} minhaMetade={paraComparar.minhaMetade} metadeDaNova={paraComparar.metadeDaNova} aoConferir={() => void confiar(true, paraComparar.identidade)} />}
            </>
          ) : (
            <>
              <p>{preencher(t.conversa.mudou, { nome: conversa.com.codinome })}</p>
              <button type="button" onClick={() => void confiar(false)} className={`${botaoLeve} mt-2`}>{t.conversa.confirmar}</button>
            </>
          )}
        </div>
      )}
      {erro && <p role="alert" className="border-b border-rule px-[18px] py-3 text-sm text-oxblood">{erro}</p>}

      <div className="flex-1 space-y-2 px-[18px] py-4" aria-live="polite" aria-relevant="additions">
        {bloqueio || !conversa.pode_escrever ? (
          <p className="text-ink-soft">{t.conversa.bloqueada}</p>
        ) : !sessao ? (
          <p className="text-ink-soft">{t.conversa.aguarde}</p>
        ) : (
          <>
            {temMais && (
              <button type="button" onClick={() => void carregarMais()} className={`${botaoLeve} mx-auto block`}>{t.conversa.carregarMais}</button>
            )}
            {sessao.semChaveDoOutro && <p className="text-sm text-ink-soft">{t.conversa.semChaveDoOutro}</p>}
            {!sessao.semChaveDoOutro && sessao.aguardandoOutro && !sessao.foraDoRegistro && (
              <p role="status" className="rounded-xl border border-rule bg-parchment-deep p-3 text-sm">
                {preencher(sessao.naFila ? t.conversa.filaAviso : t.conversa.pedidoSemResposta, { nome: conversa.com.codinome })}
              </p>
            )}
            {sessao.foraDoRegistro && <p role="alert" className="rounded-xl border border-oxblood p-3 text-sm font-semibold text-oxblood">{t.registro[sessao.foraDoRegistro]}</p>}
            {travado && (
              <form
                className="flex flex-wrap items-end gap-2 rounded-xl border border-rule p-3 text-sm"
                onSubmit={(e) => {
                  e.preventDefault();
                  void agir(async () => {
                    await destravarHistorico(eu.usuario, senhaDaTrava);
                    setSenhaDaTrava("");
                    setTravado(false);
                    await buscar(sessao, true);
                  });
                }}
              >
                <p className="w-full font-semibold">{t.selado.travado}</p>
                <label className="flex flex-col gap-1">
                  <span>{t.selado.senhaDaTrava}</span>
                  <input type="password" autoComplete="current-password" value={senhaDaTrava} onChange={(e) => setSenhaDaTrava(e.target.value)} className="min-h-11 rounded-md border border-rule bg-parchment px-2" />
                </label>
                <button type="submit" disabled={ocupado} className={botaoForte}>{t.selado.destravar}</button>
              </form>
            )}
            {mensagens.length === 0 && saindo.length === 0 && <p className="text-sm text-ink-soft">{t.conversa.vazio}</p>}
            <ul className="space-y-2">
              {ordem.ordenadas.map((m) => {
                const minha = m.autor === eu.usuario;
                // Repetida: este aparelho já tinha esta mesma mensagem. Fica só uma linha discreta, sem o texto.
                if (m.repetida) return <li key={m.id} className="text-center text-[11px] italic text-ink-soft">{t.conversa.repetida}</li>;
                return (
                  <li key={m.id} ref={m.id === idDaPrimeiraNaoLida ? primeiraNaoLida : undefined} className={`flex flex-wrap items-start gap-2 ${minha ? "justify-end" : "justify-start"}`}>
                    {m.id === idDaPrimeiraNaoLida && <p className="w-full border-t border-oxblood pt-1 text-center text-[11px] font-semibold text-oxblood">{t.organizar.novas}</p>}
                    {faltas.has(m.id) && <p className="w-full text-center text-[11px] italic text-ink-soft">{t.conversa.faltam}</p>}
                    {denunciando && !minha && m.texto !== null && m.posicao === undefined && (
                      <input
                        type="checkbox"
                        className="mt-3 h-5 w-5"
                        aria-label={m.texto.slice(0, 60)}
                        checked={marcadas.has(m.id)}
                        onChange={(e) =>
                          setMarcadas((atual) => {
                            const nova = new Set(atual);
                            if (e.target.checked) nova.add(m.id);
                            else nova.delete(m.id);
                            return nova;
                          })
                        }
                      />
                    )}
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${minha ? "rounded-br-sm bg-ink text-parchment" : "rounded-bl-sm border border-rule bg-parchment-deep"}`}>
                      <p className="sr-only">{minha ? t.conversa.voce : conversa.com.codinome}:</p>
                      {m.texto === null ? (
                        <p className="text-sm italic opacity-80">{t.conversa.semChave}</p>
                      ) : m.posicao !== undefined ? (
                        <PosicaoNaMensagem lang={lang} corpo={m.posicao} />
                      ) : m.anexo !== undefined ? (
                        m.anexo && ta && sessao ? (
                          <AnexoNaMensagem
                            t={ta}
                            sessao={sessao}
                            corpo={m.anexo}
                            minha={minha}
                            aoAbrirUmaVez={() => {
                              if (sessaoRef.current) void apagarMensagem(sessaoRef.current, m.id).catch(() => undefined);
                            }}
                            aoFecharUmaVez={() => setMensagens((atual) => atual.filter((x) => x.id !== m.id))}
                            foto={tc?.foto ?? null}
                            marca={minhaMarca}
                            transcrever={tc?.transcrever ?? null}
                            lang={lang}
                          />
                        ) : (
                          <p className="text-sm italic opacity-80">{ta?.sumiu ?? "…"}</p>
                        )
                      ) : m.umaVez && !minha && !abertasUmaVez.has(m.id) ? (
                        <button
                          type="button"
                          className="underline"
                          onClick={() => {
                            // Abriu: já sai do histórico deste aparelho; o texto fica só nesta tela até fechar.
                            setAbertasUmaVez((atual) => new Set(atual).add(m.id));
                            if (sessaoRef.current) void apagarMensagem(sessaoRef.current, m.id).catch(() => undefined);
                          }}
                        >
                          {t.selado.abrirUmaVez}
                        </button>
                      ) : (
                        <>
                          {tc && <MarcaDeEncaminhada t={tc.encaminhar} contagem={m.encaminhada} />}
                          <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                          {m.umaVez && !minha && (
                            <button type="button" className="mt-1 inline-flex min-h-11 items-center text-xs underline" onClick={() => setMensagens((atual) => atual.filter((x) => x.id !== m.id))}>
                              {t.selado.fecharUmaVez}
                            </button>
                          )}
                        </>
                      )}
                      {m.duvidosa && <p className="mt-1 text-[11px] italic opacity-80">{t.conversa.duvidosa}</p>}
                      {ordem.foraDeOrdem.has(m.id) && <p className="mt-1 text-[11px] italic opacity-80">{t.conversa.foraDeOrdem}</p>}
                      {minha && ordem.semConfirmar.has(m.id) && <p className="mt-1 text-[11px] italic opacity-80">{t.conversa.semConfirmar}</p>}
                      <div className="mt-1 flex flex-wrap items-center justify-end gap-x-2 text-[11px]">
                        <time className="opacity-80" dateTime={m.criado_em}>{new Date(m.criado_em).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}</time>
                        {m.editada && <span className="opacity-80">· {t.conversa.editada}</span>}
                        {m.agendada && tc ? (
                          <span className="font-semibold" data-agendada>· {preencher(tc.agendar.marca, { quando: new Date(m.agendada).toLocaleString(lang, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) })}</span>
                        ) : m.pendente ? (
                          <span className="font-semibold">· {preencher(t.conversa.naFila, { nome: conversa.com.codinome })}</span>
                        ) : (
                          <span className="opacity-80">· {preencher(t.conversa.expira, { quando: quandoSome(lang, m.expira_em) })}</span>
                        )}
                        <MenuDaMensagem rotulo={t.conversa.menu} clara={minha} montar={() => itensDaMensagem(m, minha)} />
                      </div>
                    </div>
                  </li>
                );
              })}
              {saindo.map((m) => (
                <li key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-3.5 py-2 text-parchment opacity-80">
                    <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                    <p className="mt-1 text-right text-[11px]" role="status">{t.conversa.enviando}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div ref={fim} />
          </>
        )}
      </div>

      {sessao && !bloqueio && conversa.pode_escrever && !sessao.semChaveDoOutro && (
        <form onSubmit={(e) => void enviar(e)} className="al2-chat-escrever sticky bottom-0 border-t border-rule bg-parchment px-[18px] py-3">
          {/* Prompt 4, itens 112, 111 e 79 (lote "conta", atrás de alumia-p4-conta): fora do horário da outra pessoa, respostas rápidas e o releia. */}
          <AvisoDeAtendimento lang={lang} handle={conversa.com.handle} className="mb-2" />
          <label className="sr-only" htmlFor="alumia-chat-texto">{editando ? t.conversa.editando : t.conversa.escreva}</label>
          {editando && (
            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
              <p className="font-semibold">{t.conversa.editando}</p>
              <button type="button" onClick={cancelarEdicao} className="inline-flex min-h-11 items-center px-2 underline">{t.conversa.cancelar}</button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={campo}
              id="alumia-chat-texto"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void enviar();
                } else if (e.key === "Escape" && editando) {
                  e.preventDefault();
                  cancelarEdicao();
                }
              }}
              rows={2}
              placeholder={t.conversa.escreva}
              autoComplete="off"
              disabled={!!sessao.mudou}
              className="min-h-11 flex-1 resize-none rounded-xl border border-rule bg-parchment px-3 py-2"
            />
            <button
              type="submit"
              disabled={(!!editando && ocupado) || !textoCabe(texto) || !!sessao.mudou || !!sessao.foraDoRegistro || (sessao.aguardandoOutro && !sessao.naFila)}
              className={botaoForte}
            >
              {editando ? t.conversa.salvarEdicao : t.conversa.enviar}
            </button>
          </div>
          <ReleiaNoChat lang={lang} texto={texto} />
          <div className={`mt-2 flex flex-wrap items-center gap-3 text-xs ${editando ? "hidden" : ""}`}>
            <RespostasNoChat lang={lang} aoEscolher={(r) => setTexto((x) => (x.trim() ? `${x} ${r}` : r))} />
            <label className="flex items-center gap-1">
              <span>{t.selado.someEm}</span>
              <select value={temporaria ?? ""} onChange={(e) => setTemporaria(e.target.value ? Number(e.target.value) : null)} className="min-h-9 rounded-md border border-rule bg-parchment px-1">
                <option value="">{t.selado.padrao}</option>
                <option value="5">{t.selado.cincoMin}</option>
                <option value="60">{t.selado.umaHora}</option>
              </select>
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-1.5" title={t.selado.verUmaVezExplica}>
              <input type="checkbox" checked={umaVez} onChange={(e) => setUmaVez(e.target.checked)} className="h-4 w-4" />
              <span>{t.selado.verUmaVez}</span>
            </label>
            {tc && !umaVez && temporaria === null && (
              <button type="button" className="inline-flex min-h-11 items-center underline" aria-expanded={agendando} disabled={!textoCabe(texto)} onClick={() => setAgendando((a) => !a)}>
                {tc.agendar.botao}
              </button>
            )}
          </div>
          {tc && agendando && !editando && (
            <AgendarEnvio
              t={tc.agendar}
              desligado={!textoCabe(texto) || !!sessao.mudou || !!sessao.foraDoRegistro}
              aoAgendar={agendar}
              aoFechar={() => setAgendando(false)}
            />
          )}
          {comAnexo && ta && !editando && (
            <div className="mt-2 flex flex-col gap-1 text-xs">
              <AnexoNoCompositor
                t={ta}
                sessao={sessao}
                opcoes={() => ({ prazoDias: prazo, umaVez })}
                desligado={!!sessao.mudou || !!sessao.foraDoRegistro || sessao.aguardandoOutro}
                aoEnviado={() => {
                  setUmaVez(false);
                  if (sessaoRef.current) void buscar(sessaoRef.current);
                }}
                aoErro={setErro}
                foto={comConversaP4 ? (tc?.foto ?? null) : null}
              />
              <p className="max-w-prose text-ink-soft">{ta.aviso}</p>
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-xs">
            <p className="max-w-prose text-ink-soft">{t.conversa.ritmo}</p>
            <p className={restam < 0 ? "text-oxblood" : "text-ink-soft"}>{restam < 0 ? t.conversa.grande : preencher(t.conversa.restam, { n: restam })}</p>
          </div>
        </form>
      )}
      <Confirmar pedido={confirmacao} nao={t.confirmar.nao} aoFechar={() => setConfirmacao(null)} />
    </div>
  );
}
