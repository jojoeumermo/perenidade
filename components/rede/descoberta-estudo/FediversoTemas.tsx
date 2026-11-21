// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Item 49: seguir #temas do Fediverso, só de servidores aprovados pela coordenação. Os #temas seguidos ficam neste aparelho; as notas
// vêm pelo servidor do site (app/api/rede/fediverso-tema), nunca direto do aparelho, e chegam só com texto (sem foto nem avatar).
import { useEffect, useId, useState } from "react";
import { de, notasDoTemaDeFora } from "@/lib/rede/descoberta-estudo/cliente";
import { dominioOk, MAXIMO_DE_TEMAS, seguirTema, temaOk, temasSeguidos } from "@/lib/rede/descoberta-estudo/fediverso-tema";
import type { NotaDeFora } from "@/lib/rede/descoberta-estudo/fediverso-tema";
import { Botao } from "../ui/Botao";
import { Bloco, Mensagem, fraseDoErro, por, useAcao, useLeitura, type PropsDaParte } from "./comum";

export default function FediversoTemas({ t, lang }: PropsDaParte) {
  const idTema = useId();
  const idDominio = useId();
  const f = t.fediverso;
  const [temas, setTemas] = useState<string[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [novo, setNovo] = useState("");
  const [dominio, setDominio] = useState("");
  const servidores = useLeitura("servidores", () => de.servidores());
  const notas = useLeitura(aberto, () => notasDoTemaDeFora(aberto ?? ""));
  const acao = useAcao(t, servidores.recarregar);
  useEffect(() => {
    const x = window.setTimeout(() => setTemas(temasSeguidos()), 0);
    return () => window.clearTimeout(x);
  }, []);

  const seguir = () => {
    const tema = temaOk(novo);
    if (!tema) return acao.avisar(f.temaTorto);
    const r = seguirTema(tema, true);
    if (r === "muitos") return acao.avisar(por(f.muitos, { n: MAXIMO_DE_TEMAS }));
    if (r === "invalido") return acao.avisar(f.temaTorto);
    setTemas(r);
    setNovo("");
    setAberto(tema);
  };
  const deixar = (tema: string) => {
    const r = seguirTema(tema, false);
    if (Array.isArray(r)) setTemas(r);
    if (aberto === tema) setAberto(null);
  };
  const lista = servidores.dado?.servidores ?? [];

  return (
    <div className="de-colunas">
      <Bloco titulo={f.titulo} ajuda={f.ajuda}>
        {temas === null ? (
          <p role="status" className="de-miudo">{t.carregando}</p>
        ) : temas.length === 0 ? (
          <p className="de-miudo">{f.nenhum}</p>
        ) : (
          <ul className="de-chips" aria-label={f.seguidos}>
            {temas.map((x) => (
              <li key={x} className="de-chip">
                <Botao variante={aberto === x ? "claro" : "contorno"} pressionado={aberto === x} onClick={() => setAberto(x)}>#{x}</Botao>
                <Botao variante="fantasma" className="de-x" aria-label={por(f.deixar, { tema: x })} onClick={() => deixar(x)}>×</Botao>
              </li>
            ))}
          </ul>
        )}
        {aberto && (
          <section className="de-bloco" aria-labelledby={`${idTema}-notas`} aria-busy={notas.carregando}>
            <h3 id={`${idTema}-notas`} className="de-form-titulo">{por(f.notasDe, { tema: aberto })}</h3>
            {notas.erro ? (
              <p className="de-erro" role="alert">{fraseDoErro(t, notas.erro)}</p>
            ) : !notas.dado ? (
              <p role="status" className="de-miudo">{t.carregando}</p>
            ) : notas.dado.length === 0 ? (
              <p className="de-miudo">{f.semNotas}</p>
            ) : (
              <ul className="de-lista">
                {notas.dado.map((n: NotaDeFora) => (
                  <li key={n.url} className="de-item">
                    <p className="de-miudo"><strong>{n.nome || n.conta}</strong> · {n.conta} · {new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(n.criado_em))}</p>
                    {n.aviso ? (
                      <details>
                        <summary className="de-resumo">{por(f.aviso, { aviso: n.aviso })}</summary>
                        <p className="de-texto de-pre">{n.texto}</p>
                      </details>
                    ) : (
                      <p className="de-texto de-pre">{n.texto}</p>
                    )}
                    <a className="de-link" href={n.url} target="_blank" rel="noopener noreferrer nofollow">{por(f.abrirLa, { servidor: n.servidor })}</a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </Bloco>
      <div className="de-bloco">
        <div className="de-form">
          <label className="de-campo" htmlFor={idTema}>
            <span>{f.seguir}</span>
            <input id={idTema} className="al2-campo" value={novo} maxLength={41} placeholder="#tema" onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && seguir()} />
          </label>
          <Botao onClick={seguir}>{f.seguirBotao}</Botao>
          <p className="de-miudo">{f.aparelho}</p>
        </div>
        <div className="de-form">
          <h3 className="de-form-titulo">{f.servidores}</h3>
          <p className="de-miudo">{f.servidoresAjuda}</p>
          {lista.length === 0 ? <p className="de-miudo">{f.semServidores}</p> : (
            <ul className="de-lista">
              {lista.map((d) => (
                <li key={d} className="de-item de-item-linha">
                  <span>{d}</span>
                  {servidores.dado?.cuido && <Botao variante="fantasma" disabled={acao.ocupado} onClick={() => void acao.fazer(async () => (await de.aprovarServidor(d, false), f.tirado))}>{f.tirar}</Botao>}
                </li>
              ))}
            </ul>
          )}
          {servidores.dado?.cuido && (
            <>
              <label className="de-campo" htmlFor={idDominio}>
                <span>{f.aprovar}</span>
                <input id={idDominio} className="al2-campo" value={dominio} maxLength={253} placeholder="exemplo.social" onChange={(e) => setDominio(e.target.value)} />
              </label>
              <Botao variante="contorno" disabled={acao.ocupado} onClick={() => {
                const d = dominioOk(dominio);
                if (!d) return acao.avisar(f.dominioTorto);
                void acao.fazer(async () => (await de.aprovarServidor(d, true), setDominio(""), f.aprovado));
              }}>{f.aprovarBotao}</Botao>
            </>
          )}
          <Mensagem mensagem={acao.mensagem} />
        </div>
      </div>
    </div>
  );
}
