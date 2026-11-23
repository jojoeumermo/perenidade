// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Item 68: a correção de referência da roda de redação (a roda anônima, com as 5 competências, já existe em /alumia/redacao). Uma
// educadora escreve, para o tema da semana, o que cada competência pede; quem está na roda só vê depois de corrigir uma redação
// daquela semana (para não copiar a régua antes de ler) ou quando a roda fecha. O banco não guarda quem escreveu.
import { useId, useState } from "react";
import Link from "@/components/Link";
import { de, NOTAS_DA_REDACAO, type Ficha } from "@/lib/rede/descoberta-estudo/cliente";
import { Botao } from "../ui/Botao";
import { Bloco, Mensagem, fraseDoErro, por, useAcao, useLeitura, type PropsDaParte } from "./comum";

const vazia = (): Ficha => ({ competencias: Array.from({ length: 5 }, () => ({ nota: 200, comentario: "" })), geral: "" });

export default function RedacaoReferencia({ t, lang }: PropsDaParte) {
  const id = useId();
  const k = t.redacao;
  const inicio = useLeitura("inicio", () => de.inicio());
  const semanas = useLeitura("semanas", () => de.semanasDaRedacao());
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const semana = escolhida ?? semanas.dado?.itens[0]?.semana ?? null;
  const ref = useLeitura(semana ? `ref:${semana}` : null, () => de.referencia(semana ?? ""));
  const [ficha, setFicha] = useState<Ficha>(vazia);
  const acao = useAcao(t, () => {
    ref.recarregar();
    semanas.recarregar();
  });
  const educadora = Boolean(inicio.dado?.educadora);
  const mudar = (i: number, campo: "nota" | "comentario", v: string) =>
    setFicha((f) => ({ ...f, competencias: f.competencias.map((c, j) => (j === i ? { ...c, [campo]: campo === "nota" ? Number(v) : v } : c)) }));

  return (
    <div className="de-colunas">
      <Bloco titulo={k.titulo} ajuda={k.ajuda}>
        {semanas.erro ? <p className="de-erro" role="alert">{fraseDoErro(t, semanas.erro)}</p> : !semanas.dado ? <p role="status" className="de-miudo">{t.carregando}</p> : semanas.dado.itens.length === 0 ? <p className="de-miudo">{k.semTema}</p> : (
          <label className="de-campo" htmlFor={`${id}-semana`}>
            <span>{k.semana}</span>
            <select id={`${id}-semana`} className="al2-campo" value={semana ?? ""} onChange={(e) => setEscolhida(e.target.value)}>
              {semanas.dado.itens.map((s) => <option key={s.semana} value={s.semana}>{`${s.semana.split("-").reverse().join("/")} · ${s.titulo}`}</option>)}
            </select>
          </label>
        )}
        {ref.dado && (
          !ref.dado.existe ? <p className="de-miudo">{k.semReferencia}</p>
            : !ref.dado.liberada || !ref.dado.ficha ? <p className="de-texto" role="status">{k.depoisDeCorrigir}</p>
            : (
              <ol className="de-lista">
                {ref.dado.ficha.competencias.map((c, i) => (
                  <li key={i} className="de-item">
                    <strong>{por(k.competencia, { n: i + 1, nome: k.competencias[i] ?? "" })}</strong>
                    <span className="de-miudo">{por(k.nota, { nota: c.nota })}</span>
                    <p className="de-texto de-pre">{c.comentario}</p>
                  </li>
                ))}
                {ref.dado.ficha.geral && <li className="de-item"><strong>{k.geral}</strong><p className="de-texto de-pre">{ref.dado.ficha.geral}</p></li>}
              </ol>
            )
        )}
        <p className="de-miudo">{k.privacidade} <Link href={`/${lang}/alumia/redacao`}>{k.roda}</Link></p>
      </Bloco>
      {educadora && semana && (
        <div className="de-form">
          <h3 className="de-form-titulo">{k.escrever}</h3>
          <p className="de-miudo">{k.escreverAjuda}</p>
          {ficha.competencias.map((c, i) => (
            <fieldset key={i} className="de-pergunta">
              <legend>{por(k.competencia, { n: i + 1, nome: k.competencias[i] ?? "" })}</legend>
              <label className="de-campo" htmlFor={`${id}-n${i}`}>
                <span>{k.notaRotulo}</span>
                <select id={`${id}-n${i}`} className="al2-campo" value={c.nota} onChange={(e) => mudar(i, "nota", e.target.value)}>
                  {NOTAS_DA_REDACAO.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="de-campo" htmlFor={`${id}-c${i}`}>
                <span>{k.comentario}</span>
                <textarea id={`${id}-c${i}`} className="al2-campo" value={c.comentario} maxLength={800} onChange={(e) => mudar(i, "comentario", e.target.value)} />
              </label>
            </fieldset>
          ))}
          <label className="de-campo" htmlFor={`${id}-geral`}>
            <span>{k.geral}</span>
            <textarea id={`${id}-geral`} className="al2-campo" value={ficha.geral} maxLength={800} onChange={(e) => setFicha({ ...ficha, geral: e.target.value })} />
          </label>
          <Botao disabled={acao.ocupado} onClick={() => void acao.fazer(async () => (await de.salvarReferencia(semana, ficha), k.salva))}>{k.salvar}</Botao>
          <Mensagem mensagem={acao.mensagem} />
        </div>
      )}
    </div>
  );
}
