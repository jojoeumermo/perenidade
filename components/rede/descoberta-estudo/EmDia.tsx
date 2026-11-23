// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Item 46: "Você está em dia". A linha (components/rede/Linha.tsx) pergunta aqui se para no que a pessoa já viu, e mostra o cartão
// com "Ver mais antigos". Só com a flag "alumia-p4-descoberta-estudo" e só para quem ligou a escolha neste aparelho (a escolha fica na
// tela Descobrir). Desligado, a linha é a de sempre, com a rolagem contínua do A20.
import { useEffect, useState } from "react";
import { abaComEmDia, emDiaEscolhido, guardarMarco, marcoDaAba, ondeParar } from "@/lib/rede/descoberta-estudo/em-dia";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import { useTextosDE } from "./comum";

/**
 * O estado do "Você está em dia" para uma linha: se vale, onde parar e o "ver mais antigos". O marco é lido uma vez, ao montar (o da
 * visita anterior); o novo marco é guardado quando a lista chega.
 */
export function useEmDia(aba: string, comRegra: boolean, itens: readonly { criado_em: string }[]) {
  const [ativo] = useState(() => typeof window !== "undefined" && rotaNovaLigada("descobrir") && abaComEmDia(aba, comRegra) && emDiaEscolhido());
  const [marco] = useState(() => (ativo ? marcoDaAba(aba) : null));
  const [antigos, setAntigos] = useState(false);
  useEffect(() => {
    if (ativo && itens.length) guardarMarco(aba, itens);
  }, [ativo, aba, itens]);
  /** Onde parar nesta lista (nulo: não para). */
  const onde = (lista: readonly { criado_em: string }[]) => (ativo && !antigos ? ondeParar(lista, marco) : null);
  return { onde, verAntigos: () => setAntigos(true) };
}

/** O cartão do fim: "Você está em dia" e o botão para continuar nos mais antigos. */
export function VoceEstaEmDia({ lang, aoVerAntigos }: { lang: string; aoVerAntigos: () => void }) {
  const t = useTextosDE(lang);
  if (!t) return null;
  return (
    <section className="al2-fim" aria-labelledby="de-em-dia-titulo">
      <h2 id="de-em-dia-titulo" className="al2-fim-carimbo al2-fim-carimbo-caiu al-cond">{t.emDia.titulo}</h2>
      <p className="al2-estado-texto mt-3">{t.emDia.texto}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button type="button" className="al-botao al-botao-contorno al-botao-m al2-aperta" onClick={aoVerAntigos}>
          {t.emDia.antigos}
        </button>
      </div>
    </section>
  );
}
