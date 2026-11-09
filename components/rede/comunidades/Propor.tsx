// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { comunidades } from "@/lib/rede/cliente-comunidades";
import { preencher } from "@/lib/rede/preencher";
import { quandoFoi } from "../CartaoDePost";
import { EsqueletoDaLinha } from "../Esqueletos";
import type { PropsDaTelaDoPacote } from "../registro";
import { botao, campo, erroCom, textosDe, useCarregar } from "./util";
// O visual novo (só com "rede-v2" + "alumia-2": a folha só vale dentro de [data-al="2"]).
import "../conversa/alumia3.css";

/** @nomes de uma lista escrita livre (uma por linha, ou separados por vírgula ou espaço). */
const nomesDe = (texto: string): string[] => texto.split(/[\s,;]+/).map((x) => x.replace(/^@+/, "").trim().toLowerCase()).filter(Boolean);

/**
 * Propor uma comunidade (R4, item 37, decisão 4 da ESPEC): endereço, nome, objetivo, regras (uma por linha) e ao menos dois moderadores
 * por @nome. A coordenação decide no painel; aqui a pessoa acompanha o andamento e lê o motivo de uma recusa.
 */
export default function Propor({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const sc = textosDe(s);
  const minhas = useCarregar(() => (situacao.logado ? comunidades.minhasPropostas() : Promise.resolve({ itens: [] })), `minhas:${situacao.logado}`);
  const [slug, setSlug] = useState("");
  const [nome, setNome] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [regras, setRegras] = useState("");
  const [moderadores, setModeradores] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  if (!sc) return <p className="px-[18px] py-8 font-sans text-ink-soft">{s.estados.emBreve}</p>;
  const p = sc.propor;
  const pode = situacao.logado && situacao.membro;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado || !sc) return;
    setOcupado(true);
    setMensagem(null);
    try {
      await comunidades.propor({ slug: slug.trim().toLowerCase(), nome: nome.trim(), objetivo: objetivo.trim(), regras: regras.trim(), moderadores: nomesDe(moderadores) });
      setMensagem({ texto: sc.propor.enviada, erro: false });
      setSlug("");
      setNome("");
      setObjetivo("");
      setRegras("");
      setModeradores("");
      minhas.recarregar();
    } catch (erro) {
      setMensagem({ texto: erroCom(s, sc, erro), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="al3-tela font-sans">
      <header className="border-b border-rule px-[18px] py-4">
        <h1 className="font-serif text-2xl font-extrabold">{p.titulo}</h1>
        <p className="mt-1 text-sm text-ink-soft">{p.intro}</p>
      </header>
      {!pode ? (
        <p className="px-[18px] py-6 text-ink-soft">{sc.acao.entrePrimeiro}</p>
      ) : (
        <form onSubmit={enviar} className="space-y-3 border-b border-rule px-[18px] py-4">
          <label className="block text-sm text-ink-soft">
            {p.nome}
            <input value={nome} onChange={(e) => setNome(e.target.value)} minLength={3} maxLength={60} required className={campo} />
          </label>
          <label className="block text-sm text-ink-soft">
            {p.slug}
            <input value={slug} onChange={(e) => setSlug(e.target.value)} pattern="[a-z0-9-]{2,60}" maxLength={60} required className={campo} />
          </label>
          <label className="block text-sm text-ink-soft">
            {p.objetivo}
            <textarea value={objetivo} onChange={(e) => setObjetivo(e.target.value)} minLength={20} maxLength={1000} rows={4} required className={campo} />
          </label>
          <label className="block text-sm text-ink-soft">
            {p.regras}
            <textarea value={regras} onChange={(e) => setRegras(e.target.value)} minLength={20} maxLength={2000} rows={5} required className={campo} />
          </label>
          <label className="block text-sm text-ink-soft">
            {p.moderadores}
            <textarea value={moderadores} onChange={(e) => setModeradores(e.target.value)} rows={3} required className={campo} />
          </label>
          <button type="submit" disabled={ocupado} className={botao}>{ocupado ? p.enviando : p.enviar}</button>
          {mensagem && <p role={mensagem.erro ? "alert" : "status"} className={`text-sm ${mensagem.erro ? "text-oxblood" : "text-ink-soft"}`}>{mensagem.texto}</p>}
        </form>
      )}
      {pode && (
        <section aria-labelledby="minhas-propostas" className="px-[18px] py-4">
          <h2 id="minhas-propostas" className="font-serif text-xl font-semibold">{p.minhas}</h2>
          {!minhas.pronto ? (
            <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={1} />
          ) : (minhas.dado?.itens.length ?? 0) === 0 ? (
            <p className="mt-1 text-sm text-ink-soft">{p.semPropostas}</p>
          ) : (
            <ul className="mt-2 divide-y divide-rule">
              {minhas.dado?.itens.map((x) => (
                <li key={x.id} className="py-2">
                  <p className="font-bold">{x.nome}</p>
                  <p className="text-sm text-ink-soft">
                    {p.situacao[x.situacao]} · {quandoFoi(x.criado_em, lang)}
                  </p>
                  {x.motivo && <p className="text-sm">{preencher(p.motivo, { motivo: x.motivo })}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
