// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Check, Copy, ExternalLink, FileText, FolderOpen, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { can, rpc, type Me } from "@/lib/backend";
import { cleanImage, previewFile, sendFile, UploadError, uploadMessages } from "@/lib/upload";
import { CampoArquivo, CampoData } from "./Campos";
import { data, textoDoErro, useAcao, useLista } from "./comum";
import { PublicarAgora } from "./controles/PublicarAgora";
import { Area, Botao, Busca, CabecalhoDeSecao, Campo, Cartao, confirmarFrase, Dialogo, Esqueleto, Faixa, ItemDeLista, Lista, Marca, Selecao, Selo, type TomDoSelo, Vazio } from "./ui";

export interface Material {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  campanha: string;
  url: string;
  publicado: boolean;
  ordem: number;
  credito_autor?: string;
  credito_origem?: string;
  licenca?: string;
  candidatura?: boolean;
  candidatura_responsavel?: string;
  arquivo?: string | null;
  arquivo_caminho?: string | null;
  arquivo_status?: string | null;
  estado?: "rascunho" | "aprovado" | "publicado";
}

export const tiposDeMaterial: Record<string, string> = { zine: "Zine", panfleto: "Panfleto", cartaz: "Cartaz", banner: "Banner", video: "Vídeo", texto: "Texto" };
export const licencas: Record<string, string> = {
  "cc-by-sa": "CC BY-SA 4.0 (padrão do instituto)",
  "cc-by": "CC BY 4.0",
  cc0: "CC0 (sem reserva de direitos)",
  "dominio-publico": "Domínio público",
  autorizacao: "Com autorização escrita de quem fez",
  outra: "Outra licença livre (diga qual na descrição)",
};
const estados: Record<string, string> = { rascunho: "Rascunho", aprovado: "Aprovado", publicado: "Publicado" };
const tomDoEstado: Record<string, TomDoSelo> = { rascunho: "neutro", aprovado: "ouro", publicado: "ok" };

const novo = {
  id: "", tipo: "panfleto", titulo: "", descricao: "", campanha: "", url: "", publicado: false, ordem: 0,
  arquivo: "", credito_autor: "", credito_origem: "", licenca: "cc-by-sa",
  candidatura: false, candidatura_responsavel: "", candidatura_sem_impulsionamento: false, candidatura_votacao: "",
};
type Form = typeof novo;

/** Miniatura de um material: a imagem publicada, a imagem ainda no depósito (só a equipe vê) ou o tipo do arquivo. */
function Miniatura({ m }: { m: Material }) {
  const [src, setSrc] = useState("");
  const publicado = /^\/arquivos\/[a-f0-9]{20}\.(webp|jpg)$/.test(m.url) ? m.url : "";
  const pendente = !publicado && m.arquivo_caminho && /\.(webp|jpg)$/.test(m.arquivo_caminho) ? m.arquivo_caminho : "";
  useEffect(() => {
    if (!pendente) return;
    let criado = "";
    let vivo = true;
    previewFile(pendente).then((u) => { criado = u; if (vivo) setSrc(u); else URL.revokeObjectURL(u); }).catch(() => null);
    return () => { vivo = false; if (criado) URL.revokeObjectURL(criado); };
  }, [pendente]);
  const imagem = publicado || src;
  const ext = (m.url || m.arquivo_caminho || "").split(".").pop()?.toUpperCase() ?? "";
  const externo = m.url.startsWith("https://");
  return imagem ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imagem} alt="" loading="lazy" className="h-40 w-full bg-parchment-deep object-contain" />
  ) : (
    <div className="flex h-40 w-full flex-col items-center justify-center gap-1 bg-parchment-deep text-ink-soft">
      {externo ? <ExternalLink aria-hidden width={28} height={28} strokeWidth={1.4} /> : <span className="pn-rotulo-mono" style={{ fontSize: "1.25rem" }}>{ext || "?"}</span>}
      <span className="pn-ajuda">{externo ? "endereço externo" : ext === "PDF" ? "PDF" : "sem prévia"}</span>
    </div>
  );
}

/** Zines, panfletos, cartazes e banners de campanha. Curadoria, design e marketing preparam; a coordenação põe no ar. */
export function Materiais({ me }: { me: Me }) {
  const publica = can(me, "coordenacao");
  const lista = useLista<Material[]>("materiais_listar");
  const acao = useAcao(lista.recarregar);
  const [form, setForm] = useState<Form | null>(null);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [campanha, setCampanha] = useState("");
  const [estado, setEstado] = useState("");
  const itens = lista.dados ?? [];
  const campanhas = [...new Set(itens.map((m) => m.campanha).filter(Boolean))].sort();
  const termo = busca.trim().toLowerCase();
  const vistos = itens.filter((m) => (!tipo || m.tipo === tipo) && (!campanha || m.campanha === campanha) && (!estado || (m.estado ?? (m.publicado ? "publicado" : "rascunho")) === estado) && (!termo || `${m.titulo} ${m.descricao} ${m.campanha} ${m.credito_autor ?? ""}`.toLowerCase().includes(termo)));

  return (
    <div className="pn-tela">
      <div className="pn-tela-cabeca" style={{ alignItems: "center" }}>
        <p className="pn-sobre" style={{ marginTop: 0 }}>O que for publicado aparece na página pública Materiais, com o crédito e a licença. Só envie o que o instituto fez ou tem licença para distribuir.</p>
        <Botao variante="principal" simbolo={Plus} onClick={() => setForm({ ...novo })}>
          Novo material
        </Botao>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Busca rotulo="Buscar" rotuloVisivel valor={busca} aoMudar={setBusca} />
        <Selecao rotulo="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos</option>
          {Object.entries(tiposDeMaterial).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </Selecao>
        <Selecao rotulo="Campanha" value={campanha} onChange={(e) => setCampanha(e.target.value)}>
          <option value="">Todas</option>
          {campanhas.map((c) => <option key={c} value={c}>{c}</option>)}
        </Selecao>
        <Selecao rotulo="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos</option>
          {Object.entries(estados).map(([v, n]) => <option key={v} value={v}>{n} ({itens.filter((m) => (m.estado ?? "rascunho") === v).length})</option>)}
        </Selecao>
      </div>
      {lista.erro && (
        <Faixa tom="erro" acao={<Botao pequeno onClick={lista.recarregar}>Tentar de novo</Botao>}>
          {lista.erro}
        </Faixa>
      )}
      {acao.aviso && <Faixa tom="info">{acao.aviso}</Faixa>}

      {lista.dados === null && !lista.erro ? (
        <Esqueleto forma="cartoes" linhas={3} />
      ) : lista.dados && itens.length === 0 ? (
        <Vazio
          simbolo={FolderOpen}
          titulo="Nenhum material ainda."
          acao={
            <Botao onClick={() => setForm({ ...novo })} simbolo={Plus}>
              Cadastrar o primeiro
            </Botao>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {vistos.map((m) => (
            <li key={m.id} className="min-w-0">
              <Cartao as="article" className="flex h-full flex-col overflow-hidden" style={{ padding: 0 }} aria-label={m.titulo}>
                <Miniatura m={m} />
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <p className="pn-rotulo-mono">{tiposDeMaterial[m.tipo] ?? m.tipo}{m.campanha && ` · ${m.campanha}`}</p>
                  <p className="pn-cartao-titulo" style={{ margin: 0 }}>{m.titulo}</p>
                  <p className="flex flex-wrap gap-1">
                    <Selo tom={tomDoEstado[m.estado ?? "rascunho"] ?? "neutro"}>{estados[m.estado ?? "rascunho"]}</Selo>
                    {m.candidatura && <Selo tom="bordo">apoio a candidatura</Selo>}
                    {!m.credito_autor && <Selo tom="aviso">falta o crédito</Selo>}
                    {m.arquivo_status === "pendente" && <Selo>arquivo esperando aprovação</Selo>}
                  </p>
                  {m.credito_autor && <p className="pn-ajuda">{m.credito_autor} · {licencas[m.licenca ?? ""]?.split(" (")[0] ?? m.licenca}</p>}
                  <p className="mt-auto flex flex-wrap items-center gap-1 pt-2">
                    <Botao pequeno onClick={() => setForm({ ...novo, ...m, arquivo: m.arquivo ?? "", credito_autor: m.credito_autor ?? "", credito_origem: m.credito_origem ?? "", licenca: m.licenca || "cc-by-sa", candidatura: Boolean(m.candidatura), candidatura_responsavel: m.candidatura_responsavel ?? "" })}>Abrir</Botao>
                    {m.url && <a href={m.url} target="_blank" rel="noopener noreferrer" className="pn-botao pn-botao-discreto pn-botao-pequeno"><ExternalLink aria-hidden />Ver o arquivo</a>}
                    <Botao pequeno variante="discreto" perigo simbolo={Trash2} onClick={async () => { if ((await confirmarFrase(`Remover “${m.titulo}”?`))) void acao.agir("material_remover", { p_id: m.id }, "Material removido."); }}>Remover</Botao>
                  </p>
                </div>
              </Cartao>
            </li>
          ))}
        </ul>
      )}
      {lista.dados && itens.length > 0 && vistos.length === 0 && <p className="pn-ajuda">Nada com esses filtros.</p>}

      {form && <FormularioDoMaterial form={form} setForm={setForm} publica={publica} depois={() => { lista.recarregar(); }} fechar={() => setForm(null)} />}

      <Arquivos me={me} />
      {publica && (
        <Faixa tom="info" acao={<PublicarAgora pequeno />}>
          Material ou arquivo aprovado vai ao site na próxima rotina de publicação.
        </Faixa>
      )}
    </div>
  );
}

function FormularioDoMaterial({ form, setForm, publica, depois, fechar }: { form: Form; setForm: (f: Form) => void; publica: boolean; depois: () => void; fechar: () => void }) {
  const acao = useAcao(depois);
  const [modo, setModo] = useState<"arquivo" | "endereco">(form.url.startsWith("https://") && !form.arquivo ? "endereco" : "arquivo");
  const [previa, setPrevia] = useState<{ url: string; pdf: boolean } | null>(null);
  const [enviando, setEnviando] = useState("");
  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa.url); }, [previa]);
  const faltas = [!form.credito_autor.trim() && "quem fez", !form.credito_origem.trim() && "de onde veio", !form.licenca && "a licença"].filter(Boolean) as string[];
  const faltasCandidatura = form.candidatura ? [form.candidatura_responsavel.trim().length < 5 && "quem responde pelo material", !form.candidatura_sem_impulsionamento && "a confirmação de que não há impulsionamento pago"].filter(Boolean) as string[] : [];

  async function enviar(arquivo: File) {
    setEnviando("Preparando e enviando…");
    try {
      const pdf = arquivo.type === "application/pdf";
      const pronto = pdf ? { blob: arquivo as Blob, extension: "pdf" as const } : await cleanImage(arquivo);
      const caminho = await sendFile(pronto.blob, pronto.extension);
      const r = await rpc<{ id: string }>("arquivo_registrar", { p_caminho: caminho, p_nome: (form.titulo || "Material").slice(0, 120).padEnd(3, ".") });
      setPrevia({ url: URL.createObjectURL(pronto.blob), pdf });
      setForm({ ...form, arquivo: r.id, url: "" });
      setEnviando("Arquivo enviado ✓ Ele passa pelo apoio da equipe e pela aprovação da coordenação; publicado, o endereço /arquivos/… entra sozinho no material.");
    } catch (erro) {
      setEnviando(erro instanceof UploadError ? (uploadMessages[erro.message] ?? uploadMessages.envio) : textoDoErro(erro));
    }
  }

  // A janela do material: Radix Dialog por baixo (foco preso, Esc fecha, véu), larga para caber o formulário.
  return (
    <Dialogo aberto aoMudar={(a) => { if (!a) fechar(); }} titulo={form.id ? "Corrigir material" : "Novo material"} largo>
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await acao.agir("material_salvar", { p: { ...form, id: form.id || null, arquivo: form.arquivo || null } }, form.publicado && publica ? "Material no ar ✓" : "Salvo ✓");
          if (r) fechar();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Selecao rotulo="Tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>{Object.entries(tiposDeMaterial).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</Selecao>
          <Campo rotulo="Campanha ou tema (opcional)" value={form.campanha} onChange={(e) => setForm({ ...form, campanha: e.target.value })} maxLength={80} />
          <div className="sm:col-span-2"><Campo rotulo="Título" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required minLength={3} maxLength={120} /></div>
          <div className="sm:col-span-2"><Area rotulo="Descrição (formato, tamanho de impressão)" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} maxLength={600} /></div>
        </div>

        <fieldset className="pn-cartao pn-cartao-plano grid gap-3">
          <legend className="pn-rotulo-mono px-1">O arquivo</legend>
          <div className="pn-barra-ferramentas" role="group" aria-label="Como trazer o arquivo">
            <Botao pequeno variante={modo === "arquivo" ? "padrao" : "discreto"} aria-pressed={modo === "arquivo"} onClick={() => setModo("arquivo")}>Enviar daqui</Botao>
            <Botao pequeno variante={modo === "endereco" ? "padrao" : "discreto"} aria-pressed={modo === "endereco"} onClick={() => setModo("endereco")}>Colar um endereço https</Botao>
          </div>
          {modo === "arquivo" ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
              <CampoArquivo aceita="image/jpeg,image/png,image/webp,application/pdf" escolher={(f) => void enviar(f)} dica="JPG, PNG, WebP ou PDF, até 8 MB. Imagens são redesenhadas aqui, sem local, aparelho ou autor; PDFs são limpos na publicação." />
              <div className="pn-cartao pn-cartao-plano flex min-h-32 items-center justify-center text-center text-xs text-ink-soft" style={{ padding: "0.5rem" }}>
                {previa ? (
                  previa.pdf ? <iframe src={previa.url} title="Primeira página do PDF" className="h-48 w-full border-0" /> : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previa.url} alt="Prévia" className="max-h-48" />
                  )
                ) : form.arquivo ? "Arquivo já enviado" : form.url ? <span className="break-all font-mono">{form.url}</span> : "A prévia aparece aqui"}
              </div>
              <p className="text-sm sm:col-span-2" role="status">{enviando}</p>
              <p className="pn-ajuda sm:col-span-2">Endereço no site: {form.url || (form.arquivo ? "entra sozinho quando a publicação puser o arquivo no site" : "—")}</p>
            </div>
          ) : (
            <Campo rotulo="Endereço https de confiança" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value.trim(), arquivo: "" })} maxLength={500} placeholder="https://…" className="font-mono" />
          )}
        </fieldset>

        <fieldset className="pn-cartao pn-cartao-plano grid gap-3">
          <legend className="pn-rotulo-mono px-1">Crédito e licença (obrigatórios)</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Quem fez" value={form.credito_autor} onChange={(e) => setForm({ ...form, credito_autor: e.target.value })} maxLength={160} placeholder="Equipe de design do instituto" />
            <Campo rotulo="De onde veio" value={form.credito_origem} onChange={(e) => setForm({ ...form, credito_origem: e.target.value })} maxLength={200} placeholder="Feito pelo instituto / acervo do sindicato…" />
            <div className="sm:col-span-2"><Selecao rotulo="Licença" value={form.licenca} onChange={(e) => setForm({ ...form, licenca: e.target.value })}>{Object.entries(licencas).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</Selecao></div>
          </div>
          {faltas.length > 0 && <p className="pn-erro">Falta: {faltas.join(", ")}.</p>}
        </fieldset>

        <fieldset className="pn-cartao pn-cartao-alerta grid gap-3">
          <legend className="pn-rotulo-mono px-1">Este material é de apoio a uma candidatura?</legend>
          <div className="flex gap-4">
            <label className="pn-marca"><input type="radio" name="candidatura" checked={!form.candidatura} onChange={() => setForm({ ...form, candidatura: false })} /> <span>Não</span></label>
            <label className="pn-marca"><input type="radio" name="candidatura" checked={form.candidatura} onChange={() => setForm({ ...form, candidatura: true })} /> <span>Sim</span></label>
          </div>
          {form.candidatura && (
            <div className="grid gap-3 text-sm">
              <p>A lei eleitoral pede três coisas a material de apoio a candidatura. Se o instituto virar pessoa jurídica, o site não pode mais hospedar propaganda eleitoral.</p>
              <Campo rotulo="1. Quem responde pelo material (nome e CPF ou CNPJ, como vai impresso)" value={form.candidatura_responsavel} onChange={(e) => setForm({ ...form, candidatura_responsavel: e.target.value })} maxLength={200} />
              <Marca rotulo="2. Confirmo que não há pagamento para impulsionar este material." checked={form.candidatura_sem_impulsionamento} onChange={(e) => setForm({ ...form, candidatura_sem_impulsionamento: e.target.checked })} />
              <CampoData rotulo="3. Data da votação (no dia, nada de novidade: o painel não deixa publicar)" valor={form.candidatura_votacao} mudar={(v) => setForm({ ...form, candidatura_votacao: v })} />
              {faltasCandidatura.length > 0 && <p className="pn-erro">Falta: {faltasCandidatura.join(" e ")}.</p>}
            </div>
          )}
        </fieldset>

        {publica && (
          <label className="pn-marca">
            <input type="checkbox" checked={form.publicado} onChange={(e) => setForm({ ...form, publicado: e.target.checked })} />
            <span>Publicar na página Materiais {form.arquivo && !form.url && <span className="pn-ajuda">(só depois que o arquivo estiver no site)</span>}</span>
          </label>
        )}
        {acao.aviso && <Faixa tom="info">{acao.aviso}</Faixa>}
        <div className="pn-dialogo-acoes">
          <Botao simbolo={X} onClick={fechar}>Cancelar</Botao>
          <Botao type="submit" variante="principal" simbolo={Check} carregando={acao.ocupado} disabled={faltas.length > 0 || faltasCandidatura.length > 0 || form.titulo.trim().length < 3 || (!form.url && !form.arquivo)}>Guardar</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

interface Arquivo {
  id: string;
  caminho: string;
  nome: string;
  status: "pendente" | "aprovado" | "recusado" | "publicado";
  destino: string;
  criado_em: string;
  de: string;
  meu: boolean;
  apoios: number;
}

const situacaoDoArquivo: Record<Arquivo["status"], string> = {
  pendente: "aguardando a coordenação",
  aprovado: "aprovado: entra no site na próxima publicação",
  recusado: "não aprovado",
  publicado: "no site",
};
const tomDoArquivo: Record<Arquivo["status"], TomDoSelo> = { pendente: "aviso", aprovado: "ouro", recusado: "erro", publicado: "ok" };

/**
 * Arquivos avulsos (a imagem do aviso de abertura, uma arte para a divulgação): ficam num depósito fechado até a
 * coordenação aprovar; a publicação do site os copia para dentro do próprio site, sem dados embutidos, e o endereço final
 * (/arquivos/…) é o que se cola nos outros campos.
 */
function Arquivos({ me }: { me: Me }) {
  const lista = useLista<Arquivo[]>("arquivos_listar");
  const acao = useAcao(lista.recarregar);
  const [nome, setNome] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState("");
  const aprova = can(me, "coordenacao");

  async function enviar(arquivo: File) {
    if (nome.trim().length < 3) {
      setAviso("Diga primeiro o que é o arquivo (três letras ou mais).");
      return;
    }
    setOcupado(true);
    setAviso("Preparando e enviando…");
    try {
      const pdf = arquivo.type === "application/pdf";
      const pronto = pdf ? { blob: arquivo as Blob, extension: "pdf" as const } : await cleanImage(arquivo);
      const caminho = await sendFile(pronto.blob, pronto.extension);
      await rpc("arquivo_registrar", { p_caminho: caminho, p_nome: nome });
      setAviso("Arquivo enviado ✓ Ele aparece no Mural da equipe para os colegas apoiarem; com dois apoios, a coordenação pode aprovar.");
      setNome("");
      lista.recarregar();
    } catch (erro) {
      setAviso(erro instanceof UploadError ? (uploadMessages[erro.message] ?? uploadMessages.envio) : textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  const recado = aviso || lista.erro || acao.aviso;
  return (
    <section className="pn-tela" aria-label="Arquivos avulsos">
      <CabecalhoDeSecao titulo="Arquivos avulsos" sobre="Para arte de post, imagem do aviso de abertura e o que mais precisar de um endereço /arquivos/… sem virar material da página." />
      <div className="grid max-w-3xl gap-3 sm:grid-cols-[1fr_1fr]">
        <Campo rotulo="O que é este arquivo" value={nome} onChange={(e) => setNome(e.target.value)} minLength={3} maxLength={120} placeholder="Ex.: arte do post da greve" />
        <CampoArquivo aceita="image/jpeg,image/png,image/webp,application/pdf" escolher={(f) => void enviar(f)} desligado={ocupado} texto="Arraste o arquivo ou clique" dica="JPG, PNG, WebP ou PDF, até 8 MB" />
      </div>
      {recado && <Faixa tom={!aviso && !acao.aviso && lista.erro ? "erro" : "info"}>{recado}</Faixa>}
      {lista.dados === null && !lista.erro && <Esqueleto forma="linhas" linhas={3} />}
      {lista.dados && lista.dados.length > 0 && (
        <Lista rotulo="Arquivos avulsos">
          {lista.dados.map((arquivo) => (
            <ItemDeLista
              key={arquivo.id}
              simbolo={FileText}
              titulo={arquivo.nome}
              meta={
                <>
                  {arquivo.caminho.split(".").pop()?.toUpperCase()} · {data(arquivo.criado_em)}
                  {!arquivo.meu && arquivo.de && ` · de ${arquivo.de}`}
                  {arquivo.status === "pendente" && ` · ${arquivo.apoios} de 2 apoios da equipe`}
                  {arquivo.destino && <code className="ml-2 break-all font-mono">{arquivo.destino}</code>}
                </>
              }
              selo={<Selo tom={tomDoArquivo[arquivo.status]}>{situacaoDoArquivo[arquivo.status]}</Selo>}
              acoes={
                <>
                  {arquivo.destino && (
                    <Botao pequeno variante="discreto" simbolo={Copy} onClick={() => void navigator.clipboard?.writeText(arquivo.destino).then(() => { setCopiado(arquivo.id); window.setTimeout(() => setCopiado(""), 1500); })}>
                      {copiado === arquivo.id ? "Copiado ✓" : "Copiar o endereço"}
                    </Botao>
                  )}
                  {aprova && arquivo.status === "pendente" && (
                    <>
                      <Botao pequeno simbolo={Check} disabled={acao.ocupado} onClick={() => acao.agir("arquivo_decidir", { p_id: arquivo.id, p_aprovar: true }, "Arquivo aprovado ✓")}>Aprovar</Botao>
                      <Botao pequeno variante="discreto" perigo simbolo={X} disabled={acao.ocupado} onClick={async () => { if ((await confirmarFrase(`Recusar “${arquivo.nome}”?`))) void acao.agir("arquivo_decidir", { p_id: arquivo.id, p_aprovar: false }, "Arquivo recusado."); }}>Recusar</Botao>
                    </>
                  )}
                </>
              }
            />
          ))}
        </Lista>
      )}
      {lista.dados?.length === 0 && <Vazio simbolo={FileText} titulo="Nenhum arquivo enviado." />}
    </section>
  );
}
