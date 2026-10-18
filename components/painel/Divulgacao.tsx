// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { can, type Me } from "@/lib/backend";
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
}

interface Calendario {
  instagram: string;
  itens: Item[];
}

const formatos: Record<Item["formato"], string> = { post: "Post", carrossel: "Carrossel", story: "Story", reels: "Reels", video: "Vídeo", outro: "Outro" };
const situacoes: Record<Item["situacao"], string> = { ideia: "Ideia", rascunho: "Rascunho", pronto: "Pronto para sair", publicado: "Publicado" };
const ordem: Item["situacao"][] = ["ideia", "rascunho", "pronto", "publicado"];

const vazio = { id: "", rede: "instagram" as Item["rede"], formato: "post" as Item["formato"], titulo: "", legenda: "", data_prevista: "", material: "", situacao: "ideia" as Item["situacao"] };

/** As peças da marca que já moram no site, para baixar e usar nos posts. */
const arquivos: [string, string][] = [
  ["/marca.png", "Marca completa"],
  ["/marca-512.png", "Marca, 512 px"],
  ["/marca-recorte-512.png", "Marca recortada, 512 px (para foto de perfil)"],
  ["/emblema.png", "Emblema"],
  ["/icone-512.png", "Ícone do aplicativo"],
  ["/cartao.png", "Cartão de compartilhamento"],
  ["/cartao-lucia.png", "Cartão com o retrato de Lúcia"],
  ["/lucia.png", "Retrato de Lúcia"],
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

interface Sugestao {
  id: string;
  autor: string;
  texto: string;
  quando: string | null;
  status: "nova" | "em_andamento" | "feita" | "descartada";
  criado_em: string;
}
const situacaoDaSugestao: Record<string, string> = { nova: "nova", em_andamento: "em andamento", feita: "feita", descartada: "não vai acontecer" };

/**
 * Marketing e divulgação: o calendário do que vai para as redes do instituto, o kit da marca e o acesso ao Instagram.
 * O site não guarda senha nem chave de rede social: o acesso ao perfil é dado pela coordenação na própria Meta.
 */
export function Divulgacao({ me }: { me: Me }) {
  const coordena = can(me, "coordenacao");
  const lista = useLista<Calendario>("divulgacao_listar");
  const [aba, setAba] = useState<"calendario" | "caixa" | "kit" | "instagram">("calendario");
  const caixa = useLista<Sugestao[]>("marketing_caixa");
  const caixaAcao = useAcao(caixa.recarregar);
  const [form, setForm] = useState(vazio);
  const [filtro, setFiltro] = useState<"" | Item["situacao"]>("");
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [perfil, setPerfil] = useState<string | null>(null);
  const acao = useAcao(lista.recarregar);
  const itens = lista.dados?.itens ?? [];
  const visiveis = itens.filter((item) => !filtro || item.situacao === filtro);
  const hoje = new Date().toISOString().slice(0, 10);

  async function guardar() {
    if (await acao.agir("divulgacao_salvar", { p: form }, form.id ? "Item corrigido." : "Item acrescentado ao calendário.")) setForm(vazio);
  }

  return (
    <div>
      <Abas
        atual={aba}
        escolher={setAba}
        opcoes={[
          { id: "calendario" as const, nome: "Calendário", conta: itens.filter((item) => item.devolvido).length },
          { id: "caixa" as const, nome: "Caixa de sugestões", conta: caixa.dados?.filter((s) => s.status === "nova").length },
          { id: "kit" as const, nome: "Kit da marca" },
          { id: "instagram" as const, nome: "Acesso ao Instagram" },
        ]}
      />

      <div hidden={aba !== "caixa"}>
        <section className="border border-rule bg-parchment-deep p-5">
          <h2 className="font-serif text-xl font-semibold">O que a equipe sugere</h2>
          <p className="mt-1 text-ink-soft">Ideias de post, datas e pautas mandadas por qualquer pessoa da equipe pela Mesa. Marque o que entrou no calendário e o que não vai acontecer.</p>
          <Aviso texto={caixa.erro || caixaAcao.aviso} />
          <ul className="mt-3 space-y-2">
            {caixa.dados?.map((s) => (
              <li key={s.id} className={`border border-rule bg-parchment p-3 ${s.status === "feita" || s.status === "descartada" ? "opacity-70" : ""}`}>
                <p className="whitespace-pre-wrap">{s.texto}</p>
                <p className="mt-1 text-xs text-ink-soft">{s.autor || "Alguém da equipe"} · {dataHora(s.criado_em)}{s.quando ? ` · para ${dia(s.quando)}` : ""} · {situacaoDaSugestao[s.status] ?? s.status}</p>
                <p className="mt-2 flex flex-wrap gap-2">
                  {(["em_andamento", "feita", "descartada"] as const).filter((x) => x !== s.status).map((x) => (
                    <button key={x} type="button" className={elo} disabled={caixaAcao.ocupado} onClick={() => caixaAcao.agir("marketing_caixa_decidir", { p_id: s.id, p_status: x }, "Anotado.")}>
                      {x === "em_andamento" ? "Em andamento" : x === "feita" ? "Feita" : "Não vai acontecer"}
                    </button>
                  ))}
                  {s.status !== "nova" && s.quando && s.status !== "feita" && (
                    <button type="button" className={elo} onClick={() => { setForm({ ...vazio, titulo: s.texto.slice(0, 80), legenda: s.texto, data_prevista: s.quando ?? "" }); setAba("calendario"); }}>Pôr no calendário</button>
                  )}
                </p>
              </li>
            ))}
            {caixa.dados?.length === 0 && <li className="text-ink-soft">Nenhuma sugestão ainda.</li>}
          </ul>
        </section>
      </div>

      <div hidden={aba !== "calendario"}>
        <section className="border border-rule bg-parchment-deep p-5">
          <h2 className="font-serif text-xl font-semibold">{form.id ? "Corrigir item" : "Novo item no calendário"}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              Rede
              <select value={form.rede} onChange={(e) => setForm({ ...form, rede: e.target.value as Item["rede"] })} className={campo}>
                <option value="instagram">Instagram</option>
                <option value="outra">Outra rede</option>
              </select>
            </label>
            <label className="block">
              Formato
              <select value={form.formato} onChange={(e) => setForm({ ...form, formato: e.target.value as Item["formato"] })} className={campo}>
                {(Object.keys(formatos) as Item["formato"][]).map((id) => (
                  <option key={id} value={id}>{formatos[id]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              Data prevista
              <input type="date" value={form.data_prevista} onChange={(e) => setForm({ ...form, data_prevista: e.target.value })} className={campo} />
            </label>
            <label className="block">
              Situação
              <select value={form.situacao} onChange={(e) => setForm({ ...form, situacao: e.target.value as Item["situacao"] })} className={campo}>
                {ordem.map((id) => (
                  <option key={id} value={id}>{situacoes[id]}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-3 block">
            Título (para a equipe se achar)
            <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} maxLength={120} className={campo} />
          </label>
          <label className="mt-3 block">
            Legenda
            <textarea value={form.legenda} onChange={(e) => setForm({ ...form, legenda: e.target.value })} maxLength={2200} rows={4} className={campo} />
          </label>
          <p className="text-right font-mono text-xs text-ink-soft">{form.legenda.length}/2200</p>
          <label className="mt-1 block">
            Material: link https da pasta de trabalho ou um arquivo já publicado no site (/arquivos/…)
            <input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} maxLength={500} placeholder="https://… ou /arquivos/…" className={campo} />
          </label>
          <p className="mt-3 flex flex-wrap gap-3">
            <button type="button" className={botao} disabled={acao.ocupado || form.titulo.trim().length < 3} onClick={() => void guardar()}>
              {form.id ? "Guardar a correção" : "Acrescentar"}
            </button>
            {form.id && <button type="button" className={botaoClaro} onClick={() => setForm(vazio)}>Cancelar</button>}
          </p>
          <p className="mt-2 text-ink-soft">Imagem nova para o post? Envie em Materiais e arquivos: depois de aprovada pela coordenação, ela ganha um endereço /arquivos/… que serve aqui.</p>
        </section>

        <Aviso texto={lista.erro || acao.aviso} />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className={rotulo}>Mostrar</span>
          {(["", ...ordem] as ("" | Item["situacao"])[]).map((id) => (
            <button key={id || "tudo"} type="button" onClick={() => setFiltro(id)} aria-pressed={filtro === id} className={`cursor-pointer border px-3 py-1 ${filtro === id ? "border-ink bg-ink text-parchment" : "border-rule bg-parchment-deep hover:border-ink"}`}>
              {id ? situacoes[id] : "Tudo"} ({id ? itens.filter((item) => item.situacao === id).length : itens.length})
            </button>
          ))}
        </div>

        <ul className="mt-4 space-y-3">
          {visiveis.map((item) => {
            const atrasado = item.situacao !== "publicado" && item.data_prevista !== null && item.data_prevista < hoje;
            return (
              <li key={item.id} className={`border bg-parchment-deep p-4 ${item.devolvido ? "border-2 border-oxblood" : "border-rule"}`}>
                <p className={rotulo}>
                  {item.rede === "instagram" ? "Instagram" : "Outra rede"} · {formatos[item.formato]} · {item.data_prevista ? dia(item.data_prevista) : "sem data"} · {situacoes[item.situacao]}
                  {atrasado && <span className="text-oxblood"> · data já passou</span>}
                </p>
                <p className="mt-1 font-serif text-xl font-semibold">{item.titulo}</p>
                {item.legenda && <p className="mt-1 whitespace-pre-line">{item.legenda}</p>}
                {item.material && (
                  <p className="mt-1">
                    <a href={item.material} target="_blank" rel="noopener noreferrer" className={elo}>Abrir o material</a>
                  </p>
                )}
                {item.nota && (
                  <p className="mt-2 border-l-2 border-oxblood pl-3">
                    <strong>{item.devolvido ? "Devolvido pela coordenação:" : "Nota da coordenação:"}</strong> {item.nota}
                  </p>
                )}
                <p className="mt-1 text-xs text-ink-soft">
                  Criado por {item.criado_por || "alguém que saiu da equipe"} · mexido por último por {item.mexido_por || "alguém que saiu da equipe"} em {dataHora(item.mexido_em)}
                </p>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {ordem
                    .filter((id) => id !== item.situacao)
                    .map((id) => (
                      <button key={id} type="button" className={elo} disabled={acao.ocupado} onClick={() => acao.agir("divulgacao_situacao", { p_id: item.id, p_situacao: id }, `Agora: ${situacoes[id].toLowerCase()}.`)}>
                        Marcar: {situacoes[id].toLowerCase()}
                      </button>
                    ))}
                  <button type="button" className={elo} onClick={() => { setForm({ ...vazio, ...item, data_prevista: item.data_prevista ?? "" }); window.scrollTo(0, 0); }}>
                    Corrigir
                  </button>
                  <button type="button" className={`${elo} text-oxblood`} disabled={acao.ocupado} onClick={() => { if (window.confirm(`Apagar "${item.titulo}" do calendário?`)) void acao.agir("divulgacao_apagar", { p_id: item.id }, "Item apagado."); }}>
                    Apagar
                  </button>
                </p>
                {coordena && (
                  <div className="mt-3 border-t border-rule pt-3">
                    <label className="block">
                      Nota da coordenação
                      <input value={notas[item.id] ?? item.nota} onChange={(e) => setNotas({ ...notas, [item.id]: e.target.value })} maxLength={1000} className={campo} />
                    </label>
                    <p className="mt-2 flex flex-wrap gap-3">
                      <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => acao.agir("divulgacao_comentar", { p_id: item.id, p_nota: notas[item.id] ?? item.nota, p_devolver: false }, "Nota guardada.")}>
                        Guardar a nota
                      </button>
                      {item.situacao !== "rascunho" && item.situacao !== "ideia" && (
                        <button type="button" className={botaoClaro} disabled={acao.ocupado || (notas[item.id] ?? item.nota).trim().length < 5} onClick={() => acao.agir("divulgacao_comentar", { p_id: item.id, p_nota: notas[item.id] ?? item.nota, p_devolver: true }, "Devolvido para rascunho.")}>
                          Devolver para rascunho
                        </button>
                      )}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {lista.dados && visiveis.length === 0 && <p className="mt-3 border border-rule bg-parchment-deep px-4 py-5 text-ink-soft">Nada aqui ainda.</p>}
      </div>

      <div hidden={aba !== "kit"} className="space-y-8">
        <section>
          <h2 className="font-serif text-2xl font-semibold">Arquivos da marca</h2>
          <p className="mt-1 text-ink-soft">Use estes, sem redesenhar a marca. Para outras peças, peça ajuda no Mural da equipe.</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {arquivos.map(([caminho, nome]) => (
              <li key={caminho} className="border border-rule bg-parchment-deep p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={caminho} alt="" loading="lazy" className="h-28 w-full object-contain" />
                <p className="mt-2">{nome}</p>
                <a href={caminho} download className={elo}>Baixar</a>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="font-serif text-2xl font-semibold">Cores</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cores.map(([nome, hex, uso]) => (
              <li key={hex} className="flex items-center gap-3 border border-rule bg-parchment-deep p-3">
                <span aria-hidden className="h-12 w-12 shrink-0 border border-rule" style={{ background: hex }} />
                <span>
                  <span className="block font-semibold">{nome}</span>
                  <button type="button" className={`${elo} font-mono text-xs`} onClick={() => void navigator.clipboard?.writeText(hex)} title="Copiar o código">{hex}</button>
                  <span className="block text-xs text-ink-soft">{uso}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="font-serif text-2xl font-semibold">Letras</h2>
          <ul className="mt-3 space-y-2">
            {letras.map(([nome, uso]) => (
              <li key={nome}>
                <strong>{nome}</strong> <span className="text-ink-soft">· {uso} · livre (SIL Open Font License), no Google Fonts</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-ink-soft">Tom das peças: o desenho dos cartazes do site (faixa vermelha ou preta, letra pesada, a estrela). Toda informação com fonte; imagem só nossa, em domínio público ou com licença livre, com o crédito.</p>
        </section>
      </div>

      <div hidden={aba !== "instagram"} className="max-w-3xl space-y-4">
        <h2 className="font-serif text-2xl font-semibold">Acesso ao Instagram</h2>
        <p>
          O acesso ao perfil do instituto é dado pela coordenação, pelo próprio Instagram: na Central de Contas da Meta (ou em Configurações → Colaboradores do perfil), a coordenação convida a sua conta pessoal como
          colaboradora, com as permissões de publicar posts e stories. Você aceita o convite na sua própria conta.
        </p>
        <p className="border-l-2 border-oxblood pl-4">
          <strong>O site nunca guarda senha de rede social.</strong> Não mande senha do perfil por aqui, no mural nem por mensagem. Quando alguém sai da equipe, a coordenação tira o acesso na própria Meta.
        </p>
        {lista.dados?.instagram ? (
          <p>
            Perfil do instituto:{" "}
            <a href={lista.dados.instagram} target="_blank" rel="noopener noreferrer" className={elo}>
              {lista.dados.instagram}
            </a>
          </p>
        ) : (
          <p className="text-ink-soft">A coordenação ainda não indicou o endereço público do perfil.</p>
        )}
        {coordena && (
          <div className="border border-rule bg-parchment-deep p-4">
            <label className="block">
              Endereço público do perfil (só o endereço, nada de senha)
              <input value={perfil ?? lista.dados?.instagram ?? ""} onChange={(e) => setPerfil(e.target.value)} maxLength={80} placeholder="https://www.instagram.com/…" className={campo} />
            </label>
            <button type="button" className={`mt-3 ${botaoClaro}`} disabled={acao.ocupado || perfil === null} onClick={async () => { if (await acao.agir("divulgacao_instagram_salvar", { p_url: (perfil ?? "").trim() }, "Endereço guardado.")) setPerfil(null); }}>
              Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
