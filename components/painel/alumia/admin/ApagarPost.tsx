// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Botao } from "@/components/rede/ui/Botao";
import { rpc } from "@/lib/backend";
import { Campo, motivoDe, Quadro, useJanela } from "../pecas";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Apagar qualquer post pelo endereço (um de cada vez), inclusive de núcleo e de espaço fechado, que a lista de posts não mostra.
 * Vai para a lixeira do painel (volta em até 30 dias) sem que o painel leia o texto: apagar não é ler.
 */
export function ApagarPost() {
  const { pedir, janela } = useJanela();
  const [texto, setTexto] = useState("");
  const id = UUID.exec(texto)?.[0]?.toLowerCase() ?? "";

  const apagar = () =>
    pedir({
      titulo: "Apagar este post",
      texto: (
        <>
          <p>O post sai do ar agora e vai para a lixeira do painel: dá para restaurar em até 30 dias, na lista de posts (filtro Lixeira). Quem escreveu recebe o aviso, com o motivo, e pode recorrer.</p>
          <p>Post de núcleo ou de espaço fechado também sai, sem que o painel leia o que estava escrito.</p>
        </>
      ),
      campos: [{ tipo: "motivo", aviso: "Quem escreveu lê este motivo no aviso." }],
      confirmar: "Apagar o post",
      perigo: true,
      fazer: (v) => rpc("alumia_admin_post_apagar", { p_id: id, p_motivo: motivoDe(v) }),
      sucesso: "Post apagado (na lixeira por 30 dias).",
      depois: () => setTexto(""),
    });

  return (
    <Quadro titulo="Apagar qualquer post pelo endereço" tom="perigo">
      <form
        className="ap-filtros"
        onSubmit={(e) => {
          e.preventDefault();
          if (id) apagar();
        }}
      >
        <Campo rotulo="Endereço do post (ou o número dele)" largo>
          <input className="ap-entrada" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="https://…/alumia/p/…" autoComplete="off" spellCheck={false} />
        </Campo>
        <Botao type="submit" variante="primario" disabled={!id}>
          Apagar…
        </Botao>
      </form>
      <p className="ap-miudo">Um post de cada vez. Para posts que aparecem na lista abaixo, os botões de cada um fazem o mesmo.</p>
      {janela}
    </Quadro>
  );
}
