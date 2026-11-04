// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import Link from "@/components/Link";
import { useEffect, useState } from "react";
import { localePath } from "@/i18n/config";
import { redeMod } from "@/lib/rede/cliente-moderacao";
import { preencher } from "@/lib/rede/preencher";
import { gravarSilenciosLocais, lerSilenciosLocais } from "@/lib/rede/silenciar-local";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Post } from "@/lib/rede/tipos";
import { enderecosModeracao, type RotuloDeChecagem } from "@/lib/rede/tipos-moderacao";
import type { TextosDaModeracao } from "@/lib/rede/textos-moderacao";
import { estilo, mensagemDeErro, useTextosMod } from "./base";

// Os formulários só chegam ao navegador quando alguém abre um deles.
const FormularioDeDenuncia = dynamic(() => import("./FormularioDeDenuncia").then((m) => m.FormularioDeDenuncia), { ssr: false });
const PainelDoPost = dynamic(() => import("./PainelDoPost").then((m) => m.PainelDoPost), { ssr: false });

// ── Rótulos de desinformação: uma chamada para todos os posts da tela (em lote), não uma por post ──
const cacheDeRotulos = new Map<string, RotuloDeChecagem | null>();
let fila: { id: string; resolver: (r: RotuloDeChecagem | null) => void }[] = [];
let agendado = false;

async function descarregar() {
  agendado = false;
  const lote = fila;
  fila = [];
  const ids = [...new Set(lote.map((x) => x.id))];
  for (let i = 0; i < ids.length; i += 60) {
    const parte = ids.slice(i, i + 60);
    let resposta: Record<string, { rotulo: RotuloDeChecagem }> | null = null;
    try {
      resposta = await redeMod.detalhes(parte);
    } catch {
      resposta = null;
    }
    for (const id of parte) {
      const r = resposta ? (resposta[id]?.rotulo ?? null) : null;
      if (resposta) cacheDeRotulos.set(id, r);
      for (const x of lote.filter((y) => y.id === id)) x.resolver(r);
    }
  }
}

function pedirRotulo(id: string): Promise<RotuloDeChecagem | null> {
  if (cacheDeRotulos.has(id)) return Promise.resolve(cacheDeRotulos.get(id) ?? null);
  return new Promise((resolver) => {
    fila.push({ id, resolver });
    if (!agendado) {
      agendado = true;
      setTimeout(() => void descarregar(), 40);
    }
  });
}

/**
 * O rótulo "Verificado pela Checagem" de um post: liga a uma checagem que já existe e não apaga o post. Os rótulos de todos os posts da
 * tela vêm numa chamada só. Sem rótulo, não mostra nada (e não baixa os textos do pacote).
 */
export function RotuloDoPost({ post, lang }: { post: Post; lang: string }) {
  const [rotulo, setRotulo] = useState<RotuloDeChecagem | null>(null);
  useEffect(() => {
    let vivo = true;
    void pedirRotulo(post.id).then((r) => vivo && setRotulo(r));
    return () => {
      vivo = false;
    };
  }, [post.id]);
  const sm = useTextosMod(lang, Boolean(rotulo));
  if (!rotulo || !sm) return null;
  return (
    <p className="mt-2 rounded-lg border-2 border-ink bg-parchment-deep px-3 py-2 font-sans text-sm" role="note">
      <span className="font-bold">{sm.rotulo.titulo}</span>{" "}
      {preencher(sm.rotulo.texto, { veredito: rotulo.veredito })}{" "}
      <Link href={enderecosModeracao.checagem(lang, rotulo.checagem)} className="font-bold underline">
        {sm.rotulo.ver}
      </Link>
    </p>
  );
}

/** Silenciar a pessoa ou a conversa: na conta (todos os aparelhos) ou só neste aparelho. Ninguém é avisado. */
function MenuDeSilencio({ post, lang, s, sm, aoFechar }: { post: Post; lang: string; s: TextosDaRede; sm: TextosDaModeracao; aoFechar: () => void }) {
  const [soAparelho, setSoAparelho] = useState(false);
  const [feito, setFeito] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function silenciar(tipo: "pessoa" | "conversa") {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      const valor = tipo === "pessoa" ? (post.autor.handle ?? "") : post.raiz;
      if (soAparelho) {
        const armazem = typeof window === "undefined" ? null : window.localStorage;
        const lista = lerSilenciosLocais(armazem).filter((x) => !(x.tipo === tipo && x.valor === valor));
        lista.push({ tipo, valor });
        if (!gravarSilenciosLocais(armazem, lista)) throw Object.assign(new Error("armazenamento"), { code: "falha" });
        setFeito(sm.silenciar.feitoAparelho);
      } else {
        await redeMod.silenciar(tipo, valor);
        setFeito(sm.silenciar.feito);
      }
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className={`${estilo.caixa} mt-2 w-full basis-full space-y-2`} role="group" aria-label={sm.silenciar.titulo}>
      <div className="flex flex-wrap gap-2">
        {post.autor.handle && post.autor.perfil && (
          <button type="button" disabled={ocupado} className={estilo.botao} onClick={() => void silenciar("pessoa")}>
            {preencher(sm.silenciar.pessoa, { nome: post.autor.codinome })}
          </button>
        )}
        <button type="button" disabled={ocupado} className={estilo.botao} onClick={() => void silenciar("conversa")}>
          {sm.silenciar.conversa}
        </button>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={soAparelho} onChange={(e) => setSoAparelho(e.target.checked)} />
        {sm.silenciar.soAparelho}
      </label>
      {feito && <p role="status" className="text-sm font-bold">{feito}</p>}
      {erro && <p role="alert" className="text-sm text-oxblood">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <Link href={enderecosModeracao.silenciados(lang)} className="text-sm underline">{sm.silenciar.gerenciar}</Link>
        <button type="button" className="text-sm underline" onClick={aoFechar}>{sm.fechar}</button>
      </div>
    </div>
  );
}

/**
 * As ações de cuidado do cartão de post: Denunciar (com protocolo), Silenciar e, para quem modera o lugar, Moderar. Visitante vai para a
 * página Denunciar do site. Os textos do pacote só são baixados quando alguém abre uma das ações.
 */
export function AcoesDeCuidado({ post, lang, s, logado, classe }: { post: Post; lang: string; s: TextosDaRede; logado: boolean; classe: string }) {
  const [aberto, setAberto] = useState<null | "denunciar" | "silenciar" | "moderar">(null);
  const sm = useTextosMod(lang, aberto !== null);
  if (!logado) {
    return post.meu ? null : (
      <Link href={localePath(lang, "/denunciar")} className={classe}>
        {s.acoes.denunciar}
      </Link>
    );
  }
  const alterna = (qual: "denunciar" | "silenciar" | "moderar") => setAberto((a) => (a === qual ? null : qual));
  return (
    <>
      {!post.meu && (
        <button type="button" className={classe} aria-expanded={aberto === "denunciar"} onClick={() => alterna("denunciar")}>
          {s.acoes.denunciar}
        </button>
      )}
      {!post.meu && (
        <button type="button" className={classe} aria-expanded={aberto === "silenciar"} onClick={() => alterna("silenciar")}>
          {s.acoes.mais}
        </button>
      )}
      {post.modero && (
        <button type="button" className={classe} aria-expanded={aberto === "moderar"} onClick={() => alterna("moderar")}>
          {sm?.moderar.titulo ?? "…"}
        </button>
      )}
      {aberto && !sm && <p className="w-full basis-full text-sm text-ink-soft" role="status">…</p>}
      {aberto === "denunciar" && sm && <FormularioDeDenuncia lang={lang} s={s} sm={sm} alvoTipo="post" alvo={post.id} aoFechar={() => setAberto(null)} />}
      {aberto === "silenciar" && sm && <MenuDeSilencio post={post} lang={lang} s={s} sm={sm} aoFechar={() => setAberto(null)} />}
      {aberto === "moderar" && sm && <PainelDoPost post={post} s={s} sm={sm} aoFechar={() => setAberto(null)} />}
    </>
  );
}
