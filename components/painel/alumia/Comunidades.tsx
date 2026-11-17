// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Botao } from "@/components/rede/ui/Botao";
import { Pilula } from "@/components/rede/ui/Pilula";
import { Selo } from "@/components/rede/ui/Selo";
import { rpc } from "@/lib/backend";
import type { ComunidadeNoPainel, OrgNoPainel, PessoaNaBusca } from "@/lib/rede/painel/tipos";
import { Campo, dia, Estado, Etiqueta, Fita, motivoDe, Nota, quando, Quadro, Titulo, useDado, useJanela, usePainelDaAlumia } from "./pecas";
import { BuscaDePessoa } from "./Pessoas";

const TIPO: Record<string, string> = { aberta: "aberta", restrita: "restrita", fechada: "fechada" };
const REGRA_DO_SELO = "O selo diz que a conta é de quem diz ser, conferida por documento público. Não é apoio do Instituto Lúcia.";

function ListaDeComunidades() {
  const leitura = useDado<ComunidadeNoPainel[]>("alumia_painel_comunidades");
  const { pedir, janela } = useJanela();
  const [nomeando, setNomeando] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "sem-moderacao" | "denunciadas" | "encerradas">("todas");
  const todas = leitura.dados ?? [];
  const faltaModeracao = (c: ComunidadeNoPainel) => !c.encerrada && c.moderacao.length < 2;
  const chave = busca.trim().toLocaleLowerCase("pt-BR");
  const itens = todas.filter(
    (c) =>
      (!chave || c.nome.toLocaleLowerCase("pt-BR").includes(chave) || c.slug.includes(chave)) &&
      (filtro === "todas" || (filtro === "sem-moderacao" ? faltaModeracao(c) : filtro === "denunciadas" ? c.denuncias > 0 : Boolean(c.encerrada))),
  );
  const semModeracao = todas.filter(faltaModeracao).length;

  const criar = () =>
    pedir({
      titulo: "Criar comunidade",
      texto: <p>A comunidade nasce na hora, sem passar pela fila de propostas. Ponha pelo menos duas pessoas na moderação logo em seguida.</p>,
      campos: [
        { tipo: "texto", nome: "nome", rotulo: "Nome (de 3 a 60 letras)", min: 3, max: 60 },
        { tipo: "texto", nome: "slug", rotulo: "Endereço (letras minúsculas, números e hífen)", min: 3, max: 60, aviso: "Vira /alumia/c/endereco. Não muda depois." },
        { tipo: "texto", nome: "descricao", rotulo: "Descrição (até 500 letras)", max: 500, linhas: 3 },
        { tipo: "escolha", nome: "categoria", rotulo: "Categoria", valor: "lutas", opcoes: [{ id: "lutas", nome: "Lutas" }, { id: "instituto", nome: "Instituto" }] },
        {
          tipo: "escolha",
          nome: "tipo",
          rotulo: "Quem entra",
          valor: "aberta",
          opcoes: [
            { id: "aberta", nome: "Aberta: qualquer membro entra" },
            { id: "restrita", nome: "Restrita: entra quem a moderação aceita" },
            { id: "fechada", nome: "Fechada: só por convite" },
          ],
        },
      ],
      confirmar: "Criar",
      fazer: (v) => rpc("alumia_painel_comunidade_criar", { p: { nome: String(v.nome).trim(), slug: String(v.slug).trim().toLowerCase(), descricao: String(v.descricao).trim(), categoria: v.categoria, tipo: v.tipo } }),
      sucesso: "Comunidade criada.",
      depois: leitura.recarregar,
    });
  const fechar = (c: ComunidadeNoPainel, encerrar: boolean) =>
    pedir({
      titulo: encerrar ? "Encerrar a comunidade" : "Reabrir a comunidade",
      texto: <p>{encerrar ? <>Ninguém mais publica em <strong>{c.nome}</strong>. O que já existe continua no ar para leitura. A moderação dela é avisada com o motivo. Dá para reabrir.</> : <><strong>{c.nome}</strong> volta a receber posts.</>}</p>,
      campos: [{ tipo: "motivo" }],
      confirmar: encerrar ? "Encerrar" : "Reabrir",
      perigo: encerrar,
      fazer: (v) => rpc("alumia_painel_comunidade_fechar", { p_slug: c.slug, p_fechar: encerrar, p_motivo: motivoDe(v) }),
      sucesso: encerrar ? "Comunidade encerrada." : "Comunidade reaberta.",
      depois: leitura.recarregar,
    });
  const moderacao = (c: ComunidadeNoPainel, pessoa: { id: string; nome: string }, por: boolean) =>
    pedir({
      titulo: por ? "Pôr na moderação" : "Tirar da moderação",
      texto: <p>{por ? <><strong>{pessoa.nome}</strong> passa a moderar <strong>{c.nome}</strong> e recebe um aviso.</> : <><strong>{pessoa.nome}</strong> deixa de moderar <strong>{c.nome}</strong> e continua como membro.</>}</p>,
      campos: [{ tipo: "motivo" }],
      confirmar: por ? "Pôr na moderação" : "Tirar da moderação",
      perigo: !por,
      fazer: (v) => rpc("alumia_painel_comunidade_moderacao", { p_slug: c.slug, p_id: pessoa.id, p_sim: por, p_motivo: motivoDe(v) }),
      sucesso: por ? "Moderação nomeada." : "Moderação retirada.",
      depois: () => {
        setNomeando(null);
        leitura.recarregar();
      },
    });

  return (
    <>
      <div className="ap-linha-acoes" style={{ justifyContent: "flex-start" }}>
        <Botao variante="claro" onClick={criar}>
          Criar comunidade
        </Botao>
      </div>
      {todas.length > 0 ? (
        <div className="ap-filtros">
          <Campo rotulo="Buscar comunidade">
            <input className="ap-entrada" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou endereço" />
          </Campo>
          <Fita
            rotulo="Mostrar"
            atual={filtro}
            escolher={setFiltro}
            opcoes={[
              { id: "todas", nome: "Todas", conta: todas.length },
              { id: "sem-moderacao", nome: "Faltando moderação", conta: semModeracao },
              { id: "denunciadas", nome: "Com denúncia", conta: todas.filter((c) => c.denuncias > 0).length },
              { id: "encerradas", nome: "Encerradas", conta: todas.filter((c) => c.encerrada).length },
            ]}
          />
        </div>
      ) : null}
      {semModeracao > 0 && filtro === "todas" ? (
        <Nota>
          {semModeracao === 1 ? "1 comunidade tem" : `${semModeracao} comunidades têm`} menos de 2 pessoas moderando. Veja em “Faltando moderação”.
        </Nota>
      ) : null}
      <Estado leitura={leitura} eVazio={Boolean(leitura.dados) && itens.length === 0} vazio={todas.length ? "Nenhuma comunidade com essa busca." : "Nenhuma comunidade ainda."} />
      {itens.length > 0 ? (
        <Quadro>
          <ul className="ap-lista">
            {itens.map((c) => (
              <li key={c.slug} className="ap-linha" style={{ alignItems: "start" }}>
                <span className="ap-linha-texto">
                  <span className="ap-linha-cabeca">
                    <Pilula texto={c.nome} slug={c.slug} tamanho="p" />
                    <span className="ap-miudo">/c/{c.slug}</span>
                    <Etiqueta>{TIPO[c.tipo] ?? c.tipo}</Etiqueta>
                    {c.encerrada ? <Etiqueta tom="vermelho">encerrada em {dia(c.encerrada.em)}</Etiqueta> : null}
                    {c.denuncias > 0 ? <Etiqueta tom="vermelho">{c.denuncias === 1 ? "1 denúncia aberta" : `${c.denuncias} denúncias abertas`}</Etiqueta> : null}
                    {filtro === "sem-moderacao" && faltaModeracao(c) ? <Etiqueta tom="dourado">menos de 2 moderando</Etiqueta> : null}
                  </span>
                  <span className="ap-miudo">
                    {c.membros} {c.membros === 1 ? "membro" : "membros"} · {c.posts_30} posts em 30 dias · criada em {dia(c.criada_em)}
                  </span>
                  {c.encerrada ? <span className="ap-miudo ap-quebra">Motivo do encerramento: {c.encerrada.motivo}</span> : null}
                  <span className="ap-etiquetas">
                    <span className="ap-miudo">Moderação:</span>
                    {c.moderacao.length === 0 ? <span className="ap-miudo">ninguém</span> : null}
                    {c.moderacao.map((m) => (
                      <button key={m.id} type="button" className="ap-fita-botao" style={{ minHeight: 30, fontSize: "0.75rem" }} title="Tirar da moderação" onClick={() => moderacao(c, m, false)}>
                        {m.nome} <span aria-hidden>×</span>
                        <span className="sr-only">: tirar da moderação</span>
                      </button>
                    ))}
                  </span>
                  {nomeando === c.slug ? (
                    <div style={{ maxWidth: "30rem", marginTop: "0.4rem" }}>
                      <BuscaDePessoa rotulo="Quem vai moderar (codinome ou @)" aoEscolher={(p: PessoaNaBusca) => moderacao(c, { id: p.id, nome: p.codinome }, true)} />
                    </div>
                  ) : null}
                </span>
                <span className="ap-linha-acoes">
                  <Botao variante="contorno" tamanho="p" onClick={() => setNomeando(nomeando === c.slug ? null : c.slug)}>
                    {nomeando === c.slug ? "Fechar a busca" : "Pôr moderação"}
                  </Botao>
                  {c.encerrada ? (
                    <Botao variante="claro" tamanho="p" onClick={() => fechar(c, false)}>
                      Reabrir
                    </Botao>
                  ) : (
                    <Botao variante="contorno" className="ap-destrutivo" tamanho="p" onClick={() => fechar(c, true)}>
                      Encerrar
                    </Botao>
                  )}
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

function Organizacoes() {
  const leitura = useDado<OrgNoPainel[]>("alumia_painel_orgs");
  const { pedir, janela } = useJanela();
  const itens = leitura.dados ?? [];

  const decidirPedido = (o: OrgNoPainel, aceitar: boolean) =>
    pedir({
      titulo: aceitar ? "Dar o selo" : "Recusar o pedido de selo",
      texto: (
        <p>
          {aceitar ? (
            <>
              <strong>{o.codinome}</strong> recebe o selo de organização verificada, com o documento público do pedido ({o.pedido?.documento_tipo}: {o.pedido?.documento}). Confira o documento na fonte pública antes.
            </>
          ) : (
            <>
              O pedido de <strong>{o.codinome}</strong> é recusado. Quem cuida da organização lê o motivo.
            </>
          )}
        </p>
      ),
      campos: [{ tipo: "motivo", opcional: aceitar, rotulo: aceitar ? "Anotação para o registro (opcional)" : undefined, aviso: aceitar ? undefined : "Quem cuida da organização lê este motivo." }],
      confirmar: aceitar ? "Dar o selo" : "Recusar",
      perigo: !aceitar,
      fazer: (v) => rpc("alumia_painel_org_pedido_decidir", { p_id: o.pedido?.id, p_aceitar: aceitar, p_motivo: motivoDe(v) }),
      sucesso: aceitar ? "Selo dado." : "Pedido recusado.",
      depois: leitura.recarregar,
    });
  const selo = (o: OrgNoPainel, dar: boolean) =>
    pedir({
      titulo: dar ? "Dar o selo sem pedido" : "Tirar o selo",
      texto: <p>{dar ? <><strong>{o.codinome}</strong> recebe o selo direto, sem pedido na fila. Só faça isso se você conferiu o documento público por outro caminho.</> : <><strong>{o.codinome}</strong> perde o selo. Quem cuida da organização é avisado com o motivo.</>}</p>,
      campos: [{ tipo: "motivo" }],
      confirmar: dar ? "Dar o selo" : "Tirar o selo",
      perigo: !dar,
      fazer: (v) => rpc("alumia_painel_org_selo", { p_org: o.id, p_dar: dar, p_motivo: motivoDe(v) }),
      sucesso: dar ? "Selo dado." : "Selo retirado.",
      depois: leitura.recarregar,
    });

  return (
    <>
      <Nota>O selo diz uma coisa só: a conta é de quem diz ser, conferida por documento público (CNPJ, registro de partido, estatuto). Não é apoio do Instituto e não dá alcance a mais. Documento de pessoa (CPF, RG) nunca entra. Quem cuida de cada organização não aparece aqui.</Nota>
      <Estado leitura={leitura} eVazio={Boolean(leitura.dados) && itens.length === 0} vazio="Nenhuma organização na Alumia ainda." />
      {itens.length > 0 ? (
        <Quadro>
          <ul className="ap-lista">
            {itens.map((o) => (
              <li key={o.id} className="ap-linha" style={{ alignItems: "start" }}>
                <span className="ap-linha-texto">
                  <span className="ap-linha-cabeca">
                    <span className="ap-forte">{o.codinome}</span>
                    {o.handle ? <span className="ap-miudo">@{o.handle}</span> : null}
                    {o.selo ? <Selo texto="Organização verificada" regra={REGRA_DO_SELO} desde={`desde ${dia(o.selo)}`} /> : <Etiqueta>sem selo</Etiqueta>}
                    {o.pedido ? <Etiqueta tom="dourado">pedido de selo esperando</Etiqueta> : null}
                    {o.suspensa ? <Etiqueta tom="vermelho">suspensa</Etiqueta> : null}
                  </span>
                  <span className="ap-miudo">
                    {o.tipo}
                    {o.cidade ? ` · ${o.cidade}` : ""} · criada em {dia(o.criada_em)}
                    {o.selo && o.documento ? ` · ${o.documento_tipo}: ${o.documento}` : ""}
                  </span>
                  {o.pedido ? (
                    <span className="ap-nota">
                      <span>
                        <span className="ap-forte">
                          Pedido de {quando(o.pedido.criado_em)} · {o.pedido.documento_tipo}: {o.pedido.documento}
                        </span>
                        {o.pedido.sobre ? <span className="ap-quebra" style={{ display: "block" }}>{o.pedido.sobre}</span> : null}
                      </span>
                    </span>
                  ) : null}
                </span>
                <span className="ap-linha-acoes">
                  {o.pedido ? (
                    <>
                      <Botao variante="claro" tamanho="p" onClick={() => decidirPedido(o, true)}>
                        Dar o selo
                      </Botao>
                      <Botao variante="contorno" tamanho="p" onClick={() => decidirPedido(o, false)}>
                        Recusar
                      </Botao>
                    </>
                  ) : o.selo ? (
                    <Botao variante="contorno" className="ap-destrutivo" tamanho="p" onClick={() => selo(o, false)}>
                      Tirar o selo
                    </Botao>
                  ) : (
                    <Botao variante="contorno" tamanho="p" onClick={() => selo(o, true)}>
                      Dar o selo sem pedido
                    </Botao>
                  )}
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

/** Comunidades (criar, encerrar, reabrir, trocar a moderação) e organizações (pedidos de selo, dar e tirar o selo). */
export function Comunidades() {
  const { foco, geral } = usePainelDaAlumia();
  const [parte, setParte] = useState<"comunidades" | "organizacoes">(foco === "organizacoes" ? "organizacoes" : "comunidades");
  return (
    <div className="ap-tela">
      <Titulo nome="Comunidades e organizações" sobre="Criar e encerrar comunidade, trocar quem modera, e cuidar do selo das organizações. Comunidade proposta por membro continua chegando em “Rede: propostas de comunidade”, no painel interno." />
      <Fita
        rotulo="Parte"
        atual={parte}
        escolher={setParte}
        opcoes={[
          { id: "comunidades", nome: `Comunidades${geral ? ` · ${geral.numeros.comunidades}` : ""}` },
          { id: "organizacoes", nome: `Organizações${geral ? ` · ${geral.numeros.organizacoes}` : ""}`, conta: geral?.numeros.selos_esperando },
        ]}
      />
      {parte === "comunidades" ? <ListaDeComunidades /> : <Organizacoes />}
    </div>
  );
}
