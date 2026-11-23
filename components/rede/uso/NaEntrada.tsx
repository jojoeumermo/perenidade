// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As peças do R1 no cartão da entrada da Alumia (components/rede/entrada/), a primeira coisa que quem entra no beta vê:
//   - SituacaoDoPedido: onde o pedido está, em quatro passos claros (na fila, em análise, aprovado, recusado), sem dizer quem
//     analisa. "Na fila" e "em análise" vêm do banco (public.alumia_entrada_eu, campo "etapa"), que guarda só se a ficha já foi
//     vista, nunca por quem nem quando;
//   - PerdiOAplicativo: o caminho óbvio de "perdi o celular do aplicativo" pelos códigos de recuperação, com o que fazer sem eles;
//   - CodigosNaEntrada: logo depois de cadastrar o aplicativo, os dez códigos aparecem (uma vez), para o "perdi o celular" ter
//     saída desde o primeiro dia.
import { useId, useState } from "react";
import { hasBackend } from "@/lib/backend";
import { contaSegura } from "@/lib/rede/seguranca/cliente";
import { arquivoDosCodigos } from "@/lib/rede/seguranca/codigos";
import { useTextosDaSeguranca } from "../seguranca/base";
import { etapaDe, passosDoPedido, type EtapaDoPedido } from "./etapa";
import { useTextosDoUso } from "./textos";

export { etapaDe, type EtapaDoPedido };
import "./uso.css";

export function SituacaoDoPedido({ lang, etapa }: { lang: string; etapa: EtapaDoPedido }) {
  const t = useTextosDoUso(lang);
  const id = useId();
  if (!t) return null;
  return (
    <section aria-labelledby={`${id}-t`} className="al-uso-bloco" style={{ marginTop: 0 }}>
      <h3 id={`${id}-t`} className="al-uso-rotulo">{t.entrada.situacaoTitulo}</h3>
      <ol className="al-situacao">
        {passosDoPedido(etapa).map((p) => (
          <li key={p.nome} data-e={p.estado} aria-current={p.estado === "agora" ? "step" : undefined}>
            {t.entrada.passos[p.nome]}
            {p.estado === "agora" ? <span className="al-situacao-agora"> · {t.entrada.atual}</span> : null}
          </li>
        ))}
      </ol>
      <p className="al-uso-texto">{t.entrada.explica[etapa]}</p>
      <p className="al-uso-miudo">{t.entrada.quem}</p>
    </section>
  );
}

/** "Perdeu o celular do aplicativo?": o botão grande para o código de recuperação e, sem os códigos, o caminho pela ajuda. */
export function PerdiOAplicativo({ lang, aoAbrir }: { lang: string; aoAbrir: () => void }) {
  const t = useTextosDoUso(lang);
  const id = useId();
  if (!t) return null;
  return (
    <section aria-labelledby={`${id}-t`} className="al-uso-bloco">
      <h3 id={`${id}-t`} className="al-uso-titulo">{t.fator.perdiTitulo}</h3>
      <p className="al-uso-texto">{t.fator.perdiTexto}</p>
      <div className="al-uso-acoes">
        <button type="button" className="ale-botao ale-botao-contorno" onClick={aoAbrir}>
          {t.fator.perdiBotao}
        </button>
      </div>
      <p className="al-uso-miudo">
        {t.fator.semCodigos}{" "}
        <a className="al-uso-link" href={`/${lang}/alumia/ajuda`}>
          {t.fator.ajuda}
        </a>
      </p>
    </section>
  );
}

/**
 * Os códigos de recuperação logo depois de cadastrar o aplicativo. "Mostrar os meus códigos" gera os dez (a sessão já é aal2:
 * o banco confere) e mostra uma vez, com Baixar e Copiar. "Fazer isso depois" segue para a Alumia com o aviso do que se perde.
 */
export function CodigosNaEntrada({ lang, aoPronto }: { lang: string; aoPronto: () => void }) {
  const t = useTextosDoUso(lang);
  const ts = useTextosDaSeguranca(lang);
  const id = useId();
  const [codigos, setCodigos] = useState<string[] | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [nota, setNota] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [adiando, setAdiando] = useState(false);
  if (!t || !ts) return null;

  async function gerar() {
    if (!t) return;
    setOcupado(true);
    setNota(null);
    try {
      setCodigos(await contaSegura.gerarCodigos());
    } catch {
      setNota({ texto: t.fator.falhou, erro: true });
    } finally {
      setOcupado(false);
    }
  }

  function baixar() {
    if (!codigos || !ts) return;
    const texto = arquivoDosCodigos(codigos, ts.codigos.arquivo, new Intl.DateTimeFormat(lang, { dateStyle: "long" }).format(new Date()));
    const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "alumia-codigos-de-recuperacao.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copiar() {
    if (!codigos || !t) return;
    try {
      await navigator.clipboard.writeText(codigos.join("\n"));
      setNota({ texto: t.fator.copiados });
    } catch {
      setNota({ texto: t.falar.erros.falha, erro: true });
    }
  }

  return (
    <section aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} tabIndex={-1} data-ale-foco="" className="ale-cond ale-cartao-titulo">
        {t.fator.codigosTitulo}
      </h2>
      <p className="ale-cartao-texto">{t.fator.codigosTexto}</p>
      {codigos ? (
        <>
          <ol className="al-codigos-lista" aria-label={t.fator.codigosTitulo}>
            {codigos.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ol>
          {!hasBackend ? <p className="al-uso-miudo">{t.fator.exemplo}</p> : null}
          <div className="al-uso-acoes">
            <button type="button" className="ale-botao ale-botao-contorno" onClick={baixar}>
              {t.fator.baixar}
            </button>
            <button type="button" className="ale-botao ale-botao-contorno" onClick={() => void copiar()}>
              {t.fator.copiar}
            </button>
          </div>
          <div className="al-uso-acoes">
            <button type="button" className="ale-botao ale-botao-principal" onClick={aoPronto}>
              {t.fator.guardei}
            </button>
          </div>
        </>
      ) : (
        <div className="al-uso-acoes">
          <button type="button" className="ale-botao ale-botao-principal" disabled={ocupado} aria-busy={ocupado || undefined} onClick={() => void gerar()}>
            {ocupado ? t.fator.gerando : t.fator.gerar}
          </button>
          {adiando ? (
            <button type="button" className="ale-botao ale-botao-contorno" onClick={aoPronto}>
              {t.fator.depois}
            </button>
          ) : (
            <button type="button" className="ale-link" onClick={() => setAdiando(true)}>
              {t.fator.depois}
            </button>
          )}
        </div>
      )}
      {adiando && !codigos ? <p className="al-uso-erro" role="status">{t.fator.depoisAviso}</p> : null}
      {nota ? (
        <p role={nota.erro ? "alert" : "status"} className={nota.erro ? "al-uso-erro" : "al-uso-nota"}>
          {nota.texto}
        </p>
      ) : null}
    </section>
  );
}
