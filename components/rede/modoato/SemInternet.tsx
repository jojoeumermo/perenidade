// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useState } from "react";
import { pluginDaMalha } from "@/lib/rede/malha/android";
import type { EstadoDaMalha } from "@/lib/rede/malha/ativacao";
import type { FarolAssinado } from "@/lib/rede/malha/farol";
import { encher, type TextosDoModoAto } from "@/lib/rede/modoato/textos";
import { Botao } from "../ui/Botao";

const malha = () => import("@/lib/rede/malha/ativacao");
const atosDaMalha = () => import("@/lib/rede/malha/atos");

/**
 * Busca (com internet) o material do próximo ato que a pessoa confirmou, para o Farol dele chegar pela malha. Sem ato confirmado,
 * sem internet ou no modo prévia: false, e nada fica guardado. O material vive só na memória do app aberto (lib/rede/malha/atos.ts).
 */
async function prepararFarol(): Promise<boolean> {
  try {
    const [{ atos }, { chamar }, { buscarAto }] = await Promise.all([import("@/lib/rede/cliente-atos"), import("@/lib/rede/cliente"), atosDaMalha()]);
    const proximo = await atos.proximo();
    return proximo?.vou_eu ? await buscarAto(chamar, proximo.id) : false;
  } catch {
    return false;
  }
}

/**
 * "Perto, sem internet" (onda R3, item 2.2; docs/rede/SEM-INTERNET.md): liga a malha deste celular. Desligada por padrão e a cada
 * vez que o app abre; para ligar, a pessoa marca o aviso ("celulares próximos percebem que há um aparelho participando"). Ao ligar
 * (ainda com internet), o aparelho guarda na memória o material do próximo ato confirmado, e o Farol desse ato que chegar pela malha
 * aparece aqui. No site, o cartão só explica e diz que é coisa do app Android, e o núcleo da malha (as cifras) nem é baixado: ele só
 * vem, sob demanda, quando há o plugin do app.
 */
export function SemInternet({ t }: { t: TextosDoModoAto }) {
  const id = useId();
  const s = t.semInternet;
  const [estado, setEstado] = useState<EstadoDaMalha>("so_no_app");
  const [entendi, setEntendi] = useState(false);
  const [farolPronto, setFarolPronto] = useState<boolean | null>(null);
  const [farol, setFarol] = useState<FarolAssinado | null>(null);
  useEffect(() => {
    if (!pluginDaMalha()) return;
    const parar: (() => void)[] = [];
    let vivo = true;
    void Promise.all([malha(), atosDaMalha()]).then(([m, a]) => {
      if (!vivo) return;
      setEstado(m.estadoDaMalha());
      parar.push(m.aoMudarMalha(setEstado));
      parar.push(a.aoFarolSemInternet((_ato, f) => setFarol(f)));
    });
    return () => {
      vivo = false;
      for (const p of parar) p();
    };
  }, []);
  const ligada = estado === "ligada";

  async function ligar() {
    if (!entendi) return;
    setEstado((await malha()).ligarMalha({ celularesProximosPercebem: true }));
    setFarolPronto(await prepararFarol());
  }

  return (
    <section className="ma-cartao ma-sem-internet" aria-labelledby={`${id}-t`} data-ligado={ligada || undefined}>
      <div className="ma-cartao-topo">
        <span className="ma-malha" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </div>
      <p className="ma-rotulo al-cond">{s.rotulo}</p>
      <h2 id={`${id}-t`} className="ma-cartao-titulo al-cond">{s.titulo}</h2>
      <p className="ma-texto">{s.texto}</p>
      {estado === "so_no_app" ? (
        <p className="ma-miudo">{s.soNoApp}</p>
      ) : ligada ? (
        <>
          <p className="ma-miudo" role="status">{s.ligada}</p>
          {farol ? (
            <p className="ma-aviso-malha" role="alert" data-estado={farol.estado}>
              <strong>{encher(s.farolChegou, { estado: s.estados[farol.estado] })}</strong>
              {farol.estado === "ponto2" && farol.texto ? <> · {farol.texto}</> : null}
            </p>
          ) : farolPronto !== null ? (
            <p className="ma-miudo">{farolPronto ? s.farolPronto : s.farolSem}</p>
          ) : null}
          <p className="ma-miudo">{s.semSessao}</p>
          <div className="ma-acoes">
            <Botao
              variante="contorno"
              tamanho="g"
              pressionado
              onClick={() =>
                void Promise.all([malha(), atosDaMalha()]).then(([m, a]) => {
                  m.desligarMalha();
                  a.esquecerAtos();
                  setFarol(null);
                  setFarolPronto(null);
                })
              }
            >
              {s.desligar}
            </Botao>
          </div>
        </>
      ) : (
        <>
          <p className="ma-aviso-malha">{s.aviso}</p>
          <label className="ma-entendi">
            <input type="checkbox" checked={entendi} onChange={(e) => setEntendi(e.target.checked)} />
            <span>{s.entendi}</span>
          </label>
          <div className="ma-acoes">
            <Botao variante="primario" tamanho="g" disabled={!entendi} onClick={() => void ligar()}>{s.ligar}</Botao>
          </div>
        </>
      )}
    </section>
  );
}
