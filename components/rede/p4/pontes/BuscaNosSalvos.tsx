// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Prompt 4, item 130 (atrás de "alumia-p4-pontes"): a busca nos salvos e nas pastas, só no aparelho. O termo nunca sai daqui: a
// tela junta as páginas pelo caminho de sempre (lib/rede/p4/pontes/busca-salvos.ts) e filtra no aparelho.
import { useEffect, useId, useState } from "react";
import { filtrarSalvos, juntarSalvos, termoValido, type Pagina, type PostDosSalvos } from "@/lib/rede/p4/pontes/busca-salvos";
import { por } from "./textos";
import { useTextosDasPontes } from "./usarTextos";

/**
 * O estado da busca. `base` é a página que a tela já tem (da lista aberta: todos os salvos ou uma pasta); `de` muda quando a pessoa
 * troca de pasta (a busca recomeça). Com o termo válido, `achados` é a lista filtrada; sem termo, nulo (a tela mostra a de sempre).
 */
export function useBuscaNosSalvos<P extends PostDosSalvos>({ ativo, lang, de, base, buscar }: { ativo: boolean; lang: string; de: string; base: Pagina<P> | null; buscar: (cursor: string) => Promise<Pagina<P>> }) {
  const t = useTextosDasPontes(lang, ativo);
  const id = useId();
  // O termo é da lista aberta: trocar de pasta recomeça a busca (sem efeito, pela chave).
  const [escrito, setEscrito] = useState<{ de: string; termo: string }>({ de, termo: "" });
  const termo = escrito.de === de ? escrito.termo : "";
  const setTermo = (novo: string) => setEscrito({ de, termo: novo });
  const [todos, setTodos] = useState<{ de: string; itens: P[] } | null>(null);
  const valido = ativo && termoValido(termo);

  useEffect(() => {
    if (!valido || !base || (todos && todos.de === de)) return;
    let vivo = true;
    juntarSalvos(base, buscar)
      .then((r) => vivo && setTodos({ de, itens: r.itens }))
      .catch(() => vivo && setTodos({ de, itens: base.itens }));
    return () => {
      vivo = false;
    };
  }, [valido, base, de, todos, buscar]);

  const achados = valido ? filtrarSalvos(todos && todos.de === de ? todos.itens : (base?.itens ?? []), termo) : null;
  const campo =
    ativo && t ? (
      <div className="px-[18px] py-2" role="search" data-p4-busca-salvos>
        <label htmlFor={id} className="block font-semibold">{t.salvos.buscar}</label>
        <input id={id} type="search" className="ac-campo mt-1 min-h-11 w-full" value={termo} onChange={(e) => setTermo(e.target.value)} autoComplete="off" spellCheck={false} enterKeyHint="search" />
        <p className="mt-1 text-sm text-[var(--al-texto-2)]">{t.salvos.ajuda}</p>
        {achados && (
          <p className="mt-1 text-sm" role="status" aria-live="polite">
            {achados.length ? por(t.salvos.achados, { n: achados.length }) : por(t.salvos.nenhum, { termo: termo.trim() })}
          </p>
        )}
      </div>
    ) : null;
  return { achados, campo };
}
