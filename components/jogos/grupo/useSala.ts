// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A sala vista de um navegador. Quem cria a sala é o anfitrião: guarda o estado (lib/jogos/grupo/motor.ts), aplica as
// ações que chegam e transmite a vista pública. Quem entra só manda ações e desenha a vista que recebe. Se o anfitrião
// some, a pessoa que chegou antes assume (motor.ts: sucessor e assumirSala). Nada vai para banco nenhum.
import { useCallback, useEffect, useRef, useState } from "react";
import { aplicar, assumirSala, salaNova, sucessor, vistaPublica, type Acao, type EstadoDaSala, type IdDoJogoEmGrupo, type VistaDaSala } from "@/lib/jogos/grupo/motor";
import { hasBackend } from "@/lib/backend";
import { abrirCanal, idSorteado, type CanalDaSala, type Mensagem, type Presenca } from "./canal";

export type Conexao = "conectando" | "na-sala" | "nao-achou" | "falhou" | "cheia" | "expulso" | "colisao";

/** A vista que chegou pela rede passa por uma conferência mínima de forma (quem manda pode não ser o site). */
function vistaValida(v: unknown, codigo: string): v is VistaDaSala {
  const x = v as Partial<VistaDaSala> | null;
  return Boolean(x && typeof x === "object" && x.codigo === codigo && typeof x.versao === "number" && typeof x.anfitriao === "string" && Array.isArray(x.jogadores) && x.jogadores.length <= 60 && typeof x.fase === "string");
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

  const mostrar = useCallback((v: VistaDaSala) => {
    ultima.current = v;
    setVista(v);
    setRecebidaEm(Date.now());
  }, []);

  /** O anfitrião guarda o estado novo, desenha e transmite a vista. */
  const publicar = useCallback(
    (e: EstadoDaSala) => {
      estado.current = e;
      const v = vistaPublica(e, Date.now());
      mostrar(v);
      canal.current?.enviar({ tipo: "estado", carga: v });
    },
    [mostrar],
  );

  const comoAnfitriao = useCallback(
    (de: string, acao: Acao) => {
      const e = estado.current;
      if (!e) return;
      const novo = aplicar(e, de, acao, Date.now());
      if (novo !== e) publicar(novo);
      // Quem acabou de chegar (ou voltou) recebe a sala mesmo se nada mudou.
      else if (acao?.t === "entrar") canal.current?.enviar({ tipo: "estado", carga: vistaPublica(e, Date.now()) });
    },
    [publicar],
  );

  const agir = useCallback(
    (acao: Acao) => {
      if (estado.current) comoAnfitriao(eu, acao);
      else canal.current?.enviar({ tipo: "acao", de: eu, carga: acao });
    },
    [eu, comoAnfitriao],
  );

  useEffect(() => {
    let vivo = true;
    const relogios: number[] = [];
    const depois = (ms: number, f: () => void) => relogios.push(window.setTimeout(() => vivo && f(), ms));

    const assumirSeFor = () => {
      const v = ultima.current;
      if (!v || estado.current || !vivo) return;
      if (presentes.current.includes(v.anfitriao)) return;
      if (sucessor(v, presentes.current) !== eu) return;
      setSouAnfitriao(true);
      publicar(assumirSala(v, eu));
    };

    const aoMensagem = (m: Mensagem) => {
      if (!vivo) return;
      if (m.tipo === "acao") {
        if (estado.current && typeof m.de === "string") comoAnfitriao(m.de, m.carga as Acao);
        return;
      }
      if (!vistaValida(m.carga, codigo)) return;
      const v = m.carga;
      if (estado.current) {
        // Duas pessoas no comando (código repetido ou rede partida): fica a sala mais cheia (empate: o menor id).
        if (v.anfitriao === eu) return;
        const minha = estado.current;
        const cede = v.jogadores.length > minha.jogadores.length || (v.jogadores.length === minha.jogadores.length && v.anfitriao < eu);
        if (!cede) return;
        if (minha.versao <= 2 && minha.jogadores.length === 1 && criar) {
          // Acabei de criar e o código já era de outra sala: troco de código.
          estado.current = null;
          setConexao("colisao");
          return;
        }
        estado.current = null;
        setSouAnfitriao(false);
      }
      const atual = ultima.current;
      // Troca de comando só vale se quem comandava não está mais aqui.
      if (atual && v.anfitriao !== atual.anfitriao && presentes.current.includes(atual.anfitriao) && v.versao <= atual.versao) return;
      if (atual && v.anfitriao === atual.anfitriao && v.versao < atual.versao) return;
      mostrar(v);
      const minhaFicha = v.jogadores.find((j) => j.id === eu);
      if (minhaFicha && !minhaFicha.fora) {
        estiveNaSala.current = true;
        setConexao("na-sala");
      } else if (estiveNaSala.current && !minhaFicha) setConexao("expulso");
    };

    const aoPresenca = (lista: Presenca[]) => {
      if (!vivo) return;
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

    const c = abrirCanal(codigo, { id: eu, apelido }, aoMensagem, aoPresenca);
    canal.current = c;
    void c.entrar().then((ok) => {
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
        c.enviar({ tipo: "acao", de: eu, carga: { t: "entrar", apelido } satisfies Acao });
        depois(1800, pedir);
      };
      pedir();
    });

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
      if (batidas % 5 === 0) canal.current?.enviar({ tipo: "estado", carga: vistaPublica(e, Date.now()) });
    }, 1000);

    return () => {
      vivo = false;
      window.clearInterval(relogio);
      relogios.forEach((r) => window.clearTimeout(r));
      if (!estado.current) c.enviar({ tipo: "acao", de: eu, carga: { t: "sair" } satisfies Acao });
      c.sair();
      canal.current = null;
      estado.current = null;
    };
    // O apelido e o jogo inicial só valem na entrada: mudar depois não reabre o canal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo, criar, eu]);

  return { eu, vista, recebidaEm, conexao, modo: hasBackend ? "tempo-real" : "abas", souAnfitriao, agir };
}
