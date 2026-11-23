// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "@/components/Link";
import { contaSegura, type SituacaoDaConta } from "@/lib/rede/seguranca/cliente";
import { ENCAIXES } from "../encaixes";
import { EsqueletoDosAjustes } from "../Esqueletos";
import { Icone } from "../publicar/alumia2/icones";
import type { PropsDaTelaDoPacote } from "../registro";
import { Botao } from "../ui/Botao";
import { dataLegivel, Ladrilhos, por, textoDoErro, useTextosDaSeguranca, type T } from "./base";
import { Codigos } from "./Codigos";
import { EntrarPeloTor } from "./EntrarPeloTor";
import { ListaDeAparelhos } from "./ListaDeAparelhos";
import { AvisoDoChat } from "../uso/AvisoDoChat";
import { AvisosDeSeguranca } from "./AvisosDeSeguranca";
import { Panico } from "./Panico";
import { SenhaDePanico } from "./SenhaDePanico";

/** O perfil que o pânico escondeu: diz desde quando e mostra de novo com um toque. */
function Escondido({ t, lang, situacao, aoMostrar }: { t: T; lang: string; situacao: SituacaoDaConta; aoMostrar: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  async function mostrar() {
    setOcupado(true);
    setErro("");
    try {
      await contaSegura.mostrarPerfil();
      aoMostrar();
    } catch (e) {
      setErro(textoDoErro(t, e));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <section className="sg-escondido" aria-labelledby="sg-escondido-t">
      <Icone nome="cadeado" className="h-6 w-6 shrink-0" />
      <div className="min-w-0 flex-1">
        <h2 id="sg-escondido-t" className="sg-subtitulo">{t.escondido.titulo}</h2>
        <p className="sg-cinza">{por(t.escondido.texto, { quando: situacao.panico_em ? dataLegivel(lang, situacao.panico_em) : "" })}</p>
        {erro && <p role="status" className="sg-nota sg-nota-erro">{erro}</p>}
      </div>
      <Botao variante="dourado" tamanho="m" disabled={ocupado} aria-busy={ocupado || undefined} onClick={() => void mostrar()}>{t.escondido.mostrar}</Botao>
    </section>
  );
}

/** Ficar fora da busca de pessoas, das sugestões de @ e dos pacotes (só quem tem o @ inteiro acha). */
function ForaDaBusca({ t, situacao, aoMudar }: { t: T; situacao: SituacaoDaConta; aoMudar: (fora: boolean) => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [nota, setNota] = useState<{ texto: string; erro?: boolean } | null>(null);
  const id = useId();
  async function trocar() {
    const fora = !situacao.fora_da_busca;
    setOcupado(true);
    setNota(null);
    try {
      await contaSegura.foraDaBusca(fora);
      aoMudar(fora);
      setNota({ texto: t.busca.salvo });
    } catch (e) {
      setNota({ texto: textoDoErro(t, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }
  return (
    <section className="sg-bloco" aria-labelledby={`${id}-t`}>
      <div className="sg-linha-chave">
        <div className="min-w-0">
          <h2 id={`${id}-t`} className="sg-titulo al-cond">{t.busca.titulo}</h2>
          <p className="sg-texto" id={`${id}-d`}>{t.busca.texto}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={situacao.fora_da_busca}
          aria-labelledby={`${id}-r`}
          aria-describedby={`${id}-d`}
          className="sg-chave"
          disabled={ocupado}
          onClick={() => void trocar()}
        >
          <span className="sg-chave-trilho" aria-hidden><span className="sg-chave-bola" /></span>
          <span id={`${id}-r`} className="sr-only">{t.busca.rotulo}</span>
        </button>
      </div>
      {nota && <p role="status" className={nota.erro ? "sg-nota sg-nota-erro" : "sg-nota"}>{nota.texto}</p>}
    </section>
  );
}

/**
 * Segurança da conta (/alumia/seguranca): o botão de pânico, a senha de pânico (a conta isca, só neste aparelho), o aplicativo autenticador e o aviso de entrada nova, os códigos de
 * recuperação, os aparelhos conectados, "fora da busca" e entrar pelo Tor. No computador, duas colunas (a de ação imediata à esquerda); no
 * celular, uma.
 */
export default function TelaDaSeguranca({ lang, s, situacao: situacaoDaRede }: PropsDaTelaDoPacote) {
  const t = useTextosDaSeguranca(lang);
  const [situacao, setSituacao] = useState<SituacaoDaConta | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(() => {
    setErro("");
    return contaSegura.situacao().then(setSituacao, (e: unknown) => setErro(e instanceof Error ? e.message : "falha"));
  }, []);
  useEffect(() => {
    let vivo = true;
    contaSegura.situacao().then((r) => vivo && setSituacao(r), (e: unknown) => vivo && setErro(e instanceof Error ? e.message : "falha"));
    return () => {
      vivo = false;
    };
  }, []);

  if (!t || (!situacao && !erro)) return <EsqueletoDosAjustes rotulo={s.estados.carregando} quantos={3} />;
  const cabeca = (
    <header className="sg-cabeca">
      <Ladrilhos cores={[1, 2, 3, 1, 4]} />
      <h1 className="al-cond">{t.titulo}</h1>
      <p className="sg-chamada">{t.chamada}</p>
    </header>
  );
  // Sem a situação (banco fora, rede caída), o pânico continua aqui: ele não depende dela, e é justo a hora de precisar dele.
  if (!situacao) {
    return (
      <article className="sg-pagina">
        {cabeca}
        <div className="sg-erro-carregar">
          <p role="alert" className="sg-nota sg-nota-erro">{textoDoErro(t, erro)}</p>
          <Botao variante="claro" tamanho="m" onClick={() => void carregar()}>{t.erros.tentar}</Botao>
        </div>
        <div className="sg-grade">
          <div className="sg-coluna">
            <Panico t={t} />
            <SenhaDePanico t={t} lang={lang} />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="sg-pagina">
      {cabeca}

      {situacao.escondido_pelo_panico && <Escondido t={t} lang={lang} situacao={situacao} aoMostrar={() => void carregar()} />}

      <div className="sg-grade">
        <div className="sg-coluna">
          <Panico t={t} />
          {/* R1 (A3.5): o histórico do chat mora só neste aparelho e o pânico/"Sair rápido" o apaga de vez. */}
          <AvisoDoChat lang={lang} />
          <SenhaDePanico t={t} lang={lang} />
          <ForaDaBusca t={t} situacao={situacao} aoMudar={(fora) => setSituacao({ ...situacao, fora_da_busca: fora })} />
          <EntrarPeloTor t={t} />
        </div>

        <div className="sg-coluna">
          {/* A8: os avisos da conta (entrada nova, autenticador) saíram das notificações e moram aqui. */}
          <AvisosDeSeguranca t={t} lang={lang} />
          <section className="sg-bloco" aria-labelledby="sg-fator-t">
            <h2 id="sg-fator-t" className="sg-titulo al-cond">{t.fator.titulo}</h2>
            <p className="sg-situacao sg-fator" data-ligado={situacao.segundo_fator || undefined}>
              <Icone nome={situacao.segundo_fator ? "escudo" : "alerta"} className="h-5 w-5 shrink-0" grosso />
              <strong>{situacao.segundo_fator ? t.fator.ligado : t.fator.desligado}</strong>
            </p>
            {!situacao.segundo_fator && <p className="sg-cinza">{t.fator.desligadoTexto}</p>}
            <div className="sg-alerta">
              <p className="sg-subtitulo">
                <Icone nome="avisos" className="h-4 w-4" />
                {t.fator.alertaTitulo}
              </p>
              <p className="sg-cinza">{t.fator.alertaTexto}</p>
            </div>
          </section>

          <Codigos t={t} lang={lang} situacao={situacao} aoGerar={() => void carregar()} />

          <section className="sg-bloco" aria-labelledby="sg-aparelhos-t">
            <div className="sg-bloco-alto">
              <h2 id="sg-aparelhos-t" className="sg-titulo al-cond">{t.aparelhos.titulo}</h2>
              <Link href={`/${lang}/alumia/aparelhos`} className="sg-link">{t.aparelhos.ver}</Link>
            </div>
            <p className="sg-texto">{t.aparelhos.texto}</p>
            <ListaDeAparelhos t={t} lang={lang} />
          </section>
        </div>
      </div>

      {/* As seções de Ajustes que as outras frentes penduram pelo encaixe (termos e privacidade, meus dados, convites). */}
      {ENCAIXES.secoesDeAjustes.length > 0 && (
        <div className="sg-ajustes">
          {ENCAIXES.secoesDeAjustes.map(({ chave, titulo, Componente }) => {
            const ctx = { lang, s, situacao: situacaoDaRede };
            return (
              <section key={chave} className="sg-bloco" aria-labelledby={`sg-ajuste-${chave}`}>
                <h2 id={`sg-ajuste-${chave}`} className="sg-titulo al-cond">{titulo(ctx)}</h2>
                <Componente {...ctx} />
              </section>
            );
          })}
        </div>
      )}
    </article>
  );
}
