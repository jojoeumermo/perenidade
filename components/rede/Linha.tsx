// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { rede } from "@/lib/rede/cliente";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import { lerSilenciosLocais, silenciadoNoAparelho, type SilencioLocal } from "@/lib/rede/silenciar-local";
import type { Aba, Post } from "@/lib/rede/tipos";
import { CartaoDePost } from "./CartaoDePost";
import { textoDoErro } from "./erros";
import { EsqueletoDaLinha } from "./Esqueletos";

/** De quanto em quanto tempo se pergunta "N novos" (só com a página à vista; nada de tempo real por enquanto). */
const ESPERA_DOS_NOVOS_MS = 60_000;

/**
 * Uma linha de posts: carrega 20 por vez por cursor, mostra o esqueleto enquanto espera, a faixa "N novos posts, mostrar" no alto e
 * o estado vazio que orienta. Serve a todas as abas (seguindo, comunidades, tudo, geral) e às páginas de comunidade e de perfil
 * (aba "c:<slug>" e "u:<handle>"). Cada aba tem a própria instância (a chave é a aba): trocar de aba não mistura contadores.
 */
export function Linha({
  aba,
  lang,
  s,
  logado,
  aoResponder,
  vazio,
}: {
  aba: Aba;
  lang: string;
  s: TextosDaRede;
  logado: boolean;
  aoResponder?: (post: Post) => void;
  vazio?: string;
}) {
  const [itens, setItens] = useState<Post[]>([]);
  const [proximo, setProximo] = useState<string | null>(null);
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">("carregando");
  const [mensagem, setMensagem] = useState("");
  const [maisCarregando, setMaisCarregando] = useState(false);
  const [novos, setNovos] = useState(0);
  const desde = useRef(new Date().toISOString());
  const [versao, setVersao] = useState(0);
  // "Silenciar só neste aparelho": a lista fica no navegador e só esconde o que a tela mostra (o servidor não sabe dela).
  const [silencios] = useState<SilencioLocal[]>(() => {
    try {
      return lerSilenciosLocais(window.localStorage);
    } catch {
      return [];
    }
  });

  // Carrega a primeira página (e de novo quando a versão muda: "tentar de novo" e "N novos, mostrar").
  useEffect(() => {
    let vivo = true;
    // O instante é o de antes do pedido: o que chegar durante a espera ainda conta como novo.
    const antes = new Date().toISOString();
    rede
      .linha(aba, null, 20)
      .then((r) => {
        if (!vivo) return;
        desde.current = antes;
        setItens(r.itens);
        setProximo(r.proximo);
        setNovos(0);
        setEstado("ok");
      })
      .catch((e) => {
        if (!vivo) return;
        setMensagem(textoDoErro(s, e));
        setEstado("erro");
      });
    return () => {
      vivo = false;
    };
  }, [aba, s, versao]);

  const carregar = () => {
    setEstado("carregando");
    setVersao((v) => v + 1);
  };

  // A faixa "N novos": pergunta só enquanto a página está à vista e a linha já carregou.
  useEffect(() => {
    if (estado !== "ok") return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      rede.novos(aba, desde.current).then((n) => setNovos(typeof n === "number" ? n : 0)).catch(() => undefined);
    }, ESPERA_DOS_NOVOS_MS);
    return () => window.clearInterval(id);
  }, [aba, estado]);

  async function maisPosts() {
    if (!proximo || maisCarregando) return;
    setMaisCarregando(true);
    try {
      const r = await rede.linha(aba, proximo, 20);
      setItens((atual) => {
        const vistos = new Set(atual.map((p) => p.id));
        return [...atual, ...r.itens.filter((p) => !vistos.has(p.id))];
      });
      setProximo(r.proximo);
    } catch (e) {
      setMensagem(textoDoErro(s, e));
    } finally {
      setMaisCarregando(false);
    }
  }

  if (estado === "carregando") return <EsqueletoDaLinha rotulo={s.estados.carregando} />;
  if (estado === "erro") {
    return (
      <div className="px-[18px] py-6 font-sans" role="alert">
        <p className="text-oxblood">{mensagem || s.estados.erro}</p>
        <button type="button" onClick={carregar} className="mt-3 min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-4 font-bold hover:bg-parchment-deep">
          {s.estados.tentar}
        </button>
      </div>
    );
  }

  const visiveis = silencios.length ? itens.filter((p) => !silenciadoNoAparelho(p, silencios)) : itens;
  return (
    <div>
      {novos > 0 && (
        <button
          type="button"
          onClick={carregar}
          className="sticky top-[var(--altura-topo,0px)] z-10 block min-h-11 w-full cursor-pointer border-b border-rule bg-[#1f1a14] px-4 py-2 text-center font-sans text-sm font-bold text-[#f4ecd8] hover:bg-[#c21f16]"
        >
          {novos === 1 ? s.novos.um : preencher(s.novos.outros, { n: novos })}
        </button>
      )}
      {visiveis.length === 0 ? (
        <p className="px-[18px] py-8 font-sans text-ink-soft">{vazio ?? s.estados.vazioLinha}</p>
      ) : (
        <ol aria-label={s.abas.rotulo}>
          {visiveis.map((p) => (
            <li key={p.id}>
              <CartaoDePost post={p} lang={lang} s={s} logado={logado} aoResponder={aoResponder} />
            </li>
          ))}
        </ol>
      )}
      {proximo ? (
        <div className="px-[18px] py-4 text-center">
          <button type="button" onClick={() => void maisPosts()} disabled={maisCarregando} className="min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-5 font-sans font-bold hover:bg-parchment-deep disabled:opacity-60">
            {maisCarregando ? s.estados.carregando : s.estados.maisPosts}
          </button>
        </div>
      ) : (
        itens.length > 0 && <p className="px-[18px] py-6 text-center font-sans text-sm text-ink-soft">{s.estados.fim}</p>
      )}
    </div>
  );
}
