// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Botao } from "@/components/rede/ui/Botao";
import { rpc } from "@/lib/backend";
import type { ServidorBloqueado } from "@/lib/rede/admin/tipos";
import { Campo, Estado, Etiqueta, motivoDe, Nota, quando, Quadro, Titulo, useDado, useJanela } from "../pecas";
import { pontesP4LigadoNoSite } from "@/lib/rede/p4/pontes/ligado";
import { ServidoresAprovados } from "./ServidoresAprovados";

const DOMINIO = /^[a-z0-9.-]{3,253}$/;

/** Os servidores do Fediverso: bloquear um servidor inteiro (nada entra dele, nada daqui vai para ele) e desbloquear. */
export function Fediverso({ recarregarEstado }: { recarregarEstado: () => void }) {
  const leitura = useDado<ServidorBloqueado[]>("alumia_admin_fed_servidores");
  const { pedir, janela } = useJanela();
  const [dominio, setDominio] = useState("");
  const limpo = dominio.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^@[^@]*@/, "");
  const valido = DOMINIO.test(limpo) && limpo.includes(".");
  const depois = () => {
    leitura.recarregar();
    recarregarEstado();
  };

  const bloquear = () =>
    pedir({
      titulo: `Bloquear ${limpo}`,
      texto: (
        <>
          <p>
            Nada que vem de <strong>{limpo}</strong> entra na Alumia (posts, respostas, curtidas, seguidas) e nada daqui vai para lá. O que já tinha chegado de lá sai das linhas.
          </p>
          <p>Não há como obrigar um servidor de fora a apagar o que já recebeu.</p>
        </>
      ),
      campos: [{ tipo: "motivo" }],
      confirmar: "Bloquear o servidor",
      perigo: true,
      fazer: (v) => rpc("alumia_admin_fed_bloquear", { p_dominio: limpo, p_sim: true, p_motivo: motivoDe(v) }),
      sucesso: "Servidor bloqueado.",
      depois: () => {
        setDominio("");
        depois();
      },
    });
  const desbloquear = (s: ServidorBloqueado) =>
    pedir({
      titulo: `Desbloquear ${s.dominio}`,
      texto: <p>O servidor volta a conversar com a Alumia. Quem bloqueou só para si continua com o bloqueio dela.</p>,
      campos: [{ tipo: "motivo" }],
      confirmar: "Desbloquear",
      fazer: (v) => rpc("alumia_admin_fed_bloquear", { p_dominio: s.dominio, p_sim: false, p_motivo: motivoDe(v) }),
      sucesso: "Servidor desbloqueado.",
      depois,
    });

  const lista = leitura.dados ?? [];
  return (
    <div className="ap-tela">
      <Titulo nome="Fediverso: servidores" sobre="Bloquear um servidor inteiro do Fediverso, para todo mundo da Alumia. Cada pessoa continua podendo silenciar ou bloquear uma conta de fora só para si." />
      <Quadro titulo="Bloquear um servidor">
        <form
          className="ap-filtros"
          onSubmit={(e) => {
            e.preventDefault();
            if (valido) bloquear();
          }}
        >
          <Campo rotulo="Endereço do servidor" largo>
            <input className="ap-entrada" value={dominio} onChange={(e) => setDominio(e.target.value)} placeholder="exemplo.social" autoComplete="off" spellCheck={false} />
          </Campo>
          <Botao type="submit" variante="primario" disabled={!valido}>
            Bloquear…
          </Botao>
        </form>
        <p className="ap-miudo">Silenciar um servidor inteiro (deixar entrar, mas fora das linhas de quem não segue ninguém de lá) ainda não existe: por enquanto, é bloquear ou não.</p>
      </Quadro>
      <Quadro titulo="Servidores bloqueados" lado={<Etiqueta>{lista.length}</Etiqueta>}>
        <Estado leitura={leitura} eVazio={leitura.dados !== null && lista.length === 0} vazio="Nenhum servidor bloqueado." />
        <ul className="ap-lista">
          {lista.map((s) => (
            <li key={s.dominio} className="ap-linha">
              <span className="ap-linha-texto">
                <span className="ap-linha-cabeca">
                  <span className="ap-forte">{s.dominio}</span>
                  {s.fixo ? <Etiqueta tom="dourado">fixo</Etiqueta> : null}
                  <span className="ap-miudo">desde {quando(s.desde)}</span>
                </span>
                {s.motivo ? <span className="ap-quebra">{s.motivo}</span> : null}
              </span>
              <span className="ap-linha-acoes">
                {s.fixo ? (
                  <span className="ap-miudo">da lista da casa</span>
                ) : (
                  <Botao variante="contorno" tamanho="p" onClick={() => desbloquear(s)}>
                    Desbloquear…
                  </Botao>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Quadro>
      {/* Prompt 4, item 82: só com "alumia-p4-pontes" ligado na montagem. */}
      {pontesP4LigadoNoSite() ? <ServidoresAprovados depois={depois} /> : null}
      <Nota>Ligar e desligar o Fediverso inteiro fica no Beta fechado e em Recursos. Desligar não apaga nada.</Nota>
      {janela}
    </div>
  );
}
