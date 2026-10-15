// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { rpc, type Role } from "@/lib/backend";
import { contextoDoMural } from "@/lib/sigilo";
import { safeLink } from "@/lib/text";
import { previewFile } from "@/lib/upload";
import { useI18n } from "../I18n";
import { Aviso, botao, botaoClaro, campo, data, elo, localDoPainel, papeis, rotulo, textoDoErro, useAcao, useLista } from "./comum";
import { ComoFunciona, enviarCifrado, SEM_CHAVE, useAbertos, useChaveiro } from "./Sigilo";

interface Resposta {
  id: string;
  autor: string;
  autor_id: string | null;
  meu: boolean;
  corpo: string;
  criado_em: string;
}

interface Recado extends Resposta {
  para: Role["papel"] | null;
  resolvido: boolean;
  respostas: Resposta[];
}

export interface Canais {
  sala: string;
  canais: string[];
  /** Canal → grupo do departamento cuja chave cifra o canal ("geral" e "pedidos" usam o da equipe toda). */
  conversas: Record<string, string>;
}

export interface Membro {
  id: string;
  nome: string;
  bio: string;
  eu: boolean;
  por_aqui: boolean;
  /** Com o painel aberto nos últimos dois minutos. */
  online: boolean;
  visto_em: string;
  papeis: { papel: Role["papel"]; disciplina: string | null }[];
}

const nomes: Record<string, string> = {
  geral: "Todos",
  pedidos: "Pedidos de ajuda",
  coordenacao: "Coordenação",
  curadoria: "Curadoria",
  mediacao: "Mediação",
  educacao: "Educadores",
  revisao: "Revisão",
  traducao: "Tradução",
  jornalismo: "Jornal e rádio",
  mentoria: "Reforço",
  design: "Design",
  marketing: "Marketing",
  desenvolvimento: "Desenvolvimento",
};

const funcoes: Role["papel"][] = ["design", "marketing", "desenvolvimento", "educacao", "curadoria", "mediacao", "revisao", "traducao", "jornalismo", "mentoria", "coordenacao"];
/** O texto cifrado ocupa mais espaço do que o aberto: este limite garante que ele cabe no banco. */
const MAXIMO = 2000;

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("") || "?";

/** "agora", "há 12 min", "há 3 h" ou a data, para o mural parecer uma conversa e não um relatório. */
function quando(iso: string) {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  if (minutos < 60 * 24) return `há ${Math.round(minutos / 60)} h`;
  return new Date(iso).toLocaleDateString(localDoPainel(), { day: "2-digit", month: "2-digit" });
}

function Rosto({ nome, menor = false }: { nome: string; menor?: boolean }) {
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center bg-ink font-semibold text-parchment ${menor ? "h-7 w-7 text-[0.7rem]" : "h-10 w-10"}`}>
      {iniciais(nome)}
    </span>
  );
}

/**
 * A rede interna da equipe: publicações e comentários por canal (um para todos, um por função e um de pedidos
 * de ajuda entre funções). Tudo é cifrado de ponta a ponta neste aparelho, com a chave do grupo do departamento
 * de cada canal (a mesma das Conversas), antes de ser enviado, e some depois de trinta dias.
 */
export function Equipe({ usuario, lider }: { usuario: string; lider: boolean }) {
  const { t } = useI18n();
  const canais = useLista<Canais>("equipe_canais");
  const membros = useLista<Membro[]>("equipe_membros");
  const { chaveiro, erro } = useChaveiro(usuario);
  const [canal, setCanal] = useState("geral");
  const lista = useLista<Recado[]>("equipe_listar", { p_canal: canal });
  const { recarregar } = lista;
  const acao = useAcao(recarregar);
  const [texto, setTexto] = useState("");
  const [para, setPara] = useState<Role["papel"]>("design");
  const [quem, setQuem] = useState("");
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState("");
  const dados = canais.dados;
  const conversa = dados?.conversas[canal] ?? "";
  const nomeDaArea = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "");

  // Abre no aparelho o que veio cifrado do banco.
  const abertos = useAbertos(
    chaveiro,
    conversa ? (lista.dados ?? []).flatMap((recado) => [recado, ...recado.respostas]).map((item) => ({ id: item.id, conversa, corpo: item.corpo, contexto: contextoDoMural(canal, item.autor_id ?? "") })) : [],
  );
  const lido = (item: Resposta) => (abertos[item.id] === null ? <span className="italic opacity-80">{SEM_CHAVE}</span> : <span className={item.corpo.startsWith("c1.") ? "italic opacity-80" : ""}>{abertos[item.id] ?? "…"}</span>);

  // Publicações novas aparecem sozinhas, sem a pessoa precisar recarregar.
  useEffect(() => {
    const relogio = window.setInterval(() => {
      if (document.visibilityState === "visible") recarregar();
    }, 30000);
    return () => window.clearInterval(relogio);
  }, [recarregar]);

  async function escrever(corpo: string, respostaA: string | null) {
    if (!chaveiro || !conversa) return false;
    acao.setAviso("");
    try {
      await enviarCifrado(chaveiro, conversa, corpo.trim(), contextoDoMural(canal, usuario), (cifrado) =>
        rpc("equipe_escrever", { p_canal: canal, p_corpo: cifrado, p_resposta_a: respostaA, p_para: !respostaA && canal === "pedidos" ? para : null }),
      );
      recarregar();
      return true;
    } catch (erro) {
      acao.setAviso(textoDoErro(erro));
      return false;
    }
  }

  async function apagarTudo() {
    if (!window.confirm("Apagar agora todas as conversas da equipe, de todos os canais? Isso não tem volta.")) return;
    try {
      const resposta = await rpc<{ apagadas: number }>("equipe_apagar_tudo");
      setAviso(`Tudo apagado (${resposta.apagadas} mensagens).`);
      recarregar();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }

  if (erro) return <Aviso texto={erro} />;
  if (!dados || !chaveiro) return <Aviso texto={canais.erro || "Preparando a chave deste aparelho…"} />;

  return (
    <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="min-w-0">
        <nav aria-label="Canais" className="flex flex-wrap gap-1.5">
          {dados.canais.map((id) => (
            <button key={id} type="button" onClick={() => setCanal(id)} aria-current={canal === id ? "page" : undefined} className={`cursor-pointer border px-3 py-1.5 ${canal === id ? "border-ink bg-ink text-parchment" : "border-rule bg-parchment-deep hover:border-ink"}`}>
              {nomes[id] ?? id}
            </button>
          ))}
        </nav>

        <form className="mt-4 border border-rule bg-parchment-deep p-4" onSubmit={async (e) => { e.preventDefault(); if (await escrever(texto, null)) setTexto(""); }}>
          {canal === "pedidos" && (
            <label className="mb-3 block max-w-xs">
              Preciso da ajuda de
              <select value={para} onChange={(e) => setPara(e.target.value as Role["papel"])} className={campo}>
                {funcoes.map((funcao) => (
                  <option key={funcao} value={funcao}>{papeis[funcao]}</option>
                ))}
              </select>
            </label>
          )}
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={MAXIMO} aria-label={`Publicar em ${nomes[canal] ?? canal}`} placeholder={canal === "pedidos" ? "Do que você precisa, para quando e para qual aula ou matéria." : `Escreva para ${canal === "geral" ? "toda a equipe" : (nomes[canal] ?? canal).toLowerCase()}…`} className={`${campo} mt-0 bg-parchment`} />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-ink-soft">Cifrado de ponta a ponta neste aparelho · some em 30 dias</span>
            <button type="submit" className={botao} disabled={acao.ocupado || texto.trim().length === 0}>
              {canal === "pedidos" ? "Pedir ajuda" : "Publicar"}
            </button>
          </div>
        </form>
        <Aviso texto={lista.erro || acao.aviso || aviso} />

        <ul className="mt-2 space-y-4">
          {lista.dados?.map((recado) => (
            <li key={recado.id} className={`border border-rule ${recado.resolvido ? "opacity-70" : "bg-parchment-deep"}`}>
              <div className="flex items-start gap-3 px-4 pt-4">
                <Rosto nome={recado.autor} />
                <div className="min-w-0 flex-1">
                  <p>
                    <strong>{recado.autor || "Alguém que saiu da equipe"}</strong> <span className="text-ink-soft">· {quando(recado.criado_em)}</span>
                  </p>
                  <p className="flex flex-wrap gap-1.5 text-xs">
                    {recado.para && <span className="border border-ink px-1.5 py-0.5">para {papeis[recado.para]}</span>}
                    {recado.resolvido && <span className="bg-ink px-1.5 py-0.5 text-parchment">resolvido</span>}
                  </p>
                </div>
              </div>
              <p className="whitespace-pre-line px-4 py-3 font-serif text-lg leading-snug">{lido(recado)}</p>
              {recado.respostas.length > 0 && (
                <ul className="space-y-3 border-t border-rule bg-parchment px-4 py-3">
                  {recado.respostas.map((resposta) => (
                    <li key={resposta.id} className="flex items-start gap-2.5">
                      <Rosto nome={resposta.autor} menor />
                      <div className="min-w-0">
                        <p className="text-xs">
                          <strong>{resposta.autor || "—"}</strong> <span className="text-ink-soft">· {quando(resposta.criado_em)}</span>
                        </p>
                        <p className="whitespace-pre-line">{lido(resposta)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="flex flex-wrap gap-2 border-t border-rule px-4 py-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await escrever(respostas[recado.id] ?? "", recado.id)) setRespostas({ ...respostas, [recado.id]: "" });
                }}
              >
                <input value={respostas[recado.id] ?? ""} onChange={(e) => setRespostas({ ...respostas, [recado.id]: e.target.value })} maxLength={MAXIMO} aria-label="Comentar" placeholder="Comentar…" className={`${campo} mt-0 min-w-40 flex-1 bg-parchment`} />
                <button type="submit" className={botaoClaro} disabled={acao.ocupado || !(respostas[recado.id] ?? "").trim()}>
                  Comentar
                </button>
              </form>
              <p className="flex gap-4 px-4 pb-3 text-xs text-ink-soft">
                <button type="button" className={elo} onClick={() => acao.agir("equipe_marcar", { p_id: recado.id, p_resolvido: !recado.resolvido }, "")}>
                  {recado.resolvido ? "Reabrir" : "Marcar como resolvido"}
                </button>
                {(recado.meu || lider) && (
                  <button type="button" className={elo} onClick={() => acao.agir("equipe_apagar", { p_id: recado.id }, "Publicação apagada.")}>
                    Apagar
                  </button>
                )}
              </p>
            </li>
          ))}
        </ul>
        {lista.dados?.length === 0 && <p className="mt-4 border border-rule bg-parchment-deep px-4 py-6 text-center text-ink-soft">Ninguém escreveu aqui ainda. Comece a conversa.</p>}

        <Apoios />
      </div>

      <aside className="space-y-6">
        <section>
          <h2 className={rotulo}>Quem está na equipe</h2>
          <Aviso texto={membros.erro} />
          {(membros.dados?.length ?? 0) > 8 && <input type="search" value={quem} onChange={(e) => setQuem(e.target.value)} placeholder="Filtrar por nome" aria-label="Filtrar a equipe por nome" className={campo} />}
          <ul className="mt-2 space-y-2.5">
            {membros.dados?.filter((membro) => membro.nome.toLowerCase().includes(quem.trim().toLowerCase())).map((membro) => (
              <li key={membro.id} className="flex items-start gap-2.5" title={membro.bio || undefined}>
                <span className="relative">
                  <Rosto nome={membro.nome} menor />
                  {membro.online && <span title="online" className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-parchment bg-ok" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{membro.nome}{membro.eu && " (você)"}</span>
                  <span className="block text-xs leading-snug text-ink-soft">
                    {membro.papeis.map((papel) => `${papeis[papel.papel]}${papel.disciplina ? ` de ${nomeDaArea(papel.disciplina)}` : ""}`).join(" · ")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-rule pt-4 text-ink-soft">
          <h2 className={rotulo}>Voz e vídeo</h2>
          {safeLink(dados.sala) ? (
            <p className="mt-2">
              <a href={dados.sala} target="_blank" rel="noopener noreferrer" className={elo}>Abrir a sala da equipe</a>
            </p>
          ) : (
            <p className="mt-2">Nenhuma sala indicada pela coordenação.</p>
          )}
        </section>

        <section className="space-y-2 border-t border-rule pt-4 text-xs text-ink-soft">
          <ComoFunciona />
          {lider && (
            <button type="button" className={`${elo} block text-oxblood`} onClick={() => void apagarTudo()}>
              Apagar todas as conversas agora
            </button>
          )}
        </section>
      </aside>
    </div>
  );
}

interface Arquivo {
  id: string;
  caminho: string;
  nome: string;
  status: string;
  criado_em: string;
  de: string;
  meu: boolean;
  apoios: number;
  apoiei: boolean;
}

/** Imagem ou PDF enviado por alguém da equipe só segue para a decisão da coordenação depois de dois apoios de colegas. */
function Apoios() {
  const lista = useLista<Arquivo[]>("arquivos_listar");
  const acao = useAcao(lista.recarregar);
  const esperando = lista.dados?.filter((arquivo) => arquivo.status === "pendente") ?? [];

  async function ver(caminho: string) {
    try {
      window.open(await previewFile(caminho), "_blank", "noopener,noreferrer");
    } catch {
      acao.setAviso("Não foi possível abrir o arquivo.");
    }
  }

  if (esperando.length === 0) return null;
  return (
    <section className="mt-8 border-2 border-ink p-4">
      <h2 className="font-serif text-xl font-semibold">Imagens e arquivos esperando o apoio da equipe</h2>
      <p className="mt-1 text-ink-soft">Nada que tenha imagem vai ao ar por decisão de uma pessoa só. Abra, olhe com calma e apoie se estiver correto. Com dois apoios, a coordenação pode aprovar.</p>
      <Aviso texto={lista.erro || acao.aviso} />
      <ul className="divide-y divide-rule">
        {esperando.map((arquivo) => (
          <li key={arquivo.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
            <span>
              <strong>{arquivo.nome}</strong>{" "}
              <span className="text-ink-soft">
                · {arquivo.caminho.split(".").pop()?.toUpperCase()} · {data(arquivo.criado_em)} · {arquivo.meu ? "enviado por você" : `de ${arquivo.de || "—"}`} · {arquivo.apoios} de 2 apoios
              </span>
            </span>
            <span className="flex gap-4">
              <button type="button" className={elo} onClick={() => void ver(arquivo.caminho)}>
                Ver
              </button>
              {!arquivo.meu && (
                <button type="button" className={elo} disabled={acao.ocupado} onClick={() => acao.agir("arquivo_apoiar", { p_id: arquivo.id, p_apoiar: !arquivo.apoiei }, arquivo.apoiei ? "Apoio retirado." : "Apoio registrado.")}>
                  {arquivo.apoiei ? "Retirar apoio" : "Apoiar"}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
