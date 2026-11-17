// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A prova feita no aparelho, no formulário de criar conta da entrada (no lugar do desafio de terceiros): uma linha que diz o que
// acontece, o andamento enquanto o aparelho faz a conta e o motivo, se a porta não abrir. O desenho é o da entrada (ale-*).
import { useCallback, useRef, useState } from "react";
import { type AoAvancar, criarContaPelaPorta, type MotivoDaPorta, type ResultadoDaConta } from "@/lib/rede/convites/cliente";
import { useTextosDosConvites } from "./textos";

export type EstadoDaProva = { f: "parada" } | { f: "fazendo"; demorando: boolean } | { f: "pronta" } | { f: "erro"; motivo: MotivoDaPorta };

/** O estado da prova e o "criar conta" que passa pela porta (lib/rede/convites/cliente.ts). */
export function useProvaDaPorta() {
  const [estado, setEstado] = useState<EstadoDaProva>({ f: "parada" });
  const demorando = useRef(false);
  // A tela só muda quando a conta passa de três vezes o esperado (não a cada lote: seriam milhares de pinturas).
  const aoAvancar = useCallback<AoAvancar>((feitas, esperadas) => {
    const agora = feitas > esperadas * 3;
    if (agora !== demorando.current) {
      demorando.current = agora;
      setEstado({ f: "fazendo", demorando: agora });
    }
  }, []);
  const criarConta = useCallback(
    async (dados: { email: string; senha: string; codinome: string; volta: string; turnstile?: string }): Promise<ResultadoDaConta> => {
      demorando.current = false;
      setEstado({ f: "fazendo", demorando: false });
      const r = await criarContaPelaPorta(dados, aoAvancar).catch((): ResultadoDaConta => ({ ok: false, motivo: "falha" }));
      setEstado(r.ok ? { f: "pronta" } : { f: "erro", motivo: r.motivo });
      return r;
    },
    [aoAvancar],
  );
  const limpar = useCallback(() => setEstado({ f: "parada" }), []);
  return { estado, criarConta, limpar };
}

/**
 * A linha da prova: o que é (parada), o andamento (fazendo), enviando (pronta) ou o motivo (erro). Com `momento` (entrar, ou pedir
 * um e-mail: onda 9), a linha só aparece durante a conta ou no erro, a rede barrada é dita para aquele momento e o andamento não
 * promete "contra robôs": quem chama o serviço de contas direto pula esta prova (o que segura entrar em qualquer caminho é o
 * bloqueio da conta no banco).
 */
export function ProvaDoAparelho({ lang, estado, momento }: { lang: string; estado: EstadoDaProva; momento?: "entrar" | "aviso" }) {
  const t = useTextosDosConvites(lang);
  if (!t) return null;
  if (estado.f === "erro") {
    return (
      <p className="ale-msg ale-msg-erro" role="alert">
        {momento && estado.motivo === "rede_barrada" ? t.semTerceiro.redeBarrada[momento] : t.prova.erros[estado.motivo]}
      </p>
    );
  }
  if (momento && estado.f === "parada") return null;
  if (estado.f === "fazendo" || estado.f === "pronta") {
    return (
      <p className="ale-ajuda ale-prova" role="status">
        <span aria-hidden className="ale-giro" /> {estado.f === "pronta" ? t.prova.pronta : estado.demorando ? t.prova.demorando : momento ? t.prova.fazendoAntes : t.prova.fazendo}
      </p>
    );
  }
  return <p className="ale-ajuda">{t.prova.explica}</p>;
}
