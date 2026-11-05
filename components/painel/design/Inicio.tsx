// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ImageOff, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { can, rpc } from "@/lib/backend";
import type { Me } from "@/lib/backend";
// Arquivo por arquivo (e não o índice de ui/): esta tela também abre no Laboratório público, que não deve levar o resto
// do kit do painel (paleta, tabela, diálogos) no pacote.
import { Botao } from "../ui/Botao";
import { CabecalhoDeSecao } from "../ui/CabecalhoDeSecao";
import { Cartao } from "../ui/Cartao";
import { Esqueleto } from "../ui/Esqueleto";
import { Faixa } from "../ui/Faixa";
import { Vazio } from "../ui/Vazio";
import { type Abertura, CHAVE_DO_RASCUNHO, lerRascunho, type Rascunho } from "./Estudio";
import { Icone } from "./Icone";
import type { NomeDoIcone } from "./icones";
import { MODELOS_DO_LABORATORIO, VARIAVEIS_DO_LABORATORIO } from "./laboratorio";
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

function MiniaturaDeModelo({ id, laboratorio }: { id: string; laboratorio: boolean }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    const m = (laboratorio ? MODELOS_DO_LABORATORIO : MODELOS).find((x) => x.id === id);
    if (!m) return;
    let vivo = true;
    void (async () => {
      usarVariaveis({ ...(laboratorio ? VARIAVEIS_DO_LABORATORIO : VARIAVEIS_PADRAO), pagina: "01", total: "05" });
      const pronto = await miniatura(m.montar(), 240).catch(() => "");
      if (vivo) setSrc(pronto);
    })();
    return () => {
      vivo = false;
    };
  }, [id, laboratorio]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className="h-full w-full object-contain" /> : <span className="block h-full w-full bg-rule/40 motion-safe:animate-pulse" />;
}

/** A miniatura guardada de um trabalho (ou um quadro vazio com ícone, quando ainda não há). */
function MiniaturaDeTrabalho({ src }: { src?: string | null }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="aspect-square w-full rounded-md border border-rule bg-parchment-deep object-contain" />
  ) : (
    <span className="flex aspect-square items-center justify-center rounded-md bg-parchment-deep text-ink-soft">
      <ImageOff aria-hidden className="h-6 w-6" strokeWidth={1.4} />
    </span>
  );
}

/**
 * A tela de entrada do estúdio rápido: criar por formato, continuar o rascunho, as datas do calendário que vêm aí,
 * os modelos mais usados, os trabalhos recentes e, para a coordenação, o que espera aprovação.
 *
 * A mesma tela abre no Laboratório de Design (página pública), onde o tema do painel não está carregado: lá, as peças
 * novas do painel ganham as classes do site por cima (o "lab" de cada uma) e os títulos ficam no desenho de antes.
 */
export function Inicio({ me, abrir, laboratorio = false }: { me: Me; abrir: (a: Abertura) => void; laboratorio?: boolean }) {
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [trabalhos, setTrabalhos] = useState<Trabalho[] | null>(null);
  const [usados, setUsados] = useState<string[]>([]);
  // A lista não veio (rede, sessão): diz isso, em vez de mostrar "nenhum trabalho" como se estivesse vazia.
  const [falhou, setFalhou] = useState(false);
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
        .catch(() => {
          setFalhou(true);
          setTrabalhos([]);
        });
      rpc<{ modelo: string }[]>("design_modelos_mais_usados", {})
        .then((l) => setUsados((l ?? []).map((x) => x.modelo)))
        .catch(() => setUsados([]));
    }
    // Vindo do calendário da divulgação ("Criar arte no Estúdio de design"): o título da peça entra no maior texto do modelo.
    let pedido: { titulo?: string; legenda?: string } | null = null;
    if (!laboratorio) {
      try {
        pedido = JSON.parse(window.sessionStorage.getItem("lucia:estudio-pedido") ?? "null");
        window.sessionStorage.removeItem("lucia:estudio-pedido");
      } catch {
        pedido = null;
      }
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
  // No laboratório público, só os modelos dele (sem a marca do instituto).
  const catalogo = laboratorio ? MODELOS_DO_LABORATORIO : MODELOS;
  const inicio = laboratorio ? ["lab-evento", "lab-carrossel", "lab-story-contagem", "lab-cartaz"] : ["post-proposito", "carrossel-completo", "story-aviso", "post-edicao-extra"];
  const sugeridos = (usados.length ? usados : inicio).map((id) => catalogo.find((m) => m.id === id)).filter(Boolean).slice(0, 4);
  const fecharPrimeiroUso = () => {
    setPrimeiroUso(false);
    try {
      window.localStorage.setItem(CHAVE_DO_PRIMEIRO_USO, "1");
    } catch {
      /* sem armazenamento */
    }
  };
  // Fora do painel (laboratório), as classes do site no lugar do tema do painel.
  const lab = (classes: string) => (laboratorio ? classes : undefined);
  const titulo = (texto: string, rotulo?: string, acoes?: ReactNode) =>
    laboratorio ? (
      <div className="flex items-start justify-between gap-3">
        <div>
          {rotulo && <p className="font-mono text-xs uppercase tracking-widest text-gold">{rotulo}</p>}
          <h2 className="font-serif text-2xl font-semibold">{texto}</h2>
        </div>
        {acoes}
      </div>
    ) : (
      <CabecalhoDeSecao nivel={2} titulo={texto} rotulo={rotulo} acoes={acoes} />
    );
  return (
    <div className="grid gap-8">
      {primeiroUso && (
        <Cartao aria-label="Primeiro uso" variante="destaque" className={lab("border border-rule p-5")}>
          {titulo(
            "Uma arte em quatro passos",
            "Primeira vez no estúdio?",
            <Botao variante="discreto" icone simbolo={laboratorio ? undefined : X} aria-label="Fechar" onClick={fecharPrimeiroUso} className={lab("cursor-pointer p-1 text-ink-soft hover:text-ink")}>
              {laboratorio && <Icone nome="fechar" className="h-5 w-5" />}
            </Botao>,
          )}
          <ol className="mt-4 grid gap-4 text-sm sm:grid-cols-4">
            {(
              [
                ["modelos", "Escolha um modelo", laboratorio ? "Modelos livres, para qualquer projeto." : "Todos já vêm com a identidade do instituto."],
                ["texto", "Troque o texto", "Duplo clique no texto da arte e escreva."],
                ["verificar", "Confira", "O estúdio avisa de contraste, letra pequena e área cortada."],
                ["baixar", "Guarde e baixe", laboratorio ? "Guardar fica neste aparelho; Baixar entrega o PNG." : "Guardar leva para a conta; Baixar entrega o PNG."],
              ] as [NomeDoIcone, string, string][]
            ).map(([icone, nome, texto], i) => (
              <li key={nome} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-oxblood text-parchment">
                  <Icone nome={icone} className="h-5 w-5" />
                </span>
                <span>
                  <strong className="block">
                    {i + 1}. {nome}
                  </strong>
                  <span className="text-ink-soft">{texto}</span>
                </span>
              </li>
            ))}
          </ol>
          <Botao variante="principal" className={`mt-4 ${lab("cursor-pointer bg-ink px-5 py-2.5 font-semibold text-parchment hover:bg-oxblood") ?? ""}`} onClick={() => { fecharPrimeiroUso(); abrir({ tipo: "modelo", modelo: catalogo[0] }); }}>
            Abrir um exemplo
          </Botao>
        </Cartao>
      )}

      {rascunho && (
        <Faixa
          tom="bordo"
          className={lab("flex flex-wrap items-center gap-3 border-l-4 border-gold bg-parchment-deep px-4 py-3 [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-gold [&_.pn-faixa-texto]:min-w-0 [&_.pn-faixa-texto]:flex-1")}
          acao={
            <span className="flex flex-wrap items-center gap-3">
              <Botao variante={primeiroUso ? "padrao" : "principal"} pequeno className={lab("cursor-pointer bg-ink px-4 py-2 font-semibold text-parchment hover:bg-oxblood")} onClick={() => abrir({ tipo: "rascunho" })}>
                Continuar
              </Botao>
              <Botao variante="discreto" pequeno className={lab("cursor-pointer text-sm underline")} onClick={() => { try { window.localStorage.removeItem(CHAVE_DO_RASCUNHO(me.id)); } catch { /* sem armazenamento */ } setRascunho(null); }}>
                Descartar
              </Botao>
            </span>
          }
        >
          <p className="min-w-0">
            <strong>Continuar de onde parou:</strong> {rascunho.titulo} <span className="text-ink-soft">({quanto(agora - rascunho.quando)}, neste aparelho)</span>
          </p>
        </Faixa>
      )}

      <section>
        {titulo("Criar")}
        <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {CRIAR.map((c) => (
            <li key={c.formato}>
              <button type="button" className="group flex w-full cursor-pointer flex-col items-center gap-2 rounded-md text-sm" onClick={() => abrir({ tipo: "branco", formato: c.formato })}>
                <span className="flex h-24 w-full items-center justify-center">
                  <span className={`flex h-full max-w-full items-center justify-center rounded-md border border-rule bg-parchment-deep text-ink-soft transition-colors group-hover:border-oxblood group-hover:text-oxblood ${c.proporcao}`}>
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
              <Botao key={f.id} pequeno className={lab("cursor-pointer border border-rule px-3 py-1.5 hover:border-ink")} onClick={() => abrir({ tipo: "branco", formato: f.id })}>
                {f.nome}
              </Botao>
            ))}
          </div>
        </details>
      </section>

      {!laboratorio && (
        <section>
          {titulo("Datas que vêm aí")}
          <ul className="mt-3 grid gap-3 md:grid-cols-3">
            {datas.map((d) => {
              const modelo = MODELOS.find((m) => m.id === d.modelo) ?? MODELOS[0];
              return (
                <li key={d.nome} className="flex">
                  <Cartao as="article" className="flex flex-1 flex-col">
                    <p className="pn-rotulo-mono text-gold">
                      {d.quando.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} · {d.faltam === 0 ? "hoje" : d.faltam === 1 ? "amanhã" : `em ${d.faltam} dias`}
                    </p>
                    <h3 className="pn-cartao-titulo mt-1">{d.nome}</h3>
                    <p className="pn-cartao-sobre flex-1">{d.sugestao}</p>
                    <div className="mt-3">
                      <Botao pequeno onClick={() => abrir({ tipo: "modelo", modelo })}>
                        Criar arte · {modelo.nome}
                      </Botao>
                    </div>
                  </Cartao>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(paraAprovar.length > 0 || meus.length > 0) && (
        <section>
          {titulo(paraAprovar.length ? "Esperando a sua aprovação" : "Pedidos de ajuste")}
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[...paraAprovar, ...meus].map((t) => (
              <li key={t.id}>
                <Cartao as="div" interativo className="p-2" onClick={() => abrir({ tipo: "trabalho", id: t.id })}>
                  <MiniaturaDeTrabalho src={t.miniatura} />
                  <span className="mt-1.5 block truncate text-sm font-semibold">{t.titulo}</span>
                  <span className="block text-xs text-ink-soft">
                    {t.autor} · {NOMES_DO_STATUS[t.status ?? ""] ?? ""}
                  </span>
                </Cartao>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        {titulo(usados.length ? "Os modelos mais usados" : "Para começar")}
        <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {sugeridos.map((m) => (
            <li key={m!.id}>
              <Cartao as="div" interativo className={`p-2 ${lab("cursor-pointer") ?? ""}`} onClick={() => abrir({ tipo: "modelo", modelo: m! })}>
                <span className={`flex aspect-square items-center justify-center rounded-md bg-parchment-deep p-2 ${lab("border border-rule hover:border-ink") ?? ""}`}>
                  <MiniaturaDeModelo id={m!.id} laboratorio={laboratorio} />
                </span>
                <span className="mt-1.5 block truncate text-sm">{m!.nome}</span>
              </Cartao>
            </li>
          ))}
        </ul>
      </section>

      {!laboratorio && (
        <section>
          {titulo("Trabalhos recentes")}
          <div className="mt-3">
            {trabalhos === null ? (
              <Esqueleto forma="cartoes" linhas={4} rotulo="Carregando…" />
            ) : falhou ? (
              <Faixa tom="erro">
                <p>Não deu para carregar os trabalhos agora. Recarregue a página para tentar de novo.</p>
              </Faixa>
            ) : !trabalhos.length ? (
              <Vazio titulo="Nenhum trabalho guardado ainda." />
            ) : (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                {trabalhos.slice(0, 12).map((t) => (
                  <li key={t.id} title={`${t.titulo} · ${t.autor}`}>
                    <Cartao as="div" interativo className="p-2" onClick={() => abrir({ tipo: "trabalho", id: t.id })}>
                      <MiniaturaDeTrabalho src={t.miniatura} />
                      <span className="mt-1.5 block truncate text-sm font-semibold">{t.titulo}</span>
                      <span className="block truncate text-xs text-ink-soft">
                        {t.autor} · {new Date(t.atualizado_em).toLocaleDateString("pt-BR")}
                      </span>
                    </Cartao>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
