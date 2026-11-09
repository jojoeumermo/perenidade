// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRef, useState } from "react";
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaBiblioteca } from "@/i18n/escola/biblioteca";
import { preencher } from "@/lib/escola/textos";
import { useEuDaEscola } from "../casca/Casca";
import { chamarDaEscola } from "./chamar";
import { avisoDoLevar, contextoDaDuvida, TEXTO_MAX, textoParaLevar } from "./duvida";

/** ?aula= e ?de= do endereço. A tela só monta no navegador (dentro da casca, depois de escola_eu), então lê direto. */
function lerContexto() {
  return contextoDaDuvida(typeof window === "undefined" ? "" : window.location.search);
}

/**
 * Tirar uma dúvida (prancha Cel-Dúvida): escolher com quem falar. Na ordem da prancha: o Assistente da Escola (o
 * acompanhante de /escola/acompanhante), quem acompanha você (pelo codinome da Alumia, com a conversa na Alumia pelo @) e
 * "Levar para o núcleo", que põe a dúvida escrita na pauta da próxima roda SEM o nome de quem perguntou
 * (public.escola_levar_ao_nucleo, F4, chamada pelo contrato). Sem a função no banco, a tela diz com honestidade que a
 * pauta ainda não recebe dúvidas por aqui. O texto da dúvida não fica guardado no aparelho.
 */
export function EscolherComQuem({ lang, t }: { lang: Locale; t: TextosDaBiblioteca["duvida"] }) {
  const eu = useEuDaEscola();
  const [contexto] = useState(lerContexto);
  const [texto, setTexto] = useState("");
  const [levando, setLevando] = useState(false);
  const [aviso, setAviso] = useState("");
  const campo = useRef<HTMLTextAreaElement>(null);
  const quem = eu.acompanha;
  const nomeDeQuem = quem?.codinome ?? t.acompanha.alguem;

  async function levar() {
    if (levando) return;
    if (!texto.trim()) {
      setAviso(t.precisaTexto);
      campo.current?.focus();
      return;
    }
    const pronto = textoParaLevar(texto);
    if (!pronto) {
      setAviso(t.tamanho);
      campo.current?.focus();
      return;
    }
    setLevando(true);
    setAviso(t.levando);
    const r = await chamarDaEscola("escola_levar_ao_nucleo", { p_texto: pronto });
    setLevando(false);
    if (r.ok) {
      setTexto("");
      setAviso(t.levada);
      return;
    }
    const chave = avisoDoLevar(r.codigo);
    setAviso(chave === "semNucleo" ? t.nucleo.semNucleo : t[chave]);
  }

  return (
    <div className="ef6-duvida-fundo" data-escola-escura="" data-tela-da-escola="duvida">
      <section aria-labelledby="ef6-duvida-titulo" className="ef6-folha">
        <span aria-hidden className="ef6-folha-alca" />
        <h1 id="ef6-duvida-titulo" className="ef-t">
          {t.titulo}
        </h1>
        <p className="ef6-folha-sobre">
          {contexto.aula ? preencher(t.sobreAula, { codigo: contexto.aula }) : t.semAula}
          {contexto.de && (
            <>
              {" "}
              <Link href={localePath(lang, contexto.de)}>{t.voltar}</Link>
            </>
          )}
        </p>

        <ul className="ef6-opcoes">
          <li>
            <Link href={localePath(lang, "/escola/acompanhante")} className="ef6-opcao ef6-opcao-escura">
              <span aria-hidden className="ef-t ef6-letra" style={{ background: "#F2C94C" }}>
                A
              </span>
              <span>
                <strong>{t.assistente.titulo}</strong>
                <span className="ef6-opcao-texto">{t.assistente.texto}</span>
              </span>
            </Link>
          </li>
          <li>
            {quem?.handle ? (
              <Link href={localePath(lang, `/alumia/conversas?com=${encodeURIComponent(quem.handle)}`)} className="ef6-opcao">
                <LetraDe nome={quem.codinome} fundo="#E63B2A" reserva="?" />
                <span>
                  <strong>{t.acompanha.titulo}</strong>
                  <span className="ef6-opcao-texto">{preencher(t.acompanha.texto, { nome: nomeDeQuem })}</span>
                </span>
              </Link>
            ) : (
              <div className="ef6-opcao" data-parada="">
                <LetraDe nome={quem?.codinome ?? null} fundo="#E63B2A" reserva="?" />
                <span>
                  <strong>{t.acompanha.titulo}</strong>
                  <span className="ef6-opcao-texto">{quem ? preencher(t.acompanha.semConversa, { nome: nomeDeQuem }) : t.acompanha.ninguem}</span>
                </span>
              </div>
            )}
          </li>
          <li>
            {eu.nucleo ? (
              <button type="button" className="ef6-opcao" onClick={levar} disabled={levando} aria-busy={levando} aria-describedby="ef6-duvida-dica">
                <span aria-hidden className="ef-t ef6-letra" style={{ background: "#E8604C" }}>
                  N
                </span>
                <span>
                  <strong>{t.nucleo.titulo}</strong>
                  <span className="ef6-opcao-texto">{t.nucleo.texto}</span>
                </span>
              </button>
            ) : (
              <div className="ef6-opcao" data-parada="">
                <span aria-hidden className="ef-t ef6-letra" style={{ background: "#E8604C" }}>
                  N
                </span>
                <span>
                  <strong>{t.nucleo.titulo}</strong>
                  <span className="ef6-opcao-texto">{t.nucleo.semNucleo}</span>
                </span>
              </div>
            )}
          </li>
        </ul>

        {/* O campo só serve para levar ao núcleo: sem núcleo, nada o enviaria (o cartão acima já diz t.nucleo.semNucleo). */}
        {eu.nucleo && (
          <>
            <label htmlFor="ef6-duvida-texto">{t.escreva}</label>
            <textarea
              id="ef6-duvida-texto"
              ref={campo}
              rows={3}
              maxLength={TEXTO_MAX}
              placeholder={t.exemplo}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              aria-describedby="ef6-duvida-dica"
            />
            <p id="ef6-duvida-dica" className="ef6-folha-dica">
              {t.escrevaDica}
            </p>
          </>
        )}
        <p className="ef6-folha-status" role="status" aria-live="polite">
          {aviso}
        </p>
      </section>
    </div>
  );
}

/** A letra do quadradinho (a inicial do codinome, como o "J" da prancha). Só enfeite: o nome está no texto. */
function LetraDe({ nome, fundo, reserva }: { nome: string | null; fundo: string; reserva: string }) {
  const letra = nome?.trim().charAt(0).toLocaleUpperCase() || reserva;
  return (
    <span aria-hidden className="ef-t ef6-letra" style={{ background: fundo }}>
      {letra}
    </span>
  );
}
