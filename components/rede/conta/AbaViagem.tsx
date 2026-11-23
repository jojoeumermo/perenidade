// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 109. Modo viagem: as conversas escolhidas somem da lista do chat até o código (lib/rede/conta/cofres.ts). A tela é A MESMA com o
// modo ligado ou desligado: sempre o formulário de esconder e o de mostrar de novo, e a mesma resposta ("Pronto.") em qualquer caso,
// para quem olha por cima do ombro não saber se há algo escondido. Nada vai ao servidor.
import { useEffect, useId, useState, type FormEvent } from "react";
import { chat } from "@/lib/rede/cliente-chat";
import type { ConversaDoChat } from "@/lib/rede/cliente-chat";
import { desligarViagem, escondidasPelaViagem, garantirViagem, ligarViagem, MARCAS_DA_VIAGEM } from "@/lib/rede/conta/cofres";
import { Botao } from "../ui/Botao";
import { fraseDoErro, guarda, type TextosDaConta } from "./textos";

export function AbaViagem({ t }: { t: TextosDaConta; lang: string }) {
  const id = useId();
  const [conversas, setConversas] = useState<ConversaDoChat[] | null>(null);
  const [escondidas, setEscondidas] = useState<Set<string>>(new Set());
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [codigo, setCodigo] = useState("");
  const [codigo2, setCodigo2] = useState("");
  const [msg, setMsg] = useState<{ texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    garantirViagem(guarda);
    let vivo = true;
    chat.conversas().then(
      async (l) => {
        const lista = l.filter((c) => c.situacao === "aberta");
        const esc = await escondidasPelaViagem(guarda, lista.map((c) => c.id));
        if (vivo) {
          setConversas(lista);
          setEscondidas(esc);
        }
      },
      () => vivo && setConversas([]),
    );
    return () => {
      vivo = false;
    };
  }, []);
  // As escondidas não aparecem na lista de escolher: a tela fica igual à de quem não ligou.
  const visiveis = (conversas ?? []).filter((c) => !escondidas.has(c.id));

  async function ligar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setMsg({ texto: t.viagem.trabalhando, erro: false });
    try {
      await ligarViagem(guarda, codigo, escolhidas);
      setEscondidas(new Set(escolhidas));
      setEscolhidas([]);
      setMsg({ texto: t.viagem.ligado, erro: false });
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
    } finally {
      setCodigo("");
      setOcupado(false);
    }
  }
  async function desligar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setMsg({ texto: t.viagem.trabalhando, erro: false });
    try {
      const ok = await desligarViagem(guarda, codigo2);
      if (ok) setEscondidas(new Set());
      setMsg(ok ? { texto: t.viagem.desligado, erro: false } : { texto: t.viagem.errado, erro: true });
    } finally {
      setCodigo2("");
      setOcupado(false);
    }
  }
  return (
    <section className="ct-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="ct-subtitulo al-cond">{t.viagem.titulo}</h2>
      <p className="ct-miudo">{t.viagem.sobre}</p>
      <form className="ct-form" onSubmit={(e) => void ligar(e)}>
        <fieldset>
          <legend>{t.viagem.escolher}</legend>
          {conversas === null && <p className="ct-miudo" role="status">{t.comum.carregando}</p>}
          {conversas !== null && visiveis.length === 0 && <p className="ct-miudo">{t.viagem.semChat}</p>}
          {visiveis.map((c) => (
            <label key={c.id} className="ct-opcao">
              <input type="checkbox" checked={escolhidas.includes(c.id)} disabled={!escolhidas.includes(c.id) && escolhidas.length >= MARCAS_DA_VIAGEM}
                onChange={(e) => setEscolhidas(e.target.checked ? [...escolhidas, c.id] : escolhidas.filter((x) => x !== c.id))} />
              {c.com.codinome}
            </label>
          ))}
        </fieldset>
        <label htmlFor={`${id}-c`}>{t.viagem.codigo}<input id={`${id}-c`} type="password" autoComplete="off" value={codigo} onChange={(e) => setCodigo(e.target.value)} /></label>
        <div className="ct-acoes"><Botao type="submit" disabled={ocupado || codigo.length < 6 || escolhidas.length === 0}>{t.viagem.ligar}</Botao></div>
      </form>
      <form className="ct-form" onSubmit={(e) => void desligar(e)}>
        <p className="ct-etiqueta">{t.viagem.desligarTitulo}</p>
        <label htmlFor={`${id}-d`}>{t.viagem.codigo}<input id={`${id}-d`} type="password" autoComplete="off" value={codigo2} onChange={(e) => setCodigo2(e.target.value)} /></label>
        <div className="ct-acoes"><Botao type="submit" variante="contorno" disabled={ocupado || !codigo2}>{t.viagem.desligar}</Botao></div>
      </form>
      {msg && <p className={msg.erro ? "ct-erro" : "ct-ok"} role={msg.erro ? "alert" : "status"}>{msg.texto}</p>}
    </section>
  );
}
