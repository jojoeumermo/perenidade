// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "./lei.css";
import type { ContextoDoEncaixe } from "../encaixes";
import { quando, rotaDaLei } from "./base";
import { useTermos } from "./Reaceite";
import { por } from "./textos";
import { useTextosDaLei } from "./usarTextos";
import { dataDaVersao } from "./versao";
import Link from "@/components/Link";
import { Botao } from "../ui/Botao";
import { abrirOsTermos } from "./JanelaDosTermos";

/** Em Ajustes: a versão dos termos em vigor, se a pessoa já aceitou (e quando) e os links das cinco páginas. */
export default function AjustesDaLei({ lang, situacao }: ContextoDoEncaixe) {
  const t = useTextosDaLei(lang);
  const [termos] = useTermos(situacao.logado);
  if (!t) return null;
  const a = t.ajustes;
  return (
    <div className="le-ajustes">
      <p className="le-texto">{por(a.texto, { data: dataDaVersao(lang) })}</p>
      {termos?.logado && (
        <p className="le-texto">{termos.aceita ? por(a.aceita, { quando: quando(lang, termos.aceita_em, false) }) : a.pendente}</p>
      )}
      {/* P5 (A6): os termos abrem na janela (que bloqueia o uso enquanto o aceite está pendente; depois, só para ler). */}
      {termos?.logado && (
        <p style={{ margin: "0.6rem 0 0" }}>
          <Botao variante={termos.aceita ? "claro" : "primario"} tamanho="m" onClick={() => abrirOsTermos()}>{termos.aceita ? t.janela.rever : a.lerEAceitar}</Botao>
        </p>
      )}
      <p className="le-acoes" style={{ marginTop: "0.6rem" }}>
        <Link className="le-link" href={rotaDaLei(lang, "termos")}>{t.nav.termos}</Link>
        <Link className="le-link" href={rotaDaLei(lang, "privacidade")}>{t.nav.privacidade}</Link>
        <Link className="le-link" href={rotaDaLei(lang, "guardamos")}>{t.nav.guardamos}</Link>
        <Link className="le-link" href={rotaDaLei(lang, "regras")}>{t.nav.regras}</Link>
        <Link className="le-link" href={rotaDaLei(lang, "ajuda")}>{t.nav.ajuda}</Link>
      </p>
    </div>
  );
}
