// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { agrupar, apagarHistorico, historicoLigado, lerHistorico, ligarHistorico, naoGuardarMais, type Visita } from "@/lib/historico-local";
import { estaLigado } from "@/lib/modo-seguro";
import { ligado } from "@/lib/recursos";
import { useTextosDaBusca } from "./busca/TextosDaBusca";
import { L } from "./I18n";
import "@/styles/escola-busca.css";

// "Por onde andei" (Etapa 4, R1-21): a página, o convite para ligar e a lista curta "Você viu estas páginas hoje" da
// busca vazia. Tudo lido do aparelho (lib/historico-local.ts); começa desligado e nunca grava no modo seguro.

interface Estado {
  pronto: boolean;
  ligado: boolean;
  seguro: boolean;
  visitas: Visita[];
}

const ler = (): Estado => {
  try {
    return { pronto: true, ligado: historicoLigado(localStorage), seguro: estaLigado(), visitas: lerHistorico(localStorage) };
  } catch {
    return { pronto: true, ligado: false, seguro: false, visitas: [] };
  }
};

/** O histórico guardado neste aparelho, relido quando algo muda (nesta aba, em outra ou no modo seguro). */
export function useHistorico(): Estado {
  const [estado, setEstado] = useState<Estado>({ pronto: false, ligado: false, seguro: false, visitas: [] });
  useEffect(() => {
    const atualizar = () => setEstado(ler());
    const id = window.setTimeout(atualizar, 0);
    for (const nome of ["lucia:estudo", "lucia:modo-seguro", "storage"]) window.addEventListener(nome, atualizar);
    return () => {
      window.clearTimeout(id);
      for (const nome of ["lucia:estudo", "lucia:modo-seguro", "storage"]) window.removeEventListener(nome, atualizar);
    };
  }, []);
  return estado;
}

const botao = "inline-flex min-h-11 cursor-pointer items-center bg-ink px-4 py-2 font-sans text-sm font-semibold text-parchment hover:bg-oxblood";
const botaoClaro = "inline-flex min-h-11 cursor-pointer items-center border-2 border-ink px-4 py-2 font-sans text-sm font-semibold hover:border-oxblood hover:text-oxblood";

/**
 * O convite para ligar o histórico (na busca vazia e no fim do Meu estudo). Só aparece com a Escola ligada, o histórico
 * desligado e o modo seguro desligado. Diz o risco antes de pedir.
 */
export function ConviteDoHistorico({ className = "" }: { className?: string }) {
  const contexto = useTextosDaBusca();
  const estado = useHistorico();
  const [aceitou, setAceitou] = useState(false);
  if (!ligado("escola") || !contexto || !estado.pronto || estado.seguro) return null;
  const h = contexto.textos.historico;
  if (aceitou) return <p role="status" className={`font-sans text-sm text-ink-soft ${className}`}>{h.ligado}</p>;
  if (estado.ligado) return null;
  return (
    <section aria-label={h.titulo} className={`convite-historico border border-rule bg-parchment-deep p-4 font-sans text-sm ${className}`} data-convite-historico>
      <p className="font-semibold">{h.convite}</p>
      <p className="mt-1 text-xs text-ink-soft">{h.risco}</p>
      <p className="mt-3">
        <button
          type="button"
          className={botao}
          onClick={() => {
            try {
              ligarHistorico(localStorage);
            } catch {
              // sem armazenamento
            }
            setAceitou(true);
          }}
        >
          {h.ligar}
        </button>
      </p>
    </section>
  );
}

/** "Você viu estas páginas hoje": na busca vazia, com o histórico ligado. */
export function VistasHoje({ aoEscolher, className = "" }: { aoEscolher?: () => void; className?: string }) {
  const contexto = useTextosDaBusca();
  const estado = useHistorico();
  if (!ligado("escola") || !contexto || !estado.ligado || estado.seguro) return null;
  const hoje = agrupar(estado.visitas).hoje.slice(0, 6);
  if (hoje.length === 0) return null;
  const h = contexto.textos.historico;
  return (
    <section aria-label={h.vistasHoje} className={`font-sans text-sm ${className}`} data-vistas-hoje>
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-soft">{h.vistasHoje}</p>
      <ul className="mt-1">
        {hoje.map((v) => (
          <li key={v.caminho}>
            <L href={v.caminho} onClick={aoEscolher} className="block truncate py-1.5 font-serif text-[1.05rem] text-ink hover:text-oxblood">
              {v.titulo}
            </L>
          </li>
        ))}
      </ul>
      <L href="/por-onde-andei" onClick={aoEscolher} className="mt-1 inline-block text-xs underline hover:text-oxblood">
        {h.verTudo} →
      </L>
    </section>
  );
}

function Lista({ titulo, visitas, lang }: { titulo: string; visitas: Visita[]; lang: string }) {
  if (visitas.length === 0) return null;
  const hora = new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit" });
  const dia = new Intl.DateTimeFormat(lang, { weekday: "short", day: "numeric" });
  const hoje = titulo === "hoje";
  return (
    <ul className="mt-2 divide-y divide-rule border-y border-rule">
      {visitas.map((v) => (
        <li key={`${v.caminho}-${v.em}`}>
          <L href={v.caminho} className="flex min-h-11 items-baseline gap-3 py-2.5 text-ink hover:text-oxblood">
            <span className="min-w-0 flex-1 font-serif text-lg leading-snug">{v.titulo}</span>
            <small className="shrink-0 font-mono text-xs text-ink-soft">{hoje ? hora.format(v.em) : dia.format(v.em)}</small>
          </L>
        </li>
      ))}
    </ul>
  );
}

/** A página /por-onde-andei: Hoje, Esta semana, "Apagar tudo" e "Não guardar mais". */
export function PorOndeAndei({ lang }: { lang: string }) {
  const contexto = useTextosDaBusca();
  const estado = useHistorico();
  const [aviso, setAviso] = useState("");
  if (!contexto) return null;
  const h = contexto.textos.historico;
  if (!estado.pronto) return <p className="mt-8 font-sans text-sm text-ink-soft">{h.carregando}</p>;
  const { hoje, semana } = agrupar(estado.visitas);
  return (
    <div className="mt-8 space-y-8 font-sans text-sm">
      {estado.seguro && <p className="border-l-2 border-gold pl-3">{h.seguro}</p>}
      {!estado.ligado ? (
        <>
          <p className="text-ink-soft">{h.desligado}</p>
          {!estado.seguro && <ConviteDoHistorico />}
        </>
      ) : estado.visitas.length === 0 ? (
        <p className="text-ink-soft">{h.vazio}</p>
      ) : (
        <>
          {hoje.length > 0 && (
            <section aria-labelledby="poa-hoje">
              <h2 id="poa-hoje" className="font-serif text-2xl font-semibold">
                {h.hoje}
              </h2>
              <Lista titulo="hoje" visitas={hoje} lang={lang} />
            </section>
          )}
          {semana.length > 0 && (
            <section aria-labelledby="poa-semana">
              <h2 id="poa-semana" className="font-serif text-2xl font-semibold">
                {h.semana}
              </h2>
              <Lista titulo="semana" visitas={semana} lang={lang} />
            </section>
          )}
        </>
      )}
      {(estado.ligado || estado.visitas.length > 0) && (
        <div className="flex flex-wrap gap-3 border-t border-rule pt-5">
          <button
            type="button"
            className={botaoClaro}
            onClick={() => {
              apagarHistorico(localStorage);
              setAviso(h.apagado);
            }}
          >
            {h.apagarTudo}
          </button>
          <button
            type="button"
            className={botao}
            onClick={() => {
              naoGuardarMais(localStorage);
              setAviso(h.desligou);
            }}
          >
            {h.naoGuardar}
          </button>
        </div>
      )}
      <p role="status" className="min-h-5 font-semibold">
        {aviso}
      </p>
      {estado.ligado && <p className="text-xs text-ink-soft">{h.risco}</p>}
    </div>
  );
}
