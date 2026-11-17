// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useState } from "react";
import Link from "@/components/Link";
import { contaSegura } from "@/lib/rede/seguranca/cliente";
import { sairDeTudo } from "@/lib/rede/saida";
import type { ContextoDoEncaixe } from "../encaixes";
import { ENCAIXES } from "../encaixes";
import { Icone } from "../publicar/alumia2/icones";
import { useTextosDaSeguranca } from "../seguranca/base";
import { Botao } from "../ui/Botao";
import { encher } from "@/lib/rede/modoato/textos";
import { horaCurta, useMarcaDoModoAto, useModoAto, useTextosDoModoAto } from "./usar";
import "./modoato.css";

/**
 * A barra do modo ato ligado: no alto da linha (celular e computador) e no alto da coluna da direita (computador). Diz desde
 * quando está ligado e deixa à mão o "Estou bem" e o pânico (dois toques: o segundo confirma). Desligado, não desenha nada, mas
 * continua tirando a marca da raiz (os números voltam).
 */
function Barra({ lang, onde }: { lang: string; onde: "topo" | "lado" }) {
  const t = useTextosDoModoAto(lang);
  const ts = useTextosDaSeguranca(lang);
  const estado = useModoAto();
  useMarcaDoModoAto(estado.ligado);
  const [confirmar, setConfirmar] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const id = useId();
  if (!estado.ligado || !t || !ts) return null;

  async function sair() {
    setSaindo(true);
    await sairDeTudo(() => contaSegura.panico(false), ENCAIXES.aoSairRapido);
  }

  return (
    <section className="ma-barra" data-onde={onde} aria-labelledby={`${id}-t`}>
      <div className="ma-barra-alto">
        <span className="ma-barra-ponto" aria-hidden />
        <h2 id={`${id}-t`} className="ma-barra-titulo al-cond">
          <Link href={`/${lang}/alumia/modo-ato`}>{t.barra.titulo}</Link>
        </h2>
        {estado.desde && <span className="ma-barra-desde">{encher(t.barra.desde, { hora: horaCurta(lang, estado.desde) })}</span>}
      </div>
      {confirmar ? (
        <div className="ma-barra-acoes" role="group" aria-labelledby={`${id}-c`}>
          <p id={`${id}-c`} className="ma-barra-pergunta al-cond">{ts.panico.confirmarTitulo}</p>
          <Botao variante="primario" tamanho="m" disabled={saindo} aria-busy={saindo || undefined} onClick={() => void sair()} autoFocus>
            {saindo ? ts.panico.saindo : ts.panico.confirmar}
          </Botao>
          <Botao variante="fantasma" tamanho="m" disabled={saindo} onClick={() => setConfirmar(false)}>{ts.panico.cancelar}</Botao>
        </div>
      ) : (
        <div className="ma-barra-acoes">
          <Link href={`/${lang}/alumia/modo-ato#estou-bem`} className="al-botao al-botao-dourado al-botao-m">
            {t.barra.estouBem}
          </Link>
          <Botao variante="primario" tamanho="m" icone={<Icone nome="sair" className="h-5 w-5" grosso />} onClick={() => setConfirmar(true)}>
            {t.barra.panico}
          </Botao>
        </div>
      )}
    </section>
  );
}

export function BarraDoTopo({ lang }: ContextoDoEncaixe) {
  return <Barra lang={lang} onde="topo" />;
}

export function BarraDoLado({ lang }: ContextoDoEncaixe) {
  return <Barra lang={lang} onde="lado" />;
}
