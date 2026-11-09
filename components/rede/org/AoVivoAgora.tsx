// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { redeOrg } from "@/lib/rede/cliente-org";
import { linkSeguro } from "@/lib/rede/org/contagem";
import { carregarTextosDaOrg, type TextosDaOrg } from "@/lib/rede/textos-org";
import { enderecos } from "@/lib/rede/tipos";
import type { PlenariaAoVivo } from "@/lib/rede/tipos-org";
import { recursoLigado } from "@/lib/rede/org/flag";
import type { ContextoDoEncaixe } from "../encaixes";
import { LinkBotao } from "../ui/Botao";
import { CartaoAoVivo } from "./partes";

/**
 * "Ao vivo agora" na coluna da direita (prancha computador-inicio): a plenária que está acontecendo, com Entrar na sala (o link da
 * sala, fora da Alumia) e Mandar pergunta (abre o perfil da organização na aba Plenárias, onde fica o campo e a fila). Sem plenária
 * ao vivo, nada aparece. Pessoas na sala só agregadas e a partir de 3. Atrás da flag "alumia-org".
 */
export function AoVivoAgora({ lang }: ContextoDoEncaixe) {
  const [t, setT] = useState<TextosDaOrg | null>(null);
  const [lista, setLista] = useState<PlenariaAoVivo[]>([]);
  const ligado = recursoLigado("alumia-org");
  useEffect(() => {
    if (!ligado) return;
    let vivo = true;
    carregarTextosDaOrg(lang).then((x) => vivo && setT(x)).catch(() => undefined);
    redeOrg
      .aoVivo()
      .then((l) => vivo && setLista(l.filter((p) => p.aoVivo)))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang, ligado]);
  const p = lista[0];
  if (!ligado || !t || !p) return null;
  const sala = linkSeguro(p.sala);
  return (
    <CartaoAoVivo
      plenaria={p}
      t={t}
      lang={lang}
      acoes={
        <>
          {sala ? (
            <a href={sala} target="_blank" rel="noopener noreferrer" className="al-botao al-botao-claro al-botao-p">
              {t.coluna.entrarNaSala}
              <span className="sr-only"> ({t.plenaria.salaFora})</span>
            </a>
          ) : null}
          <LinkBotao href={`${enderecos.perfil(lang, p.org.handle)}?aba=plenarias`} variante="contorno" tamanho="p">
            {t.coluna.mandarPergunta}
          </LinkBotao>
        </>
      }
    />
  );
}
