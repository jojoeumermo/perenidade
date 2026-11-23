// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Botao } from "@/components/rede/ui/Botao";
import { rpc } from "@/lib/backend";
import type { ContaDePessoas, EstadoDoAdmin } from "@/lib/rede/admin/tipos";
import { VERSAO_ESPERADA_DO_BANCO } from "@/lib/rede/painel/tipos";
import { notificar } from "../../ui";
import { pedidoDaTrava } from "../Funcoes";
import { Etiqueta, motivoDe, Nota, quando, Quadro, textoDoErroDaAlumia, Titulo, useJanela } from "../pecas";
import { Limites } from "./Limites";
import { nomeDoRecurso, notaDaVariavel, valendo } from "./recursos-comuns";
import { ZerarOBeta } from "./ZerarOBeta";

/** Número de pessoas no quadro do estado: só a partir de 3. */
const quantas = (c: ContaDePessoas) => (c.n !== null ? String(c.n) : c.algum ? "menos de 3" : "nenhuma");

export type SituacaoDoBeta = { tom: "perigo" | "bom" | "construcao" | "atencao"; titulo: string; texto: string };

/** O estado do beta em uma frase: o que quem chega na Alumia encontra agora. */
export function situacaoDoBeta(e: EstadoDoAdmin): SituacaoDoBeta {
  const decisao = (nome: string) => e.recursos.find((r) => r.nome === nome)?.decisao;
  const aberta = valendo("alumia-aberta", decisao("alumia-aberta"));
  if (aberta && !e.trava.ligada) {
    return { tom: "perigo", titulo: "Perigo: aberta sem a trava", texto: "A Alumia está aberta e a trava da entrada está desligada: qualquer pessoa cria conta e entra. Ligue a trava agora, ou desligue “Alumia aberta”." };
  }
  if (!aberta) {
    return {
      tom: "construcao",
      titulo: "Em construção",
      texto: e.trava.ligada ? "Quem chega na Alumia vê só o aviso de que ela está em construção. A trava já está ligada: quando abrir, entra só quem foi aprovado." : "Quem chega na Alumia vê só o aviso de que ela está em construção. Antes de abrir, ligue a trava da entrada.",
    };
  }
  if (e.porta.fechada) {
    return { tom: "atencao", titulo: "Beta fechado, porta fechada", texto: "Quem já foi aprovado entra. Ninguém cria conta nem pede a entrada até a porta ser reaberta." };
  }
  return { tom: "bom", titulo: "Beta fechado", texto: "A Alumia está aberta só para quem foi aprovado na triagem, com o segundo fator. Contas novas esperam na fila." };
}

function Linha({ nome, ligado, etiqueta, sobre, nota, children }: { nome: string; ligado: boolean; etiqueta: string; sobre: string; nota?: { tom: "perigo" | undefined; texto: string } | null; children: React.ReactNode }) {
  return (
    <div className="ap-chave">
      <div className="ap-linha-texto">
        <span className="ap-linha-cabeca">
          <span className="ap-forte">
            <span className="ap-luz" data-ligado={ligado} aria-hidden>
              <span />
              <span />
              <span />
            </span>
            {nome}
          </span>
          <Etiqueta tom={ligado ? "papel" : undefined}>{etiqueta}</Etiqueta>
        </span>
        <span className="ap-miudo">{sobre}</span>
        {nota ? <span className="ap-miudo" data-tom={nota.tom}>{nota.texto}</span> : null}
      </div>
      <div className="ap-chave-lado">{children}</div>
    </div>
  );
}

/**
 * O alto do painel único: o estado do beta fechado à vista, os interruptores do lançamento (trava da entrada, Alumia aberta,
 * porta de entrada, convites, Fediverso) e o que o painel não faz. Toda mudança vai para o registro.
 */
export function Beta({ estado, recarregar, irPara }: { estado: EstadoDoAdmin; recarregar: () => void; irPara: (aba: "recursos" | "cadastros") => void }) {
  const { pedir, janela } = useJanela();
  const [fechando, setFechando] = useState(false);
  const decisao = (nome: string) => estado.recursos.find((r) => r.nome === nome)?.decisao;
  const situacao = situacaoDoBeta(estado);
  const aberta = valendo("alumia-aberta", decisao("alumia-aberta"));
  const convites = valendo("alumia-convites", decisao("alumia-convites"));
  const fedTotal = valendo("fediverso-total", decisao("fediverso-total"));
  const fedGrupos = valendo("fediverso-grupos", decisao("fediverso-grupos"));
  const bancoCerto = estado.versao >= VERSAO_ESPERADA_DO_BANCO;

  const mudar = (nome: string, ligar: boolean) => {
    const perigoso = nome === "alumia-aberta" && ligar && !estado.trava.ligada;
    const { nome: nomeNaTela, sobre } = nomeDoRecurso(nome);
    pedir({
      titulo: `${ligar ? "Ligar" : "Desligar"} “${nomeNaTela}”`,
      texto: (
        <>
          <p>{sobre}</p>
          {perigoso ? (
            <Nota tom="perigo">A trava da entrada está desligada. Abrir agora deixa qualquer pessoa criar conta e entrar, sem triagem. O certo é ligar a trava antes. Para abrir assim mesmo, escreva a frase.</Nota>
          ) : (
            <p>{ligar ? "Passa a valer em até um minuto, sem publicar o site de novo." : "Desliga em até um minuto. Desligado aqui, fica desligado mesmo que o código diga o contrário. Nada é apagado."}</p>
          )}
        </>
      ),
      campos: [{ tipo: "motivo" }, ...(perigoso ? [{ tipo: "frase" as const, frase: "ABRIR SEM A TRAVA" }] : [])],
      confirmar: ligar ? "Ligar" : "Desligar",
      perigo: !ligar || perigoso,
      fazer: (v) => rpc("alumia_admin_recurso", { p_nome: nome, p_ligar: ligar, p_motivo: motivoDe(v), p_frase: perigoso ? String(v.frase).trim() : null }),
      sucesso: "Decisão gravada. Vale em até um minuto.",
      depois: recarregar,
    });
  };

  /** Fechar a porta é um clique só (hora de ataque): fecha na hora e fica no registro com o motivo padrão. */
  async function fecharAPorta() {
    setFechando(true);
    try {
      await rpc("alumia_admin_porta", { p_fechar: true, p_motivo: "" });
      notificar.ok("Porta fechada. Ninguém cria conta nem pede a entrada até reabrir.");
      recarregar();
    } catch (erro) {
      notificar.erro(textoDoErroDaAlumia(erro));
    } finally {
      setFechando(false);
    }
  }
  const reabrir = () =>
    pedir({
      titulo: "Reabrir a porta de entrada",
      texto: <p>Contas novas e pedidos de entrada voltam a passar pela porta de sempre: a prova no aparelho, o freio por rede, o teto da hora e a triagem.</p>,
      campos: [{ tipo: "motivo" }],
      confirmar: "Reabrir a porta",
      fazer: (v) => rpc("alumia_admin_porta", { p_fechar: false, p_motivo: motivoDe(v) }),
      sucesso: "Porta reaberta.",
      depois: recarregar,
    });

  const passos: { feito: boolean; texto: string }[] = [
    { feito: bancoCerto, texto: `O SQL único rodou: banco na versão ${VERSAO_ESPERADA_DO_BANCO} (instalada: ${estado.versao}).` },
    { feito: estado.trava.ligada, texto: "A trava da entrada está ligada (só conta aprovada, com o segundo fator)." },
    { feito: convites, texto: "Convites ligados (opcional): quem está dentro convida, e o convite leva à triagem." },
    { feito: aberta, texto: "A Alumia aberta: tira o aviso de “em construção”. Sempre depois da trava." },
  ];

  return (
    <div className="ap-tela">
      <Titulo nome="Beta fechado" sobre="O que quem chega na Alumia encontra agora, e os interruptores do lançamento. Toda mudança pede o motivo e fica no registro." />

      <section className="aa-estado" data-tom={situacao.tom} aria-live="polite">
        <span className="aa-estado-rotulo al-cond">{situacao.titulo}</span>
        <p className="aa-estado-texto">{situacao.texto}</p>
        <dl className="aa-estado-numeros">
          <div>
            <dt>Na fila da triagem</dt>
            <dd>{quantas(estado.fila)}</dd>
          </div>
          <div>
            <dt>Aprovadas</dt>
            <dd>{quantas(estado.aprovadas)}</dd>
          </div>
          <div>
            <dt>Bloqueios na borda</dt>
            <dd>{estado.borda_ativos}</dd>
          </div>
        </dl>
      </section>

      <Quadro titulo="Interruptores do lançamento" tom={situacao.tom === "perigo" ? "perigo" : undefined}>
        <Linha
          nome="Trava da entrada"
          ligado={estado.trava.ligada}
          etiqueta={estado.trava.ligada ? "ligada" : "desligada"}
          sobre={`Só usa a Alumia quem tem conta aprovada na triagem e entrou com o segundo fator.${estado.trava.desde ? ` Ligada pela primeira vez em ${quando(estado.trava.desde)}.` : ""}`}
          nota={notaDaVariavel("alumia-entrada")}
        >
          {estado.trava.ligada ? (
            <Botao variante="contorno" tamanho="p" onClick={() => pedir(pedidoDaTrava(false, recarregar))}>
              Desligar…
            </Botao>
          ) : (
            <Botao variante="primario" tamanho="p" disabled={!estado.trava.eu_passo} title={estado.trava.eu_passo ? undefined : "Sua conta precisa estar aprovada na Alumia e esta sessão com o código, senão você ficaria do lado de fora."} onClick={() => pedir(pedidoDaTrava(true, recarregar))}>
              Ligar…
            </Botao>
          )}
        </Linha>
        <Linha nome="Alumia aberta" ligado={aberta} etiqueta={aberta ? "aberta" : "em construção"} sobre={aberta ? "Aberta: quem chega na Alumia vê a Alumia. “Pôr em construção” mostra só o aviso de obra para todo mundo." : "Em construção: quem chega em qualquer endereço da Alumia vê só o aviso de obra. “Abrir” mostra a Alumia."} nota={notaDaVariavel("alumia-aberta")}>
          <Botao variante={aberta ? "contorno" : "claro"} tamanho="p" onClick={() => mudar("alumia-aberta", !aberta)}>
            {aberta ? "Pôr em construção…" : "Abrir…"}
          </Botao>
        </Linha>
        <Linha
          nome="Porta de entrada"
          ligado={!estado.porta.fechada}
          etiqueta={estado.porta.fechada ? "fechada" : "aberta"}
          sobre={estado.porta.fechada ? "Fechada: ninguém cria conta nem pede a entrada, com ou sem convite. Quem já foi aprovado continua entrando." : "Para uma onda de contas falsas: fecha na hora, num clique, e fica no registro. Reabrir pede o motivo."}
        >
          {estado.porta.fechada ? (
            <Botao variante="claro" tamanho="p" onClick={reabrir}>
              Reabrir…
            </Botao>
          ) : (
            <Botao variante="primario" tamanho="p" disabled={fechando} onClick={() => void fecharAPorta()}>
              {fechando ? "Fechando…" : "Fechar a porta agora"}
            </Botao>
          )}
        </Linha>
        <Linha nome="Convites" ligado={convites} etiqueta={convites ? "ligados" : "desligados"} sobre={nomeDoRecurso("alumia-convites").sobre} nota={notaDaVariavel("alumia-convites")}>
          <Botao variante={convites ? "contorno" : "claro"} tamanho="p" onClick={() => mudar("alumia-convites", !convites)}>
            {convites ? "Desligar…" : "Ligar…"}
          </Botao>
        </Linha>
        <Linha nome="Fediverso" ligado={fedTotal} etiqueta={fedTotal ? "ligado" : "desligado"} sobre={nomeDoRecurso("fediverso-total").sobre} nota={notaDaVariavel("fediverso-total")}>
          <Botao variante={fedTotal ? "contorno" : "claro"} tamanho="p" onClick={() => mudar("fediverso-total", !fedTotal)}>
            {fedTotal ? "Desligar…" : "Ligar…"}
          </Botao>
        </Linha>
        <Linha nome="Comunidades no Fediverso" ligado={fedGrupos} etiqueta={fedGrupos ? "ligadas" : "desligadas"} sobre={`${nomeDoRecurso("fediverso-grupos").sobre} Só vale com o Fediverso ligado.`} nota={notaDaVariavel("fediverso-grupos")}>
          <Botao variante={fedGrupos ? "contorno" : "claro"} tamanho="p" onClick={() => mudar("fediverso-grupos", !fedGrupos)}>
            {fedGrupos ? "Desligar…" : "Ligar…"}
          </Botao>
        </Linha>
        <div className="ap-linha-acoes" style={{ justifyContent: "flex-start" }}>
          <Botao variante="fantasma" tamanho="p" onClick={() => irPara("recursos")}>
            Todos os recursos
          </Botao>
          <Botao variante="fantasma" tamanho="p" onClick={() => irPara("cadastros")}>
            Fila da triagem ({quantas(estado.fila)})
          </Botao>
        </div>
      </Quadro>

      <div className="ap-duas">
        <Quadro titulo="A ordem para abrir o beta">
          <ol className="aa-passos">
            {passos.map((p) => (
              <li key={p.texto} data-feito={p.feito || undefined}>
                <span aria-hidden className="aa-passo-marca">
                  {p.feito ? "✓" : ""}
                </span>
                <span>{p.texto}</span>
              </li>
            ))}
          </ol>
          <p className="ap-miudo">Nunca abra com a trava desligada: haveria uma janela em que qualquer pessoa cria conta e entra. A variável NEXT_PUBLIC_RECURSOS e as chaves do servidor não mudam por aqui.</p>
        </Quadro>
        <Limites />
      </div>
      <ZerarOBeta recarregar={recarregar} />
      {janela}
    </div>
  );
}
