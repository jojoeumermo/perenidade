// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Prompt 4, item 3 (interruptor "alumia-p4-selo-contagens"): o selo de verificado das pessoas e os nomes reservados de figuras
// públicas, no painel único. Só a coordenação (o papel no banco, com o segundo fator) lê e decide: para qualquer outra pessoa o
// banco responde "sem_permissao". Nenhum documento ou prova chega aqui, porque nenhum é guardado: só o canal pelo qual conferir.
import { useState } from "react";
import { Botao } from "@/components/rede/ui/Botao";
import { redeSelo, type NomeReservado, type PedidoDeSeloNaFila } from "@/lib/rede/selo-contagens/cliente";
import { dia, Estado, Etiqueta, Fita, motivoDe, Nota, Quadro, Titulo, useDado, useJanela } from "./pecas";

const TIPO: Record<string, string> = { pessoa_publica: "pessoa pública", educadora: "educadora" };
const CANAL: Record<string, string> = { email_institucional: "e-mail institucional", perfil_oficial: "perfil oficial em outra rede", gabinete: "gabinete ou assessoria" };

/** O selo das pessoas: a fila, tirar o selo e a lista de nomes reservados. */
export function SeloDasPessoas() {
  const [parte, setParte] = useState<"fila" | "reservados">("fila");
  return (
    <div className="ap-tela">
      <Titulo
        nome="Selo das pessoas e nomes reservados"
        sobre="O selo de verificado é gratuito, sempre, e só a coordenação dá e tira. Ele diz que a conta é de quem diz ser; não quer dizer que a Alumia apoia a pessoa. Os nomes reservados impedem que alguém se cadastre com o nome ou o @ de uma figura pública."
      />
      <Nota>
        O interruptor “Selo de pessoas e contagens” fica em Recursos. Desligado, a lista de nomes pode ser preparada aqui, mas nada vale na rede: nenhum
        selo aparece, nenhum pedido entra e nenhum nome é bloqueado.
      </Nota>
      <Fita
        rotulo="Parte"
        atual={parte}
        escolher={setParte}
        opcoes={[
          { id: "fila", nome: "Pedidos e retirada" },
          { id: "reservados", nome: "Nomes reservados" },
        ]}
      />
      {parte === "fila" ? <Fila /> : <Reservados />}
    </div>
  );
}

function Fila() {
  const leitura = useDado<PedidoDeSeloNaFila[]>("rede_p4_selo_fila");
  const reservados = useDado<NomeReservado[]>("rede_p4_reservados");
  const { pedir, janela } = useJanela();
  const itens = leitura.dados ?? [];
  const livres = (reservados.dados ?? []).filter((r) => !r.verificado);

  const decidir = (p: PedidoDeSeloNaFila, aceitar: boolean) =>
    pedir({
      titulo: aceitar ? "Dar o selo" : "Recusar o pedido",
      texto: (
        <p>
          {aceitar ? (
            <>
              <strong>{p.codinome}</strong> recebe o selo de {TIPO[p.tipo]}. Confira antes pelo canal escolhido ({CANAL[p.canal]}). Nada da conferência é
              guardado: só a decisão, quem decidiu e quando.
            </>
          ) : (
            <>
              O pedido de <strong>{p.codinome}</strong> é recusado. A pessoa lê o motivo.
            </>
          )}
        </p>
      ),
      campos: aceitar
        ? [
            {
              tipo: "escolha",
              nome: "reservado",
              rotulo: "Ligar um nome reservado a esta pessoa (ela passa a poder usá-lo)",
              opcoes: [{ id: "", nome: "Nenhum" }, ...livres.map((r) => ({ id: String(r.id), nome: r.nome }))],
              valor: "",
            },
          ]
        : [{ tipo: "motivo", aviso: "A pessoa lê este motivo." }],
      confirmar: aceitar ? "Dar o selo" : "Recusar",
      perigo: !aceitar,
      fazer: (v) => redeSelo.decidir(p.id, aceitar, aceitar ? "" : motivoDe(v), aceitar && v.reservado ? Number(v.reservado) : null),
      sucesso: aceitar ? "Selo dado." : "Pedido recusado.",
      depois: () => {
        leitura.recarregar();
        reservados.recarregar();
      },
    });
  const tirar = () =>
    pedir({
      titulo: "Tirar o selo de uma pessoa",
      texto: <p>A pessoa perde o selo e é avisada com o motivo. O nome reservado ligado a ela volta a ficar bloqueado.</p>,
      campos: [
        { tipo: "texto", nome: "handle", rotulo: "O @ da pessoa", min: 3, max: 40 },
        { tipo: "motivo", aviso: "A pessoa lê este motivo." },
      ],
      confirmar: "Tirar o selo",
      perigo: true,
      fazer: (v) => redeSelo.tirar(String(v.handle ?? "").trim(), motivoDe(v)),
      sucesso: "Selo retirado.",
      depois: reservados.recarregar,
    });

  return (
    <>
      <Nota>
        A pessoa diz só por qual canal oficial a coordenação pode conferir (e-mail institucional, perfil oficial em outra rede, gabinete). Documento e prova
        nunca entram. A decisão fica no registro, que não se altera nem se apaga.
      </Nota>
      <Estado leitura={leitura} eVazio={Boolean(leitura.dados) && itens.length === 0} vazio="Nenhum pedido de selo esperando." />
      {itens.length > 0 ? (
        <Quadro titulo="Pedidos esperando">
          <ul className="ap-lista">
            {itens.map((p) => (
              <li key={p.id} className="ap-linha" style={{ alignItems: "start" }}>
                <span className="ap-linha-texto">
                  <span className="ap-linha-cabeca">
                    <span className="ap-forte">{p.codinome}</span>
                    {p.handle ? <span className="ap-miudo">@{p.handle}</span> : null}
                    <Etiqueta tom="dourado">{TIPO[p.tipo]}</Etiqueta>
                  </span>
                  <span className="ap-miudo">
                    Conferir por: {CANAL[p.canal]} · pedido em {dia(p.criadoEm)}
                  </span>
                </span>
                <span className="ap-linha-acoes">
                  <Botao variante="claro" tamanho="p" onClick={() => decidir(p, true)}>
                    Dar o selo
                  </Botao>
                  <Botao variante="contorno" tamanho="p" onClick={() => decidir(p, false)}>
                    Recusar
                  </Botao>
                </span>
              </li>
            ))}
          </ul>
        </Quadro>
      ) : null}
      <Quadro titulo="Tirar o selo" tom="perigo">
        <p className="ap-miudo">A qualquer momento, com motivo registrado.</p>
        <Botao variante="contorno" className="ap-destrutivo" tamanho="p" onClick={tirar}>
          Tirar o selo de alguém
        </Botao>
      </Quadro>
      {janela}
    </>
  );
}

function Reservados() {
  const leitura = useDado<NomeReservado[]>("rede_p4_reservados");
  const { pedir, janela } = useJanela();
  const itens = leitura.dados ?? [];

  const reservar = () =>
    pedir({
      titulo: "Reservar um nome",
      texto: (
        <p>
          O nome ou @ de uma figura pública. Com o interruptor ligado, ninguém se cadastra nem troca o codinome ou o @ para um nome parecido (sem acento, sem
          maiúsculas, 0 por o, 1 por l e outras trocas comuns) até a coordenação ligar o nome à pessoa verificada.
        </p>
      ),
      campos: [{ tipo: "texto", nome: "nome", rotulo: "Nome ou @", min: 3, max: 80 }],
      confirmar: "Reservar",
      fazer: (v) => redeSelo.reservar(String(v.nome ?? "")),
      sucesso: "Nome reservado.",
      depois: leitura.recarregar,
    });
  const tirar = (r: NomeReservado) =>
    pedir({
      titulo: "Tirar o nome da lista",
      texto: (
        <p>
          <strong>{r.nome}</strong> deixa de ser reservado: qualquer pessoa pode usar um nome parecido.
        </p>
      ),
      confirmar: "Tirar da lista",
      perigo: true,
      fazer: () => redeSelo.tirarReservado(r.id),
      sucesso: "Nome tirado da lista.",
      depois: leitura.recarregar,
    });

  return (
    <>
      <Nota>A lista mostra se o nome já está ligado a uma pessoa verificada, sem dizer qual. Cada mudança fica no registro.</Nota>
      <div className="ap-acoes" style={{ margin: "0.75rem 0" }}>
        <Botao variante="claro" tamanho="p" onClick={reservar}>
          Reservar um nome
        </Botao>
      </div>
      <Estado leitura={leitura} eVazio={Boolean(leitura.dados) && itens.length === 0} vazio="Nenhum nome reservado ainda." />
      {itens.length > 0 ? (
        <Quadro>
          <ul className="ap-lista">
            {itens.map((r) => (
              <li key={r.id} className="ap-linha">
                <span className="ap-linha-texto">
                  <span className="ap-linha-cabeca">
                    <span className="ap-forte">{r.nome}</span>
                    {r.verificado ? <Etiqueta tom="vermelho">ligado a uma pessoa verificada</Etiqueta> : <Etiqueta>bloqueado</Etiqueta>}
                  </span>
                </span>
                <span className="ap-linha-acoes">
                  <Botao variante="contorno" tamanho="p" onClick={() => tirar(r)}>
                    Tirar da lista
                  </Botao>
                </span>
              </li>
            ))}
          </ul>
        </Quadro>
      ) : null}
      {janela}
    </>
  );
}
