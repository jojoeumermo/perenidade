// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O kit de bolso do ato (R1): no modo ato, a pessoa escolhe as assessorias jurídicas e escreve as anotações dela; o kit
// fica só neste aparelho (./kit.ts) e aparece no guia "Sem sinal?", que o service worker guarda para abrir sem internet. Nada
// do kit vai ao servidor: a lista de assessorias é a mesma que o modo ato já lê para o "Fui detido".
import { useEffect, useId, useState } from "react";
import { modoAto, type OrgComAssessoria } from "@/lib/rede/modoato/cliente";
import { apagarKit, armazemDoAparelho, guardarKit, lerKit, MAXIMO_DO_TEXTO, montarKit, type KitDoAto } from "./kit";
import { encher, useTextosDoUso } from "./textos";
import "./uso.css";

const quando = (lang: string, iso: string) => {
  try {
    return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : lang, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
};

/** Pede ao service worker do site para guardar o guia "Sem sinal?" (o mesmo pedido do modo ato). Sem service worker, nada. */
function guardarOGuia(lang: string) {
  try {
    const sw = navigator.serviceWorker?.controller;
    if (sw && navigator.onLine) sw.postMessage({ tipo: "casca", lang, extras: [`/${lang}/alumia/modo-ato/sem-sinal`] });
  } catch {
    // sem service worker: o guia fica guardado quando for aberto
  }
}

export function KitDeBolso({ lang }: { lang: string }) {
  const t = useTextosDoUso(lang);
  const id = useId();
  const [orgs, setOrgs] = useState<OrgComAssessoria[] | null>(null);
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set());
  const [notas, setNotas] = useState("");
  const [kit, setKit] = useState<KitDoAto | null>(null);
  const [nota, setNota] = useState<{ texto: string; erro?: boolean } | null>(null);

  useEffect(() => {
    let vivo = true;
    // O que já está guardado volta para o formulário (as escolhas pelo nome da organização).
    const guardado = lerKit(armazemDoAparelho());
    modoAto.assessorias().then(
      (lista) => {
        if (!vivo) return;
        const comTexto = lista.filter((o) => o.texto);
        setOrgs(comTexto);
        setKit(guardado);
        setNotas(guardado?.notas ?? "");
        setEscolhidas(new Set(guardado ? comTexto.filter((o) => guardado.assessorias.some((a) => a.nome === o.nome)).map((o) => o.handle) : comTexto.map((o) => o.handle)));
      },
      () => {
        if (!vivo) return;
        setOrgs([]);
        setKit(guardado);
        setNotas(guardado?.notas ?? "");
      },
    );
    return () => {
      vivo = false;
    };
  }, []);

  if (!t) return null;

  const guardar = () => {
    const escolha = (orgs ?? []).filter((o) => escolhidas.has(o.handle)).map((o) => ({ nome: o.nome, texto: o.texto }));
    // Sem a lista (sem rede), as assessorias do kit anterior continuam.
    const novo = montarKit(orgs && orgs.length > 0 ? escolha : (kit?.assessorias ?? []), notas);
    if (!guardarKit(armazemDoAparelho(), novo)) return setNota({ texto: t.kit.semEspaco, erro: true });
    setKit(novo);
    guardarOGuia(lang);
    setNota({ texto: encher(t.kit.guardado, { quando: quando(lang, novo.guardado_em) }) });
  };
  const apagar = () => {
    apagarKit(armazemDoAparelho());
    setKit(null);
    setNota({ texto: t.kit.apagado });
  };

  return (
    <section className="ma-cartao al-uso-kit" aria-labelledby={`${id}-t`}>
      <p className="ma-rotulo al-cond">{t.kit.rotulo}</p>
      <h2 id={`${id}-t`} className="ma-cartao-titulo al-cond">{t.kit.titulo}</h2>
      <p className="ma-texto">{t.kit.texto}</p>
      <p className="al-uso-miudo">{t.kit.privacidade}</p>

      <fieldset style={{ border: 0, padding: 0, margin: "0.75rem 0 0" }}>
        <legend className="al-uso-rotulo">{t.kit.escolher}</legend>
        {orgs === null ? null : orgs.length === 0 ? (
          <p className="al-uso-miudo">{t.kit.nenhumaOrg}</p>
        ) : (
          <div className="al-kit-orgs">
            {orgs.map((o) => (
              <label key={o.handle} className="al-uso-marcar" style={{ marginTop: 0 }}>
                <input
                  type="checkbox"
                  checked={escolhidas.has(o.handle)}
                  onChange={(e) =>
                    setEscolhidas((atual) => {
                      const nova = new Set(atual);
                      if (e.target.checked) nova.add(o.handle);
                      else nova.delete(o.handle);
                      return nova;
                    })
                  }
                />
                <span>{o.nome}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <label className="al-uso-campo">
        <span>{t.kit.minhasNotas}</span>
        <textarea value={notas} maxLength={MAXIMO_DO_TEXTO} onChange={(e) => setNotas(e.target.value)} aria-describedby={`${id}-notas`} />
      </label>
      <p id={`${id}-notas`} className="al-uso-miudo">
        {t.kit.minhasNotasAjuda} · {notas.trim().length}/{MAXIMO_DO_TEXTO}
      </p>

      <p className="al-uso-nota" role="status">
        {kit ? encher(t.kit.guardado, { quando: quando(lang, kit.guardado_em) }) : t.kit.naoGuardado}
      </p>
      <div className="al-uso-acoes">
        <button type="button" className="al-botao al-botao-primario al-botao-m" onClick={guardar}>
          {kit ? t.kit.atualizar : t.kit.guardar}
        </button>
        {kit ? (
          <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={apagar}>
            {t.kit.apagar}
          </button>
        ) : null}
        <a className="al-botao al-botao-claro al-botao-m" href={`/${lang}/alumia/modo-ato/sem-sinal#al-kit`}>
          {t.kit.abrirGuia}
        </a>
      </div>
      {nota ? (
        <p role={nota.erro ? "alert" : "status"} className={nota.erro ? "al-uso-erro" : "al-uso-nota"}>
          {nota.texto}
        </p>
      ) : null}
    </section>
  );
}

/**
 * O kit no guia "Sem sinal?" (a página que abre sem internet): lê só do aparelho. Sem kit, diz como guardar. Junto, o básico do
 * dia do ato (texto fixo, também guardado com a página).
 */
export function KitNoGuia({ lang }: { lang: string }) {
  const t = useTextosDoUso(lang);
  const [kit, setKit] = useState<KitDoAto | null | undefined>(undefined);
  useEffect(() => {
    const espera = setTimeout(() => setKit(lerKit(armazemDoAparelho())), 0);
    return () => clearTimeout(espera);
  }, []);
  if (!t) return null;
  return (
    <section id="al-kit" className="ma-cartao ma-guia-secao" aria-labelledby="al-kit-t">
      <p className="ma-rotulo al-cond">{t.kit.rotulo}</p>
      <h2 id="al-kit-t" className="ma-cartao-titulo al-cond">{t.kit.noGuia}</h2>
      {kit === undefined ? null : kit === null ? (
        <p className="al-uso-miudo">{t.kit.noGuiaVazio}</p>
      ) : (
        <>
          <p className="al-uso-miudo">{encher(t.kit.guardado, { quando: quando(lang, kit.guardado_em) })}</p>
          {kit.assessorias.length > 0 ? (
            <>
              <h3 className="al-uso-rotulo" style={{ marginTop: "0.75rem" }}>{t.kit.assessorias}</h3>
              {kit.assessorias.map((a) => (
                <div key={a.nome} className="al-kit-assessoria">
                  <b>{a.nome}</b>
                  <p>{a.texto}</p>
                </div>
              ))}
            </>
          ) : null}
          {kit.notas ? (
            <>
              <h3 className="al-uso-rotulo" style={{ marginTop: "0.75rem" }}>{t.kit.minhasNotas}</h3>
              <p className="al-kit-assessoria" style={{ whiteSpace: "pre-wrap" }}>{kit.notas}</p>
            </>
          ) : null}
        </>
      )}
      <h3 className="al-uso-rotulo" style={{ marginTop: "0.75rem" }}>{t.kit.basico}</h3>
      <ul className="al-uso-lista">
        {t.kit.basicoItens.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </section>
  );
}
