// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Item 39: o mural de arte e cultura, o portfólio de cada pessoa sob o codinome. Cada peça é um post da própria pessoa (ligado pelo
// endereço), e o banco só devolve as peças cujo post quem olha pode ver (interno.rede_ve). O portfólio de um @ é o mesmo mural
// filtrado: nunca uma lista de pessoas.
import { useId, useState } from "react";
import Link from "@/components/Link";
import { confirmar } from "@/components/perguntar";
import { cultura } from "@/lib/rede/cultura/cliente";
import { LINGUAGENS, postDoEndereco, type Linguagem } from "@/lib/rede/cultura/regras";
import { preencher } from "@/lib/rede/preencher";
import { enderecos, handleOk } from "@/lib/rede/tipos";
import { Botao } from "../ui/Botao";
import { EstadoDaAlumia } from "../ui/Estado";
import { Mensagem, fraseDoErro, useAcao, useLeitura, type PropsDaParte } from "./comum";

export default function Mural({ t, lang }: PropsDaParte) {
  const campo = useId();
  const [linguagem, setLinguagem] = useState<Linguagem | "">("");
  const [arroba, setArroba] = useState("");
  const [handle, setHandle] = useState<string | null>(null);
  const [endereco, setEndereco] = useState("");
  const [titulo, setTitulo] = useState("");
  const [novaLinguagem, setNovaLinguagem] = useState<Linguagem>("desenho");
  const leitura = useLeitura(`${linguagem}:${handle ?? ""}`, () => cultura.mural(linguagem || null, handle));
  const acao = useAcao(t, leitura.recarregar);
  const itens = leitura.dado?.itens ?? [];

  const verPortfolio = () => {
    const h = arroba.trim().replace(/^@/, "").toLowerCase();
    if (!handleOk(h)) return acao.avisar(t.erros.nao_encontrado);
    setHandle(h);
  };

  return (
    <div className="cu-colunas">
      <div className="cu-bloco">
        <h2 className="cu-subtitulo al-cond">{handle && leitura.dado?.autor ? preencher(t.mural.portfolioDe, { autor: leitura.dado.autor }) : t.mural.titulo}</h2>
        <p className="cu-miudo">{t.mural.ajuda}</p>
        <div className="cu-filtros">
          <label className="cu-campo">
            <span>{t.mural.linguagem}</span>
            <select className="al2-campo" value={linguagem} onChange={(e) => setLinguagem(e.target.value as Linguagem | "")}>
              <option value="">{t.mural.todas}</option>
              {LINGUAGENS.map((l) => <option key={l} value={l}>{t.linguagens[l]}</option>)}
            </select>
          </label>
          <form
            className="cu-filtros"
            onSubmit={(e) => {
              e.preventDefault();
              verPortfolio();
            }}
          >
            <label className="cu-campo">
              <span>{t.mural.portfolio}</span>
              <input className="al2-campo" value={arroba} onChange={(e) => setArroba(e.target.value)} autoComplete="off" maxLength={21} aria-describedby={`${campo}-arroba`} />
            </label>
            <Botao type="submit" variante="contorno">{t.mural.verPortfolio}</Botao>
          </form>
        </div>
        <p id={`${campo}-arroba`} className="cu-miudo">{t.mural.portfolioAjuda}</p>
        {handle && (
          <Botao
            variante="fantasma"
            tamanho="p"
            onClick={() => {
              setHandle(null);
              setArroba("");
            }}
          >
            {t.mural.limpar}
          </Botao>
        )}

        {leitura.erro ? (
          <EstadoDaAlumia erro texto={fraseDoErro(t, leitura.erro)}>
            <Botao variante="contorno" onClick={() => (handle ? setHandle(null) : leitura.recarregar())}>{handle ? t.mural.limpar : t.tentar}</Botao>
          </EstadoDaAlumia>
        ) : !leitura.dado ? (
          <p role="status" className="cu-miudo">{t.carregando}</p>
        ) : itens.length === 0 ? (
          <p className="cu-miudo">{t.mural.vazio}</p>
        ) : (
          <ul className="cu-lista cu-mural">
            {itens.map((k) => (
              <li key={k.id} className="cu-item">
                <p className="cu-etiqueta al-cond">{t.linguagens[k.linguagem]}</p>
                <strong className="cu-item-titulo">{k.titulo}</strong>
                <p className="cu-miudo">{preencher(t.obras.por, { autor: k.autor })}</p>
                <div className="cu-acoes">
                  <Link className="al-botao al-botao-contorno al-botao-p" href={enderecos.post(lang, k.post)} aria-label={`${t.mural.verPost}: ${k.titulo}`}>{t.mural.verPost}</Link>
                  {k.minha && (
                    <Botao
                      variante="fantasma"
                      tamanho="p"
                      disabled={acao.ocupado}
                      onClick={() =>
                        void acao.fazer(async () => {
                          if (!(await confirmar(t.mural.perguntaTirar, { sim: t.mural.tirar }))) return null;
                          await cultura.tirarPeca(k.id);
                          return t.mural.tirada;
                        })
                      }
                    >
                      {t.mural.tirar}
                    </Botao>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        className="cu-form cu-lado"
        aria-labelledby={`${campo}-nova`}
        onSubmit={(e) => {
          e.preventDefault();
          const post = postDoEndereco(endereco);
          if (!post) return acao.avisar(t.mural.nova.enderecoRuim);
          void acao.fazer(async () => {
            await cultura.criarPeca(post, titulo.trim(), novaLinguagem);
            setEndereco("");
            setTitulo("");
            return t.mural.nova.feita;
          });
        }}
      >
        <h3 id={`${campo}-nova`} className="cu-form-titulo">{t.mural.nova.titulo}</h3>
        <p className="cu-miudo">{t.mural.nova.ajuda}</p>
        <label className="cu-campo">
          <span>{t.mural.nova.endereco}</span>
          <input className="al2-campo" value={endereco} onChange={(e) => setEndereco(e.target.value)} inputMode="url" autoComplete="off" maxLength={300} required />
        </label>
        <label className="cu-campo">
          <span>{t.mural.nova.nome}</span>
          <input className="al2-campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} minLength={2} maxLength={120} required />
        </label>
        <label className="cu-campo">
          <span>{t.mural.linguagem}</span>
          <select className="al2-campo" value={novaLinguagem} onChange={(e) => setNovaLinguagem(e.target.value as Linguagem)}>
            {LINGUAGENS.map((l) => <option key={l} value={l}>{t.linguagens[l]}</option>)}
          </select>
        </label>
        <Botao type="submit" disabled={acao.ocupado}>{t.mural.nova.por}</Botao>
        <Mensagem mensagem={acao.mensagem} />
      </form>
    </div>
  );
}
