// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { BackendError } from "@/lib/backend";
import { meusDados, type SituacaoDeMeusDados } from "@/lib/rede/meusdados/cliente";
import { carregarTextosDeMeusDados, encher, type TextosDeMeusDados } from "@/lib/rede/meusdados/textos";
import type { PropsDaTelaDoPacote } from "../registro";
import { Botao } from "../ui/Botao";
import { Faixa } from "../ui/Faixa";
import { Flaps } from "../ui/Flaps";
import { EsqueletoDosAjustes } from "../Esqueletos";
import { Icone } from "../publicar/alumia2/icones";
import { PedidoDeCodigo } from "./PedidoDeCodigo";
import "./meusdados.css";

/** O código confirmado vale 10 minutos no banco; a tela pede de novo depois de 9 (folga para o relógio do aparelho). */
const FATOR_VALE_MS = 9 * 60_000;

const codigoDe = (erro: unknown) => (erro instanceof BackendError ? erro.code : "");

function useTextos(lang: string) {
  const [t, setT] = useState<TextosDeMeusDados | null>(null);
  useEffect(() => {
    let vivo = true;
    void carregarTextosDeMeusDados(lang).then((x) => vivo && setT(x));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return t;
}

/** Os ladrilhos do cartão da cópia: o arquivo como um pedaço do mosaico (cada cor, uma parte do que vai junto). */
function LadrilhosDaCopia() {
  const cores = ["v", "1", "d", "4", "2", "p", "3", "v", "5", "d", "1", "p"];
  return (
    <span className="md-ladrilhos" aria-hidden>
      {cores.map((c, i) => (
        <span key={i} data-cor={c} style={{ animationDelay: `${i * 45}ms` }} />
      ))}
    </span>
  );
}

/**
 * Meus dados (/alumia/meus-dados): baixar uma cópia de tudo o que é da pessoa, sair só da Alumia (a conta do Instituto fica) e
 * apagar a conta, as duas últimas com o prazo de arrependimento. Pedem o código do aplicativo autenticador digitado agora. Os
 * cartões ficam lado a lado quando a coluna tem 780 px ou mais; na coluna do meio da casca (computador) e no celular, um embaixo
 * do outro. Com um pedido em andamento, só o cartão dele aparece (com o prazo e o desistir).
 */
export default function TelaMeusDados({ lang }: PropsDaTelaDoPacote) {
  const t = useTextos(lang);
  const id = useId();
  const [sit, setSit] = useState<SituacaoDeMeusDados | null>(null);
  const [erroGeral, setErroGeral] = useState("");
  // Quando o código do aplicativo foi confirmado nesta tela (0 = não está fresco).
  const fatorRef = useRef(0);
  const fator = useMemo<Fator>(
    () => ({
      fresco: () => Date.now() - fatorRef.current < FATOR_VALE_MS,
      marcar: (ok) => {
        fatorRef.current = ok ? Date.now() : 0;
      },
    }),
    [],
  );

  const ler = useCallback(() => {
    meusDados.situacao().then(
      (s) => {
        setSit(s);
        if (s.fator_recente) fator.marcar(true);
      },
      (e: unknown) => setErroGeral(codigoDe(e)),
    );
  }, [fator]);
  useEffect(ler, [ler]);
  const tentarDeNovo = () => {
    setErroGeral("");
    ler();
  };

  if (!t || (!sit && !erroGeral)) return <EsqueletoDosAjustes rotulo={t?.carregando ?? ""} quantos={2} />;

  return (
    <article className="md-pagina" aria-labelledby={`${id}-titulo`}>
      <header className="md-cabeca">
        <Faixa className="md-faixa" />
        <h1 id={`${id}-titulo`} className="md-titulo al-cond">{t.titulo}</h1>
        <p className="md-chamada">{t.chamada}</p>
      </header>
      {!sit ? (
        <div className="md-erro-geral">
          <p className="md-erro" role="alert">{erroGeral === "sem_servico" ? t.erros.semServico : t.erros.falha}</p>
          {erroGeral !== "sem_servico" && <Botao variante="claro" tamanho="m" onClick={tentarDeNovo}>{t.erros.tentar}</Botao>}
        </div>
      ) : (
        <div className="md-grade">
          <CartaoDaCopia t={t} lang={lang} sit={sit} fator={fator} aoMudar={ler} />
          {(!sit.apagamento || sit.apagamento.so_alumia) && <CartaoDoApagar t={t} lang={lang} sit={sit} fator={fator} aoMudar={ler} modo="sair" />}
          {(!sit.apagamento || !sit.apagamento.so_alumia) && <CartaoDoApagar t={t} lang={lang} sit={sit} fator={fator} aoMudar={ler} modo="apagar" />}
        </div>
      )}
    </article>
  );
}

/** O código do aplicativo confirmado há pouco: `fresco` diz se ainda vale; `marcar` grava (ou esquece) a confirmação. */
interface Fator {
  fresco: () => boolean;
  marcar: (ok: boolean) => void;
}

interface PropsDoCartao {
  t: TextosDeMeusDados;
  lang: string;
  sit: SituacaoDeMeusDados;
  fator: Fator;
  aoMudar: () => void;
}

/** A hora de agora, só depois de montar no navegador (o servidor não sabe a hora da pessoa), a cada minuto e quando `chave` muda. */
function useAgora(chave: unknown): number | null {
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => {
    const tique = () => setAgora(Date.now());
    const primeiro = window.setTimeout(tique, 0);
    const relogio = window.setInterval(tique, 60_000);
    return () => {
      window.clearTimeout(primeiro);
      window.clearInterval(relogio);
    };
  }, [chave]);
  return agora;
}

function CartaoDaCopia({ t, lang, sit, fator, aoMudar }: PropsDoCartao) {
  const id = useId();
  const [passo, setPasso] = useState<"inicio" | "codigo" | "montando">("inicio");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function baixar() {
    setPasso("montando");
    setAviso(null);
    try {
      const r = await meusDados.baixar(lang);
      const textos = [encher(t.exportar.pronto, { nome: r.nome })];
      if (r.links > 0) textos.push(encher(t.exportar.linksTemporarios, { horas: 1 }));
      setAviso({ tipo: "ok", texto: textos.join(" ") });
      aoMudar();
    } catch (e) {
      const c = codigoDe(e);
      if (c === "confirme_segundo_fator") {
        fator.marcar(false);
        setPasso("codigo");
        return;
      }
      setAviso({ tipo: "erro", texto: c === "muitos_pedidos" ? t.exportar.jaHoje : c === "sem_servico" ? t.erros.semServico : t.erros.falha });
    }
    setPasso("inicio");
  }

  const comecar = () => (fator.fresco() ? void baixar() : setPasso("codigo"));
  const itens = [t.exportar.itens.escrito, t.exportar.itens.perfil, t.exportar.itens.arquivos, t.exportar.itens.aparelho];

  return (
    <section className="md-cartao md-cartao-copia" aria-labelledby={`${id}-t`}>
      <div className="md-cartao-topo">
        <LadrilhosDaCopia />
        <div>
          <p className="md-rotulo al-cond">{t.exportar.rotulo}</p>
          <h2 id={`${id}-t`} className="md-cartao-titulo al-cond">{t.exportar.titulo}</h2>
        </div>
      </div>
      <p className="md-texto">{t.exportar.texto}</p>
      <ul className="md-itens">
        {itens.map((item, i) => (
          <li key={i}>
            <span className="md-item-ladrilho" data-cor={["v", "d", "1", "4"][i]} aria-hidden />
            {item}
          </li>
        ))}
      </ul>
      <p className="md-nota" data-tom="ouro">
        <span className="md-nota-numero" aria-hidden>
          <Icone nome="cadeado" className="h-6 w-6" />
        </span>
        <span>{t.exportar.terceiros}</span>
      </p>
      <p className="md-miudo">{t.exportar.regra}</p>
      <div className="md-rodape" aria-live="polite">
        {passo === "codigo" ? (
          <PedidoDeCodigo
            t={t}
            aoVoltar={() => setPasso("inicio")}
            aoConfirmar={() => {
              fator.marcar(true);
              void baixar();
            }}
          />
        ) : sit.exportou_hoje && aviso?.tipo !== "ok" ? (
          <p className="md-feito">{t.exportar.jaHoje}</p>
        ) : (
          <>
            {aviso ? (
              <p className={aviso.tipo === "ok" ? "md-feito" : "md-erro"} role={aviso.tipo === "erro" ? "alert" : undefined}>
                {aviso.texto}
              </p>
            ) : null}
            {aviso?.tipo !== "ok" ? (
              <Botao variante="claro" tamanho="g" onClick={comecar} disabled={passo === "montando"} aria-busy={passo === "montando" || undefined}>
                {passo === "montando" ? t.exportar.montando : t.exportar.botao}
              </Botao>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

/**
 * O cartão de sair: `modo` "sair" tira a pessoa só da Alumia (rede_meusdados_sair; a conta do Instituto fica) e "apagar" apaga a
 * conta inteira (rede_meusdados_apagar). O mesmo caminho nos dois: a palavra, o código do aplicativo, o prazo e o desistir.
 */
function CartaoDoApagar({ t: tudo, lang, sit, fator, aoMudar, modo }: PropsDoCartao & { modo: "sair" | "apagar" }) {
  const sair = modo === "sair";
  // Os textos da saída por cima dos do apagamento (o que é igual nos dois, como o prazo e a palavra, vem do apagamento).
  const t = { ...tudo, apagar: sair ? { ...tudo.apagar, ...tudo.sair, passos: tudo.sair.passos } : tudo.apagar };
  const agora = useAgora(sit.apagamento?.apagar_em);
  const id = useId();
  const [palavra, setPalavra] = useState("");
  const [passo, setPasso] = useState<"inicio" | "codigo" | "enviando">("inicio");
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");
  const confere = palavra.trim().toLowerCase() === sit.palavra.toLowerCase();

  async function apagar() {
    setPasso("enviando");
    setErro("");
    try {
      await (sair ? meusDados.sair(palavra.trim()) : meusDados.apagar(palavra.trim()));
      setPalavra("");
      aoMudar();
    } catch (e) {
      const c = codigoDe(e);
      if (c === "confirme_segundo_fator") {
        fator.marcar(false);
        setPasso("codigo");
        return;
      }
      setErro(c === "confirmacao_errada" ? encher(t.erros.palavra, { palavra: sit.palavra }) : c === "tem_funcao" ? t.apagar.funcao : c === "sem_servico" ? t.erros.semServico : t.erros.falha);
    }
    setPasso("inicio");
  }

  async function cancelar() {
    setPasso("enviando");
    setErro("");
    try {
      const r = await meusDados.cancelar();
      setFeito(r.fediverso_desligado ? `${t.apagar.cancelado} ${t.apagar.canceladoFediverso}` : t.apagar.cancelado);
      aoMudar();
    } catch (e) {
      setErro(codigoDe(e) === "prazo_passou" ? t.erros.prazoPassou : t.erros.falha);
    }
    setPasso("inicio");
  }

  if (sit.apagamento) {
    const ate = new Date(sit.apagamento.apagar_em);
    const dias = agora === null ? null : Math.floor((ate.getTime() - agora) / 86_400_000);
    const falta = dias === null ? "" : dias >= 2 ? encher(t.apagar.faltam, { n: dias }) : dias === 1 ? t.apagar.faltaUm : t.apagar.faltaPouco;
    const quando = ate.toLocaleString(lang, { dateStyle: "long", timeStyle: "short" });
    return (
      <section className={`md-cartao ${sair ? "md-cartao-sair" : "md-cartao-apagar"}`} data-marcado="" aria-labelledby={`${id}-t`}>
        <span className="al-carimbo al-cond md-carimbo">{t.apagar.marcado}</span>
        <h2 id={`${id}-t`} className="md-cartao-titulo al-cond">{t.apagar.titulo}</h2>
        <p className="md-texto md-forte">{encher(t.apagar.marcadoTexto, { quando })}</p>
        <div className="md-contagem">
          <Flaps ate={ate} agoraTexto="0" rotulo={() => falta} />
          <p className="md-miudo">{falta}</p>
        </div>
        <p className="md-miudo">{t.apagar.noPrazo}</p>
        <div className="md-rodape" aria-live="polite">
          {erro ? <p className="md-erro" role="alert">{erro}</p> : null}
          <Botao variante="claro" tamanho="g" onClick={() => void cancelar()} disabled={passo === "enviando"} aria-busy={passo === "enviando" || undefined}>
            {t.apagar.cancelar}
          </Botao>
        </div>
      </section>
    );
  }

  const passos = [t.apagar.passos.agora, encher(t.apagar.passos.prazo, { dias: 7 }), t.apagar.passos.fim];
  return (
    <section className={`md-cartao ${sair ? "md-cartao-sair" : "md-cartao-apagar"}`} aria-labelledby={`${id}-t`}>
      <p className="md-rotulo al-cond">{t.apagar.rotulo}</p>
      <h2 id={`${id}-t`} className="md-cartao-titulo al-cond">{t.apagar.titulo}</h2>
      <p className="md-texto md-forte">{t.apagar.texto}</p>
      <ol className="md-passos">
        {passos.map((p, i) => (
          <li key={i}>
            <span className="md-passo-numero al-cond" aria-hidden>{i + 1}</span>
            <span>{p}</span>
          </li>
        ))}
      </ol>
      <p className="md-miudo">{t.apagar.outras}</p>
      <p className="md-miudo">{sair ? tudo.sair.ficam : t.apagar.registro}</p>
      <div className="md-rodape" aria-live="polite">
        {feito ? <p className="md-feito">{feito}</p> : null}
        {(sair ? sit.admin_alumia : sit.tem_funcao) ? (
          <p className="md-nota">{t.apagar.funcao}</p>
        ) : passo === "codigo" ? (
          <PedidoDeCodigo
            t={t}
            perigo
            aoVoltar={() => setPasso("inicio")}
            aoConfirmar={() => {
              fator.marcar(true);
              void apagar();
            }}
          />
        ) : (
          <form
            className="md-confirmar"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!confere) return setErro(encher(t.erros.palavra, { palavra: sit.palavra }));
              if (fator.fresco()) void apagar();
              else setPasso("codigo");
            }}
          >
            <p className="md-baixe-antes">{t.apagar.baixeAntes}</p>
            <label className="md-campo-rotulo" htmlFor={`${id}-p`}>
              {encher(t.apagar.palavraRotulo, { palavra: "" })}
              <span className="md-palavra">{sit.palavra}</span>
            </label>
            <input
              id={`${id}-p`}
              className="md-campo"
              value={palavra}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-describedby={`${id}-d${erro ? ` ${id}-e` : ""}`}
              aria-invalid={erro && !confere ? true : undefined}
              onChange={(e) => {
                setPalavra(e.target.value);
                setErro("");
              }}
            />
            <p className="md-dica" id={`${id}-d`}>{t.apagar.palavraDica}</p>
            {erro ? (
              <p className="md-erro" id={`${id}-e`} role="alert">
                {erro}
              </p>
            ) : null}
            <Botao type="submit" variante={sair ? "claro" : "primario"} tamanho="g" disabled={!confere || passo === "enviando"} aria-busy={passo === "enviando" || undefined}>
              {t.apagar.botao}
            </Botao>
          </form>
        )}
      </div>
    </section>
  );
}
