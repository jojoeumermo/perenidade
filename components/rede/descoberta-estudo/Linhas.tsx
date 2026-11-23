// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Item 51: linhas compartilháveis. Quem monta publica a regra (só #temas e comunidades abertas) e ganha um código; quem segue cola o
// código e a linha entra nas "Minhas linhas" deste aparelho. O banco não sabe quem segue nem quantas pessoas seguem; a linha não diz
// quem a criou. A cada visita, as linhas seguidas se atualizam pela regra publicada (e saem se quem publicou tirou).
import { useEffect, useId, useState } from "react";
import Link from "@/components/Link";
import { confirmar } from "@/components/perguntar";
import { BackendError } from "@/lib/backend";
import { de } from "@/lib/rede/descoberta-estudo/cliente";
import { atualizarSeguida, codigoDe, deixarDeSeguir, seguidas, seguirLinha, temasDigitados, type LinhaCompartilhada, type Seguida } from "@/lib/rede/descoberta-estudo/linhas";
import { Botao } from "../ui/Botao";
import { Bloco, Mensagem, fraseDoErro, por, useAcao, useLeitura, type PropsDaParte, type T } from "./comum";

/** A regra em português claro: "Posts com #a ou #b, das comunidades X e Y". */
export function regraEmPalavras(t: T, l: Pick<LinhaCompartilhada, "tags" | "comunidades">): string {
  const temas = l.tags.map((x) => `#${x}`).join(t.linhas.ou);
  const comunidades = l.comunidades.map((c) => c.nome).join(t.linhas.ou);
  if (temas && comunidades) return por(t.linhas.regraAmbos, { temas, comunidades });
  return temas ? por(t.linhas.regraTemas, { temas }) : por(t.linhas.regraComunidades, { comunidades });
}

export default function Linhas({ t, lang }: PropsDaParte) {
  const ids = { nome: useId(), temas: useId(), comunidades: useId(), codigo: useId() };
  const k = t.linhas;
  const [nome, setNome] = useState("");
  const [temas, setTemas] = useState("");
  const [comunidades, setComunidades] = useState("");
  const [codigo, setCodigo] = useState("");
  const [minhas, setMinhas] = useState<Seguida[] | null>(null);
  const [detalhes, setDetalhes] = useState<Record<string, LinhaCompartilhada | null>>({});
  const publicadas = useLeitura("minhas", () => de.minhasLinhas());
  const acao = useAcao(t, publicadas.recarregar);

  // As seguidas deste aparelho, atualizadas pela regra publicada (a que foi tirada sai também).
  useEffect(() => {
    let vivo = true;
    const lista = seguidas();
    const x = window.setTimeout(() => setMinhas(lista), 0);
    void (async () => {
      const achadas: Record<string, LinhaCompartilhada | null> = {};
      for (const s of lista) {
        try {
          achadas[s.codigo] = await de.linha(s.codigo);
          atualizarSeguida(s.codigo, achadas[s.codigo]);
        } catch (e) {
          if (e instanceof BackendError && e.code === "nao_encontrada") {
            achadas[s.codigo] = null;
            atualizarSeguida(s.codigo, null);
          }
        }
      }
      if (vivo) {
        setDetalhes(achadas);
        setMinhas(seguidas());
      }
    })();
    return () => {
      vivo = false;
      window.clearTimeout(x);
    };
  }, []);

  const publicar = () =>
    void acao.fazer(async () => {
      const tags = temasDigitados(temas);
      const slugs = [...new Set(comunidades.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))];
      const l = await de.publicarLinha(nome.trim(), { ...(tags.length ? { tags } : {}), ...(slugs.length ? { comunidades: slugs } : {}) });
      setNome("");
      setTemas("");
      setComunidades("");
      return por(k.publicada, { codigo: l.codigo });
    });

  const seguir = () =>
    void acao.fazer(async () => {
      const c = codigoDe(codigo);
      if (!c) throw new BackendError("invalido:codigo");
      const l = await de.linha(c);
      const r = seguirLinha(l);
      if (r === "ja") return k.jaSegue;
      if (typeof r === "string") throw new BackendError(`linha:${r}`);
      setMinhas(r);
      setDetalhes((d) => ({ ...d, [c]: l }));
      setCodigo("");
      return por(k.seguindo, { nome: l.nome });
    });

  const copiar = async (c: string) => {
    try {
      await navigator.clipboard.writeText(c);
      acao.avisar(k.copiado, false);
    } catch {
      acao.avisar(k.copieAMao);
    }
  };

  return (
    <div className="de-colunas">
      <Bloco titulo={k.titulo} ajuda={k.ajuda}>
        <h3 className="de-form-titulo">{k.sigo}</h3>
        {minhas === null ? <p role="status" className="de-miudo">{t.carregando}</p> : minhas.length === 0 ? <p className="de-miudo">{k.nenhumaSeguida}</p> : (
          <ul className="de-lista">
            {minhas.map((s) => {
              const l = detalhes[s.codigo];
              return (
                <li key={s.codigo} className="de-item">
                  <strong>{l?.nome ?? s.codigo}</strong>
                  {l && <p className="de-miudo">{regraEmPalavras(t, l)}</p>}
                  <div className="de-acoes">
                    <Link href={`/${lang}/alumia/linhas`} className="al-botao al-botao-contorno al-botao-m">{k.abrir}</Link>
                    <Botao variante="fantasma" onClick={() => {
                      deixarDeSeguir(s.codigo);
                      setMinhas(seguidas());
                    }}>{k.deixar}</Botao>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <h3 className="de-form-titulo">{k.publiquei}</h3>
        {publicadas.erro ? <p className="de-erro" role="alert">{fraseDoErro(t, publicadas.erro)}</p> : !publicadas.dado ? <p role="status" className="de-miudo">{t.carregando}</p> : publicadas.dado.itens.length === 0 ? <p className="de-miudo">{k.nenhumaPublicada}</p> : (
          <ul className="de-lista">
            {publicadas.dado.itens.map((l) => (
              <li key={l.codigo} className="de-item">
                <strong>{l.nome}</strong>
                <p className="de-miudo">{regraEmPalavras(t, l)}</p>
                <p className="de-miudo">{k.codigo} <code className="de-codigo">{l.codigo}</code></p>
                <div className="de-acoes">
                  <Botao variante="contorno" onClick={() => void copiar(l.codigo)}>{k.copiar}</Botao>
                  <Botao variante="fantasma" disabled={acao.ocupado} onClick={async () => {
                    if (await confirmar(k.tirarConfirmar, { perigo: true })) void acao.fazer(async () => (await de.tirarLinha(l.codigo), k.tirada));
                  }}>{k.tirar}</Botao>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="de-miudo">{k.privacidade}</p>
      </Bloco>
      <div className="de-bloco">
        <div className="de-form">
          <h3 className="de-form-titulo">{k.seguirTitulo}</h3>
          <label className="de-campo" htmlFor={ids.codigo}>
            <span>{k.codigoRotulo}</span>
            <input id={ids.codigo} className="al2-campo" value={codigo} maxLength={200} onChange={(e) => setCodigo(e.target.value)} />
          </label>
          <Botao disabled={acao.ocupado} onClick={seguir}>{k.seguirBotao}</Botao>
        </div>
        <div className="de-form">
          <h3 className="de-form-titulo">{k.publicarTitulo}</h3>
          <label className="de-campo" htmlFor={ids.nome}>
            <span>{k.nome}</span>
            <input id={ids.nome} className="al2-campo" value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label className="de-campo" htmlFor={ids.temas}>
            <span>{k.temas}</span>
            <input id={ids.temas} className="al2-campo" value={temas} maxLength={250} placeholder="#passelivre #moradia" onChange={(e) => setTemas(e.target.value)} />
          </label>
          <label className="de-campo" htmlFor={ids.comunidades}>
            <span>{k.comunidades}</span>
            <input id={ids.comunidades} className="al2-campo" value={comunidades} maxLength={330} placeholder="moradia, transporte" onChange={(e) => setComunidades(e.target.value)} />
          </label>
          <p className="de-miudo">{k.soAbertas}</p>
          <Botao disabled={acao.ocupado} onClick={publicar}>{k.publicarBotao}</Botao>
        </div>
        <Mensagem mensagem={acao.mensagem} />
      </div>
    </div>
  );
}
