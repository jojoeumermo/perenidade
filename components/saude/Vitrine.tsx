// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { hasBackend, rpc } from "@/lib/backend";
import {
  AVISO_COMPLETO,
  CIENCIA,
  codigoDoCartao,
  CONSULTA_DO_CONSELHO,
  EMAIL_DE_CONTATO,
  linkDoInstagram,
  linkDoWhatsapp,
  nomeDaModalidade,
  nomeDoPublico,
  primeiroNome,
  type Profissional,
  profissaoValida,
  registroCompleto,
} from "@/lib/saude";
import { NOME_VITRINE } from "@/lib/mural-saude";
import { desenharCartao } from "./cartao";

const NOME_GUARDADO = "lucia:saude-nome";

/** Ícones de traço, no desenho do resto do site. */
const ICONES = {
  whatsapp: "M3 21l1.6-4.8A8.5 8.5 0 1 1 8 19.5L3 21z M9 9.5c.3 2 2.5 4.3 4.6 4.8l1.2-1.2 2 1-.6 1.8c-3.6.3-8.2-4.3-7.9-7.9l1.8-.6 1 2z",
  instagram: "M4 4h16v16H4z M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M17 6.8h.01",
  email: "M3 5h18v14H3z M3 6l9 7 9-7",
  site: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c3 3.5 3 14.5 0 18 M12 3c-3 3.5-3 14.5 0 18",
  baixar: "M12 4v11 M7 10l5 5 5-5 M5 20h14",
  local: "M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z M12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
} as const;
function Icone({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/** A vitrine: os perfis publicados pela coordenação (arquivo) e os do painel que estão aptos agora, em ordem alfabética. */
export function Vitrine({ estaticos }: { estaticos: Profissional[] }) {
  const [doBanco, setDoBanco] = useState<Profissional[]>([]);
  const [desligada, setDesligada] = useState(false);
  const [area, setArea] = useState("");
  const [contato, setContato] = useState<Profissional | null>(null);
  useEffect(() => {
    if (!hasBackend) return;
    let vivo = true;
    rpc<{ desligada: boolean; perfis: Profissional[] }>("saude_vitrine")
      .then((r) => {
        if (!vivo) return;
        setDesligada(r.desligada);
        setDoBanco(r.perfis ?? []);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  // Quem já está no painel não aparece duas vezes: o cartão do arquivo cede lugar ao perfil publicado pelo painel.
  const todos = useMemo(() => {
    const doPainel = new Set(doBanco.map((p) => p.nome.toLowerCase()));
    return [...doBanco, ...estaticos.filter((p) => !doPainel.has(p.nome.toLowerCase()))].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [estaticos, doBanco]);
  const areas = useMemo(() => [...new Set(todos.flatMap((p) => p.areas))].sort((a, b) => a.localeCompare(b, "pt-BR")), [todos]);
  const vistos = area ? todos.filter((p) => p.areas.includes(area)) : todos;

  if (desligada) return <p className="mt-10 border-2 border-[#221C17] p-6 text-center font-sans">O mural está pausado no momento. Em emergência: SAMU 192 · Bombeiros 193 · CVV 188.</p>;
  if (todos.length === 0) return <p className="mt-10 border border-dashed border-[#221C17]/40 p-10 text-center font-sans text-[#221C17]/75">Ainda não há profissionais no mural.</p>;

  return (
    <div className="mt-10">
      {areas.length > 1 && todos.length > 1 && (
        <div role="group" aria-label="Filtrar por área" className="mb-6 flex flex-wrap gap-2 font-sans text-sm">
          <button type="button" aria-pressed={!area} onClick={() => setArea("")} className={`cursor-pointer border px-3 py-1 ${!area ? "border-[#221C17] bg-[#221C17] text-[#F4EBDB]" : "border-[#221C17]/30 hover:border-[#221C17]"}`}>Todas as áreas</button>
          {areas.map((a) => (
            <button key={a} type="button" aria-pressed={area === a} onClick={() => setArea(a)} className={`cursor-pointer border px-3 py-1 ${area === a ? "border-[#221C17] bg-[#221C17] text-[#F4EBDB]" : "border-[#221C17]/30 hover:border-[#221C17]"}`}>{a}</button>
          ))}
        </div>
      )}
      <ul className={vistos.length === 1 ? "mx-auto max-w-4xl" : "grid gap-8 sm:grid-cols-2 lg:grid-cols-3"}>
        {vistos.map((p) => (
          <li key={p.id}>
            <CartaoDoProfissional p={p} unico={vistos.length === 1} abrir={() => setContato(p)} />
          </li>
        ))}
      </ul>
      {contato && <JanelaDeContato p={contato} fechar={() => setContato(null)} />}
    </div>
  );
}

/**
 * O cartão de cada profissional, em campos fixos: nome, a palavra da profissão, o registro e o link para conferir no
 * conselho; depois abordagem, áreas, público, modalidade, cidade, idiomas e o texto curto. Sem etiqueta, sem estrela,
 * sem valor, sem nota: o mural só mostra contatos, em ordem alfabética.
 */
export function CartaoDoProfissional({ p, unico = false, abrir }: { p: Profissional; unico?: boolean; abrir?: () => void }) {
  const consulta = CONSULTA_DO_CONSELHO[p.conselho.toUpperCase()];
  const publico = (p.publico ?? []).map((x) => nomeDoPublico[x]).filter(Boolean);
  const lugar = [p.cidade, p.estado].filter(Boolean).join(" / ");
  const rotulo = "text-xs uppercase tracking-wider text-[#221C17]/70";
  return (
    <article className={`saude-cartao relative border border-[#221C17]/40 bg-[#FBF6EC] text-[#221C17] ${unico ? "grid md:grid-cols-[minmax(0,20rem)_1fr]" : "flex h-full flex-col"}`}>
      {p.foto ? (
        <div className={`relative overflow-hidden border-b border-[#221C17]/20 ${unico ? "md:border-b-0 md:border-r" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.foto} alt={`Foto de ${p.nome}`} className={`w-full object-cover ${unico ? "aspect-[4/5] h-full" : "aspect-[4/5]"}`} loading="lazy" />
        </div>
      ) : (
        <div aria-hidden className={`flex aspect-[4/5] items-center justify-center border-b border-[#221C17]/20 bg-[#EFE4D0] font-serif text-6xl text-[#221C17]/60 ${unico ? "md:border-b-0 md:border-r" : ""}`}>{p.nome.split(/\s+/).map((x) => x[0]).slice(0, 2).join("")}</div>
      )}
      <div className={`flex flex-1 flex-col p-5 ${unico ? "md:p-8" : ""}`}>
        <h3 className={`font-serif font-semibold leading-tight ${unico ? "text-4xl md:text-[2.6rem]" : "text-3xl"}`}>{p.nome}</h3>
        <p className="mt-1 font-sans text-lg">{profissaoValida(p)} · <span className="font-mono">{registroCompleto(p)}</span></p>
        {consulta && <p className="mt-1 font-sans text-sm"><a href={consulta} target="_blank" rel="noopener noreferrer nofollow" className="underline hover:no-underline">Conferir registro no site do conselho ↗</a></p>}
        <dl className="mt-4 space-y-2 font-sans text-[0.95rem]">
          {p.abordagem && <div><dt className={rotulo}>Abordagem</dt><dd>{p.abordagem}</dd></div>}
          {p.areas.length > 0 && <div><dt className={rotulo}>Áreas de atuação</dt><dd>{p.areas.join(" · ")}</dd></div>}
          {publico.length > 0 && <div><dt className={rotulo}>Público</dt><dd>{publico.join(" · ")}</dd></div>}
          {p.modalidade && <div><dt className={rotulo}>Modalidade</dt><dd className="inline-flex items-center gap-1"><Icone d={ICONES.local} className="h-4 w-4" />{nomeDaModalidade[p.modalidade]}{lugar ? ` · ${lugar}` : ""}</dd></div>}
          {(p.idiomas ?? []).length > 0 && <div><dt className={rotulo}>Idiomas</dt><dd>{(p.idiomas ?? []).join(" · ")}</dd></div>}
        </dl>
        {p.bio && (
          <div className="mt-4">
            <p className={`font-sans ${rotulo}`}>Sobre meu trabalho</p>
            <p className="mt-1 whitespace-pre-line font-serif text-lg leading-relaxed">{p.bio}</p>
          </div>
        )}
        <div className="mt-auto pt-5">
          {abrir && (
            <button type="button" onClick={abrir} className="w-full cursor-pointer border border-[#221C17] bg-[#221C17] px-5 py-3 font-sans font-semibold text-[#F4EBDB] hover:bg-[#3a3029] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#221C17]">
              Ver contato
            </button>
          )}
          <p className="mt-3 font-sans text-xs leading-snug text-[#221C17]/75">
            {p.verificado_em ? `Registro conferido pela coordenação do mural em ${new Date(`${p.verificado_em}T12:00:00`).toLocaleDateString("pt-BR")}. ` : "Registro informado no perfil. "}
            O Instituto não indica nem responde pelo atendimento. Dúvida ou denúncia: <a href={`mailto:${EMAIL_DE_CONTATO}`} className="underline">{EMAIL_DE_CONTATO}</a>.
          </p>
        </div>
      </div>
    </article>
  );
}

/**
 * Antes do contato: os avisos e a ciência (que fica só neste aparelho). Depois, o cartão de encaminhamento para baixar
 * e mandar ao profissional, e os botões de contato que ele autorizou. Sem formulário, sem chat, sem nada no servidor.
 */
function JanelaDeContato({ p, fechar }: { p: Profissional; fechar: () => void }) {
  const [passo, setPasso] = useState<1 | 2>(1);
  const [ciente, setCiente] = useState(false);
  const [nome, setNome] = useState(() => {
    try {
      return window.localStorage.getItem(NOME_GUARDADO) ?? "";
    } catch {
      return "";
    }
  });
  const [imagem, setImagem] = useState<{ url: string; blob: Blob } | null>(null);
  const [erro, setErro] = useState("");
  const codigo = useMemo(() => codigoDoCartao(p.nome), [p.nome]);
  const caixa = useRef<HTMLDivElement>(null);
  const data = new Date().toLocaleDateString("pt-BR");
  const descricao = [profissaoValida(p), registroCompleto(p), p.abordagem].filter(Boolean).join(" · ");
  // O nome de quem procura é obrigatório: o profissional sabe com quem está falando desde a primeira mensagem.
  const nomeValido = nome.trim().replace(/\s+/g, " ").length >= 2 && /\p{L}/u.test(nome);
  const mensagem = `Olá, ${primeiroNome(p.nome)}! Meu nome é ${nome.trim().replace(/\s+/g, " ")}. Encontrei o seu contato no ${NOME_VITRINE} do Instituto Lúcia. Meu código de encaminhamento é ${codigo}.`;

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", tecla);
    caixa.current?.querySelector<HTMLElement>("button, input")?.focus();
    return () => window.removeEventListener("keydown", tecla);
  }, [fechar, passo]);
  useEffect(() => () => {
    if (imagem) URL.revokeObjectURL(imagem.url);
  }, [imagem]);

  async function seguir() {
    try {
      if (nomeValido) window.localStorage.setItem(NOME_GUARDADO, nome.trim());
    } catch {
      // sem armazenamento
    }
    try {
      const blob = await desenharCartao({ profissional: p.nome, descricao, quem: primeiroNome(nome), codigo, data });
      setImagem({ url: URL.createObjectURL(blob), blob });
      setPasso(2);
    } catch {
      setErro("Não deu para desenhar o cartão neste navegador. Os contatos continuam abaixo.");
      setPasso(2);
    }
  }
  const arquivo = `encaminhamento-${codigo}.png`;
  async function compartilhar() {
    if (!imagem) return;
    const file = new File([imagem.blob], arquivo, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: mensagem }).catch(() => undefined);
    }
  }
  const podeCompartilhar = typeof navigator !== "undefined" && Boolean(imagem) && Boolean(navigator.canShare?.({ files: [new File([new Blob()], "x.png", { type: "image/png" })] }));

  return (
    <div role="dialog" aria-modal aria-labelledby="saude-contato-titulo" className="fixed inset-0 z-50 flex items-center justify-center bg-[#17130e]/85 p-3 sm:p-6" onClick={(e) => e.target === e.currentTarget && fechar()}>
      <div ref={caixa} className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto border border-[#221C17] bg-[#F4EBDB] font-sans text-[#221C17] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#221C17]/30 px-5 py-3">
          <p id="saude-contato-titulo" className="font-semibold">{NOME_VITRINE} · contato: {p.nome}</p>
          <button type="button" onClick={fechar} aria-label="Fechar" className="cursor-pointer px-2 text-2xl leading-none hover:opacity-70">×</button>
        </div>
        {passo === 1 ? (
          <div className="p-5 sm:p-7">
            <h2 className="font-serif text-2xl font-semibold">Antes de entrar em contato</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[0.95rem]">
              {AVISO_COMPLETO.map((a) => <li key={a}>{a}</li>)}
            </ul>
            <label className="mt-5 block">
              <span className="font-semibold">Seu nome</span> <span className="text-[#221C17]/75">(obrigatório; vai no cartão e na mensagem para o profissional e fica só neste aparelho)</span>
              <input value={nome} onChange={(e) => setNome(e.target.value.slice(0, 60))} maxLength={60} required aria-required="true" autoComplete="name" placeholder="Como você quer ser chamado" className="mt-1 block w-full border border-[#221C17] bg-[#FBF6EC] px-3 py-2" />
              {nome.length > 0 && !nomeValido && <span role="status" className="mt-1 block text-sm font-semibold">Escreva o seu nome para continuar.</span>}
            </label>
            <label className="mt-4 flex items-start gap-3 border border-[#221C17]/50 bg-[#FBF6EC] p-3">
              <input type="checkbox" checked={ciente} onChange={(e) => setCiente(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
              <span>{CIENCIA}</span>
            </label>
            <button type="button" disabled={!ciente || !nomeValido} onClick={() => void seguir()} className="mt-5 w-full cursor-pointer bg-[#221C17] px-5 py-3 font-semibold text-[#F4EBDB] hover:bg-[#3a3029] disabled:cursor-not-allowed disabled:opacity-40">
              Continuar
            </button>
          </div>
        ) : (
          <div className="p-5 sm:p-7">
            <h2 className="font-serif text-2xl font-semibold">Seu cartão de encaminhamento</h2>
            <p className="mt-1 text-[#221C17]/80">Baixe e mande junto com a primeira mensagem: assim {primeiroNome(p.nome)} sabe que você encontrou o contato no mural. O código é sorteado aqui e não fica guardado em lugar nenhum.</p>
            {erro && <p role="status" className="mt-3 font-semibold">{erro}</p>}
            {imagem && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagem.url} alt={`Cartão de encaminhamento para ${p.nome}, código ${codigo}`} className="mx-auto mt-4 w-full max-w-sm border border-[#221C17]" />
            )}
            <p className="mt-3 text-center font-mono text-sm">Código: <strong>{codigo}</strong></p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {imagem && (
                <a href={imagem.url} download={arquivo} className="flex items-center justify-center gap-2 border border-[#221C17] bg-[#FBF6EC] px-4 py-3 font-semibold hover:bg-[#EFE4D0]">
                  <Icone d={ICONES.baixar} /> Baixar o cartão
                </a>
              )}
              {podeCompartilhar && (
                <button type="button" onClick={() => void compartilhar()} className="flex cursor-pointer items-center justify-center gap-2 border border-[#221C17] bg-[#FBF6EC] px-4 py-3 font-semibold hover:bg-[#EFE4D0]">
                  Compartilhar o cartão
                </button>
              )}
              {p.contatos.whatsapp && (
                <a href={linkDoWhatsapp(p.contatos.whatsapp, mensagem)} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center justify-center gap-2 border border-[#221C17] bg-[#221C17] px-4 py-3 font-semibold text-[#F4EBDB] hover:bg-[#3a3029]">
                  <Icone d={ICONES.whatsapp} /> WhatsApp
                </a>
              )}
              {p.contatos.instagram && (
                <a href={linkDoInstagram(p.contatos.instagram)} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center justify-center gap-2 border border-[#221C17] bg-[#221C17] px-4 py-3 font-semibold text-[#F4EBDB] hover:bg-[#3a3029]">
                  <Icone d={ICONES.instagram} /> Instagram @{p.contatos.instagram}
                </a>
              )}
              {p.contatos.email && (
                <a href={`mailto:${p.contatos.email}?subject=${encodeURIComponent(`Contato pelo ${NOME_VITRINE}`)}&body=${encodeURIComponent(mensagem)}`} className="flex items-center justify-center gap-2 border border-[#221C17] px-4 py-3 font-semibold hover:bg-[#EFE4D0]">
                  <Icone d={ICONES.email} /> E-mail
                </a>
              )}
              {p.contatos.site && (
                <a href={p.contatos.site} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center justify-center gap-2 border border-[#221C17] px-4 py-3 font-semibold hover:bg-[#EFE4D0]">
                  <Icone d={ICONES.site} /> Site
                </a>
              )}
            </div>
            <p className="mt-4 text-xs text-[#221C17]/75">Os botões abrem sites e aplicativos de terceiros, com as regras de privacidade deles. Não mande dados de saúde, exames ou documentos pelo site do instituto.</p>
          </div>
        )}
      </div>
    </div>
  );
}
