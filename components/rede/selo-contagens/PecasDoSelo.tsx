// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As peças da tela do Prompt 4, itens 3 e 5 (interruptor "alumia-p4-selo-contagens"):
//   · SeloDaPessoa: o selo de verificado ao lado do @, que explica num toque quem verificou e o que ele quer dizer;
//   · ContagemDoPerfil: "N pessoas seguem" só se a dona escolheu mostrar; abaixo de 3, "menos de 3" com o "por que não aparece?";
//   · ApoiosPublicos: o mesmo para os apoios de um post (os pedidos de vários cartões viram uma chamada só);
//   · BlocoSeloEContagens: pedir o selo e as duas chaves, na tela de editar o perfil.
// Nenhuma peça mostra lista de quem segue ou apoiou: o banco nunca manda. Quem chama confere a flag (seloContagensLigado).
import { useEffect, useId, useState, type ReactNode } from "react";
import { dataCurta } from "@/lib/rede/org/contagem";
import { preencher } from "@/lib/rede/preencher";
import {
  CANAIS_DO_SELO,
  contagemPublicada,
  redeSelo,
  TIPOS_DE_SELO_DE_PESSOA,
  type CanalDoSelo,
  type ContagemDeSeguidores,
  type MeuSeloEContagens,
  type SeloDoPerfil,
  type TipoDeSeloDePessoa,
} from "@/lib/rede/selo-contagens/cliente";
import type { TextosDaRede } from "@/lib/rede/textos";
import { codigoDoErro, textoDoErro } from "../erros";
import { PorQueSemNumero } from "../uso/PorQueSemNumero";
import { useTextosDoSelo, type TextosDoSelo } from "./textos";
import "./selo-contagens.css";

function Visto() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" width="16" height="16" className="al-sc-visto">
      <rect x={0.5} y={0.5} width={15} height={15} rx={4} fill="var(--al-vermelho, #c21f16)" />
      <path d="M4 8.3 6.7 11 12 5.2" fill="none" stroke="var(--al-sobre-vermelho, #fff)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** O selo de verificado de uma pessoa (ou de organização), ao lado do @. Sem selo: nada. Um toque abre a explicação. */
export function SeloDaPessoa({ handle, lang }: { handle: string; lang: string }) {
  const t = useTextosDoSelo(lang);
  const [selo, setSelo] = useState<{ handle: string; selo: SeloDoPerfil | null } | null>(null);
  const [aberto, setAberto] = useState(false);
  const id = useId();
  useEffect(() => {
    let vivo = true;
    redeSelo
      .seloDe(handle)
      .then((s) => vivo && setSelo({ handle, selo: s }))
      .catch(() => vivo && setSelo({ handle, selo: null }));
    return () => {
      vivo = false;
    };
  }, [handle]);
  const atual = selo?.handle === handle ? selo.selo : null;
  if (!t || !atual) return null;
  const rotulo = t.selo.rotulos[atual.tipo] ?? t.selo.rotulos.pessoa_publica;
  return (
    <span className="al-sc-selo" data-tipo={atual.tipo}>
      <button type="button" className="al-sc-selo-botao" aria-expanded={aberto} aria-controls={id} title={t.selo.abrir} onClick={() => setAberto((a) => !a)}>
        <Visto />
        <span>{rotulo}</span>
        <span className="sr-only">. {t.selo.abrir}</span>
      </button>
      {aberto ? (
        <span id={id} role="note" className="al-sc-balao">
          <span className="al-sc-balao-texto">{t.selo.explica}</span>
          <span className="al-sc-balao-desde">{preencher(t.selo.desde, { data: dataCurta(atual.desde, lang) })}</span>
          <button type="button" className="al-sc-fechar" onClick={() => setAberto(false)}>
            {t.selo.fechar}
          </button>
        </span>
      ) : null}
    </span>
  );
}

/**
 * Quantas pessoas seguem, no perfil, só se a dona escolheu mostrar. Sem a escolha (o padrão), aparece `semEscolha` (a frase de
 * sempre: "sem contagens públicas"). Abaixo de 3: "menos de 3" e o "por que não aparece o número?".
 */
export function ContagemDoPerfil({ handle, lang, semEscolha }: { handle: string; lang: string; semEscolha: ReactNode }) {
  const t = useTextosDoSelo(lang);
  const [lida, setLida] = useState<{ handle: string; c: ContagemDeSeguidores } | null>(null);
  useEffect(() => {
    let vivo = true;
    redeSelo
      .seguidoresDe(handle)
      .then((c) => vivo && setLida({ handle, c }))
      .catch(() => vivo && setLida({ handle, c: { mostra: false } }));
    return () => {
      vivo = false;
    };
  }, [handle]);
  const c = lida?.handle === handle ? lida.c : null;
  if (!t || !c) return null;
  if (!c.mostra) return <>{semEscolha}</>;
  const n = contagemPublicada(c.total ?? null);
  return (
    <p className="al-sc-contagem al-perfil-nota">
      {n === "menos" || n === null ? (
        <>
          {t.contagens.seguemMenos}
          <PorQueSemNumero lang={lang} motivo="ambos" />
        </>
      ) : (
        preencher(t.contagens.seguem, { n: String(n) })
      )}
    </p>
  );
}

// Os cartões de uma linha pedem os apoios juntos: os ids que chegam no mesmo instante vão numa chamada só (até 100).
let fila: { ids: Set<string>; promessa: Promise<Record<string, number | null>> } | null = null;
function apoiosDoPost(id: string): Promise<{ tem: boolean; total: number | null }> {
  if (!fila || fila.ids.size >= 100) {
    const ids = new Set<string>();
    const promessa = new Promise<Record<string, number | null>>((resolver) => {
      queueMicrotask(() => {
        if (fila?.ids === ids) fila = null;
        redeSelo.apoiosDe([...ids]).then(resolver, () => resolver({}));
      });
    });
    fila = { ids, promessa };
  }
  fila.ids.add(id);
  return fila.promessa.then((r) => ({ tem: id in r, total: r[id] ?? null }));
}

/**
 * Os apoios de um post, para quem não é a autora, só se a autora escolheu mostrar. Post fora da resposta: nada. Abaixo de 3:
 * "menos de 3 apoios" com o "por que não aparece?". Para encaixar no cartão do post (o lote do cartão encaixa; este lote não o toca).
 */
export function ApoiosPublicos({ post, lang }: { post: string; lang: string }) {
  const t = useTextosDoSelo(lang);
  const [lido, setLido] = useState<{ post: string; tem: boolean; total: number | null } | null>(null);
  useEffect(() => {
    let vivo = true;
    apoiosDoPost(post).then((r) => vivo && setLido({ post, ...r }));
    return () => {
      vivo = false;
    };
  }, [post]);
  if (!t || !lido || lido.post !== post || !lido.tem) return null;
  const n = contagemPublicada(lido.total);
  return (
    <span className="al-sc-apoios">
      {n === "menos" || n === null ? (
        <>
          {t.contagens.apoiosMenos}
          <PorQueSemNumero lang={lang} motivo="ambos" />
        </>
      ) : (
        preencher(t.contagens.apoiosN, { n: String(n) })
      )}
    </span>
  );
}

function textoDoErroDoSelo(t: TextosDoSelo, s: Pick<TextosDaRede, "erros">, e: unknown): string {
  const erros = t.selo.erros as Record<string, string>;
  return erros[codigoDoErro(e)] ?? textoDoErro(s, e);
}

/** Pedir o selo e as duas chaves das contagens, na tela de editar o perfil. Interruptor desligado no banco: nada aparece. */
export function BlocoSeloEContagens({ lang, s }: { lang: string; s: Pick<TextosDaRede, "erros"> }) {
  const t = useTextosDoSelo(lang);
  const [meu, setMeu] = useState<MeuSeloEContagens | null>(null);
  const [tipo, setTipo] = useState<TipoDeSeloDePessoa>("pessoa_publica");
  const [canal, setCanal] = useState<CanalDoSelo>("email_institucional");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ onde: "selo" | "contagens"; texto: string; erro: boolean } | null>(null);
  const idSelo = useId();
  const idContagens = useId();

  const ler = () =>
    redeSelo
      .meu()
      .then(setMeu)
      .catch(() => setMeu({ ligado: false }));
  useEffect(() => {
    void ler();
  }, []);

  if (!t || !meu?.ligado) return null;

  async function fazer(onde: "selo" | "contagens", acao: () => Promise<unknown>, ok: string) {
    setOcupado(true);
    setAviso(null);
    try {
      await acao();
      await ler();
      setAviso({ onde, texto: ok, erro: false });
    } catch (e) {
      await ler();
      setAviso({ onde, texto: textoDoErroDoSelo(t!, s, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }
  const mensagem = (onde: "selo" | "contagens") =>
    aviso?.onde === onde ? (
      <p role={aviso.erro ? "alert" : "status"} className={aviso.erro ? "al-sc-erro" : "al-sc-ok"}>
        {aviso.texto}
      </p>
    ) : null;
  const seguidores = meu.seguidores ?? false;
  const apoios = meu.apoios ?? false;
  /** As chaves mudam na tela na hora; se o banco recusar, a releitura devolve o que estava gravado. */
  const salvarChaves = (novoSeguidores: boolean, novoApoios: boolean) => {
    setMeu((m) => (m ? { ...m, seguidores: novoSeguidores, apoios: novoApoios } : m));
    void fazer("contagens", () => redeSelo.salvarContagens(novoSeguidores, novoApoios), t.contagens.salvo);
  };

  return (
    <div className="al-sc-bloco">
      <section aria-labelledby={idSelo} className="al-sc-parte">
        <h2 id={idSelo} className="al-sc-titulo">
          {t.selo.pedir.titulo}
        </h2>
        <p className="al-sc-texto">{t.selo.pedir.sobre}</p>
        <p className="al-sc-texto al-sc-explica">{t.selo.explica}</p>
        {meu.org ? (
          <p className="al-sc-texto">{t.selo.pedir.org}</p>
        ) : meu.selo ? (
          <p className="al-sc-ok" role="status">
            {preencher(t.selo.pedir.tem, { tipo: t.selo.rotulos[meu.selo.tipo], data: dataCurta(meu.selo.desde, lang) })}
          </p>
        ) : meu.pedido ? (
          <>
            <p className="al-sc-texto" role="status">
              {preencher(t.selo.pedir.esperando, { data: dataCurta(meu.pedido.desde, lang), canal: t.selo.pedir.canais[meu.pedido.canal] })}
            </p>
            <div className="al-sc-acoes">
              <button type="button" className="al-sc-botao al-sc-botao-vazado" disabled={ocupado} onClick={() => fazer("selo", () => redeSelo.desistir(), t.selo.pedir.desistido)}>
                {t.selo.pedir.desistir}
              </button>
            </div>
          </>
        ) : (
          <form
            className="al-sc-form"
            onSubmit={(e) => {
              e.preventDefault();
              void fazer("selo", () => redeSelo.pedir(tipo, canal), t.selo.pedir.enviado);
            }}
          >
            <fieldset className="al-sc-grupo">
              <legend className="al-sc-legenda">{t.selo.pedir.tipo}</legend>
              {TIPOS_DE_SELO_DE_PESSOA.map((x) => (
                <label key={x} className="al-sc-opcao">
                  <input type="radio" name="al-sc-tipo" value={x} checked={tipo === x} onChange={() => setTipo(x)} />
                  <span>{t.selo.pedir.tipos[x]}</span>
                </label>
              ))}
            </fieldset>
            <fieldset className="al-sc-grupo">
              <legend className="al-sc-legenda">{t.selo.pedir.canal}</legend>
              {CANAIS_DO_SELO.map((x) => (
                <label key={x} className="al-sc-opcao">
                  <input type="radio" name="al-sc-canal" value={x} checked={canal === x} onChange={() => setCanal(x)} />
                  <span>{t.selo.pedir.canais[x]}</span>
                </label>
              ))}
            </fieldset>
            <div className="al-sc-acoes">
              <button type="submit" className="al-sc-botao" disabled={ocupado}>
                {t.selo.pedir.enviar}
              </button>
            </div>
          </form>
        )}
        {mensagem("selo")}
      </section>

      <section aria-labelledby={idContagens} className="al-sc-parte">
        <h2 id={idContagens} className="al-sc-titulo">
          {t.contagens.titulo}
        </h2>
        <p className="al-sc-texto">{t.contagens.sobre}</p>
        <label className="al-sc-opcao">
          <input type="checkbox" checked={seguidores} disabled={ocupado} onChange={(e) => salvarChaves(e.target.checked, apoios)} />
          <span>{t.contagens.seguidores}</span>
        </label>
        <label className="al-sc-opcao">
          <input type="checkbox" checked={apoios} disabled={ocupado} onChange={(e) => salvarChaves(seguidores, e.target.checked)} />
          <span>{t.contagens.apoios}</span>
        </label>
        {mensagem("contagens")}
      </section>
    </div>
  );
}
