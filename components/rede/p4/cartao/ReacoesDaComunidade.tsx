// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Prompt 4, item 30: no alto da página da comunidade (encaixe altoDaComunidade), SÓ para a mediação, a lista de emojis das reações
// dos posts daqui (até 6) ou a volta à lista padrão. Quem não é da mediação não vê nada. O banco confere de novo (só a mediação, só
// emoji, sem repetir, até 6) e nunca diz quem reagiu nem quem da mediação mudou a lista.
import { useEffect, useId, useState } from "react";
import type { ContextoDoEncaixe } from "../../encaixes";
import { clienteDoCartao, type ReacoesDaComunidade as Lista } from "@/lib/rede/p4/cartao/cliente";
import { conferirLista, separarEmojis, type ProblemaDaLista } from "@/lib/rede/p4/cartao/regras";
import { esquecerReacoesDaComunidade, pedirReacoesDaComunidade, useTextosDoCartaoP4 } from "./usar";
import "./cartao.css";

export default function ReacoesDaComunidade({ lang, situacao, slug }: ContextoDoEncaixe & { slug: string }) {
  const t = useTextosDoCartaoP4(lang);
  const id = useId();
  const [dados, setDados] = useState<Lista | null>(null);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const logado = situacao.logado && !situacao.suspenso;

  useEffect(() => {
    if (!logado) return;
    let vivo = true;
    void pedirReacoesDaComunidade(slug).then((r) => {
      if (!vivo || !r) return;
      setDados(r);
      setTexto(r.propria ? r.emojis.join(" ") : "");
    });
    return () => {
      vivo = false;
    };
  }, [slug, logado]);

  if (!t || !dados?.pode_mudar) return null;
  const lista = separarEmojis(texto);
  const problema: ProblemaDaLista | null = conferirLista(lista);

  async function salvar(emojis: string[]) {
    if (!t) return;
    setOcupado(true);
    setAviso(null);
    try {
      const r = await clienteDoCartao.mudarReacoes(slug, emojis);
      esquecerReacoesDaComunidade(slug);
      const novo = await pedirReacoesDaComunidade(slug);
      if (novo) setDados(novo);
      setTexto(r.propria ? r.emojis.join(" ") : "");
      setAviso({ tipo: "ok", texto: r.propria ? t.reacoes.salvo : t.reacoes.voltou });
    } catch (e) {
      const msg = String((e as Error)?.message ?? "");
      const chave = (["muitos", "emoji", "repetido"] as const).find((k) => msg.includes(`invalido:${k}`));
      setAviso({ tipo: "erro", texto: chave ? t.reacoes.erros[chave] : t.reacoes.erros.geral });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <details className="p4c-bloco" data-p4c="reacoes">
      <summary>{t.reacoes.titulo}</summary>
      <p className="p4c-nota">{t.reacoes.ajuda}</p>
      <p className="p4c-nota">
        <strong>{dados.propria ? t.reacoes.propria : t.reacoes.daAlumia}:</strong> <span aria-hidden>{dados.emojis.join(" ")}</span>
      </p>
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!problema && lista.length > 0) void salvar(lista);
        }}
      >
        <label className="p4c-campo" htmlFor={`${id}-e`}>
          {t.reacoes.rotulo}
          <input
            id={`${id}-e`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            aria-invalid={problema && problema !== "vazia" ? true : undefined}
            aria-describedby={`${id}-p`}
          />
        </label>
        <div id={`${id}-p`}>
          {problema && problema !== "vazia" ? (
            <p className="p4c-erro" role="alert">{t.reacoes.erros[problema]}</p>
          ) : lista.length > 0 ? (
            <>
              <p className="p4c-nota">{t.reacoes.previa}</p>
              <ul className="p4c-amostra">
                {lista.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
        <p className="p4c-nota">{t.reacoes.sairam}</p>
        <div className="p4c-acoes">
          <button type="submit" className="al-botao al-botao-primario al-botao-m" disabled={ocupado || Boolean(problema) || lista.length === 0}>
            {t.reacoes.salvar}
          </button>
          {dados.propria ? (
            <button type="button" className="al-botao al-botao-contorno al-botao-m" disabled={ocupado} onClick={() => void salvar([])}>
              {t.reacoes.padrao}
            </button>
          ) : null}
        </div>
      </form>
      {aviso ? (
        <p className={aviso.tipo === "ok" ? "p4c-nota" : "p4c-erro"} role={aviso.tipo === "ok" ? "status" : "alert"}>
          {aviso.texto}
        </p>
      ) : null}
    </details>
  );
}
