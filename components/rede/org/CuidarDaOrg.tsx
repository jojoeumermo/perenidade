// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// "Cuidar da conta": o que só quem gerencia a organização faz, no próprio perfil dela (aparece só quando o banco diz `gerencio`,
// que é sobre quem olha e nunca diz quem mais cuida). Registrar um voto em "Como votamos" (com a fonte pública), criar núcleo,
// aceitar ou recusar pedidos para entrar, abrir consulta à base (a regra fica escrita antes e não muda), marcar e conduzir
// plenária (pôr no ar, encerrar, marcar respondida, tirar da fila só por regra escrita) e pôr ou tirar quem cuida da conta.
// Cada ação chama a função do banco (lib/rede/cliente-org.ts), que confere de novo se a pessoa gerencia (PLANO-ALUMIA §5 F4, §7.4).
// Não há prancha desta parte: segue a linguagem dos formulários da F4 (Pedir o selo).
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaOrg } from "@/lib/rede/textos-org";
import type { OrgPublica, PedidoDeConsulta, PedidoDeNucleo, PedidoDePlenaria, PedidoDeVotacao, PedidoParaONucleo, VotacaoDaOrg } from "@/lib/rede/tipos-org";
import { Botao } from "../ui/Botao";

type MotivoDeTirar = "ofensa" | "dado_pessoal" | "fora_do_tema" | "repetida";
const MOTIVOS: MotivoDeTirar[] = ["ofensa", "dado_pessoal", "fora_do_tema", "repetida"];
const VOTOS: VotacaoDaOrg["voto"][] = ["sim", "nao", "abstencao", "obstrucao", "ausente"];

/** As ações de quem gerencia, já presas ao @ da organização. */
export interface AcoesDeGestor {
  registrarVotacao: (v: PedidoDeVotacao) => Promise<unknown>;
  criarNucleo: (p: PedidoDeNucleo) => Promise<unknown>;
  pedidos: () => Promise<PedidoParaONucleo[]>;
  decidirNucleo: (nucleo: string, handle: string, aceitar: boolean) => Promise<unknown>;
  abrirConsulta: (p: PedidoDeConsulta) => Promise<unknown>;
  abrirPlenaria: (p: PedidoDePlenaria) => Promise<unknown>;
  mudarPlenaria: (id: string, situacao: "ao_vivo" | "encerrada") => Promise<unknown>;
  responder: (pergunta: string) => Promise<unknown>;
  retirar: (pergunta: string, motivo: MotivoDeTirar) => Promise<unknown>;
  adicionarGestor: (handle: string) => Promise<unknown>;
  removerGestor: (handle: string) => Promise<unknown>;
  sair: () => Promise<unknown>;
}

/** "AAAA-MM-DDTHH:MM" do campo de data e hora vira ISO; vazio ou inválido vira "". */
function isoDoCampo(v: string): string {
  const d = new Date(v);
  return v && !Number.isNaN(d.getTime()) ? d.toISOString() : "";
}

export function CuidarDaOrg({ org, t, acoes, aoMudar }: { org: OrgPublica; t: TextosDaOrg; acoes: AcoesDeGestor; aoMudar: () => void }) {
  const tc = t.cuidar;
  const id = useId();
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pedidos, setPedidos] = useState<PedidoParaONucleo[] | null>(null);
  const [motivos, setMotivos] = useState<Record<string, MotivoDeTirar>>({});

  // Formulários (texto cru; o banco confere tudo de novo).
  const [voto, setVoto] = useState<PedidoDeVotacao>({ data: "", projeto: "", voto: "sim", porque: "", resultado: "", fonte: "" });
  const [nucleo, setNucleo] = useState<PedidoDeNucleo>({ nome: "", quando: "", onde: "", cor: 1 });
  const [consulta, setConsulta] = useState({ pergunta: "", metodo: "simples" as PedidoDeConsulta["metodo"], opcoes: "", prazo: "", quorum: "", compromisso: "" });
  const [plenaria, setPlenaria] = useState({ titulo: "", descricao: "", inicio: "", sala: "" });
  const [gestor, setGestor] = useState("");

  async function fazer(f: () => Promise<unknown>, depois?: () => void) {
    setOcupado(true);
    setAviso(null);
    try {
      await f();
      depois?.();
      setAviso({ ok: true, texto: tc.feito });
      aoMudar();
    } catch (e) {
      const codigo = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
      setAviso({ ok: false, texto: codigo === "banco_desatualizado" || codigo === "sem_servico" ? t.erros.semBanco : t.erros.falha });
    } finally {
      setOcupado(false);
    }
  }
  const enviar = (f: () => Promise<unknown>, depois?: () => void) => (e: FormEvent) => {
    e.preventDefault();
    void fazer(f, depois);
  };
  async function verPedidos() {
    setOcupado(true);
    setAviso(null);
    try {
      setPedidos(await acoes.pedidos());
    } catch {
      setAviso({ ok: false, texto: t.erros.falha });
    } finally {
      setOcupado(false);
    }
  }

  const campo = (rotulo: string, entrada: ReactNode, ajuda?: string) => (
    <label className="al-campo">
      <span>{rotulo}</span>
      {entrada}
      {ajuda ? <small>{ajuda}</small> : null}
    </label>
  );

  return (
    <section className="al-perfil-bloco al-cuidar" aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className="al-cond">
        {tc.titulo}
      </h2>
      <p className="al-perfil-nota">{tc.ajuda}</p>
      {aviso ? (
        <p className={aviso.ok ? "al-ok" : "al-perfil-erro"} role={aviso.ok ? "status" : "alert"}>
          {aviso.texto}
        </p>
      ) : null}

      <details className="al-cuidar-parte">
        <summary>{tc.voto.titulo}</summary>
        <form className="al-form" onSubmit={enviar(() => acoes.registrarVotacao(voto), () => setVoto({ data: "", projeto: "", voto: "sim", porque: "", resultado: "", fonte: "" }))}>
          {campo(tc.voto.data, <input className="al-entrada" type="date" required value={voto.data} onChange={(e) => setVoto({ ...voto, data: e.target.value })} />)}
          {campo(tc.voto.projeto, <input className="al-entrada" required maxLength={200} value={voto.projeto} onChange={(e) => setVoto({ ...voto, projeto: e.target.value })} />)}
          {campo(
            tc.voto.voto,
            <select className="al-entrada" value={voto.voto} onChange={(e) => setVoto({ ...voto, voto: e.target.value as VotacaoDaOrg["voto"] })}>
              {VOTOS.map((v) => (
                <option key={v} value={v}>
                  {tc.voto.votos[v]}
                </option>
              ))}
            </select>,
          )}
          {campo(tc.voto.porque, <textarea className="al-entrada" maxLength={500} value={voto.porque} onChange={(e) => setVoto({ ...voto, porque: e.target.value })} />)}
          {campo(tc.voto.resultado, <input className="al-entrada" maxLength={120} value={voto.resultado} onChange={(e) => setVoto({ ...voto, resultado: e.target.value })} />)}
          {campo(tc.voto.fonte, <input className="al-entrada" type="url" required pattern="https?://.+" maxLength={500} value={voto.fonte ?? ""} onChange={(e) => setVoto({ ...voto, fonte: e.target.value })} />, tc.voto.fonteAjuda)}
          <Botao type="submit" variante="primario" disabled={ocupado}>
            {tc.voto.mandar}
          </Botao>
        </form>
      </details>

      <details className="al-cuidar-parte">
        <summary>{tc.nucleo.titulo}</summary>
        <form className="al-form" onSubmit={enviar(() => acoes.criarNucleo(nucleo), () => setNucleo({ nome: "", quando: "", onde: "", cor: 1 }))}>
          {campo(tc.nucleo.nome, <input className="al-entrada" required minLength={3} maxLength={80} value={nucleo.nome} onChange={(e) => setNucleo({ ...nucleo, nome: e.target.value })} />)}
          {campo(tc.nucleo.quando, <input className="al-entrada" maxLength={60} value={nucleo.quando} onChange={(e) => setNucleo({ ...nucleo, quando: e.target.value })} />)}
          {campo(tc.nucleo.onde, <input className="al-entrada" maxLength={80} value={nucleo.onde} onChange={(e) => setNucleo({ ...nucleo, onde: e.target.value })} />)}
          {campo(
            tc.nucleo.cor,
            <select className="al-entrada" value={nucleo.cor} onChange={(e) => setNucleo({ ...nucleo, cor: Number(e.target.value) as PedidoDeNucleo["cor"] })}>
              {[1, 2, 3, 4, 5].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>,
          )}
          <Botao type="submit" variante="primario" disabled={ocupado}>
            {tc.nucleo.mandar}
          </Botao>
        </form>
      </details>

      <details className="al-cuidar-parte">
        <summary>{tc.pedidos.titulo}</summary>
        <p className="al-perfil-nota">{tc.pedidos.ajuda}</p>
        <Botao variante="contorno" tamanho="p" disabled={ocupado} onClick={() => void verPedidos()}>
          {tc.pedidos.ver}
        </Botao>
        {pedidos ? (
          pedidos.length === 0 ? (
            <p className="al-painel-vazio">{tc.pedidos.vazio}</p>
          ) : (
            <ul className="al-lista-simples">
              {pedidos.map((p) => (
                <li key={`${p.nucleo}-${p.handle}`} className="al-cuidar-linha">
                  <span>{preencher(tc.pedidos.de, { codinome: p.codinome ?? "", handle: p.handle ?? "", nucleo: p.nucleoNome })}</span>
                  <span className="al-cuidar-botoes">
                    <Botao variante="primario" tamanho="p" disabled={ocupado || !p.handle} onClick={() => void fazer(() => acoes.decidirNucleo(p.nucleo, p.handle ?? "", true), () => setPedidos((l) => l?.filter((x) => x !== p) ?? null))}>
                      {tc.pedidos.aceitar}
                    </Botao>
                    <Botao variante="contorno" tamanho="p" disabled={ocupado || !p.handle} onClick={() => void fazer(() => acoes.decidirNucleo(p.nucleo, p.handle ?? "", false), () => setPedidos((l) => l?.filter((x) => x !== p) ?? null))}>
                      {tc.pedidos.recusar}
                    </Botao>
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </details>

      <details className="al-cuidar-parte">
        <summary>{tc.consulta.titulo}</summary>
        <p className="al-perfil-nota">{tc.consulta.ajuda}</p>
        <form
          className="al-form"
          onSubmit={enviar(
            () =>
              acoes.abrirConsulta({
                pergunta: consulta.pergunta.trim(),
                metodo: consulta.metodo,
                opcoes: consulta.opcoes.split("\n").map((o) => o.trim()).filter(Boolean),
                prazo: isoDoCampo(consulta.prazo),
                compromisso: consulta.compromisso.trim(),
                quorum: consulta.quorum ? Number(consulta.quorum) : null,
                nucleos: [],
              }),
            () => setConsulta({ pergunta: "", metodo: "simples", opcoes: "", prazo: "", quorum: "", compromisso: "" }),
          )}
        >
          {campo(tc.consulta.pergunta, <input className="al-entrada" required minLength={5} maxLength={280} value={consulta.pergunta} onChange={(e) => setConsulta({ ...consulta, pergunta: e.target.value })} />)}
          {campo(
            tc.consulta.metodo,
            <select className="al-entrada" value={consulta.metodo} onChange={(e) => setConsulta({ ...consulta, metodo: e.target.value as PedidoDeConsulta["metodo"] })}>
              <option value="simples">{tc.consulta.simples}</option>
              <option value="ranqueada">{tc.consulta.ranqueada}</option>
            </select>,
          )}
          {campo(tc.consulta.opcoes, <textarea className="al-entrada" required value={consulta.opcoes} onChange={(e) => setConsulta({ ...consulta, opcoes: e.target.value })} />)}
          {campo(tc.consulta.prazo, <input className="al-entrada" type="datetime-local" required value={consulta.prazo} onChange={(e) => setConsulta({ ...consulta, prazo: e.target.value })} />)}
          {campo(tc.consulta.quorum, <input className="al-entrada" type="number" min={3} inputMode="numeric" value={consulta.quorum} onChange={(e) => setConsulta({ ...consulta, quorum: e.target.value })} />)}
          {campo(tc.consulta.compromisso, <textarea className="al-entrada" required minLength={10} maxLength={500} value={consulta.compromisso} onChange={(e) => setConsulta({ ...consulta, compromisso: e.target.value })} />)}
          <Botao type="submit" variante="primario" disabled={ocupado}>
            {tc.consulta.mandar}
          </Botao>
        </form>
      </details>

      <details className="al-cuidar-parte">
        <summary>{tc.plenaria.titulo}</summary>
        <form
          className="al-form"
          onSubmit={enviar(
            () => acoes.abrirPlenaria({ titulo: plenaria.titulo.trim(), descricao: plenaria.descricao.trim(), inicio: isoDoCampo(plenaria.inicio), sala: plenaria.sala.trim() || null }),
            () => setPlenaria({ titulo: "", descricao: "", inicio: "", sala: "" }),
          )}
        >
          {campo(tc.plenaria.nome, <input className="al-entrada" required minLength={3} maxLength={120} value={plenaria.titulo} onChange={(e) => setPlenaria({ ...plenaria, titulo: e.target.value })} />)}
          {campo(tc.plenaria.descricao, <textarea className="al-entrada" maxLength={500} value={plenaria.descricao} onChange={(e) => setPlenaria({ ...plenaria, descricao: e.target.value })} />)}
          {campo(tc.plenaria.inicio, <input className="al-entrada" type="datetime-local" required value={plenaria.inicio} onChange={(e) => setPlenaria({ ...plenaria, inicio: e.target.value })} />)}
          {campo(tc.plenaria.sala, <input className="al-entrada" type="url" pattern="https://.+" maxLength={300} value={plenaria.sala} onChange={(e) => setPlenaria({ ...plenaria, sala: e.target.value })} />)}
          <Botao type="submit" variante="primario" disabled={ocupado}>
            {tc.plenaria.mandar}
          </Botao>
        </form>
        {org.plenarias.map((p) => (
          <div key={p.id} className="al-cuidar-plenaria">
            <h3 className="al-cond">{preencher(tc.plenaria.fila, { titulo: p.titulo })}</h3>
            <span className="al-cuidar-botoes">
              {!p.aoVivo ? (
                <Botao variante="primario" tamanho="p" disabled={ocupado} onClick={() => void fazer(() => acoes.mudarPlenaria(p.id, "ao_vivo"))}>
                  {tc.plenaria.noAr}
                </Botao>
              ) : null}
              <Botao variante="contorno" tamanho="p" disabled={ocupado} onClick={() => void fazer(() => acoes.mudarPlenaria(p.id, "encerrada"))}>
                {tc.plenaria.encerrar}
              </Botao>
            </span>
            <p className="al-perfil-nota">{tc.plenaria.ajudaFila}</p>
            {p.fila.length === 0 ? (
              <p className="al-painel-vazio">{tc.plenaria.filaVazia}</p>
            ) : (
              <ol className="al-lista-simples">
                {p.fila.map((q) => (
                  <li key={q.id} className="al-cuidar-linha">
                    <span>
                      {q.handle ? <b>@{q.handle} </b> : null}
                      {q.texto}
                    </span>
                    <span className="al-cuidar-botoes">
                      <Botao variante="claro" tamanho="p" pressionado={q.respondida} disabled={ocupado || q.respondida} onClick={() => void fazer(() => acoes.responder(q.id))}>
                        {tc.plenaria.respondida}
                      </Botao>
                      <select className="al-entrada al-cuidar-motivo" aria-label={tc.plenaria.motivo} value={motivos[q.id] ?? "ofensa"} onChange={(e) => setMotivos((m) => ({ ...m, [q.id]: e.target.value as MotivoDeTirar }))}>
                        {MOTIVOS.map((m) => (
                          <option key={m} value={m}>
                            {tc.plenaria.motivos[m]}
                          </option>
                        ))}
                      </select>
                      <Botao variante="contorno" tamanho="p" disabled={ocupado} onClick={() => void fazer(() => acoes.retirar(q.id, motivos[q.id] ?? "ofensa"))}>
                        {tc.plenaria.tirar}
                      </Botao>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </details>

      <details className="al-cuidar-parte">
        <summary>{tc.gestores.titulo}</summary>
        <p className="al-perfil-nota">{tc.gestores.ajuda}</p>
        <form className="al-form" onSubmit={enviar(() => acoes.adicionarGestor(gestor.trim()), () => setGestor(""))}>
          {campo(tc.gestores.handle, <input className="al-entrada" required pattern="@?[a-z0-9_]{3,20}" maxLength={21} autoComplete="off" value={gestor} onChange={(e) => setGestor(e.target.value)} />)}
          <span className="al-cuidar-botoes">
            <Botao type="submit" variante="primario" disabled={ocupado}>
              {tc.gestores.adicionar}
            </Botao>
            <Botao variante="contorno" disabled={ocupado || !gestor.trim()} onClick={() => void fazer(() => acoes.removerGestor(gestor.trim()), () => setGestor(""))}>
              {tc.gestores.remover}
            </Botao>
          </span>
        </form>
        <Botao variante="fantasma" tamanho="p" disabled={ocupado} onClick={() => void fazer(() => acoes.sair())}>
          {tc.gestores.sair}
        </Botao>
      </details>
    </section>
  );
}
