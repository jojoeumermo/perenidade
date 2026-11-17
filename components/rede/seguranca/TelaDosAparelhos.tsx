// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import Link from "@/components/Link";
import { EsqueletoDosAjustes } from "../Esqueletos";
import { Icone } from "../publicar/alumia2/icones";
import type { PropsDaTelaDoPacote } from "../registro";
import { Ladrilhos, por, useTextosDaSeguranca } from "./base";
import { ListaDeAparelhos } from "./ListaDeAparelhos";

/**
 * Os aparelhos conectados (/alumia/aparelhos): cada sessão aberta da conta, com o navegador, o sistema, o dia em que entrou e o da
 * última atividade; desconectar uma ou todas as outras. O endereço de rede não aparece (o banco nem entrega).
 */
export default function TelaDosAparelhos({ lang, s }: PropsDaTelaDoPacote) {
  const t = useTextosDaSeguranca(lang);
  const [n, setN] = useState<number | null>(null);
  if (!t) return <EsqueletoDosAjustes rotulo={s.estados.carregando} quantos={3} />;
  return (
    <article className="sg-pagina sg-pagina-estreita">
      <p className="sg-volta">
        <Link href={`/${lang}/alumia/seguranca`} className="sg-link">
          <Icone nome="voltar" className="h-4 w-4" />
          {t.aparelhos.voltar}
        </Link>
      </p>
      <header className="sg-cabeca">
        <Ladrilhos cores={[2, 1, 3, 4, 1]} />
        <h1 className="al-cond">{t.aparelhos.titulo}</h1>
        <p className="sg-chamada">{t.aparelhos.texto}</p>
        {n !== null && n > 1 && <p className="sg-contagem al-cond">{por(t.aparelhos.resumo, { n })}</p>}
      </header>
      <section className="sg-bloco" aria-label={t.aparelhos.titulo}>
        <ListaDeAparelhos t={t} lang={lang} aoMudar={setN} />
      </section>
    </article>
  );
}
