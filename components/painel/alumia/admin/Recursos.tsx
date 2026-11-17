// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Botao } from "@/components/rede/ui/Botao";
import { rpc } from "@/lib/backend";
import type { EstadoDoAdmin, RecursoNoAdmin } from "@/lib/rede/admin/tipos";
import { Campo, Etiqueta, Fita, motivoDe, Nota, quando, Quadro, Titulo, useJanela } from "../pecas";
import { daAlumia, nomeDoRecurso, notaDaVariavel, valendo } from "./recursos-comuns";

type Grupo = "alumia" | "site";

/**
 * Todos os recursos: os da Alumia e os do site (os mesmos interruptores dos Controles avançados), com o que cada um faz em
 * palavras simples, a decisão gravada no banco e o aviso quando a variável de montagem manda. A decisão vale em até um minuto.
 */
export function Recursos({ estado, recarregar, irPara }: { estado: EstadoDoAdmin; recarregar: () => void; irPara: (aba: "beta") => void }) {
  const { pedir, janela } = useJanela();
  const [grupo, setGrupo] = useState<Grupo>("alumia");
  const [busca, setBusca] = useState("");

  const mudar = (r: RecursoNoAdmin, ligar: boolean | null) => {
    const { nome, sobre } = nomeDoRecurso(r.nome);
    const segunda = ligar === true && !r.direto;
    const perigoso = r.nome === "alumia-aberta" && ligar !== false && !estado.trava.ligada;
    pedir({
      titulo: ligar === null ? `Voltar “${nome}” ao padrão` : `${ligar ? "Ligar" : "Desligar"} “${nome}”`,
      texto: (
        <>
          <p>{sobre}</p>
          {perigoso ? <Nota tom="perigo">A trava da entrada está desligada: abrir agora deixa qualquer pessoa criar conta e entrar. Para abrir assim mesmo, escreva a frase.</Nota> : null}
          <p>
            {ligar === null
              ? "A decisão gravada no banco é apagada e volta a valer o que o código desta montagem diz."
              : segunda
                ? "Este recurso depende de texto, revisão ou parecer: ligar abre um pedido que outra pessoa da coordenação confirma (Segurança › Confirmações). Confirmado, vale em até um minuto."
                : ligar
                  ? "Passa a valer em até um minuto, sem publicar o site de novo."
                  : "Desliga em até um minuto. Desligado aqui, fica desligado mesmo que o código diga o contrário. Nada é apagado."}
          </p>
          <p className="ap-miudo">Página que saiu pronta na montagem do site só muda quando o site for montado de novo; o resto segue a decisão.</p>
        </>
      ),
      campos: [{ tipo: "motivo" }, ...(perigoso ? [{ tipo: "frase" as const, frase: "ABRIR SEM A TRAVA" }] : [])],
      confirmar: ligar === null ? "Voltar ao padrão" : segunda ? "Pedir para ligar" : ligar ? "Ligar" : "Desligar",
      perigo: ligar === false || perigoso,
      fazer: (v) => rpc("alumia_admin_recurso", { p_nome: r.nome, p_ligar: ligar, p_motivo: motivoDe(v), p_frase: perigoso ? String(v.frase).trim() : null }),
      sucesso: segunda ? "Pedido aberto. Liga quando outra pessoa da coordenação confirmar." : "Decisão gravada. Vale em até um minuto.",
      depois: recarregar,
    });
  };

  const termo = busca.trim().toLowerCase();
  const lista = estado.recursos
    .filter((r) => (grupo === "alumia" ? daAlumia(r.nome) : !daAlumia(r.nome)))
    .filter((r) => !termo || r.nome.includes(termo) || nomeDoRecurso(r.nome).nome.toLowerCase().includes(termo) || nomeDoRecurso(r.nome).sobre.toLowerCase().includes(termo));
  const daAlumiaN = estado.recursos.filter((r) => daAlumia(r.nome)).length;

  return (
    <div className="ap-tela">
      <Titulo nome="Recursos" sobre="Cada recurso tem uma chave. A decisão fica no banco e vale em até um minuto, sem publicar o site. Toda mudança pede o motivo e fica no registro." />
      <div className="ap-filtros">
        <Fita
          rotulo="Que recursos"
          opcoes={[
            { id: "alumia" as Grupo, nome: "Alumia", conta: daAlumiaN },
            { id: "site" as Grupo, nome: "Site e estudo", conta: estado.recursos.length - daAlumiaN },
          ]}
          atual={grupo}
          escolher={setGrupo}
        />
        <Campo rotulo="Procurar">
          <input className="ap-entrada" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="nome ou o que faz" />
        </Campo>
      </div>
      <Nota>
        Os interruptores do lançamento (Alumia aberta, convites e os dois do Fediverso) ligam direto, com o código do aplicativo autenticador. Os outros que dependem de texto, revisão ou parecer pedem uma segunda pessoa da coordenação para ligar; desligar é sempre na hora.
      </Nota>
      <Quadro>
        {lista.length === 0 ? <Nota>Nenhum recurso com esse nome.</Nota> : null}
        {lista.map((r) => {
          const v = valendo(r.nome, r.decisao);
          const { nome, sobre } = nomeDoRecurso(r.nome);
          const variavel = notaDaVariavel(r.nome);
          const podeVoltar = r.decisao !== null && !(r.so_pelo_nome && r.decisao === false);
          return (
            <div key={r.nome} className="ap-chave">
              <div className="ap-linha-texto">
                <span className="ap-linha-cabeca">
                  <span className="ap-forte">
                    <span className="ap-luz" data-ligado={v} aria-hidden>
                      <span />
                      <span />
                      <span />
                    </span>
                    {nome}
                  </span>
                  <Etiqueta tom={v ? "papel" : undefined}>{v ? "ligado" : "desligado"}</Etiqueta>
                  {r.aguardando ? <Etiqueta tom="vermelho">esperando a segunda pessoa</Etiqueta> : null}
                  {r.decisao === null ? null : (
                    <Etiqueta tom="dourado">
                      decisão do painel{r.em ? ` · ${quando(r.em)}` : ""}
                      {r.por ? ` · ${r.por}` : ""}
                    </Etiqueta>
                  )}
                </span>
                <span className="ap-miudo">{sobre}</span>
                <span className="ap-miudo aa-tecnico">{r.nome}</span>
                {variavel ? (
                  <span className="ap-miudo" data-tom={variavel.tom}>
                    {variavel.texto}
                  </span>
                ) : null}
              </div>
              <div className="ap-chave-lado">
                {r.nome === "alumia-entrada" ? (
                  <Botao variante="contorno" tamanho="p" onClick={() => irPara("beta")}>
                    Na trava da entrada
                  </Botao>
                ) : v ? (
                  <Botao variante="contorno" tamanho="p" onClick={() => mudar(r, false)}>
                    Desligar
                  </Botao>
                ) : r.aguardando ? (
                  <Botao variante="claro" tamanho="p" disabled title="Já há um pedido esperando a segunda pessoa.">
                    Pedido aberto
                  </Botao>
                ) : (
                  <Botao variante="claro" tamanho="p" disabled={variavel?.tom === "perigo"} onClick={() => mudar(r, true)}>
                    {r.direto ? "Ligar" : "Pedir para ligar"}
                  </Botao>
                )}
                {podeVoltar && r.nome !== "alumia-entrada" ? (
                  <Botao variante="fantasma" tamanho="p" onClick={() => mudar(r, null)}>
                    Voltar ao padrão
                  </Botao>
                ) : null}
              </div>
            </div>
          );
        })}
      </Quadro>
      {janela}
    </div>
  );
}
