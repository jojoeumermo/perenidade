// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A sala vista de um navegador. Quem cria a sala é o anfitrião: guarda o estado (lib/jogos/grupo/motor.ts), aplica as
// ações que chegam e transmite a vista pública. Quem entra só manda ações e desenha a vista que recebe. Se o anfitrião
// some, a pessoa que chegou antes assume (motor.ts: sucessor e assumirSala). Nada vai para banco nenhum.
//
// T33: cada mensagem vai assinada pela chave desta aba (./assinatura.ts), anunciada na presença. O anfitrião só aplica
// ação de quem está na presença, com a assinatura daquele id, e nunca uma que diga vir dele mesmo (as dele são aplicadas
// aqui, sem passar pela rede). Quem joga só aceita a vista assinada pelo anfitrião que diz mandá-la. O comando da sala só
// muda quando o anfitrião sai da presença, ou para a sala com mais gente DE VERDADE na presença (a lista de jogadores que
// vem dentro da vista não conta). E o texto que chega passa pelo filtro de contato antes de aparecer (sala.ts).
import { useCallback, useEffect, useRef, useState } from "react";
import { aplicar, assumirSala, salaNova, sucessor, vistaPublica, type Acao, type EstadoDaSala, type IdDoJogoEmGrupo, type VistaDaSala } from "@/lib/jogos/grupo/motor";
import { vistaSemContato } from "@/lib/jogos/grupo/sala";
import { hasBackend } from "@/lib/backend";
import { assinar, criarConferencia, novasChaves, textoAssinado, type ChavesDaAba } from "./assinatura";
import { abrirCanal, idSorteado, type CanalDaSala, type Mensagem, type Presenca } from "./canal";

export type Conexao = "conectando" | "na-sala" | "nao-achou" | "falhou" | "cheia" | "expulso" | "colisao";

const PARTIDAS = new Set(["perguntas", "debate", "forca", "bingo", "fio"]);

/** A vista que chegou pela rede passa por uma conferência de forma (quem manda pode não ser o site). */
export function vistaValida(v: unknown, codigo: string): v is VistaDaSala {
  const x = v as Partial<VistaDaSala> | null;
  if (!(x && typeof x === "object" && x.codigo === codigo && typeof x.versao === "number" && typeof x.anfitriao === "string" && Array.isArray(x.jogadores) && x.jogadores.length <= 60 && typeof x.fase === "string")) return false;
  if (!x.jogadores.every((j) => j && typeof j === "object" && typeof j.id === "string" && typeof j.apelido === "string")) return false;
  // Partida no ar precisa ter forma de partida: sem isso, a tela de todo mundo quebrava (T33).
  if (x.fase === "jogando") {
    const p = x.partida as { tipo?: unknown } | null | undefined;
    if (!p || typeof p !== "object" || typeof p.tipo !== "string" || !PARTIDAS.has(p.tipo)) return false;
  }
  return true;
}

export interface Sala {
  eu: string;
  vista: VistaDaSala | null;
  /** Quando a última vista chegou (o relógio de cada rodada conta a partir daqui). */
  recebidaEm: number;
  conexao: Conexao;
  modo: "tempo-real" | "abas";
  souAnfitriao: boolean;
  agir: (acao: Acao) => void;
}

export function useSala({ codigo, apelido, criar, jogoInicial }: { codigo: string; apelido: string; criar: boolean; jogoInicial: IdDoJogoEmGrupo }): Sala {
  const [eu] = useState(idSorteado);
  const [vista, setVista] = useState<VistaDaSala | null>(null);
  const [recebidaEm, setRecebidaEm] = useState(0);
  const [conexao, setConexao] = useState<Conexao>("conectando");
  const [souAnfitriao, setSouAnfitriao] = useState(false);

  const estado = useRef<EstadoDaSala | null>(null);
  const ultima = useRef<VistaDaSala | null>(null);
  const canal = useRef<CanalDaSala | null>(null);
  const presentes = useRef<string[]>([]);
  const jaVistos = useRef(new Set<string>());
  const estiveNaSala = useRef(false);
  const chaves = useRef<ChavesDaAba | null>(null);
  const conferencia = useRef(criarConferencia());
  const numero = useRef(0);
  /** Os envios saem em fila: a assinatura é assíncrona, e o número de cada mensagem precisa chegar em ordem. */
  const envios = useRef<Promise<void>>(Promise.resolve());

  const mostrar = useCallback((v: VistaDaSala) => {
    ultima.current = v;
    setVista(v);
    setRecebidaEm(Date.now());
  }, []);

  /** Assina e manda. Sem chave (página sem Web Crypto), não manda: ninguém aceitaria. */
  const enviar = useCallback(
    (m: { tipo: "estado" | "acao"; carga: unknown }) => {
      envios.current = envios.current.then(async () => {
        const minhas = chaves.current;
        const c = canal.current;
        if (!minhas || !c) return;
        const n = ++numero.current;
        const assinatura = await assinar(minhas, textoAssinado(codigo, m.tipo, eu, n, m.carga)).catch(() => "");
        if (assinatura) c.enviar({ ...m, de: eu, n, assinatura } as Mensagem);
      });
    },
    [codigo, eu],
  );

  /** O anfitrião guarda o estado novo, desenha e transmite a vista. */
  const publicar = useCallback(
    (e: EstadoDaSala) => {
      estado.current = e;
      const v = vistaPublica(e, Date.now());
      mostrar(v);
      enviar({ tipo: "estado", carga: v });
    },
    [mostrar, enviar],
  );

  const comoAnfitriao = useCallback(
    (de: string, acao: Acao) => {
      const e = estado.current;
      if (!e) return;
      const novo = aplicar(e, de, acao, Date.now());
      if (novo !== e) publicar(novo);
      // Quem acabou de chegar (ou voltou) recebe a sala mesmo se nada mudou.
      else if (acao?.t === "entrar") enviar({ tipo: "estado", carga: vistaPublica(e, Date.now()) });
    },
    [publicar, enviar],
  );

  const agir = useCallback(
    (acao: Acao) => {
      if (estado.current) comoAnfitriao(eu, acao);
      else enviar({ tipo: "acao", carga: acao });
    },
    [eu, comoAnfitriao, enviar],
  );

  useEffect(() => {
    let vivo = true;
    const relogios: number[] = [];
    const depois = (ms: number, f: () => void) => relogios.push(window.setTimeout(() => vivo && f(), ms));
    /** Quantos jogadores da vista estão de verdade na presença do canal (a lista da vista, sozinha, não prova nada). */
    const presentesDe = (lista: { id: string; fora?: boolean }[]) => lista.filter((j) => !j.fora && presentes.current.includes(j.id)).length;
    let fila: Promise<void> = Promise.resolve();

    const assumirSeFor = () => {
      const v = ultima.current;
      if (!v || estado.current || !vivo) return;
      if (presentes.current.includes(v.anfitriao)) return;
      if (sucessor(v, presentes.current) !== eu) return;
      setSouAnfitriao(true);
      publicar(assumirSala(v, eu));
    };

    /** A mensagem já conferida (assinatura do id que diz mandar, número novo). */
    const tratar = (m: Mensagem) => {
      if (m.tipo === "acao") {
        // Só o anfitrião aplica ações; nunca uma que diga vir dele mesmo, e só de quem está na sala de verdade.
        if (estado.current && m.de !== eu && presentes.current.includes(m.de)) comoAnfitriao(m.de, m.carga as Acao);
        return;
      }
      if (!vistaValida(m.carga, codigo) || m.carga.anfitriao !== m.de) return;
      const v = m.carga;
      if (estado.current) {
        if (v.anfitriao === eu) return;
        const minha = estado.current;
        if (minha.versao <= 2 && minha.jogadores.length === 1 && criar) {
          // Acabei de criar e o código já era de outra sala: troco de código.
          estado.current = null;
          setConexao("colisao");
          return;
        }
        // Duas pessoas no comando (rede partida): fica a sala com mais gente na presença. Empate: cada um segue o seu.
        if (presentesDe(v.jogadores) <= presentesDe(minha.jogadores)) return;
        estado.current = null;
        ultima.current = null;
        setSouAnfitriao(false);
      }
      const atual = ultima.current;
      // Troca de comando só vale se quem comandava saiu da presença, ou se a outra sala tem mais gente de verdade.
      if (atual && v.anfitriao !== atual.anfitriao && presentes.current.includes(atual.anfitriao) && presentesDe(v.jogadores) <= presentesDe(atual.jogadores)) return;
      if (atual && v.anfitriao === atual.anfitriao && v.versao < atual.versao) return;
      mostrar(vistaSemContato(v));
      const minhaFicha = v.jogadores.find((j) => j.id === eu);
      if (minhaFicha && !minhaFicha.fora) {
        estiveNaSala.current = true;
        setConexao("na-sala");
      } else if (estiveNaSala.current && !minhaFicha) setConexao("expulso");
    };

    const aoMensagem = (m: Mensagem) => {
      if (!vivo || typeof m.de !== "string" || m.de === eu) return;
      // Em fila: a conferência é assíncrona, e a ordem de chegada importa (versões, vezes).
      fila = fila.then(async () => {
        if (!vivo) return;
        if (!(await conferencia.current.aceitar(codigo, m.tipo, m.de as string, m.n, m.carga, m.assinatura))) return;
        if (vivo) tratar(m);
      });
    };

    const aoPresenca = (lista: Presenca[]) => {
      if (!vivo) return;
      conferencia.current.anotar(lista);
      presentes.current = lista.map((p) => p.id);
      for (const id of presentes.current) jaVistos.current.add(id);
      const e = estado.current;
      if (e) {
        // Quem já esteve na presença e sumiu, saiu (fechou a aba, caiu a rede): o anfitrião marca por ela.
        let novo = e;
        for (const j of e.jogadores) if (!j.fora && j.id !== eu && jaVistos.current.has(j.id) && !presentes.current.includes(j.id)) novo = aplicar(novo, j.id, { t: "sair" }, Date.now());
        if (novo !== e) publicar(novo);
        return;
      }
      const v = ultima.current;
      if (v && !presentes.current.includes(v.anfitriao)) depois(4000, assumirSeFor);
    };

    void (async () => {
      chaves.current = await novasChaves();
      if (!vivo) return;
      if (!chaves.current) {
        setConexao("falhou");
        return;
      }
      const c = abrirCanal(codigo, { id: eu, apelido, chave: chaves.current.publica }, aoMensagem, aoPresenca);
      canal.current = c;
      const ok = await c.entrar();
      if (!vivo) return;
      if (!ok) {
        setConexao("falhou");
        return;
      }
      if (criar) {
        // Um instante para ver se o código já está em uso; depois a sala nasce.
        depois(1200, () => {
          if (ultima.current) {
            setConexao("colisao");
            return;
          }
          setSouAnfitriao(true);
          estiveNaSala.current = true;
          setConexao("na-sala");
          publicar(salaNova(codigo, eu, apelido, jogoInicial));
        });
        return;
      }
      // Quem entra pede para entrar até se ver na lista (a primeira mensagem pode se perder).
      let tentativas = 0;
      const pedir = () => {
        if (!vivo || estado.current) return;
        const v = ultima.current;
        const ficha = v?.jogadores.find((j) => j.id === eu);
        if (ficha && !ficha.fora) return;
        if (tentativas >= 5) {
          setConexao(v ? (estiveNaSala.current ? "expulso" : "cheia") : "nao-achou");
          return;
        }
        tentativas++;
        enviar({ tipo: "acao", carga: { t: "entrar", apelido } satisfies Acao });
        depois(1800, pedir);
      };
      pedir();
    })();

    // O relógio do anfitrião: fecha a rodada no fim do prazo e, de tempos em tempos, retransmite a sala (cura mensagem
    // perdida e acerta o relógio de quem chegou).
    let batidas = 0;
    const relogio = window.setInterval(() => {
      const e = estado.current;
      if (!e) return;
      batidas++;
      if (e.fase === "jogando") {
        const novo = aplicar(e, eu, { t: "tique" }, Date.now());
        if (novo !== e) return publicar(novo);
      }
      if (batidas % 5 === 0) enviar({ tipo: "estado", carga: vistaPublica(e, Date.now()) });
    }, 1000);

    return () => {
      vivo = false;
      window.clearInterval(relogio);
      relogios.forEach((r) => window.clearTimeout(r));
      // Quem sai some da presença: o anfitrião marca a saída por ela (aoPresenca).
      canal.current?.sair();
      canal.current = null;
      estado.current = null;
    };
    // O apelido e o jogo inicial só valem na entrada: mudar depois não reabre o canal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo, criar, eu]);

  return { eu, vista, recebidaEm, conexao, modo: hasBackend ? "tempo-real" : "abas", souAnfitriao, agir };
}
