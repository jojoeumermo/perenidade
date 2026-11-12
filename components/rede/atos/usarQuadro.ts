// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os ganchos dos quadros do ato (tarefas, caronas, petição): carregar do servidor (ou do dublê na prévia), trocar pelo que a
// ação devolveu, e anunciar ao leitor de tela o que mudou (uma região aria-live por quadro).
import { useCallback, useEffect, useRef, useState } from "react";

export type EstadoDoQuadro<T> = { fase: "carregando" } | { fase: "erro"; erro: string } | { fase: "pronto"; dados: T } | { fase: "desligado" };

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Carrega uma vez por `chave` (e de novo ao recarregar). `ligado` falso não pergunta nada (ex.: visitante nas caronas). */
export function useQuadro<T>(carregar: () => Promise<T>, chave: string, ligado = true) {
  const [estado, setEstado] = useState<EstadoDoQuadro<T>>(ligado ? { fase: "carregando" } : { fase: "desligado" });
  const [volta, setVolta] = useState(0);
  const carregarRef = useRef(carregar);
  useEffect(() => {
    carregarRef.current = carregar;
  }, [carregar]);
  useEffect(() => {
    if (!ligado) {
      queueMicrotask(() => setEstado({ fase: "desligado" }));
      return;
    }
    let vivo = true;
    carregarRef
      .current()
      .then((d) => vivo && setEstado({ fase: "pronto", dados: d }))
      .catch((e) => vivo && setEstado({ fase: "erro", erro: mensagem(e) }));
    return () => {
      vivo = false;
    };
  }, [chave, ligado, volta]);
  const trocar = useCallback((d: T) => setEstado({ fase: "pronto", dados: d }), []);
  const recarregar = useCallback(() => {
    setEstado({ fase: "carregando" });
    setVolta((v) => v + 1);
  }, []);
  return { estado, trocar, recarregar };
}

/** Uma frase para o leitor de tela (aria-live="polite"). Repetir a mesma frase volta a anunciar. */
export function useAnuncio(): [string, (frase: string) => void] {
  const [texto, setTexto] = useState("");
  const anunciar = useCallback((frase: string) => {
    setTexto("");
    // um quadro depois, para o leitor de tela perceber a troca mesmo quando a frase se repete
    requestAnimationFrame(() => setTexto(frase));
  }, []);
  return [texto, anunciar];
}
