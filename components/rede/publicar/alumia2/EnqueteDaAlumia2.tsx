// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { redePub } from "@/lib/rede/cliente-publicar";
import { preencher } from "@/lib/rede/preencher";
import { porcentagensDaEnquete } from "@/lib/rede/publicar/alumia2";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosPublicar } from "@/lib/rede/textos-publicar";
import type { EnqueteDoPost } from "@/lib/rede/tipos-publicar";
import { textoDoErro } from "../../erros";
import { invalidar } from "../detalhes";
import { textoDoErroPublicar } from "../textos";
import type { TextosAlumia2 } from "./textos";

const codigoDe = (e: unknown) => (typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "falha");

/** "em 1 dia", "em 3 horas", no idioma da página. */
function daquiA(iso: string, lang: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return "";
  try {
    const f = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
    const h = Math.round(ms / 3_600_000);
    return Math.abs(h) >= 24 ? f.format(Math.round(h / 24), "day") : f.format(Math.max(1, h), "hour");
  } catch {
    return new Date(iso).toISOString().slice(0, 10);
  }
}

/**
 * A enquete com barras da prancha (computador-inicio: "10h ▇▇▇ 42% · 61 votos · fecha em 1 dia"). Voto secreto: só totais, e só
 * para quem já pode vê-los (quem votou, quem fez a enquete ou depois do prazo, regra do banco). Abaixo de 3 votos o total não
 * aparece ("poucos votos"): com tão pouca gente, o número diria quem votou (PLANO-ALUMIA §6.1; LGPD art. 11, opinião política).
 */
export function EnqueteDaAlumia2({ postId, inicial, t, tp, s, lang, logado }: { postId: string; inicial: EnqueteDoPost; t: TextosAlumia2; tp: TextosPublicar; s: TextosDaRede; lang: string; logado: boolean }) {
  const [e, setE] = useState(inicial);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const jaVotei = e.votei.length > 0;
  const podeVotar = logado && !e.encerrada && !jaVotei;
  const votos = e.opcoes.map((o) => (o.votos === undefined ? null : o.votos));
  const total = e.total ?? null;
  // Com menos de 3 votos, nem a porcentagem: 1 voto = 100 % diria em quem a única pessoa votou.
  const pct = total !== null && total < 3 ? null : porcentagensDaEnquete(votos);

  async function votar() {
    if (!marcadas.length || ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      setE(await redePub.votar(postId, marcadas));
      invalidar(postId);
    } catch (x) {
      setErro(textoDoErroPublicar(tp, codigoDe(x)) ?? textoDoErro(s, x));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <fieldset className="mt-3 max-w-[408px] border-0 p-0">
      <legend className="sr-only">{t.enquete.rotulo}</legend>
      <ul className="grid gap-1.5">
        {e.opcoes.map((o, i) => {
          const marcada = marcadas.includes(o.id);
          if (podeVotar) {
            return (
              <li key={o.id}>
                <label className={`al2-barra cursor-pointer ${marcada ? "al2-barra-minha" : ""}`}>
                  {marcada && <span className="al2-barra-cheia" style={{ width: "100%" }} aria-hidden />}
                  <span className="flex items-center gap-2">
                    <input
                      type={e.multipla ? "checkbox" : "radio"}
                      name={`enquete-${postId}`}
                      checked={marcada}
                      className="h-4 w-4 accent-[var(--al-dourado)]"
                      onChange={(ev) => setMarcadas((m) => (e.multipla ? (ev.target.checked ? [...m, o.id] : m.filter((x) => x !== o.id)) : [o.id]))}
                    />
                    {o.texto}
                  </span>
                </label>
              </li>
            );
          }
          const p = pct ? pct[i] : null;
          return (
            <li key={o.id} className={`al2-barra ${e.votei.includes(o.id) ? "al2-barra-minha" : ""}`}>
              {p !== null && <span className="al2-barra-cheia" style={{ width: `${p}%` }} aria-hidden />}
              <span>
                {o.texto}
                {e.votei.includes(o.id) && <span className="sr-only"> ({t.enquete.votou})</span>}
              </span>
              {p !== null && <span>{p}%</span>}
            </li>
          );
        })}
      </ul>
      {podeVotar && (
        <button type="button" className="al-botao al-botao-contorno al-botao-p mt-2" disabled={!marcadas.length || ocupado} onClick={() => void votar()}>
          {t.enquete.votar}
        </button>
      )}
      <p className="mt-2 text-xs text-[var(--al-texto-3)]" role="status">
        {total !== null && (total >= 3 ? preencher(t.enquete.votos, { n: total.toLocaleString(lang) }) : t.enquete.poucos)}
        {total !== null && " · "}
        {e.encerrada ? t.enquete.encerrada : preencher(t.enquete.fecha, { quando: daquiA(e.prazo, lang) })}
        <span className="sr-only"> {t.enquete.secreto}</span>
      </p>
      {erro && <p role="alert" className="text-sm text-oxblood">{erro}</p>}
    </fieldset>
  );
}
