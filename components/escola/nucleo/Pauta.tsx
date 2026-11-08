// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useState } from "react";
import type { TextosDaTelaDoNucleo } from "@/i18n/escola/nucleo";
import type { PerguntaDaSemana } from "@/lib/escola/contratos";
import { chamarDoNucleo, type NucleoCompleto, type Resposta } from "@/lib/escola/nucleo";
import { preencher } from "@/lib/escola/textos";
import { Presenca } from "./Presenca";
import { PreparaEncontro } from "./PreparaEncontro";
import { QuemFazOQue } from "./QuemFazOQue";

type T = TextosDaTelaDoNucleo;

const LOCALES: Record<string, string> = { pt: "pt-BR", en: "en-GB", es: "es", fr: "fr-FR", ru: "ru-RU", zh: "zh-CN" };
/** "segunda" (o dia da semana do encontro, no horário de Brasília; sem o "-feira" no português, como na prancha). */
export function diaDaSemana(lang: string, iso: string): string {
  const dia = new Intl.DateTimeFormat(LOCALES[lang] ?? "pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
  return lang === "pt" ? dia.replace(/-feira/g, "") : dia;
}

/**
 * "Levar para o núcleo" (e a resposta à pergunta geradora): o texto vira item da pauta do próximo encontro, SEM o nome
 * de quem levou (escola_levar_ao_nucleo). Nada fica no aparelho.
 */
export function LevarAoNucleo({ t, rotulo, enviar, depois, id }: { t: T; rotulo: string; enviar: string; depois: () => void; id: string }) {
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function mandar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    const r: Resposta<unknown> = await chamarDoNucleo("escola_levar_ao_nucleo", { p_texto: texto });
    setOcupado(false);
    if (!r.ok) return setAviso(t.erros[r.motivo]);
    setTexto("");
    setAviso(t.levar.ok);
    depois();
  }
  return (
    <form onSubmit={mandar} className="en-form">
      <label htmlFor={id} className="en-rotulo">
        {rotulo}
      </label>
      <textarea id={id} className="en-campo" rows={2} minLength={3} maxLength={200} required value={texto} onChange={(e) => setTexto(e.target.value)} />
      <div className="en-acoes">
        <button type="submit" className="ef-botao-vazado" disabled={ocupado || texto.trim().length < 3}>
          {enviar}
        </button>
      </div>
      <p role="status" className="en-aviso">
        {aviso}
      </p>
    </form>
  );
}

/**
 * A aba Pauta (prancha Cel-Núcleo, na ordem): "Pauta de segunda" numerada, "Quem faz o quê" com o "Eu levo", a presença
 * das últimas rodas (só números). Depois: a roda que passou, a pergunta geradora da semana (Paulo Freire; a tela Hoje
 * leva para cá com #pergunta), "Levar para o núcleo" e, só para a mediação, preparar o encontro.
 */
export function Pauta({ lang, dados, pergunta, t, ocupado, pegar, depois }: { lang: string; dados: NucleoCompleto; pergunta: PerguntaDaSemana | null; t: T; ocupado: boolean; pegar: (id: string, pegar: boolean) => void; depois: () => void }) {
  const id = useId();
  const p = dados.proximo;
  return (
    <>
      <section aria-labelledby={`${id}-pauta`} className="en-bloco">
        <h2 id={`${id}-pauta`} className="ef-t en-h2">
          {p ? preencher(t.pauta.titulo, { dia: diaDaSemana(lang, p.quando) }) : t.pauta.tituloSemDia}
        </h2>
        {!p ? (
          <p className="en-vazio">{t.tela.semEncontro}</p>
        ) : p.pauta.length === 0 ? (
          <p className="en-vazio">{t.pauta.vazia}</p>
        ) : (
          <ol className="en-pauta">
            {p.pauta.map((item, i) => (
              <li key={i}>
                <span data-original="">{item.texto}</span>
                {item.levado && <span className="en-levado"> ({t.pauta.levado})</span>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {p && (
        <section aria-labelledby={`${id}-quem`} className="en-bloco">
          <h2 id={`${id}-quem`} className="ef-t en-h2">
            {t.pauta.quemFaz}
          </h2>
          <QuemFazOQue tarefas={p.tarefas} t={t.pauta} ocupado={ocupado} pegar={pegar} />
        </section>
      )}

      <Presenca lista={dados.presenca} t={t.pauta} />

      {dados.anterior && (
        <section aria-labelledby={`${id}-anterior`} className="en-bloco en-anterior">
          <h2 id={`${id}-anterior`} className="ef-t en-h3">
            {t.pauta.anterior}
          </h2>
          <p data-original="">{dados.anterior.balanco || t.pauta.anteriorSemBalanco}</p>
        </section>
      )}

      <section id="pergunta" aria-labelledby={`${id}-pergunta`} className="en-bloco en-pergunta">
        <h2 id={`${id}-pergunta`} className="ef-t en-h3">
          {t.pergunta.titulo}
        </h2>
        {pergunta?.texto ? <p className="ef-t en-pergunta-texto">{pergunta.texto}</p> : <p className="en-vazio">{t.pergunta.vazia}</p>}
        <p className="en-nota">{t.pergunta.texto}</p>
        {pergunta?.texto && p && <LevarAoNucleo t={t} id={`${id}-resposta`} rotulo={t.pergunta.rotulo} enviar={t.pergunta.enviar} depois={depois} />}
      </section>

      {p && (
        <section aria-labelledby={`${id}-levar`} className="en-bloco">
          <h2 id={`${id}-levar`} className="ef-t en-h3">
            {t.levar.titulo}
          </h2>
          <p className="en-nota">{t.levar.texto}</p>
          <LevarAoNucleo t={t} id={`${id}-levar-texto`} rotulo={t.levar.rotulo} enviar={t.levar.enviar} depois={depois} />
        </section>
      )}

      {dados.medeia && <PreparaEncontro key={p?.id ?? "novo"} lang={lang} dados={dados} t={t} depois={depois} />}
    </>
  );
}
