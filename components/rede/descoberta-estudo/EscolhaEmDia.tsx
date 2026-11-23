// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Item 46: a escolha "Parar quando eu estiver em dia", só neste aparelho. Desligada por padrão: a linha continua com a rolagem
// contínua do A20. Qual dos dois vira o padrão fica para a coordenação decidir.
import { useEffect, useId, useState } from "react";
import { emDiaEscolhido, escolherEmDia } from "@/lib/rede/descoberta-estudo/em-dia";
import { Bloco, Mensagem, type PropsDaParte } from "./comum";

export default function EscolhaEmDia({ t }: PropsDaParte) {
  const id = useId();
  const [sim, setSim] = useState<boolean | null>(null);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  // Lido depois de montar (o servidor não sabe o que este aparelho guardou).
  useEffect(() => {
    const x = window.setTimeout(() => setSim(emDiaEscolhido()), 0);
    return () => window.clearTimeout(x);
  }, []);
  const e = t.emDia.escolha;
  const mudar = (v: boolean) => {
    escolherEmDia(v);
    setSim(v);
    setMensagem({ texto: v ? e.ligado : e.desligado, erro: false });
  };
  return (
    <Bloco titulo={e.titulo} ajuda={e.ajuda}>
      {sim === null ? (
        <p role="status" className="de-miudo">{t.carregando}</p>
      ) : (
        <label className="de-marca" htmlFor={id}>
          <input id={id} type="checkbox" checked={sim} onChange={(x) => mudar(x.target.checked)} />
          <span>{e.rotulo}</span>
        </label>
      )}
      <p className="de-miudo">{e.aparelho}</p>
      <Mensagem mensagem={mensagem} />
    </Bloco>
  );
}
