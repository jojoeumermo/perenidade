// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { useGuardado } from "@/components/estudo/guardado";
import { ConviteDeMatricula, type TextosDoAvisoDeMatricula } from "@/components/escola/formatura/ConviteDeMatricula";
import { SeloDePrivacidade } from "@/components/SeloDePrivacidade";
import { fill, localePath, type Locale } from "@/i18n/config";
import type pt from "@/i18n/escola/matricula/pt.json";
import { lerInscricoes, lerMatricula, type Inscricao, type Matricula } from "@/lib/escola/estudante";
import { dadosDaCarteirinha, type DadosDaCarteirinha } from "@/lib/escola/matricula";
import { site } from "@/lib/site";
import { KEYS, useStored } from "@/lib/storage";
import { BaixarCarteirinha } from "./BaixarCarteirinha";
import "@/styles/escola-matricula.css";

export type TextosDaCarteirinha = (typeof pt)["carteirinha"];
type Comum = (typeof pt)["comum"];

const SEM_LISTA: Inscricao[] = [];

/** O endereço público da entrada da Escola no idioma (o QR leva só para lá: nenhum dado da pessoa vai nele). */
export const enderecoDaEscola = (lang: Locale) => `${site.url}${localePath(lang, "/escola")}`;
/** O endereço sem "https://", para escrever no verso. */
export const enderecoCurto = (lang: Locale) => enderecoDaEscola(lang).replace(/^https?:\/\//, "");

/** O QR da entrada da Escola, gerado no aparelho (biblioteca qrcode, carregada só aqui). */
export function useQrDaEscola(lang: Locale): string | null {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    import("qrcode")
      .then((q) => q.toDataURL(enderecoDaEscola(lang), { errorCorrectionLevel: "M", margin: 1, width: 240, color: { dark: "#1c1712", light: "#ffffff" } }))
      .then((url) => {
        if (vivo) setQr(url);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [lang]);
  return qr;
}

/** A frente: Escola Revolucionária Lúcia Maria, apelido (ou "Estudante"), número, curso, semestre, "Desde AAAA" e a foto ou as iniciais. */
export function FrenteDaCarteirinha({ d, s, foto, rotulada = true }: { d: DadosDaCarteirinha; s: TextosDaCarteirinha; foto: string | null; rotulada?: boolean }) {
  return (
    <div className="certificado carteirinha" role={rotulada ? "group" : undefined} aria-label={rotulada ? s.frente : undefined} data-carteirinha-frente="">
      <div className="certificado-folha">
        <div className="carteirinha-topo">
          <p className="carteirinha-escola">{s.escola}</p>
          <p className="carteirinha-casa">{s.casa}</p>
        </div>
        <div className="carteirinha-corpo">
          <div className="carteirinha-rosto" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {foto ? <img src={foto} alt="" /> : <span>{d.iniciais || "★"}</span>}
          </div>
          <div className="carteirinha-dados">
            <p className="carteirinha-nome">{d.apelido ?? s.estudante}</p>
            <dl className="carteirinha-campos">
              <dt>{s.rotuloNumero}</dt>
              <dd className="carteirinha-numero" data-numero="">
                {d.numero}
              </dd>
              <dt>{s.rotuloCurso}</dt>
              <dd>{d.curso ?? s.semCurso}</dd>
              <dt>{s.rotuloSemestre}</dt>
              <dd>{d.semestre}</dd>
            </dl>
            <p className="carteirinha-rodape">
              {fill(s.desde, { ano: d.desde })} · {s.popular}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** O verso: o aviso de que não é documento nem vale para meia-entrada (em destaque), a lei, o QR e o endereço. */
export function VersoDaCarteirinha({ s, qr, lang, rotulada = true }: { s: TextosDaCarteirinha; qr: string | null; lang: Locale; rotulada?: boolean }) {
  return (
    <div className="certificado carteirinha" role={rotulada ? "group" : undefined} aria-label={rotulada ? s.verso : undefined} data-carteirinha-verso="">
      <div className="certificado-folha">
        <p className="carteirinha-aviso" data-aviso-meia-entrada="">
          {s.avisoNaoDocumento}
        </p>
        <p className="carteirinha-lei">{s.leiNaoVale}</p>
        <div className="carteirinha-qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr ? <img src={qr} alt={s.qrAlt} width={120} height={120} /> : <span className="carteirinha-qr-vazio" style={{ width: "15cqw", height: "15cqw" }} />}
          <p>
            {s.qr}
            <br />
            <span className="carteirinha-endereco">{enderecoCurto(lang)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** AAAA-MM-DD no relógio do aparelho. */
export const diaLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fotoValida = (v: string) => (v.startsWith("data:image/") ? v : null);

/**
 * A página da carteirinha (D1-10): gerada no aparelho e sem servidor, com a matrícula e as inscrições guardadas aqui.
 * O HTML do servidor é neutro (só "abrindo…"); a carteirinha aparece depois de ler o aparelho. Sem matrícula, o aviso
 * único da Escola (o que é a matrícula, o que dá, o que pede e o botão; ConviteDeMatricula).
 */
export function Carteirinha({ s, comum, aviso, titulos, lang }: { s: TextosDaCarteirinha; comum: Comum; aviso: TextosDoAvisoDeMatricula; titulos: Record<string, string>; lang: Locale }) {
  // undefined: ainda não leu o aparelho (servidor e hidratação).
  const [matricula] = useGuardado<Matricula | null | undefined>(lerMatricula, undefined);
  const [inscricoes] = useGuardado<Inscricao[]>(lerInscricoes, SEM_LISTA);
  const avatar = useStored(KEYS.avatar);
  const [usarFoto, setUsarFoto] = useState(true);
  const qr = useQrDaEscola(lang);

  if (matricula === undefined)
    return (
      <p className="mt-8 min-h-64 font-sans text-sm text-ink-soft" aria-busy="true">
        {comum.carregando}
      </p>
    );

  if (matricula === null)
    return (
      <div className="mt-8" data-carteirinha-convite="">
        <ConviteDeMatricula c={aviso} base={localePath(lang, "/escola")} />
      </div>
    );

  // Só chega aqui no navegador (no servidor a matrícula é undefined): a data é a do aparelho.
  const d = dadosDaCarteirinha(matricula, inscricoes, (slug) => titulos[slug] ?? null, diaLocal(new Date()));
  const fotoGuardada = fotoValida(avatar);
  const foto = usarFoto ? fotoGuardada : null;
  return (
    <div className="mt-8" data-carteirinha="">
      <div className="grid gap-5 lg:grid-cols-2">
        <FrenteDaCarteirinha d={d} s={s} foto={foto} />
        <VersoDaCarteirinha s={s} qr={qr} lang={lang} />
      </div>
      {fotoGuardada && (
        <label className="mt-5 flex max-w-xl items-start gap-3 font-sans text-sm">
          <input type="checkbox" checked={usarFoto} onChange={(e) => setUsarFoto(e.target.checked)} className="mt-1 h-5 w-5" />
          <span>
            {s.usarFoto}
            <span className="block text-xs text-ink-soft">{s.usarFotoDica}</span>
          </span>
        </label>
      )}
      <BaixarCarteirinha d={d} s={s} foto={foto} qr={qr} lang={lang} />
      <SeloDePrivacidade tipo="aparelho" lang={lang} className="mt-6" />
    </div>
  );
}
