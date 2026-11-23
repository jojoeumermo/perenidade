// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Item 102: o mural de editais e bolsas. Quem é da Alumia propõe com o link oficial e o prazo; a coordenação confere e publica. O mural
// não diz quem propôs; passado o prazo, o edital sai do mural e, 30 dias depois, some do banco.
import { useId, useState, type ReactNode } from "react";
import { de, TIPOS_DE_EDITAL, type Edital, type TipoDeEdital } from "@/lib/rede/descoberta-estudo/cliente";
import { Botao } from "../ui/Botao";
import { EstadoDaAlumia } from "../ui/Estado";
import { Bloco, Mensagem, fraseDoErro, por, useAcao, useLeitura, type PropsDaParte, type T } from "./comum";

const prazo = (lang: string, d: string) => new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

function UmEdital({ e, t, lang, children }: { e: Edital; t: T; lang: string; children?: ReactNode }) {
  return (
    <li className="de-item">
      <p className="de-etiqueta">{t.editais.tipos[e.tipo]}</p>
      <strong className="de-item-titulo">{e.titulo}</strong>
      <p className="de-miudo">{e.orgao} · {por(t.editais.ate, { dia: prazo(lang, e.prazo) })}</p>
      {e.resumo && <p className="de-texto">{e.resumo}</p>}
      <a className="de-link" href={e.link} target="_blank" rel="noopener noreferrer nofollow">{t.editais.abrir}</a>
      {children}
    </li>
  );
}

export default function Editais({ t, lang }: PropsDaParte) {
  const id = useId();
  const k = t.editais;
  const [tipo, setTipo] = useState<TipoDeEdital | "">("");
  const [novo, setNovo] = useState({ titulo: "", orgao: "", tipo: "bolsa" as TipoDeEdital, link: "", prazo: "", resumo: "" });
  const leitura = useLeitura(`editais:${tipo}`, () => de.editais(tipo || null));
  const acao = useAcao(t, leitura.recarregar);
  const propor = () =>
    void acao.fazer(async () => {
      await de.proporEdital(novo);
      setNovo({ titulo: "", orgao: "", tipo: novo.tipo, link: "", prazo: "", resumo: "" });
      return k.proposto;
    });
  return (
    <div className="de-colunas">
      <Bloco titulo={k.titulo} ajuda={k.ajuda}>
        <label className="de-campo de-campo-comunidade" htmlFor={`${id}-filtro`}>
          <span>{k.filtro}</span>
          <select id={`${id}-filtro`} className="al2-campo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeEdital | "")}>
            <option value="">{k.todos}</option>
            {TIPOS_DE_EDITAL.map((x) => <option key={x} value={x}>{k.tipos[x]}</option>)}
          </select>
        </label>
        {leitura.erro ? (
          <EstadoDaAlumia erro texto={fraseDoErro(t, leitura.erro)}>
            <Botao variante="contorno" onClick={leitura.recarregar}>{t.tentar}</Botao>
          </EstadoDaAlumia>
        ) : !leitura.dado ? (
          <p role="status" className="de-miudo">{t.carregando}</p>
        ) : leitura.dado.itens.length === 0 ? (
          <p className="de-miudo">{k.vazio}</p>
        ) : (
          <ul className="de-lista">{leitura.dado.itens.map((e) => <UmEdital key={e.id} e={e} t={t} lang={lang} />)}</ul>
        )}
        {leitura.dado?.cuido && (
          <section className="de-bloco" aria-labelledby={`${id}-fila`}>
            <h3 id={`${id}-fila`} className="de-form-titulo">{k.fila}</h3>
            {leitura.dado.fila.length === 0 ? <p className="de-miudo">{k.filaVazia}</p> : (
              <ul className="de-lista">
                {leitura.dado.fila.map((e) => (
                  <UmEdital key={e.id} e={e} t={t} lang={lang}>
                    <p className="de-miudo">{k.confira}</p>
                    <div className="de-acoes">
                      <Botao disabled={acao.ocupado} onClick={() => void acao.fazer(async () => (await de.decidirEdital(e.id, true), k.publicado))}>{k.publicar}</Botao>
                      <Botao variante="fantasma" disabled={acao.ocupado} onClick={() => void acao.fazer(async () => (await de.decidirEdital(e.id, false), k.tirado))}>{k.tirar}</Botao>
                    </div>
                  </UmEdital>
                ))}
              </ul>
            )}
          </section>
        )}
      </Bloco>
      <div className="de-form">
        <h3 className="de-form-titulo">{k.proporTitulo}</h3>
        <label className="de-campo" htmlFor={`${id}-titulo`}><span>{k.campoTitulo}</span><input id={`${id}-titulo`} className="al2-campo" value={novo.titulo} maxLength={160} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} /></label>
        <label className="de-campo" htmlFor={`${id}-orgao`}><span>{k.orgao}</span><input id={`${id}-orgao`} className="al2-campo" value={novo.orgao} maxLength={80} onChange={(e) => setNovo({ ...novo, orgao: e.target.value })} /></label>
        <label className="de-campo" htmlFor={`${id}-tipo`}>
          <span>{k.tipo}</span>
          <select id={`${id}-tipo`} className="al2-campo" value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value as TipoDeEdital })}>
            {TIPOS_DE_EDITAL.map((x) => <option key={x} value={x}>{k.tipos[x]}</option>)}
          </select>
        </label>
        <label className="de-campo" htmlFor={`${id}-link`}><span>{k.link}</span><input id={`${id}-link`} className="al2-campo" type="url" inputMode="url" value={novo.link} maxLength={500} placeholder="https://" onChange={(e) => setNovo({ ...novo, link: e.target.value })} /></label>
        <label className="de-campo" htmlFor={`${id}-prazo`}><span>{k.prazo}</span><input id={`${id}-prazo`} className="al2-campo" type="date" value={novo.prazo} onChange={(e) => setNovo({ ...novo, prazo: e.target.value })} /></label>
        <label className="de-campo" htmlFor={`${id}-resumo`}><span>{k.resumo}</span><textarea id={`${id}-resumo`} className="al2-campo" value={novo.resumo} maxLength={400} onChange={(e) => setNovo({ ...novo, resumo: e.target.value })} /></label>
        <Botao disabled={acao.ocupado} onClick={propor}>{k.propor}</Botao>
        <Mensagem mensagem={acao.mensagem} />
        <p className="de-miudo">{k.privacidade}</p>
      </div>
    </div>
  );
}
