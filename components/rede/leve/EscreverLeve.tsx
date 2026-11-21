// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Escrever leve e a fila "Esperando a rede" (/alumia/leve). Com rede, o post sai na hora pela função de publicar de sempre. Sem
// rede (ou se a rede cai no meio do envio), ele vai para a fila DESTE aparelho (./regras.ts) e sai sozinho quando a rede volta,
// enquanto a Alumia estiver aberta (./NaCasca.tsx). Nada fica esperando no servidor. Só texto: foto, enquete e ato pedem o
// Escrever de sempre, que confere tudo com rede.
import { useId, useState } from "react";
import Link from "@/components/Link";
import { rede } from "@/lib/rede/cliente";
import { preencher } from "@/lib/rede/preencher";
import { previaLigada, tempoCurto } from "@/lib/rede/publicar/alumia2";
import type { TextosDaRede } from "@/lib/rede/textos";
import { enderecos, type Situacao } from "@/lib/rede/tipos";
import { Botao } from "../ui/Botao";
import { armazemDoAparelho, avisarMudanca, mandarDoAparelho, semRede, sortearId, useAgora, useComRede, useFila } from "./aparelho";
import {
  codigoDoErro, DIAS_PARA_SAIR_SOZINHO, falhaDeRede, guardarNaFila, impressaoDoPost, LIMITE_DA_FILA, LIMITE_DO_TEXTO, lembrarQueSaiu, PUBLICOS_DO_LEVE,
  situacaoDoItem, tirarDaFila, type PublicoDoLeve,
} from "./regras";
import type { TextosDoLeve } from "./textos";
import { confirmar } from "@/components/perguntar";

type Recado = { texto: string; link?: string } | null;

/** O texto do erro do servidor: o da Rede quando ela conhece o código; senão, o genérico desta frente. */
function motivoDoErro(codigo: string, s: TextosDaRede, t: TextosDoLeve): string {
  const daRede = (s.erros as Record<string, string>)[codigo];
  return daRede ?? t.erros.desconhecido;
}

export function EscreverLeve({ lang, s, situacao, t }: { lang: string; s: TextosDaRede; situacao: Situacao; t: TextosDoLeve }) {
  const id = useId();
  const e = t.escrever;
  const [texto, setTexto] = useState("");
  const [publico, setPublico] = useState<PublicoDoLeve>("membros");
  const [recado, setRecado] = useState<Recado>(null);
  const [ocupado, setOcupado] = useState(false);
  const comRede = useComRede();
  const previa = previaLigada();
  const conta = situacao.logado && situacao.membro ? (situacao.handle ?? null) : null;

  if (!conta) return <p className="lv-vazio">{e.naoMembro}</p>;

  /** Guarda na fila deste aparelho e diz o que aconteceu (inclusive quando não deu para guardar). */
  function guardar(): boolean {
    const r = guardarNaFila(armazemDoAparelho(), { conta, texto, publico }, Date.now(), sortearId);
    avisarMudanca();
    if (r.ok) {
      setRecado({ texto: r.repetido ? e.repetido : e.guardado });
      setTexto("");
      return true;
    }
    const motivo = { vazio: e.vazio, longo: preencher(e.longo, { max: LIMITE_DO_TEXTO }), cheia: preencher(e.cheia, { max: LIMITE_DA_FILA }), sem_conta: e.naoMembro, publico: e.vazio, sem_espaco: e.semEspaco }[r.motivo];
    setRecado({ texto: motivo });
    return false;
  }

  async function enviar() {
    setRecado(null);
    if (!texto.trim()) return setRecado({ texto: e.vazio });
    // Sem rede (ou na prévia, que não tem banco): direto para a fila do aparelho.
    if (previa || semRede()) {
      guardar();
      return;
    }
    setOcupado(true);
    try {
      const pedido = { tipo: "post" as const, texto: texto.trim(), publico };
      const post = await rede.publicar(pedido);
      lembrarQueSaiu(armazemDoAparelho(), await impressaoDoPost(conta as string, publico, pedido.texto), Date.now());
      setTexto("");
      setRecado({ texto: e.publicado, link: post?.id ? enderecos.post(lang, post.id) : undefined });
    } catch (erro) {
      // A rede caiu no meio: o post não se perde, vai para a fila. O servidor disse "não": a pessoa vê o motivo e o texto fica.
      if (falhaDeRede(erro, semRede())) guardar();
      else setRecado({ texto: preencher(e.naoSaiu, { motivo: motivoDoErro(codigoDoErro(erro), s, t) }) });
    } finally {
      setOcupado(false);
    }
  }

  const offline = previa || comRede === false;
  return (
    <form
      className="lv-escrever"
      onSubmit={(ev) => {
        ev.preventDefault();
        void enviar();
      }}
    >
      <label htmlFor={`${id}-texto`} className="lv-rotulo">
        {e.rotulo}
      </label>
      <textarea
        id={`${id}-texto`}
        className="lv-texto"
        value={texto}
        maxLength={LIMITE_DO_TEXTO}
        onChange={(ev) => setTexto(ev.target.value)}
        aria-describedby={`${id}-dica ${id}-contador`}
      />
      <p id={`${id}-dica`} className="lv-dica">
        {previa ? e.previa : e.soTexto}
      </p>
      <fieldset className="lv-publicos">
        <legend>{e.publico}</legend>
        {PUBLICOS_DO_LEVE.map((p) => (
          <label key={p} className="lv-escolha">
            <input type="radio" name={`${id}-publico`} value={p} checked={publico === p} onChange={() => setPublico(p)} />
            {e[p]}
          </label>
        ))}
      </fieldset>
      <div className="lv-linha-de-baixo">
        <Botao type="submit" variante="primario" disabled={ocupado}>
          {offline ? e.guardar : e.publicar}
        </Botao>
        {comRede !== null && !previa && (
          <span className="lv-rede" data-sem-rede={offline ? "" : undefined}>
            {offline ? e.semRede : e.comRede}
          </span>
        )}
        <span id={`${id}-contador`} className="lv-contador">
          {preencher(e.contador, { n: texto.length, max: LIMITE_DO_TEXTO })}
        </span>
      </div>
      <p className="lv-recado" role="status" aria-live="polite">
        {recado?.texto}{" "}
        {recado?.link ? (
          <Link href={recado.link} className="lv-link">
            {e.abrirPost}
          </Link>
        ) : null}
      </p>
    </form>
  );
}

export function FilaDoAparelho({ lang, s, situacao, t }: { lang: string; s: TextosDaRede; situacao: Situacao; t: TextosDoLeve }) {
  const fila = useFila();
  const comRede = useComRede();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const agora = useAgora();
  const conta = situacao.logado && situacao.membro ? (situacao.handle ?? null) : null;
  const f = t.fila;
  if (fila === null || agora === 0) return null;
  if (fila.length === 0) return <p className="lv-vazio">{f.vazia}</p>;

  async function enviarAgora(idDoItem: string) {
    setOcupado(idDoItem);
    try {
      await mandarDoAparelho(conta, [idDoItem]);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <>
      <ul className="lv-fila">
        {fila.map((item) => {
          const estado = situacaoDoItem(item, conta, agora);
          const nota =
            estado === "enviando" ? f.enviando
            : estado === "parado" ? preencher(f.parado, { dias: DIAS_PARA_SAIR_SOZINHO })
            : estado === "recusado" ? preencher(f.recusado, { motivo: motivoDoErro(item.erro ?? "", s, t) })
            : estado === "outra_conta" ? f.outraConta
            : null;
          return (
            <li key={item.id} className="lv-item" data-estado={estado}>
              <p className="lv-item-texto">{item.pedido.texto}</p>
              {nota ? <p className="lv-item-estado">{nota}</p> : null}
              <div className="lv-item-pe">
                <span>{preencher(f.guardado, { quando: tempoCurto(new Date(item.criado_em).toISOString(), lang, agora) })}</span>
                <span>{item.pedido.publico === "membros" ? f.publicoMembros : f.publicoSeguidores}</span>
                <span className="lv-acoes">
                  {estado !== "outra_conta" && estado !== "enviando" && comRede && !previaLigada() ? (
                    <Botao variante="contorno" tamanho="p" disabled={ocupado !== null} onClick={() => void enviarAgora(item.id)}>
                      {f.enviar}
                    </Botao>
                  ) : null}
                  {estado !== "outra_conta" ? (
                    <Botao
                      variante="fantasma"
                      tamanho="p"
                      disabled={ocupado === item.id}
                      onClick={async () => {
                        if (!(await confirmar(f.apagarConfirma))) return;
                        tirarDaFila(armazemDoAparelho(), item.id);
                        avisarMudanca();
                      }}
                    >
                      {f.apagar}
                    </Botao>
                  ) : null}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="lv-dica">{f.sairRapido}</p>
    </>
  );
}
