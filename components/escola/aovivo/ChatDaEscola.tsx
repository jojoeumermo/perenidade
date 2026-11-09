// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/Link";
import { htmlLang, localePath, type Locale } from "@/i18n/config";
import type { TextosDoAoVivo } from "@/i18n/escola/aovivo";
import { BackendError } from "@/lib/backend";
import { type AulaDaEscolaNaSala, enviarFala, type FalaDaEscola, lerFalas, moderarFala } from "@/lib/escola/aovivo";
import { temTempoReal, transmitir, useSinal } from "@/lib/tempo-real";

/**
 * O bate-papo da aula da Escola: só militante lê e escreve (o banco confere em cada chamada), cada um pelo codinome da
 * Alumia. Quem conduz (e a coordenação) esconde, mostra e libera o que ficou esperando; quem escreveu só esconde a
 * própria fala. Lê pela consulta curta de sempre (aula_chat_listar com "depois"), a cada 10 s com o canal de tempo real e
 * a cada 3 s sem ele; o canal só leva o aviso "mudou", sem o id da aula e sem texto nenhum (lib/tempo-real.ts).
 */
export function ChatDaEscola({ aula, lang, t, codinome }: { aula: AulaDaEscolaNaSala; lang: Locale; t: TextosDoAoVivo["chat"]; codinome: string | null }) {
  const [falas, setFalas] = useState<FalaDaEscola[]>([]);
  const [texto, setTexto] = useState("");
  const [pergunta, setPergunta] = useState(false);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  // O relógio da tela (o bate-papo abre meia hora antes): anda junto com a leitura das falas.
  const [agora, setAgora] = useState(() => Date.now());
  const ultima = useRef<string | null>(null);
  const lista = useRef<HTMLOListElement>(null);
  const hora = new Intl.DateTimeFormat(htmlLang[lang], { hour: "2-digit", minute: "2-digit" });

  const buscar = useCallback(
    async (tudo = false) => {
      try {
        const novas = await lerFalas(aula.id, tudo ? null : ultima.current);
        if (novas.length === 0 && !tudo) return;
        setFalas((antes) => {
          if (tudo) return novas.slice(-300);
          const vistas = new Set(antes.map((f) => f.id));
          return [...antes, ...novas.filter((f) => !vistas.has(f.id))].slice(-300);
        });
        if (novas.length) ultima.current = novas[novas.length - 1].criado_em;
      } catch {
        // a próxima rodada tenta de novo
      }
    },
    [aula.id],
  );

  useEffect(() => {
    void buscar(true);
    let voltas = 0;
    const relogio = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setAgora(Date.now());
      // Uma fala escondida ou liberada não muda o "depois": de tempos em tempos (a cada ~1 min) relê tudo, para a
      // moderação chegar mesmo quando o sinal de tempo real se perde ou não existe.
      voltas += 1;
      void buscar(voltas % (temTempoReal ? 6 : 20) === 0);
    }, temTempoReal ? 10_000 : 3000);
    return () => window.clearInterval(relogio);
  }, [buscar]);
  // Uma fala escondida ou liberada não muda o "depois" (a liberada tem criado_em antigo): com o sinal de moderação,
  // todo mundo relê a lista inteira; com fala nova, só quem conduz (vê também as que esperam).
  useSinal((sinal) => void buscar(aula.conduzo || sinal.tipo === "aula_chat_moderar"), ["aula_chat"]);
  useEffect(() => {
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [falas.length]);

  async function enviar() {
    const limpo = texto.trim();
    if (!limpo) return;
    setOcupado(true);
    setAviso("");
    try {
      const fala = await enviarFala(aula.id, limpo, pergunta ? "pergunta" : "fala");
      setTexto("");
      setPergunta(false);
      if (fala.oculta) setAviso(t.ficouEsperando);
      else transmitir("aula_chat_enviar");
      await buscar(true);
    } catch (erro) {
      const codigo = erro instanceof BackendError ? erro.code : "falha";
      setAviso(codigo === "conteudo_recusado" ? t.recusada : codigo === "muitos_pedidos" ? t.devagar : codigo === "confirme_codinome" ? t.semCodinome : codigo === "topico_trancado" ? t.fechado : t.erro);
    } finally {
      setOcupado(false);
    }
  }

  async function moderar(fala: FalaDaEscola, ocultar: boolean) {
    try {
      await moderarFala(fala.id, ocultar);
      transmitir("aula_chat_moderar");
      await buscar(true);
    } catch {
      setAviso(t.erro);
    }
  }

  const fechado = aula.status === "encerrada" || aula.status === "cancelada";
  const cedo = !aula.conduzo && aula.status === "agendada" && new Date(aula.inicio).getTime() - agora > 30 * 60_000;

  return (
    <section aria-labelledby="ea-chat-titulo" className="ea-chat">
      <div className="ea-chat-cabeca">
        <h2 id="ea-chat-titulo" className="ef-t">
          {t.titulo}
        </h2>
        <p>{t.sobre}</p>
      </div>
      <ol ref={lista} className="ea-falas" aria-live="polite" aria-relevant="additions">
        {falas.length === 0 && <li className="ea-fala-sistema">{t.vazio}</li>}
        {falas.map((fala) =>
          fala.tipo === "sistema" ? (
            <li key={fala.id} className="ea-fala-sistema">
              {fala.corpo}
            </li>
          ) : (
            <li key={fala.id} className="ea-fala" data-tipo={fala.tipo} data-minha={fala.minha ? "" : undefined} data-oculta={fala.oculta ? "" : undefined}>
              <p className="ea-fala-cabeca">
                <strong>{fala.nome || "—"}</strong>
                {fala.minha && <span>({t.voce})</span>}
                <time dateTime={fala.criado_em}>{hora.format(new Date(fala.criado_em))}</time>
                {fala.tipo === "pergunta" && <span className="ea-etiqueta ea-etiqueta-pergunta">{t.pergunta}</span>}
                {fala.esperando ? <span className="ea-etiqueta ea-etiqueta-espera">{t.esperando}</span> : fala.oculta && <span className="ea-etiqueta ea-etiqueta-espera">{t.escondida}</span>}
                {aula.conduzo ? (
                  <button type="button" className="ea-moderar" onClick={() => void moderar(fala, !fala.oculta)}>
                    {fala.esperando ? t.liberar : fala.oculta ? t.mostrar : t.esconder}
                  </button>
                ) : (
                  fala.minha &&
                  !fala.oculta && (
                    <button type="button" className="ea-moderar" onClick={() => void moderar(fala, true)}>
                      {t.esconder}
                    </button>
                  )
                )}
              </p>
              <p className="ea-fala-corpo">{fala.corpo}</p>
            </li>
          ),
        )}
      </ol>
      <div className="ea-chat-pe">
        {fechado ? (
          <p>{t.fechado}</p>
        ) : cedo ? (
          <p>{t.antesDeAbrir}</p>
        ) : !codinome ? (
          <>
            <p>{t.semCodinome}</p>
            <Link href={localePath(lang, "/alumia/editar-perfil")} className="ef-botao-vazado" style={{ marginTop: 10, minHeight: 42 }}>
              {t.irAlumia}
            </Link>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void enviar();
            }}
          >
            <div className="ea-escrever">
              <label htmlFor="ea-escrever" className="sr-only">
                {t.escrever}
              </label>
              <textarea
                id="ea-escrever"
                value={texto}
                rows={2}
                maxLength={500}
                placeholder={t.escrever}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void enviar();
                  }
                }}
              />
              <button type="submit" className="ef-botao-vermelho" disabled={ocupado || !texto.trim()}>
                {t.enviar}
              </button>
            </div>
            <label className="ea-marcar-pergunta">
              <input type="checkbox" checked={pergunta} onChange={(e) => setPergunta(e.target.checked)} /> {t.ehPergunta}
            </label>
          </form>
        )}
        {aviso && (
          <p role="status" className="ea-aviso">
            {aviso}
          </p>
        )}
      </div>
    </section>
  );
}
