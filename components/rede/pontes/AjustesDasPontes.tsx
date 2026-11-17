// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A seção Pontes dos Ajustes (encaixe secoesDeAjustes): o resumo das comunidades por e-mail (opcional, só títulos públicos, com
// "ver o que seria enviado agora") e, para quem gerencia uma organização, o caminho para os robôs e o Telegram dela
// (/alumia/pontes). Entrar pelo Tor fica na Segurança da conta (components/rede/seguranca/EntrarPeloTor.tsx).
import "./pontes.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { localePath } from "@/i18n/config";
import { LIMITES_DAS_PONTES as L } from "@/lib/rede/pontes/regras";
import type { ContextoDoEncaixe } from "../encaixes";
import { pontes, type Resumo } from "./cliente";
import { por, textoDoErro, type TextosDasPontes } from "./textos";
import { useTextosDasPontes } from "./usarTextos";

function ResumoDasComunidades({ t, lang }: { t: TextosDasPontes; lang: string }) {
  const [r, setR] = useState<Resumo | null>(null);
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [ligado, setLigado] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    let vivo = true;
    pontes.resumo().then((x) => {
      if (!vivo) return;
      setR(x);
      setLigado(x.ligado);
      setEscolhidas(x.escolhidas);
    }, () => vivo && setR({ ligado: false, escolhidas: [], opcoes: [] }));
    return () => {
      vivo = false;
    };
  }, []);
  if (!r) return <p className="po-nota">{t.pontes.carregando}</p>;

  const salvar = async () => {
    setOcupado(true);
    setAviso(null);
    try {
      const novo = await pontes.salvarResumo(ligado, ligado ? escolhidas : []);
      setR(novo);
      setEscolhidas(novo.escolhidas);
      setLigado(novo.ligado);
      setAviso({ ok: true, texto: t.resumo.salvo });
    } catch (e) {
      setAviso({ ok: false, texto: textoDoErro(t.erros, e) });
    } finally {
      setOcupado(false);
    }
  };
  const verPrevia = async () => {
    try {
      const p = await pontes.previaDoResumo();
      setPrevia(p ? p.texto : t.resumo.previaVazia);
    } catch (e) {
      setPrevia(textoDoErro(t.erros, e));
    }
  };

  return (
    <div>
      <h3 className="al-cond">{t.resumo.titulo}</h3>
      <p className="po-texto">{t.resumo.chamada}</p>
      {/* São dois resumos por e-mail, ligados em lugares diferentes: cada um diz onde está o outro. */}
      <p className="po-nota">
        <Link href={localePath(lang, "/alumia/avisos")} className="underline underline-offset-4">{t.resumo.outro}</Link>
      </p>
      <label className="po-marcar">
        <input type="checkbox" checked={ligado} onChange={(e) => setLigado(e.target.checked)} />
        <span>{t.resumo.ligar}</span>
      </label>
      {ligado && (
        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend className="po-nota">{por(t.resumo.escolha, { n: L.resumoComunidades })}</legend>
          {r.opcoes.length === 0 ? <p className="po-nota">{t.resumo.semComunidades}</p> : (
            <div className="po-escolhas">
              {r.opcoes.map((o) => {
                const marcada = escolhidas.includes(o.slug);
                return (
                  <button
                    key={o.slug}
                    type="button"
                    className="po-pilula"
                    aria-pressed={marcada}
                    disabled={!marcada && escolhidas.length >= L.resumoComunidades}
                    onClick={() => setEscolhidas((l) => (marcada ? l.filter((x) => x !== o.slug) : [...l, o.slug]))}
                  >
                    {o.nome}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>
      )}
      <div className="po-acoes">
        <button type="button" className="al-botao al-botao-m al-botao-primario" disabled={ocupado || (ligado && escolhidas.length === 0)} onClick={salvar}>{t.resumo.salvar}</button>
        {r.ligado && <button type="button" className="al-botao al-botao-m al-botao-contorno" onClick={verPrevia}>{t.resumo.previa}</button>}
      </div>
      {aviso && <p className={aviso.ok ? "po-ok" : "po-erro"} role={aviso.ok ? "status" : "alert"}>{aviso.texto}</p>}
      {previa !== null && (
        <>
          <pre className="po-previa">{previa}</pre>
          <button type="button" className="al-botao al-botao-p al-botao-fantasma" onClick={() => setPrevia(null)}>{t.resumo.fecharPrevia}</button>
        </>
      )}
    </div>
  );
}

function CaminhoDaOrganizacao({ t, lang }: { t: TextosDasPontes; lang: string }) {
  const [gerencia, setGerencia] = useState(false);
  useEffect(() => {
    let vivo = true;
    pontes.eu().then((eu) => vivo && setGerencia(eu.coordenacao || eu.orgs.some((o) => o.gerencio)), () => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  if (!gerencia) return null;
  return (
    <div>
      <h3 className="al-cond">{t.ajustes.robos}</h3>
      <p className="po-texto">{t.ajustes.robosChamada}</p>
      <Link className="al-botao al-botao-m al-botao-contorno" href={`/${lang}/alumia/pontes`}>{t.pontes.titulo}</Link>
    </div>
  );
}

/** A seção inteira, só para membro (quem não é membro não recebe resumo nem gerencia organização). */
export default function AjustesDasPontes({ lang, situacao }: ContextoDoEncaixe) {
  const t = useTextosDasPontes(lang);
  const membro = situacao.logado && situacao.membro && !situacao.suspenso;
  if (!t) return null;
  if (!membro) return <p className="po-nota">{t.ajustes.soMembro}</p>;
  return (
    <div className="po-ajustes">
      <ResumoDasComunidades t={t} lang={lang} />
      <CaminhoDaOrganizacao t={t} lang={lang} />
    </div>
  );
}
