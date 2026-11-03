// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSyncExternalStore } from "react";
import { fill } from "@/i18n/config";
import en from "@/i18n/escola/acesso/en.json";
import es from "@/i18n/escola/acesso/es.json";
import fr from "@/i18n/escola/acesso/fr.json";
import pt from "@/i18n/escola/acesso/pt.json";
import ru from "@/i18n/escola/acesso/ru.json";
import zh from "@/i18n/escola/acesso/zh.json";
import { ANCORAS, fraseDoSelo, type Parte, type Selo, type SelosDeUmItem, type Servico, type TipoDeSelo } from "@/lib/selos";
import "@/styles/escola-acesso.css";

// O selo de privacidade (R1-92): um ícone e uma frase curta que diz para onde vai o que a pessoa faz ali. As frases
// estão em i18n/escola/acesso e cada selo de lib/selos.ts foi conferido no código (scripts/testar-acesso.mjs).
// Os textos dos seis idiomas vêm juntos (são poucas frases): o selo aparece dentro de componentes do navegador que não
// recebem os textos da Escola por props (a caixa de ferramentas, o painel de acessibilidade, a prática).

type Textos = typeof pt;
const TEXTOS: Record<string, Textos> = { pt, en, es, fr, ru, zh };

const nada = () => () => {};
/** O idioma pelo endereço (/en/...), para quem não recebe o idioma por props. No servidor e no painel, português. */
function idiomaDoEndereco(): string {
  const primeiro = window.location.pathname.split("/")[1] ?? "";
  return primeiro in TEXTOS ? primeiro : "pt";
}

function useIdioma(lang?: string): string {
  const doEndereco = useSyncExternalStore(nada, idiomaDoEndereco, () => "pt");
  return lang && lang in TEXTOS ? lang : doEndereco;
}

function Icone({ tipo }: { tipo: TipoDeSelo }) {
  const comum = { className: "selo-icone", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, "aria-hidden": true } as const;
  if (tipo === "aparelho")
    return (
      <svg {...comum}>
        <rect x="4" y="1.5" width="8" height="13" rx="1.5" />
        <path d="M7 12.5h2" />
      </svg>
    );
  if (tipo === "instituto")
    return (
      <svg {...comum}>
        <rect x="2" y="2" width="12" height="5" rx="1" />
        <rect x="2" y="9" width="12" height="5" rx="1" />
        <path d="M4.5 4.5h1M4.5 11.5h1" />
      </svg>
    );
  return (
    <svg {...comum}>
      <path d="M9 2h5v5M14 2 7.5 8.5" />
      <path d="M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5" />
    </svg>
  );
}

/** A frase de um selo no idioma, já com o serviço no lugar. */
export function fraseDe(selo: Selo, s: Textos): string {
  const chave = fraseDoSelo(selo);
  return fill(s.selo[chave], { servico: selo.servico ? s.servicos[selo.servico] : "" });
}

/**
 * Um selo. `tipo`: "aparelho" (fica no aparelho), "instituto" (passa pelo servidor do instituto) ou "externo" (usa um
 * serviço de fora, `servico`). `naoGuarda` só quando a rota foi lida e não grava nada; `parte` quando vale para uma
 * parte da ferramenta. `ancora` troca a seção da privacidade para onde o link leva.
 */
export function SeloDePrivacidade({
  tipo,
  servico,
  naoGuarda,
  parte,
  ancora,
  lang,
  semLink = false,
  className = "",
}: {
  tipo: TipoDeSelo;
  servico?: Servico;
  naoGuarda?: boolean;
  parte?: Parte;
  ancora?: string;
  lang?: string;
  semLink?: boolean;
  className?: string;
}) {
  const idioma = useIdioma(lang);
  const s = TEXTOS[idioma];
  const frase = fraseDe({ tipo, servico, naoGuarda }, s);
  return (
    <p className={`selo-privacidade flex items-start gap-1.5 font-sans text-xs text-ink-soft ${className}`} data-selo={tipo}>
      <Icone tipo={tipo} />
      <span>
        <span className="sr-only">{s.selo.rotulo}: </span>
        {parte && <strong className="font-semibold text-ink">{s.partes[parte]} · </strong>}
        {frase}
        {!semLink && (
          <>
            {" · "}
            <a href={`/${idioma}/privacidade#${ancora ?? ANCORAS[tipo]}`} className="underline hover:text-oxblood">
              {s.selo.privacidade}
            </a>
          </>
        )}
      </span>
    </p>
  );
}

/** O selo principal de um item e os das partes, um por linha; o link da privacidade vai só no último. */
export function SelosDePrivacidade({ item, lang, className = "" }: { item: SelosDeUmItem; lang?: string; className?: string }) {
  const todos = [item.principal, ...(item.partes ?? [])];
  return (
    <div className={`space-y-1 ${className}`}>
      {todos.map((selo, i) => (
        <SeloDePrivacidade key={i} tipo={selo.tipo} servico={selo.servico} naoGuarda={selo.naoGuarda} parte={selo.parte} lang={lang} semLink={i < todos.length - 1} />
      ))}
    </div>
  );
}
