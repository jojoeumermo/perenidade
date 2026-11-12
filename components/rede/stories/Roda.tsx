// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A roda de confiança (o "Close Friends" da Alumia): uma lista PESSOAL e PRIVADA de quem vê o story "Só para a roda". Não é
// "seguir um ao outro" (um infiltrado que segue de volta não entra); só a dona lê a lista, ninguém é avisado de entrar ou sair, e
// ninguém sabe em que rodas está (interno.rede_roda, LGPD art. 11: com quem a pessoa se organiza é dado sensível).
import { useEffect, useId, useState } from "react";
import type { ClienteDeStories } from "@/lib/rede/cliente-stories";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import type { PessoaDaRoda } from "@/lib/rede/tipos-stories";
import { handleOk } from "@/lib/rede/tipos";
import { Avatar16 } from "../ui/Avatar16";
import { noPlural, preencherStory } from "./usar";

type T = TextosDosStories["b1"]["roda"];

export function RodaDeConfianca({ t, lang, cliente, aoFechar, aoMudar }: { t: T; lang: string; cliente: ClienteDeStories; aoFechar: () => void; aoMudar?: (n: number) => void }) {
  const id = useId();
  const [lista, setLista] = useState<PessoaDaRoda[] | null>(null);
  const [campo, setCampo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    cliente
      .roda()
      .then((l) => vivo && (setLista(l), aoMudar?.(l.length)))
      .catch(() => vivo && setLista([]));
    return () => {
      vivo = false;
    };
    // aoMudar muda a cada render de quem chama; só a primeira leitura importa aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente]);

  useEffect(() => {
    const sair = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        aoFechar();
      }
    };
    window.addEventListener("keydown", sair, true);
    return () => window.removeEventListener("keydown", sair, true);
  }, [aoFechar]);

  async function mudar(handle: string, sim: boolean) {
    setOcupado(true);
    setErro("");
    try {
      const l = await cliente.mudarRoda(handle, sim);
      setLista(l);
      aoMudar?.(l.length);
      if (sim) setCampo("");
    } catch {
      setErro(t.naoAchada);
    } finally {
      setOcupado(false);
    }
  }

  const limpo = campo.trim().replace(/^@/, "").toLowerCase();
  return (
    <div className="al-st-roda" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={`${id}-a`}>
      <div className="al-st-roda-caixa">
        <div className="al-st-caixa-cabeca">
          <h2 id={`${id}-t`} className="al-cond">
            <span className="al-st-roda-selo" aria-hidden />
            {t.titulo}
          </h2>
          <button type="button" className="al-botao al-botao-fantasma al-botao-p" onClick={aoFechar}>
            {t.fechar}
          </button>
        </div>
        <p id={`${id}-a`} className="al-st-dica">
          {t.ajuda}
        </p>
        <form
          className="al-st-roda-por"
          onSubmit={(e) => {
            e.preventDefault();
            if (handleOk(limpo)) void mudar(limpo, true);
            else setErro(t.naoAchada);
          }}
        >
          <label htmlFor={`${id}-c`} className="sr-only">
            {t.campo}
          </label>
          <input
            id={`${id}-c`}
            value={campo}
            maxLength={21}
            placeholder={t.campo}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? `${id}-e` : undefined}
            onChange={(e) => setCampo(e.target.value.replace(/\s+/g, ""))}
          />
          <button type="submit" className="al-botao al-botao-primario al-botao-p" disabled={ocupado || !limpo}>
            {t.por}
          </button>
        </form>
        {erro ? (
          <p id={`${id}-e`} className="al-st-erro-criar" role="alert">
            {erro}
          </p>
        ) : null}
        <h3 className="al-st-roda-sub">
          {t.gerenciar}
          {lista ? <span> · {noPlural(lang, lista.length, t.contaN)}</span> : null}
        </h3>
        {lista === null ? null : lista.length === 0 ? (
          <p className="al-st-dica">{t.vazia}</p>
        ) : (
          <ul className="al-st-roda-lista">
            {lista.map((p) => (
              <li key={p.handle}>
                <Avatar16 handle={p.handle} cor={p.cor ?? undefined} tamanho={32} />
                <span>
                  <strong>{p.nome}</strong>
                  <small>@{p.handle}</small>
                </span>
                <button type="button" className="al-botao al-botao-fantasma al-botao-p" disabled={ocupado} aria-label={preencherStory(t.tirar, { nome: p.nome })} onClick={() => void mudar(p.handle, false)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
