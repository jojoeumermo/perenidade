// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Check, Copy, Link2, MessageSquare, Plus, UserPlus, X } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
import { type Me, rpc } from "@/lib/backend";
import { EMOJIS_DO_INSTITUTO } from "@/lib/emojis-do-instituto";
import { useI18n } from "../I18n";
import { Avatar } from "./Avatar";
import { papeis, rotulo, textoDoErro } from "./comum";
import { EmojiDoInstituto } from "./EmojiDoInstituto";
import type { Membro } from "./Equipe";
import { Botao, Selo } from "./ui";

// As peças das Conversas no jeito do Stoat (gatilho "Chat Interno"): o cartão de perfil com capa, presença, frase e
// emblemas; o "meu status"; os amigos (que liberam a conversa privada com o aceite dos dois); os convites para grupos;
// e os comandos com barra, que fazem o papel dos robôs (o servidor não lê as conversas cifradas: quem "fala" é quem
// digitou o comando, do próprio aparelho). O banco está em supabase/install.sql, "Conversas no jeito do Stoat".
// Desenho: tokens do painel (dentro da sala, os --pn-* seguem as cores da sala) e os componentes de ui/.

export type Presenca = "online" | "ausente" | "ocupado" | "invisivel";
/** A cor de cada presença, pelos tokens de estado (o nome da presença vai sempre junto, no title ou no texto). */
export const CORES_DE_PRESENCA: Record<Presenca, string> = { online: "var(--pn-ok)", ausente: "var(--pn-aviso)", ocupado: "var(--pn-erro)", invisivel: "var(--pn-texto-mudo)" };
export const NOMES_DE_PRESENCA: Record<Presenca, string> = { online: "Online", ausente: "Ausente", ocupado: "Não perturbe", invisivel: "Invisível" };
/**
 * As capas do cartão de perfil. São a arte que a pessoa escolhe para o próprio cartão (como as cores do Avatar), não a
 * interface: por isso guardam as cores próprias. A chave fica igual (é o que o banco guarda).
 */
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

/** O véu atrás do cartão de perfil (o mesmo das janelas do painel). */
const VEU: CSSProperties = { background: "var(--pn-veu)" };

/** A bolinha de presença. */
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={VEU} onClick={fechar}>
      <div role="dialog" aria-modal="true" aria-label={`Perfil de ${membro.nome}`} className="pn-menu-suspenso w-full max-w-sm overflow-hidden p-0" onClick={(e) => e.stopPropagation()}>
        <div className="h-24" style={{ background: CAPAS[membro.capa ?? "vermelho"] ?? CAPAS.vermelho }} />
        <div className="px-4 pb-4">
          <div className="-mt-10 flex items-end justify-between">
            <span className="relative">
              <Avatar nome={membro.nome} avatar={membro.avatar} className="h-20 w-20 rounded-full border-[6px] border-[var(--pn-superficie)]" texto="text-xl" />
              <Bolinha presenca={presenca} online={membro.online} borda="border-[var(--pn-superficie)]" className="h-5 w-5 right-1 bottom-1" />
            </span>
            <Botao icone pequeno simbolo={X} onClick={fechar} aria-label="Fechar" className="mb-1" />
          </div>
          <p className="pn-cartao-titulo mt-2 text-xl leading-tight">{membro.nome}</p>
          <p className="pn-ajuda">{membro.online ? NOMES_DE_PRESENCA[presenca] : "Fora agora"}</p>
          {membro.frase && <p className="mt-1 text-sm">{membro.frase}</p>}
          {emblemas.length > 0 && (
            <div className="pn-cartao pn-cartao-plano mt-3 p-3">
              <p className={rotulo}>Emblemas</p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {emblemas.map((e) => (
                  <li key={e}>
                    <Selo>
                      <EmojiDoInstituto nome="estrela" className="h-3 w-3" />
                      {e}
                    </Selo>
                  </li>
                ))}
                {desde && <li><Selo>Na equipe desde {desde}</Selo></li>}
              </ul>
            </div>
          )}
          {membro.bio && (
            <div className="pn-cartao pn-cartao-plano mt-3 p-3">
              <p className={rotulo}>Sobre</p>
              <p className="mt-1 whitespace-pre-line text-sm" data-original>{membro.bio}</p>
            </div>
          )}
          {membro.oficios && membro.oficios.length > 0 && (
            <div className="pn-cartao pn-cartao-plano mt-3 p-3">
              <p className={rotulo}>Sabe fazer</p>
              <p className="mt-1 text-sm">{membro.oficios.join(" · ")}</p>
            </div>
          )}
          {!eu && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Botao variante="principal" simbolo={MessageSquare} className="flex-1" onClick={() => { fechar(); conversar(membro.id); }}>
                Mandar mensagem
              </Botao>
              {amizade === "nada" && <Botao simbolo={UserPlus} onClick={() => void pedir()}>Pedir amizade</Botao>}
              {amizade === "recebido" && <Botao simbolo={Check} onClick={() => void pedir()}>Aceitar a amizade</Botao>}
              {amizade === "pedido" && <Selo>Pedido enviado</Selo>}
              {amizade === "amigos" && <Selo tom="ok" ponto>Amigos</Selo>}
            </div>
          )}
          {aviso && <p role="alert" className="pn-erro mt-2">{aviso}</p>}
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
    <div role="dialog" aria-label="Meu status" className="pn-menu-suspenso absolute bottom-14 left-2 z-40 w-72 p-3 text-sm">
      <p className={rotulo}>Presença</p>
      <ul className="mt-1">
        {(Object.keys(NOMES_DE_PRESENCA) as Presenca[]).map((p) => (
          <li key={p}>
            <button type="button" onClick={() => setPresenca(p)} aria-pressed={presenca === p} className={`pn-menu-suspenso-item w-full cursor-pointer text-left ${presenca === p ? "bg-[var(--pn-ativo)]" : "hover:bg-[var(--pn-ativo)]"}`}>
              {/* <i>, não <span>: no item do menu o primeiro <span> estica (é o texto), e a bolinha viraria uma barra. */}
              <i aria-hidden className="block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CORES_DE_PRESENCA[p] }} />
              <span>{NOMES_DE_PRESENCA[p]}</span>
              {p === "invisivel" && <span className="pn-ajuda ml-auto">aparece como fora</span>}
              {presenca === p && <Check aria-hidden className="h-4 w-4 shrink-0" />}
            </button>
          </li>
        ))}
      </ul>
      <label className="mt-2 block">
        <span className={rotulo}>Frase de status</span>
        <input value={frase} onChange={(e) => setFrase(e.target.value)} maxLength={80} placeholder="Escrevendo a aula de frações" className="pn-campo mt-1" />
      </label>
      <p className={`${rotulo} mt-2`}>Capa do cartão</p>
      <p className="mt-1 flex flex-wrap gap-1.5">
        {Object.entries(CAPAS).map(([id, fundo]) => (
          <button key={id} type="button" onClick={() => setCapa(id)} aria-label={`Capa ${id}`} aria-pressed={capa === id} className={`h-7 w-7 cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pn-foco)] ${capa === id ? "ring-2 ring-[var(--pn-texto)] ring-offset-2 ring-offset-[var(--pn-superficie)]" : ""}`} style={{ background: fundo }} />
        ))}
      </p>
      {aviso && <p role="alert" className="pn-erro mt-2">{aviso}</p>}
      <p className="mt-3 flex justify-end gap-2">
        <Botao variante="discreto" pequeno onClick={fechar}>Cancelar</Botao>
        <Botao variante="principal" pequeno simbolo={Check} onClick={() => void guardar()}>Guardar</Botao>
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
          <Botao pequeno simbolo={Check} onClick={() => void fazer("amizade_responder", { p_de: a.id, p_aceitar: true }, `Você e ${a.nome} agora são amigos.`)}>Aceitar</Botao>
          <Botao variante="discreto" pequeno icone simbolo={X} aria-label={`Recusar ${a.nome}`} onClick={() => void fazer("amizade_responder", { p_de: a.id, p_aceitar: false }, "Pedido recusado.")} />
        </li>
      ))}
      {dados.amigos.map((a) => (
        <li key={`a-${a.id}`}>
          <button type="button" onClick={() => conversar(a.id)} className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-s-suave hover:bg-[var(--s-hover)] hover:text-s-texto focus-visible:outline-2 focus-visible:outline-[var(--pn-foco)]">
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
          <div className="pn-cartao pn-cartao-plano p-2">
            <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar na equipe" aria-label="Procurar alguém para pedir amizade" className="pn-campo text-sm" />
            <ul className="mt-1">
              {candidatos.map((m) => (
                <li key={m.id}>
                  {/* Sem a classe do item de menu: lá o primeiro <span> estica, e o Avatar (um span) sairia do tamanho. */}
                  <button type="button" className="flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-[var(--pn-ativo)] focus-visible:bg-[var(--pn-ativo)]" onClick={() => void fazer("amizade_pedir", { p_para: m.id }, `Pedido de amizade enviado a ${m.nome}.`)}>
                    <Avatar nome={m.nome} avatar={m.avatar} className="h-5 w-5 rounded-full" />
                    <span className="truncate">{m.nome}</span>
                  </button>
                </li>
              ))}
            </ul>
            <Botao variante="discreto" pequeno className="mt-1" onClick={() => setAdicionando(false)}>Fechar</Botao>
          </div>
        ) : (
          <Botao variante="discreto" pequeno simbolo={Plus} className="w-full justify-start" onClick={() => setAdicionando(true)}>
            Adicionar amigo
          </Botao>
        )}
        {aviso && <p role="status" className="mt-1 px-1 text-[0.68rem] text-s-suave">{aviso}</p>}
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
    <section className="pn-cartao pn-cartao-plano p-3">
      <h4 className="flex items-center gap-1.5 font-semibold"><Link2 aria-hidden className="h-4 w-4" />Convidar com um link</h4>
      <p className="pn-ajuda mt-0.5">Quem é da equipe e abrir o link entra no grupo. As mensagens aparecem para a pessoa assim que alguém do grupo abrir o painel (a cifra repassa a chave).</p>
      {link ? (
        <p className="mt-2 flex items-center gap-2">
          <code className="pn-campo min-w-0 flex-1 truncate font-mono text-xs">{link}</code>
          <Botao pequeno simbolo={Copy} onClick={() => void navigator.clipboard?.writeText(link).then(() => setAviso("Link copiado."), () => setAviso(link))}>Copiar</Botao>
        </p>
      ) : (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          Vale por
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className="pn-campo w-auto">
            <option value={1}>1 dia</option>
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
          </select>
          <Botao pequeno simbolo={Link2} onClick={() => void gerar()}>Gerar o link</Botao>
        </p>
      )}
      {aviso && <p role="status" className="pn-ajuda mt-1">{aviso}</p>}
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
    <div role="status" className="pn-menu-suspenso absolute inset-x-0 top-0 z-40 m-3 max-w-none p-4 text-sm">
      {aviso ? (
        <p>{aviso}</p>
      ) : dados && !dados.valido ? (
        <p>Este convite venceu ou já foi usado até o limite. Peça outro a quem convidou.</p>
      ) : dados ? (
        <>
          <p className={rotulo}>Convite{dados.de ? ` de ${dados.de}` : ""}</p>
          <p className="pn-cartao-titulo mt-1 text-lg">{dados.nome}</p>
          <p className="pn-ajuda tabular-nums">{dados.membros} {dados.membros === 1 ? "pessoa" : "pessoas"} no grupo</p>
          <p className="mt-3 flex gap-2">
            <Botao
              variante="principal"
              simbolo={Check}
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
            </Botao>
            <Botao variante="discreto" onClick={() => { tirarDoEndereco(); setFechado(true); }}>Agora não</Botao>
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
