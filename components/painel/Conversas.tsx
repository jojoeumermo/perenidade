// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { rpc, type Me } from "@/lib/backend";
import type { Chaveiro } from "@/lib/chaveiro";
import { contextoDaConversa } from "@/lib/sigilo";
import { useI18n } from "../I18n";
import { Aviso, botao, botaoClaro, campo, elo, localDoPainel, papeis, rotulo, textoDoErro, useLista } from "./comum";
import type { Membro } from "./Equipe";
import { Aparelhos, ComoFunciona, enviarCifrado, SEM_CHAVE, useAbertos, useChaveiro } from "./Sigilo";

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
  membros: { id: string; nome: string; eu: boolean; online: boolean; visto_em: string; lido_em: string }[];
  mensagens: Mensagem[];
}

const MAXIMO = 2000;
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

const hora = (iso: string) => new Date(iso).toLocaleTimeString(localDoPainel(), { hour: "2-digit", minute: "2-digit" });
const diaDe = (iso: string) => new Date(iso).toLocaleDateString(localDoPainel(), { weekday: "long", day: "2-digit", month: "long" });

/** "some em 40 min", "some em 5 h", "some em 3 dias". */
function restante(iso: string) {
  const minutos = Math.max(1, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
  if (minutos < 60) return `some em ${minutos} min`;
  if (minutos < 60 * 24) return `some em ${Math.round(minutos / 60)} h`;
  return `some em ${Math.round(minutos / 1440)} dias`;
}

/** "online", "visto por último há 12 min", "visto por último ontem às 21:40"… */
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
  return `visto por último em ${quando.toLocaleDateString(localDoPainel(), { day: "2-digit", month: "2-digit" })}`;
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
  const [novoGrupo, setNovoGrupo] = useState(false);
  const [aviso, setAviso] = useState("");
  useRelogio(lista.recarregar, 8000);
  useRelogio(membros.recarregar, 30000);
  const previas = useAbertos(
    chaveiro,
    (lista.dados ?? []).flatMap((conversa) =>
      conversa.ultima ? [{ id: `${conversa.id}:${conversa.ultima.criado_em}`, conversa: conversa.id, corpo: conversa.ultima.corpo, contexto: contextoDaConversa(conversa.id, conversa.ultima.autor_id ?? "") }] : [],
    ),
  );

  if (erro) return <Aviso texto={erro} />;
  if (!chaveiro) return <Aviso texto="Preparando a chave deste aparelho…" />;

  const termo = busca.trim().toLowerCase();
  const conversas = (lista.dados ?? []).filter((conversa) => !termo || conversa.nome.toLowerCase().includes(termo));
  const comConversa = new Set((lista.dados ?? []).flatMap((conversa) => (conversa.outro ? [conversa.outro] : [])));
  const pessoas = (membros.dados ?? []).filter((membro) => !membro.eu && (termo ? membro.nome.toLowerCase().includes(termo) : !comConversa.has(membro.id)));

  async function conversarCom(usuario: string) {
    setAviso("");
    try {
      const { id } = await rpc<{ id: string }>("chat_direta", { p_usuario: usuario });
      setBusca("");
      setNovoGrupo(false);
      setAberta(id);
      lista.recarregar();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }

  function previa(conversa: Conversa) {
    if (!conversa.ultima) return conversa.tipo === "direta" ? "Nenhuma mensagem ainda" : `${conversa.membros} pessoas`;
    const quem = conversa.ultima.minha ? "Você: " : conversa.tipo !== "direta" ? `${conversa.ultima.autor.split(" ")[0]}: ` : "";
    return `${quem}${previas[`${conversa.id}:${conversa.ultima.criado_em}`] ?? (conversa.ultima.corpo.startsWith("c1.") ? "mensagem antiga" : "…")}`;
  }

  return (
    <div className="grid h-[calc(100dvh-16.5rem)] min-h-[18rem] lg:min-h-[24rem] border border-rule lg:h-[calc(100dvh-12.5rem)] lg:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className={`flex min-h-0 flex-col border-rule bg-parchment-deep lg:border-r ${aberta || novoGrupo ? "hidden lg:flex" : "flex"}`}>
        <div className="space-y-2 border-b border-rule p-3">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} type="search" placeholder="Procurar pessoa ou conversa" aria-label="Procurar pessoa ou conversa" className={`${campo} mt-0 bg-parchment`} />
          <button type="button" className={`${botaoClaro} w-full py-1.5`} onClick={() => { setNovoGrupo(true); setAberta(null); }}>
            Novo grupo
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
          {(lista.erro || membros.erro || aviso) && <Aviso texto={lista.erro || membros.erro || aviso} />}
          <ul>
            {conversas.map((conversa) => (
              <li key={conversa.id}>
                <button
                  type="button"
                  onClick={() => { setAberta(conversa.id); setNovoGrupo(false); }}
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
                      <span className="truncate text-ink-soft">{previa(conversa)}</span>
                      {conversa.nao_lidas > 0 && <span className="shrink-0 bg-oxblood px-1.5 py-0.5 font-mono text-[0.7rem] font-semibold leading-none text-parchment">{conversa.nao_lidas}</span>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {pessoas.length > 0 && (
            <>
              <p className={`${rotulo} px-3 pb-1 pt-4`}>{termo ? "Pessoas" : "Começar uma conversa"}</p>
              <ul>
                {pessoas.map((membro) => (
                  <li key={membro.id}>
                    <button type="button" onClick={() => void conversarCom(membro.id)} className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-parchment">
                      <Rosto nome={membro.nome} online={membro.online} />
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
        <div className="space-y-2 border-t border-rule p-3">
          <ComoFunciona />
          <Aparelhos atual={chaveiro.aparelho} />
        </div>
      </aside>

      <section className={`min-h-0 min-w-0 flex-col bg-parchment ${aberta || novoGrupo ? "flex" : "hidden lg:flex"}`}>
        {novoGrupo ? (
          <NovoGrupo membros={membros.dados ?? []} fechar={() => setNovoGrupo(false)} criado={(id) => { setNovoGrupo(false); setAberta(id); lista.recarregar(); }} />
        ) : aberta ? (
          <Janela
            key={aberta}
            id={aberta}
            chaveiro={chaveiro}
            me={me}
            equipe={membros.dados ?? []}
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

/** Uma conversa aberta: as mensagens, quem está por aqui, a autodestruição e a caixa de escrever. */
function Janela({ id, chaveiro, me, equipe, resumo, voltar, mudou }: { id: string; chaveiro: Chaveiro; me: Me; equipe: Membro[]; resumo?: Conversa; voltar: () => void; mudou: () => void }) {
  const conversa = useLista<Aberta>("chat_ver", { p_id: id });
  const { recarregar } = conversa;
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [gerir, setGerir] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  useRelogio(recarregar, 3000);
  const dados = conversa.dados;
  // Mensagem com autodestruição some da tela no prazo, mesmo antes de o banco apagá-la.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(Date.now()), 5000);
    return () => window.clearInterval(relogio);
  }, []);
  const mensagens = (dados?.mensagens ?? []).filter((mensagem) => !mensagem.expira_em || new Date(mensagem.expira_em).getTime() > agora);
  const abertos = useAbertos(chaveiro, mensagens.map((mensagem) => ({ id: mensagem.id, conversa: id, corpo: mensagem.corpo, contexto: contextoDaConversa(id, mensagem.autor ?? "") })));
  const ultima = mensagens.at(-1)?.id;

  // Mensagem nova: a conversa rola sozinha até o fim.
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [ultima]);

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
  const minhas = mensagens.filter((mensagem) => mensagem.minha);
  const vistaPeloOutro = outro && minhas.length > 0 && outro.lido_em >= minhas[minhas.length - 1].criado_em;

  async function enviar() {
    const limpo = texto.trim();
    if (!limpo || ocupado) return;
    setOcupado(true);
    setAviso("");
    try {
      await enviarCifrado(chaveiro, id, limpo, contextoDaConversa(id, me.id), (corpo) => rpc("chat_enviar", { p_id: id, p_corpo: corpo }));
      setTexto("");
      recarregar();
      mudou();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  async function apagar(mensagem: string) {
    try {
      await rpc("chat_apagar", { p_id: mensagem });
      recarregar();
      mudou();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }

  async function autodestruir(segundos: number) {
    setAviso("");
    try {
      await rpc("chat_autodestruir", { p_id: id, p_segundos: segundos });
      recarregar();
      mudou();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }

  return (
    <>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule bg-parchment-deep px-3 py-2.5">
        <button type="button" aria-label="Voltar às conversas" className="cursor-pointer px-1 text-xl lg:hidden" onClick={voltar}>←</button>
        <Rosto nome={nome} online={Boolean(outro?.online)} tipo={dados.tipo} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{nome}</p>
          <p className="truncate text-xs text-ink-soft">
            {outro
              ? presenca(outro.online, outro.visto_em)
              : `${dados.tipo === "departamento" ? "Grupo do departamento · " : ""}${dados.membros.length} pessoas · ${dados.membros.filter((membro) => membro.online).length} online`}
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
        {dados.tipo !== "direta" && (
          <button type="button" className={elo} aria-expanded={gerir} onClick={() => setGerir(!gerir)}>
            {gerir ? "Fechar" : "Pessoas"}
          </button>
        )}
      </header>

      {gerir && dados.tipo !== "direta" ? (
        <Grupo dados={dados} me={me} equipe={equipe} depois={() => { recarregar(); mudou(); }} saiu={voltar} />
      ) : (
        <>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-4 [scrollbar-width:thin]" aria-live="polite">
            {dados.apagar_apos && (
              <p className="mx-auto mb-3 max-w-md border border-rule bg-parchment-deep px-3 py-2 text-center text-xs text-ink-soft">
                Autodestruição ligada{dados.apagar_por ? ` por ${dados.apagar_por}` : ""}: as mensagens enviadas desde então somem {nomeDoPrazo(dados.apagar_apos)} depois de enviadas.
              </p>
            )}
            {mensagens.length === 0 && <p className="py-10 text-center text-ink-soft">{dados.tipo === "departamento" ? "Ninguém escreveu aqui ainda. Todo mundo dessa função lê o que for escrito." : "Nenhuma mensagem ainda. Diga oi."}</p>}
            {mensagens.map((mensagem, indice) => {
              const anterior = mensagens[indice - 1];
              const outroDia = !anterior || new Date(anterior.criado_em).toDateString() !== new Date(mensagem.criado_em).toDateString();
              const mostraNome = dados.tipo !== "direta" && !mensagem.minha && (outroDia || anterior?.autor !== mensagem.autor);
              return (
                <div key={mensagem.id}>
                  {outroDia && <p className="py-2 text-center text-xs uppercase tracking-widest text-ink-soft">{diaDe(mensagem.criado_em)}</p>}
                  <div className={`group flex items-end gap-2 ${mensagem.minha ? "justify-end" : "justify-start"}`}>
                    {mensagem.minha && (
                      <button type="button" className="cursor-pointer text-xs text-ink-soft underline opacity-0 hover:text-oxblood focus:opacity-100 group-hover:opacity-100" onClick={() => void apagar(mensagem.id)}>
                        apagar
                      </button>
                    )}
                    <div className={`max-w-[80%] px-3 py-1.5 sm:max-w-[70%] ${mensagem.minha ? "bg-ink text-parchment" : "border border-rule bg-parchment-deep"}`}>
                      {mostraNome && <p className="text-xs font-semibold text-gold">{mensagem.nome}</p>}
                      <p
                        // O que a pessoa escreveu fica como escrito, em qualquer idioma do painel; os avisos do sistema se traduzem.
                        translate={typeof abertos[mensagem.id] === "string" ? "no" : undefined}
                        className={`whitespace-pre-line break-words ${typeof abertos[mensagem.id] !== "string" || mensagem.corpo.startsWith("c1.") ? "italic opacity-80" : ""}`}
                      >
                        {abertos[mensagem.id] === null ? SEM_CHAVE : (abertos[mensagem.id] ?? "…")}
                      </p>
                      <p className={`text-right text-[0.65rem] leading-tight ${mensagem.minha ? "text-parchment/70" : "text-ink-soft"}`}>
                        {mensagem.expira_em && <span title={`Autodestruição: ${new Date(mensagem.expira_em).toLocaleString(localDoPainel())}`}>⏱ {restante(mensagem.expira_em)} · </span>}
                        {hora(mensagem.criado_em)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            {vistaPeloOutro && <p className="text-right text-xs text-ink-soft">Vista</p>}
            <div ref={fim} />
          </div>
          <form className="flex items-end gap-2 border-t border-rule bg-parchment-deep p-3" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviar();
                }
              }}
              // Com o teclado do celular aberto, a caixa de escrever e a última mensagem ficam à vista.
              onFocus={(e) => {
                const formulario = e.currentTarget.form;
                setTimeout(() => {
                  fim.current?.scrollIntoView({ block: "end" });
                  formulario?.scrollIntoView({ block: "end" });
                }, 300);
              }}
              rows={1}
              maxLength={MAXIMO}
              aria-label={`Mensagem para ${nome}`}
              placeholder="Escreva uma mensagem"
              className={`${campo} mt-0 max-h-32 min-h-[2.6rem] flex-1 resize-y bg-parchment`}
            />
            <button type="submit" className={botao} disabled={ocupado || !texto.trim()}>
              Enviar
            </button>
          </form>
          {aviso && <Aviso texto={aviso} />}
        </>
      )}
    </>
  );
}

/**
 * Quem está no grupo. Num grupo comum, quem criou (ou a coordenação) põe e tira gente, troca o nome e apaga; qualquer um sai.
 * O grupo de um departamento acompanha as funções: entra quem recebe a função, sai quem deixa de tê-la.
 */
function Grupo({ dados, me, equipe, depois, saiu }: { dados: Aberta; me: Me; equipe: Membro[]; depois: () => void; saiu: () => void }) {
  const [nome, setNome] = useState(dados.nome);
  const [novo, setNovo] = useState("");
  const [aviso, setAviso] = useState("");
  const dentro = new Set(dados.membros.map((membro) => membro.id));
  const livres = equipe.filter((membro) => !dentro.has(membro.id));
  const fixo = dados.tipo === "departamento";
  const pode = dados.dona && !fixo;

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
                <Rosto nome={membro.nome} online={membro.online} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{membro.nome}{membro.eu && " (você)"}</span>
                  <span className="block truncate text-xs text-ink-soft">{presenca(membro.online, membro.visto_em)}</span>
                </span>
              </span>
              {pode && membro.id !== me.id && (
                <button type="button" className={elo} onClick={() => void fazer("chat_grupo_mudar", { p_id: dados.id, p_tirar: [membro.id] })}>Tirar</button>
              )}
            </li>
          ))}
        </ul>
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
