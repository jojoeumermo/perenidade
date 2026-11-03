// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill } from "@/i18n/config";
import type { TextosDaOrganizacao } from "@/i18n/escola/organizacao";
import type { RespostaPublicaDaOuvidoria } from "@/lib/escola/banco";
import { esquecerProtocolo, guardarProtocolos, lerProtocolosGuardados } from "@/lib/escola/organizacao";
import { respostasPublicas, useProtocolos } from "./guardado-organizacao";

/**
 * "Meus protocolos" (E4-12): os protocolos que ficaram neste aparelho, cruzados com as respostas públicas da ouvidoria.
 * Se o protocolo aparece lá, mostra o resumo e a resposta; se não, só "Recebida", sem prometer prazo. "Esquecer" apaga
 * só do aparelho, e a tela diz que a mensagem no servidor continua até a rotina dos 365 dias.
 */
export function MeusProtocolos({ s, assuntos }: { s: TextosDaOrganizacao["protocolos"]; assuntos: TextosDaOrganizacao["ouvidoria"]["assuntos"] }) {
  const lista = useProtocolos();
  const [publicas, setPublicas] = useState<RespostaPublicaDaOuvidoria[]>([]);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let vivo = true;
    void respostasPublicas().then((r) => vivo && setPublicas(r));
    return () => {
      vivo = false;
    };
  }, []);

  const esquecer = (protocolo: string) => {
    guardarProtocolos(esquecerProtocolo(lerProtocolosGuardados(), protocolo));
    setAviso(s.esquecido);
  };

  return (
    <div data-meus-protocolos="">
      <p className="org-nota">{s.lead}</p>
      {lista.length === 0 ? (
        <p className="org-nota" data-protocolos-vazio="">
          {s.vazio}
        </p>
      ) : (
        <>
          <ul className="org-protocolos">
            {[...lista].reverse().map((p) => {
              const resposta = publicas.find((r) => r.protocolo.toLowerCase() === p.protocolo);
              return (
                <li key={p.protocolo} data-protocolo={p.protocolo}>
                  <p className="org-protocolo-codigo">{p.protocolo.toUpperCase()}</p>
                  <p className="org-nota">
                    {assuntos[p.sobre]} · {fill(s.enviada, { data: p.em })}
                  </p>
                  {resposta ? (
                    <div className="org-resposta" data-protocolo-respondida="">
                      <p className="font-semibold">{fill(s.respondida, { data: resposta.respondida_em.slice(0, 10) })}</p>
                      <p className="org-nota">
                        <strong>{s.resumo}:</strong> {resposta.resumo_publico}
                      </p>
                      <p className="org-nota">
                        <strong>{s.resposta}:</strong> {resposta.resposta_publica}
                      </p>
                    </div>
                  ) : (
                    <p className="org-nota">{s.recebida}</p>
                  )}
                  <button type="button" className="botao" data-protocolo-esquecer={p.protocolo} onClick={() => esquecer(p.protocolo)}>
                    {s.esquecer}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="botao"
            data-protocolo-esquecer-todos=""
            onClick={() => {
              guardarProtocolos([]);
              setAviso(s.esquecido);
            }}
          >
            {s.esquecerTodos}
          </button>
          <p className="org-nota">{s.aviso}</p>
        </>
      )}
      <p className="org-nota" role="status" aria-live="polite">
        {aviso}
      </p>
    </div>
  );
}
