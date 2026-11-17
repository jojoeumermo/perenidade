// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { estrutura as cliente } from "@/lib/rede/estrutura/cliente";
import type { Espacos } from "@/lib/rede/estrutura/tipos";
import { preencher } from "@/lib/rede/preencher";
import { enderecos } from "@/lib/rede/tipos";
import { enderecosCom } from "@/lib/rede/tipos-comunidades";
import type { ContextoDoEncaixe } from "../../encaixes";
import { classeDaCor, lugarEscrito, mensagemDeErro, useTextosEstrutura } from "./base";
import "./estrutura.css";

/**
 * A aba Espaços do perfil de uma organização com selo (encaixe abasDoPerfil): as comunidades ligadas a ela (com as subcomunidades
 * de cada uma) e os núcleos, num lugar só. Só lugares: nome, tipo, cidade escrita e posts da semana (agregado). Quem gerencia vê
 * os pedidos de comunidades e decide. Perfil que não é de organização com selo: a aba não desenha nada.
 */
export function EspacosDaOrg({ lang, s, handle }: ContextoDoEncaixe & { handle: string }) {
  const te = useTextosEstrutura(lang);
  const [estado, setEstado] = useState<{ handle: string; dado: Espacos | null; erro: string } | null>(null);
  const [versao, setVersao] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [retorno, setRetorno] = useState<{ texto: string; erro: boolean } | null>(null);

  useEffect(() => {
    let vivo = true;
    cliente.espacos(handle).then(
      (dado) => vivo && setEstado({ handle, dado, erro: "" }),
      (e) => vivo && setEstado({ handle, dado: null, erro: mensagemDeErro(s, null, e) }),
    );
    return () => {
      vivo = false;
    };
  }, [handle, s, versao]);

  if (!te || !estado || estado.handle !== handle) return <p className="e10 e10-tela e10-nota" role="status">{te?.carregando ?? s.estados.carregando}</p>;
  if (estado.erro) {
    return (
      <div className="e10 e10-tela" role="alert">
        <p className="e10-erro">{estado.erro}</p>
        <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => setVersao((n) => n + 1)}>{te.tentar}</button>
      </div>
    );
  }
  const d = estado.dado;
  if (!d) return null;
  const t = te.espacos;

  async function decidir(slug: string, aceita: boolean) {
    if (!te || !d) return;
    setOcupado(true);
    setRetorno(null);
    try {
      const novo = await cliente.decidirOrg(d.handle, slug, aceita);
      if (novo) setEstado({ handle, dado: novo, erro: "" });
      else setVersao((n) => n + 1);
      setRetorno({ texto: te.salvo, erro: false });
    } catch (e) {
      setRetorno({ texto: mensagemDeErro(s, te, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="e10 e10-tela">
      <header className="e10-cabeca">
        <h2 className="e10-cond">{t.titulo}</h2>
        <p>{d.selo ? t.intro : t.semSelo}</p>
      </header>

      <div className="e10-grade">
        <section className="e10-secao" aria-labelledby="e10-esp-com">
          <h3 id="e10-esp-com" className="e10-secao-titulo e10-cond"><span className="e10-ladrilho" aria-hidden>{d.comunidades.length}</span>{t.comunidades}</h3>
          {d.comunidades.length === 0 ? (
            <p className="e10-vazio">{t.semComunidades}</p>
          ) : (
            <ul className="e10-ladrilhos e10-ladrilhos-3">
              {d.comunidades.map((c) => (
                <li key={c.slug}>
                  <article className={`e10-com ${classeDaCor(c)}`}>
                    <span className="e10-selo-tipo">{te.tipo[c.tipo]}</span>
                    <h4 className="e10-com-nome e10-cond"><Link href={enderecos.comunidade(lang, c.slug)}>{c.nome}</Link></h4>
                    {c.municipio && <p className="e10-com-meta">{lugarEscrito(c)}</p>}
                    {c.descricao && <p className="e10-com-desc">{c.descricao}</p>}
                    {typeof c.posts_7d === "number" && (
                      <p className="e10-com-meta">{c.posts_7d >= 3 ? preencher(te.postsSemana, { n: c.posts_7d.toLocaleString(lang) }) : te.semanaQuieta}</p>
                    )}
                    {c.filhas.length > 0 && <p className="e10-com-meta">{preencher(t.dentro, { nomes: c.filhas.map((f) => f.nome).join(", ") })}</p>}
                    {d.gerencio && (
                      <p className="e10-com-acao">
                        <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled={ocupado} onClick={() => void decidir(c.slug, false)}>{t.tirar}</button>
                      </p>
                    )}
                  </article>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="e10-secao" aria-labelledby="e10-esp-nuc">
          <h3 id="e10-esp-nuc" className="e10-secao-titulo e10-cond"><span className="e10-ladrilho" aria-hidden>{d.nucleos.length}</span>{t.nucleos}</h3>
          {d.nucleos.length === 0 ? (
            <p className="e10-vazio">{t.semNucleos}</p>
          ) : (
            <ul className="e10-ladrilhos e10-ladrilhos-3">
              {d.nucleos.map((n) => (
                <li key={n.id}>
                  <article className="e10-com e10-cor-4">
                    <h4 className="e10-com-nome e10-cond"><Link href={enderecosCom.nucleo(lang, n.id)}>{n.nome}</Link></h4>
                    {n.cidade && <p className="e10-com-meta">{n.uf ? `${n.cidade} – ${n.uf}` : n.cidade}</p>}
                    {n.quando && <p className="e10-com-desc">{n.quando}</p>}
                  </article>
                </li>
              ))}
            </ul>
          )}
        </section>

        {d.gerencio && (d.pedidos?.length ?? 0) > 0 && (
          <section className="e10-secao" aria-labelledby="e10-esp-ped">
            <h3 id="e10-esp-ped" className="e10-secao-titulo e10-cond"><span className="e10-ladrilho" aria-hidden>{d.pedidos!.length}</span>{t.pedidos}</h3>
            <ul className="e10-pedidos">
              {d.pedidos!.map((c) => (
                <li key={c.slug} className="e10-pedido">
                  <p>{preencher(t.pedido, { nome: c.nome })}</p>
                  <button type="button" className="al-botao al-botao-primario al-botao-p" disabled={ocupado} onClick={() => void decidir(c.slug, true)}>{te.aceitar}</button>
                  <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled={ocupado} onClick={() => void decidir(c.slug, false)}>{te.recusar}</button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {retorno && <p role={retorno.erro ? "alert" : "status"} className={retorno.erro ? "e10-erro" : "e10-status"}>{retorno.texto}</p>}
      </div>
    </div>
  );
}

export default EspacosDaOrg;
