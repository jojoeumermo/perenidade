// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Check, ImageUp, Send, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { can, type Me, rpc } from "@/lib/backend";
import { Aviso, useAcao } from "./comum";
import { Botao, Campo, Cartao } from "./ui";

/**
 * A visão pública do educador (09/11/2026, supabase/migracoes/20261109-cartao-publico.sql): no painel, em Minha conta,
 * Faixa de e-mail, o educador pede a foto, a biografia e as redes do cartão que aparece no fim das aulas da disciplina.
 * Nada vai ao ar sem a coordenação aprovar (FilaDeCartoes, logo abaixo, só para a coordenação). A foto é reduzida no
 * navegador para 360 × 360 em WebP antes de sair do aparelho, sem os dados escondidos da câmera.
 */

const REDES = [
  ["site", "Site"],
  ["instagram", "Instagram"],
  ["youtube", "YouTube"],
  ["linkedin", "LinkedIn"],
  ["github", "GitHub"],
  ["lattes", "Lattes"],
  ["portfolio", "Portfólio"],
] as const;

type Curriculo = Partial<Record<(typeof REDES)[number][0] | "formacao", string>>;
interface Pedido {
  id: string;
  status: "pendente" | "aprovado" | "recusado";
  nota: string;
  bio: string;
  curriculo: Curriculo;
  foto: string;
}
interface Meu {
  no_ar: { bio: string; curriculo: Curriculo; foto: string };
  pedido: Pedido | null;
}

/** Reduz a foto para um quadrado de 360 px em WebP (o desenho passa pela tela, então os metadados da câmera ficam para trás). */
async function reduzir(arquivo: File): Promise<string> {
  const bitmap = await createImageBitmap(arquivo);
  const lado = Math.min(bitmap.width, bitmap.height);
  const tela = document.createElement("canvas");
  tela.width = 360;
  tela.height = 360;
  const ctx = tela.getContext("2d");
  if (!ctx) throw new Error("tela");
  ctx.drawImage(bitmap, (bitmap.width - lado) / 2, (bitmap.height - lado) / 4, lado, lado, 0, 0, 360, 360);
  for (const qualidade of [0.85, 0.7, 0.55]) {
    const url = tela.toDataURL("image/webp", qualidade);
    if (url.startsWith("data:image/webp") && url.length <= 200_000) return url;
  }
  throw new Error("grande");
}

const SITUACAO: Record<Pedido["status"], string> = {
  pendente: "Esperando a coordenação aprovar. O cartão no ar continua o de antes até lá.",
  aprovado: "Aprovado: é o cartão que aparece no site.",
  recusado: "Não aprovado.",
};

export function VisaoPublica({ me }: { me: Me }) {
  const educador = me.papeis.some((p) => p.papel === "educacao" || p.papel === "educacao_secundaria");
  const [meu, setMeu] = useState<Meu | null>(null);
  const [bio, setBio] = useState("");
  const [redes, setRedes] = useState<Curriculo>({});
  const [foto, setFoto] = useState("");
  const [tirarFoto, setTirarFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState("");
  const carregar = useCallback(() => {
    void rpc<Meu>("cartao_publico_meu")
      .then((m) => {
        setMeu(m);
        const base = m.pedido?.status === "pendente" ? m.pedido : m.no_ar;
        setBio(base.bio ?? "");
        setRedes(base.curriculo ?? {});
      })
      .catch(() => setMeu(null));
  }, []);
  useEffect(() => {
    if (educador) carregar();
  }, [educador, carregar]);
  const acao = useAcao(carregar);
  if (!educador) return null;

  const fotoVista = tirarFoto ? "" : foto || meu?.no_ar.foto || "";
  return (
    <Cartao titulo="Visão pública: o seu cartão de educador" sobre="É o cartão que aparece no fim das aulas da sua disciplina. Você pede a foto, a biografia e as redes; a coordenação aprova antes de ir ao ar.">
      <div className="grid gap-5 md:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="space-y-2">
          <div className="flex aspect-square w-40 items-center justify-center overflow-hidden rounded-xl border border-[var(--pn-borda)] bg-[var(--pn-fundo-2,#f3efe6)] text-4xl">
            {fotoVista ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoVista} alt="Prévia da foto do cartão" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden>★</span>
            )}
          </div>
          <label className="pn-botao pn-botao-pequeno inline-flex cursor-pointer items-center gap-1.5">
            <ImageUp aria-hidden width={16} height={16} /> Escolher foto
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                if (!arquivo) return;
                setErroFoto("");
                reduzir(arquivo)
                  .then((url) => {
                    setFoto(url);
                    setTirarFoto(false);
                  })
                  .catch(() => setErroFoto("Não deu para usar esta imagem. Tente outra (JPG, PNG ou WebP)."));
              }}
            />
          </label>
          {(meu?.no_ar.foto || foto) && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={tirarFoto} onChange={(e) => setTirarFoto(e.target.checked)} /> Tirar a foto do cartão
            </label>
          )}
          {erroFoto && <p className="pn-ajuda text-[var(--pn-erro,#b42318)]">{erroFoto}</p>}
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="pn-rotulo">Biografia (até 500 letras)</span>
            <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 500))} rows={4} className="pn-campo w-full" />
          </label>
          <Campo rotulo="Formação (opcional)" value={redes.formacao ?? ""} maxLength={160} onChange={(e) => setRedes({ ...redes, formacao: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            {REDES.map(([chave, nome]) => (
              <Campo key={chave} rotulo={nome} type="url" placeholder="https://" value={redes[chave] ?? ""} onChange={(e) => setRedes({ ...redes, [chave]: e.target.value.trim() })} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Botao
              variante="principal"
              simbolo={Send}
              disabled={acao.ocupado}
              onClick={() => void acao.agir("cartao_publico_pedir", { p: { bio, curriculo: redes, foto: tirarFoto ? "" : foto, tirar_foto: tirarFoto } }, "Pedido enviado. A coordenação vai olhar.")}
            >
              Pedir aprovação
            </Botao>
            {meu?.pedido && (
              <span className="pn-ajuda">
                {SITUACAO[meu.pedido.status]}
                {meu.pedido.status === "recusado" && meu.pedido.nota && ` Motivo: ${meu.pedido.nota}`}
              </span>
            )}
          </div>
          <Aviso texto={acao.aviso} />
        </div>
      </div>
    </Cartao>
  );
}

interface NaFila {
  id: string;
  nome: string;
  bio: string;
  curriculo: Curriculo;
  foto: string;
  tirar_foto: boolean;
  bio_atual: string;
  foto_atual: string;
}

/** A fila de cartões para a coordenação aprovar ou recusar (com motivo). */
export function FilaDeCartoes({ me }: { me: Me }) {
  const coordena = can(me, "coordenacao") || can(me, "vice");
  const [fila, setFila] = useState<NaFila[] | null>(null);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const carregar = useCallback(() => {
    void rpc<NaFila[]>("cartao_publico_fila")
      .then(setFila)
      .catch(() => setFila([]));
  }, []);
  useEffect(() => {
    if (coordena) carregar();
  }, [coordena, carregar]);
  const acao = useAcao(carregar);
  if (!coordena || !fila || fila.length === 0) return null;
  return (
    <Cartao titulo={`Cartões de educador para aprovar (${fila.length})`} sobre="O que cada educador pediu para o cartão público. Recusar pede um motivo, que a pessoa recebe.">
      <ul className="space-y-4">
        {fila.map((c) => (
          <li key={c.id} className="rounded-xl border border-[var(--pn-borda)] p-4">
            <div className="flex flex-wrap items-start gap-4">
              {(c.tirar_foto ? "" : c.foto || c.foto_atual) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.tirar_foto ? "" : c.foto || c.foto_atual} alt={`Foto pedida por ${c.nome}`} className="h-24 w-24 rounded-lg object-cover" />
              ) : (
                <span className="flex h-24 w-24 items-center justify-center rounded-lg border border-[var(--pn-borda)] text-2xl">★</span>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold">{c.nome}</p>
                <p className="whitespace-pre-line text-sm">{c.bio || "(sem biografia)"}</p>
                <p className="pn-ajuda break-all">{Object.entries(c.curriculo).map(([k, v]) => `${k}: ${v}`).join(" · ") || "(sem redes)"}</p>
                {c.tirar_foto && <p className="pn-ajuda">Pediu para tirar a foto do cartão.</p>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Botao variante="principal" pequeno simbolo={Check} disabled={acao.ocupado} onClick={() => void acao.agir("cartao_publico_decidir", { p_id: c.id, p_aprovar: true, p_nota: "" }, "Aprovado: o cartão já está no site.")}>
                Aprovar
              </Botao>
              <div className="min-w-[14rem] flex-1">
                <Campo rotulo="Motivo, para recusar" value={notas[c.id] ?? ""} onChange={(e) => setNotas({ ...notas, [c.id]: e.target.value })} />
              </div>
              <Botao pequeno simbolo={X} disabled={acao.ocupado || (notas[c.id] ?? "").trim().length < 5} onClick={() => void acao.agir("cartao_publico_decidir", { p_id: c.id, p_aprovar: false, p_nota: notas[c.id] ?? "" }, "Recusado. A pessoa recebeu o motivo.")}>
                Recusar
              </Botao>
            </div>
          </li>
        ))}
      </ul>
      <Aviso texto={acao.aviso} />
    </Cartao>
  );
}
