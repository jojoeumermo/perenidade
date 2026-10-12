// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRef, useState } from "react";
import { can, rpc, type Me } from "@/lib/backend";
import { cleanImage, sendFile, UploadError, uploadMessages } from "@/lib/upload";
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
}

export const tiposDeMaterial: Record<string, string> = { zine: "Zine", panfleto: "Panfleto", cartaz: "Cartaz", banner: "Banner", video: "Vídeo", texto: "Texto" };

const novo = { id: "", tipo: "panfleto", titulo: "", descricao: "", campanha: "", url: "", publicado: false, ordem: 0 };

/** Zines, panfletos, cartazes e banners de campanha. Curadoria e design preparam; a coordenação põe no ar. */
export function Materiais({ me }: { me: Me }) {
  const publica = can(me, "coordenacao");
  const lista = useLista<Material[]>("materiais_listar");
  const acao = useAcao(lista.recarregar);
  const [form, setForm] = useState(novo);
  const mudar = (chave: keyof typeof novo) => (e: { target: { value: string } }) => setForm({ ...form, [chave]: e.target.value });

  return (
    <div className="space-y-8">
      <div className="max-w-3xl space-y-2 text-ink-soft">
        <p>
          O que aparece aqui vai para a página pública Materiais. O arquivo precisa estar no próprio site (caminho começando com /arquivos/) ou em um endereço https de confiança. Envie só o que o instituto fez ou tem licença para distribuir, e diga na descrição quem fez.
        </p>
        <p>
          Material de apoio a candidatura segue a lei eleitoral: precisa trazer o nome de quem responde por ele, não pode ser pago para impulsionar e não pode ser novidade publicada no dia da votação. Se o instituto virar pessoa jurídica, o site não pode mais hospedar propaganda eleitoral.
        </p>
      </div>

      <form
        className="max-w-3xl space-y-3 border border-rule bg-parchment-deep p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await acao.agir("material_salvar", { p: { ...form, id: form.id || null } }, form.publicado && publica ? "Material no ar." : "Material guardado como rascunho.")) setForm(novo);
        }}
      >
        <h2 className="font-serif text-2xl font-semibold">{form.id ? "Corrigir material" : "Novo material"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            Tipo
            <select value={form.tipo} onChange={mudar("tipo")} className={campo}>
              {Object.entries(tiposDeMaterial).map(([valor, nome]) => (
                <option key={valor} value={valor}>
                  {nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Campanha ou tema (opcional)
            <input value={form.campanha} onChange={mudar("campanha")} maxLength={80} className={campo} />
          </label>
        </div>
        <label className="block">
          Título
          <input value={form.titulo} onChange={mudar("titulo")} required minLength={3} maxLength={120} className={campo} />
        </label>
        <label className="block">
          Descrição (formato, tamanho de impressão, quem fez)
          <textarea value={form.descricao} onChange={mudar("descricao")} rows={2} maxLength={600} className={campo} />
        </label>
        <label className="block">
          Endereço do arquivo
          <input value={form.url} onChange={mudar("url")} required maxLength={500} placeholder="/arquivos/… ou https://…" className={campo} />
        </label>
        {publica && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.publicado} onChange={(e) => setForm({ ...form, publicado: e.target.checked })} className="h-4 w-4" />
            Publicar na página Materiais
          </label>
        )}
        <div className="flex gap-3">
          <button type="submit" className={botao} disabled={acao.ocupado}>
            Guardar
          </button>
          {form.id && (
            <button type="button" className={botaoClaro} onClick={() => setForm(novo)}>
              Cancelar
            </button>
          )}
        </div>
        <Aviso texto={acao.aviso} />
      </form>

      <Arquivos me={me} usar={(destino) => setForm({ ...form, url: destino })} />

      <section>
        <h2 className="font-serif text-2xl font-semibold">Materiais cadastrados</h2>
        <Aviso texto={lista.erro} />
        {lista.dados?.length === 0 && <p className="text-ink-soft">Nenhum material ainda.</p>}
        <ul className="mt-2 divide-y divide-rule border-y border-rule">
          {lista.dados?.map((item) => (
            <li key={item.id} className="py-3">
              <p className={rotulo}>
                {tiposDeMaterial[item.tipo] ?? item.tipo}
                {item.campanha && ` · ${item.campanha}`} · {item.publicado ? "no ar" : "rascunho"}
              </p>
              <p className="font-serif text-xl font-semibold">{item.titulo}</p>
              {item.descricao && <p>{item.descricao}</p>}
              <p className="break-all font-mono text-xs text-ink-soft">{item.url}</p>
              <p className="mt-1 flex gap-4">
                <button type="button" className={elo} onClick={() => setForm({ ...novo, ...item })}>
                  Corrigir
                </button>
                <button type="button" className={elo} onClick={() => acao.agir("material_remover", { p_id: item.id }, "Material removido.")}>
                  Remover
                </button>
              </p>
            </li>
          ))}
        </ul>
      </section>
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
 * Envio de arquivos avulsos: a imagem do aviso de abertura, um panfleto em PDF. O arquivo fica em um
 * depósito fechado até a coordenação aprovar; a publicação do site o copia para dentro do próprio site
 * (sem dados embutidos) e devolve o endereço final, que é o que se cola nos outros campos.
 */
function Arquivos({ me, usar }: { me: Me; usar: (destino: string) => void }) {
  const lista = useLista<Arquivo[]>("arquivos_listar");
  const acao = useAcao(lista.recarregar);
  const escolha = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const aprova = can(me, "coordenacao");

  async function enviar() {
    const arquivo = escolha.current?.files?.[0];
    if (!arquivo) return;
    setOcupado(true);
    setAviso("Preparando e enviando…");
    try {
      const pdf = arquivo.type === "application/pdf";
      const pronto = pdf ? { blob: arquivo as Blob, extension: "pdf" as const } : await cleanImage(arquivo);
      const caminho = await sendFile(pronto.blob, pronto.extension);
      await rpc("arquivo_registrar", { p_caminho: caminho, p_nome: nome });
      setAviso("Arquivo enviado. Ele aparece no Mural da equipe para os colegas apoiarem; com dois apoios, a coordenação pode aprovar.");
      setNome("");
      if (escolha.current) escolha.current.value = "";
      lista.recarregar();
    } catch (erro) {
      setAviso(erro instanceof UploadError ? (uploadMessages[erro.message] ?? uploadMessages.envio) : textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section>
      <h2 className="font-serif text-2xl font-semibold">Arquivos</h2>
      <p className="mt-1 max-w-3xl text-ink-soft">
        Imagens (JPG, PNG, WebP) são redesenhadas neste navegador antes de sair: local da foto, modelo do aparelho e nome do autor não vão junto. PDFs são limpos na publicação. Até 8 MB. Depois de publicado, o arquivo ganha um endereço que começa com /arquivos/.
      </p>
      <form className="mt-3 flex max-w-3xl flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
        <label className="block min-w-60 flex-1">
          O que é este arquivo
          <input value={nome} onChange={(e) => setNome(e.target.value)} required minLength={3} maxLength={120} placeholder="Ex.: panfleto da jornada de lutas, frente e verso" className={campo} />
        </label>
        <label className="block">
          Arquivo
          <input ref={escolha} type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" className={`${campo} py-1.5`} />
        </label>
        <button type="submit" className={botao} disabled={ocupado || nome.trim().length < 3}>
          Enviar
        </button>
      </form>
      <Aviso texto={aviso || lista.erro || acao.aviso} />
      <ul className="mt-2 divide-y divide-rule border-y border-rule">
        {lista.dados?.map((arquivo) => (
          <li key={arquivo.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
            <span>
              <strong>{arquivo.nome}</strong>{" "}
              <span className="text-ink-soft">
                · {arquivo.caminho.split(".").pop()?.toUpperCase()} · {data(arquivo.criado_em)}
                {!arquivo.meu && arquivo.de && ` · de ${arquivo.de}`} · {situacaoDoArquivo[arquivo.status]}
                {arquivo.status === "pendente" && ` · ${arquivo.apoios} de 2 apoios da equipe`}
              </span>
              {arquivo.destino && <code className="ml-2 break-all font-mono text-xs">{arquivo.destino}</code>}
            </span>
            <span className="flex gap-3">
              {arquivo.destino && (
                <button type="button" className={elo} onClick={() => usar(arquivo.destino)}>
                  Usar no material acima
                </button>
              )}
              {aprova && arquivo.status === "pendente" && (
                <>
                  <button type="button" className={elo} disabled={acao.ocupado} onClick={() => acao.agir("arquivo_decidir", { p_id: arquivo.id, p_aprovar: true }, "Arquivo aprovado.")}>
                    Aprovar
                  </button>
                  <button type="button" className={elo} disabled={acao.ocupado} onClick={() => acao.agir("arquivo_decidir", { p_id: arquivo.id, p_aprovar: false }, "Arquivo recusado.")}>
                    Recusar
                  </button>
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
