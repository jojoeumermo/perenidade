// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Item 41: o clube de leitura da comunidade. A estante (lendo, próximos, lidos), o progresso de cada pessoa (só ela vê, só o último,
// sem data), o do grupo somado (só com 3 leitoras ou mais, a média de 10 em 10) e as citações sem o nome de quem pôs.
import { useId, useState } from "react";
import { confirmar } from "@/components/perguntar";
import { cultura, type Livro } from "@/lib/rede/cultura/cliente";
import { DEGRAUS, SITUACOES_DO_LIVRO, type SituacaoDoLivro } from "@/lib/rede/cultura/regras";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import { EstadoDaAlumia } from "../ui/Estado";
import { Mensagem, fraseDoErro, useAcao, useLeitura, type PropsDaParte, type T } from "./comum";

type Acao = ReturnType<typeof useAcao>;

/** Um livro: o progresso, o do grupo, as citações e as ações de quem pode. */
function CartaoDoLivro({ t, livro, modero, posso, acao }: { t: T; livro: Livro; modero: boolean; posso: boolean; acao: Acao }) {
  const campo = useId();
  const [texto, setTexto] = useState("");
  const [pagina, setPagina] = useState("");
  const g = livro.grupo;
  return (
    <li className="cu-item">
      <strong className="cu-item-titulo">{livro.titulo}</strong>
      {livro.autoria && <p className="cu-miudo">{preencher(t.leitura.de, { autoria: livro.autoria })}</p>}

      {g.leitoras !== null && g.media !== null ? (
        <div className="cu-bloco">
          <div className="cu-barra" aria-hidden><span style={{ width: `${g.media}%` }} /></div>
          <p className="cu-miudo">
            {preencher(t.leitura.grupo, { leitoras: g.leitoras, media: g.media })}
            {g.terminaram !== null ? ` ${preencher(t.leitura.terminaram, { n: g.terminaram })}` : ""}
          </p>
        </div>
      ) : (
        <p className="cu-miudo">{t.leitura.grupoPouco}</p>
      )}

      {posso && (
        <div className="cu-acoes">
          <label className="cu-campo">
            <span>{t.leitura.meuProgresso}</span>
            <select
              className="al2-campo"
              value={livro.eu === null ? "" : String(livro.eu)}
              disabled={acao.ocupado}
              onChange={(e) => {
                const v = e.target.value;
                void acao.fazer(async () => (await cultura.progresso(livro.id, v === "" ? null : Number(v)), null));
              }}
            >
              <option value="">{t.leitura.semProgresso}</option>
              {DEGRAUS.map((d) => <option key={d} value={d}>{d}%</option>)}
            </select>
          </label>
        </div>
      )}

      <details className="cu-privacidade">
        <summary>{t.leitura.citacoes} ({livro.citacoes.length})</summary>
        {livro.citacoes.length === 0 ? (
          <p className="cu-miudo">{t.leitura.semCitacoes}</p>
        ) : (
          <ul className="cu-lista">
            {livro.citacoes.map((c) => (
              <li key={c.id} className="cu-bloco">
                <blockquote className="cu-citacao">{c.texto}</blockquote>
                {c.pagina && <p className="cu-miudo">{preencher(t.leitura.pagina, { pagina: c.pagina })}</p>}
                {(c.minha || modero) && (
                  <Botao
                    variante="fantasma"
                    tamanho="p"
                    disabled={acao.ocupado}
                    onClick={() =>
                      void acao.fazer(async () => {
                        if (!(await confirmar(t.leitura.perguntaTirarCitacao, { sim: t.leitura.tirarCitacao }))) return null;
                        await cultura.tirarCitacao(c.id);
                        return null;
                      })
                    }
                  >
                    {t.leitura.tirarCitacao}
                  </Botao>
                )}
              </li>
            ))}
          </ul>
        )}
        {posso && (
          <form
            className="cu-bloco"
            aria-label={t.leitura.citar.citar}
            onSubmit={(e) => {
              e.preventDefault();
              void acao.fazer(async () => {
                await cultura.citar(livro.id, texto.trim(), pagina.trim());
                setTexto("");
                setPagina("");
                return t.leitura.citar.feita;
              });
            }}
          >
            <label className="cu-campo">
              <span>{t.leitura.citar.texto}</span>
              <textarea id={`${campo}-citacao`} className="al2-campo" value={texto} onChange={(e) => setTexto(e.target.value)} minLength={3} maxLength={500} rows={2} required />
            </label>
            <label className="cu-campo">
              <span>{t.leitura.citar.pagina}</span>
              <input className="al2-campo" value={pagina} onChange={(e) => setPagina(e.target.value)} maxLength={20} />
            </label>
            <Botao type="submit" variante="contorno" disabled={acao.ocupado}>{t.leitura.citar.citar}</Botao>
          </form>
        )}
      </details>

      {(modero || livro.meu) && (
        <div className="cu-acoes">
          {modero && (
            <label className="cu-campo">
              <span>{t.leitura.situacao}</span>
              <select
                className="al2-campo"
                value={livro.situacao}
                disabled={acao.ocupado}
                onChange={(e) => {
                  const s = e.target.value as SituacaoDoLivro;
                  void acao.fazer(async () => (await cultura.situacao(livro.id, s), null));
                }}
              >
                {SITUACOES_DO_LIVRO.map((s) => <option key={s} value={s}>{t.situacoes[s]}</option>)}
              </select>
            </label>
          )}
          <Botao
            variante="fantasma"
            tamanho="p"
            disabled={acao.ocupado}
            onClick={() =>
              void acao.fazer(async () => {
                if (!(await confirmar(t.leitura.perguntaTirar, { perigo: true, sim: t.leitura.tirar }))) return null;
                await cultura.tirarLivro(livro.id);
                return t.leitura.tirado;
              })
            }
          >
            {t.leitura.tirar}
          </Botao>
        </div>
      )}
    </li>
  );
}

export default function Leitura({ t, comunidade }: PropsDaParte) {
  const campo = useId();
  const slug = comunidade ?? "";
  const leitura = useLeitura(slug ? `estante:${slug}` : null, () => cultura.estante(slug));
  const acao = useAcao(t, leitura.recarregar);
  const [titulo, setTitulo] = useState("");
  const [autoria, setAutoria] = useState("");
  const e = leitura.dado;

  if (leitura.erro) {
    return (
      <EstadoDaAlumia erro texto={fraseDoErro(t, leitura.erro)}>
        <Botao variante="contorno" onClick={leitura.recarregar}>{t.tentar}</Botao>
      </EstadoDaAlumia>
    );
  }
  if (!e) return <p role="status" className="cu-miudo">{t.carregando}</p>;

  return (
    <div className="cu-colunas">
      <div className="cu-bloco">
        <h2 className="cu-subtitulo al-cond">{t.leitura.titulo}</h2>
        <p className="cu-miudo">{t.leitura.ajuda}</p>
        {!e.posso && <p className="cu-miudo" role="note">{t.comunidade.soLer}</p>}
        <Mensagem mensagem={acao.mensagem} />
        {e.livros.length === 0 ? (
          <p className="cu-miudo">{t.leitura.vazia}</p>
        ) : (
          SITUACOES_DO_LIVRO.map((s) => {
            const daqui = e.livros.filter((l) => l.situacao === s);
            if (!daqui.length) return null;
            return (
              <section key={s} className="cu-bloco" aria-labelledby={`${campo}-${s}`}>
                <h3 id={`${campo}-${s}`} className="cu-form-titulo">{t.situacoes[s]}</h3>
                <ul className="cu-lista">
                  {daqui.map((l) => <CartaoDoLivro key={l.id} t={t} livro={l} modero={e.modero} posso={e.posso} acao={acao} />)}
                </ul>
              </section>
            );
          })
        )}
      </div>

      {e.posso && (
        <form
          className="cu-form cu-lado"
          aria-labelledby={`${campo}-novo`}
          onSubmit={(ev) => {
            ev.preventDefault();
            void acao.fazer(async () => {
              await cultura.porLivro(slug, titulo.trim(), autoria.trim());
              setTitulo("");
              setAutoria("");
              return t.leitura.novo.feito;
            });
          }}
        >
          <h3 id={`${campo}-novo`} className="cu-form-titulo">{t.leitura.novo.titulo}</h3>
          <label className="cu-campo">
            <span>{t.leitura.novo.nome}</span>
            <input className="al2-campo" value={titulo} onChange={(ev) => setTitulo(ev.target.value)} maxLength={160} required />
          </label>
          <label className="cu-campo">
            <span>{t.leitura.novo.autoria}</span>
            <input className="al2-campo" value={autoria} onChange={(ev) => setAutoria(ev.target.value)} maxLength={120} />
          </label>
          <Botao type="submit" disabled={acao.ocupado}>{t.leitura.novo.por}</Botao>
        </form>
      )}
    </div>
  );
}
