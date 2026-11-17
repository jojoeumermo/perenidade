// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useState } from "react";
import { redePub } from "@/lib/rede/cliente-publicar";
import { preencher } from "@/lib/rede/preencher";
import { handleOk } from "@/lib/rede/tipos";
import type { PessoaDaMinhaRoda } from "@/lib/rede/tipos-publicar";
import { Avatar16 } from "../../ui/Avatar16";
import { Icone } from "../alumia2/icones";
import type { TextosDaVida } from "./textos";

/**
 * "Só a minha roda" no Escrever: quantas pessoas estão na roda e, aberto, a própria roda para pôr e tirar gente sem sair do post.
 * É a mesma lista do story "Só para a roda" (rede_roda): só a dona lê, ninguém é avisado de entrar ou sair. Na prévia, muda só
 * na tela.
 */
export function RodaNoEscrever({
  t,
  lista,
  previa,
  aoMudar,
}: {
  t: TextosDaVida;
  lista: PessoaDaMinhaRoda[] | null;
  previa: boolean;
  aoMudar: (lista: PessoaDaMinhaRoda[]) => void;
}) {
  const id = useId();
  const [aberta, setAberta] = useState(false);
  const [campo, setCampo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const n = lista?.length ?? 0;
  const limpo = campo.trim().replace(/^@/, "").toLowerCase();

  async function mudar(handle: string, sim: boolean) {
    setOcupado(true);
    setErro("");
    try {
      if (previa) {
        const atual = lista ?? [];
        aoMudar(sim ? (atual.some((p) => p.handle === handle) ? atual : [...atual, { handle, nome: handle, cor: ((atual.length % 5) + 1) as 1 | 2 | 3 | 4 | 5 }]) : atual.filter((p) => p.handle !== handle));
      } else {
        aoMudar(await redePub.mudarRoda(handle, sim));
      }
      if (sim) setCampo("");
    } catch {
      setErro(t.escrever.rodaNaoAchada);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-[var(--al-superficie-2)] bg-[var(--al-superficie)] p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Icone nome="roda" className="h-5 w-5 shrink-0 text-[var(--al-com-1)]" />
        <span className="min-w-0 flex-1 font-bold text-[var(--al-texto)]" role="status">
          {lista === null ? "…" : n === 0 ? t.escrever.rodaVazia : n === 1 ? t.escrever.rodaUma : preencher(t.escrever.rodaN, { n })}
        </span>
        <button type="button" className="al-botao al-botao-contorno al-botao-p" aria-expanded={aberta} aria-controls={`${id}-roda`} onClick={() => setAberta((x) => !x)}>
          {aberta ? t.escrever.fecharRoda : t.escrever.editarRoda}
        </button>
      </div>
      {aberta && (
        <div id={`${id}-roda`} className="mt-3 space-y-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (handleOk(limpo)) void mudar(limpo, true);
              else setErro(t.escrever.rodaNaoAchada);
            }}
          >
            <label htmlFor={`${id}-campo`} className="sr-only">
              {t.escrever.rodaCampo}
            </label>
            <input
              id={`${id}-campo`}
              className="al2-campo min-h-11 min-w-0 flex-1"
              value={campo}
              maxLength={21}
              placeholder={t.escrever.rodaCampo}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={erro ? true : undefined}
              aria-describedby={erro ? `${id}-erro` : `${id}-aviso`}
              onChange={(e) => setCampo(e.target.value.replace(/\s+/g, ""))}
            />
            <button type="submit" className="al-botao al-botao-primario al-botao-p" disabled={ocupado || !limpo}>
              {t.escrever.rodaPor}
            </button>
          </form>
          {erro && (
            <p id={`${id}-erro`} role="alert" className="text-sm font-semibold text-[var(--al-vermelho)]">
              {erro}
            </p>
          )}
          {n > 0 && (
            <ul className="max-h-48 space-y-1 overflow-y-auto overscroll-contain">
              {(lista ?? []).map((p) => (
                <li key={p.handle} className="flex items-center gap-2">
                  <Avatar16 handle={p.handle} cor={p.cor ?? undefined} tamanho={32} />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate">{p.nome}</strong>
                    <small className="block truncate text-[var(--al-texto-3)]">@{p.handle}</small>
                  </span>
                  <button
                    type="button"
                    className="al2-acao"
                    disabled={ocupado}
                    aria-label={preencher(t.escrever.rodaTirar, { nome: p.nome })}
                    title={preencher(t.escrever.rodaTirar, { nome: p.nome })}
                    onClick={() => void mudar(p.handle, false)}
                  >
                    <Icone nome="fechar" className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p id={`${id}-aviso`} className="text-xs text-[var(--al-texto-3)]">
            {t.escrever.rodaAviso}
          </p>
        </div>
      )}
    </div>
  );
}
