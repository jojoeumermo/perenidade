// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { CampoDeQuando } from "../../ui/CampoDeQuando";
import { preencher } from "@/lib/rede/preencher";
import { LIMITES_PUBLICAR } from "@/lib/rede/tipos-publicar";
import { BorrarRostos } from "../BorrarRostos";
import { Agendados, Gravador, type PubDoEscrever } from "../ExtrasDoEscrever";
import type { TextosAlumia2 } from "./textos";
import { Icone } from "./icones";

const PRAZOS = [1, 6, 24, 72, 168] as const;

/**
 * Os anexos do Escrever novo (prancha celular-escrever-ato): no lugar das caixas cinzas de antes ("Imagens", "Áudio", "Publicar
 * mais tarde"), uma fileira de ícones (imagem, áudio, enquete, mais tarde) com o contador em anel do lado; o que a pessoa põe
 * aparece logo acima, como cartões: as imagens em miniatura (com a descrição, borrar rostos e tirar), o áudio gravado, as opções
 * da enquete e a hora marcada. A lógica (subir, tirar metadado, checar dado pessoal) é a mesma do pacote publicar (useEscreverPub).
 */
export function AnexosDoEscrever({
  pub,
  t,
  lang,
  resposta,
  tamanho,
  maximo,
  enquete,
  aoEnquete,
}: {
  pub: PubDoEscrever;
  t: TextosAlumia2;
  lang: string;
  resposta: boolean;
  tamanho: number;
  maximo: number;
  /** A enquete é um tipo do compositor: o ícone liga e desliga o tipo. */
  enquete: boolean;
  aoEnquete?: (ligar: boolean) => void;
}) {
  const tp = pub.t;
  const entrada = useRef<HTMLInputElement>(null);
  const [erroImagem, setErroImagem] = useState("");
  const [borrando, setBorrando] = useState<string | null>(null);
  const [gravador, setGravador] = useState(false);
  const [agenda, setAgenda] = useState(Boolean(pub.agendar));
  // Foco (WCAG 2.4.3): o cartão que abre recebe o foco (o botão Gravar, o campo da hora, a primeira opção da enquete); o cartão que
  // fecha devolve o foco ao ícone que o abriu. Sem isso, o foco caía no <body>, fora do diálogo.
  const cartaoAudio = useRef<HTMLDivElement>(null);
  const cartaoAgenda = useRef<HTMLDivElement>(null);
  const cartaoEnquete = useRef<HTMLFieldSetElement>(null);
  const iconeAudio = useRef<HTMLButtonElement>(null);
  const iconeAgenda = useRef<HTMLButtonElement>(null);
  const iconeEnquete = useRef<HTMLButtonElement>(null);
  const comAudio = gravador || Boolean(pub.audio);
  const foiAberto = useRef({ audio: comAudio, agenda, enquete: pub.enquete });
  useEffect(() => {
    const antes = foiAberto.current;
    const agora = { audio: comAudio, agenda, enquete: pub.enquete };
    foiAberto.current = agora;
    const focar = (abriu: boolean, fechou: boolean, cartao: HTMLElement | null, icone: HTMLElement | null, alvo: string) => {
      if (abriu) window.setTimeout(() => cartao?.querySelector<HTMLElement>(alvo)?.focus(), 30);
      // Só devolve quando o foco ficou perdido (no <body> ou num cartão que sumiu), para não roubar o foco de quem já foi adiante.
      else if (fechou && (document.activeElement === document.body || !document.activeElement?.isConnected)) icone?.focus();
    };
    focar(!antes.audio && agora.audio, antes.audio && !agora.audio, cartaoAudio.current, iconeAudio.current, "button:not([disabled])");
    focar(!antes.agenda && agora.agenda, antes.agenda && !agora.agenda, cartaoAgenda.current, iconeAgenda.current, "input");
    focar(!antes.enquete && agora.enquete, antes.enquete && !agora.enquete, cartaoEnquete.current, iconeEnquete.current, "input");
  }, [comAudio, agenda, pub.enquete]);
  if (!tp) return null;
  const noBorrado = pub.imagens.find((i) => i.id === borrando);
  const cabeImagem = pub.imagens.length < LIMITES_PUBLICAR.imagens && !pub.audio && !gravador;
  const cabeAudio = !pub.imagens.length;
  const { minimo, maximo: maxAgenda } = pub.limitesDaAgenda;
  const textoDoAchado = (tipo: string) => (tp.checagem as Record<string, string>)[tipo];

  return (
    <div className="al2-anexos space-y-3">
      {pub.recuperado && (
        <p role="status" className="al2-nota">
          <Icone nome="visto" className="h-4 w-4" />
          {tp.rascunho.recuperado}
        </p>
      )}

      {/* Enquete: as opções em fileira, como as barras do cartão. */}
      {pub.enquete && (
        <fieldset ref={cartaoEnquete} className="al2-anexo al2-anexo-enquete">
          <legend className="sr-only">{tp.enquete.rotulo}</legend>
          <ol className="space-y-2">
            {pub.opcoes.map((o, i) => (
              <li key={i} className="al2-opcao">
                <span aria-hidden className="al2-opcao-n">{i + 1}</span>
                <label className="min-w-0 flex-1">
                  <span className="sr-only">{preencher(tp.enquete.opcao, { n: i + 1 })}</span>
                  <input
                    className="al2-opcao-campo"
                    placeholder={preencher(tp.enquete.opcao, { n: i + 1 })}
                    maxLength={LIMITES_PUBLICAR.opcaoTexto}
                    value={o}
                    onChange={(e) => pub.setOpcoes((l) => l.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                </label>
                {pub.opcoes.length > LIMITES_PUBLICAR.opcoesMin && (
                  <button type="button" className="al2-acao" aria-label={preencher(tp.enquete.tirar, { n: i + 1 })} title={preencher(tp.enquete.tirar, { n: i + 1 })} onClick={() => pub.setOpcoes((l) => l.filter((_, j) => j !== i))}>
                    <Icone nome="fechar" className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {pub.opcoes.length < LIMITES_PUBLICAR.opcoesMax && (
              <button type="button" className="al2-chip" onClick={() => pub.setOpcoes((l) => [...l, ""])}>
                <Icone nome="mais" className="h-4 w-4" />
                {tp.enquete.mais}
              </button>
            )}
            <label className="al2-chip">
              <Icone nome="relogio" className="h-4 w-4" />
              <span className="sr-only">{tp.enquete.prazo}</span>
              <select className="al2-chip-select" value={pub.horas} onChange={(e) => pub.setHoras(Number(e.target.value))}>
                {PRAZOS.map((h) => (
                  <option key={h} value={h}>
                    {(tp.enquete as Record<string, string>)[`p${h}`]}
                  </option>
                ))}
              </select>
            </label>
            <label className="al2-chip cursor-pointer">
              <input type="checkbox" className="al2-caixinha" checked={pub.multipla} onChange={(e) => pub.setMultipla(e.target.checked)} />
              {tp.enquete.multipla}
            </label>
          </div>
          <p className="al2-nota mt-2">
            <Icone nome="cadeado" className="h-4 w-4" />
            {tp.enquete.secreto}
          </p>
        </fieldset>
      )}

      {/* Imagens: miniaturas com a descrição logo embaixo (o lembrete de alt é suave, não bloqueia). */}
      {pub.imagens.length > 0 && (
        <ul className={`al2-miniaturas al2-miniaturas-${pub.imagens.length}`} aria-label={tp.imagens.titulo}>
          {pub.imagens.map((i, n) => (
            <li key={i.id} className="al2-miniatura">
              <div className="relative">
                {/* A prévia local da imagem (blob:), já sem metadado. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.url} alt="" width={i.largura} height={i.altura} className="aspect-[4/3] w-full rounded-xl object-cover" />
                <div className="absolute right-1.5 top-1.5 flex gap-1">
                  <button type="button" className="al2-sobre-imagem" onClick={() => setBorrando(i.id)} title={tp.imagens.borrar}>
                    {tp.imagens.borrar}
                  </button>
                  <button type="button" className="al2-sobre-imagem al2-sobre-imagem-x" onClick={() => pub.tirarImagem(i.id)} aria-label={preencher(tp.imagens.tirar, { n: n + 1 })} title={preencher(tp.imagens.tirar, { n: n + 1 })}>
                    <Icone nome="fechar" className="h-4 w-4" grosso />
                  </button>
                </div>
                {i.areas.length > 0 && <span className="al2-sobre-imagem absolute bottom-1.5 left-1.5">{preencher(tp.imagens.borradas, { n: i.areas.length })}</span>}
              </div>
              <label className="mt-1.5 block">
                <span className="sr-only">{tp.imagens.alt}</span>
                <input className={`al2-alt ${i.alt.trim() ? "" : "al2-alt-falta"}`} placeholder={tp.imagens.altDica} value={i.alt} maxLength={LIMITES_PUBLICAR.textoAlt} onChange={(e) => pub.mudarAlt(i.id, e.target.value)} />
              </label>
            </li>
          ))}
        </ul>
      )}
      {pub.imagens.length > 0 && <p className="al2-nota">{pub.imagens.some((i) => !i.alt.trim()) ? tp.imagens.altFalta : tp.imagens.limpa}</p>}
      {noBorrado && (
        <BorrarRostos
          t={tp}
          base={noBorrado.base}
          areasIniciais={noBorrado.areas}
          aoCancelar={() => setBorrando(null)}
          aoConcluir={(areas) => {
            setBorrando(null);
            void pub.borrar(noBorrado.id, areas);
          }}
        />
      )}
      {erroImagem && <p role="alert" className="text-sm text-[var(--oxblood)]">{erroImagem}</p>}

      {/* Áudio: só aparece quando a pessoa toca no microfone (ou já gravou). */}
      {cabeAudio && (gravador || pub.audio) && (
        <div ref={cartaoAudio} className="al2-anexo flex items-center gap-2">
          <Icone nome="microfone" className="h-5 w-5 shrink-0 text-[var(--al-vermelho)]" />
          <div className="min-w-0 flex-1">
            <Gravador
              t={tp}
              audio={pub.audio}
              aoGravar={pub.setAudio}
              aoTirar={() => {
                pub.setAudio(null);
              }}
              classeBotao="al-botao al-botao-contorno al-botao-p"
              comecarJa={!pub.audio}
            />
          </div>
          {!pub.audio && (
            <button type="button" className="al2-acao" aria-label={tp.audio.tirar} title={tp.audio.tirar} onClick={() => setGravador(false)}>
              <Icone nome="fechar" className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Mais tarde: a hora numa pílula; a fila das agendadas embaixo. */}
      {!resposta && agenda && (
        <div ref={cartaoAgenda} className="al2-anexo al2-agenda">
          {/* Título e o X numa linha; o dia e a hora numa linha própria, com a largura toda (no celular nada fica recuado). */}
          <div className="flex items-center gap-2">
            <Icone nome="relogio" className="h-5 w-5 shrink-0 text-[var(--al-dourado)]" />
            <label htmlFor="al2-agenda-quando" className="min-w-0 flex-1 text-sm font-bold">
              {tp.agendar.rotulo}
            </label>
            <button
              type="button"
              className="al2-acao"
              aria-label={tp.agendar.cancelar}
              title={tp.agendar.cancelar}
              onClick={() => {
                pub.setAgendar("");
                setAgenda(false);
              }}
            >
              <Icone nome="fechar" className="h-4 w-4" />
            </button>
          </div>
          <CampoDeQuando id="al2-agenda-quando" className="mt-2 w-full" valor={pub.agendar} aoMudar={pub.setAgendar} lang={lang} vazio={t.escrever.escolherQuando} min={minimo} max={maxAgenda} />
          {pub.agendar && !pub.agendaOk && <p role="alert" className="mt-2 text-sm text-[var(--oxblood)]">{tp.agendar.cedo}</p>}
          <div className="al2-agendados mt-2 text-[var(--al-texto-2)] empty:hidden">
            <Agendados t={tp} lang={lang} />
          </div>
        </div>
      )}

      {(pub.previa || pub.previaEstado !== "parada") && (
        <div className="al2-anexo text-sm" aria-live="polite">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--al-texto-3)]">{tp.previa.titulo}</p>
              {pub.previaEstado === "buscando" && <div className="al-esq mt-2 h-10 rounded-lg bg-[var(--al-superficie-2)]" />}
              {pub.previaEstado === "falhou" && <p className="text-[var(--al-texto-3)]">{tp.previa.falha}</p>}
              {pub.previa && (
                <>
                  <p className="text-xs text-[var(--al-texto-3)]">{pub.previa.dominio}</p>
                  {pub.previa.titulo && <p className="font-bold">{pub.previa.titulo}</p>}
                  {pub.previa.descricao && <p className="line-clamp-2 text-[var(--al-texto-2)]">{pub.previa.descricao}</p>}
                  <p className="mt-1 text-xs text-[var(--al-texto-3)]">{tp.previa.nota}</p>
                </>
              )}
            </div>
            <button type="button" className="al2-acao" aria-label={tp.previa.tirar} title={tp.previa.tirar} onClick={pub.tirarPrevia}>
              <Icone nome="fechar" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {resposta && (
        <label className="al2-chip cursor-pointer">
          <input type="checkbox" className="al2-caixinha" checked={pub.fio} onChange={(e) => pub.setFio(e.target.checked)} />
          {tp.fio.continuar}
        </label>
      )}

      {/* A fileira de ícones + o contador em anel. */}
      <div className="al2-ferramentas" role="toolbar" aria-label={t.escrever.anexos}>
        <input
          ref={entrada}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const arquivos = e.target.files;
            if (arquivos?.length) void pub.adicionarImagem(arquivos).then((erro) => setErroImagem(erro ? ((tp.imagens as Record<string, string>)[erro] ?? tp.imagens.invalida) : ""));
            e.target.value = "";
          }}
        />
        <button type="button" className="al2-ferramenta" onClick={() => entrada.current?.click()} disabled={!cabeImagem} aria-label={tp.imagens.adicionar} title={`${tp.imagens.adicionar} · ${tp.imagens.limpa}`}>
          <Icone nome="imagem" className="h-[22px] w-[22px]" />
          {pub.imagens.length > 0 && <span className="al2-ferramenta-n">{pub.imagens.length}</span>}
        </button>
        <button ref={iconeAudio} type="button" className="al2-ferramenta" onClick={() => setGravador(true)} disabled={!cabeAudio || gravador || Boolean(pub.audio)} aria-pressed={gravador || Boolean(pub.audio)} aria-label={t.escrever.gravarAudio} title={t.escrever.gravarAudio}>
          <Icone nome="microfone" className="h-[22px] w-[22px]" />
        </button>
        {aoEnquete && (
          <button ref={iconeEnquete} type="button" className="al2-ferramenta" onClick={() => aoEnquete(!enquete)} aria-pressed={enquete} aria-label={t.compositor.enquete} title={t.compositor.enquete}>
            <Icone nome="enquete" className="h-[22px] w-[22px]" />
          </button>
        )}
        {!resposta && (
          <button ref={iconeAgenda} type="button" className="al2-ferramenta" onClick={() => setAgenda((x) => !x)} aria-pressed={agenda} aria-label={tp.agendar.rotulo} title={tp.agendar.rotulo}>
            <Icone nome="relogio" className="h-[22px] w-[22px]" />
          </button>
        )}
        <Contador n={tamanho} max={maximo} rotulo={preencher(t.escrever.contador, { n: tamanho, max: maximo })} />
      </div>

      <div aria-live="polite" className="space-y-1">
        {pub.achados.bloqueia.map((a, i) => (
          <p key={`b${i}`} role="alert" className="al2-nota al2-nota-alerta">
            <Icone nome="alerta" className="h-4 w-4" />
            {textoDoAchado(a.tipo)}
          </p>
        ))}
        {pub.achados.avisa.map((a, i) => (
          <p key={`a${i}`} role="status" className="al2-nota">
            {textoDoAchado(a.tipo)}
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * O contador em anel (como no Mastodon e no Bluesky, sem número até faltar pouco): o anel enche, fica dourado nos últimos 10% e
 * vermelho no limite; o número aparece quando faltam 50 ou menos. O leitor de tela lê "N de MAX" (o anel é decorativo).
 */
export function Contador({ n, max, rotulo }: { n: number; max: number; rotulo: string }) {
  const faltam = max - n;
  const perto = faltam <= 50;
  // Longe do limite, o anel é um aro cinza parado (um arco pela metade parecia "carregando"). Perto, ele enche de dourado e o
  // número que falta aparece dentro; no limite, fica vermelho.
  const parte = perto ? Math.min(1, n / max) : 0;
  const r = 11;
  const volta = 2 * Math.PI * r;
  const cor = faltam <= 0 ? "var(--al-vermelho)" : "var(--al-dourado)";
  return (
    <span className={`al2-contador ${perto ? "al2-contador-perto" : ""}`} title={rotulo}>
      <span className="sr-only" aria-live="polite">{perto ? rotulo : ""}</span>
      <span className="relative grid h-[30px] w-[30px] place-items-center">
        <svg aria-hidden viewBox="0 0 30 30" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="15" cy="15" r={r} fill="none" stroke="var(--al-superficie-2)" strokeWidth="2.5" />
          {perto && <circle cx="15" cy="15" r={r} fill="none" stroke={cor} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={volta} strokeDashoffset={volta * (1 - parte)} className="al2-contador-arco" />}
        </svg>
        {perto && (
          <span aria-hidden className={`al2-contador-n relative text-[0.6875rem] tabular-nums ${faltam <= 0 ? "text-[var(--al-vermelho)]" : "text-[var(--al-texto)]"}`}>
            {faltam}
          </span>
        )}
      </span>
    </span>
  );
}
