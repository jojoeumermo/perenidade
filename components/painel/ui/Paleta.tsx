// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Command } from "cmdk";
import { ArrowLeft, ChevronRight, CornerDownLeft, ListChecks, type LucideIcon, Search, Star, UserRound, Zap } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { rpc } from "@/lib/backend";
import { type ComandoDaSecao, usePainel } from "../estado";
import { espacoDe, nomeDoEspaco } from "../estrutura";
import { Icone } from "../icones";
import { confirmar } from "./Dialogo";
import { Kbd } from "./Kbd";
import { Contador } from "./Selo";

const simples = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export interface ItemDaPaleta {
  id: string;
  nome: string;
  sobre: string;
  /** Grupo antigo da seção (para achar o espaço de uma seção nova). */
  grupo?: string;
  conta?: number;
}

export interface ComandoDaPaleta {
  id: string;
  nome: string;
  sobre: string;
  simbolo?: LucideIcon;
  /** Preferência ligada agora (aparece com o visto). */
  marcado?: boolean;
  fazer: () => void;
}

interface Pessoa {
  id: string;
  nome: string;
  eu?: boolean;
}

interface TarefaCurta {
  id: string;
  titulo: string;
  minutos?: number;
}

/** A busca sem acento e sem caixa: cada palavra digitada precisa aparecer em algum lugar do item. */
function filtro(valor: string, busca: string, palavras?: string[]) {
  const termos = simples(busca).split(/\s+/).filter(Boolean);
  if (!termos.length) return 1;
  const alvo = simples(`${valor} ${palavras?.join(" ") ?? ""}`);
  return termos.every((t) => alvo.includes(t)) ? 1 : 0;
}

function Texto({ nome, sobre }: { nome: string; sobre?: string }) {
  return (
    <span className="pn-paleta-item-texto">
      <span>{nome}</span>
      {sobre && <span>{sobre}</span>}
    </span>
  );
}

/** A equipe (e as tarefas), carregadas só com a paleta aberta e só a partir de 2 letras, uma vez por abertura. */
function useSobDemanda<T>(funcao: string, argumentos: Record<string, unknown>, ligado: boolean) {
  const [dados, setDados] = useState<T | null>(null);
  const chave = JSON.stringify(argumentos);
  const pedir = ligado && dados === null;
  useEffect(() => {
    if (!pedir) return;
    let vivo = true;
    rpc<T>(funcao, JSON.parse(chave) as Record<string, unknown>)
      .then((d) => vivo && setDados(d))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [pedir, funcao, chave]);
  return dados;
}

function Conteudo({ fechar, secoes, comandos, preferencias, ir, abrirEm, pessoasEmVoluntarios }: { fechar: () => void; secoes: ItemDaPaleta[]; comandos: ComandoDaPaleta[]; preferencias: ComandoDaPaleta[]; ir: (id: string) => void; abrirEm?: (caminho: string) => void; pessoasEmVoluntarios: boolean }) {
  const [busca, setBusca] = useState("");
  const [pedindoPessoa, setPedindoPessoa] = useState<ComandoDaSecao | null>(null);
  const porDono = usePainel((s) => s.comandos);
  const daSecao = useMemo(() => Object.values(porDono).flat(), [porDono]);
  const favoritos = usePainel((s) => s.favoritos);
  const recentes = usePainel((s) => s.recentes);
  const procura = busca.trim().length >= 2;
  const membros = useSobDemanda<Pessoa[]>("equipe_membros", {}, procura || Boolean(pedindoPessoa));
  const tarefas = useSobDemanda<{ sugestoes?: TarefaCurta[]; minhas?: TarefaCurta[] }>("tarefas_para_mim", { p_minutos: 30, p_pular: [] }, procura && secoes.some((s) => s.id === "tarefas"));

  const porId = new Map(secoes.map((s) => [s.id, s]));
  const ordenadas = [...secoes].sort((a, b) => {
    const fa = favoritos.indexOf(a.id);
    const fb = favoritos.indexOf(b.id);
    return (fa < 0 ? 99 : fa) - (fb < 0 ? 99 : fb);
  });
  const usadas = recentes.map((id) => porId.get(id)).filter((s): s is ItemDaPaleta => Boolean(s));
  const listaDeTarefas = [...(tarefas?.minhas ?? []), ...(tarefas?.sugestoes ?? [])].filter((t, i, todas) => todas.findIndex((x) => x.id === t.id) === i);

  const escolher = (fazer: () => void) => {
    fechar();
    // Depois de a janela fechar: a ação pode abrir outra janela (confirmar, glossário).
    window.setTimeout(fazer, 0);
  };
  const rodar = (c: ComandoDaSecao, pessoa?: { id: string; nome: string }) =>
    escolher(async () => {
      if (c.perigo && !(await confirmar({ titulo: `${c.nome}?`, confirmar: c.nome, perigo: true }))) return;
      await c.fazer(pessoa);
    });

  return (
    <>
      <div className="pn-paleta-cabeca">
        <Search aria-hidden />
        {pedindoPessoa && (
          <span className="pn-paleta-pagina">
            <ChevronRight aria-hidden width={12} height={12} />
            {pedindoPessoa.nome}
          </span>
        )}
        <Command.Input
          value={busca}
          onValueChange={setBusca}
          placeholder={pedindoPessoa ? "Escolha a pessoa" : "Buscar ou ir para… (fila, escrever aula, modo leve)"}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !busca && pedindoPessoa) {
              e.preventDefault();
              setPedindoPessoa(null);
            }
          }}
        />
      </div>
      <Command.List>
        <Command.Empty>{pedindoPessoa && !membros ? "Carregando a equipe…" : "Nada com esse nome. Tente outra palavra."}</Command.Empty>

        {pedindoPessoa ? (
          <Command.Group heading="Pessoas">
            {(membros ?? [])
              .filter((p) => !p.eu)
              .map((p) => (
                <Command.Item key={p.id} value={`pessoa ${p.nome} ${p.id}`} onSelect={() => rodar(pedindoPessoa, { id: p.id, nome: p.nome })}>
                  <UserRound aria-hidden />
                  <Texto nome={p.nome} />
                </Command.Item>
              ))}
          </Command.Group>
        ) : (
          <>
            {daSecao.length > 0 && (
              <Command.Group heading="Nesta seção">
                {daSecao.map((c, i) => {
                  const Simbolo = c.simbolo ?? Zap;
                  // Duas peças da mesma tela podem registrar o mesmo id: a posição desfaz o empate (chave e valor únicos).
                  return (
                    <Command.Item
                      key={`secao-${i}-${c.id}`}
                      value={`secao ${c.nome} ${c.sobre ?? ""} ${c.id} ${i}`}
                      data-perigo={c.perigo || undefined}
                      onSelect={() => {
                        if (c.pedePessoa) {
                          setBusca("");
                          setPedindoPessoa(c);
                        } else rodar(c);
                      }}
                    >
                      <Simbolo aria-hidden />
                      <Texto nome={c.nome} sobre={c.sobre} />
                      {c.atalho && <Kbd>{c.atalho}</Kbd>}
                      {c.pedePessoa && <ChevronRight aria-hidden />}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {!busca && usadas.length > 0 && (
              <Command.Group heading="Recentes">
                {usadas.map((s) => (
                  <Command.Item key={`recente-${s.id}`} value={`recente ${s.nome} ${s.id}`} onSelect={() => escolher(() => ir(s.id))}>
                    <Icone id={s.id} />
                    <Texto nome={s.nome} sobre={nomeDoEspaco(espacoDe(s.id, s.grupo))} />
                    <Contador n={s.conta} />
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Ir para">
              {ordenadas.map((s) => (
                <Command.Item key={s.id} value={`${s.nome} ${s.id}`} keywords={[nomeDoEspaco(espacoDe(s.id, s.grupo)), s.sobre]} onSelect={() => escolher(() => ir(s.id))}>
                  <Icone id={s.id} />
                  <Texto nome={s.nome} sobre={nomeDoEspaco(espacoDe(s.id, s.grupo))} />
                  {favoritos.includes(s.id) && <Star aria-label="Fixada" width={14} height={14} style={{ color: "var(--pn-ouro)", fill: "currentColor" }} />}
                  <Contador n={s.conta} />
                </Command.Item>
              ))}
            </Command.Group>

            {comandos.length > 0 && (
              <Command.Group heading="Ações">
                {comandos.map((c) => {
                  const Simbolo = c.simbolo ?? CornerDownLeft;
                  return (
                    <Command.Item key={c.id} value={`acao ${c.nome}`} keywords={[c.sobre]} onSelect={() => escolher(c.fazer)}>
                      <Simbolo aria-hidden />
                      <Texto nome={c.nome} sobre={c.sobre} />
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {procura && membros && membros.length > 0 && (
              <Command.Group heading="Pessoas">
                {membros
                  .filter((p) => !p.eu && filtro(p.nome, busca))
                  .slice(0, 6)
                  .map((p) => (
                    <Command.Item
                      key={`pessoa-${p.id}`}
                      value={`pessoa ${p.nome} ${p.id}`}
                      onSelect={() => escolher(() => (abrirEm ? abrirEm(`aba=${pessoasEmVoluntarios ? "pessoas" : "conversas"}&q=${encodeURIComponent(p.nome)}`) : ir(pessoasEmVoluntarios ? "pessoas" : "conversas")))}
                    >
                      <UserRound aria-hidden />
                      <Texto nome={p.nome} sobre={pessoasEmVoluntarios ? "Abrir em Voluntários e convites" : "Abrir em Conversas"} />
                    </Command.Item>
                  ))}
              </Command.Group>
            )}

            {procura && listaDeTarefas.length > 0 && (
              <Command.Group heading="Tarefas">
                {listaDeTarefas.slice(0, 6).map((t) => (
                  <Command.Item key={`tarefa-${t.id}`} value={`tarefa ${t.titulo} ${t.id}`} onSelect={() => escolher(() => (abrirEm ? abrirEm(`aba=tarefas&tarefa=${encodeURIComponent(t.id)}`) : ir("tarefas")))}>
                    <ListChecks aria-hidden />
                    <Texto nome={t.titulo} sobre={t.minutos ? `${t.minutos} min` : undefined} />
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {preferencias.length > 0 && (
              <Command.Group heading="Preferências">
                {preferencias.map((c) => {
                  const Simbolo = c.simbolo ?? CornerDownLeft;
                  return (
                    <Command.Item key={c.id} value={`preferencia ${c.nome}`} keywords={[c.sobre]} onSelect={() => escolher(c.fazer)}>
                      <Simbolo aria-hidden />
                      <Texto nome={c.nome} sobre={c.sobre} />
                      {c.marcado && <span className="pn-etiqueta pn-etiqueta-bordo">ligado</span>}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}
          </>
        )}
      </Command.List>
      {/* As dicas de tecla ficam escondidas do leitor de tela (a lista já anuncia as setas), mas o botão "Voltar" não:
          um botão que recebe foco dentro de um aria-hidden fica mudo para quem usa leitor de tela. */}
      <div className="pn-paleta-rodape">
        <span aria-hidden>
          <Kbd>↑↓</Kbd> escolher
        </span>
        <span aria-hidden>
          <Kbd>↵</Kbd> abrir
        </span>
        <span aria-hidden>
          <Kbd>Esc</Kbd> fechar
        </span>
        {pedindoPessoa && (
          <span aria-hidden>
            <Kbd>⌫</Kbd> voltar
          </span>
        )}
        {pedindoPessoa && (
          <button type="button" className="pn-elo" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "0.25rem" }} onClick={() => setPedindoPessoa(null)}>
            <ArrowLeft aria-hidden width={12} height={12} />
            Voltar
          </button>
        )}
      </div>
    </>
  );
}

/**
 * Devolve o foco a quem abriu a janela quando ela fecha. O Radix Dialog (por baixo do cmdk e da folha do menu) devolve o
 * foco ao Dialog.Trigger; aqui não há Trigger (a paleta abre pelo Ctrl K, pelo "/" ou pelo botão da barra; a folha, pelo
 * botão da barra ou o "Mais"), então o foco caía no <body> e quem usa teclado ou leitor de tela perdia o lugar.
 * O useLayoutEffect roda antes de o FocusScope do Radix (useEffect) levar o foco para dentro: ainda vê quem abriu. Ao
 * fechar, só devolve se o foco ficou solto no <body> (uma ação pode ter aberto outra janela ou trocado de seção).
 */
export function useFocoDeVolta(aberto: boolean) {
  const quemAbriu = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (aberto) {
      quemAbriu.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
      return;
    }
    const alvo = quemAbriu.current;
    quemAbriu.current = null;
    if (!alvo) return;
    const relogio = window.setTimeout(() => {
      if (alvo.isConnected && (!document.activeElement || document.activeElement === document.body)) alvo.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(relogio);
  }, [aberto]);
}

/**
 * A paleta (Ctrl K, cmdk): os comandos que a seção aberta registrou, as seções usadas por último, todas as seções (as
 * fixadas primeiro), as ações, a equipe e as tarefas (a partir de 2 letras) e as preferências. Setas, Enter e Esc; a
 * busca ignora acento e caixa. Comando que pede uma pessoa abre uma segunda página (⌫ volta); comando de perigo passa
 * pelo confirmar() antes de agir.
 */
export function Paleta({ aberto, aoMudar, secoes, comandos, ir, preferencias = [], abrirEm, pessoasEmVoluntarios = false }: { aberto: boolean; aoMudar: (aberto: boolean) => void; secoes: ItemDaPaleta[]; comandos: ComandoDaPaleta[]; ir: (id: string) => void; preferencias?: ComandoDaPaleta[]; abrirEm?: (caminho: string) => void; pessoasEmVoluntarios?: boolean }) {
  useFocoDeVolta(aberto);
  return (
    <Command.Dialog open={aberto} onOpenChange={aoMudar} label="Buscar, ir para uma seção ou rodar um comando" filter={filtro} overlayClassName="pn-veu" contentClassName="pn-dialogo pn-paleta pn-portal" loop>
      <Conteudo fechar={() => aoMudar(false)} secoes={secoes} comandos={comandos} preferencias={preferencias} ir={ir} abrirEm={abrirEm} pessoasEmVoluntarios={pessoasEmVoluntarios} />
    </Command.Dialog>
  );
}
