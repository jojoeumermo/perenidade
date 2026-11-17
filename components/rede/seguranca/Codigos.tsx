// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useState } from "react";
import { contaSegura, type SituacaoDaConta } from "@/lib/rede/seguranca/cliente";
import { arquivoDosCodigos } from "@/lib/rede/seguranca/codigos";
import { Icone } from "../publicar/alumia2/icones";
import { Botao } from "../ui/Botao";
import { dataLegivel, por, textoDoErro, type T } from "./base";

/**
 * Os códigos de recuperação do segundo fator (os mesmos de Minha conta: um jogo só por conta). Gerar pede o código do aplicativo
 * nesta sessão (o banco confere) e, havendo códigos, uma confirmação: os antigos deixam de valer. Os novos aparecem UMA vez, com
 * "Baixar em texto" e "Copiar"; o banco guarda só o resumo bcrypt.
 */
export function Codigos({ t, lang, situacao, aoGerar }: { t: T; lang: string; situacao: SituacaoDaConta; aoGerar: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [codigos, setCodigos] = useState<string[] | null>(null);
  const [nota, setNota] = useState<{ texto: string; erro?: boolean } | null>(null);
  const id = useId();
  const tem = situacao.codigos_restantes > 0;

  async function gerar() {
    setOcupado(true);
    setNota(null);
    try {
      setCodigos(await contaSegura.gerarCodigos());
      setConfirmando(false);
      aoGerar();
    } catch (e) {
      setNota({ texto: textoDoErro(t, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  function baixar() {
    if (!codigos) return;
    const texto = arquivoDosCodigos(codigos, t.codigos.arquivo, new Intl.DateTimeFormat(lang, { dateStyle: "long" }).format(new Date()));
    const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "alumia-codigos-de-recuperacao.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copiar() {
    if (!codigos) return;
    try {
      await navigator.clipboard.writeText(codigos.join("\n"));
      setNota({ texto: t.codigos.copiados });
    } catch {
      setNota({ texto: t.erros.falha, erro: true });
    }
  }

  return (
    <section className="sg-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="sg-titulo al-cond">{t.codigos.titulo}</h2>
      <p className="sg-texto">{t.codigos.texto}</p>

      {codigos ? (
        <div className="sg-codigos-novos">
          <p className="sg-subtitulo">{t.codigos.mostrarTitulo}</p>
          <p className="sg-cinza">{t.codigos.mostrarTexto}</p>
          <ol className="sg-codigos" aria-label={t.codigos.mostrarTitulo}>
            {codigos.map((c, i) => (
              <li key={c}>
                <span className="sg-codigo-n" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                <code>{c}</code>
              </li>
            ))}
          </ol>
          <div className="sg-acoes">
            <Botao variante="claro" tamanho="m" icone={<Icone nome="setaCima" className="h-4 w-4 rotate-180" />} onClick={baixar}>{t.codigos.baixar}</Botao>
            <Botao variante="contorno" tamanho="m" onClick={() => void copiar()}>{t.codigos.copiar}</Botao>
            <Botao variante="fantasma" tamanho="m" onClick={() => { setCodigos(null); setNota(null); }}>{t.codigos.pronto}</Botao>
          </div>
        </div>
      ) : !situacao.segundo_fator ? (
        <p className="sg-cinza">{t.codigos.precisaFator}</p>
      ) : (
        <>
          <div className="sg-medidor" aria-hidden>
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className="sg-medidor-casa" data-cheia={i < situacao.codigos_restantes || undefined} />
            ))}
          </div>
          <p className="sg-situacao">
            <strong>{tem ? por(t.codigos.restantes, { n: situacao.codigos_restantes }) : t.codigos.nenhum}</strong>
            {situacao.codigos_gerados_em && tem && <span className="sg-cinza"> · {por(t.codigos.geradosEm, { quando: dataLegivel(lang, situacao.codigos_gerados_em) })}</span>}
          </p>
          {confirmando ? (
            <div className="sg-confirma" role="group" aria-label={t.codigos.gerarDeNovo}>
              <p>{t.codigos.deNovoAviso}</p>
              <div className="sg-acoes">
                <Botao variante="primario" tamanho="m" disabled={ocupado} aria-busy={ocupado || undefined} onClick={() => void gerar()}>{t.codigos.confirmarGerar}</Botao>
                <Botao variante="fantasma" tamanho="m" onClick={() => setConfirmando(false)}>{t.codigos.cancelar}</Botao>
              </div>
            </div>
          ) : (
            <div className="sg-acoes">
              <Botao variante={tem ? "contorno" : "primario"} tamanho="m" disabled={ocupado} aria-busy={ocupado || undefined} onClick={() => (tem ? setConfirmando(true) : void gerar())}>
                {tem ? t.codigos.gerarDeNovo : t.codigos.gerar}
              </Botao>
            </div>
          )}
        </>
      )}
      {nota && <p role="status" className={nota.erro ? "sg-nota sg-nota-erro" : "sg-nota"}>{nota.texto}</p>}
    </section>
  );
}
