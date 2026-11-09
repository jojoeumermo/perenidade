// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os DUBLÊS da prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim): as peças das outras frentes que as pranchas da F1 mostram (faixa do próximo
// ato, cartão do ato com mosaico, chamado embutido e atos perto, da F2; ao vivo agora, da F4; comunidades ativas, da F3), com os
// dados de exemplo das pranchas. Só aparecem na prévia E quando a frente dona ainda não encaixou a peça de verdade. Nada aqui vai
// ao banco: "Você vai" e "Eu vou" mudam só na tela. Números de pessoas passam pela regra da seção 6 (contagemDePessoas).
import { useState } from "react";
import Link from "@/components/Link";
import { preencher } from "@/lib/rede/preencher";
import { contagemDePessoas, diaEMes, enderecoParaCompartilhar, quandoDoChamado } from "@/lib/rede/publicar/alumia2";
import { ATOS_PERTO_DE_EXEMPLO, atoDeExemplo, COMUNIDADES_DE_EXEMPLO, PLENARIA_DE_EXEMPLO } from "@/lib/rede/publicar/exemplos-alumia2";
import { enderecos, type Post } from "@/lib/rede/tipos";
import { Mosaico } from "../../../mosaico/Mosaico";
import { Botao, LinkBotao } from "../../../ui/Botao";
import { Carimbo } from "../../../ui/Carimbo";
import { Flaps } from "../../../ui/Flaps";
import { Pilula } from "../../../ui/Pilula";
import { Icone } from "../icones";
import type { TextosAlumia2 } from "../textos";

type T = TextosAlumia2;

/** "16 NOV · Panfletagem no RU · amanhã, 11h · Restaurante Universitário · Eu vou" (o chamado embutido no post). */
export function AnexoDoChamadoDuble({ post, lang, t }: { post: Post; lang: string; t: T }) {
  const [vou, setVou] = useState(false);
  if (!post.chamado) return null;
  const dm = diaEMes(post.chamado.quando, lang);
  const quando = quandoDoChamado(post.chamado.quando, lang);
  return (
    <div className="mt-3 flex items-center gap-4 rounded-xl border border-[var(--al-superficie-2)] px-4 py-3">
      {dm && (
        <span className="al-cond flex w-9 shrink-0 flex-col items-center leading-none">
          <span className="text-[1.6rem] font-black">{dm.dia}</span>
          <span className="text-[0.7rem] font-extrabold text-[var(--al-vermelho)]">{dm.mes}</span>
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-extrabold text-[var(--al-texto)]">{post.chamado.tipo}</span>
        <span className="block truncate text-[0.8125rem] text-[var(--al-texto-3)]">
          {quando} · {post.chamado.onde}
        </span>
      </span>
      <Botao variante={vou ? "claro" : "primario"} tamanho="p" pressionado={vou} onClick={() => setVou((v) => !v)}>
        {vou ? t.previa.voceVai : t.previa.euVou}
      </Botao>
    </div>
  );
}

/** A faixa dourada "PRÓXIMO ATO · Passe Livre Já · sex 15/11, 18h · Praça da Sé · [2d] [04h]". */
export function FaixaProximoAtoDuble({ t, lang }: { t: T; lang: string }) {
  const ato = atoDeExemplo();
  return (
    <Link href={enderecos.linha(lang) + "/atos"} className="al2-faixa-ato flex items-center gap-3 px-4 py-3 md:gap-4 md:px-5">
      <span className="al-cond shrink-0 text-[1.05rem] font-black uppercase leading-none md:text-[1.1rem]">{t.previa.proximoAto}</span>
      <span className="min-w-0 flex-1 text-[0.8125rem] font-semibold leading-snug">
        <span className="md:hidden">{ato.nome} · sex 18h · Sé</span>
        <span className="hidden md:inline">
          {ato.nome} · {ato.curto}, {ato.onde.split(",")[1]?.trim()}
        </span>
      </span>
      <Flaps ate={ato.quando} agoraTexto={t.previa.agora} rotulo={(f) => preencher(t.previa.faltam, { d: f.dias, h: f.horas })} className="shrink-0" />
    </Link>
  );
}

/** O cartão do ato das pranchas: pílula da comunidade, carimbo, nome condensado, mosaico, "Você vai" e a conversa do ato. */
export function CartaoDoAtoDuble({ t, lang }: { t: T; lang: string }) {
  const ato = atoDeExemplo();
  const [vai, setVai] = useState(true);
  const com = COMUNIDADES_DE_EXEMPLO[ato.comunidade];
  const rotulo = preencher(t.previa.mosaico, { palavra: ato.palavra });
  const [nota, setNota] = useState("");
  const atos = enderecos.linha(lang) + "/atos";
  // O mesmo compartilhar do cartão: a janela do aparelho, ou a cópia do link (sem ?ref=, sem rastreio).
  async function compartilhar() {
    const url = enderecoParaCompartilhar(window.location.origin, atos);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ url, title: ato.nome });
        return;
      } catch {
        // fechou a janela, ou o aparelho recusou: copia o link
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setNota(t.cartao.copiado);
    } catch {
      setNota(url);
    }
  }
  return (
    <article className="al2-ato mx-4 my-4 rounded-[18px] border border-[var(--al-superficie-2)] bg-[var(--al-superficie)] p-4 md:mx-5 md:p-5" aria-label={ato.nome}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[0.75rem] text-[var(--al-texto-3)]">
            <Pilula texto={com.nome} cor={com.cor} href={enderecos.comunidade(lang, ato.comunidade)} />
            <span className="hidden md:inline">{preencher(t.previa.chamadoPor, { quem: ato.chamadoPor })}</span>
          </p>
          <h2 className="al-cond mt-2 text-[2.1rem] font-black uppercase leading-none tracking-tight md:text-[2.4rem]">{ato.nome}</h2>
        </div>
        <Carimbo situacao="confirmado" texto={t.previa.confirmado} className="mt-1 shrink-0" />
      </div>
      <p className="mt-2 text-[0.9375rem] text-[var(--al-texto-2)]">
        <span className="md:hidden">{ato.curto}</span>
        <span className="hidden md:inline">
          {ato.quandoTexto} · {ato.onde} · {ato.detalhe}
        </span>
      </p>
      <div className="mt-3 md:hidden">
        <Mosaico palavra={ato.palavra} semente={ato.id} proporcao={ato.proporcao} quebrar={31} voce={vai} sementeLocal="previa" rotulo={rotulo} />
      </div>
      <div className="mt-3 hidden md:block">
        <Mosaico palavra={ato.palavra} semente={ato.id} proporcao={ato.proporcao} voce={vai} sementeLocal="previa" rotulo={rotulo} />
      </div>
      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
        <p className="hidden flex-1 text-[0.8125rem] leading-snug text-[var(--al-texto-2)] md:block">
          {vai && <strong className="text-[var(--al-dourado)]">{t.previa.voceNoMosaico} </strong>}
          {t.previa.voceNoMosaicoResto}
        </p>
        <div className="grid grid-cols-2 gap-3 md:flex md:shrink-0 md:gap-2">
          <Botao variante={vai ? "claro" : "primario"} tamanho="p" pressionado={vai} onClick={() => setVai((v) => !v)} icone={vai ? <Icone nome="visto" className="h-5 w-5" grosso /> : undefined} className="max-md:min-h-14 max-md:text-lg">
            {vai ? t.previa.voceVai : t.previa.euVou}
          </Botao>
          <LinkBotao href={atos} variante="contorno" tamanho="p" className="max-md:min-h-14 max-md:text-lg">
            <span className="md:hidden">{preencher(t.previa.conversa, { n: ato.conversa })}</span>
            <span className="hidden md:inline">{preencher(t.previa.conversaDoAto, { n: ato.conversa })}</span>
          </LinkBotao>
        </div>
      </div>
      {/* Só no computador, como na prancha. A classe hidden fica num invólucro: no próprio .al-botao, o display dele ganha. */}
      <div className="mt-3 hidden items-center gap-3 md:flex">
        <Botao variante="contorno" tamanho="p" aria-label={t.previa.compartilharAto} title={t.previa.compartilharAto} onClick={() => void compartilhar()}>
          <Icone nome="compartilhar" className="h-[18px] w-[18px]" />
        </Botao>
        <span role="status" className="text-xs text-[var(--al-texto-3)]">{nota}</span>
      </div>
    </article>
  );
}

/** "AO VIVO AGORA · mais de 1.200 na sala": a plenária da organização (F4). Pessoas só agregadas e arredondadas (§6.1). */
export function AoVivoDuble({ t, lang }: { t: T; lang: string }) {
  const p = PLENARIA_DE_EXEMPLO;
  const c = contagemDePessoas(p.naSala);
  const n = c ? `${c.arredondado ? "+" : ""}${c.n.toLocaleString(lang)}` : "";
  return (
    <section className="al2-bloco overflow-hidden" aria-labelledby="al2-ao-vivo">
      <div className="flex items-center gap-2 bg-[var(--al-vermelho-texto)] px-4 py-2 text-[var(--al-sobre-vermelho)]">
        <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-current" />
        <h2 id="al2-ao-vivo" className="al-cond text-[0.95rem] font-black uppercase">{t.previa.aoVivo}</h2>
        {n && <span className="ml-auto text-xs font-bold">{preencher(t.previa.naSala, { n })}</span>}
      </div>
      <div className="p-4">
        <p className="text-[1.05rem] font-extrabold leading-snug">{p.titulo}</p>
        <p className="mt-1 text-[0.8125rem] leading-snug text-[var(--al-texto-2)]">{p.texto}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {/* A sala ao vivo é da F4: até lá, os botões ficam desativados e dizem por quê. */}
          <Botao variante="claro" tamanho="p" disabled title={t.previa.salaEmBreve}>{t.previa.entrarNaSala}</Botao>
          <Botao variante="contorno" tamanho="p" disabled title={t.previa.salaEmBreve}>{t.previa.mandarPergunta}</Botao>
        </div>
        <p className="mt-2 text-[0.75rem] text-[var(--al-texto-3)]">{t.previa.salaEmBreve}</p>
      </div>
    </section>
  );
}

/** "ATOS PERTO DE VOCÊ": a cidade que a pessoa escreveu, nunca GPS (§6.7). Carimbos confirmado/adiado/cancelado riscado. */
export function AtosPertoDuble({ t, lang }: { t: T; lang: string }) {
  return (
    <section aria-labelledby="al2-atos-perto">
      <div className="flex items-baseline justify-between">
        <h2 id="al2-atos-perto" className="al-cond text-[1.35rem] font-black uppercase">{t.previa.atosPerto}</h2>
        <Link href={enderecos.linha(lang) + "/atos"} className="text-xs font-bold underline">{t.previa.verTodos}</Link>
      </div>
      <ul className="mt-2">
        {ATOS_PERTO_DE_EXEMPLO.map((a) => (
          <li key={a.nome} className="flex items-center gap-3 border-t border-[var(--al-linha)] py-3">
            <span className={`al-cond flex w-8 shrink-0 flex-col items-center leading-none ${a.situacao === "cancelado" ? "text-[var(--al-texto-3)]" : ""}`}>
              <span className="text-[1.4rem] font-black">{a.dia}</span>
              <span className={`text-[0.65rem] font-extrabold ${a.situacao === "cancelado" ? "" : "text-[var(--al-vermelho)]"}`}>{a.mes}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-[0.875rem] font-extrabold leading-tight ${a.situacao === "cancelado" ? "al-riscado text-[var(--al-texto-3)]" : ""}`}>{a.nome}</span>
              <span className="block text-[0.75rem] text-[var(--al-texto-3)]">{a.linha}</span>
            </span>
            <Carimbo situacao={a.situacao} texto={t.previa[a.situacao]} tamanho="p" className="shrink-0" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "COMUNIDADES ATIVAS": posts na semana (contagem de posts, não de pessoas). */
export function ComunidadesAtivasDuble({ t, lang }: { t: T; lang: string }) {
  const lista = Object.entries(COMUNIDADES_DE_EXEMPLO).slice(0, 4);
  return (
    <section aria-labelledby="al2-com-ativas">
      <h2 id="al2-com-ativas" className="al-cond text-[1.35rem] font-black uppercase">{t.previa.comunidadesAtivas}</h2>
      <ul className="mt-2">
        {lista.map(([slug, c]) => (
          <li key={slug} className="border-t border-[var(--al-linha)]">
            <Link href={enderecos.comunidade(lang, slug)} className="flex items-center gap-3 py-3 hover:underline">
              <span aria-hidden className="h-7 w-7 shrink-0 rounded-full border-[3px]" style={{ borderColor: `var(--al-com-${c.cor})` }} />
              <span className="min-w-0">
                <span className="block text-[0.875rem] font-extrabold">{c.nome}</span>
                <span className="block text-[0.75rem] text-[var(--al-texto-3)]">{preencher(t.previa.postsNaSemana, { n: c.posts_7d })}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
