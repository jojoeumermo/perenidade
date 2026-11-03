// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { ConviteDeMatricula, SeloDoAparelho } from "@/components/escola/formatura/ConviteDeMatricula";
import { copiarTexto } from "@/components/escola/formatura/usar-formatura";
import { useInscricoes, useMatricula } from "@/components/escola/guardado-escola";
import Link from "@/components/Link";
import type { TextosDaFormatura } from "@/i18n/escola/formatura";
import {
  anuncioDoMural,
  apagarRascunhoDoMural,
  cursoPodeAnunciar,
  gravarRascunhoDoMural,
  lerRascunhoDoMural,
  MAX_DESCRICAO_DA_PESSOA,
  MAX_OFICIO,
} from "@/lib/escola/formatura";

/**
 * O texto do anúncio no Mural dos Trabalhadores, só para cursos profissionais liberados. A pessoa copia e envia pelo
 * formulário do Mural, que tem moderação. Contato, cidade e telefone NÃO são guardados nem preenchidos aqui: ela digita
 * só no formulário do Mural. O rascunho (curso, ofício, descrição) fica numa chave privada do aparelho.
 */
export function AnuncioDoMural({ s, c, cursos, muralHref, base }: { s: TextosDaFormatura["mural"]; c: TextosDaFormatura["comum"]; cursos: { slug: string; titulo: string }[]; muralHref: string; base: string }) {
  const matricula = useMatricula();
  const inscricoes = useInscricoes();
  const [escolhido, setEscolhido] = useState("");
  const [oficio, setOficio] = useState("");
  const [descricao, setDescricao] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);
  // O rascunho entra depois da hidratação, para o HTML ser igual no servidor e no navegador.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const r = lerRascunhoDoMural();
      if (r) {
        setEscolhido(r.curso);
        setOficio(r.oficio);
        setDescricao(r.descricao);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  if (!matricula) return <ConviteDeMatricula c={c} base={base} />;

  const meus = inscricoes.flatMap((i) => cursos.filter((x) => x.slug === i.curso));
  if (meus.length === 0) {
    return (
      <div className="formatura-cartao" data-sem-curso="">
        <p>{s.semCurso}</p>
        <p>
          <Link href={`${base}/cursos`} className="formatura-botao">
            {s.verCursos}
          </Link>
        </p>
      </div>
    );
  }
  const curso = meus.find((x) => x.slug === escolhido) ?? meus[0];
  const pode = cursoPodeAnunciar(curso.slug);
  const anuncio = pode && oficio.trim() ? anuncioDoMural({ curso: curso.slug, tituloDoCurso: curso.titulo, oficio, descricaoDaPessoa: descricao }) : null;

  const guardar = (novo: { curso?: string; oficio?: string; descricao?: string }) => {
    const proximo = { curso: novo.curso ?? curso.slug, oficio: novo.oficio ?? oficio, descricao: novo.descricao ?? descricao };
    if (!proximo.oficio && !proximo.descricao) apagarRascunhoDoMural();
    else gravarRascunhoDoMural(proximo);
  };
  const copiar = async (que: string, texto: string) => setCopiado((await copiarTexto(texto)) ? que : "falhou");

  return (
    <div className="formatura-pilha" data-anuncio-do-mural="">
      <SeloDoAparelho texto={c.noAparelho} />
      <p className="formatura-aviso">
        {s.avisoIdade} {c.revisar}
      </p>
      {meus.length > 1 ? (
        <label className="formatura-campo-em-linha">
          <span>{s.escolhaOCurso}</span>
          <select
            value={curso.slug}
            onChange={(e) => {
              setEscolhido(e.target.value);
              guardar({ curso: e.target.value });
            }}
          >
            {meus.map((x) => (
              <option key={x.slug} value={x.slug}>
                {x.titulo}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <h2 className="formatura-h2">{curso.titulo}</h2>
      )}

      {!pode ? (
        <div className="formatura-cartao" role="note" data-sem-anuncio="">
          <p>{s.semAnuncio}</p>
          <p className="formatura-fraco">{c.revisar}</p>
        </div>
      ) : (
        <form className="formatura-cartao formatura-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            <span>{s.oficio}</span>
            <input
              type="text"
              value={oficio}
              maxLength={MAX_OFICIO}
              onChange={(e) => {
                setOficio(e.target.value);
                guardar({ oficio: e.target.value });
              }}
            />
          </label>
          <label>
            <span>{s.descricao}</span>
            <textarea
              rows={5}
              value={descricao}
              maxLength={MAX_DESCRICAO_DA_PESSOA}
              onChange={(e) => {
                setDescricao(e.target.value);
                guardar({ descricao: e.target.value });
              }}
            />
          </label>
          <p className="formatura-fraco">{s.semContato}</p>
        </form>
      )}

      {anuncio && !anuncio.ok ? (
        <p role="alert" className="formatura-erro">
          {anuncio.motivo === "contato" ? s.erroContato : s.erroOficio}
        </p>
      ) : null}
      {anuncio?.ok ? (
        <section className="formatura-cartao" aria-labelledby="mural-texto" data-anuncio-pronto="">
          <h3 id="mural-texto" className="formatura-h3">
            {s.textoPronto}
          </h3>
          <p className="formatura-fraco">
            {s.categoria}: {s.categorias[anuncio.categoria as keyof typeof s.categorias] ?? anuncio.categoria}
          </p>
          <p className="formatura-fraco">{s.campoTitulo}</p>
          <pre className="formatura-bloco">{anuncio.titulo}</pre>
          <p className="formatura-fraco">{s.campoDescricao}</p>
          <pre className="formatura-bloco">{anuncio.descricao}</pre>
          <div className="formatura-barra">
            <button type="button" className="formatura-botao-fraco" onClick={() => copiar("titulo", anuncio.titulo ?? "")}>
              {s.copiarTitulo}
            </button>
            <button type="button" className="formatura-botao" onClick={() => copiar("descricao", anuncio.descricao ?? "")}>
              {s.copiarDescricao}
            </button>
            <Link href={muralHref} className="formatura-link">
              {s.abrirMural}
            </Link>
          </div>
          {copiado ? (
            <p role="status" className="formatura-fraco">
              {copiado === "falhou" ? s.naoCopiou : s.copiado}
            </p>
          ) : null}
          <p className="formatura-fraco">{s.moderacao}</p>
        </section>
      ) : null}
    </div>
  );
}
