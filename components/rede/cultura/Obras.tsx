// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Item 38: a obra seriada (conto, cordel, poesia, HQ). Cada capítulo é um post da autora que já saiu: a tela liga o post à obra
// pelo endereço dele. Quem segue a obra recebe um aviso de capítulo novo (o banco manda, sem o texto do post). A autora vê só
// quantas pessoas seguem, e só a partir de 3; quem são, ninguém vê.
import { useId, useState } from "react";
import Link from "@/components/Link";
import { confirmar } from "@/components/perguntar";
import { cultura, type Obra } from "@/lib/rede/cultura/cliente";
import { GENEROS, postDoEndereco, type Genero } from "@/lib/rede/cultura/regras";
import { preencher } from "@/lib/rede/preencher";
import { enderecos } from "@/lib/rede/tipos";
import { Botao } from "../ui/Botao";
import { EstadoDaAlumia } from "../ui/Estado";
import { Mensagem, fraseDoErro, useAcao, useLeitura, type PropsDaParte, type T } from "./comum";

type Filtro = "todas" | "seguindo" | "minhas";
const FILTROS: readonly Filtro[] = ["todas", "seguindo", "minhas"];

/** A obra aberta: capítulos que quem olha pode ver, seguir, e (para a autora) ligar e tirar capítulos. */
function ObraAberta({ t, lang, id, aoVoltar }: { t: T; lang: string; id: string; aoVoltar: () => void }) {
  const campo = useId();
  const leitura = useLeitura(id, () => cultura.obra(id));
  const acao = useAcao(t, leitura.recarregar);
  const [endereco, setEndereco] = useState("");
  const [nome, setNome] = useState("");
  const o = leitura.dado;

  if (leitura.erro) {
    return (
      <EstadoDaAlumia erro texto={fraseDoErro(t, leitura.erro)}>
        <Botao variante="contorno" onClick={aoVoltar}>{t.obras.voltar}</Botao>
      </EstadoDaAlumia>
    );
  }
  if (!o) return <p role="status" className="cu-miudo">{t.carregando}</p>;

  const ligar = () => {
    const post = postDoEndereco(endereco);
    if (!post) return acao.avisar(t.obras.ligar.enderecoRuim);
    void acao.fazer(async () => {
      await cultura.capitulo(o.id, post, nome.trim());
      setEndereco("");
      setNome("");
      return t.obras.ligar.feito;
    });
  };

  return (
    <div className="cu-bloco">
      <Botao variante="fantasma" tamanho="p" onClick={aoVoltar}>← {t.obras.voltar}</Botao>
      <div className="cu-obra-cabeca">
        <p className="cu-etiqueta al-cond">{t.generos[o.genero]}</p>
        <h2 className="cu-subtitulo al-cond">{o.titulo}</h2>
        <p className="cu-miudo">{preencher(t.obras.por, { autor: o.autor })}</p>
        {o.sinopse && <p className="cu-texto">{o.sinopse}</p>}
      </div>

      {o.minha ? (
        <p className="cu-miudo" role="note">{typeof o.seguidores === "number" ? preencher(t.obras.seguidores, { n: o.seguidores }) : t.obras.poucosSeguidores}</p>
      ) : (
        <div className="cu-acoes">
          <Botao
            variante="contorno"
            pressionado={o.sigo}
            disabled={acao.ocupado}
            onClick={() => void acao.fazer(async () => (await cultura.seguir(o.id, !o.sigo), null))}
          >
            {o.sigo ? t.obras.deixarDeSeguir : t.obras.seguir}
          </Botao>
          <p className="cu-miudo">{t.obras.seguirAjuda}</p>
        </div>
      )}
      <Mensagem mensagem={acao.mensagem} />

      {(o.lista ?? []).length === 0 ? (
        <p className="cu-miudo">{t.obras.semCapitulos}</p>
      ) : (
        <ol className="cu-lista cu-capitulos">
          {(o.lista ?? []).map((c) => (
            <li key={c.numero} className="cu-item">
              <p className="cu-etiqueta al-cond">{preencher(t.obras.capitulo, { n: c.numero })}</p>
              {c.titulo && <strong>{c.titulo}</strong>}
              <div className="cu-acoes">
                <Link className="al-botao al-botao-contorno al-botao-p" href={enderecos.post(lang, c.post)}>{preencher(t.obras.lerCapitulo, { n: c.numero })}</Link>
                {o.minha && (
                  <Botao
                    variante="fantasma"
                    tamanho="p"
                    disabled={acao.ocupado}
                    onClick={() =>
                      void acao.fazer(async () => {
                        if (!(await confirmar(t.obras.perguntaTirarCapitulo, { sim: t.obras.tirarCapitulo }))) return null;
                        await cultura.tirarCapitulo(o.id, c.numero);
                        return null;
                      })
                    }
                  >
                    {t.obras.tirarCapitulo}
                  </Botao>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {o.minha && (
        <>
          <form
            className="cu-form"
            aria-labelledby={`${campo}-ligar`}
            onSubmit={(e) => {
              e.preventDefault();
              ligar();
            }}
          >
            <h3 id={`${campo}-ligar`} className="cu-form-titulo">{t.obras.ligar.titulo}</h3>
            <p className="cu-miudo">{t.obras.ligar.ajuda}</p>
            <label className="cu-campo">
              <span>{t.obras.ligar.endereco}</span>
              <input className="al2-campo" value={endereco} onChange={(e) => setEndereco(e.target.value)} inputMode="url" autoComplete="off" maxLength={300} required />
            </label>
            <label className="cu-campo">
              <span>{t.obras.ligar.nome}</span>
              <input className="al2-campo" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
            </label>
            <Botao type="submit" disabled={acao.ocupado}>{t.obras.ligar.ligar}</Botao>
          </form>
          <Botao
            variante="fantasma"
            disabled={acao.ocupado}
            onClick={() =>
              void acao.fazer(async () => {
                if (!(await confirmar(t.obras.perguntaApagar, { perigo: true, sim: t.obras.apagar }))) return null;
                await cultura.apagarObra(o.id);
                aoVoltar();
                return null;
              })
            }
          >
            {t.obras.apagar}
          </Botao>
        </>
      )}
    </div>
  );
}

export default function Obras({ t, lang }: PropsDaParte) {
  const campo = useId();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [genero, setGenero] = useState<Genero | "">("");
  const [aberta, setAberta] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [novoGenero, setNovoGenero] = useState<Genero>("conto");
  const [sinopse, setSinopse] = useState("");
  const leitura = useLeitura(aberta ? null : `${filtro}:${genero}`, () => cultura.obras(filtro, genero || null));
  const acao = useAcao(t, leitura.recarregar);

  if (aberta) return <ObraAberta t={t} lang={lang} id={aberta} aoVoltar={() => setAberta(null)} />;

  const itens: Obra[] = leitura.dado?.itens ?? [];

  return (
    <div className="cu-colunas">
      <div className="cu-bloco">
        <h2 className="cu-subtitulo al-cond">{t.obras.titulo}</h2>
        <p className="cu-miudo">{t.obras.ajuda}</p>
        <div className="cu-filtros">
          <div className="cu-acoes" role="group" aria-label={t.obras.filtro}>
            {FILTROS.map((f) => (
              <Botao key={f} variante="contorno" tamanho="p" pressionado={filtro === f} onClick={() => setFiltro(f)}>{t.obras.filtros[f]}</Botao>
            ))}
          </div>
          <label className="cu-campo">
            <span>{t.obras.genero}</span>
            <select className="al2-campo" value={genero} onChange={(e) => setGenero(e.target.value as Genero | "")}>
              <option value="">{t.obras.todosGeneros}</option>
              {GENEROS.map((g) => <option key={g} value={g}>{t.generos[g]}</option>)}
            </select>
          </label>
        </div>
        {leitura.erro ? (
          <EstadoDaAlumia erro texto={fraseDoErro(t, leitura.erro)}>
            <Botao variante="contorno" onClick={leitura.recarregar}>{t.tentar}</Botao>
          </EstadoDaAlumia>
        ) : !leitura.dado ? (
          <p role="status" className="cu-miudo">{t.carregando}</p>
        ) : itens.length === 0 ? (
          <p className="cu-miudo">{t.obras.vazia}</p>
        ) : (
          <ul className="cu-lista">
            {itens.map((o) => (
              <li key={o.id} className="cu-item">
                <p className="cu-etiqueta al-cond">{t.generos[o.genero]}</p>
                <strong className="cu-item-titulo">{o.titulo}</strong>
                <p className="cu-miudo">{preencher(t.obras.por, { autor: o.autor })} · {preencher(t.obras.capitulos, { n: o.capitulos })}</p>
                <div className="cu-acoes">
                  <Botao variante="contorno" tamanho="p" onClick={() => setAberta(o.id)} aria-label={`${t.obras.abrir}: ${o.titulo}`}>{t.obras.abrir}</Botao>
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
          void acao.fazer(async () => {
            const o = await cultura.criarObra(titulo.trim(), novoGenero, sinopse.trim());
            setTitulo("");
            setSinopse("");
            setAberta(o.id);
            return t.obras.nova.feita;
          });
        }}
      >
        <h3 id={`${campo}-nova`} className="cu-form-titulo">{t.obras.nova.titulo}</h3>
        <label className="cu-campo">
          <span>{t.obras.nova.nome}</span>
          <input className="al2-campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} minLength={2} maxLength={120} required />
        </label>
        <label className="cu-campo">
          <span>{t.obras.genero}</span>
          <select className="al2-campo" value={novoGenero} onChange={(e) => setNovoGenero(e.target.value as Genero)}>
            {GENEROS.map((g) => <option key={g} value={g}>{t.generos[g]}</option>)}
          </select>
        </label>
        <label className="cu-campo">
          <span>{t.obras.nova.sinopse}</span>
          <textarea className="al2-campo" value={sinopse} onChange={(e) => setSinopse(e.target.value)} maxLength={500} rows={3} />
        </label>
        <Botao type="submit" disabled={acao.ocupado}>{t.obras.nova.criar}</Botao>
        <Mensagem mensagem={acao.mensagem} />
      </form>
    </div>
  );
}
