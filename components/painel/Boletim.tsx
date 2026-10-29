// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { rpc } from "@/lib/backend";
import { site } from "@/lib/site";
import { boletim as desenhoDoBoletim, textoDosBlocos } from "@/supabase/functions/_shared/emails.mjs";
import { Abas, Aviso, botao, botaoClaro, campo, data, dataHora, elo, rotulo, textoDoErro, useAcao, useLista } from "./comum";

type Aba = "nova" | "edicoes" | "lista" | "envio";
type TipoDeBloco = "titulo" | "paragrafo" | "imagem" | "botao" | "materia" | "acervo";
interface Bloco {
  chave: string;
  tipo: TipoDeBloco;
  texto?: string;
  titulo?: string;
  resumo?: string;
  autor?: string;
  url?: string;
  src?: string;
  alt?: string;
  legenda?: string;
}
interface Edicao {
  id: string;
  assunto: string;
  preheader: string;
  blocos: Omit<Bloco, "chave">[];
  texto: string;
  status: "rascunho" | "enviada";
  autor: string;
  criado_em: string;
  atualizado_em: string;
  enviada_em: string | null;
  enviada_por: string;
  destinatarios: number;
}
interface Inscrito {
  email: string;
  criado_em: string;
  confirmado?: boolean;
  falhas?: number;
  pausado?: boolean;
}
interface Novidade {
  titulo: string;
  resumo: string;
  autor: string;
  data: string;
  url: string;
}

const NOMES: Record<TipoDeBloco, string> = { titulo: "Título", paragrafo: "Parágrafo", imagem: "Imagem", botao: "Botão", materia: "Matéria do jornal", acervo: "Novidade do acervo" };
const novaChave = () => Math.random().toString(36).slice(2, 9);
const semChave = (blocos: Bloco[]) => blocos.map(({ chave: _chave, ...resto }) => resto); // eslint-disable-line @typescript-eslint/no-unused-vars

/**
 * O boletim do jornal: edição por blocos com prévia de computador e celular (clara e escura) e a versão em texto, teste para
 * o próprio e-mail antes de enviar, rascunhos e histórico, a lista (com os endereços que falham pausados) e o guia de
 * entrega (SPF, DKIM e DMARC). Continua valendo: dupla confirmação, saída em todo e-mail, ninguém vê o endereço de
 * ninguém, uma edição a cada seis horas, cópia oculta no envio manual e o botão de copiar os confirmados.
 */
export function Boletim() {
  const [aba, setAba] = useState<Aba>("nova");
  const lista = useLista<Inscrito[]>("boletim_listar");
  const edicoes = useLista<Edicao[]>("boletim_edicoes_listar");
  const [aberta, setAberta] = useState<Edicao | null>(null);
  const confirmados = lista.dados?.filter((i) => i.confirmado !== false && !i.pausado) ?? [];
  const comProblema = lista.dados?.filter((i) => i.pausado || (i.falhas ?? 0) > 0) ?? [];
  return (
    <section>
      <p className="max-w-3xl text-ink-soft">
        {confirmados.length} endereço(s) recebem o boletim. Quem pede recebe um e-mail para confirmar; sem o clique, o endereço não recebe nada e sai da lista em uma semana. Nenhuma abertura ou clique é rastreado.
      </p>
      <div className="mt-4">
        <Abas<Aba>
          opcoes={[
            { id: "nova", nome: aberta ? "Editar edição" : "Nova edição" },
            { id: "edicoes", nome: "Rascunhos e enviadas", conta: edicoes.dados?.filter((e) => e.status === "rascunho").length },
            { id: "lista", nome: "Lista", conta: comProblema.filter((i) => i.pausado).length },
            { id: "envio", nome: "Configurar a entrega" },
          ]}
          atual={aba}
          escolher={setAba}
        />
      </div>
      {aba === "nova" && <Editor key={aberta?.id ?? "nova"} inicial={aberta} destinatarios={confirmados.length} depois={() => { edicoes.recarregar(); }} fechar={() => setAberta(null)} />}
      {aba === "edicoes" && (
        <Edicoes
          edicoes={edicoes.dados}
          erro={edicoes.erro}
          recarregar={edicoes.recarregar}
          abrir={(e) => { setAberta(e); setAba("nova"); }}
        />
      )}
      {aba === "lista" && <Lista dados={lista.dados} erro={lista.erro} recarregar={lista.recarregar} />}
      {aba === "envio" && <GuiaDeEntrega />}
    </section>
  );
}

// ───────────── Editor ─────────────

function Editor({ inicial, destinatarios, depois, fechar }: { inicial: Edicao | null; destinatarios: number; depois: () => void; fechar: () => void }) {
  const base = inicial?.status === "enviada" ? null : inicial;
  const [id, setId] = useState<string | null>(base?.id ?? null);
  const [assunto, setAssunto] = useState(inicial ? (inicial.status === "enviada" ? `${inicial.assunto}` : inicial.assunto) : "");
  const [preheader, setPreheader] = useState(inicial?.preheader ?? "");
  const [blocos, setBlocos] = useState<Bloco[]>(() =>
    inicial?.blocos?.length ? inicial.blocos.map((b) => ({ ...b, chave: novaChave() })) : [{ chave: novaChave(), tipo: "titulo", texto: "" }, { chave: novaChave(), tipo: "paragrafo", texto: "" }],
  );
  const [salvo, setSalvo] = useState(base ? `Rascunho aberto (salvo em ${dataHora(base.atualizado_em)})` : "");
  const [sujo, setSujo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [tela, setTela] = useState<"computador" | "celular" | "texto">("computador");
  const [escuro, setEscuro] = useState(false);
  const [novidades, setNovidades] = useState<{ materias: Novidade[]; obras: Novidade[] } | null>(null);
  // A prévia usa o endereço público do site: é o mesmo que vai nos e-mails (e o desenho do boletim pede https).
  const origem = /^https:\/\//.test(site.url) ? site.url : "https://institutolucia.org";

  useEffect(() => {
    let vivo = true;
    fetch("/pt/novidades.json").then((r) => (r.ok ? r.json() : null)).then((d) => vivo && d && setNovidades(d)).catch(() => null);
    return () => {
      vivo = false;
    };
  }, []);

  const mudar = (novos: Bloco[]) => {
    setBlocos(novos);
    setSujo(true);
  };
  const trocar = (chave: string, m: Partial<Bloco>) => mudar(blocos.map((b) => (b.chave === chave ? { ...b, ...m } : b)));
  const texto = useMemo(() => textoDosBlocos(semChave(blocos), origem), [blocos, origem]);
  const html = useMemo(
    () => desenhoDoBoletim({ assunto: assunto || "Assunto da edição", texto, sair: `${origem}/pt/jornal?boletim=sair&codigo=exemplo`, blocos: semChave(blocos), preheader }, new Date(), { escuro, claro: !escuro }),
    [assunto, texto, origem, blocos, preheader, escuro],
  );
  // A prévia é escrita num quadro vazio à parte (sem programas): o e-mail não herda nem estraga o estilo do painel. O
  // quadro segue a política de segurança do painel, que não deixa carregar as fontes do Google: a prévia vai sem o link
  // delas (as letras de reserva do próprio e-mail entram no lugar) e com as imagens do site pelo endereço desta página.
  const quadro = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const doc = quadro.current?.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html.replace(/<link[^>]+fonts\.googleapis\.com[^>]*>/g, "").replaceAll("https://institutolucia.org/", "/"));
    doc.close();
  }, [html, tela]);
  const pronto = assunto.trim().length >= 5 && texto.trim().length >= 50;
  const faltaDescricao = blocos.some((b) => b.tipo === "imagem" && (!b.alt || b.alt.trim().length < 3));
  const imagemDeFora = blocos.some((b) => b.tipo === "imagem" && b.src && !/^\/(arquivos|imagens)\/[A-Za-z0-9/._-]+$/.test(b.src));

  async function salvar(silencioso = false): Promise<string | null> {
    setOcupado(true);
    if (!silencioso) setAviso("");
    try {
      const r = await rpc<{ id: string; salvo_em: string }>("boletim_edicao_salvar", { p_id: id, p_assunto: assunto, p_preheader: preheader, p_blocos: semChave(blocos), p_texto: texto });
      setId(r.id);
      setSujo(false);
      setSalvo(`Salvo ✓ ${dataHora(r.salvo_em)}`);
      depois();
      return r.id;
    } catch (erro) {
      setAviso(textoDoErro(erro));
      return null;
    } finally {
      setOcupado(false);
    }
  }

  // Rascunho guardado sozinho meio minuto depois da última mudança.
  useEffect(() => {
    if (!sujo || (!assunto.trim() && !texto.trim())) return;
    const t = window.setTimeout(() => void salvar(true), 30_000);
    return () => window.clearTimeout(t);
  }, [sujo, assunto, preheader, blocos]); // eslint-disable-line react-hooks/exhaustive-deps

  async function testar() {
    const atual = sujo || !id ? await salvar(true) : id;
    if (!atual) return;
    try {
      const r = await rpc<{ para: string }>("boletim_testar", { p_id: atual });
      setAviso(`Teste na fila para ${r.para}: chega em alguns minutos. Confira no computador e no celular.`);
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }
  async function enviar() {
    const atual = sujo || !id ? await salvar(true) : id;
    if (!atual) return;
    if (!window.confirm(`Enviar “${assunto.trim()}” para ${destinatarios} endereço(s)? Cada um recebe sozinho, com o link para sair. Não dá para desfazer.`)) return;
    try {
      const r = await rpc<{ emails: number }>("boletim_edicao_enviar", { p_id: atual });
      setAviso(`Edição na fila: ${r.emails} e-mail(s). Saem em até dez minutos. Ela foi para o histórico.`);
      depois();
      fechar();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    }
  }

  const campoBloco = (b: Bloco) => {
    switch (b.tipo) {
      case "titulo":
        return <input value={b.texto ?? ""} onChange={(e) => trocar(b.chave, { texto: e.target.value })} maxLength={200} placeholder="Título da seção" className={`${campo} font-semibold`} />;
      case "paragrafo":
        return <textarea value={b.texto ?? ""} onChange={(e) => trocar(b.chave, { texto: e.target.value })} rows={4} maxLength={6000} placeholder="Texto. Endereços https viram links. Linha em branco separa parágrafos." className={campo} />;
      case "imagem":
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-sm">Endereço da imagem no site<input value={b.src ?? ""} onChange={(e) => trocar(b.chave, { src: e.target.value.trim() })} placeholder="/arquivos/… ou /imagens/…" className={`${campo} font-mono`} /></label>
            <label className="block text-sm">Descrição (para quem não vê a imagem)<input value={b.alt ?? ""} onChange={(e) => trocar(b.chave, { alt: e.target.value })} maxLength={300} className={campo} /></label>
            <label className="block text-sm sm:col-span-2">Legenda ou crédito (opcional)<input value={b.legenda ?? ""} onChange={(e) => trocar(b.chave, { legenda: e.target.value })} maxLength={300} className={campo} /></label>
            <p className="text-xs text-ink-soft sm:col-span-2">Só imagens já publicadas no site (Materiais e arquivos). Imagem de outro site não entra: serviria para rastrear quem abriu o e-mail.</p>
          </div>
        );
      case "botao":
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-sm">Texto do botão<input value={b.texto ?? ""} onChange={(e) => trocar(b.chave, { texto: e.target.value })} maxLength={60} placeholder="Ler no site" className={campo} /></label>
            <label className="block text-sm">Endereço<input value={b.url ?? ""} onChange={(e) => trocar(b.chave, { url: e.target.value.trim() })} placeholder="https://… ou /pt/…" className={`${campo} font-mono`} /></label>
          </div>
        );
      case "materia":
      case "acervo": {
        const opcoes = b.tipo === "materia" ? novidades?.materias : novidades?.obras;
        return (
          <div className="space-y-2">
            <select
              value=""
              onChange={(e) => {
                const n = opcoes?.[Number(e.target.value)];
                if (n) trocar(b.chave, { titulo: n.titulo, resumo: n.resumo, autor: n.autor, url: n.url });
              }}
              className={campo}
              aria-label={b.tipo === "materia" ? "Escolher uma matéria do jornal" : "Escolher uma obra nova do acervo"}
            >
              <option value="">{opcoes ? (b.tipo === "materia" ? "Escolher uma matéria recente…" : "Escolher uma obra que entrou no acervo…") : "Carregando a lista…"}</option>
              {opcoes?.map((n, i) => <option key={n.url} value={i}>{n.titulo}{n.data ? ` (${n.data.slice(0, 10).split("-").reverse().join("/")})` : ""}</option>)}
            </select>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={b.titulo ?? ""} onChange={(e) => trocar(b.chave, { titulo: e.target.value })} maxLength={200} placeholder="Título" aria-label="Título" className={campo} />
              <input value={b.autor ?? ""} onChange={(e) => trocar(b.chave, { autor: e.target.value })} maxLength={160} placeholder="Autor (opcional)" aria-label="Autor" className={campo} />
              <textarea value={b.resumo ?? ""} onChange={(e) => trocar(b.chave, { resumo: e.target.value })} maxLength={600} rows={2} placeholder="Resumo curto" aria-label="Resumo" className={`${campo} sm:col-span-2`} />
              <input value={b.url ?? ""} onChange={(e) => trocar(b.chave, { url: e.target.value.trim() })} placeholder="/pt/jornal/…" aria-label="Endereço" className={`${campo} font-mono sm:col-span-2`} />
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        {inicial?.status === "enviada" && <p className="mb-3 border-l-4 border-gold pl-3 text-sm">Esta é uma cópia da edição enviada em {inicial.enviada_em ? dataHora(inicial.enviada_em) : ""}: vira um rascunho novo quando você guardar.</p>}
        <label className="block">
          Assunto
          <input value={assunto} onChange={(e) => { setAssunto(e.target.value); setSujo(true); }} maxLength={150} className={campo} />
        </label>
        <label className="mt-3 block">
          Texto de pré-visualização <span className="text-ink-soft">(o que aparece ao lado do assunto na caixa de entrada)</span>
          <input value={preheader} onChange={(e) => { setPreheader(e.target.value); setSujo(true); }} maxLength={140} className={campo} />
        </label>
        <ol className="mt-4 space-y-3">
          {blocos.map((b, i) => (
            <li key={b.chave} className="border border-rule bg-parchment-deep p-3">
              <div className="mb-2 flex items-center gap-2 text-xs">
                <span className={rotulo}>{NOMES[b.tipo]}</span>
                <span className="ml-auto flex gap-1">
                  <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => { const n = [...blocos]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; mudar(n); }} className="cursor-pointer border border-rule px-1.5 disabled:opacity-30">↑</button>
                  <button type="button" aria-label="Descer" disabled={i === blocos.length - 1} onClick={() => { const n = [...blocos]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; mudar(n); }} className="cursor-pointer border border-rule px-1.5 disabled:opacity-30">↓</button>
                  <button type="button" aria-label="Apagar o bloco" onClick={() => mudar(blocos.filter((x) => x.chave !== b.chave))} className="cursor-pointer border border-rule px-1.5 hover:text-oxblood">✕</button>
                </span>
              </div>
              {campoBloco(b)}
            </li>
          ))}
        </ol>
        <p className="mt-3 flex flex-wrap gap-2 text-sm">
          {(Object.keys(NOMES) as TipoDeBloco[]).map((t) => (
            <button key={t} type="button" className="cursor-pointer border border-dashed border-rule px-2 py-1 hover:border-oxblood" onClick={() => mudar([...blocos, { chave: novaChave(), tipo: t }])}>＋ {NOMES[t]}</button>
          ))}
        </p>
        {faltaDescricao && <p className="mt-2 text-sm text-oxblood">Falta a descrição de uma imagem.</p>}
        {imagemDeFora && <p className="mt-2 text-sm text-oxblood">Uma imagem não é do site (/arquivos ou /imagens): ela não vai aparecer.</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className={botaoClaro} disabled={ocupado} onClick={() => void salvar()}>Guardar rascunho</button>
          <button type="button" className={botaoClaro} disabled={ocupado || !pronto} onClick={() => void testar()}>Enviar teste para mim</button>
          <button type="button" className={botao} disabled={ocupado || !pronto || faltaDescricao || destinatarios === 0} onClick={() => void enviar()}>Enviar a edição ({destinatarios})</button>
          <span role="status" className="text-xs text-ink-soft">{sujo ? "Mudanças ainda não guardadas" : salvo}</span>
        </div>
        {!pronto && <p className="mt-2 text-xs text-ink-soft">Para enviar: assunto com 5 letras ou mais e pelo menos 50 letras de texto.</p>}
        <p className="mt-1 text-xs text-ink-soft">No máximo uma edição a cada seis horas. O teste vai só para o seu e-mail e não conta nesse limite.</p>
        <Aviso texto={aviso} />
        {inicial && <button type="button" className={`mt-2 ${elo} text-sm`} onClick={fechar}>Começar uma edição nova</button>}
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Prévia">
          {(["computador", "celular", "texto"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={tela === t} onClick={() => setTela(t)} className={`cursor-pointer border px-2 py-1 ${tela === t ? "border-ink bg-ink text-parchment" : "border-rule"}`}>
              {t === "computador" ? "Computador" : t === "celular" ? "Celular" : "Versão em texto"}
            </button>
          ))}
          {tela !== "texto" && (
            <label className="ml-auto flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={escuro} onChange={(e) => setEscuro(e.target.checked)} /> Leitor no modo escuro
            </label>
          )}
        </div>
        {tela === "texto" ? (
          <pre className="max-h-[75vh] overflow-auto whitespace-pre-wrap border border-rule bg-parchment p-4 font-mono text-xs">{`Assunto: ${assunto}\n\n${texto}\n\n---\nVocê recebe este boletim porque pediu no site do Instituto Lúcia. Para sair da lista: ${origem}/pt/jornal?boletim=sair&codigo=…`}</pre>
        ) : (
          <div className="flex justify-center border border-rule bg-[#ddd3bc] p-3">
            <iframe ref={quadro} title="Prévia do e-mail" sandbox="allow-same-origin" className="h-[75vh] border-0 bg-white" style={{ width: tela === "celular" ? 375 : 640, maxWidth: "100%", colorScheme: escuro ? "dark" : "light" }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────── Rascunhos e enviadas ─────────────

function Edicoes({ edicoes, erro, recarregar, abrir }: { edicoes: Edicao[] | null; erro: string; recarregar: () => void; abrir: (e: Edicao) => void }) {
  const acao = useAcao(recarregar);
  if (!edicoes) return <p className="text-xs text-ink-soft">{erro || "Carregando…"}</p>;
  const rascunhos = edicoes.filter((e) => e.status === "rascunho");
  const enviadas = edicoes.filter((e) => e.status === "enviada");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="painel-cartao p-5">
        <h2 className="font-serif text-xl font-semibold">Rascunhos</h2>
        {rascunhos.length === 0 ? (
          <p className="mt-2 text-ink-soft">Nenhum rascunho. Uma edição nova vira rascunho quando é guardada (ou sozinha, meio minuto depois da última mudança).</p>
        ) : (
          <ul className="mt-3 divide-y divide-rule border-y border-rule">
            {rascunhos.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  <span className="font-semibold">{e.assunto || "(sem assunto)"}</span>
                  <span className="block text-xs text-ink-soft">{e.autor} · {dataHora(e.atualizado_em)}</span>
                </span>
                <span className="flex gap-3 text-sm">
                  <button type="button" className={elo} onClick={() => abrir(e)}>Abrir</button>
                  <button type="button" className={elo} disabled={acao.ocupado} onClick={() => { if (window.confirm(`Apagar o rascunho “${e.assunto || "sem assunto"}”?`)) void acao.agir("boletim_edicao_apagar", { p_id: e.id }, "Rascunho apagado."); }}>Apagar</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="painel-cartao p-5">
        <h2 className="font-serif text-xl font-semibold">Enviadas</h2>
        {enviadas.length === 0 ? (
          <p className="mt-2 text-ink-soft">Nenhuma edição enviada por aqui ainda.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs text-ink-soft">
              <tr><th className="py-1 font-normal">Data</th><th className="py-1 font-normal">Assunto</th><th className="py-1 text-right font-normal">Para</th><th className="py-1 font-normal">Quem enviou</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {enviadas.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 pr-2 font-mono text-xs">{e.enviada_em ? data(e.enviada_em) : ""}</td>
                  <td className="py-2 pr-2">{e.assunto}</td>
                  <td className="py-2 pr-2 text-right font-mono">{e.destinatarios}</td>
                  <td className="py-2 pr-2">{e.enviada_por}</td>
                  <td className="py-2"><button type="button" className={elo} onClick={() => abrir(e)}>Usar como base</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <Aviso texto={acao.aviso} />
    </div>
  );
}

// ───────────── Lista ─────────────

function Lista({ dados, erro, recarregar }: { dados: Inscrito[] | null; erro: string; recarregar: () => void }) {
  const acao = useAcao(recarregar);
  const [copiado, setCopiado] = useState(false);
  const [filtro, setFiltro] = useState<"confirmados" | "esperando" | "problema">("confirmados");
  const confirmados = dados?.filter((i) => i.confirmado !== false && !i.pausado) ?? [];
  const esperando = dados?.filter((i) => i.confirmado === false) ?? [];
  const problema = dados?.filter((i) => i.pausado || (i.falhas ?? 0) > 0) ?? [];
  const vistos = filtro === "confirmados" ? confirmados : filtro === "esperando" ? esperando : problema;
  return (
    <section>
      <p className="text-ink-soft">Se precisar mandar pelo e-mail do jornal ({site.newsletter}), use sempre a lista em <strong>cópia oculta</strong> (Cco): ninguém pode ver o endereço de ninguém.</p>
      <button type="button" className={`${botaoClaro} mt-2`} disabled={confirmados.length === 0} onClick={() => { void navigator.clipboard.writeText(confirmados.map((i) => i.email).join(", ")).then(() => setCopiado(true)); }}>
        {copiado ? "Lista copiada ✓" : `Copiar os ${confirmados.length} endereços confirmados`}
      </button>
      <div className="mt-4 flex flex-wrap gap-2 text-sm" role="group" aria-label="Filtro">
        {([["confirmados", `Confirmados (${confirmados.length})`], ["esperando", `Esperando confirmação (${esperando.length})`], ["problema", `Com problema (${problema.length})`]] as const).map(([id, nome]) => (
          <button key={id} type="button" aria-pressed={filtro === id} onClick={() => setFiltro(id)} className={`cursor-pointer border px-2 py-1 ${filtro === id ? "border-ink bg-ink text-parchment" : "border-rule"}`}>{nome}</button>
        ))}
      </div>
      {filtro === "problema" && <p className="mt-2 text-sm text-ink-soft">Endereço que falha três vezes seguidas para de receber (caixa cheia, endereço que não existe mais). Reative quando souber que voltou a funcionar.</p>}
      <Aviso texto={erro || acao.aviso} />
      <ul className="mt-2 divide-y divide-rule border-y border-rule">
        {vistos.map((item) => (
          <li key={item.email} className="flex flex-wrap items-baseline justify-between gap-3 py-2">
            <span>
              {item.email}{" "}
              <span className="text-sm text-ink-soft">
                · desde {data(item.criado_em)}
                {item.confirmado === false ? " · ainda não confirmou" : ""}
                {item.pausado ? " · pausado" : (item.falhas ?? 0) > 0 ? ` · ${item.falhas} falha(s) seguidas` : ""}
              </span>
            </span>
            <span className="flex gap-3 text-sm">
              {item.pausado && <button type="button" className={elo} disabled={acao.ocupado} onClick={() => acao.agir("boletim_reativar", { p_email: item.email }, "Endereço reativado.")}>Reativar</button>}
              <button type="button" className={elo} disabled={acao.ocupado} onClick={() => { if (window.confirm(`Retirar ${item.email} da lista?`)) void acao.agir("boletim_remover", { p_email: item.email }, "Endereço retirado."); }}>Retirar</button>
            </span>
          </li>
        ))}
      </ul>
      {vistos.length === 0 && <p className="mt-2 text-ink-soft">Ninguém aqui.</p>}
    </section>
  );
}

// ───────────── Guia de entrega ─────────────

function GuiaDeEntrega() {
  return (
    <section className="painel-cartao max-w-3xl p-5 text-sm leading-relaxed">
      <h2 className="font-serif text-xl font-semibold">Para os e-mails chegarem na caixa de entrada</h2>
      <p className="mt-2 text-ink-soft">Os e-mails saem pelo Resend em nome de <code>institutolucia.org</code>. Três registros no DNS (na Cloudflare) dizem aos provedores que eles são nossos de verdade. Os valores exatos vêm do próprio Resend: copie de lá, não daqui.</p>
      <ol className="mt-3 list-decimal space-y-3 pl-5">
        <li><strong>SPF e DKIM.</strong> No Resend, abra Domains → institutolucia.org. Ele mostra os registros (um TXT de SPF e um MX no subdomínio de envio, e um TXT de DKIM em <code>resend._domainkey</code>). Na Cloudflare, em DNS, crie cada um exatamente como está lá, com o proxy desligado (nuvem cinza, “DNS only”). Volte ao Resend e clique em Verify: os três precisam ficar “Verified”.</li>
        <li><strong>DMARC.</strong> Na Cloudflare, crie um TXT com o nome <code>_dmarc</code> e o valor <code>v=DMARC1; p=none; rua=mailto:institutolucia@tutamail.com</code>. Com <code>p=none</code> nada é bloqueado: os provedores só mandam relatórios. Depois de duas a quatro semanas sem falhas nos relatórios, troque para <code>p=quarantine</code>.</li>
        <li><strong>Conferir.</strong> Mande um “Enviar teste para mim” para uma conta do Gmail. Na mensagem, abra ⋮ → “Mostrar original”: SPF, DKIM e DMARC precisam aparecer como <strong>PASS</strong>.</li>
        <li><strong>No provedor de envio.</strong> O remetente (EMAIL_REMETENTE) deve ser sempre do domínio verificado, e a resposta (EMAIL_RESPOSTA) uma caixa que alguém lê. Se o Resend mostrar reclamações de spam ou muitos endereços inválidos, limpe a lista em Lista → Com problema.</li>
        <li><strong>Boas práticas que já estão no código.</strong> Todo boletim leva o cabeçalho de descadastro (botão “cancelar inscrição” do leitor) e o link “Sair da lista”; vai junto uma versão em texto; não há imagem de fora nem rastreio de abertura; uma edição a cada seis horas no máximo.</li>
      </ol>
      <p className="mt-4 text-xs text-ink-soft">O mesmo guia está em docs/EMAIL-ENTREGA.md.</p>
    </section>
  );
}
