// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useState } from "react";
import { can, type Me } from "@/lib/backend";
import { Aviso, botao, botaoClaro, campo, elo, rotulo, useAcao, useLista } from "./comum";

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

/** Zines, panfletos, cartazes e banners de campanha. Curadoria e design preparam; a liderança põe no ar. */
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
