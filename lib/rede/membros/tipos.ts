// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os tipos que os grupos com membros escondidos usam das outras partes do chat. A caixa e o transporte são os do contrato das
// caixas anônimas (lib/rede/caixas: `Caixa`, `criar`, `depositar`, `buscar`); a identidade da conta é a do aparelho
// (lib/rede/aparelhos/identidade.ts). Aqui eles entram como interface: o grupo não sabe se fala com o servidor de verdade ou com a
// caixa de memória dos testes.

/** Uma caixa anônima: identificador e passes de 32 bytes, sorteados ou tirados do exportador da época. */
export interface Caixa {
  id: Uint8Array;
  pd: Uint8Array;
  pl: Uint8Array;
  multi: boolean;
}

export interface Pacote {
  ordem: number;
  envelope: Uint8Array;
  franquia: Uint8Array | null;
  marca: Uint8Array | null;
  dia: string;
}

export type ResultadoDoDeposito = { ok: true; marca?: Uint8Array; dia?: string } | { ok: false; erro: "ocupada" | "tamanho" | "rede" };

/** O que o grupo pede ao servidor (as rotas anônimas das caixas, sem sessão de conta). */
export interface Transporte {
  /** Cria a caixa (idempotente com os mesmos resumos). Gasta um passe anônimo. */
  criar(c: Caixa): Promise<void>;
  depositar(c: Pick<Caixa, "id" | "pd">, envelope: Uint8Array, franquia?: Uint8Array, unico?: boolean): Promise<ResultadoDoDeposito>;
  buscar(c: Caixa, cursor: number): Promise<Pacote[]>;
}

/** A identidade da conta (Ed25519), que fica no aparelho. A privada nunca sai: o grupo só pede assinaturas. */
export interface Identidade {
  publica: Uint8Array;
  assinar(dados: Uint8Array): Promise<Uint8Array>;
}

export type TipoDeGrupo = "grupo" | "equipe";
