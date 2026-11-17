// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { LIMITES, limparDominio, moderacaoDaComunidade, type AutomodDaComunidade } from "@/lib/rede/comunidade-moderacao";
import { redeMod as listas } from "@/lib/rede/cliente-moderacao";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaModeracao } from "@/lib/rede/textos-moderacao";
import type { ItemDeLista } from "@/lib/rede/tipos-moderacao";
import { mensagemDeErro } from "../base";

const LINKS = [null, 0, 1, 2, 3, 5] as const;
const CONTA_NOVA = [null, 1, 3, 7, 14, 30] as const;
const NOVATOS = [null, 1, 2, 3, 5] as const;
const valorDe = (v: number | null) => (v === null ? "" : String(v));
const lerValor = (v: string) => (v === "" ? null : Number(v));

/**
 * O filtro automático de uma comunidade, calibrado pela moderação dela: links por post, endereços que esperam leitura, conta
 * nova, fila de recém-chegados, as palavras da lista da mediação e a regra escrita (que quem escreve ali lê). Só retém.
 */
export function FiltroAutomatico({ slug, s, sm, regras, aoSalvar }: { slug: string; s: Pick<TextosDaRede, "erros">; sm: TextosDaModeracao; regras: AutomodDaComunidade; aoSalvar: (r: AutomodDaComunidade) => void }) {
  const t = sm.o9.filtro;
  const [links, setLinks] = useState<number | null>(regras.links_max);
  const [dominios, setDominios] = useState(regras.dominios.join("\n"));
  const [contaNova, setContaNova] = useState<number | null>(regras.conta_nova_dias);
  const [novatos, setNovatos] = useState<number | null>(regras.novatos_posts);
  const [explicacao, setExplicacao] = useState(regras.explicacao);
  const [palavras, setPalavras] = useState<ItemDeLista[] | null>(null);
  const [palavra, setPalavra] = useState("");
  const [rodada, setRodada] = useState(0);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    listas.lista("comunidade", slug).then(
      (l) => vivo && setPalavras(l.filter((x) => x.tipo === "palavra")),
      () => vivo && setPalavras([]),
    );
    return () => {
      vivo = false;
    };
  }, [slug, rodada]);

  const linhas = dominios.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
  const ruim = linhas.find((x) => limparDominio(x) === null);

  async function salvar() {
    if (ocupado || ruim) return;
    setOcupado(true);
    setErro("");
    setAviso("");
    try {
      const r = await moderacaoDaComunidade.salvarAutomod(slug, {
        links_max: links,
        dominios: [...new Set(linhas.map((x) => limparDominio(x) ?? ""))].filter(Boolean),
        conta_nova_dias: contaNova,
        novatos_posts: novatos,
        explicacao: explicacao.trim(),
      });
      aoSalvar(r);
      setAviso(t.salvo);
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    } finally {
      setOcupado(false);
    }
  }

  async function porPalavra() {
    const valor = palavra.trim();
    if (valor.length < 2) return;
    setErro("");
    try {
      await listas.listaAdicionar("comunidade", slug, "palavra", valor, "");
      setPalavra("");
      setRodada((n) => n + 1);
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    }
  }
  async function tirarPalavra(id: string) {
    setErro("");
    try {
      await listas.listaRemover(id);
      setRodada((n) => n + 1);
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    }
  }

  return (
    <section className="m9-secao m9-largo" aria-labelledby={`m9-filtro-${slug}`}>
      <h3 id={`m9-filtro-${slug}`} className="m9-secao-titulo m9-cond"><span className="m9-ladrilho" aria-hidden>1</span>{t.titulo}</h3>
      <p className="m9-lead">{t.lead}</p>
      <div className="m9-campos m9-campos-2">
        <label className="m9-campo">
          {t.links}
          <select value={valorDe(links)} onChange={(e) => setLinks(lerValor(e.target.value))}>
            {LINKS.map((n) => <option key={String(n)} value={valorDe(n)}>{n === null ? t.linksNada : n === 0 ? t.linksZero : preencher(t.linksAcima, { n })}</option>)}
          </select>
        </label>
        <label className="m9-campo">
          {t.contaNova}
          <select value={valorDe(contaNova)} onChange={(e) => setContaNova(lerValor(e.target.value))}>
            {CONTA_NOVA.map((n) => <option key={String(n)} value={valorDe(n)}>{n === null ? t.contaNovaNada : preencher(t.contaNovaDias, { n })}</option>)}
          </select>
        </label>
        <label className="m9-campo">
          {t.novatos}
          <select value={valorDe(novatos)} onChange={(e) => setNovatos(lerValor(e.target.value))}>
            {NOVATOS.map((n) => <option key={String(n)} value={valorDe(n)}>{n === null ? t.novatosNada : preencher(t.novatosN, { n })}</option>)}
          </select>
        </label>
        <label className="m9-campo">
          {t.dominios}
          <textarea value={dominios} rows={3} onChange={(e) => setDominios(e.target.value)} placeholder="encurta.exemplo" aria-describedby={`m9-dom-${slug}`} />
          <span id={`m9-dom-${slug}`} className="m9-nota">{ruim ? preencher(t.dominioRuim, { d: ruim }) : t.dominiosAjuda}</span>
        </label>
      </div>
      <p className="m9-nota">{t.combinado}</p>

      <div className="m9-campos m9-depois">
        <div>
          <p className="m9-campo m9-sem-margem">{t.palavras}</p>
          <p className="m9-nota">{t.palavrasAjuda}</p>
          {palavras === null ? <p className="m9-nota" role="status">{sm.carregando}</p> : palavras.length === 0 ? <p className="m9-vazio m9-depois-p">{t.palavrasVazia}</p> : (
            <ul className="m9-fichas">
              {palavras.map((p) => (
                <li key={p.id} className="m9-ficha">
                  {p.palavra}
                  <button type="button" aria-label={`${sm.remover}: ${p.palavra}`} onClick={() => void tirarPalavra(p.id)}>×</button>
                </li>
              ))}
            </ul>
          )}
          <div className="m9-linha m9-depois-p">
            <label className="m9-campo">
              {t.palavraNova}
              <input value={palavra} maxLength={60} onChange={(e) => setPalavra(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void porPalavra(); } }} />
            </label>
            <button type="button" className="al-botao al-botao-contorno al-botao-m" disabled={palavra.trim().length < 2} onClick={() => void porPalavra()}>{t.palavraPor}</button>
          </div>
        </div>
        <label className="m9-campo">
          {t.explicacao}
          <textarea value={explicacao} maxLength={LIMITES.explicacao} rows={3} placeholder={t.explicacaoDica} onChange={(e) => setExplicacao(e.target.value)} />
        </label>
      </div>
      <div className="m9-acoes">
        <button type="button" className="al-botao al-botao-primario al-botao-m" disabled={ocupado || Boolean(ruim)} onClick={() => void salvar()}>{ocupado ? t.salvando : t.salvar}</button>
      </div>
      {aviso && <p className="m9-status" role="status">{aviso}</p>}
      {erro && <p className="m9-erro" role="alert">{erro}</p>}
    </section>
  );
}
