// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O motivo de uma ação do painel fica guardado (no registro e, no bloqueio da borda, ao lado da regra). Por isso ele não pode
// levar endereço de rede: as mesmas regras de interno.alumia_painel_motivo, no banco. A hora ("10:30:00") passa; quatro grupos
// com dois-pontos ou "::" com algarismo hexadecimal ao lado, não.

const IPV4 = /(^|[^0-9.])[0-9]{1,3}(\.[0-9]{1,3}){3}($|[^0-9])/;
const IPV6 = [/(^|[^0-9a-z])([0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}/i, /(^|[^0-9a-z:])[0-9a-f]{0,4}::[0-9a-f]{1,4}/i, /(^|[^0-9a-z])[0-9a-f]{1,4}::/i];
/** Um @nome de conta (da Alumia ou de fora). O e-mail também cai aqui. */
const ARROBA = /(^|[^\p{L}\p{N}_])@[\p{L}\p{N}_.-]{2,}|[\p{L}\p{N}_.+-]+@[\p{L}\p{N}-]+\.[\p{L}\p{N}.-]+/u;

/** O motivo tem algo com cara de endereço IPv4 ou IPv6? */
export function motivoComEndereco(motivo: string): boolean {
  return IPV4.test(motivo) || IPV6.some((r) => r.test(motivo));
}

/**
 * O motivo do bloqueio na borda: de 10 a 500 letras, sem endereço e sem @ de conta (a tela diz que a Alumia não liga o
 * endereço bloqueado a conta nenhuma; um @ no motivo faria essa ligação).
 */
export function conferirMotivoDaBorda(m: unknown): { ok: true; motivo: string } | { ok: false; codigo: "invalido:motivo" | "invalido:motivo_com_endereco" } {
  const motivo = typeof m === "string" ? m.trim() : "";
  if (motivo.length < 10 || motivo.length > 500) return { ok: false, codigo: "invalido:motivo" };
  if (motivoComEndereco(motivo) || ARROBA.test(motivo)) return { ok: false, codigo: "invalido:motivo_com_endereco" };
  return { ok: true, motivo };
}
