// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { can, rpc, type Me } from "@/lib/backend";
import { cleanImage, previewFile, sendFile, UploadError, uploadMessages } from "@/lib/upload";
import { CampoArquivo, CampoData } from "./Campos";
import { Aviso, botao, botaoClaro, campo, data, elo, rotulo, textoDoErro, useAcao, useLista } from "./comum";

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
  return imagem ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imagem} alt="" loading="lazy" className="h-40 w-full bg-parchment object-contain" />
  ) : (
    <div className="flex h-40 w-full flex-col items-center justify-center bg-parchment text-ink-soft">
      <span className="font-mono text-2xl font-bold">{m.url.startsWith("https://") ? "↗" : ext || "?"}</span>
      <span className="text-xs">{m.url.startsWith("https://") ? "endereço externo" : ext === "PDF" ? "PDF" : "sem prévia"}</span>
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={botao} onClick={() => setForm({ ...novo })}>＋ Novo material</button>
        <p className="max-w-2xl text-sm text-ink-soft">O que for publicado aparece na página pública Materiais, com o crédito e a licença. Só envie o que o instituto fez ou tem licença para distribuir.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm">Buscar<input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} className={campo} /></label>
        <label className="block text-sm">Tipo<select value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}><option value="">Todos</option>{Object.entries(tiposDeMaterial).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
        <label className="block text-sm">Campanha<select value={campanha} onChange={(e) => setCampanha(e.target.value)} className={campo}><option value="">Todas</option>{campanhas.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
        <label className="block text-sm">Estado<select value={estado} onChange={(e) => setEstado(e.target.value)} className={campo}><option value="">Todos</option>{Object.entries(estados).map(([v, n]) => <option key={v} value={v}>{n} ({itens.filter((m) => (m.estado ?? "rascunho") === v).length})</option>)}</select></label>
      </div>
      <Aviso texto={lista.erro || acao.aviso} />

      {lista.dados && itens.length === 0 ? (
        <div className="border border-rule bg-parchment-deep px-4 py-8 text-center">
          <p className="text-ink-soft">Nenhum material ainda.</p>
          <button type="button" className={`mt-2 ${botao}`} onClick={() => setForm({ ...novo })}>Cadastrar o primeiro</button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vistos.map((m) => (
            <li key={m.id} className="painel-cartao flex flex-col overflow-hidden">
              <Miniatura m={m} />
              <div className="flex flex-1 flex-col p-3">
                <p className={rotulo}>{tiposDeMaterial[m.tipo] ?? m.tipo}{m.campanha && ` · ${m.campanha}`}</p>
                <p className="font-serif text-lg font-semibold leading-tight">{m.titulo}</p>
                <p className="mt-1 flex flex-wrap gap-1 text-xs">
                  <span className={`border px-1 ${m.estado === "publicado" ? "border-ok text-ok" : m.estado === "aprovado" ? "border-gold text-gold" : "border-rule text-ink-soft"}`}>{estados[m.estado ?? "rascunho"]}</span>
                  {m.candidatura && <span className="border border-oxblood px-1 text-oxblood">apoio a candidatura</span>}
                  {!m.credito_autor && <span className="border border-oxblood px-1 text-oxblood">falta o crédito</span>}
                  {m.arquivo_status === "pendente" && <span className="border border-rule px-1 text-ink-soft">arquivo esperando aprovação</span>}
                </p>
                {m.credito_autor && <p className="mt-1 text-xs text-ink-soft">{m.credito_autor} · {licencas[m.licenca ?? ""]?.split(" (")[0] ?? m.licenca}</p>}
                <p className="mt-auto flex gap-4 pt-2 text-sm">
                  <button type="button" className={elo} onClick={() => setForm({ ...novo, ...m, arquivo: m.arquivo ?? "", credito_autor: m.credito_autor ?? "", credito_origem: m.credito_origem ?? "", licenca: m.licenca || "cc-by-sa", candidatura: Boolean(m.candidatura), candidatura_responsavel: m.candidatura_responsavel ?? "" })}>Abrir</button>
                  {m.url && <a href={m.url} target="_blank" rel="noopener noreferrer" className={elo}>Ver o arquivo</a>}
                  <button type="button" className={`${elo} text-oxblood`} onClick={() => { if (window.confirm(`Remover “${m.titulo}”?`)) void acao.agir("material_remover", { p_id: m.id }, "Material removido."); }}>Remover</button>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {lista.dados && itens.length > 0 && vistos.length === 0 && <p className="text-ink-soft">Nada com esses filtros.</p>}

      {form && <FormularioDoMaterial form={form} setForm={setForm} publica={publica} depois={() => { lista.recarregar(); }} fechar={() => setForm(null)} />}

      <Arquivos me={me} />
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

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={form.id ? "Corrigir material" : "Novo material"}
        className="h-full w-full max-w-3xl overflow-y-auto bg-parchment p-5 shadow-xl"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await acao.agir("material_salvar", { p: { ...form, id: form.id || null, arquivo: form.arquivo || null } }, form.publicado && publica ? "Material no ar ✓" : "Salvo ✓");
          if (r) fechar();
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl font-semibold">{form.id ? "Corrigir material" : "Novo material"}</h2>
          <button type="button" className={elo} onClick={fechar}>Fechar ✕</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">Tipo<select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={campo}>{Object.entries(tiposDeMaterial).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
          <label className="block">Campanha ou tema (opcional)<input value={form.campanha} onChange={(e) => setForm({ ...form, campanha: e.target.value })} maxLength={80} className={campo} /></label>
          <label className="block sm:col-span-2">Título<input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required minLength={3} maxLength={120} className={campo} /></label>
          <label className="block sm:col-span-2">Descrição (formato, tamanho de impressão)<textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} maxLength={600} className={campo} /></label>
        </div>

        <fieldset className="mt-4 border border-rule p-3">
          <legend className="px-1 font-semibold">O arquivo</legend>
          <div className="flex gap-2 text-sm" role="group" aria-label="Como trazer o arquivo">
            <button type="button" aria-pressed={modo === "arquivo"} onClick={() => setModo("arquivo")} className={`cursor-pointer border px-2 py-1 ${modo === "arquivo" ? "border-ink bg-ink text-parchment" : "border-rule"}`}>Enviar daqui</button>
            <button type="button" aria-pressed={modo === "endereco"} onClick={() => setModo("endereco")} className={`cursor-pointer border px-2 py-1 ${modo === "endereco" ? "border-ink bg-ink text-parchment" : "border-rule"}`}>Colar um endereço https</button>
          </div>
          {modo === "arquivo" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_12rem]">
              <CampoArquivo aceita="image/jpeg,image/png,image/webp,application/pdf" escolher={(f) => void enviar(f)} dica="JPG, PNG, WebP ou PDF, até 8 MB. Imagens são redesenhadas aqui, sem local, aparelho ou autor; PDFs são limpos na publicação." />
              <div className="flex min-h-32 items-center justify-center border border-rule bg-parchment-deep text-center text-xs text-ink-soft">
                {previa ? (
                  previa.pdf ? <iframe src={previa.url} title="Primeira página do PDF" className="h-48 w-full border-0" /> : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previa.url} alt="Prévia" className="max-h-48" />
                  )
                ) : form.arquivo ? "Arquivo já enviado" : form.url ? <span className="break-all font-mono">{form.url}</span> : "A prévia aparece aqui"}
              </div>
              <p className="text-sm sm:col-span-2" role="status">{enviando}</p>
              <p className="text-xs text-ink-soft sm:col-span-2">Endereço no site: {form.url || (form.arquivo ? "entra sozinho quando a publicação puser o arquivo no site" : "—")}</p>
            </div>
          ) : (
            <label className="mt-3 block">Endereço https de confiança<input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value.trim(), arquivo: "" })} maxLength={500} placeholder="https://…" className={`${campo} font-mono`} /></label>
          )}
        </fieldset>

        <fieldset className="mt-4 border border-rule p-3">
          <legend className="px-1 font-semibold">Crédito e licença (obrigatórios)</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">Quem fez<input value={form.credito_autor} onChange={(e) => setForm({ ...form, credito_autor: e.target.value })} maxLength={160} placeholder="Equipe de design do instituto" className={campo} /></label>
            <label className="block">De onde veio<input value={form.credito_origem} onChange={(e) => setForm({ ...form, credito_origem: e.target.value })} maxLength={200} placeholder="Feito pelo instituto / acervo do sindicato…" className={campo} /></label>
            <label className="block sm:col-span-2">Licença<select value={form.licenca} onChange={(e) => setForm({ ...form, licenca: e.target.value })} className={campo}>{Object.entries(licencas).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
          </div>
          {faltas.length > 0 && <p className="mt-2 text-sm text-oxblood">Falta: {faltas.join(", ")}.</p>}
        </fieldset>

        <fieldset className="mt-4 border-2 border-oxblood bg-parchment-deep p-4">
          <legend className="px-1 font-semibold">Este material é de apoio a uma candidatura?</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2"><input type="radio" name="candidatura" checked={!form.candidatura} onChange={() => setForm({ ...form, candidatura: false })} /> Não</label>
            <label className="flex items-center gap-2"><input type="radio" name="candidatura" checked={form.candidatura} onChange={() => setForm({ ...form, candidatura: true })} /> Sim</label>
          </div>
          {form.candidatura && (
            <div className="mt-3 space-y-3 text-sm">
              <p>A lei eleitoral pede três coisas a material de apoio a candidatura. Se o instituto virar pessoa jurídica, o site não pode mais hospedar propaganda eleitoral.</p>
              <label className="block">1. Quem responde pelo material (nome e CPF ou CNPJ, como vai impresso)<input value={form.candidatura_responsavel} onChange={(e) => setForm({ ...form, candidatura_responsavel: e.target.value })} maxLength={200} className={campo} /></label>
              <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={form.candidatura_sem_impulsionamento} onChange={(e) => setForm({ ...form, candidatura_sem_impulsionamento: e.target.checked })} /> <span>2. Confirmo que não há pagamento para impulsionar este material.</span></label>
              <CampoData rotulo="3. Data da votação (no dia, nada de novidade: o painel não deixa publicar)" valor={form.candidatura_votacao} mudar={(v) => setForm({ ...form, candidatura_votacao: v })} />
              {faltasCandidatura.length > 0 && <p className="text-oxblood">Falta: {faltasCandidatura.join(" e ")}.</p>}
            </div>
          )}
        </fieldset>

        {publica && (
          <label className="mt-4 flex items-center gap-2">
            <input type="checkbox" checked={form.publicado} onChange={(e) => setForm({ ...form, publicado: e.target.checked })} className="h-4 w-4" />
            Publicar na página Materiais {form.arquivo && !form.url && <span className="text-xs text-ink-soft">(só depois que o arquivo estiver no site)</span>}
          </label>
        )}
        <p className="mt-4 flex gap-3">
          <button type="submit" className={botao} disabled={acao.ocupado || faltas.length > 0 || faltasCandidatura.length > 0 || form.titulo.trim().length < 3 || (!form.url && !form.arquivo)}>Guardar</button>
          <button type="button" className={botaoClaro} onClick={fechar}>Cancelar</button>
        </p>
        <Aviso texto={acao.aviso} />
      </form>
    </div>
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

  return (
    <section className="border-t border-rule pt-6">
      <h2 className="font-serif text-2xl font-semibold">Arquivos avulsos</h2>
      <p className="mt-1 max-w-3xl text-ink-soft">Para arte de post, imagem do aviso de abertura e o que mais precisar de um endereço /arquivos/… sem virar material da página.</p>
      <div className="mt-3 grid max-w-3xl gap-3 sm:grid-cols-[1fr_1fr]">
        <label className="block">O que é este arquivo<input value={nome} onChange={(e) => setNome(e.target.value)} minLength={3} maxLength={120} placeholder="Ex.: arte do post da greve" className={campo} /></label>
        <CampoArquivo aceita="image/jpeg,image/png,image/webp,application/pdf" escolher={(f) => void enviar(f)} desligado={ocupado} texto="Arraste o arquivo ou clique" dica="JPG, PNG, WebP ou PDF, até 8 MB" />
      </div>
      <Aviso texto={aviso || lista.erro || acao.aviso} />
      <ul className="mt-2 divide-y divide-rule border-y border-rule">
        {lista.dados?.map((arquivo) => (
          <li key={arquivo.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
            <span>
              <strong>{arquivo.nome}</strong>{" "}
              <span className="text-sm text-ink-soft">
                · {arquivo.caminho.split(".").pop()?.toUpperCase()} · {data(arquivo.criado_em)}
                {!arquivo.meu && arquivo.de && ` · de ${arquivo.de}`} · {situacaoDoArquivo[arquivo.status]}
                {arquivo.status === "pendente" && ` · ${arquivo.apoios} de 2 apoios da equipe`}
              </span>
              {arquivo.destino && <code className="ml-2 break-all font-mono text-xs">{arquivo.destino}</code>}
            </span>
            <span className="flex gap-3 text-sm">
              {arquivo.destino && <button type="button" className={elo} onClick={() => void navigator.clipboard?.writeText(arquivo.destino).then(() => { setCopiado(arquivo.id); window.setTimeout(() => setCopiado(""), 1500); })}>{copiado === arquivo.id ? "Copiado ✓" : "Copiar o endereço"}</button>}
              {aprova && arquivo.status === "pendente" && (
                <>
                  <button type="button" className={elo} disabled={acao.ocupado} onClick={() => acao.agir("arquivo_decidir", { p_id: arquivo.id, p_aprovar: true }, "Arquivo aprovado ✓")}>Aprovar</button>
                  <button type="button" className={elo} disabled={acao.ocupado} onClick={() => { if (window.confirm(`Recusar “${arquivo.nome}”?`)) void acao.agir("arquivo_decidir", { p_id: arquivo.id, p_aprovar: false }, "Arquivo recusado."); }}>Recusar</button>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
      {lista.dados?.length === 0 && <p className="text-ink-soft">Nenhum arquivo enviado.</p>}
    </section>
  );
}
