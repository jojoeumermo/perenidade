// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Regras puras dos controles do coordenador: as mesmas conferências que o banco faz (supabase/install.sql: canais_salvar,
// equipe_sala_salvar, radio_*; supabase/migracoes/2026-11-controles.sql), repetidas aqui só para avisar antes de enviar.
// O banco continua sendo quem decide; nada aqui é segurança. Sem importar nada do site: o teste roda em node puro.

/** Canal do WhatsApp (canal ou grupo): o mesmo padrão de public.canais_salvar. */
export const PADRAO_WHATSAPP = /^https:\/\/(www\.)?(whatsapp\.com\/channel\/|chat\.whatsapp\.com\/)[A-Za-z0-9]{10,60}$/;
/** Canal ou grupo do Telegram: o mesmo padrão de public.canais_salvar. */
export const PADRAO_TELEGRAM = /^https:\/\/t\.me\/\+?[A-Za-z0-9_]{3,64}$/;
/** Impressão digital de arquivo: SHA-256 em 64 letras minúsculas de hexadecimal (public.arquivo_bloquear). */
export const PADRAO_SHA256 = /^[a-f0-9]{64}$/;

export function erroDoWhatsapp(valor: string): string {
  const v = valor.trim();
  if (!v) return "";
  return PADRAO_WHATSAPP.test(v) ? "" : "Cole o endereço do canal ou do grupo (começa com https://whatsapp.com/channel/ ou https://chat.whatsapp.com/).";
}

export function erroDoTelegram(valor: string): string {
  const v = valor.trim();
  if (!v) return "";
  return PADRAO_TELEGRAM.test(v) ? "" : "Cole o endereço do canal ou do grupo (começa com https://t.me/).";
}

/** Endereço https sem espaço e até "maximo" letras. Vazio vale (tira o endereço). */
export function erroDeHttps(valor: string, maximo: number): string {
  const v = valor.trim();
  if (!v) return "";
  if (!/^https:\/\/\S+$/.test(v)) return "O endereço precisa começar com https:// e não ter espaço.";
  if (v.length > maximo) return `O endereço é longo demais (até ${maximo} letras).`;
  return "";
}

export const erroDaSala = (valor: string) => erroDeHttps(valor, 300);
export const erroDoAudio = (valor: string) => (valor.trim() ? erroDeHttps(valor, 500) : "Falta o endereço do áudio.");

/** Faixa da rádio: título obrigatório (1 a 160), áudio https. Devolve o primeiro problema ou "". */
export function erroDaFaixa(titulo: string, url: string): string {
  const t = titulo.trim();
  if (t.length < 1 || t.length > 160) return "O título da faixa tem de 1 a 160 letras.";
  return erroDoAudio(url);
}

export function erroDoCanalDaRadio(nome: string): string {
  const n = nome.trim();
  return n.length >= 2 && n.length <= 60 ? "" : "O nome do canal tem de 2 a 60 letras.";
}

export const ehSha256 = (valor: string) => PADRAO_SHA256.test(valor.trim().toLowerCase());

/** Bytes em hexadecimal minúsculo (o formato que o banco guarda). */
export function emHexadecimal(bytes: ArrayBuffer | Uint8Array): string {
  const v = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let saida = "";
  for (const b of v) saida += b.toString(16).padStart(2, "0");
  return saida;
}

/** Duração de faixa em "m:ss" para a lista. */
export function duracaoEmTexto(segundos: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(segundos) ? segundos : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Texto de "mm:ss" ou "h:mm:ss" ou só segundos para segundos; vazio vale zero. Inválido devolve null. */
export function segundosDoTexto(texto: string): number | null {
  const t = texto.trim();
  if (!t) return 0;
  const partes = t.split(":");
  if (partes.length > 3 || partes.some((p) => !/^\d{1,5}$/.test(p))) return null;
  return partes.reduce((total, p) => total * 60 + Number(p), 0);
}

export interface ResumoDosControles {
  whatsapp: boolean;
  telegram: boolean;
  sala: boolean;
  radio_no_ar: boolean;
  radio_canais: number;
  radio_faixas: number;
  moderadores: number;
  nucleos_fechados: number;
  arquivos_bloqueados: number;
}

export interface CartaoDoCentro {
  id: "canais" | "sala" | "radio" | "moderadores" | "nucleos" | "arquivos" | "publicacao";
  titulo: string;
  /** Uma linha: como está agora. */
  estado: string;
  /** Precisa de atenção (ainda não foi configurado). */
  atencao: boolean;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Os cartões do Centro de controle a partir do resumo do banco. Só contagens e liga/desliga. */
export function cartoesDoCentro(r: ResumoDosControles): CartaoDoCentro[] {
  const canais = [r.whatsapp && "WhatsApp", r.telegram && "Telegram"].filter(Boolean) as string[];
  return [
    { id: "canais", titulo: "Canais no celular", estado: canais.length ? `Ligados: ${canais.join(" e ")}.` : "Nenhum canal cadastrado: a página \"Receba no seu celular\" fica sem endereço.", atencao: canais.length === 0 },
    { id: "sala", titulo: "Sala da equipe", estado: r.sala ? "Endereço da sala guardado." : "Sem sala: o botão de entrar não aparece para a equipe.", atencao: !r.sala },
    {
      id: "radio",
      titulo: "Rádio: canais e faixas",
      estado: `${r.radio_no_ar ? "No ar" : "Fora do ar"} · ${plural(r.radio_canais, "canal", "canais")} · ${plural(r.radio_faixas, "faixa", "faixas")}.`,
      atencao: r.radio_canais === 0,
    },
    { id: "moderadores", titulo: "Moderadores de comunidade", estado: r.moderadores ? `${plural(r.moderadores, "moderação nomeada", "moderações nomeadas")}.` : "Nenhuma moderação nomeada além da mediação geral.", atencao: false },
    { id: "nucleos", titulo: "Núcleos fechados da Rede", estado: r.nucleos_fechados ? `${plural(r.nucleos_fechados, "núcleo com espaço", "núcleos com espaço")}.` : "Nenhum núcleo abriu o espaço fechado ainda.", atencao: false },
    { id: "arquivos", titulo: "Arquivos bloqueados", estado: r.arquivos_bloqueados ? `${plural(r.arquivos_bloqueados, "arquivo", "arquivos")} que não entram no site.` : "Nenhum arquivo bloqueado.", atencao: false },
    { id: "publicacao", titulo: "Publicar agora", estado: "Pede a rotina de publicação fora de hora (até 6 vezes por hora).", atencao: false },
  ];
}
