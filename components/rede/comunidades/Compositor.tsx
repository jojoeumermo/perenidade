// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { rede } from "@/lib/rede/cliente";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDeComunidades } from "@/lib/rede/textos-comunidades";
import type { PedidoDePost, Post } from "@/lib/rede/tipos";
import { botao, botaoClaro, campo, erroCom } from "./util";

/**
 * Um escritor enxuto para os dois lugares em que o post já nasce preso a algo: a conversa de uma aula e o mural de um núcleo.
 * Dúvida e discussão (título e texto) ou post curto. O destino (comunidade, ou núcleo com público "nucleo") vem do pai, que também
 * liga o post à aula depois de publicado (`aoPublicar` pode devolver uma promessa: erro dela aparece aqui, dentro da página).
 */
export function Compositor({
  s,
  sc,
  destino,
  aoPublicar,
  aoCancelar,
}: {
  s: TextosDaRede;
  sc: TextosDeComunidades;
  destino: Pick<PedidoDePost, "comunidade" | "nucleo" | "publico">;
  aoPublicar: (post: Post) => Promise<void> | void;
  aoCancelar?: () => void;
}) {
  const a = sc.aula;
  const [tipo, setTipo] = useState<"duvida" | "discussao" | "post">("post");
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const longo = tipo !== "post";

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setMensagem(null);
    try {
      const pedido: PedidoDePost = longo ? { ...destino, tipo, titulo: titulo.trim(), corpo: texto.trim() } : { ...destino, tipo: "post", texto: texto.trim() };
      const post = await rede.publicar(pedido);
      await aoPublicar(post);
      setTitulo("");
      setTexto("");
      setMensagem({ texto: a.publicado, erro: false });
    } catch (erro) {
      setMensagem({ texto: erroCom(s, sc, erro), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-3 border-b border-rule px-[18px] py-4 font-sans">
      <label className="block text-sm text-ink-soft">
        {a.tipo}
        <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={campo}>
          <option value="post">{a.post}</option>
          <option value="duvida">{a.duvida}</option>
          <option value="discussao">{a.discussao}</option>
        </select>
      </label>
      {longo && (
        <label className="block text-sm text-ink-soft">
          {a.titulo_campo}
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} minLength={5} maxLength={140} required className={campo} />
        </label>
      )}
      <label className="block text-sm text-ink-soft">
        {a.texto}
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} minLength={longo ? 10 : 1} maxLength={longo ? 10000 : 500} rows={longo ? 6 : 3} required className={campo} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={ocupado} className={botao}>{ocupado ? a.publicando : a.publicar}</button>
        {aoCancelar && <button type="button" onClick={aoCancelar} className={botaoClaro}>{a.cancelar}</button>}
      </div>
      {mensagem && <p role={mensagem.erro ? "alert" : "status"} className={`text-sm ${mensagem.erro ? "text-oxblood" : "text-ink-soft"}`}>{mensagem.texto}</p>}
    </form>
  );
}
