// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As figurinhas interativas do B1 (ALUMIA-FUNCOES-E-IDEIAS §3.4): "Vou" (confirmar presença no ato direto do story, a mesma
// confirmação da página do ato), menção a pessoa, #campanha com a corrente "Adicionar o seu", e a resposta à pergunta publicada
// num story novo (sem o nome de quem respondeu). Privacidade (PLANO-ALUMIA §6; LGPD art. 11): ninguém vê quem vai nem quem
// entrou na corrente; os totais só a partir de 3 (e arredondados de 5 em 5 a partir de 10, pelo banco).
import { useId } from "react";
import Link from "@/components/Link";
import { enderecosDosStories } from "@/lib/rede/stories/enderecos";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import type { AtoParaContagem, FigurinhaCampanha, FigurinhaVou } from "@/lib/rede/tipos-stories";
import { enderecos, handleOk } from "@/lib/rede/tipos";
import { noPlural, preencherStory } from "../stories/usar";

type T = TextosDosStories["b1"];

const IconeVou = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
);

/** O dia e a hora do ato no idioma da pessoa, no fuso de Brasília (o mesmo das telas de ato). */
export function quandoDoAto(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : lang, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(d);
}

/**
 * "Vou" no visor: um toque confirma presença (rede_ato_vou, a mesma da página do ato) e outro desfaz. O total aparece só a partir
 * de 3. A autora vê a figurinha sem o botão (ela organiza ou já foi). Ato que passou, foi cancelado ou que eu não vejo: só o nome.
 */
export function VouVer({ f, t, lang, meu, ocupado, aoVou }: { f: FigurinhaVou; t: T; lang: string; meu: boolean; ocupado: boolean; aoVou: ((sim: boolean) => void) | null }) {
  const id = useId();
  const vou = !!f.vou_eu;
  return (
    <div className="al-fg al-fg-vou al-fg-torto-esq" aria-labelledby={id}>
      <p className="al-fg-etiqueta">{t.vou.rotulo}</p>
      <p id={id} className="al-fg-vou-titulo">
        {f.ato ? (
          <Link href={`/${lang}/alumia/ato/${f.ato}`} className="al-fg-vou-link">
            {f.titulo}
          </Link>
        ) : (
          f.titulo
        )}
      </p>
      <p className="al-fg-vou-quando">
        {quandoDoAto(f.inicio, lang)}
        {f.cidade ? ` · ${f.cidade}` : ""}
      </p>
      {f.encerrado || !f.ato ? (
        <p className="al-fg-nota">{t.vou.encerrado}</p>
      ) : meu || !aoVou ? (
        <p className="al-fg-nota">{f.total ? noPlural(lang, f.total, t.vou.totalN) : t.vou.poucas}</p>
      ) : (
        <>
          <button type="button" className="al-fg-vou-botao" aria-pressed={vou} disabled={ocupado} onClick={() => aoVou(!vou)}>
            <IconeVou />
            <span>{vou ? t.vou.voce : t.vou.eu}</span>
          </button>
          <p className="al-fg-nota" aria-live="polite">
            {f.total ? noPlural(lang, f.total, t.vou.totalN) : t.vou.poucas}
          </p>
        </>
      )}
    </div>
  );
}

/** "Vou" no "criar": escolher o ato (os meus e os que confirmei, a mesma lista da contagem). */
export function VouEditar({ t, atos, ato, lang, aoEscolher }: { t: T; atos: AtoParaContagem[] | null; ato: string | null; lang: string; aoEscolher: (a: AtoParaContagem) => void }) {
  const id = useId();
  return (
    <div className="al-fg al-fg-vou al-fg-torto-esq">
      <p className="al-fg-etiqueta" aria-hidden>
        {t.vou.rotulo}
      </p>
      {atos === null ? (
        <p className="al-fg-nota" role="status">
          {t.vou.carregando}
        </p>
      ) : atos.length === 0 ? (
        <p className="al-fg-nota">{t.vou.nenhum}</p>
      ) : (
        <>
          <label htmlFor={id} className="sr-only">
            {t.vou.escolher}
          </label>
          <select id={id} className="al-fg-escolha" value={ato ?? ""} onChange={(e) => {
            const a = atos.find((x) => x.id === e.target.value);
            if (a) aoEscolher(a);
          }}>
            <option value="" disabled>
              {t.vou.escolher}
            </option>
            {atos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.titulo} · {quandoDoAto(a.inicio, lang)}
              </option>
            ))}
          </select>
        </>
      )}
      <p className="al-fg-nota">{t.vou.ajuda}</p>
    </div>
  );
}

const IconeArroba = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="3.6" />
    <path d="M15.6 12v1.4a2.6 2.6 0 0 0 5.2 0V12a8.8 8.8 0 1 0-3.4 7" />
  </svg>
);

/** A menção no visor: o @ e o codinome, que levam ao perfil. Conta que sumiu (ou bloqueio): só "Conta indisponível". */
export function PessoaVer({ handle, nome, t, lang }: { handle: string | null; nome: string; t: T; lang: string }) {
  if (!handle) {
    return (
      <span className="al-fg al-fg-pessoa al-fg-torto-dir">
        <IconeArroba />
        <span>{t.pessoa.sumiu}</span>
      </span>
    );
  }
  return (
    <Link href={enderecos.perfil(lang, handle)} className="al-fg al-fg-pessoa al-fg-torto-dir" aria-label={preencherStory(t.pessoa.abrir, { nome: nome || handle })}>
      <IconeArroba />
      <span>{handle}</span>
    </Link>
  );
}

/** A menção no "criar": o @ da pessoa (o banco confere se existe, se é da Alumia e se não há bloqueio). */
export function PessoaEditar({ t, handle, aoMudar }: { t: T; handle: string; aoMudar: (h: string) => void }) {
  const id = useId();
  const limpo = handle.replace(/^@/, "").toLowerCase();
  return (
    <div className="al-fg al-fg-pessoa al-fg-pessoa-editar al-fg-torto-dir">
      <IconeArroba />
      <label htmlFor={id} className="sr-only">
        {t.pessoa.campo}
      </label>
      <input
        id={id}
        className="al-fg-campo al-fg-campo-limpo"
        value={handle}
        maxLength={21}
        placeholder={t.pessoa.campo}
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={limpo !== "" && !handleOk(limpo) ? true : undefined}
        aria-describedby={`${id}-ajuda`}
        onChange={(e) => aoMudar(e.target.value.replace(/\s+/g, ""))}
      />
      <span id={`${id}-ajuda`} className="sr-only">
        {t.pessoa.ajuda}
      </span>
    </div>
  );
}

/** A tag limpa como o banco guarda: sem #, minúscula, só [a-z0-9_] (2 a 40). Nula se não serve. */
export function tagDaCampanha(bruta: string): string | null {
  const t = bruta.trim().replace(/^#/, "").toLowerCase();
  return /^[a-z0-9_]{2,40}$/.test(t) && /[a-z_]/.test(t) ? t : null;
}

/** #campanha no visor; com a corrente, "Adicionar o seu" abre o "criar" já com a mesma #. */
export function CampanhaVer({ f, t, lang, meu }: { f: FigurinhaCampanha; t: T; lang: string; meu: boolean }) {
  return (
    <div className="al-fg al-fg-campanha al-fg-torto-esq">
      <p className="al-fg-campanha-tag">#{f.tag}</p>
      {f.corrente ? (
        <>
          {f.total ? <p className="al-fg-nota al-fg-campanha-total">{noPlural(lang, f.total, t.campanha.totalN)}</p> : null}
          {!meu ? (
            <Link href={enderecosDosStories.criarNaCorrente(lang, f.tag)} className="al-fg-campanha-botao">
              <span aria-hidden>＋</span> {t.campanha.adicionar}
            </Link>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** #campanha no "criar": a tag e se vira corrente. */
export function CampanhaEditar({ t, tag, corrente, aoMudar }: { t: T; tag: string; corrente: boolean; aoMudar: (tag: string, corrente: boolean) => void }) {
  const id = useId();
  const invalida = tag.trim() !== "" && !tagDaCampanha(tag);
  return (
    <div className="al-fg al-fg-campanha al-fg-torto-esq">
      <label htmlFor={id} className="sr-only">
        {t.campanha.campo}
      </label>
      <input
        id={id}
        className="al-fg-campo al-fg-campo-limpo al-fg-campanha-tag"
        value={tag}
        maxLength={41}
        placeholder={t.campanha.campo}
        autoCapitalize="none"
        spellCheck={false}
        aria-invalid={invalida || undefined}
        aria-describedby={`${id}-ajuda`}
        onChange={(e) => aoMudar(e.target.value.replace(/\s+/g, ""), corrente)}
      />
      <p id={`${id}-ajuda`} className="al-fg-nota">
        {t.campanha.ajuda}
      </p>
      <label className="al-fg-campanha-corrente">
        <input type="checkbox" checked={corrente} onChange={(e) => aoMudar(tag, e.target.checked)} />
        <span>{t.campanha.corrente}</span>
      </label>
    </div>
  );
}

/** A resposta publicada: a pergunta em cima, a resposta embaixo, e NUNCA quem respondeu. */
export function RespostaVer({ pergunta, texto, t }: { pergunta: string; texto: string; t: T }) {
  return (
    <figure className="al-fg al-fg-papel al-fg-resposta al-fg-torto-dir">
      <figcaption className="al-fg-etiqueta">{pergunta}</figcaption>
      <blockquote className="al-fg-resposta-texto">{texto}</blockquote>
      <span className="sr-only">{t.resposta.publicada}</span>
    </figure>
  );
}
