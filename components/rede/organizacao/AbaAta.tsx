// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 67. Ata assistida: o áudio da reunião é transcrito NO APARELHO (o mesmo reconhecimento local das legendas, lib/rede/midia/reconhecer.ts:
// só quando o navegador garante o modo local e já tem o idioma; nada de serviço de fora) e vira um rascunho de ata para revisar. Nada vai
// ao banco nem a terceiros: o arquivo de áudio não sai do aparelho e o rascunho só sai se a pessoa baixar ou copiar. O mesmo limite do
// item 21: sem o modo local, a opção de transcrever não aparece (dá para escrever a ata à mão no mesmo modelo).
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { mostrarParaCopiar } from "@/components/perguntar";
import { ditadoNoAparelho, ditarAudio } from "@/lib/rede/midia/reconhecer";
import { rascunhoDeAta } from "@/lib/rede/organizacao/regras";
import { baixarArquivo } from "../alcance/usar";
import { Botao } from "../ui/Botao";
import type { PropsDaAbaSolta } from "./TelaDaOrganizacao";

export function AbaAta({ t, lang }: PropsDaAbaSolta) {
  const [pode, setPode] = useState<boolean | null>(null);
  const [fala, setFala] = useState("");
  const [ouvindo, setOuvindo] = useState(false);
  const [ata, setAta] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const parar = useRef<(() => void) | null>(null);
  const url = useRef<string | null>(null);
  const id = useId();
  const a = t.ata;

  useEffect(() => {
    let vivo = true;
    void ditadoNoAparelho(lang).then((sim) => vivo && setPode(sim));
    return () => {
      vivo = false;
      parar.current?.();
      if (url.current) URL.revokeObjectURL(url.current);
    };
  }, [lang]);

  function escolher(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    parar.current?.();
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = URL.createObjectURL(arquivo);
    setFala("");
    setOuvindo(true);
    setAviso(a.ouvindo);
    parar.current = ditarAudio(url.current, lang, (texto) => setFala(texto), (erro) => {
      setOuvindo(false);
      setAviso(erro ? a.semDitado : a.pronto);
    });
  }

  function montar(titulo: string, pauta: string) {
    setAta(rascunhoDeAta(fala, {
      titulo: titulo || a.semTitulo, pauta,
      data: new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date()),
      rotulos: a.rotulos,
    }));
  }

  return (
    <section className="or-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="or-subtitulo">{a.titulo}</h2>
      <p className="or-miudo">{a.sobre}</p>
      {pode === false && <p className="or-miudo" role="note">{a.semModoLocal}</p>}
      <form className="or-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); montar(String(f.get("titulo") ?? ""), String(f.get("pauta") ?? "")); }} aria-label={a.titulo}>
        <label>{t.comum.titulo}<input type="text" name="titulo" maxLength={120} /></label>
        <label>{a.pauta} {t.comum.opcional}<textarea name="pauta" maxLength={1000} /></label>
        {pode && <label>{a.audio}<input type="file" accept="audio/*" onChange={escolher} disabled={ouvindo} /></label>}
        {aviso && <p className="or-miudo" role="status">{aviso}</p>}
        {ouvindo && <div className="or-acoes"><Botao type="button" variante="fantasma" onClick={() => { parar.current?.(); setOuvindo(false); }}>{a.parar}</Botao></div>}
        <label>{a.fala}<textarea value={fala} onChange={(e) => setFala(e.target.value)} placeholder={a.falaAMao} /></label>
        <div className="or-acoes"><Botao type="submit">{a.montar}</Botao></div>
      </form>
      {ata && (
        <div className="or-form">
          <label htmlFor={`${id}-ata`}>{a.rascunho}</label>
          <textarea id={`${id}-ata`} value={ata} onChange={(e) => setAta(e.target.value)} style={{ minHeight: "16rem" }} />
          <div className="or-acoes">
            <Botao variante="contorno" onClick={() => baixarArquivo(new Blob([ata], { type: "text/plain;charset=utf-8" }), "ata.txt")}>{a.baixar}</Botao>
            <Botao variante="fantasma" onClick={() => void mostrarParaCopiar(a.rascunho, ata)}>{a.copiar}</Botao>
          </div>
          <p className="or-miudo">{a.revise}</p>
        </div>
      )}
    </section>
  );
}
