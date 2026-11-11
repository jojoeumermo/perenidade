// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { redePub } from "@/lib/rede/cliente-publicar";
import { preencher } from "@/lib/rede/preencher";
import { chaveDoAviso, LIMITE_DO_AVISO, SUGESTOES_DE_AVISO } from "@/lib/rede/publicar/b1";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Post } from "@/lib/rede/tipos";
import type { CitarQuem, CorrecaoDoPost } from "@/lib/rede/tipos-publicar";
import { codigoDoErro, textoDoErro } from "../../erros";
import { apagarDoDeposito } from "../api";
import { invalidar } from "../detalhes";
import { Icone } from "./icones";
import type { TextosAlumia2 } from "./textos";

/**
 * Corrigir depois de publicar (rede_pub_corrigir), sem mexer no texto (o texto tem o editor com histórico): o aviso de conteúdo, a
 * descrição de cada imagem, TIRAR uma imagem que mostra quem não devia aparecer (um rosto, uma placa) e quem pode citar. São as
 * correções de segurança mais comuns. O arquivo tirado é apagado do depósito na hora (LGPD art. 16: eliminação quando não há mais
 * finalidade). Depois dos 15 minutos o post ganha "editado", como no editor de texto.
 */
export function CorrigirDoPost({ post, t, s, citarQuem, aoSalvar, aoFechar }: { post: Post; t: TextosAlumia2; s: TextosDaRede; citarQuem?: CitarQuem; aoSalvar: (p: Post) => void; aoFechar: () => void }) {
  const [aviso, setAviso] = useState(post.aviso ?? "");
  const [alts, setAlts] = useState<Record<string, string>>(() => Object.fromEntries(post.midia.map((m) => [m.id, m.alt ?? ""])));
  const [tirar, setTirar] = useState<string[]>([]);
  const [cita, setCita] = useState<CitarQuem | undefined>(citarQuem);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const b = t.b1;
  const deErro = b.erros as Record<string, string>;

  async function salvar() {
    setOcupado(true);
    setErro("");
    const campos: CorrecaoDoPost = {};
    if (aviso.trim() !== (post.aviso ?? "").trim()) campos.aviso = aviso.trim();
    const mudados = post.midia.filter((m) => !tirar.includes(m.id) && (alts[m.id] ?? "").trim() !== (m.alt ?? "").trim()).map((m) => ({ id: m.id, alt: (alts[m.id] ?? "").trim() }));
    if (mudados.length) campos.alts = mudados;
    if (tirar.length) campos.tirar = tirar;
    if (cita && cita !== citarQuem && !post.resposta_a) campos.citar_quem = cita;
    try {
      if (Object.keys(campos).length) {
        const r = await redePub.corrigir(post.id, campos);
        void apagarDoDeposito(Array.isArray(r.tirados) ? r.tirados : []).catch(() => undefined);
        invalidar(post.id);
        aoSalvar(r.post);
      }
      aoFechar();
    } catch (e) {
      const c = codigoDoErro(e);
      setErro(deErro[c] ?? textoDoErro(s, e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="al2-caixa-b1 space-y-3" role="group" aria-labelledby={`corrigir-${post.id}`}>
      <div>
        <p id={`corrigir-${post.id}`} className="font-extrabold">
          {b.corrigirTitulo}
        </p>
        <p className="text-xs text-[var(--al-texto-3)]">{b.corrigirAjuda}</p>
      </div>
      <label className="block">
        <span className="al2-rotulo">{b.aviso}</span>
        <input className="al2-campo min-h-11" placeholder={b.avisoCampo} maxLength={LIMITE_DO_AVISO} value={aviso} onChange={(e) => setAviso(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={b.aviso}>
        {SUGESTOES_DE_AVISO.map((k) => {
          const texto = b.sugestoes[k];
          const sim = chaveDoAviso(aviso) === chaveDoAviso(texto);
          return (
            <button key={k} type="button" className="al2-chip al2-chip-p" aria-pressed={sim} onClick={() => setAviso(sim ? "" : texto)}>
              {texto}
            </button>
          );
        })}
      </div>
      {post.midia.length > 0 && (
        <ol className="space-y-2">
          {post.midia.map((m, n) => {
            const tirada = tirar.includes(m.id);
            return (
              <li key={m.id} className={`rounded-xl border border-[var(--al-superficie-2)] p-2 ${tirada ? "opacity-60" : ""}`}>
                <label className="block">
                  <span className="al2-rotulo">{preencher(t.b1.altVer, { n: n + 1 })}</span>
                  <textarea
                    className="al2-campo min-h-16 resize-y text-sm"
                    rows={2}
                    maxLength={1000}
                    value={alts[m.id] ?? ""}
                    disabled={tirada}
                    onChange={(e) => setAlts((a) => ({ ...a, [m.id]: e.target.value }))}
                  />
                </label>
                <button
                  type="button"
                  className="al2-acao mt-1 text-sm"
                  aria-pressed={tirada}
                  onClick={() => {
                    if (!tirada && !window.confirm(preencher(b.tirarConfirmar, { n: n + 1 }))) return;
                    setTirar((l) => (tirada ? l.filter((x) => x !== m.id) : [...l, m.id]));
                  }}
                >
                  <Icone nome={tirada ? "desfazer" : "fechar"} className="h-4 w-4" />
                  {tirada ? preencher(b.voltarImagem, { n: n + 1 }) : preencher(b.tirarImagem, { n: n + 1 })}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {!post.resposta_a && citarQuem && (
        <label className="block">
          <span className="al2-rotulo">{b.quemCita}</span>
          <select className="al2-campo min-h-11" value={cita} onChange={(e) => setCita(e.target.value as CitarQuem)}>
            <option value="ninguem">{b.citaNinguem}</option>
            <option value="seguindo">{b.citaSeguindo}</option>
            <option value="todos">{b.citaTodos}</option>
          </select>
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="al-botao al-botao-primario al-botao-p" disabled={ocupado} onClick={() => void salvar()}>
          {ocupado ? b.carregando : b.salvar}
        </button>
        <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled={ocupado} onClick={aoFechar}>
          {b.cancelar}
        </button>
      </div>
      <div aria-live="polite">{erro && <p role="alert" className="text-sm text-[var(--oxblood)]">{erro}</p>}</div>
    </div>
  );
}
