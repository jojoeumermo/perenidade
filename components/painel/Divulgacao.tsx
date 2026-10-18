// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { can, type Me } from "@/lib/backend";
import { CampoData } from "./Campos";
import { Abas, Aviso, botao, botaoClaro, campo, dataHora, dia, elo, rotulo, useAcao, useLista } from "./comum";

interface Item {
  id: string;
  rede: "instagram" | "outra";
  formato: "post" | "carrossel" | "story" | "reels" | "video" | "outro";
  titulo: string;
  legenda: string;
  data_prevista: string | null;
  material: string;
  situacao: "ideia" | "rascunho" | "pronto" | "publicado";
  nota: string;
  devolvido: boolean;
  criado_por: string;
  mexido_por: string;
  mexido_em: string;
  responsavel_id?: string | null;
  responsavel?: string;
  aprovado_por?: string;
  aprovado_em?: string | null;
}
interface Calendario {
  instagram: string;
  itens: Item[];
}
interface Membro {
  id: string;
  nome: string;
}
interface Sugestao {
  id: string;
  autor: string;
  texto: string;
  quando: string | null;
  status: "nova" | "em_andamento" | "feita" | "descartada";
  criado_em: string;
}
interface Acesso {
  id: string;
  pessoa: string | null;
  nome: string;
  conta: string;
  permissoes: string;
  situacao: "convidado" | "ativo" | "removido";
  convidado_em: string;
  removido_em: string | null;
  nota: string;
  na_equipe: boolean;
}

const formatos: Record<Item["formato"], string> = { post: "Post", carrossel: "Carrossel", story: "Story", reels: "Reels", video: "Vídeo", outro: "Outro" };
const situacoes: Record<Item["situacao"], string> = { ideia: "Ideia", rascunho: "Rascunho", pronto: "Pronto para sair", publicado: "Publicado" };
const ordem: Item["situacao"][] = ["ideia", "rascunho", "pronto", "publicado"];
const situacaoDaSugestao: Record<string, string> = { nova: "nova", em_andamento: "em andamento", feita: "feita", descartada: "não vai acontecer" };
const vazio = { id: "", rede: "instagram" as Item["rede"], formato: "post" as Item["formato"], titulo: "", legenda: "", data_prevista: "", material: "", situacao: "ideia" as Item["situacao"], responsavel: "" };
type Formulario = typeof vazio;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const isoDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** As peças da marca que moram no site: nome, para que serve e os tamanhos disponíveis. */
const pecas: { nome: string; uso: string; arquivos: [string, string][]; fundo?: "claro" | "escuro" | "ambos" }[] = [
  { nome: "Marca completa", uso: "Assinatura principal: cartazes, rodapés, capas. Tem fundo transparente.", arquivos: [["/marca.png", "PNG grande"], ["/marca-512.png", "PNG 512 px"], ["/marca-192.png", "PNG 192 px"], ["/marca-96.png", "PNG 96 px"]], fundo: "ambos" },
  { nome: "Marca recortada", uso: "Foto de perfil nas redes (o círculo corta as bordas sem perder a estrela).", arquivos: [["/marca-recorte-512.png", "PNG 512 px"]] },
  { nome: "Emblema", uso: "Só a estrela no selo: carimbos, marca-d'água, espaços pequenos.", arquivos: [["/emblema.png", "PNG grande"], ["/emblema-96.png", "PNG 96 px"]], fundo: "ambos" },
  { nome: "Ícone do aplicativo", uso: "Atalho do site no celular e avatares quadrados.", arquivos: [["/icone-512.png", "PNG 512 px"], ["/icone-192.png", "PNG 192 px"], ["/icone-recorte-512.png", "PNG 512 px recortado"]] },
  { nome: "Cartão de compartilhamento", uso: "Imagem que aparece quando alguém compartilha o site.", arquivos: [["/cartao.png", "PNG 1200 × 630"]] },
  { nome: "Cartão com o retrato de Lúcia", uso: "Datas de memória e campanhas sobre a história do instituto.", arquivos: [["/cartao-lucia.png", "PNG 1200 × 630"]] },
  { nome: "Retrato de Lúcia", uso: "Só com contexto (quem foi Lúcia). Não recortar nem colorir.", arquivos: [["/lucia.png", "PNG"]] },
];
/** As cores e letras do site, tiradas de app/globals.css e do layout: mudou lá, mude aqui. */
const cores: [string, string, string][] = [
  ["Papel", "#f4ecd8", "fundo claro"],
  ["Papel fundo", "#e9dcbc", "quadros e cartões"],
  ["Tinta", "#1f1a14", "texto e faixas pretas"],
  ["Tinta suave", "#5a4e3c", "texto de apoio"],
  ["Ouro", "#8a5f1c", "rótulos e detalhes"],
  ["Vinho", "#6e1f1a", "alertas e destaques"],
  ["Vermelho de prelo", "#c21f16", "faixas dos cartazes"],
  ["Fio", "#cdbb91", "linhas e bordas"],
];
const letras: [string, string][] = [
  ["EB Garamond", "títulos e nomes (serifa)"],
  ["Inter", "texto corrido e botões"],
  ["IBM Plex Mono", "rótulos, datas e carimbos"],
];

/**
 * Marketing e divulgação: o quadro e o calendário do que vai para as redes, a caixa de sugestões, o kit da marca e o
 * acesso ao Instagram (com o registro de quem tem acesso). "Pronto para sair" é aprovação: só coordenação e supervisão
 * marcam. O site não guarda senha nem chave de rede social: o acesso ao perfil é dado pela coordenação na própria Meta.
 */
export function Divulgacao({ me }: { me: Me }) {
  const coordena = can(me, "coordenacao");
  const aprova = coordena || can(me, "supervisao");
  const lista = useLista<Calendario>("divulgacao_listar");
  const equipe = useLista<Membro[]>("equipe_membros", {}, { quieta: true });
  const [aba, setAba] = useState<"calendario" | "caixa" | "kit" | "instagram">("calendario");
  const caixa = useLista<Sugestao[]>("marketing_caixa");
  const caixaAcao = useAcao(caixa.recarregar);
  const [form, setForm] = useState<Formulario | null>(null);
  const [vista, setVista] = useState<"quadro" | "mes" | "semana">("quadro");
  const [filtro, setFiltro] = useState<"" | Item["situacao"]>("");
  const [referencia, setReferencia] = useState(() => new Date());
  const acao = useAcao(lista.recarregar);
  const itens = lista.dados?.itens ?? [];
  const visiveis = itens.filter((item) => !filtro || item.situacao === filtro);
  const hoje = isoDe(new Date());
  const arrastando = useRef<string | null>(null);

  const abrir = (item?: Item) => setForm(item ? { ...vazio, ...item, data_prevista: item.data_prevista ?? "", responsavel: item.responsavel_id ?? "" } : { ...vazio });
  const mover = (item: Item, situacao: Item["situacao"]) => {
    if (item.situacao === situacao) return;
    if (situacao === "pronto" && !aprova) {
      acao.setAviso("“Pronto para sair” é aprovação: quem marca é a coordenação ou a supervisão.");
      return;
    }
    void acao.agir("divulgacao_situacao", { p_id: item.id, p_situacao: situacao }, `“${item.titulo}”: ${situacoes[situacao].toLowerCase()}.`);
  };

  const cartao = (item: Item, compacto = false) => {
    const atrasado = item.situacao !== "publicado" && item.data_prevista !== null && item.data_prevista < hoje;
    return (
      <button
        type="button"
        key={item.id}
        draggable
        onDragStart={() => { arrastando.current = item.id; }}
        onDragEnd={() => { arrastando.current = null; }}
        onClick={() => abrir(item)}
        className={`block w-full cursor-pointer border bg-parchment p-2 text-left hover:border-ink ${item.devolvido ? "border-2 border-oxblood" : "border-rule"}`}
      >
        <span className="block font-mono text-[0.65rem] uppercase tracking-wider text-gold">
          {formatos[item.formato]}{!compacto && ` · ${item.data_prevista ? dia(item.data_prevista) : "sem data"}`}
        </span>
        <span className={`block font-semibold leading-snug ${compacto ? "text-xs" : ""}`}>{item.titulo}</span>
        {!compacto && (
          <span className="mt-1 flex flex-wrap gap-1 text-[0.7rem]">
            {item.responsavel && <span className="border border-rule px-1">👤 {item.responsavel}</span>}
            {item.devolvido && <span className="border border-oxblood px-1 text-oxblood">devolvido</span>}
            {atrasado && <span className="border border-oxblood px-1 text-oxblood">data passou</span>}
            {item.aprovado_por && (item.situacao === "pronto" || item.situacao === "publicado") && <span className="border border-ok px-1 text-ok">✓ {item.aprovado_por}</span>}
          </span>
        )}
      </button>
    );
  };

  // Calendário: o mês (ou a semana) da data de referência.
  const ano = referencia.getFullYear();
  const mesAtual = referencia.getMonth();
  const inicioSemana = new Date(referencia);
  inicioSemana.setDate(referencia.getDate() - referencia.getDay());
  const diasDoMes = Array.from({ length: new Date(ano, mesAtual + 1, 0).getDate() }, (_, i) => isoDe(new Date(ano, mesAtual, i + 1)));
  const diasDaSemana = Array.from({ length: 7 }, (_, i) => { const d = new Date(inicioSemana); d.setDate(inicioSemana.getDate() + i); return isoDe(d); });
  const doDia = (iso: string) => visiveis.filter((i) => i.data_prevista === iso);
  const andar = (n: number) => setReferencia((r) => { const d = new Date(r); if (vista === "semana") d.setDate(d.getDate() + 7 * n); else d.setMonth(d.getMonth() + n, 1); return d; });

  return (
    <div>
      <Abas
        atual={aba}
        escolher={setAba}
        opcoes={[
          { id: "calendario" as const, nome: "Quadro e calendário", conta: itens.filter((item) => item.devolvido).length },
          { id: "caixa" as const, nome: "Caixa de sugestões", conta: caixa.dados?.filter((s) => s.status === "nova").length },
          { id: "kit" as const, nome: "Kit da marca" },
          { id: "instagram" as const, nome: "Acesso ao Instagram" },
        ]}
      />

      {aba === "caixa" && (
        <section className="painel-cartao p-5">
          <h2 className="font-serif text-xl font-semibold">O que a equipe sugere</h2>
          <p className="mt-1 text-ink-soft">Ideias de post, datas e pautas mandadas por qualquer pessoa da equipe pela Mesa.</p>
          <Aviso texto={caixa.erro || caixaAcao.aviso} />
          <ul className="mt-3 space-y-2">
            {caixa.dados?.map((s) => (
              <li key={s.id} className={`border border-rule bg-parchment p-3 ${s.status === "feita" || s.status === "descartada" ? "opacity-70" : ""}`}>
                <p className="whitespace-pre-wrap">{s.texto}</p>
                <p className="mt-1 text-xs text-ink-soft">{s.autor || "Alguém da equipe"} · {dataHora(s.criado_em)}{s.quando ? ` · para ${dia(s.quando)}` : ""} · {situacaoDaSugestao[s.status] ?? s.status}</p>
                <p className="mt-2 flex flex-wrap gap-3 text-sm">
                  {(["em_andamento", "feita", "descartada"] as const).filter((x) => x !== s.status).map((x) => (
                    <button key={x} type="button" className={elo} disabled={caixaAcao.ocupado} onClick={() => caixaAcao.agir("marketing_caixa_decidir", { p_id: s.id, p_status: x }, "Anotado ✓")}>
                      {x === "em_andamento" ? "Em andamento" : x === "feita" ? "Feita" : "Não vai acontecer"}
                    </button>
                  ))}
                  {s.status !== "feita" && (
                    <button type="button" className={elo} onClick={() => { setForm({ ...vazio, titulo: s.texto.slice(0, 80), legenda: s.texto, data_prevista: s.quando ?? "" }); setAba("calendario"); }}>Pôr no calendário</button>
                  )}
                </p>
              </li>
            ))}
            {caixa.dados?.length === 0 && <li className="text-ink-soft">Nenhuma sugestão ainda. Qualquer pessoa da equipe manda ideias pela caixa “Ideia para a divulgação”, na Mesa.</li>}
          </ul>
        </section>
      )}

      {aba === "calendario" && (
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={botao} onClick={() => abrir()}>＋ Novo item</button>
            <span className="flex" role="group" aria-label="Visão">
              {([["quadro", "Quadro"], ["mes", "Mês"], ["semana", "Semana"]] as const).map(([id, nome]) => (
                <button key={id} type="button" aria-pressed={vista === id} onClick={() => setVista(id)} className={`cursor-pointer border px-3 py-1.5 text-sm ${vista === id ? "border-ink bg-ink text-parchment" : "border-rule"}`}>{nome}</button>
              ))}
            </span>
            <span className="ml-auto flex flex-wrap items-center gap-2 text-sm">
              <span className={rotulo}>Mostrar</span>
              {(["", ...ordem] as ("" | Item["situacao"])[]).map((id) => (
                <button key={id || "tudo"} type="button" onClick={() => setFiltro(id)} aria-pressed={filtro === id} className={`cursor-pointer border px-2 py-1 ${filtro === id ? "border-ink bg-ink text-parchment" : "border-rule"}`}>
                  {id ? situacoes[id] : "Tudo"} ({id ? itens.filter((item) => item.situacao === id).length : itens.length})
                </button>
              ))}
            </span>
          </div>
          <Aviso texto={lista.erro || acao.aviso} />

          {vista === "quadro" ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {ordem.map((s) => (
                <section
                  key={s}
                  aria-label={situacoes[s]}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const item = itens.find((i) => i.id === arrastando.current); if (item) mover(item, s); }}
                  className="min-h-48 border border-rule bg-parchment-deep p-2"
                >
                  <h3 className="mb-2 flex items-baseline justify-between font-semibold">
                    {situacoes[s]} <span className="font-mono text-xs text-ink-soft">{itens.filter((i) => i.situacao === s).length}</span>
                  </h3>
                  {s === "pronto" && !aprova && <p className="mb-2 text-xs text-ink-soft">Só a coordenação ou a supervisão aprovam para sair.</p>}
                  <div className="space-y-2">{visiveis.filter((i) => i.situacao === s).map((i) => cartao(i))}</div>
                </section>
              ))}
            </div>
          ) : (
            <div className="mt-3">
              <div className="mb-2 flex items-center gap-3">
                <button type="button" className={botaoClaro} aria-label="Anterior" onClick={() => andar(-1)}>‹</button>
                <strong className="font-serif text-lg">{vista === "mes" ? `${MESES[mesAtual]} de ${ano}` : `Semana de ${dia(diasDaSemana[0])} a ${dia(diasDaSemana[6])}`}</strong>
                <button type="button" className={botaoClaro} aria-label="Próximo" onClick={() => andar(1)}>›</button>
                <button type="button" className={elo} onClick={() => setReferencia(new Date())}>Hoje</button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-sm">
                {SEMANA.map((d) => <span key={d} className="text-center font-mono text-xs uppercase text-ink-soft">{d}</span>)}
                {vista === "mes" && Array.from({ length: new Date(ano, mesAtual, 1).getDay() }, (_, i) => <span key={`v${i}`} />)}
                {(vista === "mes" ? diasDoMes : diasDaSemana).map((iso) => (
                  <div
                    key={iso}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const item = itens.find((i) => i.id === arrastando.current); if (item) void acao.agir("divulgacao_salvar", { p: { ...item, responsavel: item.responsavel_id ?? "", data_prevista: iso } }, `Remarcado para ${dia(iso)}.`); }}
                    className={`border p-1 ${vista === "semana" ? "min-h-64" : "min-h-24"} ${iso === hoje ? "border-oxblood" : "border-rule"} bg-parchment-deep`}
                  >
                    <span className={`block text-right font-mono text-[0.7rem] ${iso === hoje ? "font-bold text-oxblood" : "text-ink-soft"}`}>{Number(iso.slice(8))}</span>
                    <div className="space-y-1">{doDia(iso).map((i) => cartao(i, true))}</div>
                  </div>
                ))}
              </div>
              {visiveis.some((i) => !i.data_prevista) && (
                <div className="mt-3">
                  <p className={rotulo}>Sem data</p>
                  <div className="mt-1 grid gap-2 sm:grid-cols-3">{visiveis.filter((i) => !i.data_prevista).map((i) => cartao(i))}</div>
                </div>
              )}
              <p className="mt-2 text-xs text-ink-soft">Arraste uma peça para outro dia para remarcar.</p>
            </div>
          )}
          {lista.dados && itens.length === 0 && (
            <div className="mt-4 border border-rule bg-parchment-deep px-4 py-8 text-center">
              <p className="text-ink-soft">O calendário está vazio.</p>
              <button type="button" className={`mt-2 ${botao}`} onClick={() => abrir()}>Criar a primeira peça</button>
            </div>
          )}
        </div>
      )}

      {form && <PainelDoItem form={form} setForm={setForm} item={itens.find((i) => i.id === form.id) ?? null} equipe={equipe.dados ?? []} aprova={aprova} coordena={coordena} recarregar={lista.recarregar} fechar={() => setForm(null)} />}

      {aba === "kit" && <KitDaMarca />}
      {aba === "instagram" && <Instagram coordena={coordena} aprova={aprova} perfilAtual={lista.dados?.instagram ?? ""} recarregar={lista.recarregar} equipe={equipe.dados ?? []} />}
    </div>
  );
}

/** O formulário do item, num painel lateral: os campos, a prévia do post e as ações. */
function PainelDoItem({ form, setForm, item, equipe, aprova, coordena, recarregar, fechar }: { form: Formulario; setForm: (f: Formulario) => void; item: Item | null; equipe: Membro[]; aprova: boolean; coordena: boolean; recarregar: () => void; fechar: () => void }) {
  const acao = useAcao(recarregar);
  const router = useRouter();
  const [nota, setNota] = useState(item?.nota ?? "");
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    caixa.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [fechar]);
  const imagem = /^\/arquivos\/[a-f0-9]{20}\.(webp|jpg)$/.test(form.material) ? form.material : "";

  async function guardar() {
    const r = (await acao.agir("divulgacao_salvar", { p: form }, form.id ? "Salvo ✓" : "Peça criada ✓")) as { id?: string; situacao?: string } | null;
    if (r?.id) {
      if (form.situacao === "pronto" && r.situacao === "rascunho") acao.setAviso("Salvo. Como o texto mudou depois da aprovação, a peça voltou para rascunho e precisa ser aprovada de novo.");
      setForm({ ...form, id: r.id, situacao: (r.situacao as Item["situacao"]) ?? form.situacao });
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={caixa} role="dialog" aria-modal="true" aria-label={form.id ? "Corrigir peça" : "Nova peça"} className="h-full w-full max-w-3xl overflow-y-auto bg-parchment p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl font-semibold">{form.id ? "Corrigir peça" : "Nova peça"}</h2>
          <button type="button" className={elo} onClick={fechar}>Fechar ✕</button>
        </div>
        <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_17rem]">
          <div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">Rede<select value={form.rede} onChange={(e) => setForm({ ...form, rede: e.target.value as Item["rede"] })} className={campo}><option value="instagram">Instagram</option><option value="outra">Outra rede</option></select></label>
              <label className="block">Formato<select value={form.formato} onChange={(e) => setForm({ ...form, formato: e.target.value as Item["formato"] })} className={campo}>{(Object.keys(formatos) as Item["formato"][]).map((id) => <option key={id} value={id}>{formatos[id]}</option>)}</select></label>
              <CampoData rotulo="Data prevista" valor={form.data_prevista} mudar={(v) => setForm({ ...form, data_prevista: v })} />
              <label className="block">
                Situação
                <select value={form.situacao} onChange={(e) => setForm({ ...form, situacao: e.target.value as Item["situacao"] })} className={campo}>
                  {ordem.map((id) => <option key={id} value={id} disabled={id === "pronto" && !aprova && item?.situacao !== "pronto"}>{situacoes[id]}{id === "pronto" && !aprova ? " (aprovação)" : ""}</option>)}
                </select>
              </label>
              <label className="block sm:col-span-2">
                Responsável
                <select value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} className={campo}>
                  <option value="">Ninguém ainda</option>
                  {equipe.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </label>
            </div>
            <label className="mt-3 block">Título (para a equipe se achar)<input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} maxLength={120} className={campo} /></label>
            <label className="mt-3 block">Legenda<textarea value={form.legenda} onChange={(e) => setForm({ ...form, legenda: e.target.value })} maxLength={2200} rows={6} className={campo} /></label>
            <p className={`text-right font-mono text-xs ${form.legenda.length > 2100 ? "text-oxblood" : "text-ink-soft"}`}>{form.legenda.length}/2200</p>
            <label className="mt-1 block">Material<input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} maxLength={500} placeholder="https://… (pasta de trabalho) ou /arquivos/… (já publicado)" className={campo} /></label>
            <p className="mt-1 text-xs text-ink-soft">Imagem nova? Envie em Materiais e arquivos: aprovada, ela ganha um endereço /arquivos/… que serve aqui.</p>
            {item?.aprovado_por && <p className="mt-2 text-sm text-ok">✓ Aprovado por {item.aprovado_por}{item.aprovado_em ? ` em ${dataHora(item.aprovado_em)}` : ""}.</p>}
            {item && <p className="mt-1 text-xs text-ink-soft">Criado por {item.criado_por || "alguém que saiu da equipe"} · mexido por último por {item.mexido_por || "alguém que saiu da equipe"} em {dataHora(item.mexido_em)}</p>}
            <p className="mt-4 flex flex-wrap gap-3">
              <button type="button" className={botao} disabled={acao.ocupado || form.titulo.trim().length < 3} onClick={() => void guardar()}>{form.id ? "Guardar" : "Criar a peça"}</button>
              <button type="button" className={botaoClaro} onClick={() => { try { window.sessionStorage.setItem("lucia:estudio-pedido", JSON.stringify({ titulo: form.titulo, legenda: form.legenda, formato: form.formato })); } catch { /* sem armazenamento */ } router.push("/pt/painel?aba=estudio"); }}>Criar arte no Estúdio de design</button>
              {form.id && <button type="button" className={`${elo} text-oxblood`} disabled={acao.ocupado} onClick={async () => { if (window.confirm(`Apagar “${form.titulo}” do calendário? Não tem volta.`) && (await acao.agir("divulgacao_apagar", { p_id: form.id }, "Apagado."))) fechar(); }}>Apagar</button>}
            </p>
            <Aviso texto={acao.aviso} />
            {item?.nota && <p className="mt-3 border-l-2 border-oxblood pl-3"><strong>{item.devolvido ? "Devolvido pela coordenação:" : "Nota da coordenação:"}</strong> {item.nota}</p>}
            {coordena && item && (
              <div className="mt-4 border-t border-rule pt-3">
                <label className="block">Nota da coordenação<input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={1000} className={campo} /></label>
                <p className="mt-2 flex flex-wrap gap-3">
                  <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => acao.agir("divulgacao_comentar", { p_id: item.id, p_nota: nota, p_devolver: false }, "Nota guardada ✓")}>Guardar a nota</button>
                  {item.situacao !== "rascunho" && item.situacao !== "ideia" && (
                    <button type="button" className={botaoClaro} disabled={acao.ocupado || nota.trim().length < 5} onClick={() => { if (window.confirm("Devolver para rascunho? Quem criou e quem mexeu por último recebem a nota.")) void acao.agir("divulgacao_comentar", { p_id: item.id, p_nota: nota, p_devolver: true }, "Devolvido para rascunho."); }}>Devolver para rascunho</button>
                  )}
                </p>
              </div>
            )}
          </div>
          <div>
            <p className={rotulo}>Prévia</p>
            <div className="mt-1 border border-rule bg-white text-[#262626]">
              <div className="flex items-center gap-2 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/marca-recorte-512.png" alt="" className="h-7 w-7 rounded-full border border-[#dbdbdb]" />
                <span className="text-xs font-semibold">institutolucia</span>
              </div>
              <div className={`flex items-center justify-center bg-[#efefef] ${form.formato === "story" || form.formato === "reels" ? "aspect-[9/16]" : "aspect-[4/5]"}`}>
                {imagem ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagem} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="px-4 text-center font-serif text-lg text-[#8e8e8e]">{form.titulo || "A arte aparece aqui"}</span>
                )}
              </div>
              <p className="whitespace-pre-line p-2 text-xs leading-relaxed"><strong>institutolucia</strong> {form.legenda.length > 160 ? `${form.legenda.slice(0, 160)}… mais` : form.legenda || <span className="text-[#8e8e8e]">legenda</span>}</p>
            </div>
            <p className="mt-1 text-xs text-ink-soft">Aproximação do que aparece no Instagram. A arte precisa estar publicada em /arquivos para aparecer aqui.</p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function KitDaMarca() {
  const [copiado, setCopiado] = useState("");
  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-serif text-2xl font-semibold">Arquivos da marca</h2>
        <p className="mt-1 text-ink-soft">Use estes, sem redesenhar a marca. Todos em PNG com fundo transparente; a prévia mostra cada um no fundo claro e no escuro.</p>
        <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pecas.map((p) => (
            <li key={p.nome} className="painel-cartao p-3">
              <div className="grid grid-cols-2 gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.arquivos[0][0]} alt={`${p.nome} no fundo claro`} loading="lazy" className="h-24 w-full bg-[#f4ecd8] object-contain p-2" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.arquivos[0][0]} alt={`${p.nome} no fundo escuro`} loading="lazy" className="h-24 w-full bg-[#1f1a14] object-contain p-2" />
              </div>
              <p className="mt-2 font-semibold">{p.nome}</p>
              <p className="text-sm text-ink-soft">{p.uso}</p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-sm">
                {p.arquivos.map(([caminho, formato]) => <a key={caminho} href={caminho} download className={elo}>{formato}</a>)}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-soft">Ainda não há versão em SVG da marca: quando o design fizer, ela entra aqui.</p>
      </section>
      <section>
        <h2 className="font-serif text-2xl font-semibold">Cores</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cores.map(([nome, hex, uso]) => (
            <li key={hex} className="flex items-center gap-3 painel-cartao p-3">
              <span aria-hidden className="h-12 w-12 shrink-0 border border-rule" style={{ background: hex }} />
              <span className="min-w-0">
                <span className="block font-semibold">{nome}</span>
                <span className="block text-xs text-ink-soft">{uso}</span>
                <button type="button" className="mt-1 cursor-pointer border border-rule px-1.5 py-0.5 font-mono text-xs hover:border-ink" onClick={() => void navigator.clipboard?.writeText(hex).then(() => { setCopiado(hex); window.setTimeout(() => setCopiado(""), 1500); })}>
                  {copiado === hex ? "Copiado ✓" : `${hex} · copiar`}
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-serif text-2xl font-semibold">Letras</h2>
        <ul className="mt-3 space-y-2">
          {letras.map(([nome, uso]) => (
            <li key={nome}><strong>{nome}</strong> <span className="text-ink-soft">· {uso} · livre (SIL Open Font License), no Google Fonts</span></li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-serif text-2xl font-semibold">Regras de uso</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="painel-cartao p-4">
            <h3 className="font-semibold">Espaço e tamanho</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              <li><strong>Área de respeito:</strong> em volta da marca, deixe livre pelo menos a altura da estrela. Nada de texto ou imagem encostando.</li>
              <li><strong>Tamanho mínimo:</strong> marca completa com 120 px de largura na tela (3 cm no papel); abaixo disso, use o emblema (mínimo 32 px, 1 cm).</li>
              <li><strong>Fundo:</strong> pergaminho, papel, preto ou vermelho de prelo. Em foto, só sobre área calma ou com faixa por baixo.</li>
            </ul>
          </div>
          <div className="painel-cartao p-4">
            <h3 className="font-semibold">O que não fazer</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              <li>Esticar, girar, recolorir ou pôr sombra e contorno na marca.</li>
              <li>Trocar as letras do nome ou redesenhar a estrela.</li>
              <li>Usar a marca em peça de partido ou de candidatura.</li>
              <li>Colocar a marca sobre imagem de terceiros sem licença.</li>
            </ul>
          </div>
          <div className="painel-cartao p-4 md:col-span-2">
            <h3 className="font-semibold">Tom das peças</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              <li>O desenho dos cartazes do site: faixa vermelha ou preta, letra pesada, a estrela.</li>
              <li>Frase curta e direta; convite, nunca ordem.</li>
              <li>Toda informação com fonte; número sempre com de onde veio.</li>
              <li>Imagem só nossa, em domínio público ou com licença livre, com o crédito.</li>
              <li>Acessível: texto alternativo no post, legenda nos vídeos, contraste forte.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function Instagram({ coordena, aprova, perfilAtual, recarregar, equipe }: { coordena: boolean; aprova: boolean; perfilAtual: string; recarregar: () => void; equipe: Membro[] }) {
  const acao = useAcao(recarregar);
  const [perfil, setPerfil] = useState<string | null>(null);
  const perfilValido = (v: string) => v === "" || /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]{1,30}\/?$/.test(v);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="painel-cartao p-5">
        <h2 className="font-serif text-xl font-semibold">Como dar e tirar o acesso</h2>
        <p className="mt-2 border-l-2 border-oxblood pl-3"><strong>O site nunca guarda senha de rede social.</strong> Não mande senha do perfil por aqui, no mural nem por mensagem.</p>
        <h3 className="mt-4 font-semibold">A coordenação convida</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>No Instagram do instituto, abra Configurações → Central de Contas (ou o Meta Business Suite).</li>
          <li>Entre em Pessoas (ou Colaboradores) → Adicionar pessoa.</li>
          <li>Procure a conta pessoal da voluntária ou do voluntário e marque só o necessário: publicar posts, stories e reels; responder mensagens só se for a função.</li>
          <li>Envie o convite e registre aqui embaixo (nome, conta, permissões, data).</li>
        </ol>
        <h3 className="mt-4 font-semibold">Quem recebe aceita</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>Abra o Instagram ou o e-mail da Meta na sua conta pessoal: chega “Convite para acessar Instituto Lúcia”.</li>
          <li>Toque em Aceitar. O perfil do instituto aparece para alternar no seu aplicativo.</li>
          <li>Ligue a autenticação em dois fatores na sua conta pessoal: a Meta pede para quem administra páginas.</li>
        </ol>
        <h3 className="mt-4 font-semibold">Quando alguém sai da equipe</h3>
        <p className="mt-1 text-sm">A coordenação tira o acesso na mesma tela (Pessoas → a pessoa → Remover) e marca “removido” no registro. O painel avisa a coordenação quando alguém com acesso perde a última função.</p>
        <div className="mt-4 border-t border-rule pt-3">
          {perfilAtual ? <p>Perfil do instituto: <a href={perfilAtual} target="_blank" rel="noopener noreferrer" className={elo}>{perfilAtual}</a></p> : <p className="text-ink-soft">A coordenação ainda não indicou o endereço público do perfil.</p>}
          {coordena && (
            <div className="mt-2">
              <label className="block">Endereço público do perfil (só o endereço, nada de senha)<input value={perfil ?? perfilAtual} onChange={(e) => setPerfil(e.target.value)} maxLength={80} placeholder="https://www.instagram.com/…" className={campo} aria-invalid={perfil !== null && !perfilValido(perfil.trim())} /></label>
              {perfil !== null && !perfilValido(perfil.trim()) && <p role="alert" className="text-sm text-oxblood">Use o endereço completo: https://www.instagram.com/nome_do_perfil</p>}
              <button type="button" className={`mt-2 ${botaoClaro}`} disabled={acao.ocupado || perfil === null || !perfilValido(perfil.trim())} onClick={async () => { if (await acao.agir("divulgacao_instagram_salvar", { p_url: (perfil ?? "").trim() }, "Endereço guardado ✓")) setPerfil(null); }}>Guardar</button>
              <Aviso texto={acao.aviso} />
            </div>
          )}
        </div>
      </section>

      {aprova ? <RegistroDoInstagram coordena={coordena} equipe={equipe} /> : <section className="painel-cartao p-5 text-sm text-ink-soft">O registro de quem tem acesso fica com a coordenação e a supervisão.</section>}
    </div>
  );
}

/** O registro de convites e acessos ao Instagram (coordenação e supervisão leem; só a coordenação escreve). */
function RegistroDoInstagram({ coordena, equipe }: { coordena: boolean; equipe: Membro[] }) {
  const registro = useLista<Acesso[]>("instagram_acessos_listar", {}, { quieta: true });
  const acaoRegistro = useAcao(registro.recarregar);
  const novo = { id: "", pessoa: "", nome: "", conta: "", permissoes: "Publicar posts, stories e reels", situacao: "convidado" as Acesso["situacao"], convidado_em: "", removido_em: "", nota: "" };
  const [form, setForm] = useState(novo);
  const acessos = registro.dados ?? [];
  return (
    <section className="painel-cartao p-5">
      <h2 className="font-serif text-xl font-semibold">Quem tem acesso</h2>
      <p className="mt-1 text-sm text-ink-soft">O registro de convites e acessos (a Meta não conta para o site). Serve para lembrar de tirar o acesso de quem saiu.</p>
      <ul className="mt-3 divide-y divide-rule border-y border-rule text-sm">
        {acessos.map((a) => (
          <li key={a.id} className="py-2">
            <p className="flex flex-wrap items-baseline gap-2">
              <strong>{a.nome}</strong>{a.conta && <span className="font-mono text-xs">{a.conta.startsWith("@") ? a.conta : `@${a.conta}`}</span>}
              <span className={`border px-1 text-xs ${a.situacao === "removido" ? "border-rule text-ink-soft" : a.situacao === "ativo" ? "border-ok text-ok" : "border-gold text-gold"}`}>{a.situacao}</span>
              {a.situacao !== "removido" && !a.na_equipe && <span className="border border-oxblood px-1 text-xs text-oxblood">saiu da equipe: tirar o acesso</span>}
            </p>
            <p className="text-xs text-ink-soft">{a.permissoes} · convidado em {dia(a.convidado_em)}{a.removido_em ? ` · removido em ${dia(a.removido_em)}` : ""}{a.nota ? ` · ${a.nota}` : ""}</p>
            {coordena && <button type="button" className={`${elo} text-xs`} onClick={() => setForm({ id: a.id, pessoa: a.pessoa ?? "", nome: a.nome, conta: a.conta, permissoes: a.permissoes, situacao: a.situacao, convidado_em: a.convidado_em, removido_em: a.removido_em ?? "", nota: a.nota })}>Corrigir</button>}
          </li>
        ))}
        {acessos.length === 0 && <li className="py-2 text-ink-soft">Nenhum acesso registrado.</li>}
      </ul>
      {coordena && (
        <div className="mt-4 border-t border-rule pt-3">
          <h3 className="font-semibold">{form.id ? "Corrigir registro" : "Registrar convite ou acesso"}</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="block text-sm">Pessoa da equipe<select value={form.pessoa} onChange={(e) => { const m = equipe.find((x) => x.id === e.target.value); setForm({ ...form, pessoa: e.target.value, nome: form.nome || m?.nome || "" }); }} className={campo}><option value="">De fora do painel</option>{equipe.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></label>
            <label className="block text-sm">Nome<input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={120} className={campo} /></label>
            <label className="block text-sm">Conta pessoal no Instagram<input value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value.trim() })} maxLength={31} placeholder="@conta" className={`${campo} font-mono`} /></label>
            <label className="block text-sm">Situação<select value={form.situacao} onChange={(e) => setForm({ ...form, situacao: e.target.value as Acesso["situacao"] })} className={campo}><option value="convidado">Convidado</option><option value="ativo">Ativo</option><option value="removido">Removido</option></select></label>
            <CampoData rotulo="Convidado em" valor={form.convidado_em} mudar={(v) => setForm({ ...form, convidado_em: v })} className="text-sm" />
            {form.situacao === "removido" && <CampoData rotulo="Removido em" valor={form.removido_em} mudar={(v) => setForm({ ...form, removido_em: v })} className="text-sm" />}
            <label className="block text-sm sm:col-span-2">Permissões dadas<input value={form.permissoes} onChange={(e) => setForm({ ...form, permissoes: e.target.value })} maxLength={300} className={campo} /></label>
            <label className="block text-sm sm:col-span-2">Nota<input value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} maxLength={500} className={campo} /></label>
          </div>
          <p className="mt-2 flex gap-3">
            <button type="button" className={botao} disabled={acaoRegistro.ocupado || form.nome.trim().length < 2} onClick={async () => { if (await acaoRegistro.agir("instagram_acesso_salvar", { p: form }, "Registro guardado ✓")) setForm(novo); }}>Guardar</button>
            {form.id && <button type="button" className={elo} onClick={() => setForm(novo)}>Cancelar</button>}
          </p>
          <Aviso texto={acaoRegistro.aviso || registro.erro} />
        </div>
      )}
    </section>
  );
}
