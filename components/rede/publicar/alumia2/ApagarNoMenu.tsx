// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { redePub } from "@/lib/rede/cliente-publicar";

export interface TextosDoApagar {
  apagar: string;
  apagarPergunta: string;
  apagarSim: string;
  apagarNao: string;
}

/**
 * "Apagar post" no menu do cartão, só para quem escreveu (rede_pub_apagar, supabase/migracoes/20261126-p5-publicar.sql). Antes
 * não havia como apagar o próprio post na cara nova: quem moderava usava o "Moderar", e o aviso dizia que "uma pessoa da
 * moderação" tinha retirado. A confirmação é da própria Alumia (nada de confirm() do navegador): um toque abre a pergunta, o
 * segundo apaga. Sem resposta, o post sai de vez; com resposta ou citação, fica "[post apagado]" no lugar.
 */
export function ApagarNoMenu({
  postId,
  t,
  classe,
  previa,
  aoApagar,
  aoErro,
}: {
  postId: string;
  t: TextosDoApagar;
  classe: string;
  previa: boolean;
  aoApagar: () => void;
  aoErro: (e: unknown) => void;
}) {
  const [perguntando, setPerguntando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function apagar() {
    if (ocupado) return;
    if (previa) {
      aoApagar();
      return;
    }
    setOcupado(true);
    try {
      await redePub.apagar(postId);
      aoApagar();
    } catch (e) {
      setPerguntando(false);
      aoErro(e);
    } finally {
      setOcupado(false);
    }
  }

  if (!perguntando) {
    return (
      <button type="button" className={classe} onClick={() => setPerguntando(true)}>
        {t.apagar}
      </button>
    );
  }
  return (
    <div role="group" aria-label={t.apagar} className="space-y-2 px-2 py-2">
      <p className="text-sm" role="alert">
        {t.apagarPergunta}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="al-botao al-botao-primario al-botao-p" disabled={ocupado} aria-busy={ocupado} onClick={() => void apagar()}>
          {t.apagarSim}
        </button>
        <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled={ocupado} onClick={() => setPerguntando(false)}>
          {t.apagarNao}
        </button>
      </div>
    </div>
  );
}
