// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ArrowDown, ArrowUp, Copy, FilePlus2, FileText, FlaskConical, Monitor, Plus, RotateCcw, Save, Send, Smartphone, Trash2, UserMinus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { rpc } from "@/lib/backend";
import { site } from "@/lib/site";
import { boletim as desenhoDoBoletim, textoDosBlocos } from "@/supabase/functions/_shared/emails.mjs";
import { Aviso, data, dataHora, textoDoErro, useAcao, useLista } from "./comum";
import { MoldeTabela } from "./moldes";
import { Abas, Botao, Campo, Cartao, type ColumnDef, confirmarFrase, Esqueleto, Faixa, ItemDeLista, Lista, Marca, Selo, Tabela, Vazio } from "./ui";

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
 * No desenho novo: a edição em cartão (com a prévia ao lado) e os inscritos no molde Tabela.
 */
export function Boletim() {
  const [aba, setAba] = useState<Aba>("nova");
  const lista = useLista<Inscrito[]>("boletim_listar");
  const edicoes = useLista<Edicao[]>("boletim_edicoes_listar");
  const [aberta, setAberta] = useState<Edicao | null>(null);
  const confirmados = lista.dados?.filter((i) => i.confirmado !== false && !i.pausado) ?? [];
  const comProblema = lista.dados?.filter((i) => i.pausado || (i.falhas ?? 0) > 0) ?? [];
  return (
    <section className="pn-tela">
      <p className="pn-sobre">
        {confirmados.length} endereço(s) recebem o boletim. Quem pede recebe um e-mail para confirmar; sem o clique, o endereço não recebe nada e sai da lista em uma semana. Nenhuma abertura ou clique é rastreado.
      </p>
      <Abas<Aba>
        rotulo="Boletim"
        opcoes={[
          { id: "nova", nome: aberta ? "Editar edição" : "Nova edição" },
          { id: "edicoes", nome: "Rascunhos e enviadas", conta: edicoes.dados?.filter((e) => e.status === "rascunho").length },
          { id: "lista", nome: "Lista", conta: comProblema.filter((i) => i.pausado).length },
          { id: "envio", nome: "Configurar a entrega" },
        ]}
        valor={aba}
        aoMudar={setAba}
        painel={(atual) => (
          <>
            {atual === "nova" && <Editor key={aberta?.id ?? "nova"} inicial={aberta} destinatarios={confirmados.length} depois={() => { edicoes.recarregar(); }} fechar={() => setAberta(null)} />}
            {atual === "edicoes" && (
              <Edicoes
                edicoes={edicoes.dados}
                erro={edicoes.erro}
                recarregar={edicoes.recarregar}
                abrir={(e) => { setAberta(e); setAba("nova"); }}
              />
            )}
            {atual === "lista" && <ListaDeInscritos dados={lista.dados} erro={lista.erro} recarregar={lista.recarregar} />}
            {atual === "envio" && <GuiaDeEntrega />}
          </>
        )}
      />
    </section>
  );
}

// ───────────── Editor ─────────────

/** Os botões de escolha de uma vez só (prévia, filtro): o escolhido fica marcado, com aria-pressed. */
function Escolhas<T extends string>({ rotulo, opcoes, valor, escolher }: { rotulo: string; opcoes: readonly (readonly [T, string, typeof Monitor?])[]; valor: T; escolher: (v: T) => void }) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap gap-1">
      {opcoes.map(([id, nome, simbolo]) => (
        <Botao key={id} pequeno variante={valor === id ? "padrao" : "discreto"} aria-pressed={valor === id} simbolo={simbolo} onClick={() => escolher(id)}>
          {nome}
        </Botao>
      ))}
    </div>
  );
}

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
    if (!(await confirmarFrase(`Enviar “${assunto.trim()}” para ${destinatarios} endereço(s)? Cada um recebe sozinho, com o link para sair. Não dá para desfazer.`))) return;
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
        return <input value={b.texto ?? ""} onChange={(e) => trocar(b.chave, { texto: e.target.value })} maxLength={200} placeholder="Título da seção" aria-label={NOMES.titulo} className="pn-campo font-semibold" />;
      case "paragrafo":
        return <textarea value={b.texto ?? ""} onChange={(e) => trocar(b.chave, { texto: e.target.value })} rows={4} maxLength={6000} placeholder="Texto. Endereços https viram links. Linha em branco separa parágrafos." aria-label={NOMES.paragrafo} className="pn-campo" />;
      case "imagem":
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            <Campo rotulo="Endereço da imagem no site" value={b.src ?? ""} onChange={(e) => trocar(b.chave, { src: e.target.value.trim() })} placeholder="/arquivos/… ou /imagens/…" className="font-mono" />
            <Campo rotulo="Descrição (para quem não vê a imagem)" value={b.alt ?? ""} onChange={(e) => trocar(b.chave, { alt: e.target.value })} maxLength={300} />
            <div className="sm:col-span-2">
              <Campo rotulo="Legenda ou crédito (opcional)" value={b.legenda ?? ""} onChange={(e) => trocar(b.chave, { legenda: e.target.value })} maxLength={300} />
            </div>
            <p className="pn-ajuda sm:col-span-2">Só imagens já publicadas no site (Materiais e arquivos). Imagem de outro site não entra: serviria para rastrear quem abriu o e-mail.</p>
          </div>
        );
      case "botao":
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            <Campo rotulo="Texto do botão" value={b.texto ?? ""} onChange={(e) => trocar(b.chave, { texto: e.target.value })} maxLength={60} placeholder="Ler no site" />
            <Campo rotulo="Endereço" value={b.url ?? ""} onChange={(e) => trocar(b.chave, { url: e.target.value.trim() })} placeholder="https://… ou /pt/…" className="font-mono" />
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
              className="pn-campo"
              aria-label={b.tipo === "materia" ? "Escolher uma matéria do jornal" : "Escolher uma obra nova do acervo"}
            >
              <option value="">{opcoes ? (b.tipo === "materia" ? "Escolher uma matéria recente…" : "Escolher uma obra que entrou no acervo…") : "Carregando a lista…"}</option>
              {opcoes?.map((n, i) => <option key={n.url} value={i}>{n.titulo}{n.data ? ` (${n.data.slice(0, 10).split("-").reverse().join("/")})` : ""}</option>)}
            </select>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={b.titulo ?? ""} onChange={(e) => trocar(b.chave, { titulo: e.target.value })} maxLength={200} placeholder="Título" aria-label="Título" className="pn-campo" />
              <input value={b.autor ?? ""} onChange={(e) => trocar(b.chave, { autor: e.target.value })} maxLength={160} placeholder="Autor (opcional)" aria-label="Autor" className="pn-campo" />
              <textarea value={b.resumo ?? ""} onChange={(e) => trocar(b.chave, { resumo: e.target.value })} maxLength={600} rows={2} placeholder="Resumo curto" aria-label="Resumo" className="pn-campo sm:col-span-2" />
              <input value={b.url ?? ""} onChange={(e) => trocar(b.chave, { url: e.target.value.trim() })} placeholder="/pt/jornal/…" aria-label="Endereço" className="pn-campo font-mono sm:col-span-2" />
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Cartao
        as="div"
        rodape={
          <div className="pn-secao">
            <div className="flex flex-wrap items-center gap-2">
              <Botao simbolo={Save} disabled={ocupado} onClick={() => void salvar()}>Guardar rascunho</Botao>
              <Botao simbolo={FlaskConical} disabled={ocupado || !pronto} onClick={() => void testar()}>Enviar teste para mim</Botao>
              <Botao variante="principal" simbolo={Send} disabled={ocupado || !pronto || faltaDescricao || destinatarios === 0} onClick={() => void enviar()}>Enviar a edição ({destinatarios})</Botao>
              <span role="status" className="pn-ajuda">{sujo ? "Mudanças ainda não guardadas" : salvo}</span>
            </div>
            {!pronto && <p className="pn-ajuda">Para enviar: assunto com 5 letras ou mais e pelo menos 50 letras de texto.</p>}
            <p className="pn-ajuda">No máximo uma edição a cada seis horas. O teste vai só para o seu e-mail e não conta nesse limite.</p>
            <Aviso texto={aviso} />
            {inicial && (
              <div>
                <Botao variante="discreto" pequeno simbolo={FilePlus2} onClick={fechar}>Começar uma edição nova</Botao>
              </div>
            )}
          </div>
        }
      >
        <div className="pn-secao">
          {inicial?.status === "enviada" && <Faixa tom="info">Esta é uma cópia da edição enviada em {inicial.enviada_em ? dataHora(inicial.enviada_em) : ""}: vira um rascunho novo quando você guardar.</Faixa>}
          <Campo rotulo="Assunto" value={assunto} onChange={(e) => { setAssunto(e.target.value); setSujo(true); }} maxLength={150} />
          <div>
            <Campo rotulo="Texto de pré-visualização" value={preheader} onChange={(e) => { setPreheader(e.target.value); setSujo(true); }} maxLength={140} />
            <p className="pn-ajuda">(o que aparece ao lado do assunto na caixa de entrada)</p>
          </div>
          <ol className="space-y-3">
            {blocos.map((b, i) => (
              <li key={b.chave}>
                <Cartao as="div" variante="plano">
                  <div className="pn-secao">
                    <div className="flex items-center gap-2">
                      <span className="pn-rotulo-mono">{NOMES[b.tipo]}</span>
                      <span className="ml-auto flex gap-1">
                        <Botao icone pequeno variante="discreto" simbolo={ArrowUp} aria-label="Subir" dica="Subir" disabled={i === 0} onClick={() => { const n = [...blocos]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; mudar(n); }} />
                        <Botao icone pequeno variante="discreto" simbolo={ArrowDown} aria-label="Descer" dica="Descer" disabled={i === blocos.length - 1} onClick={() => { const n = [...blocos]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; mudar(n); }} />
                        <Botao icone pequeno variante="discreto" perigo simbolo={Trash2} aria-label="Apagar o bloco" dica="Apagar o bloco" onClick={() => mudar(blocos.filter((x) => x.chave !== b.chave))} />
                      </span>
                    </div>
                    {campoBloco(b)}
                  </div>
                </Cartao>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(NOMES) as TipoDeBloco[]).map((t) => (
              <Botao key={t} pequeno variante="discreto" simbolo={Plus} onClick={() => mudar([...blocos, { chave: novaChave(), tipo: t }])}>
                {NOMES[t]}
              </Botao>
            ))}
          </div>
          {faltaDescricao && <Faixa tom="aviso">Falta a descrição de uma imagem.</Faixa>}
          {imagemDeFora && <Faixa tom="aviso">Uma imagem não é do site (/arquivos ou /imagens): ela não vai aparecer.</Faixa>}
        </div>
      </Cartao>

      <div className="pn-secao">
        <div className="flex flex-wrap items-center gap-2">
          <Escolhas
            rotulo="Prévia"
            valor={tela}
            escolher={setTela}
            opcoes={[
              ["computador", "Computador", Monitor],
              ["celular", "Celular", Smartphone],
              ["texto", "Versão em texto", FileText],
            ] as const}
          />
          {tela !== "texto" && (
            <div className="ml-auto">
              <Marca rotulo="Leitor no modo escuro" checked={escuro} onChange={(e) => setEscuro(e.target.checked)} />
            </div>
          )}
        </div>
        {tela === "texto" ? (
          <pre className="pn-cartao max-h-[75vh] overflow-auto whitespace-pre-wrap font-mono text-xs">{`Assunto: ${assunto}\n\n${texto}\n\n---\nVocê recebe este boletim porque pediu no site do Instituto Lúcia. Para sair da lista: ${origem}/pt/jornal?boletim=sair&codigo=…`}</pre>
        ) : (
          // A moldura é do painel; o e-mail dentro do quadro é documento e mantém as cores dele.
          <div className="pn-cartao flex justify-center bg-parchment-deep">
            <iframe ref={quadro} title="Prévia do e-mail" sandbox="allow-same-origin" className="h-[75vh] border-0" style={{ width: tela === "celular" ? 375 : 640, maxWidth: "100%", colorScheme: escuro ? "dark" : "light" }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────── Rascunhos e enviadas ─────────────

function Edicoes({ edicoes, erro, recarregar, abrir }: { edicoes: Edicao[] | null; erro: string; recarregar: () => void; abrir: (e: Edicao) => void }) {
  const acao = useAcao(recarregar);
  if (!edicoes) {
    return erro ? (
      <Faixa tom="erro" acao={<Botao pequeno onClick={recarregar}>Tentar de novo</Botao>}>
        {erro}
      </Faixa>
    ) : (
      <Esqueleto forma="cartoes" linhas={2} />
    );
  }
  const rascunhos = edicoes.filter((e) => e.status === "rascunho");
  const enviadas = edicoes.filter((e) => e.status === "enviada");
  const colunas: ColumnDef<Edicao>[] = [
    { id: "data", accessorFn: (e) => e.enviada_em ?? "", header: "Data", cell: ({ row }) => <span className="font-mono text-xs">{row.original.enviada_em ? data(row.original.enviada_em) : ""}</span> },
    { accessorKey: "assunto", header: "Assunto" },
    { accessorKey: "destinatarios", header: "Para", cell: ({ getValue }) => <span className="font-mono">{String(getValue())}</span> },
    { accessorKey: "enviada_por", header: "Quem enviou" },
    {
      id: "acoes",
      header: () => <span className="sr-only">Ações</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <Botao variante="discreto" pequeno simbolo={Copy} onClick={() => abrir(row.original)}>
          Usar como base
        </Botao>
      ),
    },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Cartao titulo="Rascunhos">
        {rascunhos.length === 0 ? (
          <Vazio titulo="Nenhum rascunho. Uma edição nova vira rascunho quando é guardada (ou sozinha, meio minuto depois da última mudança)." />
        ) : (
          <Lista rotulo="Rascunhos" plana>
            {rascunhos.map((e) => (
              <ItemDeLista
                key={e.id}
                titulo={e.assunto || "(sem assunto)"}
                meta={
                  <>
                    {e.autor} · {dataHora(e.atualizado_em)}
                  </>
                }
                acoes={
                  <>
                    <Botao variante="discreto" pequeno onClick={() => abrir(e)}>Abrir</Botao>
                    <Botao
                      variante="discreto"
                      pequeno
                      perigo
                      simbolo={Trash2}
                      disabled={acao.ocupado}
                      onClick={async () => {
                        if (await confirmarFrase(`Apagar o rascunho “${e.assunto || "sem assunto"}”?`)) void acao.agir("boletim_edicao_apagar", { p_id: e.id }, "Rascunho apagado.");
                      }}
                    >
                      Apagar
                    </Botao>
                  </>
                }
              />
            ))}
          </Lista>
        )}
      </Cartao>
      <Cartao titulo="Enviadas">
        <Tabela dados={enviadas} colunas={colunas} legenda="Enviadas" densa vazio={<Vazio titulo="Nenhuma edição enviada por aqui ainda." />} />
      </Cartao>
      <Aviso texto={acao.aviso} />
    </div>
  );
}

// ───────────── Lista ─────────────

type FiltroDaLista = "confirmados" | "esperando" | "problema";

/** Os inscritos no molde Tabela: busca, ordem por coluna e páginas; o filtro e o "copiar" ficam na barra de cima. */
function ListaDeInscritos({ dados, erro, recarregar }: { dados: Inscrito[] | null; erro: string; recarregar: () => void }) {
  const acao = useAcao(recarregar);
  const [copiado, setCopiado] = useState(false);
  const [filtro, setFiltro] = useState<FiltroDaLista>("confirmados");
  const confirmados = dados?.filter((i) => i.confirmado !== false && !i.pausado) ?? [];
  const esperando = dados?.filter((i) => i.confirmado === false) ?? [];
  const problema = dados?.filter((i) => i.pausado || (i.falhas ?? 0) > 0) ?? [];
  const vistos = filtro === "confirmados" ? confirmados : filtro === "esperando" ? esperando : problema;
  const colunas: ColumnDef<Inscrito>[] = [
    { accessorKey: "email", header: "E-mail" },
    { accessorKey: "criado_em", header: "Desde", cell: ({ getValue }) => data(String(getValue())) },
    {
      id: "situacao",
      header: "Situação",
      accessorFn: (item) => (item.pausado ? "pausado" : item.confirmado === false ? "ainda não confirmou" : String(item.falhas ?? 0)),
      cell: ({ row }) => {
        const item = row.original;
        if (item.pausado) return <Selo tom="erro">pausado</Selo>;
        if (item.confirmado === false) return <Selo tom="aviso">ainda não confirmou</Selo>;
        if ((item.falhas ?? 0) > 0) return <Selo tom="aviso">{`${item.falhas} falha(s) seguidas`}</Selo>;
        return null;
      },
    },
    {
      id: "acoes",
      header: () => <span className="sr-only">Ações</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <span className="flex flex-wrap gap-1">
            {item.pausado && (
              <Botao variante="discreto" pequeno simbolo={RotateCcw} disabled={acao.ocupado} onClick={() => acao.agir("boletim_reativar", { p_email: item.email }, "Endereço reativado.")}>
                Reativar
              </Botao>
            )}
            <Botao
              variante="discreto"
              pequeno
              perigo
              simbolo={UserMinus}
              disabled={acao.ocupado}
              onClick={async () => {
                if (await confirmarFrase(`Retirar ${item.email} da lista?`)) void acao.agir("boletim_remover", { p_email: item.email }, "Endereço retirado.");
              }}
            >
              Retirar
            </Botao>
          </span>
        );
      },
    },
  ];
  return (
    <section className="pn-tela">
      <p className="pn-ajuda">
        Se precisar mandar pelo e-mail do jornal ({site.newsletter}), use sempre a lista em <strong>cópia oculta</strong> (Cco): ninguém pode ver o endereço de ninguém.
      </p>
      {erro && (
        <Faixa tom="erro" acao={<Botao pequeno onClick={recarregar}>Tentar de novo</Botao>}>
          {erro}
        </Faixa>
      )}
      <Aviso texto={acao.aviso} />
      {filtro === "problema" && <Faixa tom="info">Endereço que falha três vezes seguidas para de receber (caixa cheia, endereço que não existe mais). Reative quando souber que voltou a funcionar.</Faixa>}
      <MoldeTabela<Inscrito>
        dados={vistos}
        colunas={colunas}
        legenda="Inscritos"
        carregando={!dados && !erro}
        densa
        vazio={<Vazio titulo="Ninguém aqui." />}
        barra={
          <>
            <Escolhas<FiltroDaLista>
              rotulo="Filtro"
              valor={filtro}
              escolher={setFiltro}
              opcoes={[
                ["confirmados", `Confirmados (${confirmados.length})`],
                ["esperando", `Esperando confirmação (${esperando.length})`],
                ["problema", `Com problema (${problema.length})`],
              ] as const}
            />
            <span className="ml-auto">
              <Botao simbolo={Copy} disabled={confirmados.length === 0} onClick={() => { void navigator.clipboard.writeText(confirmados.map((i) => i.email).join(", ")).then(() => setCopiado(true)); }}>
                {copiado ? "Lista copiada ✓" : `Copiar os ${confirmados.length} endereços confirmados`}
              </Botao>
            </span>
          </>
        }
      />
    </section>
  );
}

// ───────────── Guia de entrega ─────────────

function GuiaDeEntrega() {
  return (
    <Cartao className="max-w-3xl text-sm leading-relaxed" titulo="Para os e-mails chegarem na caixa de entrada">
      <p className="pn-ajuda">Os e-mails saem pelo Resend em nome de <code>institutolucia.org</code>. Três registros no DNS (na Cloudflare) dizem aos provedores que eles são nossos de verdade. Os valores exatos vêm do próprio Resend: copie de lá, não daqui.</p>
      <ol className="mt-3 list-decimal space-y-3 pl-5">
        <li><strong>SPF e DKIM.</strong> No Resend, abra Domains → institutolucia.org. Ele mostra os registros (um TXT de SPF e um MX no subdomínio de envio, e um TXT de DKIM em <code>resend._domainkey</code>). Na Cloudflare, em DNS, crie cada um exatamente como está lá, com o proxy desligado (nuvem cinza, “DNS only”). Volte ao Resend e clique em Verify: os três precisam ficar “Verified”.</li>
        <li><strong>DMARC.</strong> Na Cloudflare, crie um TXT com o nome <code>_dmarc</code> e o valor <code>v=DMARC1; p=none; rua=mailto:institutolucia@tutamail.com</code>. Com <code>p=none</code> nada é bloqueado: os provedores só mandam relatórios. Depois de duas a quatro semanas sem falhas nos relatórios, troque para <code>p=quarantine</code>.</li>
        <li><strong>Conferir.</strong> Mande um “Enviar teste para mim” para uma conta do Gmail. Na mensagem, abra ⋮ → “Mostrar original”: SPF, DKIM e DMARC precisam aparecer como <strong>PASS</strong>.</li>
        <li><strong>No provedor de envio.</strong> O remetente (EMAIL_REMETENTE) deve ser sempre do domínio verificado, e a resposta (EMAIL_RESPOSTA) uma caixa que alguém lê. Se o Resend mostrar reclamações de spam ou muitos endereços inválidos, limpe a lista em Lista → Com problema.</li>
        <li><strong>Boas práticas que já estão no código.</strong> Todo boletim leva o cabeçalho de descadastro (botão “cancelar inscrição” do leitor) e o link “Sair da lista”; vai junto uma versão em texto; não há imagem de fora nem rastreio de abertura; uma edição a cada seis horas no máximo.</li>
      </ol>
      <p className="pn-ajuda mt-4">O mesmo guia está em docs/EMAIL-ENTREGA.md.</p>
    </Cartao>
  );
}
