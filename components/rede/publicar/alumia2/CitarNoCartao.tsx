// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/Link";
import { conversa } from "@/lib/rede/cliente-conversa";
import type { TextosDaRede } from "@/lib/rede/textos";
import { enderecos, type Post, type Publico } from "@/lib/rede/tipos";
import type { PedidoDeCitacao } from "@/lib/rede/tipos-conversa";
import { codigoDoErro, textoDoErro } from "../../erros";
import { Contador } from "./AnexosDoEscrever";
import { Icone } from "./icones";
import type { TextosAlumia2 } from "./textos";

const LIMITE = 500;

/**
 * Repostar com comentário, na própria linha (cara nova): uma caixa logo abaixo do cartão. A citação fica no mesmo lugar do post
 * citado (comunidade ou internet) ou nos membros da Rede, e nada amplia o alcance: quem não pode ver o original vê só "conteúdo
 * restrito" (rede_conv_citar). Quem escreveu decide quem pode citar (padrão "ninguém"); o banco confere por trigger, para todo
 * caminho que cite. A citação federada é da Faixa 2.
 */
export function CitarNoCartao({ post, lang, s, t, previa, aoFechar }: { post: Post; lang: string; s: TextosDaRede; t: TextosAlumia2; previa: boolean; aoFechar: () => void }) {
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState<Post | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const b = t.b1;
  useEffect(() => {
    campo.current?.focus();
  }, []);
  const publico: Publico = post.publico === "internet" && post.comunidade ? "internet" : post.publico === "comunidade" && post.comunidade ? "comunidade" : "membros";

  async function enviar() {
    if (ocupado || !texto.trim()) return;
    if (previa) {
      setErro(t.previa.aviso);
      return;
    }
    setOcupado(true);
    setErro("");
    try {
      const pedido: PedidoDeCitacao = { texto: texto.trim(), citar: post.id, publico: publico as PedidoDeCitacao["publico"], comunidade: publico === "membros" ? null : post.comunidade };
      setFeito(await conversa.citar(pedido));
    } catch (e) {
      const c = codigoDoErro(e);
      setErro((b.erros as Record<string, string>)[c] ?? textoDoErro(s, e));
    } finally {
      setOcupado(false);
    }
  }

  if (feito) {
    return (
      <div role="status" className="al2-caixa-b1 flex flex-wrap items-center gap-3 text-sm">
        <Icone nome="visto" className="h-4 w-4" grosso />
        <span className="flex-1 font-bold">{b.citado}</span>
        <Link href={enderecos.post(lang, feito.id)} className="font-bold underline">
          {b.verCitacao}
        </Link>
        <button type="button" className="al2-acao" onClick={aoFechar}>
          {b.cancelar}
        </button>
      </div>
    );
  }

  return (
    <form
      className="al2-caixa-b1"
      aria-label={b.citar}
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          aoFechar();
        }
      }}
    >
      <label className="block">
        <span className="sr-only">{b.citarDica}</span>
        <textarea ref={campo} className="al2-campo min-h-20 resize-y" rows={3} maxLength={LIMITE} placeholder={b.citarDica} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </label>
      <p className="mt-1 text-xs text-[var(--al-texto-3)]">{b.citarOnde}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="submit" className="al-botao al-botao-primario al-botao-p" disabled={ocupado || !texto.trim()}>
          {ocupado ? b.carregando : b.citarEnviar}
        </button>
        <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={aoFechar}>
          {b.cancelar}
        </button>
        <Contador n={texto.length} max={LIMITE} rotulo={`${texto.length} / ${LIMITE}`} />
      </div>
      <div aria-live="polite">{erro && <p role="alert" className="mt-1 text-sm text-[var(--oxblood)]">{erro}</p>}</div>
    </form>
  );
}
