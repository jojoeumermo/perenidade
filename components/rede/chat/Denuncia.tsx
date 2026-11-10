// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { type CategoriaDeDenuncia, chat } from "@/lib/rede/cliente-chat";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDoChat } from "@/lib/rede/textos-chat";
import { botaoForte, botaoLeve, erroDoChat } from "./comum";

const CATEGORIAS: CategoriaDeDenuncia[] = ["assedio", "ameaca", "menores", "exposicao", "violencia", "autolesao", "odio", "golpe", "spam", "outro"];

/**
 * Denunciar a outra pessoa da conversa. Vão junto só os trechos que quem denuncia marcou (já decifrados no aparelho dela): a
 * moderação nunca recebe a chave da conversa. A denúncia entra na mesma fila da Alumia, e quem denuncia nunca é revelado.
 * A tela diz com todas as letras que os trechos marcados SAEM do cifrado e vão em texto aberto para a moderação.
 */
export function Denuncia({ t, s, conversa, trechos, aoFechar }: { t: TextosDoChat; s: TextosDaRede; conversa: string; trechos: string[]; aoFechar: (bloqueou: boolean) => void }) {
  const [categoria, setCategoria] = useState<CategoriaDeDenuncia>("assedio");
  const [bloquear, setBloquear] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [feito, setFeito] = useState("");
  const [erro, setErro] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      const juntos = trechos.map((x) => `> ${x.replace(/\s+/g, " ").trim()}`).join("\n").slice(0, 1800);
      const r = await chat.denunciar(conversa, categoria, juntos, bloquear);
      setFeito(preencher(t.denuncia.feito, { protocolo: r.protocolo }));
    } catch (erroDoEnvio) {
      setErro(erroDoChat(t, s, erroDoEnvio));
    } finally {
      setOcupado(false);
    }
  }

  if (feito) {
    return (
      <div role="status" className="border-b border-rule bg-parchment-deep px-[18px] py-4 text-sm">
        <p>{feito}</p>
        <button type="button" onClick={() => aoFechar(bloquear)} className={`${botaoLeve} mt-3`}>{t.conversa.voltar}</button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void enviar(e)} className="space-y-3 border-b border-rule bg-parchment-deep px-[18px] py-4 text-sm">
      <h2 className="font-serif text-lg font-bold">{t.denuncia.titulo}</h2>
      <p className="text-ink-soft">{t.denuncia.explica}</p>
      <p role="note" className="rounded-md border border-oxblood px-3 py-2 font-semibold">{t.denuncia.aberto}</p>
      <p className="font-semibold">{preencher(t.denuncia.marcadas, { n: trechos.length })}</p>
      <fieldset>
        <legend className="font-semibold">{t.denuncia.categoria}</legend>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {CATEGORIAS.map((c) => (
            <label key={c} className="flex min-h-11 items-center gap-2">
              <input type="radio" name="chat-denuncia-categoria" value={c} checked={categoria === c} onChange={() => setCategoria(c)} />
              {t.denuncia.categorias[c]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" checked={bloquear} onChange={(e) => setBloquear(e.target.checked)} />
        {t.denuncia.bloquearJunto}
      </label>
      <p className="text-xs text-ink-soft">{t.denuncia.emergencia}</p>
      {erro && <p role="alert" className="text-oxblood">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={ocupado} className={botaoForte}>{t.denuncia.enviar}</button>
        <button type="button" onClick={() => aoFechar(false)} className={botaoLeve}>{t.denuncia.cancelar}</button>
      </div>
    </form>
  );
}
