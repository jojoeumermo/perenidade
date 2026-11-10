// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "./stories.css";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { CHAVES_DOS_STORIES, lerPedidoDoEndereco } from "@/lib/rede/stories/enderecos";
import { PALETA_DO_STORY } from "@/lib/rede/stories/visual";
import type { Situacao } from "@/lib/rede/tipos";
import type { DestaqueDeStories } from "@/lib/rede/tipos-stories";
import { CapaDoDestaque } from "./CapaDoDestaque";
import { EVENTO_DOS_DESTAQUES, enderecoAqui, noPlural, useClienteDosStories, useTextosDosStories } from "./usar";
import { Visor } from "./Visor";

/** Lembra, só neste aparelho, se a fileira compacta "Seus destaques" ficou aberta (conveniência; sem ela, começa fechada). */
const CHAVE_ABERTA = "lucia:stories-destaques-abertos";
function lerAberta(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_ABERTA) === "1";
  } catch {
    return false;
  }
}
function guardarAberta(sim: boolean) {
  try {
    window.localStorage.setItem(CHAVE_ABERTA, sim ? "1" : "0");
  } catch {
    /* sem armazenamento: só não lembra */
  }
}

/**
 * O destaque aberto vem do endereço (?destaque=<id>), como o ?ver= e o ?criar= dos stories: abrir empilha uma entrada no
 * histórico (o voltar do celular fecha o destaque em vez de sair da tela), fechar volta, e recarregar ou compartilhar o endereço
 * abre o mesmo destaque (se quem abre pode vê-lo; a lista do banco já só traz os que ela vê).
 */
function useDestaqueNoEndereco() {
  const [pedido, setPedido] = useState<string | null>(null);
  const empilhou = useRef(false);
  useEffect(() => {
    const ler = () => {
      empilhou.current = false;
      setPedido(lerPedidoDoEndereco(new URLSearchParams(window.location.search)).destaque);
    };
    ler();
    window.addEventListener("popstate", ler);
    return () => window.removeEventListener("popstate", ler);
  }, []);
  const abrir = useCallback((id: string) => {
    const url = enderecoAqui({ destaque: id }, CHAVES_DOS_STORIES);
    if (empilhou.current) window.history.replaceState(window.history.state, "", url);
    else {
      window.history.pushState(window.history.state, "", url);
      empilhou.current = true;
    }
    setPedido(id);
  }, []);
  const fechar = useCallback(() => {
    if (empilhou.current) {
      empilhou.current = false;
      window.history.back();
    } else window.history.replaceState(window.history.state, "", enderecoAqui(null, CHAVES_DOS_STORIES));
    setPedido(null);
  }, []);
  /** O endereço pedia um destaque que não está na lista (apagado, ou não é para mim): limpa sem barulho. */
  const esquecer = useCallback(() => {
    window.history.replaceState(window.history.state, "", enderecoAqui(null, CHAVES_DOS_STORIES));
    setPedido(null);
  }, []);
  return { pedido, abrir, fechar, esquecer };
}

/**
 * Os destaques no perfil (como os do Instagram): bolinhas com a capa e o nome, que abrem o visor com os stories guardados. Só
 * aparecem os stories que EU posso ver (o mesmo público de quando foram publicados; bloqueio e retenção valem); o número é de
 * stories, nunca de pessoas. Nada é contado ao servidor sobre quem abriu. Encaixe para a área de perfil (F4): basta
 * `<DestaquesDoPerfil lang handle situacao />` acima das abas. Com `compacto` (a tela dos stories), vira uma linha recolhível
 * "Seus destaques", fechada de início, que não empurra a linha para baixo.
 */
export function DestaquesDoPerfil({ lang, handle, situacao, compacto = false }: { lang: string; handle: string; situacao: Situacao; compacto?: boolean }) {
  const t = useTextosDosStories(lang);
  const cliente = useClienteDosStories();
  const [lista, setLista] = useState<DestaqueDeStories[] | null>(null);
  const [erro, setErro] = useState(false);
  const [versao, setVersao] = useState(0);
  // Lido já na criação: o componente só desenha algo depois que os textos chegam (no cliente), então não há diferença com o servidor.
  const [aberta, setAberta] = useState(() => compacto && typeof window !== "undefined" && lerAberta());
  const { pedido, abrir, fechar, esquecer } = useDestaqueNoEndereco();
  const dono = situacao.handle === handle || (!!cliente?.previa && (handle === "voce" || handle === "eu"));
  const logado = situacao.logado || !!cliente?.previa;
  // Na prévia, "eu" é sempre a "voce" dos exemplos (o dublê não conhece o @ de quem está olhando).
  const de = cliente?.previa && dono ? "voce" : handle;

  useEffect(() => {
    if (!cliente || !logado) return;
    let vivo = true;
    cliente
      .destaques(de)
      .then((l) => vivo && (setLista(l), setErro(false)))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [cliente, de, logado, versao]);

  // Guardou ou tirou um story num visor de outro lugar (a faixa): relê.
  useEffect(() => {
    const reler = () => setVersao((v) => v + 1);
    window.addEventListener(EVENTO_DOS_DESTAQUES, reler);
    return () => window.removeEventListener(EVENTO_DOS_DESTAQUES, reler);
  }, []);

  const aberto = lista && pedido ? (lista.find((d) => d.id === pedido) ?? null) : null;
  useEffect(() => {
    if (lista && pedido && !aberto) esquecer();
  }, [lista, pedido, aberto, esquecer]);

  if (!t || !cliente || !logado) return null;
  if (erro) return compacto ? null : <p className="al-st-erro">{t.destaques.erro}</p>;
  if (!lista) return compacto ? null : <div className="al-st-destaques" aria-busy="true" style={{ minHeight: 104 }} />;
  if (lista.length === 0) return dono && !compacto ? <p className="al-st-destaques-vazio">{t.destaques.vazioDono}</p> : null;

  const trilho = (
    <ul className="al-st-faixa-trilho">
      {lista.map((d) => (
        <li key={d.id} className="al-st-faixa-item">
          <button
            type="button"
            className="al-st-bolinha al-st-destaque"
            aria-label={noPlural(lang, d.n, t.destaques.abrirN, { titulo: d.titulo })}
            onClick={() => abrir(d.id)}
          >
            <span className="al-st-destaque-capa" style={{ "--al-st-anel": PALETA_DO_STORY[d.cor].fundo } as CSSProperties}>
              <CapaDoDestaque d={d} />
            </span>
            <span className="al-st-nome" aria-hidden>
              {d.titulo}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );

  const visor = aberto ? (
    <Visor
      t={t}
      cliente={cliente}
      lang={lang}
      handle={handle}
      destaque={{ id: aberto.id, titulo: aberto.titulo }}
      aoFechar={() => {
        fechar();
        setVersao((v) => v + 1);
      }}
      aoMudou={() => setVersao((v) => v + 1)}
    />
  ) : null;

  if (compacto) {
    return (
      <section className="al-st-destaques al-st-destaques-compactos" aria-label={t.destaques.seus}>
        <details
          open={aberta}
          onToggle={(e) => {
            const sim = e.currentTarget.open;
            setAberta(sim);
            guardarAberta(sim);
          }}
        >
          <summary>
            <span className="al-st-destaques-titulo">{t.destaques.seus}</span>
            <span className="al-st-destaques-conta">{noPlural(lang, lista.length, t.destaques.contaN)}</span>
            <span className="al-st-destaques-rostos" aria-hidden>
              {lista.slice(0, 3).map((d) => (
                <span key={d.id} style={{ background: PALETA_DO_STORY[d.cor].fundo }} />
              ))}
            </span>
            <svg className="al-st-destaques-seta" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          {trilho}
        </details>
        {visor}
      </section>
    );
  }

  return (
    <section className="al-st-destaques" aria-label={t.destaques.rotulo}>
      {trilho}
      {visor}
    </section>
  );
}
