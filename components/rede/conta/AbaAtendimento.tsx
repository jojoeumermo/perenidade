// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Atendimento: 112 horário de atendimento e mensagem de ausência (escolha da pessoa, no banco; quem vai escrever vê "fora do
// horário" calculado na hora) e 111 respostas rápidas (só no aparelho). AvisoDeAtendimento é a faixa que aparece no chat e no perfil.
import { useEffect, useId, useState, type FormEvent } from "react";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import { conta, type AtendimentoDe, type Prefs } from "@/lib/rede/conta/cliente";
import { foraDoHorario, horaDe } from "@/lib/rede/conta/regras";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import { EditarRespostas } from "./RespostasRapidas";
import { fraseDoErro, useCarga, useTextosDaConta, type TextosDaConta } from "./textos";

function Horario({ t, prefs, aoMudar }: { t: TextosDaConta; prefs: Prefs; aoMudar: (p: Prefs) => void }) {
  const id = useId();
  const a = prefs.atendimento;
  const [ter, setTer] = useState(!!a);
  const [dias, setDias] = useState<number[]>(a?.dias ?? [1, 2, 3, 4, 5]);
  const [de, setDe] = useState(a ? horaDe(a.de) : "09:00");
  const [ate, setAte] = useState(a ? horaDe(a.ate) : "18:00");
  const [ausencia, setAusencia] = useState(prefs.ausencia);
  const [msg, setMsg] = useState<{ texto: string; erro: boolean } | null>(null);
  const nomesDosDias = t.atendimento.diasNomes;
  async function salvar(e: FormEvent) {
    e.preventDefault();
    try {
      aoMudar(await conta.salvarAtendimento(ter ? { dias, de, ate } : null, ausencia));
      setMsg({ texto: t.comum.salvo, erro: false });
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
    }
  }
  const fora = foraDoHorario(prefs.atendimento);
  return (
    <section className="ct-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="ct-subtitulo al-cond">{t.atendimento.titulo}</h2>
      <p className="ct-miudo">{t.atendimento.sobre}</p>
      {fora !== null && <p className="ct-ok" role="status">{preencher(t.atendimento.agora, { estado: fora ? t.atendimento.fora : t.atendimento.dentro })}</p>}
      <form className="ct-form" onSubmit={salvar}>
        <label className="ct-opcao"><input type="checkbox" checked={ter} onChange={(e) => setTer(e.target.checked)} />{t.atendimento.ter}</label>
        {ter && (
          <>
            <fieldset>
              <legend>{t.atendimento.dias}</legend>
              <div className="ct-acoes">
                {nomesDosDias.map((nome, i) => (
                  <label key={nome} className="ct-opcao">
                    <input type="checkbox" checked={dias.includes(i)} onChange={(e) => setDias(e.target.checked ? [...dias, i].sort() : dias.filter((d) => d !== i))} />
                    {nome}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="ct-escolha">
              <label htmlFor={`${id}-de`}>{t.atendimento.de}<input id={`${id}-de`} type="time" value={de} onChange={(e) => setDe(e.target.value)} /></label>
              <label htmlFor={`${id}-ate`}>{t.atendimento.ate}<input id={`${id}-ate`} type="time" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
            </div>
          </>
        )}
        <label htmlFor={`${id}-aus`}>{t.atendimento.ausencia}
          <textarea id={`${id}-aus`} value={ausencia} maxLength={280} onChange={(e) => setAusencia(e.target.value)} />
        </label>
        <p className="ct-miudo">{t.atendimento.ausenciaDica}</p>
        <div className="ct-acoes"><Botao type="submit">{t.comum.salvar}</Botao></div>
        {msg && <p className={msg.erro ? "ct-erro" : "ct-ok"} role={msg.erro ? "alert" : "status"}>{msg.texto}</p>}
      </form>
    </section>
  );
}

export function AbaAtendimento({ t }: { t: TextosDaConta; lang: string }) {
  const { dado: prefs, erro, trocar } = useCarga<Prefs>("prefs", () => conta.prefs());
  return (
    <div className="ct-bloco">
      {erro && !prefs ? <p className="ct-erro" role="alert">{fraseDoErro(t, erro)}</p> : prefs ? <Horario t={t} prefs={prefs} aoMudar={trocar} /> : <p className="ct-miudo" role="status">{t.comum.carregando}</p>}
      <EditarRespostas t={t} />
    </div>
  );
}

/**
 * A faixa "fora do horário" para quem vai escrever (no chat a dois e no perfil). Só com a rota "conta" ligada e quando a outra pessoa
 * pôs horário ou mensagem; o banco calcula na hora e não guarda quem olhou.
 */
export function AvisoDeAtendimento({ lang, handle, className = "" }: { lang: string; handle: string | null | undefined; className?: string }) {
  const ligado = rotaNovaLigada("conta");
  const t = useTextosDaConta(lang);
  const [a, setA] = useState<AtendimentoDe | null>(null);
  useEffect(() => {
    if (!ligado || !handle) return;
    let vivo = true;
    conta.atendimentoDe(handle).then((x) => vivo && setA(x), () => undefined);
    return () => {
      vivo = false;
    };
  }, [ligado, handle]);
  if (!ligado || !t || !a || !a.fora) return null;
  const h = a.horario;
  return (
    <div className={`rounded-lg border border-rule px-3 py-2 text-sm ${className}`} role="note" data-atendimento>
      <p className="font-semibold">{a.tem_horario ? t.atendimento.foraAviso : a.mensagem}</p>
      {a.tem_horario && a.mensagem && <p>{a.mensagem}</p>}
      {h && <p className="opacity-80">{preencher(t.atendimento.horario, { dias: h.dias.map((d) => t.atendimento.diasNomes[d]).join(", "), de: horaDe(h.de), ate: horaDe(h.ate) })}</p>}
    </div>
  );
}
