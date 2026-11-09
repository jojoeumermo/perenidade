// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { useEffect, useState } from "react";
import { conversa } from "@/lib/rede/cliente-conversa";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import { carregarTextosDaConversa, type TextosDaConversa } from "@/lib/rede/textos-conversa";
import { enderecos, type Post, type Situacao } from "@/lib/rede/tipos";
import {
  continuaEmOutraPagina,
  montarArvore,
  recuoDoNivel,
  type Arvore,
  type NoDaArvore,
  type OrdemDasRespostas,
  type SinteseDaConversa,
} from "@/lib/rede/tipos-conversa";
import { CartaoDePost } from "../CartaoDePost";
import { textoDoErro } from "../erros";
import { EsqueletoDaLinha } from "../Esqueletos";
import { useAlumia2 } from "./base3";
import { Citar } from "./Citar";
import TelaDaConversaAlumia from "./TelaDaConversaAlumia";
import { Ordem } from "./Ordem";
import { Sintese } from "./Sintese";

/** Os nós em fila, na ordem de leitura (cada resposta logo depois da que ela responde). */
function emFila(nos: readonly NoDaArvore[]): NoDaArvore[] {
  return nos.flatMap((no) => [no, ...emFila(no.filhos)]);
}

/**
 * A página de um post com a conversa em árvore (itens 24 a 28 do R4): as respostas em até 6 níveis (contando o post aberto), com
 * "continuar a conversa" em página própria no último; a ordem escolhida pela pessoa (com a fórmula escrita); a resposta que
 * resolveu a dúvida (marcada por quem fez a dúvida ou pela moderação); a síntese fixada no alto, com histórico; citar um post;
 * menções com link para o perfil. Substitui a lista simples da fundação; carregada sob demanda (components/rede/Rede.tsx).
 * Tudo o que a pessoa não pode ver já foi cortado no banco (a matriz vale para cada resposta).
 */
function TelaDaConversaDeHoje({
  id,
  lang,
  s,
  situacao,
  aoResponder,
}: {
  id: string;
  lang: string;
  s: TextosDaRede;
  situacao: Situacao;
  aoResponder: (p: Post) => void;
}) {
  const [t, setT] = useState<TextosDaConversa | null>(null);
  const [ordem, setOrdem] = useState<OrdemDasRespostas>("uteis");
  const [estado, setEstado] = useState<{ id: string; dado: Arvore | null; erro: string } | null>(null);
  const [versao, setVersao] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const [citando, setCitando] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    carregarTextosDaConversa(lang).then((x) => vivo && setT(x));
    return () => {
      vivo = false;
    };
  }, [lang]);

  useEffect(() => {
    let vivo = true;
    // Marca "buscando" antes do pedido (e não dentro do efeito): o que já está na tela fica, só esmaecido, até a resposta chegar.
    const inicio = setTimeout(() => vivo && setBuscando(true), 0);
    conversa
      .arvore(id, ordem)
      .then((dado) => vivo && (setEstado({ id, dado, erro: "" }), setBuscando(false)))
      .catch((e) => vivo && (setEstado({ id, dado: null, erro: textoDoErro(s, e) }), setBuscando(false)));
    return () => {
      vivo = false;
      clearTimeout(inicio);
    };
  }, [id, ordem, versao, s]);

  const rotuloCarregando = t?.arvore.carregando ?? s.estados.carregando;
  if (!t || !estado || estado.id !== id) return <EsqueletoDaLinha rotulo={rotuloCarregando} quantos={3} />;
  if (!estado.dado) {
    return (
      <div className="px-[18px] py-8 font-sans" role="alert">
        <p className="text-ink-soft">{estado.erro || t.arvore.naoEncontrada}</p>
        <button type="button" className="mt-3 min-h-11 cursor-pointer rounded-full border border-ink px-5 font-bold" onClick={() => setVersao((n) => n + 1)}>
          {s.estados.tentar}
        </button>
      </div>
    );
  }

  const dado = estado.dado;
  const post = dado.post;
  const raizPost = post.id === dado.raiz ? post : dado.acima.find((p) => p.id === dado.raiz) ?? null;
  const ehDuvida = raizPost?.tipo === "duvida";
  const aceitaId = ehDuvida ? raizPost?.aceita ?? null : null;
  const membro = situacao.membro;
  const nos = emFila(montarArvore(post.id, dado.respostas));

  const mudarSintese = (nova: SinteseDaConversa | null) => setEstado((e) => (e && e.dado ? { ...e, dado: { ...e.dado, sintese: nova } } : e));

  async function marcar(resposta: Post, quer: boolean) {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    setAviso("");
    try {
      await conversa.aceitar(resposta.id, quer);
      setAviso(quer ? t!.resolveu.marcada : t!.resolveu.desmarcada);
      setVersao((n) => n + 1);
    } catch (e) {
      setErro(textoDoErro(s, e));
    } finally {
      setOcupado(false);
    }
  }

  /** As ações que a conversa acrescenta ao cartão de um post: resposta que resolveu, citar e "continuar a conversa". */
  function extras(p: Post, no?: NoDaArvore) {
    const resolveu = aceitaId === p.id;
    const botao = "flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 hover:text-[#c21f16] disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:font-bold aria-pressed:text-[#c21f16]";
    return (
      <>
        {dado.pode_aceitar && p.resposta_a && !p.retido && (
          <button type="button" className={botao} aria-pressed={resolveu} disabled={ocupado} onClick={() => void marcar(p, !resolveu)}>
            {resolveu ? t!.resolveu.desmarcar : t!.resolveu.marcar}
          </button>
        )}
        {membro && !p.retido && (
          <button type="button" className={botao} aria-expanded={citando === p.id} onClick={() => setCitando((c) => (c === p.id ? null : p.id))}>
            {t!.citar.botao}
          </button>
        )}
        {no && continuaEmOutraPagina(no) && (
          <Link href={enderecos.post(lang, p.id)} className={`${botao} font-bold underline`}>
            {p.respostas === 1 ? t!.arvore.continuarUm : preencher(t!.arvore.continuar, { n: p.respostas })}
          </Link>
        )}
      </>
    );
  }

  const cartao = (p: Post, no?: NoDaArvore, completo = false) => (
    <>
      {aceitaId === p.id && p.resposta_a && (
        <p className="mx-[18px] mt-2 inline-block rounded bg-[#e8f0e0] px-2 py-0.5 font-sans text-xs font-bold" role="note">
          {t.resolveu.selo}
        </p>
      )}
      <CartaoDePost post={p} lang={lang} s={s} logado={situacao.logado} completo={completo} aoResponder={aoResponder} extras={extras(p, no)} />
      {citando === p.id && (
        <div className="px-[18px] pb-3">
          <Citar post={p} lang={lang} s={s} t={t} aoPublicar={() => undefined} aoFechar={() => setCitando(null)} />
        </div>
      )}
    </>
  );

  return (
    <div aria-busy={buscando}>
      {(dado.sintese || dado.pode_sintese) && (
        <Sintese raiz={dado.raiz} sintese={dado.sintese} pode={dado.pode_sintese} lang={lang} s={s} t={t} aoMudar={mudarSintese} />
      )}

      {dado.acima.length > 0 && (
        <ol aria-label={t.arvore.acima}>
          {dado.acima.map((p) => (
            <li key={p.id}>{cartao(p)}</li>
          ))}
        </ol>
      )}
      {post.id !== dado.raiz && (
        <p className="border-b border-rule px-[18px] py-2 font-sans text-sm">
          <Link href={enderecos.post(lang, dado.raiz)} className="font-bold underline">
            {t.arvore.desdeOComeco}
          </Link>
        </p>
      )}

      {cartao(post, undefined, true)}

      {ehDuvida && dado.pode_aceitar && <p className="border-b border-rule px-[18px] py-2 font-sans text-sm text-ink-soft">{t.resolveu.ajuda}</p>}
      {(aviso || erro) && (
        <p role={erro ? "alert" : "status"} className={`px-[18px] py-2 font-sans text-sm ${erro ? "text-oxblood" : ""}`}>
          {erro || aviso}
        </p>
      )}

      {nos.length > 1 && <Ordem ordem={ordem} aoMudar={setOrdem} t={t} ocupado={buscando} />}

      <section aria-label={t.arvore.respostas} className={buscando ? "opacity-70 transition-opacity" : "transition-opacity"}>
        {nos.length === 0 ? (
          <p className="px-[18px] py-6 font-sans text-ink-soft">{t.arvore.nenhuma}</p>
        ) : (
          <ol>
            {nos.map((no) => (
              <li key={no.post.id} style={{ paddingLeft: `${recuoDoNivel(no.nivel) * 12}px` }} className={no.nivel > 1 ? "border-l-2 border-rule ml-2" : ""}>
                <span className="sr-only">{preencher(t.arvore.nivel, { n: no.nivel + 1 })}</span>
                {no.post.silenciada ? (
                  <p className="border-b border-rule px-[18px] py-3 font-sans text-sm text-ink-soft">{t.arvore.silenciada}</p>
                ) : (
                  cartao(no.post, no)
                )}
              </li>
            ))}
          </ol>
        )}
        {dado.mais && <p className="px-[18px] py-3 font-sans text-sm text-ink-soft">{t.arvore.mais}</p>}
      </section>
    </div>
  );
}

type PropsDaConversa = { id: string; lang: string; s: TextosDaRede; situacao: Situacao; aoResponder: (p: Post) => void };

/**
 * A conversa de um post. Com a Alumia nova ligada ("rede-v2" + "alumia-2", o layout põe [data-al="2"]) é a da prancha
 * celular-conversa-fediverso (TelaDaConversaAlumia.tsx); desligada, a de hoje, sem mudar nada.
 */
export default function TelaDaConversa(props: PropsDaConversa) {
  const nova = useAlumia2();
  return nova ? <TelaDaConversaAlumia id={props.id} lang={props.lang} s={props.s} situacao={props.situacao} /> : <TelaDaConversaDeHoje {...props} />;
}
