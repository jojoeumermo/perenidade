// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { type Me, rpc } from "@/lib/backend";
import { EMOJIS_DO_INSTITUTO } from "@/lib/emojis-do-instituto";
import { useI18n } from "../I18n";
import { Avatar } from "./Avatar";
import { papeis, textoDoErro } from "./comum";
import { EmojiDoInstituto } from "./EmojiDoInstituto";
import type { Membro } from "./Equipe";

// As peças das Conversas no jeito do Stoat (gatilho "Chat Interno"): o cartão de perfil com capa, presença, frase e
// emblemas; o "meu status"; os amigos (que liberam a conversa privada com o aceite dos dois); os convites para grupos;
// e os comandos com barra, que fazem o papel dos robôs (o servidor não lê as conversas cifradas: quem "fala" é quem
// digitou o comando, do próprio aparelho). O banco está em supabase/install.sql, "Conversas no jeito do Stoat".

export type Presenca = "online" | "ausente" | "ocupado" | "invisivel";
export const CORES_DE_PRESENCA: Record<Presenca, string> = { online: "#3abf7e", ausente: "#f39f00", ocupado: "#f84848", invisivel: "#a5a5a5" };
export const NOMES_DE_PRESENCA: Record<Presenca, string> = { online: "Online", ausente: "Ausente", ocupado: "Não perturbe", invisivel: "Invisível" };
export const CAPAS: Record<string, string> = {
  vermelho: "linear-gradient(135deg, #c21f16, #fd6671)",
  noite: "linear-gradient(135deg, #141414, #3d3d3d)",
  ouro: "linear-gradient(135deg, #8a5f1c, #faa352)",
  verde: "linear-gradient(135deg, #1f5c3a, #3abf7e)",
  azul: "linear-gradient(135deg, #1f3a5f, #5b8def)",
  roxo: "linear-gradient(135deg, #4b2a6b, #a77bd6)",
  rosa: "linear-gradient(135deg, #8a2a55, #f08fb8)",
  pergaminho: "linear-gradient(135deg, #d5c398, #f6efdd)",
};

/** A bolinha de presença, com a cor do Stoat. */
export function Bolinha({ presenca, online, borda = "border-s-lado", className = "h-3 w-3" }: { presenca?: string; online?: boolean | null; borda?: string; className?: string }) {
  if (!online) return null;
  const p = (presenca ?? "online") as Presenca;
  return <span className={`absolute -right-0.5 -bottom-0.5 rounded-full border-2 ${borda} ${className}`} style={{ backgroundColor: CORES_DE_PRESENCA[p] ?? CORES_DE_PRESENCA.online }} title={NOMES_DE_PRESENCA[p]} />;
}

/** O cartão de perfil (clicar no nome ou na foto): capa, presença, frase, emblemas, apresentação e ofícios. */
export function CartaoDePerfil({ membro, me, fechar, conversar }: { membro: Membro; me: Me; fechar: () => void; conversar: (id: string) => void }) {
  const [amizade, setAmizade] = useState<"amigos" | "pedido" | "recebido" | "nada" | null>(null);
  const [aviso, setAviso] = useState("");
  const eu = membro.id === me.id;
  useEffect(() => {
    if (eu) return;
    rpc<{ amigos: { id: string }[]; recebidos: { id: string }[]; enviados: { id: string }[] }>("amizades_listar")
      .then((r) => setAmizade(r.amigos.some((a) => a.id === membro.id) ? "amigos" : r.enviados.some((a) => a.id === membro.id) ? "pedido" : r.recebidos.some((a) => a.id === membro.id) ? "recebido" : "nada"))
      .catch(() => setAmizade("nada"));
  }, [membro.id, eu]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [fechar]);
  const presenca = (membro.presenca ?? "online") as Presenca;
  const desde = membro.desde ? new Date(membro.desde).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "";
  const emblemas = [...new Set(membro.papeis.map((p) => papeis[p.papel] ?? p.papel))];
  async function pedir() {
    setAviso("");
    try {
      const r = await rpc<{ aceita: boolean }>("amizade_pedir", { p_para: membro.id });
      setAmizade(r.aceita ? "amigos" : "pedido");
    } catch (e) {
      setAviso(textoDoErro(e));
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={fechar}>
      <div role="dialog" aria-modal="true" aria-label={`Perfil de ${membro.nome}`} className="w-full max-w-sm overflow-hidden rounded-xl bg-s-lado text-s-texto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="h-24" style={{ background: CAPAS[membro.capa ?? "vermelho"] ?? CAPAS.vermelho }} />
        <div className="px-4 pb-4">
          <div className="-mt-10 flex items-end justify-between">
            <span className="relative">
              <Avatar nome={membro.nome} avatar={membro.avatar} className="h-20 w-20 rounded-full border-[6px] border-[var(--s-lado)]" texto="text-xl" />
              <Bolinha presenca={presenca} online={membro.online} borda="border-[var(--s-lado)]" className="h-5 w-5 right-1 bottom-1" />
            </span>
            <button type="button" onClick={fechar} className="mb-1 cursor-pointer rounded-full bg-black/30 px-2.5 py-1 text-xs hover:bg-black/50" aria-label="Fechar">✕</button>
          </div>
          <p className="mt-2 text-xl font-bold leading-tight">{membro.nome}</p>
          <p className="text-sm text-s-suave">{membro.online ? NOMES_DE_PRESENCA[presenca] : "Fora agora"}</p>
          {membro.frase && <p className="mt-1 text-sm">{membro.frase}</p>}
          {emblemas.length > 0 && (
            <div className="mt-3 rounded-lg bg-s-trilho p-3">
              <p className="text-[0.68rem] font-bold uppercase tracking-wider text-s-mudo">Emblemas</p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {emblemas.map((e) => (
                  <li key={e} className="flex items-center gap-1 rounded-md bg-s-campo px-2 py-0.5 text-xs">
                    <EmojiDoInstituto nome="estrela" className="h-3 w-3" />
                    {e}
                  </li>
                ))}
                {desde && <li className="rounded-md bg-s-campo px-2 py-0.5 text-xs">Na equipe desde {desde}</li>}
              </ul>
            </div>
          )}
          {membro.bio && (
            <div className="mt-3 rounded-lg bg-s-trilho p-3">
              <p className="text-[0.68rem] font-bold uppercase tracking-wider text-s-mudo">Sobre</p>
              <p className="mt-1 whitespace-pre-line text-sm" data-original>{membro.bio}</p>
            </div>
          )}
          {membro.oficios && membro.oficios.length > 0 && (
            <div className="mt-3 rounded-lg bg-s-trilho p-3">
              <p className="text-[0.68rem] font-bold uppercase tracking-wider text-s-mudo">Sabe fazer</p>
              <p className="mt-1 text-sm">{membro.oficios.join(" · ")}</p>
            </div>
          )}
          {!eu && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="flex-1 cursor-pointer rounded-md bg-s-acento px-3 py-2 text-sm font-semibold text-white hover:brightness-110" onClick={() => { fechar(); conversar(membro.id); }}>
                Mandar mensagem
              </button>
              {amizade === "nada" && <button type="button" className="cursor-pointer rounded-md bg-s-campo px-3 py-2 text-sm font-semibold hover:bg-[var(--s-ativo)]" onClick={() => void pedir()}>Pedir amizade</button>}
              {amizade === "recebido" && <button type="button" className="cursor-pointer rounded-md bg-s-ok px-3 py-2 text-sm font-semibold text-black" onClick={() => void pedir()}>Aceitar a amizade</button>}
              {amizade === "pedido" && <span className="rounded-md bg-s-campo px-3 py-2 text-sm text-s-suave">Pedido enviado</span>}
              {amizade === "amigos" && <span className="rounded-md bg-s-campo px-3 py-2 text-sm text-s-ok">Amigos</span>}
            </div>
          )}
          {aviso && <p className="mt-2 text-xs text-s-acento-suave">{aviso}</p>}
        </div>
      </div>
    </div>
  );
}

/** O "meu status" da barrinha de baixo: presença, frase e a capa do cartão. */
export function MeuStatus({ fechar, mudou }: { fechar: () => void; mudou: (presenca: Presenca) => void }) {
  const [presenca, setPresenca] = useState<Presenca>("online");
  const [frase, setFrase] = useState("");
  const [capa, setCapa] = useState("vermelho");
  const [aviso, setAviso] = useState("");
  useEffect(() => {
    rpc<{ presenca: Presenca; frase: string; capa: string }>("chat_perfil_meu")
      .then((r) => {
        setPresenca(r.presenca);
        setFrase(r.frase);
        setCapa(r.capa);
      })
      .catch(() => undefined);
  }, []);
  async function guardar(proxima: Presenca = presenca) {
    setAviso("");
    try {
      await rpc("chat_perfil_salvar", { p_presenca: proxima, p_frase: frase, p_capa: capa });
      mudou(proxima);
      fechar();
    } catch (e) {
      setAviso(textoDoErro(e));
    }
  }
  return (
    <div role="dialog" aria-label="Meu status" className="absolute bottom-14 left-2 z-40 w-72 rounded-xl bg-s-trilho p-3 text-sm shadow-2xl">
      <p className="text-[0.68rem] font-bold uppercase tracking-wider text-s-mudo">Presença</p>
      <ul className="mt-1">
        {(Object.keys(NOMES_DE_PRESENCA) as Presenca[]).map((p) => (
          <li key={p}>
            <button type="button" onClick={() => setPresenca(p)} aria-pressed={presenca === p} className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left ${presenca === p ? "bg-[var(--s-ativo)]" : "hover:bg-[var(--s-hover)]"}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CORES_DE_PRESENCA[p] }} />
              {NOMES_DE_PRESENCA[p]}
              {p === "invisivel" && <span className="ml-auto text-[0.68rem] text-s-mudo">aparece como fora</span>}
            </button>
          </li>
        ))}
      </ul>
      <label className="mt-2 block">
        <span className="text-[0.68rem] font-bold uppercase tracking-wider text-s-mudo">Frase de status</span>
        <input value={frase} onChange={(e) => setFrase(e.target.value)} maxLength={80} placeholder="Escrevendo a aula de frações" className="mt-1 w-full rounded-md bg-s-campo px-2.5 py-1.5 text-s-texto outline-none placeholder:text-s-mudo focus:outline-2 focus:outline-s-acento" />
      </label>
      <p className="mt-2 text-[0.68rem] font-bold uppercase tracking-wider text-s-mudo">Capa do cartão</p>
      <p className="mt-1 flex flex-wrap gap-1.5">
        {Object.entries(CAPAS).map(([id, fundo]) => (
          <button key={id} type="button" onClick={() => setCapa(id)} aria-label={`Capa ${id}`} aria-pressed={capa === id} className={`h-7 w-7 cursor-pointer rounded-md ${capa === id ? "ring-2 ring-[var(--s-texto)] ring-offset-2 ring-offset-[var(--s-trilho)]" : ""}`} style={{ background: fundo }} />
        ))}
      </p>
      {aviso && <p className="mt-2 text-xs text-s-acento-suave">{aviso}</p>}
      <p className="mt-3 flex justify-end gap-2">
        <button type="button" className="cursor-pointer rounded-md px-3 py-1.5 text-s-suave hover:text-s-texto" onClick={fechar}>Cancelar</button>
        <button type="button" className="cursor-pointer rounded-md bg-s-acento px-3 py-1.5 font-semibold text-white hover:brightness-110" onClick={() => void guardar()}>Guardar</button>
      </p>
    </div>
  );
}

interface Amizades {
  amigos: { id: string; nome: string; avatar?: string | null; frase: string; presenca: Presenca; online: boolean }[];
  recebidos: { id: string; nome: string; avatar?: string | null }[];
  enviados: { id: string; nome: string; avatar?: string | null }[];
}

/** Os amigos, nas mensagens diretas: pedidos recebidos, quem é amigo e o "adicionar amigo". */
export function Amigos({ equipe, conversar }: { equipe: Membro[]; conversar: (id: string) => void }) {
  const [dados, setDados] = useState<Amizades | null>(null);
  const [busca, setBusca] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    rpc<Amizades>("amizades_listar").then(setDados).catch(() => setDados({ amigos: [], recebidos: [], enviados: [] }));
  }, [versao]);
  const fazer = async (funcao: string, args: Record<string, unknown>, ok: string) => {
    setAviso("");
    try {
      await rpc(funcao, args);
      setAviso(ok);
      setVersao((v) => v + 1);
    } catch (e) {
      setAviso(textoDoErro(e));
    }
  };
  if (!dados) return null;
  const conhecidos = new Set([...dados.amigos, ...dados.recebidos, ...dados.enviados].map((a) => a.id));
  const candidatos = equipe.filter((m) => !m.eu && !conhecidos.has(m.id) && (!busca.trim() || m.nome.toLowerCase().includes(busca.trim().toLowerCase()))).slice(0, 8);
  return (
    <>
      {dados.recebidos.map((a) => (
        <li key={`r-${a.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5">
          <Avatar nome={a.nome} avatar={a.avatar} className="h-7 w-7 rounded-full" />
          <span className="min-w-0 flex-1 truncate text-sm">{a.nome}<span className="block text-[0.66rem] text-s-mudo">quer ser seu amigo</span></span>
          <button type="button" className="cursor-pointer rounded-md bg-s-ok px-2 py-0.5 text-xs font-semibold text-black" onClick={() => void fazer("amizade_responder", { p_de: a.id, p_aceitar: true }, `Você e ${a.nome} agora são amigos.`)}>Aceitar</button>
          <button type="button" className="cursor-pointer rounded-md px-1.5 py-0.5 text-xs text-s-mudo hover:text-s-texto" aria-label={`Recusar ${a.nome}`} onClick={() => void fazer("amizade_responder", { p_de: a.id, p_aceitar: false }, "Pedido recusado.")}>✕</button>
        </li>
      ))}
      {dados.amigos.map((a) => (
        <li key={`a-${a.id}`}>
          <button type="button" onClick={() => conversar(a.id)} className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-s-suave hover:bg-[var(--s-hover)] hover:text-s-texto">
            <span className="relative shrink-0">
              <Avatar nome={a.nome} avatar={a.avatar} className="h-7 w-7 rounded-full" />
              <Bolinha presenca={a.presenca} online={a.online} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{a.nome}</span>
              {a.frase && <span className="block truncate text-[0.66rem] text-s-mudo">{a.frase}</span>}
            </span>
          </button>
        </li>
      ))}
      {dados.enviados.length > 0 && <li className="px-2 py-1 text-[0.68rem] text-s-mudo">Esperando resposta: {dados.enviados.map((a) => a.nome).join(", ")}</li>}
      {dados.amigos.length === 0 && dados.recebidos.length === 0 && <li className="px-2 py-1 text-xs text-s-mudo">Amizade aceita libera a conversa privada entre os dois.</li>}
      <li className="px-1 pt-1">
        {adicionando ? (
          <div className="rounded-md bg-s-trilho p-2">
            <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar na equipe" aria-label="Procurar alguém para pedir amizade" className="h-7 w-full rounded bg-s-campo px-2 text-sm text-s-texto outline-none placeholder:text-s-mudo" />
            <ul className="mt-1">
              {candidatos.map((m) => (
                <li key={m.id}>
                  <button type="button" className="flex w-full cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-[var(--s-ativo)]" onClick={() => void fazer("amizade_pedir", { p_para: m.id }, `Pedido de amizade enviado a ${m.nome}.`)}>
                    <Avatar nome={m.nome} avatar={m.avatar} className="h-5 w-5 rounded-full" />
                    <span className="truncate">{m.nome}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="mt-1 cursor-pointer text-xs text-s-mudo hover:text-s-texto" onClick={() => setAdicionando(false)}>Fechar</button>
          </div>
        ) : (
          <button type="button" className="w-full cursor-pointer rounded-md bg-s-trilho px-2 py-1.5 text-left text-xs font-semibold text-s-suave hover:text-s-texto" onClick={() => setAdicionando(true)}>
            ＋ Adicionar amigo
          </button>
        )}
        {aviso && <p className="mt-1 px-1 text-[0.68rem] text-s-suave">{aviso}</p>}
      </li>
    </>
  );
}

/** No grupo: gerar um convite (um link que vale alguns dias). */
export function ConviteDoGrupo({ conversa }: { conversa: string }) {
  const { lang } = useI18n();
  const [link, setLink] = useState("");
  const [dias, setDias] = useState(7);
  const [aviso, setAviso] = useState("");
  async function gerar() {
    setAviso("");
    try {
      const r = await rpc<{ codigo: string }>("chat_convite_criar", { p_conversa: conversa, p_dias: dias });
      setLink(`${window.location.origin}/${lang}/painel?aba=conversas&convite=${r.codigo}`);
    } catch (e) {
      setAviso(textoDoErro(e));
    }
  }
  return (
    <section className="rounded-lg border border-s-linha p-3">
      <h4 className="font-semibold">Convidar com um link</h4>
      <p className="mt-0.5 text-xs text-s-mudo">Quem é da equipe e abrir o link entra no grupo. As mensagens aparecem para a pessoa assim que alguém do grupo abrir o painel (a cifra repassa a chave).</p>
      {link ? (
        <p className="mt-2 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded bg-s-trilho px-2 py-1 text-xs">{link}</code>
          <button type="button" className="cursor-pointer rounded-md bg-s-acento px-2.5 py-1 text-xs font-semibold text-white" onClick={() => void navigator.clipboard?.writeText(link).then(() => setAviso("Link copiado."), () => setAviso(link))}>Copiar</button>
        </p>
      ) : (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          Vale por
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className="rounded bg-s-trilho px-2 py-1">
            <option value={1}>1 dia</option>
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
          </select>
          <button type="button" className="cursor-pointer rounded-md bg-s-acento px-3 py-1 text-xs font-semibold text-white" onClick={() => void gerar()}>Gerar o link</button>
        </p>
      )}
      {aviso && <p className="mt-1 text-xs text-s-suave">{aviso}</p>}
    </section>
  );
}

/** Quem abre o painel com ?convite=…: o aviso do convite e o botão de entrar. */
export function EntrarPorConvite({ entrar }: { entrar: (conversa: string) => void }) {
  const [codigo] = useState(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("convite")));
  const [dados, setDados] = useState<{ valido: boolean; conversa?: string; nome?: string; membros?: number; ja_estou?: boolean; de?: string } | null>(null);
  const [aviso, setAviso] = useState("");
  const [fechado, setFechado] = useState(false);
  useEffect(() => {
    if (!codigo || !/^[A-Za-z0-9]{10}$/.test(codigo)) return;
    rpc<typeof dados>("chat_convite_ver", { p_codigo: codigo }).then(setDados).catch((e) => setAviso(textoDoErro(e)));
  }, [codigo]);
  if (!codigo || fechado || (!dados && !aviso)) return null;
  const tirarDoEndereco = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("convite");
    window.history.replaceState(null, "", url.toString());
  };
  return (
    <div className="absolute inset-x-0 top-0 z-40 m-3 rounded-xl bg-s-trilho p-4 text-sm shadow-2xl">
      {aviso ? (
        <p>{aviso}</p>
      ) : dados && !dados.valido ? (
        <p>Este convite venceu ou já foi usado até o limite. Peça outro a quem convidou.</p>
      ) : dados ? (
        <>
          <p className="text-[0.68rem] font-bold uppercase tracking-wider text-s-mudo">Convite{dados.de ? ` de ${dados.de}` : ""}</p>
          <p className="mt-1 text-lg font-bold">{dados.nome}</p>
          <p className="text-s-suave">{dados.membros} {dados.membros === 1 ? "pessoa" : "pessoas"} no grupo</p>
          <p className="mt-3 flex gap-2">
            <button
              type="button"
              className="cursor-pointer rounded-md bg-s-acento px-4 py-2 font-semibold text-white hover:brightness-110"
              onClick={async () => {
                try {
                  const r = await rpc<{ conversa: string }>("chat_convite_usar", { p_codigo: codigo });
                  tirarDoEndereco();
                  setFechado(true);
                  entrar(r.conversa);
                } catch (e) {
                  setAviso(textoDoErro(e));
                }
              }}
            >
              {dados.ja_estou ? "Abrir o grupo" : "Entrar no grupo"}
            </button>
            <button type="button" className="cursor-pointer rounded-md px-3 py-2 text-s-suave hover:text-s-texto" onClick={() => { tirarDoEndereco(); setFechado(true); }}>Agora não</button>
          </p>
        </>
      ) : null}
    </div>
  );
}

// ───── Comandos com barra (os "robôs") ─────

export const COMANDOS: { nome: string; uso: string; sobre: string }[] = [
  { nome: "ajuda", uso: "/ajuda", sobre: "Mostra os comandos." },
  { nome: "tarefa", uso: "/tarefa o que fazer", sobre: "Põe um cartão no quadro da semana do seu departamento e avisa aqui." },
  { nome: "pauta", uso: "/pauta a ideia", sobre: "Põe a ideia no banco de pautas e avisa aqui." },
  { nome: "enquete", uso: "/enquete", sobre: "Abre o criador de enquete (em grupo)." },
  { nome: "evento", uso: "/evento", sobre: "Abre o criador de evento (em grupo)." },
  { nome: "dado", uso: "/dado", sobre: "Joga um dado de seis lados." },
  { nome: "moeda", uso: "/moeda", sobre: "Cara ou coroa." },
  { nome: "emojis", uso: "/emojis", sobre: "Lista os emojis do instituto (use :nome: na mensagem)." },
];

/** O departamento principal de quem digita, para o /tarefa (as chaves de interno.membro_direto). */
function departamentoDe(me: Me): string | null {
  const mapa: Record<string, string> = { coordenacao: "coordenacao", vice: "coordenacao", jornalismo: "jornalismo", marketing: "jornalismo", design: "design", educacao: "educacao", educacao_secundaria: "educacao", mentoria: "mentoria", curadoria: "curadoria", revisao: "revisao", traducao: "traducao", mediacao: "mediacao", desenvolvimento: "desenvolvimento", saude: "saude" };
  for (const papel of me.papeis) {
    if (papel.papel === "representante" && papel.disciplina && Object.values(mapa).includes(papel.disciplina)) return papel.disciplina;
    if (mapa[papel.papel]) return mapa[papel.papel];
  }
  return null;
}

/**
 * Roda um comando. Devolve o texto a mandar na conversa (cifrado, como qualquer mensagem), um aviso só para quem
 * digitou, ou uma ação da tela (abrir a enquete ou o evento). Texto que não é comando conhecido vai como mensagem.
 */
export async function rodarComando(texto: string, me: Me): Promise<{ mandar?: string; aviso?: string; abrir?: "enquete" | "evento" } | null> {
  const achado = /^\/([a-z]+)\s*([\s\S]*)$/.exec(texto.trim());
  if (!achado || !COMANDOS.some((c) => c.nome === achado[1])) return null;
  const [, nome, resto] = achado;
  const argumento = resto.trim();
  switch (nome) {
    case "ajuda":
      return { aviso: COMANDOS.map((c) => `${c.uso}: ${c.sobre}`).join("  ·  ") };
    case "emojis":
      return { aviso: Object.keys(EMOJIS_DO_INSTITUTO).map((n) => `:${n}:`).join(" ") };
    case "dado":
      return { mandar: `jogou um dado e tirou *${1 + Math.floor(Math.random() * 6)}*` };
    case "moeda":
      return { mandar: `jogou uma moeda: *${Math.random() < 0.5 ? "cara" : "coroa"}*` };
    case "enquete":
    case "evento":
      return { abrir: nome };
    case "tarefa": {
      if (argumento.length < 3) return { aviso: "Escreva a tarefa depois do comando: /tarefa revisar a aula de frações" };
      const departamento = departamentoDe(me);
      if (!departamento) return { aviso: "Você ainda não está num departamento: o /tarefa põe o cartão no quadro do seu." };
      await rpc("departamento_quadro_salvar", { p_id: null, p: { departamento, titulo: argumento.slice(0, 140) } });
      return { mandar: `:feito: Pôs no quadro da semana do departamento: *${argumento.slice(0, 140)}*` };
    }
    case "pauta": {
      if (argumento.length < 3) return { aviso: "Escreva a ideia depois do comando: /pauta a greve dos entregadores" };
      await rpc("pauta_salvar", { p_id: null, p: { titulo: argumento.slice(0, 160), tipo: "jornal" } });
      return { mandar: `:ideia: Nova pauta no banco: *${argumento.slice(0, 160)}*` };
    }
  }
  return null;
}
