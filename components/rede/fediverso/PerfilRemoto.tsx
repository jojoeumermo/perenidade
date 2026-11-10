// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O perfil de alguém de FORA (Mastodon e parecidos) no mesmo desenho do perfil da Alumia nova (classes pf-* de
// ../perfil/livre/livre.css). O rosto é o mosaico pelo endereço, nunca a foto de lá: o navegador de quem lê não busca nada em
// outro servidor. Sem contagem de seguidores e sem lista de quem segue (regra da casa); "segue você" só aparece para a própria
// pessoa. Quem lê lá fora é o servidor daqui (lib/rede/fediverso/tela/cliente.ts).
import dynamic from "next/dynamic";
import { useEffect, useState, type CSSProperties } from "react";
import Link from "@/components/Link";
import { deFora } from "@/lib/rede/fediverso/tela/cliente";
import { linkDaOrigem } from "@/lib/rede/fediverso/tela/html";
import { deForaVale } from "@/lib/rede/fediverso/tela/linha";
import { textoDoErroDeFora, useTextosDoFediverso } from "@/lib/rede/fediverso/tela/textos";
import { contaDoHandle, eContaDaqui, type ContaDaqui, type PerfilDeFora, type RelacaoComQuemEDeFora } from "@/lib/rede/fediverso/tela/tipos";
import { preencher } from "@/lib/rede/preencher";
import { enderecos } from "@/lib/rede/tipos";
import { EsqueletoDaLinha } from "../Esqueletos";
import { useAlumia2 } from "../publicar/alumia2/contexto";
import { Avatar16 } from "../ui/Avatar16";
import { Botao, classesDoBotao } from "../ui/Botao";
import { HtmlDeFora } from "./HtmlDeFora";
import { SeloDoServidor } from "./SeloDoServidor";
import "../perfil/livre/livre.css";
import "../org/org.css";

const CartaoRemoto = dynamic(() => import("./CartaoRemoto"), { ssr: false });

const SEM_RELACAO: RelacaoComQuemEDeFora = { seguindo: "nao", segue_voce: false, bloqueado: false, silenciado: false };

// A cor dos botões e do aro do rosto (o perfil de fora não escolhe cor aqui): o vermelho da casa.
const ACENTO = { "--pf-acento": "var(--al-vermelho-texto, var(--al-vermelho))", "--pf-sobre-acento": "var(--al-sobre-vermelho)" } as CSSProperties;

type Estado = { conta: string; dado: PerfilDeFora | ContaDaqui | null; erro: string };

/**
 * O perfil de quem é de fora (/alumia/fediverso?conta=@nome@servidor). `conta` é "@nome@servidor" ou o endereço https do ator.
 * Só aparece dentro da casca nova, com "fediverso-total" ligado ou na prévia (com o perfil de exemplo).
 */
export default function PerfilRemoto({ conta, lang, logado = true }: { conta: string; lang: string; logado?: boolean }) {
  const t = useTextosDoFediverso(lang);
  const casca = useAlumia2();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [volta, setVolta] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [erroDaAcao, setErroDaAcao] = useState("");
  const vale = casca !== null && deForaVale(casca.previa);

  useEffect(() => {
    if (!vale) return;
    let vivo = true;
    // Na prévia o cliente devolve o perfil de exemplo, sem rota nem banco.
    deFora.perfil(conta).then((r) => {
      if (vivo) setEstado(r.ok ? { conta, dado: r.dado, erro: "" } : { conta, dado: null, erro: r.erro });
    });
    return () => {
      vivo = false;
    };
  }, [conta, vale, volta]);

  if (!vale) return null;
  if (!t || !estado || estado.conta !== conta) return <EsqueletoDaLinha rotulo={t?.comum.carregando ?? "…"} quantos={3} />;

  if (!estado.dado) {
    // Servidor bloqueado pela mediação: não adianta tentar de novo.
    const bloqueada = estado.erro.split(":")[0] === "instancia_bloqueada";
    return (
      <div className="al-perfil al-painel" role="alert">
        <p className="al-painel-vazio">{textoDoErroDeFora(t, estado.erro)}</p>
        {!bloqueada && (
          <Botao variante="contorno" className="mt-3" onClick={() => (setEstado(null), setVolta((v) => v + 1))}>
            {t.comum.tentarDeNovo}
          </Botao>
        )}
      </div>
    );
  }

  if (eContaDaqui(estado.dado)) {
    return (
      <div className="al-perfil al-painel">
        <p className="al-painel-vazio">
          <Link href={enderecos.perfil(lang, estado.dado.handle)} className="underline">{t.perfil.contaDaqui}</Link>
        </p>
      </div>
    );
  }

  const p = estado.dado;
  const relacao = p.local ?? SEM_RELACAO;
  const endereco = contaDoHandle(p.handle) ?? (p.handle ? `@${p.handle}` : p.servidor);
  const nome = p.nome || p.handle || p.servidor;
  // "Abrir em {servidor}" só leva ao servidor do próprio ator; endereço com usuário e senha não serve.
  const urlDeLa = linkDaOrigem(p.url, p.ator);

  function mudarRelacao(parte: Partial<RelacaoComQuemEDeFora>) {
    setEstado((e) => (e && e.dado && !eContaDaqui(e.dado) ? { ...e, dado: { ...e.dado, local: { ...(e.dado.local ?? SEM_RELACAO), ...parte } } } : e));
  }

  async function agir(acao: () => Promise<{ ok: true; parte: Partial<RelacaoComQuemEDeFora> } | { ok: false; erro: string }>) {
    if (ocupado || !t) return;
    setOcupado(true);
    setErroDaAcao("");
    const r = await acao();
    setOcupado(false);
    if (r.ok) mudarRelacao(r.parte);
    else setErroDaAcao(textoDoErroDeFora(t, r.erro));
  }

  const seguir = (sim: boolean) =>
    agir(async () => {
      const r = await deFora.seguir(p.ator, sim);
      return r.ok ? { ok: true, parte: { seguindo: r.dado.seguindo } } : r;
    });
  const silenciar = (sim: boolean) =>
    agir(async () => {
      const r = await deFora.silenciarPessoa(p.ator, sim);
      return r.ok ? { ok: true, parte: { silenciado: r.dado.silenciado } } : r;
    });
  const bloquear = (sim: boolean) =>
    agir(async () => {
      const r = await deFora.bloquearPessoa(p.ator, sim);
      // Bloquear desfaz o seguir dos dois lados (o banco faz o mesmo).
      return r.ok ? { ok: true, parte: r.dado.bloqueado ? { bloqueado: true, seguindo: "nao", segue_voce: false } : { bloqueado: false } } : r;
    });

  return (
    <div className="pf-pagina">
      <section className="pf" data-layout="classico" style={ACENTO} aria-labelledby="fed-perfil-nome">
        <div className="pf-capa">
          <div aria-hidden className="pf-capa-vazia" />
        </div>
        <div className="pf-cabeca">
          <div className="pf-identidade">
            <div className="pf-rosto-moldura" style={{ width: 92, height: 92, borderRadius: 22 }}>
              <Avatar16 handle={p.handle ?? p.ator} tamanho={92} rotulo={preencher(t.perfil.rostoDe, { conta: endereco })} />
            </div>
            <div className="pf-nomes">
              <h1 id="fed-perfil-nome" className="al-cond pf-nome">{nome}</h1>
              <p className="pf-handle">
                <span>{endereco}</span>
                <SeloDoServidor servidor={p.servidor} rotulo={t.cartao.doFediverso} />
                {logado && relacao.segue_voce ? <span className="pf-pronomes">{t.perfil.segueVoce}</span> : null}
              </p>
            </div>
            <div className="pf-acoes">
              {logado && !relacao.bloqueado ? (
                relacao.seguindo === "nao" ? (
                  <Botao disabled={ocupado} onClick={() => void seguir(true)}>{t.perfil.seguir}</Botao>
                ) : (
                  <Botao variante="contorno" pressionado disabled={ocupado} onClick={() => void seguir(false)}>
                    {relacao.seguindo === "sim" ? t.perfil.seguindo : t.perfil.pedido} · {t.perfil.deixarDeSeguir}
                  </Botao>
                )
              ) : null}
              {logado && (
                <>
                  <Botao variante="contorno" pressionado={relacao.silenciado} disabled={ocupado} onClick={() => void silenciar(!relacao.silenciado)}>
                    {t.cartao.silenciar}
                  </Botao>
                  <Botao variante="contorno" pressionado={relacao.bloqueado} disabled={ocupado} onClick={() => void bloquear(!relacao.bloqueado)}>
                    {t.cartao.bloquear}
                  </Botao>
                </>
              )}
              {urlDeLa && (
                <a href={urlDeLa} target="_blank" rel="nofollow noopener noreferrer ugc" className={classesDoBotao("contorno")}>
                  {preencher(t.perfil.abrirNoServidor, { servidor: p.servidor })}
                </a>
              )}
            </div>
          </div>

          {p.resumo ? <HtmlDeFora texto={p.resumo} className="pf-bio" /> : null}

          <div aria-live="polite">
            {erroDaAcao && <p role="alert" className="al-perfil-erro">{erroDaAcao}</p>}
            {relacao.bloqueado && <p className="al-perfil-nota">{t.perfil.bloqueado}</p>}
            {relacao.silenciado && !relacao.bloqueado && <p className="al-perfil-nota">{t.perfil.silenciado}</p>}
          </div>
        </div>
      </section>

      {/* Os posts recentes, cada um no mesmo cartão de gente de fora da linha. Conta bloqueada não mostra posts. */}
      {!relacao.bloqueado && (
        <section aria-labelledby="fed-perfil-posts" className="pf-painel">
          <h2 id="fed-perfil-posts" className="al-cond px-4 pb-2 pt-4 text-[1.5rem] text-[var(--al-texto)]">{t.perfil.postsRecentes}</h2>
          {p.posts.length === 0 ? (
            <p className="pf-vazio">{t.perfil.vazio}</p>
          ) : (
            // O cartão recebe a relação que o perfil conhece e avisa de volta quando a pessoa silencia ou bloqueia por ele.
            p.posts.map((post) => (
              <CartaoRemoto key={post.chave ?? post.id} post={post} lang={lang} logado={logado} densidade="lista" silenciado={relacao.silenciado} bloqueado={relacao.bloqueado} aoMudarRelacao={mudarRelacao} />
            ))
          )}
        </section>
      )}
    </div>
  );
}
