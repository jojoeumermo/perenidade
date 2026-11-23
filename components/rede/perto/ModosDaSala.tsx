// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os modos da sala de voz (Prompt 4, itens 23 a 25), dentro da sala que já existe (components/rede/voz/SalaDeVoz.tsx), atrás de
// "alumia-p4-perto": o palco com a fila de mãos, a sala de espera e o ritmo de estudo. O estado vem do controle
// (lib/rede/voz/controle-dos-modos.ts) e tudo vai pelo canal cifrado da sala. A presença, no estudo, só como contagem a partir de 3.
import { useState } from "react";
import type { ControleDosModos } from "@/lib/rede/voz/controle-dos-modos";
import { contagem, type EstadoDaSala, esperando, faseDoRitmo, possoFalar } from "@/lib/rede/voz/modos";
import { por, tempoCurto, type TextosDoPerto } from "./textos";
import { useAgora } from "./usar";

type T = TextosDoPerto["sala"];

/** "N pessoas na sala" só a partir de 3. */
export function Presenca({ t, n }: { t: T; n: number }) {
  const c = contagem(n);
  return <p className="pt-nota" role="status">{c === null ? t.presencaPoucas : por(t.presenca, { n: c })}</p>;
}

export function ModosDaSala({ t, eu, estado, controle, nomes, total }: { t: T; eu: string; estado: EstadoDaSala; controle: ControleDosModos; nomes?: Record<string, string>; total: number }) {
  const agora = useAgora(1000);
  const [foco, setFoco] = useState(25);
  const [pausa, setPausa] = useState(5);
  const nome = (u: string) => (u === eu ? "—" : (nomes?.[u] ?? t.alguem));
  const souAnfitria = estado.anfitria === eu;
  const livre = estado.anfitria === null;
  const pode = souAnfitria || livre;
  const a = controle.acoes;

  if (esperando(estado, eu)) return <p className="pt-alerta" role="status">{t.esperando}</p>;

  const ritmo = estado.ritmo ? faseDoRitmo(estado.ritmo, agora) : null;
  return (
    <div className="pt-sala" data-pt-sala="">
      {ritmo && (
        <div role="timer" aria-live="off">
          <p className="pt-relogio">{t.fases[ritmo.fase]} · {tempoCurto(ritmo.faltaMs)}</p>
          <p className="pt-nota">{por(t.falta, { tempo: tempoCurto(ritmo.faltaMs), proxima: t.fases[ritmo.fase === "foco" ? "pausa" : "foco"] })}</p>
          <Presenca t={t} n={total} />
        </div>
      )}
      {estado.palco && !possoFalar(estado, eu) && (
        <div>
          <p className="pt-nota">{t.ouvindo}</p>
          <button type="button" className="al-botao al-botao-contorno al-botao-m" aria-pressed={estado.maos.includes(eu)} onClick={() => void a.mao(!estado.maos.includes(eu))}>
            {estado.maos.includes(eu) ? t.abaixar : t.levantar}
          </button>
        </div>
      )}
      {estado.palco && souAnfitria && (
        <div>
          <p className="pt-nota">{t.maos}</p>
          {estado.maos.length === 0 ? (
            <p className="pt-nota">{t.semMaos}</p>
          ) : (
            <ul>
              {estado.maos.map((u) => (
                <li key={u}>
                  <span>{nome(u)}</span>
                  <button type="button" className="al-botao al-botao-claro al-botao-p" onClick={() => void a.vez(u, true)}>{t.darVez}</button>
                </li>
              ))}
            </ul>
          )}
          {estado.falam.filter((u) => u !== eu).length > 0 && (
            <>
              <p className="pt-nota">{t.falam}</p>
              <ul>
                {estado.falam.filter((u) => u !== eu).map((u) => (
                  <li key={u}>
                    <span>{nome(u)}</span>
                    <button type="button" className="al-botao al-botao-fantasma al-botao-p" onClick={() => void a.vez(u, false)}>{t.tirarVez}</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {estado.espera && souAnfitria && (
        <div>
          <p className="pt-nota">{t.batendo}</p>
          {estado.batendo.length === 0 ? (
            <p className="pt-nota">{t.ninguemBatendo}</p>
          ) : (
            <ul>
              {estado.batendo.map((u) => (
                <li key={u}>
                  <span>{nome(u)}</span>
                  <button type="button" className="al-botao al-botao-claro al-botao-p" onClick={() => void a.decidir(u, true)}>{t.deixar}</button>
                  <button type="button" className="al-botao al-botao-fantasma al-botao-p" onClick={() => void a.decidir(u, false)}>{t.recusar}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {estado.espera && !souAnfitria && estado.batendo.length > 0 && <p className="pt-nota">{t.alguemEsperando}</p>}
      {pode && (
        <details>
          <summary>{t.modos}</summary>
          <div className="pt-acoes">
            <button type="button" className="al-botao al-botao-contorno al-botao-m" aria-pressed={estado.palco} onClick={() => void a.palco(!estado.palco)}>{estado.palco ? t.fecharPalco : t.ligarPalco}</button>
            <button type="button" className="al-botao al-botao-contorno al-botao-m" aria-pressed={estado.espera} onClick={() => void a.espera(!estado.espera)}>{estado.espera ? t.desligarEspera : t.ligarEspera}</button>
          </div>
          <p className="pt-nota">{t.estudo}</p>
          {estado.ritmo ? (
            <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={() => void a.ritmo(null)}>{t.pararRitmo}</button>
          ) : (
            <div className="pt-acoes">
              <label className="pt-campo">
                <span>{t.foco}</span>
                <input type="number" min={5} max={90} value={foco} onChange={(e) => setFoco(Math.min(90, Math.max(5, Number(e.target.value) || 25)))} />
              </label>
              <label className="pt-campo">
                <span>{t.pausa}</span>
                <input type="number" min={1} max={30} value={pausa} onChange={(e) => setPausa(Math.min(30, Math.max(1, Number(e.target.value) || 5)))} />
              </label>
              <button type="button" className="al-botao al-botao-claro al-botao-m" onClick={() => void a.ritmo({ foco, pausa })}>{t.ligarRitmo}</button>
            </div>
          )}
          <p className="pt-nota">{t.limite}</p>
        </details>
      )}
    </div>
  );
}
