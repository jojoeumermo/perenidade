// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A porta de entrada no painel de controle da Alumia (components/painel/alumia): o alerta quando o teto da hora foi atingido, os
// números de cada uma das últimas 24 horas (contas novas, pedidos e recusas), os convites (abertos, usados no mês, pedidos na fila
// que vieram por convite) e, só para a coordenação, os ajustes: exigir o passe no banco, o teto da hora, o freio por rede e o teto
// de convites por pessoa. Só números: nada aqui diz quem é quem, e nenhum endereço de rede existe para mostrar.
// Para quem junta: uma aba ou um quadro do painel com <PainelDaPorta papel={papel} /> (o papel vem de usePainelDaAlumia()).
import "./convites.css";
import { useState } from "react";
import { Botao } from "@/components/rede/ui/Botao";
import { rpc } from "@/lib/backend";
import type { PapelNoPainel } from "@/lib/rede/painel/tipos";
import { Campo, Estado, Etiqueta, Ladrilho, Nota, Quadro, textoDoErroDaAlumia, Titulo, useDado } from "@/components/painel/alumia/pecas";

export interface PortaNoPainel {
  ligada: boolean;
  teto_hora: number;
  convites_mes: number;
  rede_contas_hora: number;
  rede_pedidos_hora: number;
  alerta: boolean;
  horas: { hora: string; contas: number; pedidos: number; recusados: number; alerta: boolean }[];
  convites: { abertos: number; usados_no_mes: number; na_fila: number };
}

const formatoDaHora = new Intl.DateTimeFormat("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" });

function Barra({ valor, maximo, tom }: { valor: number; maximo: number; tom: "vermelho" | "dourado" | "cinza" }) {
  const largura = maximo > 0 ? Math.max(valor > 0 ? 4 : 0, Math.round((valor / maximo) * 100)) : 0;
  return (
    <span className="alp-barra">
      <span className="alp-barra-cheia" data-tom={tom} style={{ width: `${largura}%` }} />
      <span className="alp-barra-numero">{valor.toLocaleString("pt-BR")}</span>
    </span>
  );
}

export function PainelDaPorta({ papel, dadosDeExemplo }: { papel: PapelNoPainel; dadosDeExemplo?: PortaNoPainel }) {
  const leitura = useDado<PortaNoPainel>(dadosDeExemplo ? null : "alumia_painel_porta");
  const [aberto] = useState(() => Date.now());
  const dados = dadosDeExemplo ?? leitura.dados;
  if (!dados) return <Estado leitura={leitura} />;
  const agora = dados.horas.at(-1);
  const daHora = agora && new Date(agora.hora).getTime() >= aberto - 3_600_000 ? agora : null;
  const comMovimento = [...dados.horas].reverse().filter((h) => h.contas + h.pedidos + h.recusados > 0);
  const maximo = Math.max(dados.teto_hora, ...dados.horas.map((h) => Math.max(h.contas, h.pedidos, h.recusados)));

  return (
    <div className="ap-tela">
      <Titulo
        nome="Porta de entrada"
        sobre="Conta nova e pedido de entrada passam por uma prova feita no aparelho (sem serviço de fora), um freio por rede e um teto da casa por hora. O banco não recebe endereço de rede nem a impressão do painel: o freio usa um resumo que muda a cada hora."
      >
        <Etiqueta tom={dados.ligada ? "papel" : undefined}>{dados.ligada ? "banco exige o passe" : "banco ainda não exige o passe"}</Etiqueta>
      </Titulo>

      {dados.alerta ? (
        <Nota tom="perigo">
          O teto desta hora ({dados.teto_hora}) foi atingido. Contas e pedidos novos esperam a próxima hora; pedido com convite válido passa. A coordenação recebeu um aviso.
        </Nota>
      ) : null}

      <div className="ap-ladrilhos">
        <Ladrilho numero={daHora?.contas ?? 0} nome="Contas nesta hora" nota={`teto ${dados.teto_hora}`} aceso={(daHora?.contas ?? 0) >= dados.teto_hora * 0.75} />
        <Ladrilho numero={daHora?.pedidos ?? 0} nome="Pedidos nesta hora" nota={`teto ${dados.teto_hora}`} aceso={(daHora?.pedidos ?? 0) >= dados.teto_hora * 0.75} />
        <Ladrilho numero={daHora?.recusados ?? 0} nome="Recusados nesta hora" nota="freio, teto, rede barrada ou desafio repetido" aceso={(daHora?.recusados ?? 0) > 0 ? "urgente" : false} />
        <Ladrilho numero={dados.convites.abertos} nome="Convites abertos" nota={`teto de ${dados.convites_mes} por pessoa no mês`} />
        <Ladrilho numero={dados.convites.usados_no_mes} nome="Convites usados" nota="neste mês" />
        <Ladrilho numero={dados.convites.na_fila} nome="Na fila por convite" nota="a marca some na decisão" />
      </div>

      <div className="ap-duas">
        <Quadro titulo="Últimas 24 horas">
          {comMovimento.length === 0 ? (
            <p className="ap-miudo">Nenhuma conta nem pedido nas últimas 24 horas.</p>
          ) : (
            <div className="ap-tabela-caixa">
              <table className="ap-tabela alp-tabela">
                <thead>
                  <tr>
                    <th scope="col">Hora</th>
                    <th scope="col">Contas</th>
                    <th scope="col">Pedidos</th>
                    <th scope="col">Recusados</th>
                  </tr>
                </thead>
                <tbody>
                  {comMovimento.map((h) => (
                    <tr key={h.hora}>
                      <td>
                        {formatoDaHora.format(new Date(h.hora))}
                        {h.alerta ? <span className="alp-teto"> teto</span> : null}
                      </td>
                      <td data-nome="Contas"><Barra valor={h.contas} maximo={maximo} tom="vermelho" /></td>
                      <td data-nome="Pedidos"><Barra valor={h.pedidos} maximo={maximo} tom="dourado" /></td>
                      <td data-nome="Recusados"><Barra valor={h.recusados} maximo={maximo} tom="cinza" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Quadro>
        <Ajustes papel={papel} dados={dados} aoSalvar={leitura.recarregar} />
      </div>
    </div>
  );
}

function Ajustes({ papel, dados, aoSalvar }: { papel: PapelNoPainel; dados: PortaNoPainel; aoSalvar: () => void }) {
  const [r, setR] = useState({ ligada: dados.ligada, teto: String(dados.teto_hora), convites: String(dados.convites_mes), contas: String(dados.rede_contas_hora), pedidos: String(dados.rede_pedidos_hora), motivo: "" });
  const [estado, setEstado] = useState<{ ocupado: boolean; msg: string; erro: boolean }>({ ocupado: false, msg: "", erro: false });
  const mudar = (x: Partial<typeof r>) => setR((a) => ({ ...a, ...x }));
  if (papel !== "coordenacao") {
    return (
      <Quadro titulo="Ajustes">
        <ul className="ap-lista">
          <li className="ap-linha"><span className="ap-linha-texto">Teto da casa por hora</span><Etiqueta>{dados.teto_hora}</Etiqueta></li>
          <li className="ap-linha"><span className="ap-linha-texto">Contas por rede, por hora</span><Etiqueta>{dados.rede_contas_hora}</Etiqueta></li>
          <li className="ap-linha"><span className="ap-linha-texto">Pedidos por rede, por hora</span><Etiqueta>{dados.rede_pedidos_hora}</Etiqueta></li>
          <li className="ap-linha"><span className="ap-linha-texto">Convites por pessoa, por mês</span><Etiqueta>{dados.convites_mes}</Etiqueta></li>
        </ul>
        <p className="ap-miudo">Só a coordenação muda estes números.</p>
      </Quadro>
    );
  }
  async function salvar() {
    setEstado({ ocupado: true, msg: "", erro: false });
    try {
      await rpc("alumia_painel_porta_ajustar", {
        p_ligada: r.ligada, p_teto_hora: Number(r.teto), p_convites_mes: Number(r.convites), p_rede_contas_hora: Number(r.contas), p_rede_pedidos_hora: Number(r.pedidos), p_motivo: r.motivo,
      });
      setEstado({ ocupado: false, msg: "Salvo. Vale a partir do próximo pedido.", erro: false });
      mudar({ motivo: "" });
      aoSalvar();
    } catch (e) {
      setEstado({ ocupado: false, msg: textoDoErroDaAlumia(e), erro: true });
    }
  }
  return (
    <Quadro titulo="Ajustes">
      <form className="alp-form" onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
        <label className="alp-marcar">
          <input type="checkbox" checked={r.ligada} onChange={(e) => mudar({ ligada: e.target.checked })} />
          <span>
            <span className="ap-forte">Exigir o passe no banco</span>
            <span className="ap-miudo">Ligue depois de o site novo estar no ar: sem o passe do servidor, o banco recusa o pedido de entrada.</span>
          </span>
        </label>
        <div className="alp-numeros">
          <Campo rotulo="Teto da casa por hora (5 a 5000)">
            <input className="ap-entrada" type="number" min={5} max={5000} value={r.teto} onChange={(e) => mudar({ teto: e.target.value })} />
          </Campo>
          <Campo rotulo="Convites por pessoa, por mês (0 desliga)">
            <input className="ap-entrada" type="number" min={0} max={20} value={r.convites} onChange={(e) => mudar({ convites: e.target.value })} />
          </Campo>
          <Campo rotulo="Contas por rede, por hora">
            <input className="ap-entrada" type="number" min={1} max={50} value={r.contas} onChange={(e) => mudar({ contas: e.target.value })} />
          </Campo>
          <Campo rotulo="Pedidos por rede, por hora">
            <input className="ap-entrada" type="number" min={1} max={50} value={r.pedidos} onChange={(e) => mudar({ pedidos: e.target.value })} />
          </Campo>
        </div>
        <Campo rotulo="Motivo (vai ao registro; 10 a 500 letras)" largo>
          <textarea className="ap-entrada" rows={2} maxLength={500} value={r.motivo} onChange={(e) => mudar({ motivo: e.target.value })} />
        </Campo>
        {estado.msg ? <p className="ap-miudo" role={estado.erro ? "alert" : "status"} data-tom={estado.erro ? "perigo" : undefined}>{estado.msg}</p> : null}
        <Botao type="submit" variante="primario" tamanho="p" disabled={estado.ocupado || r.motivo.trim().length < 10}>
          Salvar os ajustes
        </Botao>
      </form>
    </Quadro>
  );
}
