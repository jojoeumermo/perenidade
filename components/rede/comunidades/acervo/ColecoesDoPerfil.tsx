// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useState } from "react";
import { preencher } from "@/lib/rede/preencher";
import type { ContextoDoEncaixe } from "../../encaixes";
import { acervo } from "./cliente";
import { Colecoes } from "./Colecoes";
import { useTextosDoAcervo } from "./textos";
import type { ListaDeColecoes } from "./tipos";
import "./acervo.css";

/**
 * As coleções de uma pessoa no perfil dela (encaixe abasDoPerfil): uma fileira de fichas, que abre as coleções logo abaixo. Quem não
 * tem coleção não ganha fileira nenhuma (nem "0 coleções"), e quem visita não vê nada; a dona vê um ladrilho que diz o que é, com o
 * botão de criar a primeira.
 */
export function ColecoesDoPerfil({ lang, s, situacao, handle }: ContextoDoEncaixe & { handle: string }) {
  const t = useTextosDoAcervo(lang);
  const id = useId();
  const [lista, setLista] = useState<{ handle: string; dado: ListaDeColecoes } | null>(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    let vivo = true;
    acervo
      .colecoes({ handle })
      .then((dado) => vivo && setLista({ handle, dado }))
      .catch(() => vivo && setLista(null));
    return () => {
      vivo = false;
    };
  }, [handle, aberto]);

  if (!t || !lista || lista.handle !== handle) return null;
  const { itens, pode_criar } = lista.dado;
  if (itens.length === 0 && !pode_criar) return null;
  if (itens.length === 0 && !aberto) {
    return (
      <section aria-labelledby={`${id}-vazio`} className="acv-perfil">
        <div className="acv-perfil-vazio">
          <h2 id={`${id}-vazio`} className="acv-cond">{t.colecoes.vazioDonoTitulo}</h2>
          <p>{t.colecoes.vazioDonoLinha}</p>
          <button type="button" className="acv-botao" data-cheio="" onClick={() => setAberto(true)}>{t.colecoes.nova}</button>
        </div>
      </section>
    );
  }
  return (
    <section aria-label={t.abaDoPerfil} className="acv-perfil">
      <div className="acv-fileira">
        <button type="button" className="acv-ficha" aria-expanded={aberto} aria-controls={`${id}-painel`} onClick={() => setAberto((a) => !a)}>
          <span className="acv-carimbo" aria-hidden>{t.abaDoPerfil}</span>
          {pode_criar && itens.length === 0 ? t.colecoes.nova : <small>{itens.length.toLocaleString(lang)}</small>}
        </button>
        {itens.map((k) => (
          <button key={k.id} type="button" className="acv-ficha" aria-controls={`${id}-painel`} onClick={() => setAberto(true)}>
            {k.titulo}
            <small>{k.posts === 1 ? t.colecoes.umPost : preencher(t.colecoes.posts, { n: k.posts.toLocaleString(lang) })}</small>
          </button>
        ))}
      </div>
      <div id={`${id}-painel`} hidden={!aberto} className="acv">
        {aberto && <Colecoes alvo={{ handle }} lang={lang} s={s} t={t} logado={situacao.logado} />}
      </div>
    </section>
  );
}
