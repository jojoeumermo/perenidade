// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDoAoVivo } from "@/i18n/escola/aovivo";
import { type AulaDaEscolaNaSala, avisarQuandoComecar, lerAulaDaEscola, lerCadernoAula } from "@/lib/escola/aovivo";
import { caminhoDoCaderno, TELAS_DA_ESCOLA } from "@/lib/escola/contratos";
import { preencher } from "@/lib/escola/textos";
import { useSinal } from "@/lib/tempo-real";
import { useEuDaEscola } from "../casca/Casca";
import { diaEHora } from "../hoje/tempo";
import { ChatDaEscola } from "./ChatDaEscola";
import { TocadorDaEscola } from "./TocadorDaEscola";
import "./aovivo.css";

type Estado = { tipo: "carregando" } | { tipo: "erro"; motivo: string } | { tipo: "aula"; aula: AulaDaEscolaNaSala };

/**
 * A sala da aula ao vivo da Escola (/escola/ao-vivo/[id]): só monta dentro da casca, depois de escola_eu dizer que é
 * militante, e lê a aula do banco (aula_ao_vivo_ver devolve nada para quem não pode ver). À esquerda o vídeo (YouTube
 * não listado, sem cookies, depois do clique), quem conduz, o aviso de não repassar o link e a aula do caderno; à
 * direita o bate-papo da turma. Começar e encerrar continuam no painel (Aulas ao vivo), com quem conduz.
 */
export function SalaDaEscola({ id, lang, t }: { id: string; lang: Locale; t: TextosDoAoVivo }) {
  const eu = useEuDaEscola();
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [vez, setVez] = useState(0);
  const [avisoLigado, setAvisoLigado] = useState("");
  const recarregar = useCallback(() => setVez((v) => v + 1), []);
  useSinal(recarregar, ["aula_ao_vivo"]);

  useEffect(() => {
    let vivo = true;
    void lerAulaDaEscola(id).then((lido) => {
      if (!vivo) return;
      setEstado((antes) => (lido.ok ? { tipo: "aula", aula: lido.dados } : antes.tipo === "aula" && lido.motivo !== "nao_encontrado" ? antes : { tipo: "erro", motivo: lido.motivo }));
    });
    // A situação da aula (marcada → ao vivo → gravada) muda pelo painel de quem conduz: confere a cada 30 s.
    const relogio = window.setInterval(() => document.visibilityState === "visible" && recarregar(), 30_000);
    return () => {
      vivo = false;
      window.clearInterval(relogio);
    };
  }, [id, vez, recarregar]);

  const hoje = localePath(lang, TELAS_DA_ESCOLA.hoje);
  const voltar = (
    <Link href={hoje} className="ea-voltar">
      <span aria-hidden>←</span> {t.sala.voltar}
    </Link>
  );

  if (estado.tipo !== "aula") {
    return (
      <div className="ea-sala" data-escola-escura="" data-tela-da-escola="ao-vivo">
        {voltar}
        <div className="ea-estado" role={estado.tipo === "erro" ? "alert" : "status"}>
          {estado.tipo === "carregando" ? (
            <p>{t.sala.carregando}</p>
          ) : (
            <>
              <p>{estado.motivo === "nao_encontrado" ? t.sala.naoEncontrada : estado.motivo === "sem_servico" ? t.sala.semServico : t.sala.falha}</p>
              {estado.motivo !== "nao_encontrado" && estado.motivo !== "sem_servico" && (
                <button type="button" className="ef-botao-vazado" onClick={recarregar}>
                  {t.sala.tentar}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  const { aula } = estado;
  const nomes = [aula.educador, ...aula.co_educadores].map((p) => p.nome).filter(Boolean);
  const ligada = lerCadernoAula(aula.caderno_aula);
  const gravada = aula.status === "encerrada";

  async function avisar(ligar: boolean) {
    try {
      const r = await avisarQuandoComecar(aula.id, ligar);
      setEstado({ tipo: "aula", aula: { ...aula, inscrito: r.inscrito, inscritos: r.inscritos } });
      setAvisoLigado(r.inscrito ? t.sala.avisoLigado : "");
    } catch {
      setAvisoLigado(t.chat.erro);
    }
  }

  return (
    <div className="ea-sala" data-escola-escura="" data-tela-da-escola="ao-vivo">
      {voltar}
      <div className="ea-corpo">
        <div className="ea-principal">
          <p className="ea-rotulo">
            <span className="ea-selo" data-situacao={aula.status}>
              {t.sala.situacao[aula.status]}
            </span>
            {t.sala.rotulo}
          </p>
          <h1 className="ef-t ea-titulo">{aula.titulo}</h1>
          <p className="ea-linha">
            {preencher(t.sala.quando, { dia: diaEHora(lang, aula.inicio), duracao: aula.duracao })}
            {nomes.length > 0 && <> · {preencher(t.sala.com, { nomes: new Intl.ListFormat(lang === "pt" ? "pt-BR" : lang, { type: "conjunction" }).format(nomes) })}</>}
            {!gravada && aula.inscritos > 0 && <> · {preencher(t.sala.presencas, { n: aula.inscritos })}</>}
          </p>

          {aula.status === "cancelada" ? (
            <div className="ea-estado">
              <p>{t.sala.cancelada}</p>
            </div>
          ) : (
            <>
              <TocadorDaEscola
                id={aula.youtube}
                titulo={aula.titulo}
                lang={lang}
                aoVivo={!gravada}
                textos={{ assistir: gravada ? t.sala.assistirGravada : t.sala.assistir, aviso: t.sala.avisoTocador, semVideo: t.sala.semTransmissao }}
              />
              <p className="ea-nao-repasse">{t.sala.naoRepasse}</p>
            </>
          )}

          <div className="ea-blocos">
            {aula.status === "agendada" && (
              <section className="ea-bloco" aria-label={t.sala.avisar}>
                <p style={{ marginTop: 0 }}>{preencher(t.sala.antes, { quando: diaEHora(lang, aula.inicio) })}</p>
                <div className="ea-acoes">
                  <button type="button" className={aula.inscrito ? "ef-botao-vazado" : "ef-botao-ouro"} aria-pressed={aula.inscrito} onClick={() => void avisar(!aula.inscrito)}>
                    {aula.inscrito ? t.sala.desavisar : t.sala.avisar}
                  </button>
                </div>
                {avisoLigado && (
                  <p role="status" className="ea-aviso">
                    {avisoLigado}
                  </p>
                )}
              </section>
            )}
            {ligada && (
              <section className="ea-bloco ea-bloco-caderno" aria-label={t.sala.abrirAula}>
                <span className="ea-codigo">F-{String(ligada.caderno.numero).padStart(2, "0")}</span>
                <p style={{ marginTop: 2 }}>{preencher(t.sala.doCaderno, { codigo: String(ligada.caderno.numero).padStart(2, "0") })}</p>
                <div className="ea-acoes">
                  <Link href={localePath(lang, `${caminhoDoCaderno(ligada.caderno.slug)}/${ligada.pedaco}`)} className="ef-botao-vermelho">
                    {t.sala.abrirAula}
                  </Link>
                </div>
              </section>
            )}
          </div>

          {aula.descricao && <p className="ea-descricao">{aula.descricao}</p>}
        </div>

        <aside className="ea-lado" aria-label={t.chat.titulo}>
          <ChatDaEscola aula={aula} lang={lang} t={t.chat} codinome={eu.codinome} />
        </aside>
      </div>
    </div>
  );
}
