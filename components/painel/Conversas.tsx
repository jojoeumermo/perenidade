// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rpc, type Me } from "@/lib/backend";
import type { Chaveiro } from "@/lib/chaveiro";
import { type Citacao, type Conteudo, desempacotar, empacotar, extrairMencoes, linksDe, previaDoLink, reacoes, semFormatacao, trechoDe } from "@/lib/mensagem";
import { contextoDaConversa } from "@/lib/sigilo";
import { getItem, setItem } from "@/lib/storage";
import { useI18n } from "../I18n";
import { Aviso, botao, botaoClaro, campo, elo, papeis, rotulo, textoDoErro, useLista } from "./comum";
import type { Membro } from "./Equipe";
import { Formatado } from "./Formatado";
import { AnexoVisto, type EstadoDoAnexo, Galeria, Gravador, type ItemDaGaleria, Preparados, type Preparado, preparar, soltar, subir } from "./Anexos";
import { Alertas, AparelhoPendente, Aparelhos, ComoFunciona, enviarCifrado, Seguranca, TextoAberto, useAbertos, useChaveiro } from "./Sigilo";

type Tipo = "direta" | "grupo" | "departamento";

interface Conversa {
  id: string;
  tipo: Tipo;
  /** Nos grupos de departamento: a função ("design") ou "geral", a equipe toda. */
  departamento: string | null;
  nome: string;
  /** Fui eu que criei o grupo. */
  dona: boolean;
  /** Nas conversas privadas: a outra pessoa. */
  outro: string | null;
  online: boolean | null;
  visto_em: string | null;
  membros: number;
  apagar_apos: number | null;
  ultima: { corpo: string; minha: boolean; autor: string; autor_id: string | null; criado_em: string } | null;
  nao_lidas: number;
}

interface Mensagem {
  id: string;
  autor: string | null;
  nome: string;
  minha: boolean;
  corpo: string;
  criado_em: string;
  /** Com a autodestruição ligada, quando a mensagem some. */
  expira_em: string | null;
  /** Texto, ou uma reação ou edição de outra mensagem ("alvo"). */
  tipo: "texto" | "reacao" | "edicao";
  alvo: string | null;
  /** O que o banco sabe dos arquivos: ver uma vez já aberto, bytes ainda disponíveis. O resto vai dentro do cifrado. */
  anexos: EstadoDoAnexo[];
}

interface MembroDaConversa {
  id: string;
  nome: string;
  eu: boolean;
  /** Nulo quando a pessoa (ou eu) esconde o "visto por último". */
  online: boolean | null;
  visto_em: string | null;
  /** Nulo quando a pessoa (ou eu) desligou a confirmação de leitura. */
  lido_em: string | null;
  recebido_em: string;
  digitando: "" | "texto" | "audio";
}

interface Aberta {
  id: string;
  tipo: Tipo;
  departamento: string | null;
  nome: string;
  /** Posso mudar o grupo (criei, ou sou da coordenação). */
  dona: boolean;
  apagar_apos: number | null;
  apagar_desde: string | null;
  apagar_por: string;
  membros: MembroDaConversa[];
  fixadas: string[];
  favoritas: string[];
  mensagens: Mensagem[];
}

const MAXIMO = 2000;
/** Até quando uma mensagem pode ser editada. */
const EDITAVEL_POR = 15 * 60 * 1000;
const prazos: { segundos: number; nome: string }[] = [
  { segundos: 0, nome: "Desligada" },
  { segundos: 3600, nome: "1 hora" },
  { segundos: 86400, nome: "1 dia" },
  { segundos: 604800, nome: "7 dias" },
];
const nomeDoPrazo = (segundos: number | null) => prazos.find((prazo) => prazo.segundos === (segundos ?? 0))?.nome ?? "";

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("") || "?";

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const diaDe = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

/** "some em 40 min", "some em 5 h", "some em 3 dias". */
function restante(iso: string) {
  const minutos = Math.max(1, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
  if (minutos < 60) return `some em ${minutos} min`;
  if (minutos < 60 * 24) return `some em ${Math.round(minutos / 60)} h`;
  return `some em ${Math.round(minutos / 1440)} dias`;
}

/** "online", "visto por último há 12 min", "visto por último ontem às 21:40"… Vazio quando a pessoa esconde. */
function presenca(online: boolean | null, visto: string | null) {
  if (online) return "online";
  if (!visto) return "";
  const quando = new Date(visto);
  const minutos = Math.round((Date.now() - quando.getTime()) / 60000);
  if (minutos < 60) return `visto por último há ${Math.max(minutos, 2)} min`;
  const hoje = new Date();
  const ontem = new Date(Date.now() - 86400000);
  if (quando.toDateString() === hoje.toDateString()) return `visto por último hoje às ${hora(visto)}`;
  if (quando.toDateString() === ontem.toDateString()) return `visto por último ontem às ${hora(visto)}`;
  return `visto por último em ${quando.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
}

function Rosto({ nome, online = false, tipo = "direta" }: { nome: string; online?: boolean; tipo?: Tipo }) {
  return (
    <span className="relative shrink-0">
      <span aria-hidden className={`flex h-10 w-10 items-center justify-center font-semibold ${tipo === "departamento" ? "bg-oxblood text-parchment" : tipo === "grupo" ? "border-2 border-ink text-ink" : "bg-ink text-parchment"}`}>
        {tipo === "direta" ? iniciais(nome) : "#"}
      </span>
      {online && <span title="online" className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-parchment bg-ok" />}
    </span>
  );
}

/** Chama "recarregar" de tempos em tempos, só com a aba do navegador à vista. */
function useRelogio(recarregar: () => void, intervalo: number) {
  useEffect(() => {
    const relogio = window.setInterval(() => {
      if (document.visibilityState === "visible") recarregar();
    }, intervalo);
    return () => window.clearInterval(relogio);
  }, [recarregar, intervalo]);
}

/** O rascunho de cada conversa fica só neste aparelho. */
const chaveDoRascunho = (conversa: string) => `lucia:rascunho:${conversa}`;

/**
 * As conversas da equipe: privadas, em grupo e os grupos fixos de cada departamento. Só quem participa de uma conversa a vê.
 * Tudo é cifrado de ponta a ponta neste aparelho antes de ser enviado, e some depois de trinta dias (ou antes, com a autodestruição).
 */
export function Conversas({ me }: { me: Me }) {
  const { chaveiro, erro } = useChaveiro(me.id);
  const lista = useLista<Conversa[]>("chat_conversas");
  const membros = useLista<Membro[]>("equipe_membros");
  const [aberta, setAberta] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [tela, setTela] = useState<"conversa" | "grupo" | "favoritas">("conversa");
  const [aviso, setAviso] = useState("");
  useRelogio(lista.recarregar, 8000);
  useRelogio(membros.recarregar, 30000);
  const previas = useAbertos(
    chaveiro,
    (lista.dados ?? []).flatMap((conversa) =>
      conversa.ultima ? [{ id: `${conversa.id}:${conversa.ultima.criado_em}`, conversa: conversa.id, corpo: conversa.ultima.corpo, contexto: contextoDaConversa(conversa.id, conversa.ultima.autor_id ?? ""), autor: conversa.ultima.autor_id }] : [],
    ),
  );

  if (erro) return <Aviso texto={erro} />;
  if (!chaveiro) return <Aviso texto="Preparando a chave deste aparelho…" />;
  // Aparelho ainda não aprovado: nada abre aqui até um aparelho já aprovado da pessoa conferir o código.
  if (chaveiro.estado !== "aprovado") return <div className="border border-rule bg-parchment"><AparelhoPendente chaveiro={chaveiro} /></div>;

  const termo = busca.trim().toLowerCase();
  const conversas = (lista.dados ?? []).filter((conversa) => !termo || conversa.nome.toLowerCase().includes(termo));
  const comConversa = new Set((lista.dados ?? []).flatMap((conversa) => (conversa.outro ? [conversa.outro] : [])));
  const pessoas = (membros.dados ?? []).filter((membro) => !membro.eu && (termo ? membro.nome.toLowerCase().includes(termo) : !comConversa.has(membro.id)));
  const aberto = tela !== "conversa" || aberta !== null;

  async function conversarCom(usuario: string) {
    setAviso("");
    try {
      const { id } = await rpc<{ id: string }>("chat_direta", { p_usuario: usuario });
      setBusca("");
      setTela("conversa");
      setAberta(id);
      lista.recarregar();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }

  /** A última mensagem, aberta: o texto sem formatação e, se me mencionou, a marca. */
  function previa(conversa: Conversa): { texto: string; mencao: boolean } {
    if (!conversa.ultima) return { texto: conversa.tipo === "direta" ? "Nenhuma mensagem ainda" : `${conversa.membros} pessoas`, mencao: false };
    const quem = conversa.ultima.minha ? "Você: " : conversa.tipo !== "direta" ? `${conversa.ultima.autor.split(" ")[0]}: ` : "";
    const aberta = previas[`${conversa.id}:${conversa.ultima.criado_em}`];
    if (!aberta) return { texto: `${quem}${conversa.ultima.corpo.startsWith("c1.") ? "mensagem antiga" : "…"}`, mencao: false };
    const conteudo = desempacotar(aberta.texto);
    const arquivo = conteudo.anexos?.length ? `${{ imagem: "🖼 Foto", video: "🎞 Vídeo", audio: "🎙 Áudio", pdf: "📄 PDF", docx: "📝 Documento" }[conteudo.anexos[0].tipo]}${conteudo.anexos.length > 1 ? ` +${conteudo.anexos.length - 1}` : ""}${conteudo.texto ? " · " : ""}` : "";
    return { texto: `${quem}${conteudo.encaminhada ? "↪ " : ""}${arquivo}${semFormatacao(conteudo.texto)}`, mencao: Boolean(conteudo.mencoes?.includes(me.id)) && !conversa.ultima.minha };
  }

  return (
    <div className="grid h-[calc(100dvh-16.5rem)] min-h-[24rem] border border-rule lg:h-[calc(100dvh-12.5rem)] lg:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className={`flex min-h-0 flex-col border-rule bg-parchment-deep lg:border-r ${aberto ? "hidden lg:flex" : "flex"}`}>
        <div className="space-y-2 border-b border-rule p-3">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} type="search" placeholder="Procurar pessoa ou conversa" aria-label="Procurar pessoa ou conversa" className={`${campo} mt-0 bg-parchment`} />
          <div className="flex gap-2">
            <button type="button" className={`${botaoClaro} flex-1 py-1.5`} onClick={() => { setTela("grupo"); setAberta(null); }}>
              Novo grupo
            </button>
            <button type="button" className={`${botaoClaro} py-1.5`} aria-pressed={tela === "favoritas"} onClick={() => { setTela("favoritas"); setAberta(null); }} title="Mensagens favoritas">
              ★
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
          {(lista.erro || membros.erro || aviso) && <Aviso texto={lista.erro || membros.erro || aviso} />}
          <ul>
            {conversas.map((conversa) => {
              const ultima = previa(conversa);
              return (
                <li key={conversa.id}>
                  <button
                    type="button"
                    onClick={() => { setAberta(conversa.id); setTela("conversa"); }}
                    aria-current={aberta === conversa.id ? "true" : undefined}
                    className={`flex w-full cursor-pointer items-center gap-3 border-b border-rule px-3 py-2.5 text-left ${aberta === conversa.id ? "bg-parchment" : "hover:bg-parchment"}`}
                  >
                    <Rosto nome={conversa.nome} online={Boolean(conversa.online)} tipo={conversa.tipo} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-semibold">
                          {conversa.nome}
                          {conversa.apagar_apos && <span title={`Autodestruição: ${nomeDoPrazo(conversa.apagar_apos)}`} className="ml-1 font-normal text-ink-soft">⏱</span>}
                        </span>
                        {conversa.ultima && <span className="shrink-0 text-xs text-ink-soft">{hora(conversa.ultima.criado_em)}</span>}
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate ${ultima.mencao ? "font-semibold text-ink" : "text-ink-soft"}`}>{ultima.texto}</span>
                        <span className="flex shrink-0 gap-1">
                          {ultima.mencao && <span title="Você foi mencionado" className="bg-gold px-1.5 py-0.5 font-mono text-[0.7rem] font-semibold leading-none text-ink">@</span>}
                          {conversa.nao_lidas > 0 && <span className="bg-oxblood px-1.5 py-0.5 font-mono text-[0.7rem] font-semibold leading-none text-parchment">{conversa.nao_lidas}</span>}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {pessoas.length > 0 && (
            <>
              <p className={`${rotulo} px-3 pb-1 pt-4`}>{termo ? "Pessoas" : "Começar uma conversa"}</p>
              <ul>
                {pessoas.map((membro) => (
                  <li key={membro.id}>
                    <button type="button" onClick={() => void conversarCom(membro.id)} className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-parchment">
                      <Rosto nome={membro.nome} online={Boolean(membro.online)} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{membro.nome}</span>
                        <span className="block truncate text-xs text-ink-soft">{presenca(membro.online, membro.visto_em)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {termo && conversas.length === 0 && pessoas.length === 0 && <p className="px-3 py-4 text-ink-soft">Ninguém com esse nome na equipe.</p>}
        </div>
        {/* A lista de aparelhos cresce (aprovação, cópia de recuperação): rola dentro do próprio pé, sem empurrar a tela. */}
        <div className="max-h-[60%] space-y-2 overflow-y-auto border-t border-rule p-3 [scrollbar-width:thin]">
          <ComoFunciona />
          <Aparelhos chaveiro={chaveiro} />
        </div>
      </aside>

      <section className={`min-h-0 min-w-0 flex-col bg-parchment ${aberto ? "flex" : "hidden lg:flex"}`}>
        {tela === "grupo" ? (
          <NovoGrupo membros={membros.dados ?? []} fechar={() => setTela("conversa")} criado={(id) => { setTela("conversa"); setAberta(id); lista.recarregar(); }} />
        ) : tela === "favoritas" ? (
          <Favoritas chaveiro={chaveiro} fechar={() => setTela("conversa")} abrir={(id) => { setTela("conversa"); setAberta(id); }} />
        ) : aberta ? (
          <Janela
            key={aberta}
            id={aberta}
            chaveiro={chaveiro}
            me={me}
            equipe={membros.dados ?? []}
            conversas={lista.dados ?? []}
            resumo={lista.dados?.find((conversa) => conversa.id === aberta)}
            voltar={() => { setAberta(null); lista.recarregar(); }}
            mudou={lista.recarregar}
          />
        ) : (
          <div className="m-auto max-w-sm px-6 text-center text-ink-soft">
            <p className="font-serif text-2xl font-semibold text-ink">Conversas da equipe</p>
            <p className="mt-2">Escolha uma conversa, procure uma pessoa pelo nome ou crie um grupo. Cada função tem o próprio grupo, e quem tem a função já está nele. Só quem participa de uma conversa consegue vê-la.</p>
            <p className="mt-2 text-xs">Cifrado de ponta a ponta neste aparelho · some em 30 dias</p>
          </div>
        )}
      </section>
    </div>
  );
}

/** O que a tela mostra de uma mensagem de texto: o conteúdo aberto (já com a última edição), as reações e a autoria. */
interface Vista {
  mensagem: Mensagem;
  conteudo: Conteudo | null;
  autoria: "ok" | "invalida" | "sem_assinatura" | "sem_identidade" | "esperando";
  editada: boolean;
  /** emoji → quem reagiu (com o id da reação, para a própria pessoa desfazer). */
  reacoes: { emoji: string; quem: { id: string; autor: string | null; nome: string; minha: boolean }[] }[];
}

/** Uma conversa aberta: as mensagens, quem está por aqui, a autodestruição e a caixa de escrever. */
function Janela({ id, chaveiro, me, equipe, conversas, resumo, voltar, mudou }: { id: string; chaveiro: Chaveiro; me: Me; equipe: Membro[]; conversas: Conversa[]; resumo?: Conversa; voltar: () => void; mudou: () => void }) {
  const conversa = useLista<Aberta>("chat_ver", { p_id: id });
  const { recarregar } = conversa;
  const [texto, setTexto] = useState(() => getItem(chaveDoRascunho(id)));
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [gerir, setGerir] = useState(false);
  const [citando, setCitando] = useState<Citacao | null>(null);
  const [editando, setEditando] = useState<Mensagem | null>(null);
  const [reagindo, setReagindo] = useState<string | null>(null);
  const [quemReagiu, setQuemReagiu] = useState<string | null>(null);
  const [lidaPor, setLidaPor] = useState<string | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string> | null>(null);
  const [encaminhando, setEncaminhando] = useState<string[] | null>(null);
  const [destacada, setDestacada] = useState<string | null>(null);
  const [seguranca, setSeguranca] = useState<{ usuario: string; nome: string } | null>(null);
  const [sugestao, setSugestao] = useState<{ inicio: number; termo: string } | null>(null);
  const [preparados, setPreparados] = useState<Preparado[]>([]);
  const [gravando, setGravando] = useState(false);
  const [galeria, setGaleria] = useState(false);
  const [andamento, setAndamento] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const caixa = useRef<HTMLTextAreaElement>(null);
  const escolha = useRef<HTMLInputElement>(null);
  const fim = useRef<HTMLDivElement>(null);
  const ultimoAvisoDeDigitando = useRef(0);
  const ultimoRecebido = useRef("");
  useRelogio(recarregar, 3000);
  useEffect(() => () => soltar(preparados), [preparados]);
  const dados = conversa.dados;
  // Mensagem com autodestruição some da tela no prazo, mesmo antes de o banco apagá-la.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(Date.now()), 5000);
    return () => window.clearInterval(relogio);
  }, []);
  const todas = useMemo(() => (dados?.mensagens ?? []).filter((mensagem) => !mensagem.expira_em || new Date(mensagem.expira_em).getTime() > agora), [dados, agora]);
  const abertos = useAbertos(chaveiro, todas.map((mensagem) => ({ id: mensagem.id, conversa: id, corpo: mensagem.corpo, contexto: contextoDaConversa(id, mensagem.autor ?? ""), autor: mensagem.autor })));
  const alertas = chaveiro.alertasDe(id);
  const pessoas = chaveiro.pessoasDe(id);
  const membrosDaConversa = useMemo(() => (dados?.membros ?? []).map((membro) => ({ id: membro.id, nome: membro.nome })), [dados]);

  // O que cada mensagem de texto mostra, com a última edição e as reações já juntadas.
  const vistas = useMemo<Vista[]>(() => {
    const edicoes = new Map<string, Mensagem>();
    const reacoesPor = new Map<string, Mensagem[]>();
    for (const mensagem of todas) {
      if (mensagem.tipo === "edicao" && mensagem.alvo) {
        const atual = edicoes.get(mensagem.alvo);
        if (!atual || atual.criado_em < mensagem.criado_em) edicoes.set(mensagem.alvo, mensagem);
      } else if (mensagem.tipo === "reacao" && mensagem.alvo) {
        reacoesPor.set(mensagem.alvo, [...(reacoesPor.get(mensagem.alvo) ?? []), mensagem]);
      }
    }
    return todas
      .filter((mensagem) => mensagem.tipo === "texto")
      .map((mensagem) => {
        const edicao = edicoes.get(mensagem.id);
        const original = abertos[mensagem.id];
        const fonte = edicao && abertos[edicao.id] ? abertos[edicao.id] : original;
        const conteudo = fonte ? desempacotar(fonte.texto) : null;
        // A edição troca o texto, mas a citação, a encaminhada e a prévia são as da mensagem original.
        const base = original ? desempacotar(original.texto) : null;
        const grupos = new Map<string, Vista["reacoes"][number]["quem"]>();
        for (const reacao of reacoesPor.get(mensagem.id) ?? []) {
          const emoji = abertos[reacao.id] ? desempacotar(abertos[reacao.id]!.texto).emoji : undefined;
          if (!emoji) continue;
          grupos.set(emoji, [...(grupos.get(emoji) ?? []), { id: reacao.id, autor: reacao.autor, nome: reacao.nome, minha: reacao.minha }]);
        }
        return {
          mensagem,
          conteudo: conteudo && base ? { ...base, texto: conteudo.texto } : conteudo,
          autoria: original === undefined ? "esperando" : original === null ? "esperando" : original.autoria,
          editada: Boolean(edicao),
          reacoes: [...grupos.entries()].map(([emoji, quem]) => ({ emoji, quem })),
        };
      });
  }, [todas, abertos]);
  const ultima = vistas.at(-1)?.mensagem.id;

  // Mensagem nova: a conversa rola sozinha até o fim.
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [ultima]);

  // Avisa que este aparelho recebeu as mensagens (o segundo tique de quem enviou), uma vez por mensagem nova de outra pessoa.
  useEffect(() => {
    const novas = vistas.filter((vista) => !vista.mensagem.minha && vista.conteudo);
    const marca = novas.at(-1)?.mensagem.id ?? "";
    if (!marca || marca === ultimoRecebido.current) return;
    ultimoRecebido.current = marca;
    void rpc("chat_recebidas", { p_id: id }).catch(() => undefined);
  }, [vistas, id]);

  // O rascunho fica guardado neste aparelho enquanto a pessoa não envia.
  useEffect(() => {
    if (editando) return;
    const relogio = window.setTimeout(() => setItem(chaveDoRascunho(id), texto.trim() ? texto : null), 400);
    return () => window.clearTimeout(relogio);
  }, [texto, id, editando]);

  /** "Fulano está digitando…": avisa no máximo a cada quatro segundos enquanto a pessoa escreve. */
  function avisarDigitando(tipo: "texto" | "audio" | "") {
    const agora = Date.now();
    if (tipo && agora - ultimoAvisoDeDigitando.current < 4000) return;
    ultimoAvisoDeDigitando.current = tipo ? agora : 0;
    void rpc("chat_digitando", { p_id: id, p_tipo: tipo }).catch(() => undefined);
  }

  if (!dados) {
    return (
      <div className="p-4">
        <button type="button" className={`${elo} lg:hidden`} onClick={voltar}>← Conversas</button>
        <Aviso texto={conversa.erro || "Abrindo…"} />
      </div>
    );
  }

  const outro = dados.tipo === "direta" ? dados.membros.find((membro) => !membro.eu) : undefined;
  const nome = dados.tipo === "direta" ? (outro?.nome ?? resumo?.nome ?? "Conversa") : dados.nome;
  const outros = dados.membros.filter((membro) => !membro.eu);
  const verificado = (usuario: string) => pessoas.find((pessoa) => pessoa.usuario === usuario)?.verificado ?? false;
  const digitando = outros.filter((membro) => membro.digitando);
  const fixadas = dados.fixadas.map((fixada) => vistas.find((vista) => vista.mensagem.id === fixada)).filter((vista): vista is Vista => Boolean(vista));
  const favoritas = new Set(dados.favoritas);
  const emGrupo = dados.tipo !== "direta";

  /** Os tiques de uma mensagem minha: enviada, entregue a todos, lida por todos (ou por quantos, no grupo). */
  function tiques(mensagem: Mensagem) {
    if (!mensagem.minha || outros.length === 0) return null;
    const entregue = outros.every((membro) => membro.recebido_em >= mensagem.criado_em);
    const leram = outros.filter((membro) => membro.lido_em && membro.lido_em >= mensagem.criado_em);
    const confirmacao = outros.some((membro) => membro.lido_em !== null);
    const lida = confirmacao && leram.length === outros.length;
    const titulo = lida ? "Lida" : entregue ? "Entregue" : "Enviada";
    return (
      <button
        type="button"
        title={titulo}
        aria-label={`${titulo}${emGrupo && leram.length ? `, por ${leram.length}` : ""}`}
        className={`ml-1 cursor-pointer font-mono ${lida ? "text-[#f0cf8e]" : ""}`}
        onClick={() => emGrupo && setLidaPor(lidaPor === mensagem.id ? null : mensagem.id)}
      >
        {entregue || lida ? "✓✓" : "✓"}
        {emGrupo && leram.length > 0 && <span className="ml-0.5">{leram.length}</span>}
      </button>
    );
  }

  function irPara(mensagem: string) {
    document.getElementById(`m-${mensagem}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    setDestacada(mensagem);
    window.setTimeout(() => setDestacada((atual) => (atual === mensagem ? null : atual)), 1600);
  }

  async function enviar(arquivos: Preparado[] = preparados) {
    const limpo = texto.trim();
    if ((!limpo && arquivos.length === 0) || ocupado) return;
    setOcupado(true);
    setAviso("");
    try {
      if (editando) {
        await enviarCifrado(chaveiro, id, empacotar({ texto: limpo }), contextoDaConversa(id, me.id), (corpo) => rpc("chat_enviar", { p_id: id, p_corpo: corpo, p_tipo: "edicao", p_alvo: editando.id }));
        setEditando(null);
      } else {
        const link = linksDe(limpo)[0];
        const conteudo: Conteudo = { texto: limpo, citando: citando ?? undefined, mencoes: extrairMencoes(limpo, membrosDaConversa), previa: link ? (previaDoLink(link) ?? undefined) : undefined };
        if (arquivos.length) {
          // Cada arquivo é cifrado com uma chave só dele e sobe antes; a mensagem leva as chaves e prende os arquivos.
          conteudo.anexos = await subir(arquivos, id, (feitos) => setAndamento(`Cifrando e enviando ${feitos} de ${arquivos.length}…`));
          setAndamento("");
        }
        const ids = conteudo.anexos?.map((anexo) => anexo.id);
        await enviarCifrado(chaveiro, id, empacotar(conteudo), contextoDaConversa(id, me.id), (corpo) => rpc("chat_enviar", { p_id: id, p_corpo: corpo, p_anexos: ids ?? null }));
        setCitando(null);
        if (arquivos.length) { soltar(arquivos); setPreparados([]); }
      }
      setTexto("");
      setItem(chaveDoRascunho(id), null);
      avisarDigitando("");
      recarregar();
      mudou();
    } catch (erro) {
      setAndamento("");
      setAviso(textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  /** Arquivos escolhidos, colados ou arrastados: conferidos e preparados aqui, antes de qualquer envio. */
  async function anexar(arquivos: File[]) {
    if (arquivos.length === 0 || editando) return;
    setAviso("");
    try {
      const novos = await preparar(arquivos, preparados.length);
      setPreparados((atual) => [...atual, ...novos]);
      caixa.current?.focus();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }

  async function agir(fazer: () => Promise<unknown>) {
    setAviso("");
    try {
      await fazer();
      recarregar();
      mudou();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }

  const apagar = (mensagem: string) => agir(() => rpc("chat_apagar", { p_id: mensagem }));
  const autodestruir = (segundos: number) => agir(() => rpc("chat_autodestruir", { p_id: id, p_segundos: segundos }));
  const fixar = (mensagem: string, fixar: boolean) => agir(() => rpc("chat_fixar", { p_mensagem: mensagem, p_fixar: fixar }));
  const favoritar = (mensagem: string, favoritar: boolean) => agir(() => rpc("chat_favoritar", { p_mensagem: mensagem, p_favoritar: favoritar }));

  /** Reagir: a mesma reação de novo desfaz; outra troca. */
  function reagir(vista: Vista, emoji: string) {
    setReagindo(null);
    const minha = vista.reacoes.flatMap((grupo) => grupo.quem.filter((quem) => quem.minha).map((quem) => ({ ...quem, emoji: grupo.emoji })))[0];
    if (minha?.emoji === emoji) return apagar(minha.id);
    return agir(() => enviarCifrado(chaveiro, id, empacotar({ texto: "", emoji }), contextoDaConversa(id, me.id), (corpo) => rpc("chat_enviar", { p_id: id, p_corpo: corpo, p_tipo: "reacao", p_alvo: vista.mensagem.id })));
  }

  function citar(vista: Vista) {
    if (!vista.conteudo) return;
    setEditando(null);
    setCitando({ id: vista.mensagem.id, autor: vista.mensagem.autor ?? "", nome: vista.mensagem.minha ? "Você" : vista.mensagem.nome, trecho: trechoDe(semFormatacao(vista.conteudo.texto)) });
    caixa.current?.focus();
  }

  function editar(vista: Vista) {
    if (!vista.conteudo) return;
    setCitando(null);
    setEditando(vista.mensagem);
    setTexto(vista.conteudo.texto);
    caixa.current?.focus();
  }

  const editavel = (mensagem: Mensagem) => mensagem.minha && agora - new Date(mensagem.criado_em).getTime() < EDITAVEL_POR;

  /** Encaminha as mensagens escolhidas para outras conversas, cifrando de novo para cada uma. */
  async function encaminhar(destinos: string[]) {
    const ids = encaminhando ?? [];
    setEncaminhando(null);
    setSelecionadas(null);
    setOcupado(true);
    setAviso("");
    try {
      for (const destino of destinos) {
        for (const alvo of ids) {
          const vista = vistas.find((item) => item.mensagem.id === alvo);
          if (!vista?.conteudo) continue;
          const conteudo: Conteudo = { texto: vista.conteudo.texto, encaminhada: true, previa: vista.conteudo.previa };
          const anexos = (vista.conteudo.anexos ?? []).filter((anexo) => !anexo.uma_vez);
          if (anexos.length) {
            // Baixa, abre e cifra de novo com chave nova para a conversa de destino: a chave de uma conversa nunca vale em outra.
            const { reenviar } = await import("./Anexos");
            conteudo.anexos = await reenviar(anexos, id, destino);
          }
          await enviarCifrado(chaveiro, destino, empacotar(conteudo), contextoDaConversa(destino, me.id), (corpo) => rpc("chat_enviar", { p_id: destino, p_corpo: corpo, p_anexos: conteudo.anexos?.map((anexo) => anexo.id) ?? null }));
        }
      }
      setAviso(`Encaminhada${ids.length > 1 ? "s" : ""} para ${destinos.length} conversa${destinos.length > 1 ? "s" : ""}.`);
      mudou();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  async function apagarSelecionadas() {
    const minhas = [...(selecionadas ?? [])].filter((alvo) => vistas.find((vista) => vista.mensagem.id === alvo)?.mensagem.minha);
    if (minhas.length === 0 || !window.confirm(`Apagar ${minhas.length > 1 ? `${minhas.length} mensagens suas` : "1 mensagem sua"} para todo mundo?`)) return;
    setSelecionadas(null);
    await agir(async () => {
      for (const alvo of minhas) await rpc("chat_apagar", { p_id: alvo });
    });
  }

  /** Menção com @: a lista de quem está na conversa, filtrada pelo que a pessoa já digitou depois do @. */
  function aoDigitar(valor: string, cursor: number) {
    setTexto(valor);
    if (valor.trim()) avisarDigitando("texto");
    const antes = valor.slice(0, cursor);
    const arroba = /(?:^|\s)@([^\s@]*)$/.exec(antes);
    setSugestao(arroba ? { inicio: cursor - arroba[1].length - 1, termo: arroba[1] } : null);
  }
  const sugeridos = sugestao ? outros.filter((membro) => membro.nome.toLowerCase().includes(sugestao.termo.toLowerCase())).slice(0, 6) : [];
  function mencionar(membro: MembroDaConversa) {
    if (!sugestao) return;
    const primeiro = membro.nome.split(/\s+/)[0];
    const depois = texto.slice(sugestao.inicio + 1 + sugestao.termo.length);
    const novo = `${texto.slice(0, sugestao.inicio)}@${primeiro} ${depois.replace(/^\s/, "")}`;
    setTexto(novo);
    setSugestao(null);
    caixa.current?.focus();
  }

  return (
    <>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule bg-parchment-deep px-3 py-2.5">
        <button type="button" aria-label="Voltar às conversas" className="cursor-pointer px-1 text-xl lg:hidden" onClick={voltar}>←</button>
        <Rosto nome={nome} online={Boolean(outro?.online)} tipo={dados.tipo} />
        <div className="min-w-[10rem] flex-1">
          <p className="truncate font-semibold">
            {nome}
            {outro && verificado(outro.id) && <span title="Identidade verificada pessoalmente" className="ml-1.5 font-normal text-ok">✓ verificado</span>}
          </p>
          <p className="truncate text-xs text-ink-soft" aria-live="polite">
            {digitando.length > 0
              ? `${digitando.map((membro) => membro.nome.split(" ")[0]).join(", ")} ${digitando.some((membro) => membro.digitando === "audio") ? "está gravando áudio…" : digitando.length > 1 ? "estão digitando…" : "está digitando…"}`
              : outro
                ? presenca(outro.online, outro.visto_em)
                : `${dados.tipo === "departamento" ? "Grupo do departamento · " : ""}${dados.membros.length} pessoas${outros.some((membro) => membro.online !== null) ? ` · ${dados.membros.filter((membro) => membro.online).length} online` : ""}`}
            {outro && (
              <>
                {" · "}
                <button type="button" className={elo} onClick={() => setSeguranca(seguranca ? null : { usuario: outro.id, nome: outro.nome })}>código de segurança</button>
              </>
            )}
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          <span aria-hidden>⏱</span>
          <span className="sr-only">Autodestruição das mensagens</span>
          <select value={dados.apagar_apos ?? 0} onChange={(e) => void autodestruir(Number(e.target.value))} className="cursor-pointer border border-rule bg-parchment px-1.5 py-1 text-ink" title="Autodestruição das mensagens novas">
            {prazos.map((prazo) => (
              <option key={prazo.segundos} value={prazo.segundos}>{prazo.segundos ? `Some em ${prazo.nome}` : "Sem autodestruição"}</option>
            ))}
          </select>
        </label>
        <button type="button" className={elo} aria-pressed={selecionadas !== null} onClick={() => setSelecionadas(selecionadas ? null : new Set())}>
          {selecionadas ? "Cancelar seleção" : "Selecionar"}
        </button>
        <button type="button" className={elo} onClick={() => setGaleria(true)}>Arquivos</button>
        {dados.tipo !== "direta" && (
          <button type="button" className={elo} aria-expanded={gerir} onClick={() => setGerir(!gerir)}>
            {gerir ? "Fechar" : "Pessoas"}
          </button>
        )}
      </header>

      {gerir && dados.tipo !== "direta" ? (
        <Grupo dados={dados} me={me} equipe={equipe} chaveiro={chaveiro} conversa={id} depois={() => { recarregar(); mudou(); }} saiu={voltar} />
      ) : (
        <>
          {fixadas.length > 0 && (
            <div className="flex items-center gap-2 border-b border-rule bg-parchment-deep px-3 py-1.5 text-xs">
              <span aria-hidden>📌</span>
              <button type="button" className="min-w-0 flex-1 cursor-pointer truncate text-left hover:underline" onClick={() => irPara(fixadas[0].mensagem.id)}>
                <span className="font-semibold">{fixadas[0].mensagem.minha ? "Você" : fixadas[0].mensagem.nome.split(" ")[0]}: </span>
                {fixadas[0].conteudo ? semFormatacao(fixadas[0].conteudo.texto) : "…"}
                {fixadas.length > 1 && <span className="text-ink-soft"> · +{fixadas.length - 1}</span>}
              </button>
              <button type="button" className={elo} onClick={() => void fixar(fixadas[0].mensagem.id, false)}>Desafixar</button>
            </div>
          )}
          {selecionadas && (
            <div className="flex flex-wrap items-center gap-3 border-b border-rule bg-ink px-3 py-1.5 text-xs text-parchment">
              <span>{selecionadas.size} selecionada{selecionadas.size === 1 ? "" : "s"}</span>
              <button type="button" className="cursor-pointer underline disabled:opacity-50" disabled={selecionadas.size === 0} onClick={() => setEncaminhando([...selecionadas])}>Encaminhar</button>
              <button type="button" className="cursor-pointer underline disabled:opacity-50" disabled={![...selecionadas].some((alvo) => vistas.find((vista) => vista.mensagem.id === alvo)?.mensagem.minha)} onClick={() => void apagarSelecionadas()}>Apagar as minhas</button>
            </div>
          )}
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-4 [scrollbar-width:thin]" aria-live="polite">
            {seguranca && (
              <div className="mb-3">
                <Seguranca chaveiro={chaveiro} conversa={id} usuario={seguranca.usuario} nome={seguranca.nome} fechar={() => setSeguranca(null)} />
              </div>
            )}
            <Alertas chaveiro={chaveiro} conversa={id} alertas={alertas} />
            {dados.apagar_apos && (
              <p className="mx-auto mb-3 max-w-md border border-rule bg-parchment-deep px-3 py-2 text-center text-xs text-ink-soft">
                Autodestruição ligada{dados.apagar_por ? ` por ${dados.apagar_por}` : ""}: as mensagens enviadas desde então somem {nomeDoPrazo(dados.apagar_apos)} depois de enviadas.
              </p>
            )}
            {vistas.length === 0 && <p className="py-10 text-center text-ink-soft">{dados.tipo === "departamento" ? "Ninguém escreveu aqui ainda. Todo mundo dessa função lê o que for escrito." : "Nenhuma mensagem ainda. Diga oi."}</p>}
            {vistas.map((vista, indice) => {
              const { mensagem, conteudo } = vista;
              const anterior = vistas[indice - 1]?.mensagem;
              const outroDia = !anterior || new Date(anterior.criado_em).toDateString() !== new Date(mensagem.criado_em).toDateString();
              const mostraNome = dados.tipo !== "direta" && !mensagem.minha && (outroDia || anterior?.autor !== mensagem.autor);
              const meMenciona = Boolean(conteudo?.mencoes?.includes(me.id)) && !mensagem.minha;
              const marcada = selecionadas?.has(mensagem.id) ?? false;
              const leram = outros.filter((membro) => membro.lido_em && membro.lido_em >= mensagem.criado_em);
              return (
                <div key={mensagem.id} id={`m-${mensagem.id}`} className={destacada === mensagem.id ? "painel-surge" : ""}>
                  {outroDia && <p className="py-2 text-center text-xs uppercase tracking-widest text-ink-soft">{diaDe(mensagem.criado_em)}</p>}
                  <div className={`group flex items-end gap-2 ${mensagem.minha ? "justify-end" : "justify-start"}`}>
                    {selecionadas && (
                      <input
                        type="checkbox"
                        className="mb-3 h-4 w-4 shrink-0"
                        aria-label="Selecionar mensagem"
                        checked={marcada}
                        onChange={(e) => setSelecionadas((atual) => { const novo = new Set(atual); if (e.target.checked) novo.add(mensagem.id); else novo.delete(mensagem.id); return novo; })}
                      />
                    )}
                    {mensagem.minha && !selecionadas && <Acoes vista={vista} eu me={me} favorita={favoritas.has(mensagem.id)} fixada={dados.fixadas.includes(mensagem.id)} editavel={editavel(mensagem)} citar={() => citar(vista)} reagir={() => setReagindo(reagindo === mensagem.id ? null : mensagem.id)} encaminhar={() => setEncaminhando([mensagem.id])} fixar={(sim) => void fixar(mensagem.id, sim)} favoritar={(sim) => void favoritar(mensagem.id, sim)} editar={() => editar(vista)} apagar={() => void apagar(mensagem.id)} />}
                    <div className={`relative max-w-[80%] px-3 py-1.5 sm:max-w-[70%] ${conteudo?.anexos?.length ? "w-[80%] sm:w-[70%] md:max-w-md" : ""} ${mensagem.minha ? "bg-ink text-parchment" : `border bg-parchment-deep ${meMenciona ? "border-gold border-l-4" : "border-rule"}`} ${destacada === mensagem.id ? "outline outline-2 outline-gold" : ""} ${marcada ? "outline outline-2 outline-oxblood" : ""}`}>
                      {mostraNome && (
                        <p className="text-xs font-semibold text-gold">
                          {mensagem.nome}
                          {mensagem.autor && verificado(mensagem.autor) && <span title="Identidade verificada pessoalmente" className="ml-1 font-normal text-ok">✓</span>}
                        </p>
                      )}
                      {conteudo?.encaminhada && <p className={`text-[0.7rem] italic ${mensagem.minha ? "text-parchment/70" : "text-ink-soft"}`}>↪ Encaminhada</p>}
                      {conteudo?.citando && (
                        <button type="button" onClick={() => irPara(conteudo.citando!.id)} className={`mb-1 block w-full cursor-pointer border-l-2 px-2 py-1 text-left text-xs ${mensagem.minha ? "border-[#f0cf8e] bg-parchment/10" : "border-oxblood bg-parchment"}`}>
                          <span className="block font-semibold">{conteudo.citando.autor === me.id ? "Você" : conteudo.citando.nome}</span>
                          <span className="block truncate opacity-80">{conteudo.citando.trecho}</span>
                        </button>
                      )}
                      {conteudo?.anexos?.map((anexo) => (
                        <AnexoVisto key={anexo.id} anexo={anexo} estado={mensagem.anexos.find((estado) => estado.id === anexo.id)} conversa={id} minha={mensagem.minha} />
                      ))}
                      <div className={`whitespace-pre-line break-words ${vista.autoria === "invalida" ? "border border-oxblood p-1" : ""}`}>
                        {conteudo ? (
                          <>
                            {conteudo.texto && <Formatado texto={conteudo.texto} membros={membrosDaConversa} eu={me.id} />}
                            {vista.autoria === "invalida" && <span className="mt-1 block border-l-2 border-oxblood pl-2 text-xs font-semibold text-oxblood">Não foi possível verificar o autor desta mensagem: a assinatura não confere com a identidade de quem aparece como autor.</span>}
                          </>
                        ) : (
                          <TextoAberto aberto={abertos[mensagem.id]} antiga={mensagem.corpo.startsWith("c1.")} />
                        )}
                      </div>
                      {conteudo?.previa && (
                        <a href={conteudo.previa.url} target="_blank" rel="noopener noreferrer nofollow" className={`mt-1 block border px-2 py-1 text-xs no-underline ${mensagem.minha ? "border-parchment/40" : "border-rule bg-parchment"}`}>
                          <span className="block truncate font-semibold">{conteudo.previa.titulo}</span>
                          <span className="block truncate opacity-70">{conteudo.previa.dominio} · prévia feita só do endereço</span>
                        </a>
                      )}
                      {vista.reacoes.length > 0 && (
                        <p className="mt-1 flex flex-wrap gap-1">
                          {vista.reacoes.map((grupo) => (
                            <button
                              key={grupo.emoji}
                              type="button"
                              title={grupo.quem.map((quem) => (quem.minha ? "você" : quem.nome)).join(", ")}
                              aria-label={`${grupo.emoji} de ${grupo.quem.map((quem) => (quem.minha ? "você" : quem.nome)).join(", ")}`}
                              onClick={() => (quemReagiu === mensagem.id ? setQuemReagiu(null) : setQuemReagiu(mensagem.id))}
                              className={`cursor-pointer rounded-full border px-1.5 text-xs ${grupo.quem.some((quem) => quem.minha) ? "border-gold bg-gold/30 text-ink" : mensagem.minha ? "border-parchment/40" : "border-rule bg-parchment"}`}
                            >
                              {grupo.emoji} {grupo.quem.length}
                            </button>
                          ))}
                        </p>
                      )}
                      {quemReagiu === mensagem.id && (
                        <ul className={`mt-1 text-[0.7rem] ${mensagem.minha ? "text-parchment/80" : "text-ink-soft"}`}>
                          {vista.reacoes.flatMap((grupo) => grupo.quem.map((quem) => (
                            <li key={quem.id} className="flex items-center justify-between gap-2">
                              <span>{grupo.emoji} {quem.minha ? "Você" : quem.nome}</span>
                              {quem.minha && <button type="button" className="cursor-pointer underline" onClick={() => void apagar(quem.id)}>desfazer</button>}
                            </li>
                          )))}
                        </ul>
                      )}
                      <p className={`text-right text-[0.65rem] leading-tight ${mensagem.minha ? "text-parchment/70" : "text-ink-soft"}`}>
                        {vista.editada && <span>Editada · </span>}
                        {dados.fixadas.includes(mensagem.id) && <span title="Fixada">📌 </span>}
                        {favoritas.has(mensagem.id) && <span title="Favorita">★ </span>}
                        {mensagem.expira_em && <span title={`Autodestruição: ${new Date(mensagem.expira_em).toLocaleString("pt-BR")}`}>⏱ {restante(mensagem.expira_em)} · </span>}
                        {hora(mensagem.criado_em)}
                        {tiques(mensagem)}
                      </p>
                      {lidaPor === mensagem.id && (
                        <p className={`text-[0.7rem] ${mensagem.minha ? "text-parchment/80" : "text-ink-soft"}`}>
                          {leram.length === 0 ? "Ninguém leu ainda." : `Lida por ${leram.map((membro) => membro.nome.split(" ")[0]).join(", ")}`}
                          {outros.some((membro) => membro.lido_em === null) && " (quem desligou a confirmação de leitura não aparece)"}
                        </p>
                      )}
                      {reagindo === mensagem.id && (
                        <p role="group" aria-label="Reagir" className="absolute -top-8 right-0 z-10 flex gap-0.5 border border-rule bg-parchment p-1 text-base shadow">
                          {reacoes.map((emoji) => (
                            <button key={emoji} type="button" className="cursor-pointer px-1 hover:bg-parchment-deep" aria-label={`Reagir com ${emoji}`} onClick={() => void reagir(vista, emoji)}>{emoji}</button>
                          ))}
                        </p>
                      )}
                    </div>
                    {!mensagem.minha && !selecionadas && <Acoes vista={vista} me={me} favorita={favoritas.has(mensagem.id)} fixada={dados.fixadas.includes(mensagem.id)} editavel={false} citar={() => citar(vista)} reagir={() => setReagindo(reagindo === mensagem.id ? null : mensagem.id)} encaminhar={() => setEncaminhando([mensagem.id])} fixar={(sim) => void fixar(mensagem.id, sim)} favoritar={(sim) => void favoritar(mensagem.id, sim)} />}
                  </div>
                </div>
              );
            })}
            <div ref={fim} />
          </div>
          {encaminhando && <Encaminhar conversas={conversas.filter((item) => item.id !== id)} quantas={encaminhando.length} fechar={() => setEncaminhando(null)} enviar={(destinos) => void encaminhar(destinos)} />}
          {galeria && (
            <Galeria
              conversa={id}
              fechar={() => setGaleria(false)}
              irPara={irPara}
              itens={vistas.flatMap((vista): ItemDaGaleria[] => (vista.conteudo?.anexos ?? []).map((anexo) => ({ mensagem: vista.mensagem.id, anexo, estado: vista.mensagem.anexos.find((estado) => estado.id === anexo.id), autor: vista.mensagem.nome, minha: vista.mensagem.minha, quando: `${new Date(vista.mensagem.criado_em).toLocaleDateString("pt-BR")} ${hora(vista.mensagem.criado_em)}` })))}
            />
          )}
          {gravando && <Gravador aoGravar={(audio) => void enviar([audio])} aoAvisar={avisarDigitando} fechar={() => setGravando(false)} />}
          <form
            className={`relative border-t border-rule bg-parchment-deep p-3 ${arrastando ? "outline outline-2 -outline-offset-4 outline-dashed outline-oxblood" : ""}`}
            onSubmit={(e) => { e.preventDefault(); void enviar(); }}
            onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setArrastando(true); } }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastando(false); void anexar([...e.dataTransfer.files]); }}
          >
            <Preparados itens={preparados} mudar={setPreparados} />
            {andamento && <p className="mb-2 text-xs text-ink-soft" aria-live="polite">{andamento}</p>}
            {citando && (
              <div className="mb-2 flex items-start gap-2 border-l-2 border-oxblood bg-parchment px-2 py-1 text-xs">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Respondendo a {citando.nome}</span>
                  <span className="block truncate text-ink-soft">{citando.trecho}</span>
                </span>
                <button type="button" className={elo} aria-label="Cancelar a citação" onClick={() => setCitando(null)}>✕</button>
              </div>
            )}
            {editando && (
              <div className="mb-2 flex items-center gap-2 border-l-2 border-gold bg-parchment px-2 py-1 text-xs">
                <span className="flex-1 font-semibold">Editando a mensagem (até 15 minutos depois de enviada)</span>
                <button type="button" className={elo} onClick={() => { setEditando(null); setTexto(getItem(chaveDoRascunho(id))); }}>Cancelar</button>
              </div>
            )}
            {sugestao && sugeridos.length > 0 && (
              <ul role="listbox" aria-label="Mencionar alguém" className="absolute bottom-full left-3 z-10 mb-1 border-2 border-ink bg-parchment text-xs shadow">
                {sugeridos.map((membro) => (
                  <li key={membro.id}>
                    <button type="button" role="option" aria-selected={false} className="block w-full cursor-pointer px-3 py-1.5 text-left hover:bg-parchment-deep" onMouseDown={(e) => { e.preventDefault(); mencionar(membro); }}>
                      @{membro.nome}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={caixa}
                value={texto}
                onChange={(e) => aoDigitar(e.target.value, e.target.selectionStart ?? e.target.value.length)}
                onBlur={() => { window.setTimeout(() => setSugestao(null), 150); avisarDigitando(""); }}
                onPaste={(e) => { const arquivos = [...e.clipboardData.files]; if (arquivos.length) { e.preventDefault(); void anexar(arquivos); } }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (sugestao && sugeridos.length > 0) mencionar(sugeridos[0]);
                    else void enviar();
                  } else if (e.key === "Escape") {
                    setSugestao(null);
                    setReagindo(null);
                    if (editando) { setEditando(null); setTexto(getItem(chaveDoRascunho(id))); }
                  }
                }}
                rows={1}
                maxLength={MAXIMO}
                aria-label={`Mensagem para ${nome}`}
                placeholder={preparados.length ? "Legenda (opcional)" : "Escreva uma mensagem (*negrito*, _itálico_, ~tachado~, `mono`, @nome)"}
                className={`${campo} mt-0 max-h-32 min-h-[2.6rem] flex-1 resize-y bg-parchment`}
              />
              {!editando && (
                <>
                  <input ref={escolha} type="file" multiple accept="image/*,video/*,audio/*,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(e) => { void anexar([...(e.target.files ?? [])]); e.target.value = ""; }} />
                  <button type="button" className={`${botaoClaro} px-2.5`} title="Anexar foto, vídeo, áudio, PDF ou DOCX (ou cole, ou arraste aqui)" aria-label="Anexar arquivo" disabled={ocupado} onClick={() => escolha.current?.click()}>📎</button>
                  <button type="button" className={`${botaoClaro} px-2.5`} title="Gravar áudio" aria-label="Gravar áudio" aria-pressed={gravando} disabled={ocupado} onClick={() => setGravando(!gravando)}>🎙</button>
                </>
              )}
              <button type="submit" className={botao} disabled={ocupado || (!texto.trim() && preparados.length === 0)}>
                {editando ? "Guardar" : ocupado && andamento ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </form>
          {aviso && <Aviso texto={aviso} />}
        </>
      )}
    </>
  );
}

/** As ações de uma mensagem, à vista ao passar o mouse ou com o teclado: responder, reagir, encaminhar, fixar, favoritar, editar, apagar. */
function Acoes({ vista, eu = false, favorita, fixada, editavel, citar, reagir, encaminhar, fixar, favoritar, editar, apagar }: {
  vista: Vista; eu?: boolean; me: Me; favorita: boolean; fixada: boolean; editavel: boolean;
  citar: () => void; reagir: () => void; encaminhar: () => void; fixar: (sim: boolean) => void; favoritar: (sim: boolean) => void; editar?: () => void; apagar?: () => void;
}) {
  const pronta = Boolean(vista.conteudo);
  const item = "cursor-pointer px-1 hover:text-oxblood";
  return (
    <span role="group" aria-label="Ações da mensagem" className={`mb-2 flex shrink-0 flex-wrap gap-0.5 text-xs text-ink-soft opacity-0 focus-within:opacity-100 group-hover:opacity-100 ${eu ? "justify-end" : ""}`}>
      <button type="button" className={item} disabled={!pronta} title="Responder" aria-label="Responder" onClick={citar}>↩</button>
      <button type="button" className={item} title="Reagir" aria-label="Reagir" onClick={reagir}>☺</button>
      <button type="button" className={item} disabled={!pronta} title="Encaminhar" aria-label="Encaminhar" onClick={encaminhar}>↪</button>
      <button type="button" className={item} title={fixada ? "Desafixar" : "Fixar"} aria-label={fixada ? "Desafixar" : "Fixar"} aria-pressed={fixada} onClick={() => fixar(!fixada)}>📌</button>
      <button type="button" className={item} title={favorita ? "Tirar das favoritas" : "Favoritar"} aria-label={favorita ? "Tirar das favoritas" : "Favoritar"} aria-pressed={favorita} onClick={() => favoritar(!favorita)}>{favorita ? "★" : "☆"}</button>
      {editavel && editar && <button type="button" className={item} disabled={!pronta} title="Editar" aria-label="Editar" onClick={editar}>✎</button>}
      {apagar && <button type="button" className={item} title="Apagar para todos" aria-label="Apagar para todos" onClick={apagar}>🗑</button>}
    </span>
  );
}

/** Escolher para quais conversas encaminhar. */
function Encaminhar({ conversas, quantas, fechar, enviar }: { conversas: Conversa[]; quantas: number; fechar: () => void; enviar: (destinos: string[]) => void }) {
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();
  return (
    <div role="dialog" aria-label="Encaminhar" className="border-t-2 border-ink bg-parchment p-3 text-sm">
      <p className="font-semibold">Encaminhar {quantas} {quantas > 1 ? "mensagens" : "mensagem"} para…</p>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} type="search" placeholder="Procurar conversa" aria-label="Procurar conversa" className={`${campo} bg-parchment-deep`} />
      <ul className="mt-2 max-h-40 overflow-y-auto border-y border-rule">
        {conversas.filter((conversa) => !termo || conversa.nome.toLowerCase().includes(termo)).map((conversa) => (
          <li key={conversa.id}>
            <label className="flex cursor-pointer items-center gap-2 px-1 py-1 hover:bg-parchment-deep">
              <input type="checkbox" className="h-4 w-4" checked={escolhidas.includes(conversa.id)} onChange={(e) => setEscolhidas(e.target.checked ? [...escolhidas, conversa.id] : escolhidas.filter((item) => item !== conversa.id))} />
              <span className="truncate">{conversa.tipo === "direta" ? conversa.nome : `# ${conversa.nome}`}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex gap-3">
        <button type="button" className={botao} disabled={escolhidas.length === 0} onClick={() => enviar(escolhidas)}>Encaminhar</button>
        <button type="button" className={elo} onClick={fechar}>Cancelar</button>
      </p>
    </div>
  );
}

interface Favorita {
  id: string;
  conversa: string;
  conversa_nome: string;
  autor: string | null;
  nome: string;
  corpo: string;
  criado_em: string;
}

/** As mensagens que a pessoa marcou com estrela, de todas as conversas. */
function Favoritas({ chaveiro, fechar, abrir }: { chaveiro: Chaveiro; fechar: () => void; abrir: (conversa: string) => void }) {
  const lista = useLista<Favorita[]>("chat_favoritas");
  const abertos = useAbertos(chaveiro, (lista.dados ?? []).map((item) => ({ id: item.id, conversa: item.conversa, corpo: item.corpo, contexto: contextoDaConversa(item.conversa, item.autor ?? ""), autor: item.autor })));
  const acao = useCallback(async (mensagem: string) => { await rpc("chat_favoritar", { p_mensagem: mensagem, p_favoritar: false }); lista.recarregar(); }, [lista]);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-semibold">Mensagens favoritas</h2>
        <button type="button" className={elo} onClick={fechar}>Fechar</button>
      </div>
      <Aviso texto={lista.erro} />
      {lista.dados?.length === 0 && <p className="mt-3 text-ink-soft">Nenhuma mensagem favorita. Use a estrela nas ações de uma mensagem.</p>}
      <ul className="mt-3 divide-y divide-rule border-y border-rule">
        {lista.dados?.map((item) => (
          <li key={item.id} className="py-2">
            <p className="text-xs text-ink-soft">
              <button type="button" className={elo} onClick={() => abrir(item.conversa)}>{item.conversa_nome || "Conversa"}</button> · {item.nome || "Alguém"} · {hora(item.criado_em)}, {new Date(item.criado_em).toLocaleDateString("pt-BR")}
            </p>
            <p className="whitespace-pre-line break-words">{abertos[item.id] ? semFormatacao(desempacotar(abertos[item.id]!.texto).texto) : "…"}</p>
            <button type="button" className={`${elo} text-xs`} onClick={() => void acao(item.id)}>Tirar das favoritas</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Quem está no grupo. Num grupo comum, quem criou (ou a coordenação) põe e tira gente, troca o nome e apaga; qualquer um sai.
 * O grupo de um departamento acompanha as funções: entra quem recebe a função, sai quem deixa de tê-la.
 */
function Grupo({ dados, me, equipe, chaveiro, conversa, depois, saiu }: { dados: Aberta; me: Me; equipe: Membro[]; chaveiro: Chaveiro; conversa: string; depois: () => void; saiu: () => void }) {
  const [nome, setNome] = useState(dados.nome);
  const [novo, setNovo] = useState("");
  const [aviso, setAviso] = useState("");
  const [seguranca, setSeguranca] = useState<{ usuario: string; nome: string } | null>(null);
  const dentro = new Set(dados.membros.map((membro) => membro.id));
  const livres = equipe.filter((membro) => !dentro.has(membro.id));
  const fixo = dados.tipo === "departamento";
  const pode = dados.dona && !fixo;
  const pessoas = chaveiro.pessoasDe(conversa);
  const verificado = (usuario: string) => pessoas.find((pessoa) => pessoa.usuario === usuario)?.verificado ?? false;

  async function fazer(funcao: string, argumentos: Record<string, unknown>, fim: () => void = depois) {
    setAviso("");
    try {
      await rpc(funcao, argumentos);
      fim();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
      {fixo && (
        <p className="max-w-xl border-l-2 border-oxblood pl-3 text-ink-soft">
          {dados.departamento === "geral"
            ? "O grupo da equipe inteira: todo mundo que tem alguma função no instituto está aqui."
            : `O grupo de ${papeis[dados.departamento as keyof typeof papeis] ?? dados.nome}. Quem recebe essa função entra sozinho, quem deixa de tê-la sai, e a coordenação participa de todos os grupos. Não dá para sair nem tirar ninguém.`}
        </p>
      )}
      {pode && (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void fazer("chat_grupo_mudar", { p_id: dados.id, p_nome: nome }); }}>
          <label className="block min-w-48 flex-1">
            Nome do grupo
            <input value={nome} onChange={(e) => setNome(e.target.value)} minLength={2} maxLength={60} className={campo} />
          </label>
          <button type="submit" className={botaoClaro} disabled={nome.trim().length < 2 || nome.trim() === dados.nome}>Guardar</button>
        </form>
      )}
      <div>
        <p className={rotulo}>{dados.membros.length} pessoas</p>
        <ul className="mt-2 divide-y divide-rule border-y border-rule">
          {dados.membros.map((membro) => (
            <li key={membro.id} className="flex items-center justify-between gap-3 py-2">
              <span className="flex min-w-0 items-center gap-3">
                <Rosto nome={membro.nome} online={Boolean(membro.online)} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {membro.nome}{membro.eu && " (você)"}
                    {!membro.eu && verificado(membro.id) && <span title="Identidade verificada pessoalmente" className="ml-1.5 font-normal text-ok">✓</span>}
                  </span>
                  <span className="block truncate text-xs text-ink-soft">
                    {presenca(membro.online, membro.visto_em)}
                    {!membro.eu && (
                      <>
                        {presenca(membro.online, membro.visto_em) ? " · " : ""}
                        <button type="button" className={elo} onClick={() => setSeguranca(seguranca?.usuario === membro.id ? null : { usuario: membro.id, nome: membro.nome })}>código de segurança</button>
                      </>
                    )}
                  </span>
                </span>
              </span>
              {pode && membro.id !== me.id && (
                <button type="button" className={elo} onClick={() => void fazer("chat_grupo_mudar", { p_id: dados.id, p_tirar: [membro.id] })}>Tirar</button>
              )}
            </li>
          ))}
        </ul>
        {seguranca && (
          <div className="mt-3">
            <Seguranca chaveiro={chaveiro} conversa={conversa} usuario={seguranca.usuario} nome={seguranca.nome} fechar={() => setSeguranca(null)} />
          </div>
        )}
      </div>
      {pode && livres.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-48 flex-1">
            Pôr mais alguém
            <select value={novo} onChange={(e) => setNovo(e.target.value)} className={campo}>
              <option value="">Escolha…</option>
              {livres.map((membro) => (
                <option key={membro.id} value={membro.id}>{membro.nome}</option>
              ))}
            </select>
          </label>
          <button type="button" className={botaoClaro} disabled={!novo} onClick={() => void fazer("chat_grupo_mudar", { p_id: dados.id, p_incluir: [novo] }, () => { setNovo(""); depois(); })}>Pôr no grupo</button>
        </div>
      )}
      {!fixo && (
        <p className="flex flex-wrap gap-5">
          <button type="button" className={elo} onClick={() => { if (window.confirm("Sair deste grupo?")) void fazer("chat_sair", { p_id: dados.id }, saiu); }}>Sair do grupo</button>
          {dados.dona && (
            <button type="button" className={`${elo} text-oxblood`} onClick={() => { if (window.confirm("Apagar o grupo e todas as mensagens dele? Isso não tem volta.")) void fazer("chat_grupo_apagar", { p_id: dados.id }, saiu); }}>
              Apagar o grupo
            </button>
          )}
        </p>
      )}
      <Aviso texto={aviso} />
    </div>
  );
}

/** Criar um grupo: um nome e as pessoas. Dá para marcar de uma vez todo mundo de uma função. */
function NovoGrupo({ membros, fechar, criado }: { membros: Membro[]; fechar: () => void; criado: (id: string) => void }) {
  const { t } = useI18n();
  const [nome, setNome] = useState("");
  const [marcados, setMarcados] = useState<string[]>([]);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const outros = membros.filter((membro) => !membro.eu);
  const funcoes = [...new Set(outros.flatMap((membro) => membro.papeis.map((papel) => papel.papel)))];
  const descricao = (membro: Membro) => [...new Set(membro.papeis.map((papel) => `${papeis[papel.papel]}${papel.disciplina ? ` de ${t.areas[papel.disciplina as keyof typeof t.areas]?.[0] ?? papel.disciplina}` : ""}`))].join(", ");

  async function criar() {
    setOcupado(true);
    setAviso("");
    try {
      criado((await rpc<{ id: string }>("chat_grupo_criar", { p_nome: nome, p_membros: marcados })).id);
    } catch (erro) {
      setAviso(textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" onSubmit={(e) => { e.preventDefault(); void criar(); }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-semibold">Novo grupo</h2>
        <button type="button" className={elo} onClick={fechar}>Cancelar</button>
      </div>
      <p className="max-w-xl text-ink-soft">Cada função já tem o próprio grupo, com todo mundo dela. Crie um grupo novo para um projeto ou uma turma de trabalho.</p>
      <label className="block max-w-md">
        Nome do grupo
        <input value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} maxLength={60} placeholder="Ex.: Aulas de frações" className={campo} />
      </label>
      <div>
        <p className={rotulo}>Marcar todo mundo de uma função</p>
        <p className="mt-2 flex flex-wrap gap-2">
          {funcoes.map((funcao) => (
            <button
              key={funcao}
              type="button"
              className="cursor-pointer border border-rule bg-parchment-deep px-3 py-1 hover:border-ink"
              onClick={() => setMarcados([...new Set([...marcados, ...outros.filter((membro) => membro.papeis.some((papel) => papel.papel === funcao)).map((membro) => membro.id)])])}
            >
              {papeis[funcao]}
            </button>
          ))}
        </p>
      </div>
      <fieldset>
        <legend className={rotulo}>Quem entra ({marcados.length})</legend>
        <ul className="mt-2 divide-y divide-rule border-y border-rule">
          {outros.map((membro) => (
            <li key={membro.id}>
              <label className="flex cursor-pointer items-center gap-3 py-2">
                <input type="checkbox" className="h-4 w-4" checked={marcados.includes(membro.id)} onChange={(e) => setMarcados(e.target.checked ? [...marcados, membro.id] : marcados.filter((item) => item !== membro.id))} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{membro.nome}</span>
                  <span className="block truncate text-xs text-ink-soft">{descricao(membro)}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <button type="submit" className={botao} disabled={ocupado || nome.trim().length < 2 || marcados.length === 0}>Criar grupo</button>
      <Aviso texto={aviso} />
    </form>
  );
}
