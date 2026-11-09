// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDoPercurso } from "@/i18n/escola/percurso";
import { emPrevia, lerDaEscola, type LidoDaEscola } from "@/lib/escola/acesso";
import { aDeclarar, pedeConsentimento, selosPrevistos, type CadernoParaPercurso } from "@/lib/escola/conquistas";
import { PUBLICOS_DAS_CONQUISTAS, type ConquistaDaEscola, type EscolaEuDentro, type FuncaoDaEscola, type FuncoesDaEscola, type PublicoDasConquistas } from "@/lib/escola/contratos";
import { preencher } from "@/lib/escola/textos";
import { SelosDaEscola } from "./SelosDaEscola";

type Motivo = Extract<LidoDaEscola<unknown>, { ok: false }>["motivo"];

/**
 * As funções da F5 pelo contrato (lerDaEscola). Na prévia de desenvolvimento (emPrevia(), só com NODE_ENV
 * "development"), nada vai à rede: a tela trabalha com uma conquista de exemplo, só na memória.
 */
function chamar<N extends FuncaoDaEscola>(nome: N, args: FuncoesDaEscola[N]["args"], eu: EscolaEuDentro): Promise<LidoDaEscola<FuncoesDaEscola[N]["volta"]>> {
  if (emPrevia()) {
    const exemplo = nome === "escola_conquistas_minhas"
      ? { publico: eu.publico, conquistas: [{ tipo: "carteirinha", alvo: "carteirinha", verificada: true, em: "2026-09-01T12:00:00Z" }, { tipo: "degrau", alvo: "degrau-1", verificada: true, em: "2026-10-20T12:00:00Z" }] }
      : { ok: true };
    return Promise.resolve({ ok: true, dados: exemplo as FuncoesDaEscola[N]["volta"] });
  }
  return lerDaEscola(nome, args);
}

/**
 * "Mostrar na Alumia" (F5): quem vê as conquistas da Escola no perfil da Alumia. Padrão: ninguém. Ligar (sair de
 * "ninguém") passa ANTES pela tela de consentimento (LGPD, art. 5º, II: ser militante revela opinião política); o banco
 * guarda quando. Desligar esconde na hora e apaga o que o aparelho declarou. Com a exibição ligada, o que a pessoa
 * concluiu NESTE aparelho (cadernos inteiros e aulas dos cadernos) é declarado ao banco; o perfil mostra só a contagem
 * de aulas. O público escolhido mora só no banco, nunca no aparelho.
 */
export function MostrarNaAlumia({ eu, t, tSelos, lang, cadernos, feitas }: {
  eu: EscolaEuDentro;
  t: TextosDoPercurso["alumia"];
  tSelos: TextosDoPercurso["selos"];
  lang: Locale;
  cadernos: readonly CadernoParaPercurso[];
  feitas: ReadonlySet<string>;
}) {
  const [lido, setLido] = useState<{ publico: PublicoDasConquistas; conquistas: ConquistaDaEscola[] } | null>(null);
  const [falha, setFalha] = useState<Motivo | null>(null);
  const [escolha, setEscolha] = useState<PublicoDasConquistas | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [envio, setEnvio] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [perguntando, setPerguntando] = useState(false);
  const dialogo = useRef<HTMLDialogElement>(null);
  const enviando = useRef(false);
  // Uma declaração que falhou (rede, "muitos_pedidos", "sem_permissao", público velho) não é repetida sozinha: só
  // depois que a pessoa mexe no público aqui ou recarrega a página. Sem isso, o efeito voltaria a rodar e chamaria o
  // banco de novo, sem parar, gastando o limite do servidor.
  const falhouEnvio = useRef(false);

  useEffect(() => {
    let vivo = true;
    chamar("escola_conquistas_minhas", {}, eu).then((r) => {
      if (!vivo) return;
      if (r.ok) setLido({ publico: r.dados.publico, conquistas: r.dados.conquistas ?? [] });
      else setFalha(r.motivo);
    });
    return () => {
      vivo = false;
    };
  }, [eu]);

  // Com a exibição ligada, leva ao banco o que este aparelho concluiu e o banco ainda não tem (só acrescenta).
  const publico = lido?.publico ?? null;
  const conquistas = lido?.conquistas;
  useEffect(() => {
    if (!publico || publico === "ninguem" || !conquistas || enviando.current || falhouEnvio.current) return;
    const faltam = aDeclarar(cadernos, feitas, conquistas);
    if (faltam.length === 0) return;
    enviando.current = true;
    let vivo = true;
    (async () => {
      setEnvio({ texto: t.enviando });
      const novas: ConquistaDaEscola[] = [];
      let erro: Motivo | null = null;
      for (const d of faltam) {
        const r = await chamar("escola_conquista_declarar", { p_tipo: d.tipo, p_alvo: d.alvo, p_ligar: true }, eu);
        if (!r.ok) {
          erro = r.motivo;
          break;
        }
        novas.push({ tipo: d.tipo, alvo: d.alvo, verificada: false, em: new Date().toISOString() });
      }
      enviando.current = false;
      if (erro) falhouEnvio.current = true;
      if (!vivo) return;
      // Só cria uma lista nova quando há o que acrescentar: uma lista igual mudaria a dependência e rodaria o efeito.
      if (novas.length > 0) setLido((l) => (l ? { ...l, conquistas: [...l.conquistas, ...novas] } : l));
      setEnvio(erro ? { texto: t.erros[erro], erro: true } : { texto: t.emDia });
    })();
    return () => {
      vivo = false;
    };
  }, [publico, conquistas, cadernos, feitas, eu, t]);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (perguntando && !d.open) d.showModal?.();
    if (!perguntando && d.open) d.close();
  }, [perguntando]);

  async function definir(p: PublicoDasConquistas) {
    setOcupado(true);
    setAviso({ texto: t.salvando });
    const r = await chamar("escola_publico_definir", { p }, eu);
    setOcupado(false);
    if (!r.ok) {
      setAviso({ texto: t.erros[r.motivo], erro: true });
      return;
    }
    setEscolha(null);
    falhouEnvio.current = false;
    setLido((l) => (l ? { publico: p, conquistas: p === "ninguem" ? l.conquistas.filter((c) => c.verificada) : l.conquistas } : l));
    setAviso({ texto: p === "ninguem" ? t.desligado : preencher(t.salvo, { publico: t.publicos[p] }) });
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!lido || !escolha || escolha === lido.publico) return;
    if (pedeConsentimento(lido.publico, escolha)) setPerguntando(true);
    else void definir(escolha);
  }

  const atual = escolha ?? lido?.publico ?? "ninguem";
  const selos = lido ? selosPrevistos(lido.conquistas) : [];

  return (
    <section aria-labelledby="ep-alumia" className="ep-alumia">
      <h2 id="ep-alumia" className="ef-t">
        {t.titulo}
      </h2>
      <p>{t.texto}</p>

      {!lido && !falha && <p className="ep-nota">{t.carregando}</p>}
      {falha && (
        <p className="ep-aviso" data-erro="" role="alert">
          {t.erros[falha]}
        </p>
      )}

      {lido && (
        <form onSubmit={salvar}>
          <fieldset disabled={ocupado}>
            <legend>{t.legenda}</legend>
            {PUBLICOS_DAS_CONQUISTAS.map((p) => (
              <label key={p} className="ep-publico">
                <input type="radio" name="ep-publico" value={p} checked={atual === p} onChange={() => setEscolha(p)} />
                <span>
                  <strong>{t.publicos[p]}</strong>
                  <span>{t.ajudas[p]}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="ep-botoes">
            <button type="submit" className="ep-botao" disabled={ocupado || atual === lido.publico}>
              {ocupado ? t.salvando : t.salvar}
            </button>
            {eu.handle ? (
              <Link href={localePath(lang, `/alumia/u/${encodeURIComponent(eu.handle)}`)} className="ep-botao-linha">
                {t.verPerfil}
              </Link>
            ) : null}
          </div>
          {!eu.handle && (
            <p className="ep-nota">
              {t.semPerfil}{" "}
              <Link href={localePath(lang, "/alumia")} className="ep-casca-link">
                {t.abrirAlumia}
              </Link>
            </p>
          )}
        </form>
      )}

      <div role="status" aria-live="polite">
        {aviso && (
          <p className="ep-aviso" data-erro={aviso.erro ? "" : undefined}>
            {aviso.texto}
          </p>
        )}
        {envio && lido?.publico !== "ninguem" && (
          <p className="ep-aviso" data-erro={envio.erro ? "" : undefined}>
            {envio.texto}
          </p>
        )}
      </div>

      {lido && (
        <div className="ep-previa">
          <h3>{t.previa}</h3>
          {selos.length > 0 ? <SelosDaEscola selos={selos} t={tSelos} rotulo={t.previa} /> : <p className="ep-nota">{t.nada}</p>}
          <p className="ep-nota">{t.declaradas}</p>
        </div>
      )}

      <dialog ref={dialogo} className="ep-dialogo" aria-labelledby="ep-consentimento" onClose={() => setPerguntando(false)}>
        <h2 id="ep-consentimento">{t.consentimento.titulo}</h2>
        <p className="ep-dialogo-lgpd">{t.consentimento.texto}</p>
        <p>{t.consentimento.detalhe}</p>
        {escolha && <p>{preencher(t.consentimento.quem, { publico: t.publicos[escolha] })}</p>}
        <div className="ep-botoes">
          <button
            type="button"
            className="ep-botao"
            onClick={() => {
              setPerguntando(false);
              if (escolha) void definir(escolha);
            }}
          >
            {t.consentimento.ligar}
          </button>
          <button type="button" className="ep-botao-linha" autoFocus onClick={() => setPerguntando(false)}>
            {t.consentimento.cancelar}
          </button>
        </div>
      </dialog>
    </section>
  );
}
