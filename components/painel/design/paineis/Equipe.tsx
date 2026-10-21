// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O trabalho em equipe do estúdio: revisão (mandar para a coordenação, aprovar, pedir ajuste, comentar), as versões
// guardadas (voltar a uma anterior) e a publicação no Instagram pela API oficial (agora ou agendada).

import { useCallback, useEffect, useState } from "react";
import { can, getClient, rpc } from "@/lib/backend";
import { textoDoErro } from "../../comum";
import { creditosDo } from "../conferir";
import { comPagina } from "../exportacao";
import { Icone } from "../Icone";
import { exportar, novoId } from "../motor";
import { LIMITE_DA_LEGENDA, paraProjeto } from "../projeto";
import { BOTAO, BOTAO_PRIMARIO, CAMPO, Dialogo, ROTULO, useEditor } from "../ui";
import { NOMES_DO_STATUS } from "./Gavetas";

const semBanco = (erro: unknown) => /function|função|could not find|schema cache|PGRST202|404/i.test(String((erro as Error)?.message ?? erro));
const AVISO_DO_BANCO = "Esta parte chega quando a coordenação atualizar o banco (install.sql novo).";

function PrecisaGuardar() {
  const ed = useEditor();
  return (
    <div className="space-y-3 text-sm">
      <p>Guarde o trabalho na conta primeiro: a revisão, os comentários e as versões ficam ligados a ele.</p>
      <button type="button" className={BOTAO_PRIMARIO} onClick={() => void ed.guardar()}>
        Guardar agora
      </button>
    </div>
  );
}

interface Comentario {
  id: string;
  autor: string;
  texto: string;
  pagina: number;
  criado_em: string;
  meu: boolean;
}
interface EstadoDaRevisao {
  status: string;
  nota: string;
  decidido_por: string;
  comentarios: Comentario[];
}

/** Revisão: quem cria manda para a coordenação; a coordenação aprova ou pede ajuste; todos comentam. */
export function Revisao({ fechar }: { fechar: () => void }) {
  const ed = useEditor();
  const [estado, setEstado] = useState<EstadoDaRevisao | null>(null);
  const [erro, setErro] = useState("");
  const [texto, setTexto] = useState("");
  const [nota, setNota] = useState("");
  const aprova = can(ed.me, "coordenacao");
  const carregar = useCallback(() => {
    if (!ed.idSalvo) return;
    rpc<EstadoDaRevisao>("design_revisao", { p_id: ed.idSalvo })
      .then((r) => {
        setEstado(r);
        setErro("");
      })
      .catch((e) => setErro(semBanco(e) ? AVISO_DO_BANCO : textoDoErro(e)));
  }, [ed.idSalvo]);
  useEffect(carregar, [carregar]);
  const agir = async (funcao: string, args: Record<string, unknown>, ok: string) => {
    try {
      await rpc(funcao, args);
      ed.avisar(ok);
      carregar();
    } catch (e) {
      ed.avisar(semBanco(e) ? AVISO_DO_BANCO : textoDoErro(e), "erro");
    }
  };
  return (
    <Dialogo titulo="Revisão e comentários" fechar={fechar} largura="max-w-2xl">
      {!ed.idSalvo ? (
        <PrecisaGuardar />
      ) : erro ? (
        <p className="text-sm text-e-bordo">{erro}</p>
      ) : !estado ? (
        <p className="text-sm text-e-suave">Carregando…</p>
      ) : (
        <div className="space-y-5">
          <section className="rounded-lg border border-e-fio p-3">
            <p className={ROTULO}>Situação</p>
            <p className="mt-1 text-lg font-semibold">{NOMES_DO_STATUS[estado.status] ?? estado.status}</p>
            {estado.nota && (
              <p className="mt-1 text-sm">
                <span className="text-e-suave">Nota{estado.decidido_por ? ` de ${estado.decidido_por}` : ""}:</span> {estado.nota}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {(estado.status === "rascunho" || estado.status === "ajustes") && (
                <button type="button" className={BOTAO_PRIMARIO} onClick={() => void ed.guardar().then(() => agir("design_status", { p_id: ed.idSalvo, p_status: "revisao", p_nota: "" }, "Mandado para a revisão da coordenação."))}>
                  <Icone nome="enviar" className="h-4 w-4" /> Mandar para revisão
                </button>
              )}
              {aprova && estado.status === "revisao" && (
                <>
                  <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional; obrigatória para pedir ajuste)" aria-label="Nota da decisão" className={`${CAMPO} min-w-60 flex-1`} />
                  <button type="button" className={BOTAO_PRIMARIO} onClick={() => void agir("design_status", { p_id: ed.idSalvo, p_status: "aprovado", p_nota: nota }, "Aprovado.")}>
                    <Icone nome="aprovar" className="h-4 w-4" /> Aprovar
                  </button>
                  <button type="button" className={BOTAO} disabled={nota.trim().length < 3} onClick={() => void agir("design_status", { p_id: ed.idSalvo, p_status: "ajustes", p_nota: nota }, "Pedido de ajuste enviado.")}>
                    Pedir ajuste
                  </button>
                </>
              )}
              {estado.status === "aprovado" && (
                <button type="button" className={BOTAO} onClick={() => void agir("design_status", { p_id: ed.idSalvo, p_status: "publicado", p_nota: "" }, "Marcado como publicado.")}>
                  Marcar como publicado
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-e-suave">Quem cria manda para a revisão; a coordenação aprova ou pede ajuste. Arte aprovada que mudar depois volta para a revisão.</p>
          </section>
          <section>
            <p className={`${ROTULO} mb-2`}>Comentários</p>
            <ul className="space-y-2">
              {estado.comentarios.map((c) => (
                <li key={c.id} className="rounded-lg bg-e-fundo p-2.5 text-sm">
                  <p className="text-xs text-e-suave">
                    {c.autor} · {new Date(c.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    {ed.projeto.paginas.length > 1 && (
                      <button type="button" className="ml-1 cursor-pointer underline" onClick={() => { ed.irParaPagina(Math.min(c.pagina, ed.projeto.paginas.length - 1)); fechar(); }}>
                        página {c.pagina + 1}
                      </button>
                    )}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap">{c.texto}</p>
                </li>
              ))}
              {!estado.comentarios.length && <li className="text-sm text-e-suave">Nenhum comentário ainda.</li>}
            </ul>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (texto.trim().length < 2) return;
                void agir("design_comentar", { p_id: ed.idSalvo, p_texto: texto.trim(), p_pagina: ed.pagina }, "Comentário enviado.").then(() => setTexto(""));
              }}
            >
              <textarea value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 2000))} rows={2} placeholder={`Comentar a página ${ed.pagina + 1}`} aria-label="Comentário" className="min-w-0 flex-1 rounded-md border border-e-fio bg-e-campo p-2 text-sm" />
              <button type="submit" className={BOTAO_PRIMARIO}>
                Enviar
              </button>
            </form>
          </section>
        </div>
      )}
    </Dialogo>
  );
}

interface Versao {
  id: string;
  autor: string;
  criado_em: string;
  miniatura: string;
}

/** As versões guardadas: o banco guarda uma a cada vez que alguém guarda (até 15 por trabalho). */
export function Versoes({ fechar }: { fechar: () => void }) {
  const ed = useEditor();
  const [lista, setLista] = useState<Versao[] | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (!ed.idSalvo) return;
    rpc<Versao[]>("design_versoes", { p_id: ed.idSalvo })
      .then((l) => setLista(l ?? []))
      .catch((e) => setErro(semBanco(e) ? AVISO_DO_BANCO : textoDoErro(e)));
  }, [ed.idSalvo]);
  const restaurar = async (v: Versao) => {
    try {
      const r = await rpc<{ dados: unknown }>("design_versao", { p_versao: v.id });
      const p = paraProjeto(r.dados);
      ed.setProjeto(() => ({ ...p, paginas: p.paginas.map((d) => ({ ...d, id: d.id ?? novoId(), camadas: d.camadas.map(ed.ajustarAltura) })) }), true, "Voltou a uma versão");
      ed.irParaPagina(0);
      ed.avisar("Versão aberta. Guarde para ela virar a atual (dá para desfazer).");
      fechar();
    } catch (e) {
      ed.avisar(textoDoErro(e), "erro");
    }
  };
  return (
    <Dialogo titulo="Versões guardadas" fechar={fechar} largura="max-w-3xl">
      {!ed.idSalvo ? (
        <PrecisaGuardar />
      ) : erro ? (
        <p className="text-sm text-e-bordo">{erro}</p>
      ) : !lista ? (
        <p className="text-sm text-e-suave">Carregando…</p>
      ) : !lista.length ? (
        <p className="text-sm text-e-suave">Ainda não há versões anteriores: elas aparecem a partir da segunda vez que o trabalho é guardado.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {lista.map((v) => (
            <li key={v.id} className="rounded-lg border border-e-fio p-2 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {v.miniatura ? <img src={v.miniatura} alt="" className="aspect-square w-full object-contain" /> : <span className="block aspect-square bg-e-fio" />}
              <p className="mt-1 text-xs">{new Date(v.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
              <p className="truncate text-xs text-e-suave">{v.autor}</p>
              <button type="button" className={`${BOTAO} mt-1.5 h-7 w-full text-xs`} onClick={() => void restaurar(v)}>
                <Icone nome="restaurar" className="h-3.5 w-3.5" /> Voltar a esta
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialogo>
  );
}

interface Publicacao {
  id: string;
  titulo: string;
  quando: string;
  status: "agendada" | "publicada" | "falhou" | "cancelada";
  erro: string;
  autor: string;
}

/** Publicar no Instagram pela API oficial (Graph API), agora ou agendado. Precisa da conta ligada pela coordenação. */
export function Publicar({ fechar }: { fechar: () => void }) {
  const ed = useEditor();
  const [config, setConfig] = useState<{ configurado: boolean; agenda: boolean } | null>(null);
  const [legenda, setLegenda] = useState(ed.projeto.legenda);
  const [quando, setQuando] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [lista, setLista] = useState<Publicacao[]>([]);
  const pode = can(ed.me, "coordenacao", "marketing");
  const carregar = useCallback(() => {
    rpc<Publicacao[]>("design_publicacoes", {})
      .then((l) => setLista(l ?? []))
      .catch(() => setLista([]));
  }, []);
  useEffect(() => {
    fetch("/api/estudio/instagram")
      .then((r) => r.json())
      .then((c) => setConfig({ configurado: Boolean(c.configurado), agenda: Boolean(c.agenda) }))
      .catch(() => setConfig({ configurado: false, agenda: false }));
    carregar();
  }, [carregar]);
  const creditos = creditosDo(ed.projeto);
  const legendaFinal = `${legenda.trim()}${creditos.length && !legenda.includes("Créditos") ? `\n\nCréditos das imagens: ${creditos.join(" · ")}` : ""}`.slice(0, LIMITE_DA_LEGENDA);
  const publicar = async () => {
    setOcupado(true);
    try {
      if (ed.projeto.paginas.length > 10) throw new Error("O Instagram aceita até 10 imagens por carrossel pela API.");
      const supabase = await getClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Entre na sua conta de novo.");
      // As imagens vão para a pasta pública de publicações (o Instagram baixa de lá).
      const urls: string[] = [];
      for (const [i, doc] of ed.projeto.paginas.entries()) {
        ed.progresso((i + 0.5) / ed.projeto.paginas.length, "Preparando as imagens");
        const blob = await comPagina(ed.projeto, i, () => exportar(doc, "jpeg", { qualidade: 0.92 }), ed.vars);
        const caminho = `${data.session!.user.id}/${novoId()}${novoId()}.jpg`;
        const { error } = await supabase.storage.from("estudio-publicacoes").upload(caminho, blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw new Error("A pasta de publicações não aceitou a imagem (o banco já foi atualizado?).");
        urls.push(supabase.storage.from("estudio-publicacoes").getPublicUrl(caminho).data.publicUrl);
      }
      ed.progresso(0.95, "Publicando");
      const r = await fetch("/api/estudio/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ urls, legenda: legendaFinal, quando: quando ? new Date(quando).toISOString() : null, design: ed.idSalvo, titulo: ed.titulo }),
      });
      const resposta = (await r.json()) as { ok?: boolean; erro?: string; agendada?: boolean };
      if (!r.ok || !resposta.ok) throw new Error(resposta.erro || "O Instagram recusou a publicação.");
      ed.avisar(resposta.agendada ? "Publicação agendada." : "Publicado no Instagram.");
      if (!resposta.agendada && ed.idSalvo) void rpc("design_status", { p_id: ed.idSalvo, p_status: "publicado", p_nota: "" }).catch(() => undefined);
      carregar();
    } catch (e) {
      ed.avisar(e instanceof Error ? e.message : textoDoErro(e), "erro");
    } finally {
      ed.progresso(null);
      setOcupado(false);
    }
  };
  return (
    <Dialogo titulo="Publicar no Instagram" fechar={fechar} largura="max-w-2xl">
      {!config ? (
        <p className="text-sm text-e-suave">Conferindo…</p>
      ) : !config.configurado ? (
        <div className="space-y-2 text-sm">
          <p className="font-semibold">A conta do Instagram ainda não está ligada ao site.</p>
          <p className="text-e-suave">A coordenação liga uma vez, com a API oficial do Instagram (conta profissional ligada a uma página do Facebook): as chaves INSTAGRAM_USER_ID e INSTAGRAM_TOKEN na Vercel. O passo a passo está em docs/ESTUDIO-INSTAGRAM.md. Enquanto isso, use Baixar e poste pelo aplicativo.</p>
        </div>
      ) : !pode ? (
        <p className="text-sm">Publicar no perfil do instituto é com a coordenação e o marketing. Mande a arte para a revisão e avise.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-e-suave">
            {ed.projeto.paginas.length > 1 ? `Carrossel de ${ed.projeto.paginas.length} imagens` : "Uma imagem"}, na ordem das páginas. Confira antes em Pré-visualizar e em Conferir.
          </p>
          <label className="block text-sm">
            Legenda
            <textarea value={legenda} onChange={(e) => setLegenda(e.target.value)} rows={6} spellCheck lang="pt-BR" className="mt-1 w-full rounded-md border border-e-fio bg-e-campo p-2.5 text-sm" />
            <span className="block text-right text-xs text-e-suave">{legendaFinal.length} / {LIMITE_DA_LEGENDA}{creditos.length ? " (com os créditos)" : ""}</span>
          </label>
          <label className="block text-sm">
            Agendar para (vazio: publicar agora)
            <input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} disabled={!config.agenda} className={`${CAMPO} mt-1 max-w-xs`} />
            {!config.agenda && <span className="block text-xs text-e-suave">O agendamento precisa da tarefa automática (veja o guia). Por enquanto, só publicar agora.</span>}
          </label>
          <button type="button" className={BOTAO_PRIMARIO} disabled={ocupado || !legenda.trim()} onClick={() => void publicar()}>
            <Icone nome="publicar" className="h-4 w-4" /> {quando ? "Agendar" : "Publicar agora"}
          </button>
        </div>
      )}
      {lista.length > 0 && (
        <section className="mt-6">
          <p className={`${ROTULO} mb-2`}>Publicações</p>
          <ul className="divide-y divide-e-fio text-sm">
            {lista.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 truncate">
                  {p.titulo} <span className="text-e-suave">· {new Date(p.quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {p.autor}</span>
                  {p.erro && <span className="block text-xs text-[#c21f16]">{p.erro}</span>}
                </span>
                <span className="text-xs">{{ agendada: "Agendada", publicada: "Publicada", falhou: "Falhou", cancelada: "Cancelada" }[p.status]}</span>
                {p.status === "agendada" && (
                  <button type="button" className="cursor-pointer text-xs text-e-bordo underline" onClick={() => void rpc("design_publicacao_cancelar", { p_id: p.id }).then(carregar)}>
                    Cancelar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Dialogo>
  );
}
