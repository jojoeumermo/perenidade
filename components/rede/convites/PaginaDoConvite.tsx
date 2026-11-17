// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A página do convite (/alumia/convite/<código>), para quem ainda não está na Alumia. A mesma cena da entrada (a faixa, o chamado
// e a parede de ladrilhos), com o cartão do convite: o que ele é (leva à triagem, não aprova sozinho), que a triagem não sabe de
// quem, até quando vale, e os dois caminhos (criar conta, já tenho conta). O código fica guardado só neste aparelho, por até 7
// dias, e segue junto do pedido de entrada (lib/rede/convites/cliente.ts). Nada aqui diz quem convidou.
import "@/styles/alumia-entrada.css";
import "./convites.css";
import { useEffect, useState } from "react";
import { useHydrated } from "@/lib/storage";
import { Cena } from "@/components/rede/entrada/Cena";
import { conferirConvite, esquecerConvite, guardarConvite } from "@/lib/rede/convites/cliente";
import { previaDaAlumiaLigada } from "@/lib/rede/conversa/exemplos";
import type { FiguraDaEntrada } from "@/lib/rede/entrada/figuras";
import type { TextosDaEntrada } from "@/lib/rede/entrada/textos";
import { dataCurta, preencher, type TextosDosConvites } from "@/lib/rede/convites/textos";

/** O endereço da Alumia neste idioma (o mesmo cálculo da entrada: no host próprio, português sem prefixo). */
function raizDaAlumia(lang: string): string {
  const { origin, hostname } = window.location;
  if (hostname.startsWith("alumia.")) return lang === "pt" ? `${origin}/` : `${origin}/${lang}`;
  return `${origin}/${lang}/alumia`;
}

type Situacao = { s: "conferindo" } | { s: "valido"; venceEm: string | null } | { s: "invalido" } | { s: "sem_conferir" };

/** Na prévia sem banco (NEXT_PUBLIC_ALUMIA_PREVIA=sim), "?convite=valido|invalido|sem-conferir" mostra cada estado. */
function situacaoDaPrevia(): Situacao | null {
  if (!previaDaAlumiaLigada()) return null;
  const pedida = new URLSearchParams(window.location.search).get("convite");
  if (pedida === "invalido") return { s: "invalido" };
  if (pedida === "sem-conferir") return { s: "sem_conferir" };
  return { s: "valido", venceEm: new Date(Date.now() + 6 * 86_400_000).toISOString() };
}

export function PaginaDoConvite({ lang, t, tc, figuras, site, codigo }: { lang: string; t: TextosDaEntrada; tc: TextosDosConvites; figuras: FiguraDaEntrada[]; site: string; codigo: string }) {
  const [conferida, setConferida] = useState<Situacao>({ s: "conferindo" });
  // O endereço da Alumia e a prévia só se acertam no navegador.
  const hidratado = useHydrated();
  const raiz = hidratado ? raizDaAlumia(lang) : `/${lang}/alumia`;
  const situacao = (hidratado ? situacaoDaPrevia() : null) ?? conferida;

  useEffect(() => {
    let vivo = true;
    if (previaDaAlumiaLigada()) return;
    guardarConvite(codigo);
    void conferirConvite(codigo).then((r) => {
      if (!vivo) return;
      if (!r) return setConferida({ s: "sem_conferir" });
      if (!r.valido) {
        esquecerConvite();
        return setConferida({ s: "invalido" });
      }
      setConferida({ s: "valido", venceEm: r.venceEm });
    });
    return () => {
      vivo = false;
    };
  }, [codigo]);

  const criar = `${raiz}${raiz.includes("?") ? "&" : "?"}criar=1`;
  const p = tc.pagina;
  return (
    <Cena t={t} figuras={figuras} site={site} ocupado={situacao.s === "conferindo"}>
      <div className="ale-pilha" aria-live="polite">
        {situacao.s === "invalido" ? (
          <>
            <span className="ale-carimbo ale-carimbo-cinza">{p.carimbo}</span>
            <h2 className="ale-cond ale-cartao-titulo">{p.invalidoTitulo}</h2>
            <p className="ale-cartao-texto">{p.invalido}</p>
            <div className="ale-linha-de-elos">
              <a className="ale-botao ale-botao-principal" href={criar}>{p.pedirSem}</a>
              <a className="ale-link" href={raiz}>{p.jaTenho}</a>
            </div>
          </>
        ) : (
          <>
            <span className="ale-carimbo ale-carimbo-ouro">{p.carimbo}</span>
            <h2 className="ale-cond ale-cartao-titulo">{p.titulo}</h2>
            <p className="ale-cartao-texto">{p.texto}</p>
            {situacao.s === "conferindo" ? (
              <p className="ale-ajuda ale-prova" role="status">
                <span aria-hidden className="ale-giro" /> {p.conferindo}
              </p>
            ) : situacao.s === "sem_conferir" ? (
              <p className="ale-msg">{p.semConferir}</p>
            ) : situacao.venceEm ? (
              <p className="ale-convite-prazo">{preencher(p.vale, { data: dataCurta(situacao.venceEm, lang) })}</p>
            ) : null}
            <ol className="ale-numerada">
              {p.passos.map((passo) => (
                <li key={passo.titulo}>
                  <span>
                    <b>{passo.titulo}.</b> {passo.texto}
                  </span>
                </li>
              ))}
            </ol>
            <p className="ale-convite-sigilo">{p.sigilo}</p>
            <div className="ale-linha-de-elos">
              <a className="ale-botao ale-botao-principal" href={criar}>{p.criar}</a>
              <a className="ale-link" href={raiz}>{p.jaTenho}</a>
            </div>
            <p className="ale-ajuda">{p.guardado}</p>
          </>
        )}
      </div>
    </Cena>
  );
}
