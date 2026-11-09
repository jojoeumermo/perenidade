// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { comunidades } from "@/lib/rede/cliente-comunidades";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDeComunidades } from "@/lib/rede/textos-comunidades";
import type { PedidoDeEntrada } from "@/lib/rede/tipos-comunidades";
import type { Comunidade } from "@/lib/rede/tipos";
import { botao, botaoClaro, campo, erroCom, idDoPost, useCarregar } from "./util";

/**
 * As ferramentas de quem modera a comunidade (só chegam aqui quem o banco confirmou como moderação): pedidos para entrar, regras
 * numeradas, etiquetas e fixar um post pelo endereço dele. Cada ação confirma dentro da página (nunca alert/confirm do navegador).
 */
export default function Moderar({
  comunidade,
  s,
  sc,
  aoMudar,
}: {
  comunidade: Comunidade;
  s: TextosDaRede;
  sc: TextosDeComunidades;
  aoMudar: () => void;
}) {
  const m = sc.moderar;
  const [regras, setRegras] = useState(() => comunidade.regras.map((r) => ({ titulo: r.titulo, texto: r.texto })));
  const [etiquetas, setEtiquetas] = useState(() => comunidade.etiquetas.map((e) => ({ nome: e.nome, cor: e.cor })));
  const [aviso, setAviso] = useState<{ onde: string; texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [post, setPost] = useState("");
  const pedidos = useCarregar(() => comunidades.pedidos(comunidade.slug), `pedidos:${comunidade.slug}`);

  async function rodar(onde: string, tarefa: () => Promise<string>) {
    if (ocupado) return;
    setOcupado(true);
    setAviso(null);
    try {
      setAviso({ onde, texto: await tarefa(), erro: false });
    } catch (e) {
      setAviso({ onde, texto: erroCom(s, sc, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  const mensagem = (onde: string) =>
    aviso?.onde === onde && (
      <p role={aviso.erro ? "alert" : "status"} className={`mt-2 text-sm ${aviso.erro ? "text-oxblood" : "text-ink-soft"}`}>{aviso.texto}</p>
    );

  const decidir = (p: PedidoDeEntrada, aceita: boolean) =>
    rodar("pedidos", async () => {
      await comunidades.decidirPedido(comunidade.slug, p.usuario, aceita);
      pedidos.recarregar();
      aoMudar();
      return aceita ? m.aceitar : m.recusar;
    });

  return (
    <div className="space-y-6 font-sans">
      <section aria-labelledby="mod-pedidos">
        <h3 id="mod-pedidos" className="font-serif text-lg font-semibold">{m.pedidos}</h3>
        {!pedidos.pronto ? (
          <p className="text-sm text-ink-soft">{s.estados.carregando}</p>
        ) : (pedidos.dado?.itens.length ?? 0) === 0 ? (
          <p className="text-sm text-ink-soft">{m.semPedidos}</p>
        ) : (
          <ul className="divide-y divide-rule">
            {pedidos.dado?.itens.map((p) => (
              <li key={p.usuario} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-bold">{p.codinome}</span>
                <span className="flex gap-2">
                  <button type="button" disabled={ocupado} onClick={() => decidir(p, true)} className={botao}>{m.aceitar}</button>
                  <button type="button" disabled={ocupado} onClick={() => decidir(p, false)} className={botaoClaro}>{m.recusar}</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {mensagem("pedidos")}
      </section>

      <section aria-labelledby="mod-regras">
        <h3 id="mod-regras" className="font-serif text-lg font-semibold">{m.regras}</h3>
        <ol className="mt-2 list-decimal space-y-3 pl-5">
          {regras.map((r, i) => (
            <li key={i}>
              <label className="block text-sm text-ink-soft">
                {m.regraTitulo}
                <input value={r.titulo} maxLength={80} onChange={(e) => setRegras((l) => l.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)))} className={campo} />
              </label>
              <label className="mt-1 block text-sm text-ink-soft">
                {m.regraTexto}
                <textarea value={r.texto} maxLength={500} rows={2} onChange={(e) => setRegras((l) => l.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))} className={campo} />
              </label>
              {regras.length > 1 && (
                <button type="button" onClick={() => setRegras((l) => l.filter((_, j) => j !== i))} className="mt-1 text-sm underline">{m.regraTirar}</button>
              )}
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          {regras.length < 20 && (
            <button type="button" onClick={() => setRegras((l) => [...l, { titulo: "", texto: "" }])} className={botaoClaro}>{m.regraAdicionar}</button>
          )}
          <button
            type="button"
            disabled={ocupado}
            onClick={() => rodar("regras", async () => {
              await comunidades.salvarRegras(comunidade.slug, regras);
              aoMudar();
              return m.salvo;
            })}
            className={botao}
          >
            {ocupado ? m.salvando : m.salvar}
          </button>
        </div>
        {mensagem("regras")}
      </section>

      <section aria-labelledby="mod-etiquetas">
        <h3 id="mod-etiquetas" className="font-serif text-lg font-semibold">{m.etiquetas}</h3>
        <ul className="mt-2 space-y-2">
          {etiquetas.map((e, i) => (
            <li key={i} className="flex items-end gap-2">
              <label className="block flex-1 text-sm text-ink-soft">
                {m.etiquetaNome}
                <input value={e.nome} maxLength={40} onChange={(ev) => setEtiquetas((l) => l.map((x, j) => (j === i ? { ...x, nome: ev.target.value } : x)))} className={campo} />
              </label>
              <button type="button" onClick={() => setEtiquetas((l) => l.filter((_, j) => j !== i))} className="min-h-11 text-sm underline">{m.etiquetaTirar}</button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          {etiquetas.length < 12 && (
            <button type="button" onClick={() => setEtiquetas((l) => [...l, { nome: "", cor: "" }])} className={botaoClaro}>{m.etiquetaAdicionar}</button>
          )}
          <button
            type="button"
            disabled={ocupado}
            onClick={() => rodar("etiquetas", async () => {
              await comunidades.salvarEtiquetas(comunidade.slug, etiquetas.filter((e) => e.nome.trim()));
              aoMudar();
              return m.salvo;
            })}
            className={botao}
          >
            {ocupado ? m.salvando : m.salvar}
          </button>
        </div>
        {mensagem("etiquetas")}
      </section>

      <section aria-labelledby="mod-fixar">
        <h3 id="mod-fixar" className="font-serif text-lg font-semibold">{m.fixar}</h3>
        <label className="block text-sm text-ink-soft">
          {m.postEndereco}
          <input value={post} onChange={(e) => setPost(e.target.value)} placeholder="…/alumia/p/…" className={campo} />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {([true, false] as const).map((sim) => (
            <button
              key={String(sim)}
              type="button"
              disabled={ocupado || !idDoPost(post)}
              onClick={() => rodar("fixar", async () => {
                await comunidades.fixar(comunidade.slug, idDoPost(post) ?? "", sim);
                aoMudar();
                return sim ? m.fixado : m.solto;
              })}
              className={sim ? botao : botaoClaro}
            >
              {sim ? m.fixar : m.soltar}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-ink-soft">{m.avisoRegistro}</p>
        {mensagem("fixar")}
      </section>
    </div>
  );
}
