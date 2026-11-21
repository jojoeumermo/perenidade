// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 104. Diário privado cifrado: só neste aparelho (lib/rede/conta/cofres.ts). Nada vai ao servidor. A chave aberta fica só na
// memória desta tela e é zerada ao fechar ou sair.
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { confirmar } from "@/components/perguntar";
import { abrirDiario, criarDiario, fecharDiario, guardarDiario, novaEntrada, temDiario, CHAVE_DO_DIARIO, MAX_LETRAS_DA_ENTRADA, type DiarioAberto } from "@/lib/rede/conta/cofres";
import { Botao } from "../ui/Botao";
import { fraseDoErro, guarda, type TextosDaConta } from "./textos";

export function AbaDiario({ t, lang }: { t: TextosDaConta; lang: string }) {
  const id = useId();
  const [existe, setExiste] = useState<boolean | null>(() => temDiario(guarda));
  const [aberto, setAberto] = useState<DiarioAberto | null>(null);
  const [senha, setSenha] = useState("");
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState<{ texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const ref = useRef<DiarioAberto | null>(null);
  useEffect(() => {
    ref.current = aberto;
  }, [aberto]);
  // Saiu da aba ou da tela: a chave some da memória.
  useEffect(() => () => fecharDiario(ref.current), []);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setMsg({ texto: t.diario.abrindo, erro: false });
    try {
      const d = existe ? await abrirDiario(guarda, senha) : await criarDiario(guarda, senha);
      if (!d) setMsg({ texto: t.diario.errada, erro: true });
      else {
        setAberto(d);
        setExiste(true);
        setMsg(null);
      }
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
    } finally {
      setSenha("");
      setOcupado(false);
    }
  }
  async function escrever(e: FormEvent) {
    e.preventDefault();
    if (!aberto) return;
    const d = novaEntrada(aberto, texto);
    await guardarDiario(guarda, d);
    setAberto(d);
    setTexto("");
  }
  function fechar() {
    fecharDiario(aberto);
    setAberto(null);
  }
  async function apagarTudo() {
    if (!(await confirmar(t.diario.apagarConfirma))) return;
    fecharDiario(aberto);
    setAberto(null);
    guarda.removeItem(CHAVE_DO_DIARIO);
    setExiste(false);
  }

  return (
    <section className="ct-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="ct-subtitulo al-cond">{t.diario.titulo}</h2>
      <p className="ct-miudo">{t.diario.sobre}</p>
      {existe !== null && !aberto && (
        <form className="ct-form" onSubmit={entrar}>
          <label htmlFor={`${id}-s`}>{existe ? t.diario.senha : t.diario.senhaNova}
            <input id={`${id}-s`} type="password" autoComplete={existe ? "current-password" : "new-password"} value={senha} onChange={(e) => setSenha(e.target.value)} minLength={existe ? 1 : 8} />
          </label>
          <div className="ct-acoes">
            <Botao type="submit" disabled={ocupado || (!existe && senha.length < 8) || !senha}>{existe ? t.diario.abrir : t.diario.criar}</Botao>
            {existe && <Botao variante="fantasma" onClick={() => void apagarTudo()}>{t.diario.apagarTudo}</Botao>}
          </div>
        </form>
      )}
      {msg && <p className={msg.erro ? "ct-erro" : "ct-ok"} role={msg.erro ? "alert" : "status"}>{msg.texto}</p>}
      {aberto && (
        <>
          <form className="ct-form" onSubmit={(e) => void escrever(e)}>
            <label htmlFor={`${id}-x`}>{t.diario.nova}<textarea id={`${id}-x`} maxLength={MAX_LETRAS_DA_ENTRADA} value={texto} onChange={(e) => setTexto(e.target.value)} /></label>
            <div className="ct-acoes">
              <Botao type="submit" disabled={!texto.trim()}>{t.diario.guardar}</Botao>
              <Botao variante="contorno" onClick={fechar}>{t.diario.fechar}</Botao>
            </div>
          </form>
          {aberto.entradas.length === 0 && <p className="ct-miudo">{t.diario.vazio}</p>}
          <ol className="ct-lista">
            {aberto.entradas.map((x) => (
              <li key={x.id} className="ct-cartao">
                <p className="ct-etiqueta"><time dateTime={x.em}>{new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(new Date(x.em))}</time></p>
                <p style={{ whiteSpace: "pre-wrap" }}>{x.texto}</p>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
