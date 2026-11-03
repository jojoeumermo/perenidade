// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill } from "@/i18n/config";
import type { TextosDaOrganizacao } from "@/i18n/escola/organizacao";
import { BackendError } from "@/lib/backend";
import { ouvidoriaEnviar } from "@/lib/escola/banco";
import {
  acrescentarProtocolo,
  ASSUNTOS,
  type AssuntoDaOuvidoria,
  assuntoValido,
  caminhoValido,
  CONTATO_MAX,
  guardarProtocolos,
  lerProtocolosGuardados,
  lerRodasGuardadas,
  mensagemDeRecusa,
  PERGUNTAS_DA_RODA,
  type PerguntaDaRoda,
  rodaDoSemestre,
  TEXTO_MAX,
  TEXTO_MIN,
  textoDaRoda,
  validarMensagem,
} from "@/lib/escola/organizacao";
import { hojeEmBrasilia, semestreDe } from "@/lib/escola/tempo";
import { esquecerRespostasPublicas } from "./guardado-organizacao";

type S = TextosDaOrganizacao["ouvidoria"];

/**
 * O formulário da ouvidoria (E4-12): sem conta, usa `ouvidoria_enviar` (E4-02). A pessoa manda de propósito o assunto, a
 * página (opcional), o texto e, só se quiser resposta particular, um contato. O protocolo fica só neste aparelho. Recusa
 * ou serviço fora do ar nunca apaga o que a pessoa escreveu. Os avisos de dados pessoais ficam acima do campo.
 * `?sobre=` e `?caminho=` só preenchem o assunto e a página: nenhum texto vai no endereço.
 */
export function FormularioDaOuvidoria({ s, roda }: { s: S; roda: TextosDaOrganizacao["roda"] }) {
  const [sobre, setSobre] = useState<AssuntoDaOuvidoria>("escola");
  const [caminho, setCaminho] = useState("");
  const [texto, setTexto] = useState("");
  const [contato, setContato] = useState("");
  const [isca, setIsca] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [nota, setNota] = useState("");
  const [feito, setFeito] = useState<{ protocolo: string; guardou: boolean } | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const q = new URLSearchParams(window.location.search);
        const a = assuntoValido(q.get("sobre"));
        if (a) setSobre(a);
        setCaminho(caminhoValido(q.get("caminho")));
      } catch {
        // sem endereço legível: fica o formulário em branco
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  function usarRoda() {
    const perguntas = Object.fromEntries(PERGUNTAS_DA_RODA.map((p) => [p, roda[p]])) as Record<PerguntaDaRoda, string>;
    const semestre = semestreDe(hojeEmBrasilia()).id;
    const r = rodaDoSemestre(lerRodasGuardadas(), semestre);
    const t = textoDaRoda(r, perguntas, fill(roda.folha, { semestre }));
    if (t === fill(roda.folha, { semestre })) return void setNota(s.semRoda);
    setTexto(t);
    setNota("");
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setNota("");
    const problema = validarMensagem({ sobre, caminho, texto, contato });
    if (problema) {
      setErro(
        problema === "texto-curto" ? fill(s.curto, { min: TEXTO_MIN })
        : problema === "texto-longo" ? fill(s.longo, { max: TEXTO_MAX })
        : problema === "contato-longo" ? fill(s.contatoLongo, { max: CONTATO_MAX })
        : problema === "caminho" ? s.caminhoInvalido
        : s.recusas.invalidoSobre,
      );
      return;
    }
    setErro("");
    setEnviando(true);
    try {
      const r = await ouvidoriaEnviar({ sobre, caminho: caminho || undefined, texto: texto.trim(), contato: contato.trim() || undefined, site: isca });
      if (r === null) setErro(s.foraDoAr);
      else if (!r.ok || !/^[0-9a-fA-F]{8}$/.test(r.protocolo)) setErro(s.recusas.generica);
      else {
        const guardou = guardarProtocolos(acrescentarProtocolo(lerProtocolosGuardados(), { protocolo: r.protocolo, sobre, em: hojeEmBrasilia() }));
        esquecerRespostasPublicas();
        setFeito({ protocolo: r.protocolo.toUpperCase(), guardou });
        setTexto("");
        setContato("");
      }
    } catch (falha) {
      setErro(mensagemDeRecusa(falha instanceof BackendError ? falha.code : "", s.recusas));
    } finally {
      setEnviando(false);
    }
  }

  if (feito)
    return (
      <div className="org-sucesso" data-ouvidoria-sucesso="" role="status">
        <p className="font-semibold">{s.sucesso}</p>
        <p className="org-protocolo" data-ouvidoria-protocolo="">
          {fill(s.anote, { protocolo: feito.protocolo })}
        </p>
        <p className="org-nota">{feito.guardou ? s.sucessoGuardou : s.sucessoNaoGuardou}</p>
        <button type="button" className="botao" onClick={() => setFeito(null)}>
          {s.outra}
        </button>
      </div>
    );

  return (
    <form onSubmit={(e) => void enviar(e)} noValidate data-ouvidoria-form="">
      <p className="org-aviso">{s.avisoDados}</p>
      <div className="org-campo">
        <label htmlFor="ouv-sobre">{s.assunto}</label>
        <select id="ouv-sobre" className="org-input" value={sobre} onChange={(e) => setSobre(e.target.value as AssuntoDaOuvidoria)}>
          {ASSUNTOS.map((a) => (
            <option key={a} value={a}>
              {s.assuntos[a]}
            </option>
          ))}
        </select>
      </div>
      {sobre === "educador" && (
        <p className="org-aviso" data-ouvidoria-aviso-educador="">
          {s.avisoEducador}
        </p>
      )}
      <div className="org-campo">
        <label htmlFor="ouv-caminho">{s.pagina}</label>
        <input id="ouv-caminho" className="org-input" type="text" inputMode="url" autoComplete="off" maxLength={200} value={caminho} onChange={(e) => setCaminho(e.target.value)} aria-describedby="ouv-caminho-ajuda" />
        <p id="ouv-caminho-ajuda" className="org-nota">
          {s.paginaAjuda}
        </p>
      </div>
      <div className="org-campo">
        <label htmlFor="ouv-texto">{s.texto}</label>
        <textarea id="ouv-texto" className="org-input" rows={7} maxLength={TEXTO_MAX} value={texto} onChange={(e) => setTexto(e.target.value)} aria-describedby="ouv-texto-conta" />
        <p id="ouv-texto-conta" className="org-nota" data-ouvidoria-contador="">
          {fill(s.contador, { n: texto.trim().length, max: TEXTO_MAX, min: TEXTO_MIN })}
        </p>
        <button type="button" className="botao" data-ouvidoria-usar-roda="" onClick={usarRoda}>
          {s.usarRoda}
        </button>
      </div>
      <div className="org-campo">
        <label htmlFor="ouv-contato">{s.contato}</label>
        <input id="ouv-contato" className="org-input" type="text" autoComplete="off" maxLength={CONTATO_MAX} value={contato} onChange={(e) => setContato(e.target.value)} />
      </div>
      {/* Campo-isca: fica vazio para gente; robô preenche. Fora da tela, fora do foco e escondido de leitor de tela. */}
      <div className="org-isca" aria-hidden="true">
        <input type="text" name="site" tabIndex={-1} autoComplete="off" value={isca} onChange={(e) => setIsca(e.target.value)} />
      </div>
      {nota && (
        <p className="org-nota" role="status">
          {nota}
        </p>
      )}
      {erro && (
        <p className="org-erro" role="alert" data-ouvidoria-erro="">
          {erro}
        </p>
      )}
      <button type="submit" className="botao" disabled={enviando} data-ouvidoria-enviar="">
        {enviando ? s.enviando : s.enviar}
      </button>
    </form>
  );
}
