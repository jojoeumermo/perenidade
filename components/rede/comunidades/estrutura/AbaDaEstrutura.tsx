// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { estrutura as cliente } from "@/lib/rede/estrutura/cliente";
import type { Estrutura } from "@/lib/rede/estrutura/tipos";
import { preencher } from "@/lib/rede/preencher";
import { enderecos } from "@/lib/rede/tipos";
import { enderecosCom } from "@/lib/rede/tipos-comunidades";
import type { ContextoDoEncaixe } from "../../encaixes";
import { AjustarEstrutura } from "./AjustarEstrutura";
import { classeDaCor, lugarEscrito, mensagemDeErro, useTextosEstrutura } from "./base";
import "./estrutura.css";

/** O endereço da lista por cidade já aberta num município (a Lista lê ?uf=&municipio=). */
export function enderecoDaCidade(lang: string, uf: string, municipio: string): string {
  return `${enderecosCom.lista(lang)}?uf=${encodeURIComponent(uf)}&municipio=${encodeURIComponent(municipio)}`;
}

/**
 * A aba Estrutura da comunidade (encaixe abasDaComunidade): onde ela mora (mãe), quem mora nela (subcomunidades), a cidade e o
 * bairro escritos, a organização com selo e, se ela é de avisos, quem responde. Para a moderação, o painel de ajuste. Mostra
 * lugares, nunca pessoas.
 */
export function AbaDaEstrutura({ lang, s, slug }: ContextoDoEncaixe & { slug: string }) {
  const te = useTextosEstrutura(lang);
  const [estado, setEstado] = useState<{ slug: string; dado: Estrutura | null; erro: string } | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    cliente.ver(slug).then(
      (dado) => vivo && setEstado({ slug, dado, erro: "" }),
      (e) => vivo && setEstado({ slug, dado: null, erro: mensagemDeErro(s, null, e) }),
    );
    return () => {
      vivo = false;
    };
  }, [slug, s, versao]);

  if (!te || !estado || estado.slug !== slug) return <p className="e10 e10-tela e10-nota" role="status">{te?.carregando ?? s.estados.carregando}</p>;
  if (!estado.dado) {
    return (
      <div className="e10 e10-tela" role="alert">
        <p className="e10-erro">{estado.erro}</p>
        <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => setVersao((n) => n + 1)}>{te.tentar}</button>
      </div>
    );
  }
  const e = estado.dado;
  const t = te.estrutura;

  return (
    <div className="e10 e10-tela">
      <header className="e10-cabeca">
        <h2 className="e10-cond">{t.titulo}</h2>
        {e.so_leitura && (
          <p>
            <span className="e10-carimbo">{t.soLeitura}</span>{" "}
            {t.soLeituraTexto} {t.respostasTexto[e.respostas]}
          </p>
        )}
      </header>

      <div className="e10-grade e10-grade-2">
        {e.mae && (
          <section className="e10-secao" aria-labelledby="e10-mae">
            <h3 id="e10-mae" className="e10-secao-titulo e10-cond"><span className="e10-ladrilho" aria-hidden>↑</span>{t.moraEm}</h3>
            <ul className="e10-ladrilhos">
              <li>
                <article className={`e10-com ${classeDaCor(e.mae)}`}>
                  <h4 className="e10-com-nome e10-cond"><Link href={enderecos.comunidade(lang, e.mae.slug)}>{e.mae.nome}</Link></h4>
                  {e.mae.descricao && <p className="e10-com-desc">{e.mae.descricao}</p>}
                </article>
              </li>
            </ul>
            <p className="e10-nota">{preencher(t.herancaTexto[e.heranca], { mae: e.mae.nome })}</p>
          </section>
        )}

        <section className={`e10-secao ${e.mae ? "" : "e10-largo"}`} aria-labelledby="e10-filhas">
          <h3 id="e10-filhas" className="e10-secao-titulo e10-cond"><span className="e10-ladrilho" aria-hidden>{e.filhas.length}</span>{t.subcomunidades}</h3>
          {e.filhas.length === 0 ? (
            <p className="e10-vazio">{t.semSub}</p>
          ) : (
            <ul className="e10-ladrilhos e10-ladrilhos-3">
              {e.filhas.map((f) => (
                <li key={f.slug}>
                  <article className={`e10-com ${classeDaCor(f)}`}>
                    <span className="e10-selo-tipo">{te.tipo[f.tipo]}</span>
                    <h4 className="e10-com-nome e10-cond"><Link href={enderecos.comunidade(lang, f.slug)}>{f.nome}</Link></h4>
                    {f.bairro && <p className="e10-com-meta">{f.bairro}</p>}
                    {f.descricao && <p className="e10-com-desc">{f.descricao}</p>}
                  </article>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="e10-secao" aria-labelledby="e10-onde">
          <h3 id="e10-onde" className="e10-secao-titulo e10-cond"><span className="e10-ladrilho" aria-hidden>⌂</span>{t.onde}</h3>
          {e.local ? (
            <>
              <p className="e10-cond e10-grande">{lugarEscrito(e.local)}</p>
              <p className="e10-nota">
                <Link className="e10-link" href={enderecoDaCidade(lang, e.local.uf, e.local.municipio)}>{preencher(t.verCidade, { cidade: e.local.municipio })}</Link>
              </p>
            </>
          ) : (
            <p className="e10-vazio">{t.ondeVazio}</p>
          )}
        </section>

        {e.org && (
          <section className="e10-secao" aria-labelledby="e10-org">
            <h3 id="e10-org" className="e10-secao-titulo e10-cond"><span className="e10-ladrilho" aria-hidden>★</span>{t.org}</h3>
            <p className="e10-cond e10-grande">{e.org.codinome || `@${e.org.handle}`}</p>
            <p className="e10-nota"><Link className="e10-link" href={enderecos.perfil(lang, e.org.handle)}>{t.verEspacos}</Link></p>
          </section>
        )}
      </div>

      {(e.ajusto ?? e.modero) && <AjustarEstrutura lang={lang} s={s} te={te} dado={e} aoMudar={(novo) => setEstado({ slug, dado: novo, erro: "" })} />}
    </div>
  );
}

export default AbaDaEstrutura;
