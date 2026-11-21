// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Prompt 4, item 82 (atrás de "alumia-p4-pontes"): federar só com servidores aprovados. A lista é de SERVIDORES (nunca de pessoas);
// com o modo ligado, todo servidor fora dela conta como bloqueado (interno.rede_fed_bloqueado). Ligar não apaga nada; desligar
// volta ao que era. O bloqueio fixo (Threads e Bridgy Fed) continua valendo por cima da lista.
import { useState } from "react";
import { Botao } from "@/components/rede/ui/Botao";
import { rpc } from "@/lib/backend";
import type { Aprovados, ServidorAprovado } from "@/lib/rede/p4/pontes/cliente";
import { Campo, Estado, Etiqueta, Nota, quando, Quadro, useDado, useJanela } from "../pecas";

const DOMINIO = /^[a-z0-9.-]{3,253}$/;

export function ServidoresAprovados({ depois }: { depois: () => void }) {
  const leitura = useDado<Aprovados>("rede_p4_fed_aprovados_ver");
  const { pedir, janela } = useJanela();
  const [dominio, setDominio] = useState("");
  const limpo = dominio.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^@[^@]*@/, "").replace(/\.$/, "");
  const valido = DOMINIO.test(limpo) && limpo.includes(".") && !/^[.-]|[.-]$|\.\./.test(limpo);
  const dados = leitura.dados;
  const lista = dados?.lista ?? [];
  const recarregar = () => {
    leitura.recarregar();
    depois();
  };

  const aprovar = () =>
    pedir({
      titulo: `Aprovar ${limpo}`,
      texto: <p>Com o modo ligado, a Alumia passa a conversar com <strong>{limpo}</strong> e com os subdomínios dele.</p>,
      confirmar: "Aprovar o servidor",
      fazer: () => rpc("rede_p4_fed_aprovar", { p_dominio: limpo, p_sim: true }),
      sucesso: "Servidor aprovado.",
      depois: () => {
        setDominio("");
        recarregar();
      },
    });
  const tirar = (s: ServidorAprovado) =>
    pedir({
      titulo: `Tirar ${s.dominio}`,
      texto: <p>Com o modo ligado, {s.dominio} passa a contar como bloqueado: nada entra de lá e nada vai para lá.</p>,
      confirmar: "Tirar da lista",
      perigo: true,
      fazer: () => rpc("rede_p4_fed_aprovar", { p_dominio: s.dominio, p_sim: false }),
      sucesso: "Servidor tirado da lista.",
      depois: recarregar,
    });
  const mudarModo = (sim: boolean) =>
    pedir({
      titulo: sim ? "Federar só com os aprovados" : "Voltar a federar com todos",
      texto: sim ? (
        <>
          <p>Todo servidor fora da lista passa a contar como bloqueado: nada entra de lá e nada sai para lá.</p>
          {lista.length === 0 ? <p><strong>A lista está vazia:</strong> a Alumia não vai conversar com ninguém de fora.</p> : null}
          <p>Nada é apagado; desligar volta ao que era.</p>
        </>
      ) : (
        <p>A Alumia volta a conversar com todo servidor que não está bloqueado.</p>
      ),
      confirmar: sim ? "Ligar o modo" : "Desligar o modo",
      perigo: sim,
      fazer: () => rpc("rede_p4_fed_modo", { p_so_aprovados: sim }),
      sucesso: sim ? "Modo ligado." : "Modo desligado.",
      depois: recarregar,
    });

  return (
    <Quadro titulo="Federar só com servidores aprovados" lado={dados ? <Etiqueta tom={dados.so_aprovados ? "dourado" : undefined}>{dados.so_aprovados ? "ligado" : "desligado"}</Etiqueta> : null}>
      <Estado leitura={leitura} />
      {dados ? (
        <>
          <p className="ap-miudo">
            Ligado, a Alumia só conversa com os servidores desta lista (e com os subdomínios deles). Os outros contam como bloqueados. Ligar não apaga nada; desligar volta ao que
            era. O bloqueio fixo continua valendo.
          </p>
          <Botao variante={dados.so_aprovados ? "contorno" : "primario"} onClick={() => mudarModo(!dados.so_aprovados)}>
            {dados.so_aprovados ? "Desligar o modo…" : "Ligar o modo…"}
          </Botao>
          <form
            className="ap-filtros"
            onSubmit={(e) => {
              e.preventDefault();
              if (valido) aprovar();
            }}
          >
            <Campo rotulo="Servidor para aprovar" largo>
              <input className="ap-entrada" value={dominio} onChange={(e) => setDominio(e.target.value)} placeholder="mastodon.social" autoComplete="off" spellCheck={false} />
            </Campo>
            <Botao type="submit" variante="contorno" disabled={!valido}>
              Aprovar…
            </Botao>
          </form>
          {lista.length === 0 ? (
            <Nota>Nenhum servidor aprovado ainda.</Nota>
          ) : (
            <ul className="ap-lista">
              {lista.map((s) => (
                <li key={s.dominio} className="ap-linha">
                  <span className="ap-linha-texto">
                    <span className="ap-linha-cabeca">
                      <span className="ap-forte">{s.dominio}</span>
                      <span className="ap-miudo">desde {quando(s.desde)}</span>
                    </span>
                  </span>
                  <span className="ap-linha-acoes">
                    <Botao variante="contorno" tamanho="p" onClick={() => tirar(s)}>
                      Tirar…
                    </Botao>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
      {janela}
    </Quadro>
  );
}
