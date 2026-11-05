// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Download, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { can, type Me } from "@/lib/backend";
import { useI18n } from "../I18n";
import { CampoData } from "./Campos";
import { dataHora, dia, useAcao, useLista } from "./comum";
import { Abas, Area, Botao, Campo, Cartao, confirmarFrase, Dialogo, Faixa, ItemDeLista, Lista, Selecao, Selo, type TomDoSelo, Vazio } from "./ui";

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
/** O tom do selo de cada situação (a palavra vem junto, sempre). */
const tomDaSituacao: Record<Item["situacao"], TomDoSelo> = { ideia: "neutro", rascunho: "info", pronto: "ouro", publicado: "ok" };
const ordem: Item["situacao"][] = ["ideia", "rascunho", "pronto", "publicado"];
const situacaoDaSugestao: Record<string, string> = { nova: "nova", em_andamento: "em andamento", feita: "feita", descartada: "não vai acontecer" };
const tomDaSugestao: Record<string, TomDoSelo> = { nova: "bordo", em_andamento: "info", feita: "ok", descartada: "neutro" };
const tomDoAcesso: Record<Acesso["situacao"], TomDoSelo> = { convidado: "ouro", ativo: "ok", removido: "neutro" };
const vazio = { id: "", rede: "instagram" as Item["rede"], formato: "post" as Item["formato"], titulo: "", legenda: "", data_prevista: "", material: "", situacao: "ideia" as Item["situacao"], responsavel: "" };
type Formulario = typeof vazio;
/** Os dias da semana abreviados no idioma da página, de domingo a sábado (1º de fevereiro de 2026 é um domingo). */
const semana = (lang: string) => Array.from({ length: 7 }, (_, i) => new Date(2026, 1, 1 + i).toLocaleDateString(lang, { weekday: "short" }).replace(".", ""));
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
/**
 * As cores e letras do site, tiradas de app/globals.css e do layout: mudou lá, mude aqui. Estas cores são o CONTEÚDO do
 * kit (o que a equipe copia para as peças), não a cor da interface do painel.
 */
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
/** O papel e a tinta do kit, para mostrar cada peça da marca no fundo claro e no escuro (são as cores da marca, não do painel). */
const [, papelDaMarca] = cores[0];
const [, tintaDaMarca] = cores[2];
const letras: [string, string][] = [
  ["EB Garamond", "títulos e nomes (serifa)"],
  ["Inter", "texto corrido e botões"],
  ["IBM Plex Mono", "rótulos, datas e carimbos"],
];

/** O recado de uma ação (sucesso ou erro do banco), numa faixa que o leitor de tela anuncia com calma. */
const Recado = ({ texto }: { texto: string }) => <div aria-live="polite">{texto && <Faixa tom="info">{texto}</Faixa>}</div>;

type AbaDaDivulgacao = "calendario" | "caixa" | "kit" | "instagram";

/**
 * Marketing e divulgação: o quadro e o calendário do que vai para as redes, a caixa de sugestões, o kit da marca e o
 * acesso ao Instagram (com o registro de quem tem acesso). "Pronto para sair" é aprovação: só coordenação e supervisão
 * marcam. O site não guarda senha nem chave de rede social: o acesso ao perfil é dado pela coordenação na própria Meta.
 */
export function Divulgacao({ me }: { me: Me }) {
  const { lang } = useI18n();
  const coordena = can(me, "coordenacao");
  const aprova = coordena || can(me, "supervisao");
  const lista = useLista<Calendario>("divulgacao_listar");
  const equipe = useLista<Membro[]>("equipe_membros", {}, { quieta: true });
  const [aba, setAba] = useState<AbaDaDivulgacao>("calendario");
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

  /** Uma peça no quadro ou no calendário: arrasta para mudar de coluna (ou de dia), clica para abrir. */
  const cartao = (item: Item, compacto = false) => {
    const atrasado = item.situacao !== "publicado" && item.data_prevista !== null && item.data_prevista < hoje;
    return (
      <button
        type="button"
        key={item.id}
        draggable
        onDragStart={() => {
          arrastando.current = item.id;
        }}
        onDragEnd={() => {
          arrastando.current = null;
        }}
        onClick={() => abrir(item)}
        className={`pn-cartao pn-cartao-interativo block w-full text-left ${item.devolvido ? "pn-cartao-alerta" : ""}`}
        style={{ padding: compacto ? "0.35rem 0.45rem" : "0.6rem 0.7rem" }}
      >
        <span className="pn-rotulo-mono block">
          {formatos[item.formato]}
          {!compacto && ` · ${item.data_prevista ? dia(item.data_prevista) : "sem data"}`}
        </span>
        <span className={`block font-semibold leading-snug ${compacto ? "text-xs" : ""}`}>{item.titulo}</span>
        {!compacto && (
          <span className="mt-1 flex flex-wrap gap-1">
            {item.responsavel && <Selo>{item.responsavel}</Selo>}
            {item.devolvido && (
              <Selo tom="erro" ponto>
                devolvido
              </Selo>
            )}
            {atrasado && (
              <Selo tom="aviso" ponto>
                data passou
              </Selo>
            )}
            {item.aprovado_por && (item.situacao === "pronto" || item.situacao === "publicado") && <Selo tom="ok">{item.aprovado_por}</Selo>}
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
  const diasDaSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicioSemana);
    d.setDate(inicioSemana.getDate() + i);
    return isoDe(d);
  });
  const doDia = (iso: string) => visiveis.filter((i) => i.data_prevista === iso);
  const andar = (n: number) =>
    setReferencia((r) => {
      const d = new Date(r);
      if (vista === "semana") d.setDate(d.getDate() + 7 * n);
      else d.setMonth(d.getMonth() + n, 1);
      return d;
    });

  const caixaTela = (
    <Cartao titulo="O que a equipe sugere" sobre="Ideias de post, datas e pautas mandadas por qualquer pessoa da equipe pela Mesa.">
      <div className="pn-secao">
        {caixa.erro && <Faixa tom="erro">{caixa.erro}</Faixa>}
        <Recado texto={caixaAcao.aviso} />
        {caixa.dados?.length === 0 ? (
          <Vazio titulo="Nenhuma sugestão ainda. Qualquer pessoa da equipe manda ideias pela caixa “Ideia para a divulgação”, na Mesa." />
        ) : (
          <div className="grid gap-2">
            {caixa.dados?.map((s) => (
              <Cartao key={s.id} as="article" variante="plano" className={s.status === "feita" || s.status === "descartada" ? "opacity-70" : ""}>
                <p className="whitespace-pre-wrap" data-original>
                  {s.texto}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                  <Selo tom={tomDaSugestao[s.status] ?? "neutro"}>{situacaoDaSugestao[s.status] ?? s.status}</Selo>
                  {s.autor || "Alguém da equipe"} · {dataHora(s.criado_em)}
                  {s.quando ? ` · para ${dia(s.quando)}` : ""}
                </p>
                <p className="mt-2 flex flex-wrap gap-1">
                  {(["em_andamento", "feita", "descartada"] as const)
                    .filter((x) => x !== s.status)
                    .map((x) => (
                      <Botao key={x} pequeno variante="discreto" disabled={caixaAcao.ocupado} onClick={() => caixaAcao.agir("marketing_caixa_decidir", { p_id: s.id, p_status: x }, "Anotado ✓")}>
                        {x === "em_andamento" ? "Em andamento" : x === "feita" ? "Feita" : "Não vai acontecer"}
                      </Botao>
                    ))}
                  {s.status !== "feita" && (
                    <Botao
                      pequeno
                      simbolo={CalendarDays}
                      onClick={() => {
                        setForm({ ...vazio, titulo: s.texto.slice(0, 80), legenda: s.texto, data_prevista: s.quando ?? "" });
                        setAba("calendario");
                      }}
                    >
                      Pôr no calendário
                    </Botao>
                  )}
                </p>
              </Cartao>
            ))}
          </div>
        )}
      </div>
    </Cartao>
  );

  const calendarioTela = (
    <div className="pn-tela">
      <div className="pn-barra-ferramentas flex flex-wrap items-center gap-2">
        <Botao variante="principal" simbolo={Plus} onClick={() => abrir()}>
          Novo item
        </Botao>
        <span className="flex gap-1" role="group" aria-label="Visão">
          {(
            [
              ["quadro", "Quadro"],
              ["mes", "Mês"],
              ["semana", "Semana"],
            ] as const
          ).map(([id, nome]) => (
            <Botao key={id} pequeno variante={vista === id ? "padrao" : "discreto"} aria-pressed={vista === id} onClick={() => setVista(id)}>
              {nome}
            </Botao>
          ))}
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-1" role="group" aria-label="Mostrar">
          <span className="pn-rotulo-mono mr-1">Mostrar</span>
          {(["", ...ordem] as ("" | Item["situacao"])[]).map((id) => (
            <Botao key={id || "tudo"} pequeno variante={filtro === id ? "padrao" : "discreto"} aria-pressed={filtro === id} onClick={() => setFiltro(id)}>
              {id ? situacoes[id] : "Tudo"} <span className="tabular-nums">({id ? itens.filter((item) => item.situacao === id).length : itens.length})</span>
            </Botao>
          ))}
        </span>
      </div>
      {lista.erro && (
        <Faixa
          tom="erro"
          acao={
            <Botao pequeno onClick={lista.recarregar}>
              Tentar de novo
            </Botao>
          }
        >
          {lista.erro}
        </Faixa>
      )}
      <Recado texto={acao.aviso} />

      {vista === "quadro" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {ordem.map((s) => (
            <section
              key={s}
              aria-label={situacoes[s]}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const item = itens.find((i) => i.id === arrastando.current);
                if (item) mover(item, s);
              }}
              className="pn-cartao pn-cartao-plano min-h-48"
              style={{ padding: "0.6rem" }}
            >
              <h3 className="mb-2 flex items-center justify-between gap-2">
                <Selo tom={tomDaSituacao[s]} ponto>
                  {situacoes[s]}
                </Selo>
                <span className="pn-rotulo-mono tabular-nums">{itens.filter((i) => i.situacao === s).length}</span>
              </h3>
              {s === "pronto" && !aprova && <p className="pn-ajuda mb-2">Só a coordenação ou a supervisão aprovam para sair.</p>}
              <div className="space-y-2">{visiveis.filter((i) => i.situacao === s).map((i) => cartao(i))}</div>
            </section>
          ))}
        </div>
      ) : (
        <Cartao
          titulo={vista === "mes" ? new Date(ano, mesAtual, 1).toLocaleDateString(lang, { month: "long", year: "numeric" }) : `Semana de ${dia(diasDaSemana[0])} a ${dia(diasDaSemana[6])}`}
          acoes={
            <>
              <Botao icone pequeno simbolo={ChevronLeft} aria-label="Anterior" dica="Anterior" onClick={() => andar(-1)} />
              <Botao pequeno variante="discreto" onClick={() => setReferencia(new Date())}>
                Hoje
              </Botao>
              <Botao icone pequeno simbolo={ChevronRight} aria-label="Próximo" dica="Próximo" onClick={() => andar(1)} />
            </>
          }
        >
          <div className="grid grid-cols-7 gap-1 text-sm">
            {semana(lang).map((d, i) => (
              <span key={i} className="pn-rotulo-mono text-center">
                {d}
              </span>
            ))}
            {vista === "mes" && Array.from({ length: new Date(ano, mesAtual, 1).getDay() }, (_, i) => <span key={`v${i}`} />)}
            {(vista === "mes" ? diasDoMes : diasDaSemana).map((iso) => (
              <div
                key={iso}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const item = itens.find((i) => i.id === arrastando.current);
                  if (item) void acao.agir("divulgacao_salvar", { p: { ...item, responsavel: item.responsavel_id ?? "", data_prevista: iso } }, `Remarcado para ${dia(iso)}.`);
                }}
                aria-current={iso === hoje ? "date" : undefined}
                className={`rounded-md border p-1 ${vista === "semana" ? "min-h-64" : "min-h-24"} ${iso === hoje ? "border-oxblood" : "border-rule"} bg-parchment-deep`}
              >
                <span className={`block text-right font-mono text-[0.7rem] tabular-nums ${iso === hoje ? "font-bold text-oxblood" : "text-ink-soft"}`}>{Number(iso.slice(8))}</span>
                <div className="space-y-1">{doDia(iso).map((i) => cartao(i, true))}</div>
              </div>
            ))}
          </div>
          {visiveis.some((i) => !i.data_prevista) && (
            <div className="mt-3">
              <p className="pn-rotulo-mono">Sem data</p>
              <div className="mt-1 grid gap-2 sm:grid-cols-3">{visiveis.filter((i) => !i.data_prevista).map((i) => cartao(i))}</div>
            </div>
          )}
          <p className="pn-ajuda mt-2">Arraste uma peça para outro dia para remarcar.</p>
        </Cartao>
      )}
      {lista.dados && itens.length === 0 && (
        <Vazio
          simbolo={CalendarDays}
          titulo="O calendário está vazio."
          acao={
            <Botao simbolo={Plus} onClick={() => abrir()}>
              Criar a primeira peça
            </Botao>
          }
        />
      )}
    </div>
  );

  return (
    <>
      <Abas<AbaDaDivulgacao>
        rotulo="Divulgação"
        valor={aba}
        aoMudar={setAba}
        opcoes={[
          { id: "calendario", nome: "Quadro e calendário", conta: itens.filter((item) => item.devolvido).length },
          { id: "caixa", nome: "Caixa de sugestões", conta: caixa.dados?.filter((s) => s.status === "nova").length },
          { id: "kit", nome: "Kit da marca" },
          { id: "instagram", nome: "Acesso ao Instagram" },
        ]}
        painel={(id) =>
          id === "caixa" ? caixaTela : id === "calendario" ? calendarioTela : id === "kit" ? <KitDaMarca /> : <Instagram coordena={coordena} aprova={aprova} perfilAtual={lista.dados?.instagram ?? ""} recarregar={lista.recarregar} equipe={equipe.dados ?? []} />
        }
      />
      {form && <PainelDoItem form={form} setForm={setForm} item={itens.find((i) => i.id === form.id) ?? null} equipe={equipe.dados ?? []} aprova={aprova} coordena={coordena} recarregar={lista.recarregar} fechar={() => setForm(null)} />}
    </>
  );
}

/** O formulário do item, numa janela (Dialogo: foco preso, Esc fecha): os campos, a prévia do post e as ações. */
function PainelDoItem({ form, setForm, item, equipe, aprova, coordena, recarregar, fechar }: { form: Formulario; setForm: (f: Formulario) => void; item: Item | null; equipe: Membro[]; aprova: boolean; coordena: boolean; recarregar: () => void; fechar: () => void }) {
  const acao = useAcao(recarregar);
  const router = useRouter();
  const [nota, setNota] = useState(item?.nota ?? "");
  const imagem = /^\/arquivos\/[a-f0-9]{20}\.(webp|jpg)$/.test(form.material) ? form.material : "";

  async function guardar() {
    const r = (await acao.agir("divulgacao_salvar", { p: form }, form.id ? "Salvo ✓" : "Peça criada ✓")) as { id?: string; situacao?: string } | null;
    if (r?.id) {
      if (form.situacao === "pronto" && r.situacao === "rascunho") acao.setAviso("Salvo. Como o texto mudou depois da aprovação, a peça voltou para rascunho e precisa ser aprovada de novo.");
      setForm({ ...form, id: r.id, situacao: (r.situacao as Item["situacao"]) ?? form.situacao });
    }
  }

  return (
    <Dialogo aberto largo aoMudar={(aberto) => !aberto && fechar()} titulo={form.id ? "Corrigir peça" : "Nova peça"}>
      <div className="max-h-[75vh] overflow-y-auto">
        <div className="grid gap-5 lg:grid-cols-[1fr_15rem]">
          <div className="pn-secao" style={{ alignContent: "start" }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Selecao rotulo="Rede" value={form.rede} onChange={(e) => setForm({ ...form, rede: e.target.value as Item["rede"] })}>
                <option value="instagram">Instagram</option>
                <option value="outra">Outra rede</option>
              </Selecao>
              <Selecao rotulo="Formato" value={form.formato} onChange={(e) => setForm({ ...form, formato: e.target.value as Item["formato"] })}>
                {(Object.keys(formatos) as Item["formato"][]).map((id) => (
                  <option key={id} value={id}>
                    {formatos[id]}
                  </option>
                ))}
              </Selecao>
              <CampoData rotulo="Data prevista" valor={form.data_prevista} mudar={(v) => setForm({ ...form, data_prevista: v })} />
              <Selecao rotulo="Situação" value={form.situacao} onChange={(e) => setForm({ ...form, situacao: e.target.value as Item["situacao"] })}>
                {ordem.map((id) => (
                  <option key={id} value={id} disabled={id === "pronto" && !aprova && item?.situacao !== "pronto"}>
                    {situacoes[id]}
                    {id === "pronto" && !aprova ? " (aprovação)" : ""}
                  </option>
                ))}
              </Selecao>
              <div className="sm:col-span-2">
                <Selecao rotulo="Responsável" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })}>
                  <option value="">Ninguém ainda</option>
                  {equipe.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </Selecao>
              </div>
            </div>
            <Campo rotulo="Título (para a equipe se achar)" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} maxLength={120} />
            <div>
              <Area rotulo="Legenda" value={form.legenda} onChange={(e) => setForm({ ...form, legenda: e.target.value })} maxLength={2200} rows={6} />
              <p className={`text-right font-mono text-xs tabular-nums ${form.legenda.length > 2100 ? "text-oxblood" : "text-ink-soft"}`}>{form.legenda.length}/2200</p>
            </div>
            <Campo rotulo="Material" ajuda="Imagem nova? Envie em Materiais e arquivos: aprovada, ela ganha um endereço /arquivos/… que serve aqui." value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} maxLength={500} placeholder="https://… (pasta de trabalho) ou /arquivos/… (já publicado)" />
            {item?.aprovado_por && (
              <Faixa tom="ok">
                Aprovado por {item.aprovado_por}
                {item.aprovado_em ? ` em ${dataHora(item.aprovado_em)}` : ""}.
              </Faixa>
            )}
            {item && (
              <p className="pn-ajuda">
                Criado por {item.criado_por || "alguém que saiu da equipe"} · mexido por último por {item.mexido_por || "alguém que saiu da equipe"} em {dataHora(item.mexido_em)}
              </p>
            )}
            <p className="flex flex-wrap gap-2">
              <Botao variante="principal" disabled={form.titulo.trim().length < 3} carregando={acao.ocupado} onClick={() => void guardar()}>
                {form.id ? "Guardar" : "Criar a peça"}
              </Botao>
              <Botao
                onClick={() => {
                  try {
                    window.sessionStorage.setItem("lucia:estudio-pedido", JSON.stringify({ titulo: form.titulo, legenda: form.legenda, formato: form.formato }));
                  } catch {
                    /* sem armazenamento */
                  }
                  router.push("/pt/painel?aba=estudio");
                }}
              >
                Criar arte no Estúdio de design
              </Botao>
              {form.id && (
                <Botao
                  variante="discreto"
                  perigo
                  simbolo={Trash2}
                  disabled={acao.ocupado}
                  onClick={async () => {
                    if ((await confirmarFrase(`Apagar “${form.titulo}” do calendário? Não tem volta.`)) && (await acao.agir("divulgacao_apagar", { p_id: form.id }, "Apagado."))) fechar();
                  }}
                >
                  Apagar
                </Botao>
              )}
            </p>
            <Recado texto={acao.aviso} />
            {item?.nota && (
              <Faixa tom={item.devolvido ? "aviso" : "info"} titulo={item.devolvido ? "Devolvido pela coordenação:" : "Nota da coordenação:"}>
                {item.nota}
              </Faixa>
            )}
            {coordena && item && (
              <div className="pn-secao border-t border-rule pt-3">
                <Campo rotulo="Nota da coordenação" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={1000} />
                <p className="flex flex-wrap gap-2">
                  <Botao disabled={acao.ocupado} onClick={() => acao.agir("divulgacao_comentar", { p_id: item.id, p_nota: nota, p_devolver: false }, "Nota guardada ✓")}>
                    Guardar a nota
                  </Botao>
                  {item.situacao !== "rascunho" && item.situacao !== "ideia" && (
                    <Botao
                      disabled={acao.ocupado || nota.trim().length < 5}
                      onClick={async () => {
                        if (await confirmarFrase("Devolver para rascunho? Quem criou e quem mexeu por último recebem a nota.")) void acao.agir("divulgacao_comentar", { p_id: item.id, p_nota: nota, p_devolver: true }, "Devolvido para rascunho.");
                      }}
                    >
                      Devolver para rascunho
                    </Botao>
                  )}
                </p>
              </div>
            )}
          </div>
          <div>
            <p className="pn-rotulo-mono">Prévia</p>
            <div className="pn-cartao mt-1 overflow-hidden" style={{ padding: 0 }}>
              <div className="flex items-center gap-2 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/marca-recorte-512.png" alt="" className="h-7 w-7 rounded-full border border-rule" />
                <span className="text-xs font-semibold">institutolucia</span>
              </div>
              <div className={`flex items-center justify-center bg-parchment-deep ${form.formato === "story" || form.formato === "reels" ? "aspect-[9/16]" : "aspect-[4/5]"}`}>
                {imagem ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagem} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="px-4 text-center font-serif text-lg text-ink-soft">{form.titulo || "A arte aparece aqui"}</span>
                )}
              </div>
              <p className="whitespace-pre-line p-2 text-xs leading-relaxed" data-original={form.legenda ? "" : undefined}>
                <strong>institutolucia</strong> {form.legenda.length > 160 ? `${form.legenda.slice(0, 160)}… mais` : form.legenda || <span className="text-ink-soft">legenda</span>}
              </p>
            </div>
            <p className="pn-ajuda mt-1">Aproximação do que aparece no Instagram. A arte precisa estar publicada em /arquivos para aparecer aqui.</p>
          </div>
        </div>
      </div>
      <div className="pn-dialogo-acoes">
        <Botao variante="discreto" simbolo={X} onClick={fechar}>
          Fechar
        </Botao>
      </div>
    </Dialogo>
  );
}

function KitDaMarca() {
  const [copiado, setCopiado] = useState("");
  return (
    <div className="pn-tela">
      <Cartao titulo="Arquivos da marca" sobre="Use estes, sem redesenhar a marca. Todos em PNG com fundo transparente; a prévia mostra cada um no fundo claro e no escuro." rodape={<span className="pn-ajuda">Ainda não há versão em SVG da marca: quando o design fizer, ela entra aqui.</span>}>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pecas.map((p) => (
            <li key={p.nome} className="pn-cartao pn-cartao-plano" style={{ padding: "0.75rem" }}>
              <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.arquivos[0][0]} alt={`${p.nome} no fundo claro`} loading="lazy" className="h-24 w-full object-contain p-2" style={{ background: papelDaMarca }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.arquivos[0][0]} alt={`${p.nome} no fundo escuro`} loading="lazy" className="h-24 w-full object-contain p-2" style={{ background: tintaDaMarca }} />
              </div>
              <p className="mt-2 font-semibold">{p.nome}</p>
              <p className="text-sm text-ink-soft">{p.uso}</p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-sm">
                {p.arquivos.map(([caminho, formato]) => (
                  <a key={caminho} href={caminho} download className="pn-elo inline-flex items-center gap-1">
                    <Download aria-hidden className="h-3.5 w-3.5" />
                    {formato}
                  </a>
                ))}
              </p>
            </li>
          ))}
        </ul>
      </Cartao>
      <Cartao titulo="Cores">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cores.map(([nome, hex, uso]) => (
            <li key={hex} className="flex items-center gap-3">
              <span aria-hidden className="h-12 w-12 shrink-0 rounded-md border border-rule" style={{ background: hex }} />
              <span className="min-w-0">
                <span className="block font-semibold">{nome}</span>
                <span className="block text-xs text-ink-soft">{uso}</span>
                <Botao
                  pequeno
                  variante="discreto"
                  className="mt-1 font-mono"
                  onClick={() =>
                    void navigator.clipboard?.writeText(hex).then(() => {
                      setCopiado(hex);
                      window.setTimeout(() => setCopiado(""), 1500);
                    })
                  }
                >
                  {copiado === hex ? "Copiado ✓" : `${hex} · copiar`}
                </Botao>
              </span>
            </li>
          ))}
        </ul>
      </Cartao>
      <Cartao titulo="Letras">
        <Lista rotulo="Letras" plana>
          {letras.map(([nome, uso]) => (
            <ItemDeLista key={nome} titulo={<strong>{nome}</strong>} meta={`${uso} · livre (SIL Open Font License), no Google Fonts`} />
          ))}
        </Lista>
      </Cartao>
      <Cartao titulo="Regras de uso">
        <div className="grid gap-4 md:grid-cols-2">
          <Cartao as="div" variante="plano" titulo="Espaço e tamanho" nivelDoTitulo={3}>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>
                <strong>Área de respeito:</strong> em volta da marca, deixe livre pelo menos a altura da estrela. Nada de texto ou imagem encostando.
              </li>
              <li>
                <strong>Tamanho mínimo:</strong> marca completa com 120 px de largura na tela (3 cm no papel); abaixo disso, use o emblema (mínimo 32 px, 1 cm).
              </li>
              <li>
                <strong>Fundo:</strong> pergaminho, papel, preto ou vermelho de prelo. Em foto, só sobre área calma ou com faixa por baixo.
              </li>
            </ul>
          </Cartao>
          <Cartao as="div" variante="plano" titulo="O que não fazer" nivelDoTitulo={3}>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Esticar, girar, recolorir ou pôr sombra e contorno na marca.</li>
              <li>Trocar as letras do nome ou redesenhar a estrela.</li>
              <li>Usar a marca em peça de partido ou de candidatura.</li>
              <li>Colocar a marca sobre imagem de terceiros sem licença.</li>
            </ul>
          </Cartao>
          <div className="md:col-span-2">
            <Cartao as="div" variante="plano" titulo="Tom das peças" nivelDoTitulo={3}>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>O desenho dos cartazes do site: faixa vermelha ou preta, letra pesada, a estrela.</li>
                <li>Frase curta e direta; convite, nunca ordem.</li>
                <li>Toda informação com fonte; número sempre com de onde veio.</li>
                <li>Imagem só nossa, em domínio público ou com licença livre, com o crédito.</li>
                <li>Acessível: texto alternativo no post, legenda nos vídeos, contraste forte.</li>
              </ul>
            </Cartao>
          </div>
        </div>
      </Cartao>
    </div>
  );
}

function Instagram({ coordena, aprova, perfilAtual, recarregar, equipe }: { coordena: boolean; aprova: boolean; perfilAtual: string; recarregar: () => void; equipe: Membro[] }) {
  const acao = useAcao(recarregar);
  const [perfil, setPerfil] = useState<string | null>(null);
  const perfilValido = (v: string) => v === "" || /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]{1,30}\/?$/.test(v);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Cartao titulo="Como dar e tirar o acesso">
        <div className="pn-secao">
          <Faixa tom="bordo">
            <strong>O site nunca guarda senha de rede social.</strong> Não mande senha do perfil por aqui, no mural nem por mensagem.
          </Faixa>
          <div>
            <h3 className="pn-rotulo-mono">A coordenação convida</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              <li>No Instagram do instituto, abra Configurações → Central de Contas (ou o Meta Business Suite).</li>
              <li>Entre em Pessoas (ou Colaboradores) → Adicionar pessoa.</li>
              <li>Procure a conta pessoal da voluntária ou do voluntário e marque só o necessário: publicar posts, stories e reels; responder mensagens só se for a função.</li>
              <li>Envie o convite e registre aqui embaixo (nome, conta, permissões, data).</li>
            </ol>
          </div>
          <div>
            <h3 className="pn-rotulo-mono">Quem recebe aceita</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              <li>Abra o Instagram ou o e-mail da Meta na sua conta pessoal: chega “Convite para acessar Instituto Lúcia”.</li>
              <li>Toque em Aceitar. O perfil do instituto aparece para alternar no seu aplicativo.</li>
              <li>Ligue a autenticação em dois fatores na sua conta pessoal: a Meta pede para quem administra páginas.</li>
            </ol>
          </div>
          <div>
            <h3 className="pn-rotulo-mono">Quando alguém sai da equipe</h3>
            <p className="mt-1 text-sm">A coordenação tira o acesso na mesma tela (Pessoas → a pessoa → Remover) e marca “removido” no registro. O painel avisa a coordenação quando alguém com acesso perde a última função.</p>
          </div>
          <div className="pn-secao border-t border-rule pt-3">
            {perfilAtual ? (
              <p>
                Perfil do instituto:{" "}
                <a href={perfilAtual} target="_blank" rel="noopener noreferrer" className="pn-elo">
                  {perfilAtual}
                </a>
              </p>
            ) : (
              <p className="text-ink-soft">A coordenação ainda não indicou o endereço público do perfil.</p>
            )}
            {coordena && (
              <>
                <Campo
                  rotulo="Endereço público do perfil (só o endereço, nada de senha)"
                  value={perfil ?? perfilAtual}
                  onChange={(e) => setPerfil(e.target.value)}
                  maxLength={80}
                  placeholder="https://www.instagram.com/…"
                  erro={perfil !== null && !perfilValido(perfil.trim()) ? "Use o endereço completo: https://www.instagram.com/nome_do_perfil" : undefined}
                />
                <div>
                  <Botao
                    disabled={acao.ocupado || perfil === null || !perfilValido(perfil.trim())}
                    onClick={async () => {
                      if (await acao.agir("divulgacao_instagram_salvar", { p_url: (perfil ?? "").trim() }, "Endereço guardado ✓")) setPerfil(null);
                    }}
                  >
                    Guardar
                  </Botao>
                </div>
                <Recado texto={acao.aviso} />
              </>
            )}
          </div>
        </div>
      </Cartao>

      {aprova ? (
        <RegistroDoInstagram coordena={coordena} equipe={equipe} />
      ) : (
        <Cartao>
          <p className="text-sm text-ink-soft">O registro de quem tem acesso fica com a coordenação e a supervisão.</p>
        </Cartao>
      )}
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
    <Cartao titulo="Quem tem acesso" sobre="O registro de convites e acessos (a Meta não conta para o site). Serve para lembrar de tirar o acesso de quem saiu.">
      <div className="pn-secao">
        {acessos.length === 0 ? (
          <Vazio titulo="Nenhum acesso registrado." />
        ) : (
          <Lista rotulo="Quem tem acesso" plana>
            {acessos.map((a) => (
              <ItemDeLista
                key={a.id}
                titulo={
                  <span className="flex flex-wrap items-center gap-2">
                    <strong>{a.nome}</strong>
                    {a.conta && <span className="font-mono text-xs">{a.conta.startsWith("@") ? a.conta : `@${a.conta}`}</span>}
                    <Selo tom={tomDoAcesso[a.situacao]}>{a.situacao}</Selo>
                    {a.situacao !== "removido" && !a.na_equipe && (
                      <Selo tom="erro" ponto>
                        saiu da equipe: tirar o acesso
                      </Selo>
                    )}
                  </span>
                }
                meta={`${a.permissoes} · convidado em ${dia(a.convidado_em)}${a.removido_em ? ` · removido em ${dia(a.removido_em)}` : ""}${a.nota ? ` · ${a.nota}` : ""}`}
                acoes={
                  coordena && (
                    <Botao pequeno variante="discreto" onClick={() => setForm({ id: a.id, pessoa: a.pessoa ?? "", nome: a.nome, conta: a.conta, permissoes: a.permissoes, situacao: a.situacao, convidado_em: a.convidado_em, removido_em: a.removido_em ?? "", nota: a.nota })}>
                      Corrigir
                    </Botao>
                  )
                }
              />
            ))}
          </Lista>
        )}
        {coordena && (
          <div className="pn-secao border-t border-rule pt-3">
            <h3 className="pn-rotulo-mono">{form.id ? "Corrigir registro" : "Registrar convite ou acesso"}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <Selecao
                rotulo="Pessoa da equipe"
                value={form.pessoa}
                onChange={(e) => {
                  const m = equipe.find((x) => x.id === e.target.value);
                  setForm({ ...form, pessoa: e.target.value, nome: form.nome || m?.nome || "" });
                }}
              >
                <option value="">De fora do painel</option>
                {equipe.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </Selecao>
              <Campo rotulo="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={120} />
              <Campo rotulo="Conta pessoal no Instagram" value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value.trim() })} maxLength={31} placeholder="@conta" className="font-mono" />
              <Selecao rotulo="Situação" value={form.situacao} onChange={(e) => setForm({ ...form, situacao: e.target.value as Acesso["situacao"] })}>
                <option value="convidado">Convidado</option>
                <option value="ativo">Ativo</option>
                <option value="removido">Removido</option>
              </Selecao>
              <CampoData rotulo="Convidado em" valor={form.convidado_em} mudar={(v) => setForm({ ...form, convidado_em: v })} className="text-sm" />
              {form.situacao === "removido" && <CampoData rotulo="Removido em" valor={form.removido_em} mudar={(v) => setForm({ ...form, removido_em: v })} className="text-sm" />}
              <div className="sm:col-span-2">
                <Campo rotulo="Permissões dadas" value={form.permissoes} onChange={(e) => setForm({ ...form, permissoes: e.target.value })} maxLength={300} />
              </div>
              <div className="sm:col-span-2">
                <Campo rotulo="Nota" value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} maxLength={500} />
              </div>
            </div>
            <p className="flex gap-2">
              <Botao
                disabled={acaoRegistro.ocupado || form.nome.trim().length < 2}
                onClick={async () => {
                  if (await acaoRegistro.agir("instagram_acesso_salvar", { p: form }, "Registro guardado ✓")) setForm(novo);
                }}
              >
                Guardar
              </Botao>
              {form.id && (
                <Botao variante="discreto" onClick={() => setForm(novo)}>
                  Cancelar
                </Botao>
              )}
            </p>
            <Recado texto={acaoRegistro.aviso || registro.erro} />
          </div>
        )}
      </div>
    </Cartao>
  );
}
