// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { preencher } from "@/lib/rede/preencher";
import { dataCurta, Recado, useRecado } from "./base";
import { acervo, apagarArquivo, enderecoParaBaixar, enviarArquivo, prepararArquivo, type RecusaDoArquivo } from "./cliente";
import { LIMITE_DO_ARQUIVO, tamanhoEscrito } from "./regras";
import { erroDoAcervo, type TextosDoAcervo } from "./textos";
import type { ListaDeArquivos } from "./tipos";

/**
 * Os arquivos do núcleo (PDF e imagem), só para quem é dele. Antes de enviar, o aparelho tira autor, programa, datas e localização
 * (e o servidor tira de novo); PDF que guarda isso de um jeito que não dá para limpar com certeza é recusado, com o caminho para
 * resolver. Não fica registrado quem enviou: quem enviou desfaz por 15 minutos com o código que só o aparelho dela recebeu; depois,
 * só a mediação apaga.
 */
export function ArquivosDoNucleo({ nucleo, lang, t }: { nucleo: string; lang: string; t: TextosDoAcervo }) {
  const id = useId();
  const [lista, setLista] = useState<ListaDeArquivos | null>(null);
  const [erro, setErro] = useState("");
  const [versao, setVersao] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [nome, setNome] = useState("");
  const [escolhido, setEscolhido] = useState<File | null>(null);
  // Os códigos de desfazer dos envios desta aba (só na memória: some ao fechar).
  const [desfazer, setDesfazer] = useState<Record<string, { codigo: string; ate: number }>>({});
  const [agora, setAgora] = useState(() => Date.now());
  const entrada = useRef<HTMLInputElement>(null);
  const { recado, mostrar } = useRecado();

  useEffect(() => {
    let vivo = true;
    acervo
      .arquivos(nucleo)
      .then((r) => vivo && (setLista(r), setErro("")))
      .catch((e) => vivo && setErro(erroDoAcervo(t, e)));
    return () => {
      vivo = false;
    };
  }, [nucleo, versao, t]);
  useEffect(() => {
    if (!Object.keys(desfazer).length) return;
    const relogio = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(relogio);
  }, [desfazer]);

  const recusa = (m: RecusaDoArquivo) =>
    m === "grande" ? preencher(t.arquivos.grande, { n: tamanhoEscrito(LIMITE_DO_ARQUIVO, lang) }) : m === "pdf_comprimido" ? t.arquivos.pdfComprimido : m === "pdf_programa" ? t.arquivos.pdfPrograma : t.arquivos.tipo;

  async function enviar() {
    if (!escolhido) return;
    setOcupado(true);
    try {
      const pronto = await prepararArquivo(escolhido);
      if (!pronto.ok) return mostrar(recusa(pronto.motivo), true);
      const r = await enviarArquivo(nucleo, (nome.trim() || escolhido.name).slice(0, 120), pronto.bytes);
      setDesfazer((d) => ({ ...d, [r.arquivo.id]: { codigo: r.desfazer, ate: Date.now() + 15 * 60_000 } }));
      setEscolhido(null);
      setNome("");
      if (entrada.current) entrada.current.value = "";
      mostrar(t.arquivos.enviado);
      setVersao((v) => v + 1);
    } catch (e) {
      mostrar(erroDoAcervo(t, e), true);
    } finally {
      setOcupado(false);
    }
  }

  async function apagar(arquivoId: string, codigo: string | null) {
    if (!codigo && !window.confirm(t.arquivos.confirmarApagar)) return;
    setOcupado(true);
    try {
      await apagarArquivo(arquivoId, codigo);
      setDesfazer((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== arquivoId)));
      mostrar(codigo ? t.arquivos.desfeito : t.arquivos.apagado);
      setVersao((v) => v + 1);
    } catch (e) {
      mostrar(erroDoAcervo(t, e), true);
    } finally {
      setOcupado(false);
    }
  }

  async function baixar(arquivoId: string) {
    const a = lista?.itens.find((x) => x.id === arquivoId);
    if (!a) return;
    try {
      window.location.assign(await enderecoParaBaixar(a));
    } catch (e) {
      mostrar(erroDoAcervo(t, e), true);
    }
  }

  const uso = lista ? Math.min(100, Math.round((Number(lista.usado) / Math.max(1, Number(lista.cota))) * 100)) : 0;
  return (
    <section className="acv-nucleo" aria-labelledby={`${id}-t`} aria-busy={ocupado}>
      <h2 id={`${id}-t`} className="acv-cond">{t.arquivos.titulo}</h2>
      <p className="acv-intro">{t.arquivos.intro}</p>
      <Recado recado={recado} />
      {erro && <p role="alert" className="acv-aviso">{erro}</p>}
      {lista && (
        <>
          <p className="acv-dica" style={{ marginTop: "0.6rem" }}>
            {preencher(t.arquivos.uso, { usado: tamanhoEscrito(Number(lista.usado), lang), cota: tamanhoEscrito(Number(lista.cota), lang) })} · {preencher(t.arquivos.limite, { n: tamanhoEscrito(Number(lista.por_arquivo), lang) })}
          </p>
          <div className="acv-uso" role="presentation">
            <span style={{ width: `${uso}%` }} />
          </div>
        </>
      )}
      <form
        className="acv-form"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        <span className="acv-rotulo" id={`${id}-fr`}>{t.arquivos.escolher}</span>
        {/* O campo de arquivo do navegador fica escondido (continua no Tab e no leitor de tela); o rótulo faz o papel de botão. */}
        <div className="acv-arquivo">
          <input
            ref={entrada}
            id={`${id}-f`}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-labelledby={`${id}-fr ${id}-fb`}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setEscolhido(f);
              if (f && !nome) setNome(f.name.slice(0, 120));
            }}
          />
          <label htmlFor={`${id}-f`} id={`${id}-fb`} className="acv-botao">{t.arquivos.escolherBotao}</label>
          <span className="acv-dica acv-arquivo-nome">{escolhido ? escolhido.name : t.arquivos.nenhum}</span>
        </div>
        <label className="acv-rotulo" htmlFor={`${id}-n`}>{t.arquivos.nomeRotulo}</label>
        <input id={`${id}-n`} className="acv-campo" maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} />
        <div className="acv-botoes">
          <button type="submit" className="acv-botao" data-cheio="" disabled={ocupado || !escolhido}>{ocupado ? t.arquivos.enviando : t.arquivos.escolher}</button>
        </div>
      </form>
      {!lista ? (
        !erro && <p role="status" className="acv-dica">{t.comum.carregando}</p>
      ) : lista.itens.length === 0 ? (
        <p className="acv-dica">{t.arquivos.vazio}</p>
      ) : (
        <ul className="acv-lista">
          {lista.itens.map((a) => {
            const meu = desfazer[a.id] && desfazer[a.id].ate > agora ? desfazer[a.id] : null;
            return (
              <li key={a.id} className="acv-linha">
                <span className="acv-tipo" data-ext={a.ext} aria-hidden>{a.ext}</span>
                <span className="acv-linha-nome">
                  <strong>{a.nome}</strong>
                  <small>{a.ext.toUpperCase()} · {tamanhoEscrito(a.tamanho, lang)} · {dataCurta(lang, a.criado_em)}</small>
                </span>
                <span className="acv-item-acoes">
                  <button type="button" className="acv-botao" data-pequeno="" onClick={() => void baixar(a.id)} aria-label={`${t.arquivos.baixar}: ${a.nome}`}>{t.arquivos.baixar}</button>
                  {meu && (
                    <button type="button" className="acv-botao" data-pequeno="" disabled={ocupado} onClick={() => void apagar(a.id, meu.codigo)}>{t.arquivos.desfazer}</button>
                  )}
                  {lista.media && !meu && (
                    <button type="button" className="acv-botao" data-pequeno="" disabled={ocupado} onClick={() => void apagar(a.id, null)} aria-label={`${t.arquivos.apagar}: ${a.nome}`}>{t.arquivos.apagar}</button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {!lista?.media && <p className="acv-regra">{t.arquivos.soMediacao}</p>}
    </section>
  );
}
