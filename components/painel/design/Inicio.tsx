// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import { can, rpc } from "@/lib/backend";
import type { Me } from "@/lib/backend";
import { type Abertura, CHAVE_DO_RASCUNHO, lerRascunho, type Rascunho } from "./Estudio";
import { Icone } from "./Icone";
import type { NomeDoIcone } from "./icones";
import { MODELOS, paginasDoModelo } from "./modelos";
import { type CamadaTexto, FORMATOS, type FormatoId, miniatura, usarVariaveis } from "./motor";
import { projetoNovo, proximasDatas, VARIAVEIS_PADRAO } from "./projeto";
import type { Trabalho } from "./paineis/Gavetas";
import { NOMES_DO_STATUS } from "./paineis/Gavetas";

const CHAVE_DO_PRIMEIRO_USO = "lucia:estudio-primeiro-uso";

const CRIAR: { formato: FormatoId; nome: string; icone: NomeDoIcone; proporcao: string }[] = [
  { formato: "post", nome: "Post", icone: "feed", proporcao: "aspect-[4/5]" },
  { formato: "story", nome: "Story", icone: "celular", proporcao: "aspect-[9/16]" },
  { formato: "quadrado", nome: "Quadrado", icone: "modelos", proporcao: "aspect-square" },
  { formato: "carrossel", nome: "Carrossel", icone: "paginas", proporcao: "aspect-[4/5]" },
  { formato: "cartaz-a4", nome: "Cartaz A4", icone: "cartaz", proporcao: "aspect-[210/297]" },
  { formato: "capa-noticia", nome: "Capa de notícia", icone: "jornal", proporcao: "aspect-video" },
];

const quanto = (ms: number) => {
  const min = Math.round(ms / 60000);
  if (min < 60) return `há ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} dia(s)`;
};

function MiniaturaDeModelo({ id }: { id: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    const m = MODELOS.find((x) => x.id === id);
    if (!m) return;
    let vivo = true;
    void (async () => {
      usarVariaveis({ ...VARIAVEIS_PADRAO, pagina: "01", total: "05" });
      const pronto = await miniatura(m.montar(), 240).catch(() => "");
      if (vivo) setSrc(pronto);
    })();
    return () => {
      vivo = false;
    };
  }, [id]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className="h-full w-full object-contain" /> : <span className="block h-full w-full animate-pulse bg-rule/40" />;
}

/**
 * A tela de entrada do estúdio rápido: criar por formato, continuar o rascunho, as datas do calendário que vêm aí,
 * os modelos mais usados, os trabalhos recentes e, para a coordenação, o que espera aprovação.
 */
export function Inicio({ me, abrir, laboratorio = false }: { me: Me; abrir: (a: Abertura) => void; laboratorio?: boolean }) {
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [trabalhos, setTrabalhos] = useState<Trabalho[] | null>(null);
  const [usados, setUsados] = useState<string[]>([]);
  const [primeiroUso, setPrimeiroUso] = useState(false);
  const [agora, setAgora] = useState(0);
  useEffect(() => {
    // O que está guardado no aparelho só existe no navegador: lido logo depois de a tela aparecer.
    const id = window.setTimeout(() => {
      setRascunho(lerRascunho(me.id));
      setAgora(Date.now());
      try {
        setPrimeiroUso(!window.localStorage.getItem(CHAVE_DO_PRIMEIRO_USO));
      } catch {
        setPrimeiroUso(false);
      }
    }, 0);
    if (!laboratorio) {
      rpc<Trabalho[]>("designs_listar", {})
        .then((l) => setTrabalhos(l ?? []))
        .catch(() => setTrabalhos([]));
      rpc<{ modelo: string }[]>("design_modelos_mais_usados", {})
        .then((l) => setUsados((l ?? []).map((x) => x.modelo)))
        .catch(() => setUsados([]));
    }
    // Vindo do calendário da divulgação ("Criar arte no Estúdio de design"): o título da peça entra no maior texto do modelo.
    let pedido: { titulo?: string; legenda?: string } | null = null;
    try {
      pedido = JSON.parse(window.sessionStorage.getItem("lucia:estudio-pedido") ?? "null");
      window.sessionStorage.removeItem("lucia:estudio-pedido");
    } catch {
      pedido = null;
    }
    if (pedido?.titulo) {
      const modelo = MODELOS[0];
      const titulo = pedido.titulo.slice(0, 120);
      const paginas = paginasDoModelo(modelo).map((d) => {
        const textos = d.camadas.filter((c): c is CamadaTexto => c.tipo === "texto");
        const maior = [...textos].sort((x, y) => y.tamanho - x.tamanho)[0];
        return { ...d, camadas: d.camadas.map((c) => (maior && c.id === maior.id ? { ...c, texto: titulo } : c)) };
      });
      abrir({ tipo: "projeto", projeto: { ...projetoNovo(paginas), legenda: (pedido.legenda ?? "").slice(0, 2200) }, titulo: `Post: ${titulo}`.slice(0, 80), formato: modelo.formato });
    }
    return () => window.clearTimeout(id);
  }, [me.id, abrir, laboratorio]);
  const datas = useMemo(() => (agora ? proximasDatas(new Date(agora), 3) : []), [agora]);
  const paraAprovar = can(me, "coordenacao") ? (trabalhos ?? []).filter((t) => t.status === "revisao") : [];
  const meus = (trabalhos ?? []).filter((t) => t.meu && (t.status === "ajustes"));
  const sugeridos = (usados.length ? usados : ["post-proposito", "carrossel-completo", "story-aviso", "post-edicao-extra"]).map((id) => MODELOS.find((m) => m.id === id)).filter(Boolean).slice(0, 4);
  const fecharPrimeiroUso = () => {
    setPrimeiroUso(false);
    try {
      window.localStorage.setItem(CHAVE_DO_PRIMEIRO_USO, "1");
    } catch {
      /* sem armazenamento */
    }
  };
  return (
    <div className="space-y-8">
      {primeiroUso && (
        <section className="painel-cartao relative p-5" aria-label="Primeiro uso">
          <button type="button" className="absolute top-3 right-3 cursor-pointer p-1 text-ink-soft hover:text-ink" onClick={fecharPrimeiroUso} aria-label="Fechar">
            <Icone nome="fechar" className="h-5 w-5" />
          </button>
          <p className="font-mono text-xs uppercase tracking-widest text-gold">Primeira vez no estúdio?</p>
          <h2 className="mt-1 font-serif text-2xl font-semibold">Uma arte em quatro passos</h2>
          <ol className="mt-4 grid gap-4 text-sm sm:grid-cols-4">
            {(
              [
                ["modelos", "Escolha um modelo", "Todos já vêm com a identidade do instituto."],
                ["texto", "Troque o texto", "Duplo clique no texto da arte e escreva."],
                ["verificar", "Confira", "O estúdio avisa de contraste, letra pequena e área cortada."],
                ["baixar", "Guarde e baixe", "Guardar leva para a conta; Baixar entrega o PNG."],
              ] as [NomeDoIcone, string, string][]
            ).map(([icone, titulo, texto], i) => (
              <li key={titulo} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-oxblood text-parchment">
                  <Icone nome={icone} className="h-5 w-5" />
                </span>
                <span>
                  <strong className="block">
                    {i + 1}. {titulo}
                  </strong>
                  <span className="text-ink-soft">{texto}</span>
                </span>
              </li>
            ))}
          </ol>
          <button type="button" className="painel-botao mt-4 cursor-pointer bg-ink px-5 py-2.5 font-semibold text-parchment hover:bg-oxblood" onClick={() => { fecharPrimeiroUso(); abrir({ tipo: "modelo", modelo: MODELOS[0] }); }}>
            Abrir um exemplo
          </button>
        </section>
      )}

      {rascunho && (
        <section className="flex flex-wrap items-center gap-3 border-l-4 border-gold bg-parchment-deep px-4 py-3">
          <Icone nome="historico" className="h-5 w-5 text-gold" />
          <p className="min-w-0 flex-1">
            <strong>Continuar de onde parou:</strong> {rascunho.titulo} <span className="text-ink-soft">({quanto(agora - rascunho.quando)}, neste aparelho)</span>
          </p>
          <button type="button" className="cursor-pointer bg-ink px-4 py-2 font-semibold text-parchment hover:bg-oxblood" onClick={() => abrir({ tipo: "rascunho" })}>
            Continuar
          </button>
          <button type="button" className="cursor-pointer text-sm underline" onClick={() => { try { window.localStorage.removeItem(CHAVE_DO_RASCUNHO(me.id)); } catch { /* sem armazenamento */ } setRascunho(null); }}>
            Descartar
          </button>
        </section>
      )}

      <section>
        <h2 className="font-serif text-2xl font-semibold">Criar</h2>
        <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {CRIAR.map((c) => (
            <li key={c.formato}>
              <button type="button" className="group flex w-full cursor-pointer flex-col items-center gap-2 text-sm" onClick={() => abrir({ tipo: "branco", formato: c.formato })}>
                <span className="flex h-24 w-full items-center justify-center">
                  <span className={`flex h-full max-w-full items-center justify-center border-2 border-ink bg-parchment-deep text-ink-soft group-hover:border-oxblood group-hover:text-oxblood ${c.proporcao}`}>
                    <Icone nome={c.icone} className="h-6 w-6" />
                  </span>
                </span>
                {c.nome}
              </button>
            </li>
          ))}
        </ul>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-ink-soft">Mais formatos ({FORMATOS.length})</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {FORMATOS.map((f) => (
              <button key={f.id} type="button" className="cursor-pointer border border-rule px-3 py-1.5 hover:border-ink" onClick={() => abrir({ tipo: "branco", formato: f.id })}>
                {f.nome}
              </button>
            ))}
          </div>
        </details>
      </section>

      <section>
        <h2 className="font-serif text-2xl font-semibold">Datas que vêm aí</h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">
          {datas.map((d) => {
            const modelo = MODELOS.find((m) => m.id === d.modelo) ?? MODELOS[0];
            return (
              <li key={d.nome} className="painel-cartao flex flex-col p-4">
                <p className="font-mono text-xs uppercase tracking-widest text-gold">
                  {d.quando.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} · {d.faltam === 0 ? "hoje" : d.faltam === 1 ? "amanhã" : `em ${d.faltam} dias`}
                </p>
                <p className="mt-1 font-serif text-lg font-semibold">{d.nome}</p>
                <p className="flex-1 text-sm text-ink-soft">{d.sugestao}</p>
                <button type="button" className="mt-3 cursor-pointer self-start border-2 border-ink px-3 py-1.5 text-sm font-semibold hover:border-oxblood hover:text-oxblood" onClick={() => abrir({ tipo: "modelo", modelo })}>
                  Criar arte · {modelo.nome}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {(paraAprovar.length > 0 || meus.length > 0) && (
        <section>
          <h2 className="font-serif text-2xl font-semibold">{paraAprovar.length ? "Esperando a sua aprovação" : "Pedidos de ajuste"}</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[...paraAprovar, ...meus].map((t) => (
              <li key={t.id}>
                <button type="button" className="w-full cursor-pointer text-left" onClick={() => abrir({ tipo: "trabalho", id: t.id })}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {t.miniatura ? <img src={t.miniatura} alt="" className="aspect-square w-full border border-rule object-contain" /> : <span className="block aspect-square bg-parchment-deep" />}
                  <span className="mt-1 block truncate text-sm font-semibold">{t.titulo}</span>
                  <span className="block text-xs text-ink-soft">
                    {t.autor} · {NOMES_DO_STATUS[t.status ?? ""] ?? ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-serif text-2xl font-semibold">{usados.length ? "Os modelos mais usados" : "Para começar"}</h2>
        <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {sugeridos.map((m) => (
            <li key={m!.id}>
              <button type="button" className="w-full cursor-pointer text-left" onClick={() => abrir({ tipo: "modelo", modelo: m! })}>
                <span className="flex aspect-square items-center justify-center border border-rule bg-parchment-deep p-2 hover:border-ink">
                  <MiniaturaDeModelo id={m!.id} />
                </span>
                <span className="mt-1 block truncate text-sm">{m!.nome}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {!laboratorio && (
      <section>
        <h2 className="font-serif text-2xl font-semibold">Trabalhos recentes</h2>
        {trabalhos === null ? (
          <p className="mt-2 text-sm text-ink-soft">Carregando…</p>
        ) : !trabalhos.length ? (
          <p className="mt-2 text-sm text-ink-soft">Nenhum trabalho guardado ainda.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {trabalhos.slice(0, 12).map((t) => (
              <li key={t.id}>
                <button type="button" className="w-full cursor-pointer text-left" onClick={() => abrir({ tipo: "trabalho", id: t.id })} title={`${t.titulo} · ${t.autor}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {t.miniatura ? <img src={t.miniatura} alt="" className="aspect-square w-full border border-rule object-contain hover:border-ink" /> : <span className="block aspect-square bg-parchment-deep" />}
                  <span className="mt-1 block truncate text-sm font-semibold">{t.titulo}</span>
                  <span className="block truncate text-xs text-ink-soft">
                    {t.autor} · {new Date(t.atualizado_em).toLocaleDateString("pt-BR")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}
    </div>
  );
}
