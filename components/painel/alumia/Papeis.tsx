// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Botao } from "@/components/rede/ui/Botao";
import { Carimbo } from "@/components/rede/ui/Carimbo";
import { rpc } from "@/lib/backend";
import type { PapeisDaAlumia, PessoaNaBusca } from "@/lib/rede/painel/tipos";
import { Estado, Etiqueta, motivoDe, Nota, quando, Quadro, Titulo, useDado, useJanela } from "./pecas";
import { BuscaDePessoa } from "./Pessoas";

const SIM = "sim";
const NAO = "não";

/** O que cada papel pode na Alumia. É o retrato do que o banco cumpre (a tabela não dá nem tira permissão). */
const PODERES: { oQue: string; coordenacao: string; admin: string; mediacao: string }[] = [
  { oQue: "Aprovar e recusar cadastros", coordenacao: SIM, admin: SIM, mediacao: "sim, o que está na fila, uma vez" },
  { oQue: "Mudar decisão de cadastro já tomada e reabrir", coordenacao: SIM, admin: SIM, mediacao: NAO },
  { oQue: "Fila de denúncias: decidir, ocultar post, avisar", coordenacao: SIM, admin: SIM, mediacao: "sim, na tela de moderação da Alumia" },
  { oQue: "Suspender e banir conta", coordenacao: SIM, admin: "sim, menos a coordenação", mediacao: "sim, pelo banimento da mediação" },
  { oQue: "Barrar a rede, encerrar sessões, tirar o segundo fator, apagar conta", coordenacao: SIM, admin: "sim, menos a coordenação e quem tem função na casa", mediacao: NAO },
  { oQue: "Apagar e restaurar post, story e imagem; aviso no alto", coordenacao: SIM, admin: SIM, mediacao: NAO },
  { oQue: "Comunidades (criar, encerrar, moderação) e selo de organização", coordenacao: SIM, admin: SIM, mediacao: NAO },
  { oQue: "Ligar e desligar funções e a trava da entrada", coordenacao: SIM, admin: SIM, mediacao: NAO },
  { oQue: "Ler e exportar o registro deste painel", coordenacao: SIM, admin: SIM, mediacao: NAO },
  { oQue: "Buscar pessoa pelo nome da conta", coordenacao: "sim, com registro", admin: NAO, mediacao: NAO },
  { oQue: "Nomear e destituir o admin da Alumia", coordenacao: SIM, admin: NAO, mediacao: NAO },
];

/**
 * Papéis: a coordenação, O admin da Alumia (um só) e a mediação do Instituto, que modera a Alumia pelo papel que já tem.
 * Não existe cadastro de moderador da Alumia: dar ou tirar o papel de mediação é no painel da equipe (Voluntários e convites).
 */
export function Papeis() {
  const leitura = useDado<PapeisDaAlumia>("alumia_painel_papeis");
  const { pedir, janela } = useJanela();
  const [escolhida, setEscolhida] = useState<PessoaNaBusca | null>(null);
  const dado = leitura.dados;
  const coordena = dado?.papel === "coordenacao";

  const nomear = (p: PessoaNaBusca) =>
    pedir({
      titulo: "Nomear admin da Alumia",
      texto: (
        <p>
          <strong>{p.codinome}</strong> passa a poder tudo o que a coordenação pode na Alumia, menos nomear ou destituir o admin e menos agir sobre quem é da coordenação. Só existe um admin de cada vez. A conta precisa estar aprovada na Alumia e deve usar sempre o aplicativo autenticador.
        </p>
      ),
      campos: [{ tipo: "motivo" }, { tipo: "frase", frase: "NOMEAR ADMIN" }],
      confirmar: "Nomear",
      perigo: true,
      fazer: (v) => rpc("alumia_painel_admin_nomear", { p_id: p.id, p_motivo: motivoDe(v) }),
      sucesso: "Admin nomeado. A pessoa foi avisada.",
      depois: () => {
        setEscolhida(null);
        leitura.recarregar();
      },
    });
  const destituir = () =>
    pedir({
      titulo: "Destituir o admin",
      texto: (
        <p>
          <strong>{dado?.admin?.nome}</strong> deixa de ter o painel de controle na hora. A conta continua na Alumia como qualquer outra.
        </p>
      ),
      campos: [{ tipo: "motivo" }, { tipo: "frase", frase: "DESTITUIR ADMIN" }],
      confirmar: "Destituir",
      perigo: true,
      fazer: (v) => rpc("alumia_painel_admin_destituir", { p_motivo: motivoDe(v) }),
      sucesso: "Admin destituído.",
      depois: leitura.recarregar,
    });

  return (
    <div className="ap-tela">
      <Titulo nome="Papéis" sobre="Quem cuida da Alumia. Três papéis, e nenhum deles é cadastro novo: a coordenação e a mediação vêm do Instituto; o admin é uma conta só, nomeada pela coordenação." />
      <Estado leitura={leitura} />
      {dado ? (
        <>
          <div className="ap-duas">
            <Quadro titulo="Coordenação" lado={<Carimbo situacao="confirmado" texto="Pode tudo" tamanho="p" />}>
              <ul className="ap-lista">
                {dado.coordenacao.map((nome) => (
                  <li key={nome} className="ap-linha">
                    <span className="ap-forte">{nome}</span>
                    <Etiqueta tom="papel">coordenação do Instituto</Etiqueta>
                  </li>
                ))}
              </ul>
              <p className="ap-miudo">O papel vem do Instituto. Nada deste painel age sobre uma conta da coordenação: ela se cuida no painel da equipe, que tem a regra da última coordenação.</p>
            </Quadro>

            <Quadro titulo="Admin da Alumia" tom="dourado" lado={<Carimbo situacao="adiado" texto="Um só" tamanho="p" />}>
              {dado.admin ? (
                <>
                  <div className="ap-linha">
                    <span className="ap-linha-texto">
                      <span className="ap-forte">{dado.admin.nome}</span>
                      <span className="ap-miudo">
                        Desde {quando(dado.admin.desde)}
                        {dado.admin.por ? ` · nomeado por ${dado.admin.por}` : ""}
                      </span>
                    </span>
                    {dado.admin.suspensa ? <Etiqueta tom="vermelho">conta suspensa: sem painel</Etiqueta> : <Etiqueta tom="dourado">em exercício</Etiqueta>}
                  </div>
                  {coordena ? (
                    <div>
                      <Botao variante="contorno" className="ap-destrutivo" onClick={destituir}>
                        Destituir o admin
                      </Botao>
                    </div>
                  ) : (
                    <p className="ap-miudo">Só a coordenação nomeia e destitui.</p>
                  )}
                </>
              ) : coordena ? (
                <>
                  <p className="ap-sobre">Ninguém nomeado. Busque a conta pelo codinome ou pelo @ e nomeie. Para trocar depois, destitua antes.</p>
                  <BuscaDePessoa escolhida={escolhida?.id} aoEscolher={setEscolhida} />
                  {escolhida ? (
                    <div>
                      <Botao variante="dourado" disabled={escolhida.entrada !== "aprovada"} onClick={() => nomear(escolhida)}>
                        Nomear {escolhida.codinome}
                      </Botao>
                      {escolhida.entrada !== "aprovada" ? <p className="ap-miudo">A conta precisa estar aprovada na Alumia e sem suspensão.</p> : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <Nota>Ninguém nomeado.</Nota>
              )}
            </Quadro>
          </div>

          <Quadro titulo="Mediação do Instituto" lado={<Etiqueta>{dado.mediacao.length === 1 ? "1 pessoa" : `${dado.mediacao.length} pessoas`}</Etiqueta>}>
            <p className="ap-sobre">
              Os mediadores do Instituto são os moderadores da Alumia, com os mesmos poderes que já têm: triagem dos cadastros, fila de denúncias e banimento da mediação, nas telas deles. Não entram neste painel. Para dar ou tirar o papel, use “Voluntários e convites” no painel interno: vale na Alumia na mesma hora.
            </p>
            {dado.mediacao.length === 0 ? (
              <Nota>Ninguém com o papel de mediação. Sem mediação, a fila de cadastros e a de denúncias ficam só com a coordenação e o admin.</Nota>
            ) : (
              <ul className="ap-lista">
                {dado.mediacao.map((m) => (
                  <li key={m.nome} className="ap-linha">
                    <span className="ap-forte">{m.nome}</span>
                    <span className="ap-etiquetas">
                      {m.suspensa ? <Etiqueta tom="vermelho">suspensa</Etiqueta> : null}
                      <Etiqueta tom={m.na_alumia ? "papel" : undefined}>{m.na_alumia ? "aprovada na Alumia" : "ainda sem entrada aprovada na Alumia"}</Etiqueta>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Quadro>

          <Quadro titulo="Quem pode o quê">
            <div className="ap-tabela-caixa">
              <table className="ap-tabela">
                <thead>
                  <tr>
                    <th>Ação</th>
                    <th>Coordenação</th>
                    <th>Admin da Alumia</th>
                    <th>Mediação</th>
                  </tr>
                </thead>
                <tbody>
                  {PODERES.map((p) => (
                    <tr key={p.oQue}>
                      <td className="ap-forte">{p.oQue}</td>
                      <td data-nome="Coordenação">{p.coordenacao}</td>
                      <td data-nome="Admin da Alumia">{p.admin}</td>
                      <td data-nome="Mediação">{p.mediacao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="ap-miudo">Quem confere é o banco, em cada função, com o papel de quem chama. Esta tabela só descreve.</p>
          </Quadro>
        </>
      ) : null}
      {janela}
    </div>
  );
}
