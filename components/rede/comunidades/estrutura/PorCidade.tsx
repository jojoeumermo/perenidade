// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/Link";
import { estrutura as cliente } from "@/lib/rede/estrutura/cliente";
import { chaveDaCidade } from "@/lib/rede/estrutura/regras";
import type { TextosDaEstrutura } from "@/lib/rede/estrutura/textos";
import type { CidadeComComunidades, ComunidadesDaCidade } from "@/lib/rede/estrutura/tipos";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import { enderecos } from "@/lib/rede/tipos";
import { classeDaCor, mensagemDeErro } from "./base";
import "./estrutura.css";

type Escolhida = { uf: string; municipio: string } | null;

/** O município escolhido no endereço (?uf=SP&municipio=São Paulo), para o "Outras comunidades de …" da aba Estrutura. */
export function cidadeDoEndereco(): Escolhida {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const uf = (q.get("uf") ?? "").toUpperCase();
  const municipio = q.get("municipio") ?? "";
  return /^[A-Z]{2}$/.test(uf) && municipio.trim() ? { uf, municipio } : null;
}

function guardarNoEndereco(e: Escolhida) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("uf");
    url.searchParams.delete("municipio");
    if (e) {
      url.searchParams.set("uf", e.uf);
      url.searchParams.set("municipio", e.municipio);
    }
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    // sem history (prévia em quadro): só a tela muda
  }
}

/**
 * Comunidades por cidade (dentro de /alumia/comunidades): os municípios escritos pela moderação, por estado, com quantas
 * comunidades cada um tem (lugares, nunca pessoas); escolhido um, as comunidades de lá, a cidade toda primeiro e depois por bairro.
 * Nada de localização do aparelho nem mapa de fora.
 */
export function PorCidade({ lang, s, te, inicial }: { lang: string; s: TextosDaRede; te: TextosDaEstrutura; inicial?: Escolhida }) {
  const c = te.cidade;
  const [cidades, setCidades] = useState<{ dado: CidadeComComunidades[] | null; erro: string } | null>(null);
  const [escolhida, setEscolhida] = useState<Escolhida>(inicial ?? null);
  const [daCidade, setDaCidade] = useState<{ chave: string; dado: ComunidadesDaCidade | null; erro: string } | null>(null);
  const [filtro, setFiltro] = useState("");
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    cliente.cidades().then(
      (dado) => vivo && setCidades({ dado, erro: "" }),
      (e) => vivo && setCidades({ dado: null, erro: mensagemDeErro(s, te, e) }),
    );
    return () => {
      vivo = false;
    };
  }, [s, te, versao]);

  const chave = escolhida ? `${escolhida.uf}|${chaveDaCidade(escolhida.municipio)}` : "";
  useEffect(() => {
    if (!escolhida) return;
    let vivo = true;
    cliente.daCidade(escolhida.uf, escolhida.municipio).then(
      (dado) => vivo && setDaCidade({ chave, dado, erro: "" }),
      (e) => vivo && setDaCidade({ chave, dado: null, erro: mensagemDeErro(s, te, e) }),
    );
    return () => {
      vivo = false;
    };
  }, [chave, escolhida, s, te]);

  const porUf = useMemo(() => {
    const termo = chaveDaCidade(filtro);
    const mapa = new Map<string, CidadeComComunidades[]>();
    for (const x of cidades?.dado ?? []) {
      if (termo && !chaveDaCidade(x.municipio).includes(termo)) continue;
      mapa.set(x.uf, [...(mapa.get(x.uf) ?? []), x]);
    }
    return [...mapa.entries()];
  }, [cidades, filtro]);

  function escolher(e: Escolhida) {
    setEscolhida(e);
    guardarNoEndereco(e);
  }

  if (!cidades) return <p className="e10 e10-tela e10-nota" role="status">{te.carregando}</p>;
  if (!cidades.dado) {
    return (
      <div className="e10 e10-tela" role="alert">
        <p className="e10-erro">{cidades.erro}</p>
        <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => setVersao((n) => n + 1)}>{te.tentar}</button>
      </div>
    );
  }

  if (escolhida) {
    const pronto = daCidade?.chave === chave ? daCidade : null;
    const itens = pronto?.dado?.itens ?? [];
    const grupos: [string | null, typeof itens][] = [];
    for (const i of itens) {
      const ultimo = grupos.at(-1);
      if (ultimo && ultimo[0] === i.bairro) ultimo[1].push(i);
      else grupos.push([i.bairro, [i]]);
    }
    return (
      <div className="e10 e10-tela">
        <p>
          <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => escolher(null)}>← {c.voltar}</button>
        </p>
        <header className="e10-cabeca">
          <h2 className="e10-cond">{escolhida.municipio} – {escolhida.uf}</h2>
          <p>{te.ufs[escolhida.uf as keyof typeof te.ufs] ?? escolhida.uf}</p>
        </header>
        {!pronto ? (
          <p className="e10-nota" role="status">{te.carregando}</p>
        ) : pronto.erro ? (
          <p className="e10-erro" role="alert">{pronto.erro}</p>
        ) : itens.length === 0 ? (
          <p className="e10-vazio">{c.nenhum}</p>
        ) : (
          grupos.map(([bairro, lista]) => (
            <section key={bairro ?? ""} aria-label={bairro ?? c.cidadeToda}>
              <h3 className="e10-bairro e10-cond">{bairro ?? c.cidadeToda}</h3>
              <ul className="e10-ladrilhos e10-ladrilhos-3">
                {lista.map((i) => (
                  <li key={i.slug}>
                    <article className={`e10-com ${classeDaCor(i)}`}>
                      <span className="e10-selo-tipo">{te.tipo[i.tipo]}</span>
                      <h4 className="e10-com-nome e10-cond"><Link href={enderecos.comunidade(lang, i.slug)}>{i.nome}</Link></h4>
                      {i.descricao && <p className="e10-com-desc">{i.descricao}</p>}
                      {typeof i.posts_7d === "number" && (
                        <p className="e10-com-meta">{i.posts_7d >= 3 ? preencher(te.postsSemana, { n: i.posts_7d.toLocaleString(lang) }) : te.semanaQuieta}</p>
                      )}
                    </article>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="e10 e10-tela">
      <header className="e10-cabeca">
        <h2 className="e10-cond">{c.titulo}</h2>
        <p>{c.intro}</p>
      </header>
      {cidades.dado.length === 0 ? (
        <p className="e10-vazio">{c.vazio}</p>
      ) : (
        <>
          <label className="e10-campo e10-filtro">
            {c.filtrar}
            <input type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} autoComplete="off" />
          </label>
          {porUf.length === 0 && <p className="e10-vazio e10-depois">{c.nenhum}</p>}
          {porUf.map(([uf, lista]) => (
            <section key={uf} aria-label={te.ufs[uf as keyof typeof te.ufs] ?? uf}>
              <h3 className="e10-uf"><strong className="e10-cond">{uf}</strong><span>{te.ufs[uf as keyof typeof te.ufs] ?? uf}</span></h3>
              <ul className="e10-cidades">
                {lista.map((x) => (
                  <li key={`${x.uf}-${x.municipio}`}>
                    <button type="button" className="e10-cidade" onClick={() => escolher({ uf: x.uf, municipio: x.municipio })}>
                      <b>{x.municipio}</b>
                      <small>{x.comunidades === 1 ? c.contagemUma : preencher(c.contagem, { n: x.comunidades.toLocaleString(lang) })}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="e10-nota e10-depois">{c.escolha}</p>
        </>
      )}
    </div>
  );
}
