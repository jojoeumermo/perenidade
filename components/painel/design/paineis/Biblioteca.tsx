// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A biblioteca da equipe: blocos reutilizáveis (um conjunto de camadas, como um cabeçalho ou uma faixa de rodapé) e
// paletas de campanha, guardados no banco e vistos por toda a equipe de design. Se o banco ainda não tiver a
// biblioteca (antes de a coordenação rodar o install.sql novo), tudo fica guardado neste aparelho.

import { useCallback, useEffect, useState } from "react";
import { rpc } from "@/lib/backend";
import { caixaDeVarias, type Camada, novoId } from "../motor";
import type { Editor } from "../ui";

export interface ItemDaBiblioteca {
  id: string;
  tipo: "bloco" | "paleta";
  nome: string;
  dados: { camadas?: Camada[]; cores?: string[]; w?: number; h?: number };
  autor: string;
  meu: boolean;
  local?: boolean;
}

const CHAVE = "lucia:estudio-biblioteca";
const lerLocal = (): ItemDaBiblioteca[] => {
  try {
    return (JSON.parse(window.localStorage.getItem(CHAVE) ?? "[]") as ItemDaBiblioteca[]).map((i) => ({ ...i, local: true, meu: true }));
  } catch {
    return [];
  }
};
const gravarLocal = (lista: ItemDaBiblioteca[]) => {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(lista.filter((i) => i.local)));
  } catch {
    /* sem espaço */
  }
};

/** O banco ainda não tem a função (install.sql antigo)? */
const semFuncao = (erro: unknown) => /function|função|could not find|schema cache|PGRST202|404/i.test(String((erro as Error)?.message ?? erro));

export async function listarBiblioteca(): Promise<ItemDaBiblioteca[]> {
  try {
    const remotos = await rpc<ItemDaBiblioteca[]>("design_biblioteca_listar", {});
    return [...(remotos ?? []), ...lerLocal()];
  } catch {
    return lerLocal();
  }
}

export async function salvarNaBiblioteca(item: Omit<ItemDaBiblioteca, "id" | "autor" | "meu">): Promise<"conta" | "aparelho"> {
  try {
    await rpc("design_biblioteca_salvar", { p: { tipo: item.tipo, nome: item.nome, dados: item.dados } });
    return "conta";
  } catch (erro) {
    if (!semFuncao(erro)) throw erro;
    gravarLocal([...lerLocal(), { ...item, id: novoId(), autor: "", meu: true, local: true }]);
    return "aparelho";
  }
}

export async function apagarDaBiblioteca(item: ItemDaBiblioteca) {
  if (item.local) return gravarLocal(lerLocal().filter((i) => i.id !== item.id));
  await rpc("design_biblioteca_apagar", { p_id: item.id });
}

export function useBiblioteca() {
  const [itens, setItens] = useState<ItemDaBiblioteca[] | null>(null);
  const recarregar = useCallback(() => void listarBiblioteca().then(setItens), []);
  useEffect(() => {
    recarregar();
    const ouvir = () => recarregar();
    window.addEventListener("estudio-biblioteca", ouvir);
    return () => window.removeEventListener("estudio-biblioteca", ouvir);
  }, [recarregar]);
  return { itens, recarregar };
}
const avisarBiblioteca = () => window.dispatchEvent(new Event("estudio-biblioteca"));

/** Guarda as camadas escolhidas como bloco (posições relativas ao canto do bloco). */
export async function guardarBloco(ed: Editor) {
  const lista = ed.selecionadas;
  if (!lista.length) return;
  const sugestao = lista.length === 1 ? (lista[0].nome || "Bloco") : `Bloco de ${lista.length} camadas`;
  const nome = window.prompt("Nome do bloco (aparece em Elementos › Blocos):", sugestao)?.trim();
  if (!nome) return;
  const b = caixaDeVarias(lista);
  const camadas = lista.map((c) => ({ ...c, x: c.x - b.x, y: c.y - b.y }));
  try {
    const onde = await salvarNaBiblioteca({ tipo: "bloco", nome: nome.slice(0, 80), dados: { camadas, w: b.w, h: b.h } });
    ed.avisar(onde === "conta" ? "Bloco guardado na biblioteca da equipe." : "Bloco guardado neste aparelho (a biblioteca da equipe chega quando o banco for atualizado).");
    avisarBiblioteca();
  } catch {
    ed.avisar("Não deu para guardar o bloco.", "erro");
  }
}

/** Põe o bloco no meio da página (com ids novos e o grupo junto). */
export function usarBloco(ed: Editor, item: ItemDaBiblioteca) {
  const camadas = item.dados.camadas ?? [];
  if (!camadas.length) return;
  const w = item.dados.w ?? 0;
  const h = item.dados.h ?? 0;
  const x0 = Math.round(ed.doc.w / 2 - w / 2);
  const y0 = Math.round(ed.doc.h / 2 - h / 2);
  const grupo = camadas.length > 1 ? novoId() : undefined;
  ed.acrescentar(camadas.map((c) => ({ ...c, id: novoId(), x: c.x + x0, y: c.y + y0, grupo })));
}

export async function guardarPaleta(ed: Editor, nome: string) {
  try {
    const onde = await salvarNaBiblioteca({ tipo: "paleta", nome: nome.slice(0, 80), dados: { cores: ed.projeto.paleta } });
    ed.avisar(onde === "conta" ? "Paleta guardada na biblioteca da equipe." : "Paleta guardada neste aparelho.");
    avisarBiblioteca();
  } catch {
    ed.avisar("Não deu para guardar a paleta.", "erro");
  }
}

export { avisarBiblioteca };
