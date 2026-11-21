// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Organizar (/alumia/organizar), Prompt 4, itens 52 a 67 e 122, em abas: a organização (quadro, reuniões, horário, consenso,
// orçamento, meta, inventário), a comunidade (mural, banco de tempo, pontos de apoio), o território (termômetro), o ato (rota sem
// internet), o apoio direto e a ata assistida. Atrás de "alumia-p4-organizacao" (desligada, a rota dá 404 e o banco recusa). A aba
// escolhida fica só na memória desta aba do navegador.
import "./organizacao.css";
import { useId, useState, type ComponentType, type KeyboardEvent } from "react";
import type { PropsDaTelaDoPacote } from "../registro";
import { FaixaDaPrevia, useTextosAlumia3 } from "../conversa/base3";
import { Faixa } from "../ui/Faixa";
import { useTextosDaOrganizacao, fraseDoErro, type TextosDaOrganizacao } from "./textos";
import { useCarga } from "./usar";
import { organizacao, PREVIA_DA_ORGANIZACAO, type Minhas, type OrgMinha, type ComunidadeMinha } from "@/lib/rede/organizacao/cliente";
import { SECOES_DA_ORG, SECOES_DA_COMUNIDADE, ABAS_SOLTAS } from "./secoes";

export interface PropsDaSecaoDaOrg {
  t: TextosDaOrganizacao;
  lang: string;
  org: OrgMinha;
}
export interface PropsDaSecaoDaComunidade {
  t: TextosDaOrganizacao;
  lang: string;
  comunidade: ComunidadeMinha;
}
export interface PropsDaAbaSolta {
  t: TextosDaOrganizacao;
  lang: string;
  minhas: Minhas | null;
}
export interface Secao<P> {
  chave: string;
  Componente: ComponentType<P>;
}

/** Uma fileira de abas com setas, Home e End (o mesmo das outras telas do Prompt 4). */
function Abas<K extends string>({ chaves, atual, rotulo, nomes, aoTrocar, prefixo, classe }: { chaves: readonly K[]; atual: K; rotulo: string; nomes: (k: K) => string; aoTrocar: (k: K) => void; prefixo: string; classe: string }) {
  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = chaves.indexOf(atual);
    const j = e.key === "ArrowRight" ? (i + 1) % chaves.length : e.key === "ArrowLeft" ? (i + chaves.length - 1) % chaves.length : e.key === "Home" ? 0 : e.key === "End" ? chaves.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    aoTrocar(chaves[j]);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-aba="${chaves[j]}"]`)?.focus();
  };
  return (
    <div className={classe} role="tablist" aria-label={rotulo} onKeyDown={teclas}>
      {chaves.map((k) => (
        <button key={k} type="button" role="tab" id={`${prefixo}-aba-${k}`} data-aba={k} aria-selected={atual === k} aria-controls={`${prefixo}-painel-${k}`} tabIndex={atual === k ? 0 : -1} className="or-aba" onClick={() => aoTrocar(k)}>
          {nomes(k)}
        </button>
      ))}
    </div>
  );
}

function DaOrganizacao({ t, lang, minhas }: PropsDaAbaSolta) {
  const id = useId();
  const [handle, setHandle] = useState<string | null>(null);
  const chaves = SECOES_DA_ORG.map((s) => s.chave);
  const [secao, setSecao] = useState<string>(chaves[0] ?? "");
  if (!minhas) return null;
  if (minhas.orgs.length === 0) return <p className="or-miudo">{t.org.nenhuma}</p>;
  const org = minhas.orgs.find((o) => o.handle === handle) ?? minhas.orgs[0];
  const Atual = SECOES_DA_ORG.find((s) => s.chave === secao)?.Componente;
  return (
    <div className="or-bloco">
      <p className="or-miudo">{t.org.sobre}</p>
      <div className="or-escolha">
        <label htmlFor={`${id}-org`}>{t.org.qual}
          <select id={`${id}-org`} value={org.handle} onChange={(e) => setHandle(e.target.value)}>
            {minhas.orgs.map((o) => <option key={o.handle} value={o.handle}>{o.nome} (@{o.handle})</option>)}
          </select>
        </label>
      </div>
      {chaves.length > 1 && <Abas chaves={chaves} atual={secao} rotulo={t.org.secoes} nomes={(k) => (t.secoes as Record<string, string>)[k] ?? k} aoTrocar={setSecao} prefixo={`${id}-o`} classe="or-sub" />}
      <div role="tabpanel" id={`${id}-o-painel-${secao}`} aria-labelledby={`${id}-o-aba-${secao}`}>
        {Atual && <Atual key={`${org.handle}-${secao}`} t={t} lang={lang} org={org} />}
      </div>
    </div>
  );
}

function DaComunidade({ t, lang, minhas }: PropsDaAbaSolta) {
  const id = useId();
  const [slug, setSlug] = useState<string | null>(null);
  const chaves = SECOES_DA_COMUNIDADE.map((s) => s.chave);
  const [secao, setSecao] = useState<string>(chaves[0] ?? "");
  if (!minhas) return null;
  if (minhas.comunidades.length === 0) return <p className="or-miudo">{t.comunidade.nenhuma}</p>;
  const comunidade = minhas.comunidades.find((c) => c.slug === slug) ?? minhas.comunidades[0];
  const Atual = SECOES_DA_COMUNIDADE.find((s) => s.chave === secao)?.Componente;
  return (
    <div className="or-bloco">
      <div className="or-escolha">
        <label htmlFor={`${id}-com`}>{t.comunidade.qual}
          <select id={`${id}-com`} value={comunidade.slug} onChange={(e) => setSlug(e.target.value)}>
            {minhas.comunidades.map((c) => <option key={c.slug} value={c.slug}>{c.nome}</option>)}
          </select>
        </label>
      </div>
      {chaves.length > 1 && <Abas chaves={chaves} atual={secao} rotulo={t.comunidade.secoes} nomes={(k) => (t.secoes as Record<string, string>)[k] ?? k} aoTrocar={setSecao} prefixo={`${id}-c`} classe="or-sub" />}
      <div role="tabpanel" id={`${id}-c-painel-${secao}`} aria-labelledby={`${id}-c-aba-${secao}`}>
        {Atual && <Atual key={`${comunidade.slug}-${secao}`} t={t} lang={lang} comunidade={comunidade} />}
      </div>
    </div>
  );
}

export default function TelaDaOrganizacao({ lang }: PropsDaTelaDoPacote) {
  const t = useTextosDaOrganizacao(lang);
  const t3 = useTextosAlumia3(lang);
  const { dado: minhas, erro } = useCarga<Minhas>("minhas", () => organizacao.minhas());
  const abas = ["org", "comunidade", ...ABAS_SOLTAS.map((a) => a.chave)].filter((k) => k !== "org" || SECOES_DA_ORG.length > 0).filter((k) => k !== "comunidade" || SECOES_DA_COMUNIDADE.length > 0);
  const [aba, setAba] = useState<string>(abas[0] ?? "org");

  if (!t) return <div className="or-pagina" aria-busy="true" />;
  const Solta = ABAS_SOLTAS.find((a) => a.chave === aba)?.Componente;

  return (
    <div className="or-pagina">
      {PREVIA_DA_ORGANIZACAO && t3 && <FaixaDaPrevia t={t3} />}
      <header className="or-cabeca">
        <Faixa className="or-faixa" altura={8} />
        <h1 className="or-titulo al-cond">{t.titulo}</h1>
        <p className="or-chamada">{t.intro}</p>
      </header>
      {erro ? <p className="or-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {abas.length > 0 && <Abas chaves={abas} atual={aba} rotulo={t.abas.rotulo} nomes={(k) => (t.abas as Record<string, string>)[k] ?? k} aoTrocar={setAba} prefixo="or" classe="or-abas" />}
      <div role="tabpanel" id={`or-painel-${aba}`} aria-labelledby={`or-aba-${aba}`}>
        {aba === "org" && <DaOrganizacao t={t} lang={lang} minhas={minhas} />}
        {aba === "comunidade" && <DaComunidade t={t} lang={lang} minhas={minhas} />}
        {Solta && <Solta t={t} lang={lang} minhas={minhas} />}
      </div>
    </div>
  );
}
