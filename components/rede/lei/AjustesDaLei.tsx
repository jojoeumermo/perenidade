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
import { LinkBotao } from "../ui/Botao";

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
      {termos?.logado && !termos.aceita && (
        <p style={{ margin: "0.6rem 0 0" }}>
          <LinkBotao variante="primario" tamanho="m" href={`${rotaDaLei(lang, "termos")}#aceite`}>{a.lerEAceitar}</LinkBotao>
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
