// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import type { ContextoDoEncaixe } from "../encaixes";
import { BotaoVou } from "./Acoes";
import { BlocoDaData, CarimboDoAto, LinhaCurta } from "./partes";
import { useOuvirAto, useTextosDosAtos } from "./usar";
import type { Post } from "@/lib/rede/tipos";
import type { Ato } from "@/lib/rede/tipos-atos";
import "./atos.css";

/**
 * O ato a partir do post do chamado (o que a linha já traz). Os campos novos da F2 são opcionais no Post (banco de antes da
 * migração): sem situação vale "confirmado"; a proporção vem já limpa pela função do banco (nula abaixo de 3).
 */
export function atoDoPost(post: Post): Ato | null {
  const c = post.chamado;
  // O chamado vem no post do tipo "chamado" e também embutido num post comum (prancha computador-inicio): vale o campo, não o tipo.
  if (!c || !c.quando) return null;
  return {
    id: post.id,
    titulo: post.titulo || c.palavra || c.tipo || "",
    palavra: c.palavra || post.titulo || "",
    comunidade: post.comunidade ? { slug: post.comunidade, nome: post.comunidade } : null,
    chamado_por: post.autor?.handle ?? null,
    inicio: c.quando,
    inicio_anterior: c.inicio_anterior ?? null,
    onde: c.onde,
    cidade: "",
    descricao: post.texto,
    situacao: c.situacao ?? "confirmado",
    motivo: "",
    acesos: c.acesos ?? null,
    total: post.meu ? post.vou : null,
    vou_eu: post.vou_eu,
    meu: post.meu,
    respostas: post.respostas,
    link_apoio: null,
  };
}

/**
 * O chamado embutido no cartão do post (prancha computador-inicio: "16 NOV · Panfletagem no RU · amanhã, 11h · Eu vou"): a data,
 * o nome (leva à página do ato), onde e quando, o carimbo quando não está confirmado, e o "Eu vou" que confirma ali mesmo.
 */
export function AnexoChamado({ lang, situacao, post }: ContextoDoEncaixe & { post: Post }) {
  const t = useTextosDosAtos(lang);
  const [ato, setAto] = useState<Ato | null>(() => atoDoPost(post));
  useEffect(() => {
    queueMicrotask(() => setAto(atoDoPost(post)));
  }, [post]);
  useOuvirAto(ato?.id ?? "", setAto);
  if (!t || !ato) return null;
  return (
    <div className="al-ato-anexo" data-situacao={ato.situacao}>
      <BlocoDaData iso={ato.inicio} lang={lang} apagado={ato.situacao === "cancelado"} />
      <span className="al-ato-anexo-texto">
        <Link href={`/${lang}/alumia/ato/${ato.id}`} className={`al-ato-anexo-titulo${ato.situacao === "cancelado" ? " al-riscado" : ""}`}>
          {ato.titulo}
        </Link>
        <LinhaCurta ato={ato} t={t} lang={lang} />
      </span>
      {ato.situacao === "confirmado" ? (
        <BotaoVou ato={ato} t={t} lang={lang} logado={situacao.logado} className="al-ato-anexo-botao al-botao-p" />
      ) : (
        <CarimboDoAto ato={ato} t={t} tamanho="p" />
      )}
    </div>
  );
}
