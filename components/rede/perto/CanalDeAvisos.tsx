// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O canal de aviso da organização (Prompt 4, item 22), no perfil da organização, atrás de "alumia-p4-perto": cada pessoa escolhe
// receber todo post novo, só os avisos ou nada (o sino de sempre, com uma escolha a mais). Quem gere a organização vê quantas pessoas
// recebem, só a partir de 3. Ninguém vê quem.
import { useEffect, useState } from "react";
import { ligado } from "@/lib/recursos";
import { canal, type ContagemDoCanal, type ModoDoCanal } from "@/lib/rede/perto/canal";
import { por, textoDoErro } from "./textos";
import { useTextosDoPerto } from "./usarTextos";
import "./perto.css";

const MODOS: readonly ModoDoCanal[] = ["nada", "tudo", "avisos"];

export function CanalDeAvisos({ handle, lang, gerencio, aoMudarSino }: { handle: string; lang: string; gerencio: boolean; aoMudarSino?: (sim: boolean) => void }) {
  const ativo = ligado("alumia-p4-perto");
  const t = useTextosDoPerto(ativo ? lang : "pt");
  const [modo, setModo] = useState<ModoDoCanal | null>(null);
  const [conta, setConta] = useState<ContagemDoCanal | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    canal.meu(handle).then((m) => vivo && setModo(m), () => vivo && setModo("nada"));
    if (gerencio) canal.contagem(handle).then((c) => vivo && setConta(c), () => undefined);
    return () => {
      vivo = false;
    };
  }, [ativo, handle, gerencio]);

  if (!ativo || !t || modo === null) return null;
  const tc = t.canal;
  const escolher = async (novo: ModoDoCanal) => {
    setOcupado(true);
    setErro("");
    try {
      const m = await canal.escolher(handle, novo);
      setModo(m);
      aoMudarSino?.(m !== "nada");
    } catch (e) {
      setErro(textoDoErro(t.erros, e));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <section className="pt-canal" aria-labelledby={`pt-canal-${handle}`} data-pt-canal="">
      <h3 id={`pt-canal-${handle}`}>{tc.titulo}</h3>
      <p className="pt-nota">{tc.texto}</p>
      <fieldset className="pt-opcoes" disabled={ocupado}>
        <legend className="sr-only">{tc.titulo}</legend>
        <div className="pt-pilulas">
          {MODOS.map((m) => (
            <label key={m} className="pt-pilula">
              <input type="radio" name={`pt-canal-${handle}`} checked={modo === m} onChange={() => void escolher(m)} />
              <span>{tc[m]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {gerencio && conta && (
        <p className="pt-nota" role="status">
          {conta.inscritas === null ? tc.menosDe3 : por(tc.inscritas, { n: conta.inscritas })}
          {conta.so_avisos !== null ? ` ${por(tc.soAvisos, { n: conta.so_avisos })}` : ""}
        </p>
      )}
      {erro && <p role="alert" className="pt-erro">{erro}</p>}
    </section>
  );
}
