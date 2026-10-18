// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O motor do Laboratório de Redes: uma rede didática em memória, com camada 2 (quadros, tabela MAC com aprendizagem,
// inundação, ARP, VLAN de acesso e tronco) e camada 3 (encaminhamento por tabela de rotas, TTL, ICMP para ping e
// traceroute). Não é o IOS da Cisco nem pretende ser: é o bastante para ver o pacote andar e entender cada passo.
// Tudo roda no navegador; nada é executado a partir de arquivos carregados (a topologia é só dados, validados).

export type TipoDeDispositivo = "pc" | "notebook" | "servidor" | "switch" | "roteador";

export interface Porta {
  nome: string;
  /** Interface desligada ("shutdown") ou sem cabo não passa nada. */
  ligada: boolean;
  /** Só em switch: modo de acesso numa VLAN, ou tronco (leva todas). */
  modo: "access" | "trunk";
  vlan: number;
  /** Só em roteador e em PC: endereço da interface. */
  ip: string;
  mascara: string;
  descricao: string;
}

export interface Rota {
  rede: string;
  mascara: string;
  /** Próximo salto (IP) ou nome da interface de saída. */
  via: string;
}

export interface Dispositivo {
  id: string;
  tipo: TipoDeDispositivo;
  nome: string;
  x: number;
  y: number;
  portas: Porta[];
  /** PCs: gateway e DNS. */
  gateway: string;
  dns: string;
  /** Roteadores: rotas estáticas (as redes conectadas entram sozinhas). */
  rotas: Rota[];
  /** Switches: VLANs criadas (1 sempre existe). */
  vlans: { id: number; nome: string }[];
}

export interface Cabo {
  id: string;
  de: { dispositivo: string; porta: string };
  para: { dispositivo: string; porta: string };
}

export interface Topologia {
  dispositivos: Dispositivo[];
  cabos: Cabo[];
}

/** Um passo da simulação, para a animação e a lista de eventos. */
export interface Evento {
  texto: string;
  /** Onde o quadro está: de um dispositivo para outro (ou dentro de um só, para decisões). */
  de: string;
  para: string;
  camada: 2 | 3 | 7;
  pacote?: { origemMac?: string; destinoMac?: string; origemIp?: string; destinoIp?: string; ttl?: number; protocolo: string; vlan?: number };
  erro?: boolean;
}

export interface Resultado {
  sucesso: boolean;
  resumo: string;
  eventos: Evento[];
}

export const LIMITE_DE_DISPOSITIVOS = 50;
export const PORTAS_POR_TIPO: Record<TipoDeDispositivo, string[]> = {
  pc: ["eth0"],
  notebook: ["eth0"],
  servidor: ["eth0"],
  switch: Array.from({ length: 8 }, (_, i) => `Fa0/${i + 1}`),
  roteador: ["Gi0/0", "Gi0/1", "Gi0/2"],
};

// ───────────── Endereços ─────────────

export const ipValido = (ip: string) => /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(ip) && ip.split(".").every((o) => Number(o) <= 255);
export const ipParaNumero = (ip: string) => ip.split(".").reduce((n, o) => ((n << 8) | Number(o)) >>> 0, 0);
export const numeroParaIp = (n: number) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");
export const mascaraValida = (m: string) => {
  if (!ipValido(m)) return false;
  const n = ipParaNumero(m);
  // Uma máscara é uma sequência de 1s seguida de 0s.
  return n === 0 || (((~n >>> 0) + 1) & (~n >>> 0)) === 0;
};
export const prefixo = (m: string) => ipParaNumero(m).toString(2).replace(/0/g, "").length;
export const mesmaRede = (a: string, b: string, mascara: string) => (ipParaNumero(a) & ipParaNumero(mascara)) === (ipParaNumero(b) & ipParaNumero(mascara));
export const redeDe = (ip: string, mascara: string) => numeroParaIp((ipParaNumero(ip) & ipParaNumero(mascara)) >>> 0);

/** Um MAC estável por dispositivo e porta (não precisa ser aleatório: é didático e legível). */
export function macDe(dispositivo: Dispositivo, porta: string): string {
  let h = 0;
  for (const c of `${dispositivo.id}/${porta}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hex = h.toString(16).padStart(8, "0").toUpperCase();
  return `00:1L:${hex.slice(0, 2)}:${hex.slice(2, 4)}:${hex.slice(4, 6)}:${hex.slice(6, 8)}`.replace("1L", dispositivo.tipo === "switch" ? "5A" : dispositivo.tipo === "roteador" ? "70" : "10");
}

// ───────────── Construção ─────────────

export function novoDispositivo(tipo: TipoDeDispositivo, n: number, x: number, y: number): Dispositivo {
  const nomes: Record<TipoDeDispositivo, string> = { pc: "PC", notebook: "Note", servidor: "Servidor", switch: "SW", roteador: "R" };
  return {
    id: `${tipo}-${Date.now().toString(36)}-${n}`,
    tipo,
    nome: `${nomes[tipo]}${n}`,
    x,
    y,
    portas: PORTAS_POR_TIPO[tipo].map((nome) => ({ nome, ligada: tipo !== "roteador", modo: "access", vlan: 1, ip: "", mascara: "", descricao: "" })),
    gateway: "",
    dns: "",
    rotas: [],
    vlans: [{ id: 1, nome: "default" }],
  };
}

/** Valida uma topologia vinda de arquivo: só os campos conhecidos, tamanhos limitados, nada executável. */
export function validarTopologia(dados: unknown): Topologia {
  if (!dados || typeof dados !== "object") throw new Error("formato");
  const t = dados as Partial<Topologia>;
  if (!Array.isArray(t.dispositivos) || !Array.isArray(t.cabos)) throw new Error("formato");
  if (t.dispositivos.length > LIMITE_DE_DISPOSITIVOS) throw new Error("grande");
  const tipos: TipoDeDispositivo[] = ["pc", "notebook", "servidor", "switch", "roteador"];
  const texto = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const dispositivos: Dispositivo[] = t.dispositivos.map((d, i) => {
    const o = (d ?? {}) as Partial<Dispositivo>;
    const tipo = tipos.includes(o.tipo as TipoDeDispositivo) ? (o.tipo as TipoDeDispositivo) : "pc";
    const base = novoDispositivo(tipo, i + 1, Number(o.x) || 60 + i * 40, Number(o.y) || 80);
    base.id = texto(o.id, 60) || base.id;
    base.nome = texto(o.nome, 20) || base.nome;
    base.gateway = texto(o.gateway, 15);
    base.dns = texto(o.dns, 15);
    base.rotas = (Array.isArray(o.rotas) ? o.rotas : []).slice(0, 30).map((r) => ({ rede: texto((r as Rota).rede, 15), mascara: texto((r as Rota).mascara, 15), via: texto((r as Rota).via, 15) }));
    base.vlans = (Array.isArray(o.vlans) ? o.vlans : [{ id: 1, nome: "default" }]).slice(0, 50).map((v) => ({ id: Math.min(4094, Math.max(1, Number((v as { id: number }).id) || 1)), nome: texto((v as { nome: string }).nome, 20) || "vlan" }));
    const portas = Array.isArray(o.portas) ? o.portas : [];
    base.portas = base.portas.map((p) => {
      const q = portas.find((x) => (x as Porta).nome === p.nome) as Partial<Porta> | undefined;
      return q ? { ...p, ligada: q.ligada !== false, modo: q.modo === "trunk" ? "trunk" : "access", vlan: Math.min(4094, Math.max(1, Number(q.vlan) || 1)), ip: texto(q.ip, 15), mascara: texto(q.mascara, 15), descricao: texto(q.descricao, 60) } : p;
    });
    return base;
  });
  const ids = new Set(dispositivos.map((d) => d.id));
  const cabos: Cabo[] = t.cabos
    .slice(0, 200)
    .map((c, i) => {
      const o = (c ?? {}) as Partial<Cabo>;
      return { id: texto(o.id, 60) || `cabo-${i}`, de: { dispositivo: texto(o.de?.dispositivo, 60), porta: texto(o.de?.porta, 10) }, para: { dispositivo: texto(o.para?.dispositivo, 60), porta: texto(o.para?.porta, 10) } };
    })
    .filter((c) => ids.has(c.de.dispositivo) && ids.has(c.para.dispositivo));
  return { dispositivos, cabos };
}

// ───────────── Consultas ─────────────

const dispositivo = (t: Topologia, id: string) => t.dispositivos.find((d) => d.id === id);
const porta = (d: Dispositivo, nome: string) => d.portas.find((p) => p.nome === nome);

/** A outra ponta do cabo ligado a esta porta, se houver e se as duas portas estiverem ligadas. */
export function vizinho(t: Topologia, id: string, nomeDaPorta: string): { dispositivo: Dispositivo; porta: Porta } | null {
  const cabo = t.cabos.find((c) => (c.de.dispositivo === id && c.de.porta === nomeDaPorta) || (c.para.dispositivo === id && c.para.porta === nomeDaPorta));
  if (!cabo) return null;
  const ponta = cabo.de.dispositivo === id && cabo.de.porta === nomeDaPorta ? cabo.para : cabo.de;
  const d = dispositivo(t, ponta.dispositivo);
  const p = d && porta(d, ponta.porta);
  const minha = porta(dispositivo(t, id)!, nomeDaPorta);
  if (!d || !p || !p.ligada || !minha?.ligada) return null;
  return { dispositivo: d, porta: p };
}

const ehHost = (d: Dispositivo) => d.tipo === "pc" || d.tipo === "notebook" || d.tipo === "servidor";

/** Interfaces com IP de um dispositivo (host: eth0 com o IP; roteador: cada interface configurada). */
function interfacesIp(d: Dispositivo): { porta: Porta; ip: string; mascara: string }[] {
  return d.portas.filter((p) => p.ip && p.mascara && p.ligada).map((p) => ({ porta: p, ip: p.ip, mascara: p.mascara }));
}

// ───────────── Camada 2: entregar um quadro a partir de uma porta ─────────────

interface Entrega {
  dispositivo: Dispositivo;
  porta: Porta;
  vlan: number;
}

/** Estado volátil da simulação: tabelas MAC dos switches (aprendidas durante a simulação) e tabelas ARP dos hosts. */
export interface Estado {
  mac: Record<string, Record<string, { porta: string; vlan: number }>>;
  arp: Record<string, Record<string, string>>;
}
export const estadoNovo = (): Estado => ({ mac: {}, arp: {} });

/**
 * Entrega um quadro saindo de (origem, porta) pelo domínio de camada 2: switches aprendem o MAC de origem, encaminham
 * pela tabela ou inundam; VLANs isolam; troncos levam todas. Devolve todos os destinos finais (hosts e roteadores)
 * que receberam o quadro, com a VLAN em que chegou.
 */
function entregarQuadro(t: Topologia, estado: Estado, origem: Dispositivo, portaDeSaida: Porta, destinoMac: string | "broadcast", origemMac: string, eventos: Evento[], pacote: Evento["pacote"]): Entrega[] {
  const chegadas: Entrega[] = [];
  const visitados = new Set<string>();
  const fila: { d: Dispositivo; p: Porta; vlan: number; de: Dispositivo }[] = [];
  const primeira = vizinho(t, origem.id, portaDeSaida.nome);
  if (!primeira) {
    eventos.push({ texto: `${origem.nome}: a porta ${portaDeSaida.nome} está sem cabo ou desligada. O quadro não sai.`, de: origem.id, para: origem.id, camada: 2, erro: true });
    return [];
  }
  // A VLAN "nasce" na porta do switch que recebe (acesso) ou vem marcada no tronco; um host não marca.
  fila.push({ d: primeira.dispositivo, p: primeira.porta, vlan: 0, de: origem });
  let passos = 0;
  while (fila.length && passos++ < 500) {
    const { d, p, vlan: vlanDeEntrada, de } = fila.shift()!;
    if (d.tipo !== "switch") {
      chegadas.push({ dispositivo: d, porta: p, vlan: vlanDeEntrada });
      eventos.push({ texto: `Quadro chega a ${d.nome} pela ${p.nome}.`, de: de.id, para: d.id, camada: 2, pacote });
      continue;
    }
    const vlan = p.modo === "trunk" ? vlanDeEntrada || 1 : p.vlan;
    if (p.modo === "access" && vlanDeEntrada && vlanDeEntrada !== p.vlan) {
      eventos.push({ texto: `${d.nome}: a ${p.nome} é de acesso na VLAN ${p.vlan}; quadro da VLAN ${vlanDeEntrada} descartado.`, de: de.id, para: d.id, camada: 2, erro: true });
      continue;
    }
    const chave = `${d.id}:${p.nome}:${vlan}:${origemMac}`;
    if (visitados.has(chave)) continue;
    visitados.add(chave);
    // Aprendizagem: o MAC de origem fica associado à porta de entrada, na VLAN.
    estado.mac[d.id] ??= {};
    const antes = estado.mac[d.id][origemMac];
    if (!antes || antes.porta !== p.nome) {
      estado.mac[d.id][origemMac] = { porta: p.nome, vlan };
      eventos.push({ texto: `${d.nome} aprende: ${origemMac} está na ${p.nome} (VLAN ${vlan}).`, de: d.id, para: d.id, camada: 2 });
    }
    const conhecido = destinoMac !== "broadcast" ? estado.mac[d.id][destinoMac] : undefined;
    const saidas = d.portas.filter((q) => q.nome !== p.nome && q.ligada && (q.modo === "trunk" || q.vlan === vlan));
    const alvo = conhecido && conhecido.vlan === vlan ? saidas.filter((q) => q.nome === conhecido.porta) : saidas;
    eventos.push({ texto: conhecido && conhecido.vlan === vlan ? `${d.nome} conhece ${destinoMac}: envia só pela ${conhecido.porta}.` : destinoMac === "broadcast" ? `${d.nome} inunda o broadcast nas portas da VLAN ${vlan}.` : `${d.nome} não conhece ${destinoMac}: inunda nas portas da VLAN ${vlan}.`, de: de.id, para: d.id, camada: 2, pacote: { ...pacote, protocolo: pacote?.protocolo ?? "", vlan } });
    for (const q of alvo) {
      const v = vizinho(t, d.id, q.nome);
      if (!v) continue;
      fila.push({ d: v.dispositivo, p: v.porta, vlan: q.modo === "trunk" ? vlan : v.dispositivo.tipo === "switch" && v.porta.modo === "trunk" ? vlan : 0, de: d });
    }
  }
  return chegadas;
}

/** ARP: quem tem este IP neste domínio de camada 2? Devolve o MAC (e avisa se houver IP duplicado). */
function arp(t: Topologia, estado: Estado, origem: Dispositivo, portaDeSaida: Porta, ipProcurado: string, eventos: Evento[]): string | null {
  estado.arp[origem.id] ??= {};
  if (estado.arp[origem.id][ipProcurado]) {
    eventos.push({ texto: `${origem.nome} já tem ${ipProcurado} na tabela ARP: ${estado.arp[origem.id][ipProcurado]}.`, de: origem.id, para: origem.id, camada: 2 });
    return estado.arp[origem.id][ipProcurado];
  }
  const meuMac = macDe(origem, portaDeSaida.nome);
  eventos.push({ texto: `${origem.nome} pergunta (ARP, broadcast): quem tem ${ipProcurado}?`, de: origem.id, para: origem.id, camada: 2, pacote: { origemMac: meuMac, destinoMac: "FF:FF:FF:FF:FF:FF", origemIp: portaDeSaida.ip, destinoIp: ipProcurado, protocolo: "ARP" } });
  const chegadas = entregarQuadro(t, estado, origem, portaDeSaida, "broadcast", meuMac, eventos, { origemMac: meuMac, destinoMac: "FF:FF:FF:FF:FF:FF", origemIp: portaDeSaida.ip, destinoIp: ipProcurado, protocolo: "ARP" });
  const donos = chegadas.filter((c) => c.porta.ip === ipProcurado && c.porta.ligada);
  if (donos.length === 0) {
    eventos.push({ texto: `Ninguém responde por ${ipProcurado} nesta rede local. (Está na mesma sub-rede? A máscara está certa? O cabo está ligado?)`, de: origem.id, para: origem.id, camada: 2, erro: true });
    return null;
  }
  if (donos.length > 1) eventos.push({ texto: `Atenção: ${donos.length} dispositivos responderam por ${ipProcurado} (${donos.map((d) => d.dispositivo.nome).join(", ")}). IP duplicado!`, de: origem.id, para: origem.id, camada: 2, erro: true });
  const dono = donos[0];
  const mac = macDe(dono.dispositivo, dono.porta.nome);
  eventos.push({ texto: `${dono.dispositivo.nome} responde: ${ipProcurado} está em ${mac}.`, de: dono.dispositivo.id, para: origem.id, camada: 2, pacote: { origemMac: mac, destinoMac: meuMac, origemIp: ipProcurado, destinoIp: portaDeSaida.ip, protocolo: "ARP" } });
  estado.arp[origem.id][ipProcurado] = mac;
  // Quem respondeu também aprende quem perguntou.
  estado.arp[dono.dispositivo.id] ??= {};
  estado.arp[dono.dispositivo.id][portaDeSaida.ip] = meuMac;
  return mac;
}

// ───────────── Camada 3 ─────────────

/** Decide por onde um dispositivo manda um pacote para o IP dado: interface de saída e próximo salto. */
function decidirRota(d: Dispositivo, destinoIp: string): { porta: Porta; proximo: string; motivo: string } | null {
  const ifs = interfacesIp(d);
  // Rede diretamente conectada: entrega direta.
  const direta = ifs.filter((i) => mesmaRede(i.ip, destinoIp, i.mascara)).sort((a, b) => prefixo(b.mascara) - prefixo(a.mascara))[0];
  if (direta) return { porta: direta.porta, proximo: destinoIp, motivo: `rede conectada em ${direta.porta.nome}` };
  if (ehHost(d)) {
    if (!d.gateway) return null;
    const saida = ifs.find((i) => mesmaRede(i.ip, d.gateway, i.mascara));
    if (!saida) return { porta: ifs[0]?.porta, proximo: d.gateway, motivo: "gateway fora da rede local" } as never;
    return { porta: saida.porta, proximo: d.gateway, motivo: `gateway padrão ${d.gateway}` };
  }
  // Roteador: a rota mais específica que casa (rota padrão 0.0.0.0/0 por último).
  const candidatas = d.rotas
    .filter((r) => ipValido(r.rede) && mascaraValida(r.mascara) && mesmaRede(r.rede, destinoIp, r.mascara))
    .sort((a, b) => prefixo(b.mascara) - prefixo(a.mascara));
  for (const r of candidatas) {
    const porNome = d.portas.find((p) => p.nome.toLowerCase() === r.via.toLowerCase() && p.ligada && p.ip);
    if (porNome) return { porta: porNome, proximo: destinoIp, motivo: `rota ${r.rede}/${prefixo(r.mascara)} pela ${porNome.nome}` };
    const saida = ifs.find((i) => mesmaRede(i.ip, r.via, i.mascara));
    if (saida) return { porta: saida.porta, proximo: r.via, motivo: `rota ${r.rede}/${prefixo(r.mascara)} via ${r.via}` };
  }
  return null;
}

/**
 * Ping: manda um ICMP echo de um host a um IP e acompanha cada salto (ARP, switches, roteadores, TTL), depois a volta.
 * Devolve os eventos e se deu certo. O estado (tabelas MAC e ARP) é mantido entre pings, como numa rede real.
 */
export function ping(t: Topologia, estado: Estado, origemId: string, destinoIp: string, ttlInicial = 64): Resultado {
  const eventos: Evento[] = [];
  const origem = dispositivo(t, origemId);
  if (!origem) return { sucesso: false, resumo: "Dispositivo não encontrado.", eventos };
  if (!ipValido(destinoIp)) return { sucesso: false, resumo: `Endereço inválido: ${destinoIp}`, eventos };
  const ida = caminhar(t, estado, origem, destinoIp, ttlInicial, eventos, "ICMP echo request");
  if (!ida.ok) return { sucesso: false, resumo: ida.resumo, eventos };
  const destino = ida.destino!;
  const meuIp = interfacesIp(origem)[0]?.ip ?? "";
  eventos.push({ texto: `${destino.nome} recebeu o ping e responde a ${meuIp}.`, de: destino.id, para: destino.id, camada: 3 });
  const volta = caminhar(t, estado, destino, meuIp, ttlInicial, eventos, "ICMP echo reply");
  if (!volta.ok) return { sucesso: false, resumo: `A ida chegou, mas a resposta não voltou: ${volta.resumo}`, eventos };
  eventos.push({ texto: `Resposta de ${destinoIp}: tempo < 1 ms, TTL = ${volta.ttlFinal}. Sucesso!`, de: origem.id, para: origem.id, camada: 3 });
  return { sucesso: true, resumo: `Resposta de ${destinoIp} (TTL ${volta.ttlFinal}).`, eventos };
}

function caminhar(t: Topologia, estado: Estado, origem: Dispositivo, destinoIp: string, ttl: number, eventos: Evento[], protocolo: string): { ok: boolean; resumo: string; destino?: Dispositivo; ttlFinal?: number } {
  let atual = origem;
  let saltos = 0;
  const meuIp = interfacesIp(origem)[0]?.ip ?? "";
  if (!meuIp) return { ok: false, resumo: `${origem.nome} não tem endereço IP configurado.` };
  // O TTL (até 64) é quem para um laço; o teto de passos só protege contra topologias absurdas.
  while (saltos++ < 200) {
    if (interfacesIp(atual).some((i) => i.ip === destinoIp)) return { ok: true, resumo: "chegou", destino: atual, ttlFinal: ttl };
    const rota = decidirRota(atual, destinoIp);
    if (!rota || !rota.porta) {
      const msg = ehHost(atual) ? `${atual.nome}: ${destinoIp} não está na minha rede e não há gateway configurado.` : `${atual.nome}: nenhuma rota para ${destinoIp} (destino inalcançável).`;
      eventos.push({ texto: msg, de: atual.id, para: atual.id, camada: 3, erro: true });
      return { ok: false, resumo: msg };
    }
    if (rota.motivo === "gateway fora da rede local") {
      const msg = `${atual.nome}: o gateway ${atual.gateway} não está na mesma rede que ${rota.porta.ip}/${prefixo(rota.porta.mascara)}. Confira o gateway e a máscara.`;
      eventos.push({ texto: msg, de: atual.id, para: atual.id, camada: 3, erro: true });
      return { ok: false, resumo: msg };
    }
    if (!ehHost(atual)) {
      ttl -= 1;
      if (ttl <= 0) {
        const msg = `${atual.nome}: TTL chegou a zero. Pacote descartado (TTL expirado em trânsito). Há um laço de roteamento?`;
        eventos.push({ texto: msg, de: atual.id, para: atual.id, camada: 3, erro: true, pacote: { origemIp: meuIp, destinoIp, ttl: 0, protocolo } });
        return { ok: false, resumo: msg };
      }
    }
    eventos.push({ texto: `${atual.nome} decide: ${destinoIp} sai pela ${rota.porta.nome} (${rota.motivo}); próximo salto ${rota.proximo}. TTL ${ttl}.`, de: atual.id, para: atual.id, camada: 3, pacote: { origemIp: meuIp, destinoIp, ttl, protocolo } });
    const mac = arp(t, estado, atual, rota.porta, rota.proximo, eventos);
    if (!mac) return { ok: false, resumo: `${rota.proximo} não respondeu ao ARP a partir de ${atual.nome}: host de destino inalcançável.` };
    const meuMac = macDe(atual, rota.porta.nome);
    const chegadas = entregarQuadro(t, estado, atual, rota.porta, mac, meuMac, eventos, { origemMac: meuMac, destinoMac: mac, origemIp: meuIp, destinoIp, ttl, protocolo });
    const proximo = chegadas.find((c) => macDe(c.dispositivo, c.porta.nome) === mac);
    if (!proximo) {
      const msg = `O quadro para ${mac} não chegou a ninguém (VLAN diferente ou porta desligada no caminho).`;
      eventos.push({ texto: msg, de: atual.id, para: atual.id, camada: 2, erro: true });
      return { ok: false, resumo: msg };
    }
    atual = proximo.dispositivo;
    if (ehHost(atual) && !interfacesIp(atual).some((i) => i.ip === destinoIp)) {
      const msg = `${atual.nome} recebeu um pacote para ${destinoIp}, que não é dele, e descartou (um PC não roteia).`;
      eventos.push({ texto: msg, de: atual.id, para: atual.id, camada: 3, erro: true });
      return { ok: false, resumo: msg };
    }
  }
  return { ok: false, resumo: "Caminho longo demais: provável laço." };
}

/** Traceroute: pings com TTL crescente; cada roteador que zera o TTL aparece como um salto. */
export function traceroute(t: Topologia, estado: Estado, origemId: string, destinoIp: string): { saltos: string[]; resultado: Resultado } {
  const saltos: string[] = [];
  for (let ttl = 1; ttl <= 15; ttl++) {
    const r = ping(t, estado, origemId, destinoIp, ttl);
    if (r.sucesso) {
      saltos.push(`${ttl}  ${destinoIp}`);
      return { saltos, resultado: r };
    }
    const expirado = r.eventos.find((e) => e.erro && e.texto.includes("TTL chegou a zero"));
    if (expirado) {
      const d = dispositivo(t, expirado.de);
      saltos.push(`${ttl}  ${interfacesIp(d!)[0]?.ip ?? d?.nome} (${d?.nome})`);
      continue;
    }
    saltos.push(`${ttl}  * * *`);
    return { saltos, resultado: r };
  }
  return { saltos, resultado: { sucesso: false, resumo: "Mais de 15 saltos.", eventos: [] } };
}

// ───────────── Terminal dos hosts ─────────────

export function comandoDeHost(t: Topologia, estado: Estado, d: Dispositivo, linha: string): { saida: string; resultado?: Resultado } {
  const [cmd, ...args] = linha.trim().split(/\s+/);
  const eth = d.portas[0];
  switch ((cmd ?? "").toLowerCase()) {
    case "":
      return { saida: "" };
    case "help":
    case "?":
      return { saida: "Comandos: ipconfig, ping <ip>, traceroute <ip> (ou tracert), arp -a, help" };
    case "ipconfig":
    case "ifconfig":
      return { saida: `Interface ${eth.nome}\n  Endereço MAC . . . : ${macDe(d, eth.nome)}\n  Endereço IPv4. . . : ${eth.ip || "(não configurado)"}\n  Máscara de sub-rede: ${eth.mascara || "(não configurada)"}\n  Gateway padrão . . : ${d.gateway || "(nenhum)"}\n  Servidor DNS . . . : ${d.dns || "(nenhum)"}\n  Estado . . . . . . : ${vizinho(t, d.id, eth.nome) ? "conectado" : "cabo desconectado"}` };
    case "arp":
      return { saida: Object.entries(estado.arp[d.id] ?? {}).map(([ip, mac]) => `  ${ip.padEnd(16)} ${mac}`).join("\n") || "  (tabela ARP vazia)" };
    case "ping": {
      if (!args[0]) return { saida: "uso: ping <ip>" };
      const r = ping(t, estado, d.id, args[0]);
      return { saida: r.sucesso ? `Disparando ${args[0]} com 32 bytes de dados:\n${r.resumo}\n${r.resumo}\n${r.resumo}\n${r.resumo}\nPacotes: enviados = 4, recebidos = 4, perdidos = 0 (0% de perda)` : `Disparando ${args[0]}:\n${r.resumo}\nPacotes: enviados = 4, recebidos = 0, perdidos = 4 (100% de perda)`, resultado: r };
    }
    case "traceroute":
    case "tracert": {
      if (!args[0]) return { saida: "uso: traceroute <ip>" };
      const { saltos, resultado } = traceroute(t, estado, d.id, args[0]);
      return { saida: `Rastreando a rota para ${args[0]}:\n${saltos.join("\n")}`, resultado };
    }
    default:
      return { saida: `'${cmd}' não é reconhecido. Comandos: ipconfig, ping, traceroute, arp -a.` };
  }
}

// ───────────── Terminal de switch e roteador (subconjunto didático) ─────────────

export interface Sessao {
  modo: "usuario" | "privilegiado" | "config" | "config-if" | "config-vlan";
  interfaceAtual?: string;
  vlanAtual?: number;
}

export const COMANDOS_DO_IOS = [
  "enable", "disable", "exit", "end", "configure terminal", "hostname <nome>", "interface <nome>", "ip address <ip> <máscara>", "no shutdown", "shutdown", "description <texto>",
  "switchport mode access | trunk", "switchport access vlan <n>", "vlan <n>", "name <nome>", "ip route <rede> <máscara> <próximo salto | interface>", "no ip route <rede> <máscara>",
  "show running-config", "show ip interface brief", "show ip route", "show mac address-table", "show vlan brief", "show arp", "ping <ip>", "traceroute <ip>", "?",
];

export function prompt(d: Dispositivo, s: Sessao): string {
  const base = d.nome;
  switch (s.modo) {
    case "usuario": return `${base}>`;
    case "privilegiado": return `${base}#`;
    case "config": return `${base}(config)#`;
    case "config-if": return `${base}(config-if)#`;
    case "config-vlan": return `${base}(config-vlan)#`;
  }
}

/** Completa um comando parcial com Tab (só o primeiro token e alguns subcomandos). */
export function completar(linha: string, s: Sessao): string | null {
  const raiz: Record<Sessao["modo"], string[]> = {
    usuario: ["enable", "show", "ping", "traceroute", "exit"],
    privilegiado: ["configure", "show", "ping", "traceroute", "disable", "exit"],
    config: ["hostname", "interface", "vlan", "ip", "no", "exit", "end"],
    "config-if": ["ip", "no", "shutdown", "description", "switchport", "exit", "end"],
    "config-vlan": ["name", "exit", "end"],
  };
  const partes = linha.split(/\s+/);
  if (partes.length === 1) {
    const op = raiz[s.modo].filter((c) => c.startsWith(partes[0]));
    return op.length === 1 ? `${op[0]} ` : null;
  }
  if (partes[0] === "show" && partes.length === 2) {
    const op = ["running-config", "ip", "mac", "vlan", "arp"].filter((c) => c.startsWith(partes[1]));
    return op.length === 1 ? `show ${op[0]} ` : null;
  }
  if (partes[0] === "configure") return "configure terminal";
  if (partes[0] === "switchport" && partes.length === 2) {
    const op = ["mode", "access"].filter((c) => c.startsWith(partes[1]));
    return op.length === 1 ? `switchport ${op[0]} ` : null;
  }
  return null;
}

/** Executa uma linha no terminal de um switch ou roteador. Muda o dispositivo (dentro da topologia) e a sessão. */
export function comandoDeIos(t: Topologia, estado: Estado, d: Dispositivo, s: Sessao, linha: string): { saida: string; sessao: Sessao; resultado?: Resultado } {
  const tokens = linha.trim().split(/\s+/).filter(Boolean);
  const texto = tokens.join(" ").toLowerCase();
  const sessao: Sessao = { ...s };
  const erro = (m: string) => ({ saida: `% ${m}`, sessao });
  const ehSwitch = d.tipo === "switch";
  if (tokens.length === 0) return { saida: "", sessao };
  if (texto === "?" || texto === "help") {
    const porModo: Record<Sessao["modo"], string> = {
      usuario: "enable (entrar no modo privilegiado), show …, ping <ip>, traceroute <ip>",
      privilegiado: "configure terminal, show running-config | ip interface brief | ip route | mac address-table | vlan brief | arp, ping, traceroute, disable",
      config: `hostname <nome>, interface <nome>, ${ehSwitch ? "vlan <n>, " : "ip route <rede> <máscara> <próximo salto|interface>, "}exit, end`,
      "config-if": `${ehSwitch ? "switchport mode access|trunk, switchport access vlan <n>, " : "ip address <ip> <máscara>, "}no shutdown, shutdown, description <texto>, exit`,
      "config-vlan": "name <nome>, exit",
    };
    return { saida: `Comandos neste modo:\n  ${porModo[s.modo]}\nTodos os comandos deste simulador: help completo em "Comandos disponíveis".`, sessao };
  }
  if (texto === "exit") {
    sessao.modo = s.modo === "config-if" || s.modo === "config-vlan" ? "config" : s.modo === "config" ? "privilegiado" : "usuario";
    return { saida: "", sessao };
  }
  if (texto === "end") { sessao.modo = s.modo === "usuario" ? "usuario" : "privilegiado"; return { saida: "", sessao }; }
  if (texto === "enable" || texto === "en") { if (s.modo === "usuario") sessao.modo = "privilegiado"; return { saida: "", sessao }; }
  if (texto === "disable") { sessao.modo = "usuario"; return { saida: "", sessao }; }
  if (tokens[0].toLowerCase() === "ping" || tokens[0].toLowerCase() === "traceroute") {
    if (!tokens[1]) return erro("Uso: ping <ip>");
    if (tokens[0].toLowerCase() === "ping") {
      const r = ping(t, estado, d.id, tokens[1]);
      return { saida: r.sucesso ? `Enviando 5 ICMP para ${tokens[1]}:\n!!!!!\nTaxa de sucesso 100% (5/5)` : `Enviando 5 ICMP para ${tokens[1]}:\n.....\nTaxa de sucesso 0% (0/5). ${r.resumo}`, sessao, resultado: r };
    }
    const { saltos, resultado } = traceroute(t, estado, d.id, tokens[1]);
    return { saida: saltos.join("\n"), sessao, resultado };
  }
  if (tokens[0].toLowerCase() === "show" || tokens[0].toLowerCase() === "sh") {
    const o = tokens.slice(1).join(" ").toLowerCase();
    if (o.startsWith("run")) {
      const linhas = [`hostname ${d.nome}`];
      if (ehSwitch) for (const v of d.vlans.filter((x) => x.id !== 1)) linhas.push(`vlan ${v.id}`, ` name ${v.nome}`);
      for (const p of d.portas) {
        linhas.push(`interface ${p.nome}`);
        if (p.descricao) linhas.push(` description ${p.descricao}`);
        if (!ehSwitch && p.ip) linhas.push(` ip address ${p.ip} ${p.mascara}`);
        if (ehSwitch) linhas.push(p.modo === "trunk" ? " switchport mode trunk" : ` switchport mode access`, ...(p.modo === "access" && p.vlan !== 1 ? [` switchport access vlan ${p.vlan}`] : []));
        linhas.push(p.ligada ? " no shutdown" : " shutdown");
      }
      for (const r of d.rotas) linhas.push(`ip route ${r.rede} ${r.mascara} ${r.via}`);
      return { saida: linhas.join("\n"), sessao };
    }
    if (o.startsWith("ip int")) return { saida: ["Interface            IP-Address      OK? Status", ...d.portas.map((p) => `${p.nome.padEnd(20)} ${(p.ip || "unassigned").padEnd(15)} YES ${p.ligada ? (vizinho(t, d.id, p.nome) ? "up" : "down (sem cabo)") : "administratively down"}`)].join("\n"), sessao };
    if (o.startsWith("ip route")) {
      const conectadas = interfacesIp(d).map((i) => `C    ${redeDe(i.ip, i.mascara)}/${prefixo(i.mascara)} está diretamente conectada, ${i.porta.nome}`);
      const estaticas = d.rotas.map((r) => `S    ${r.rede}/${prefixo(r.mascara)} via ${r.via}`);
      return { saida: ["Códigos: C - conectada, S - estática", ...conectadas, ...estaticas].join("\n") || "(sem rotas)", sessao };
    }
    if (o.startsWith("mac")) return { saida: ["VLAN  Endereço MAC        Tipo     Porta", ...Object.entries(estado.mac[d.id] ?? {}).map(([mac, v]) => `${String(v.vlan).padEnd(5)} ${mac.padEnd(19)} DYNAMIC  ${v.porta}`)].join("\n"), sessao };
    if (o.startsWith("vlan")) return { saida: ["VLAN  Nome        Portas", ...d.vlans.map((v) => `${String(v.id).padEnd(5)} ${v.nome.padEnd(11)} ${d.portas.filter((p) => p.modo === "access" && p.vlan === v.id).map((p) => p.nome).join(", ")}`)].join("\n"), sessao };
    if (o.startsWith("arp")) return { saida: Object.entries(estado.arp[d.id] ?? {}).map(([ip, mac]) => `${ip.padEnd(16)} ${mac}`).join("\n") || "(vazia)", sessao };
    return erro("show: use running-config, ip interface brief, ip route, mac address-table, vlan brief ou arp.");
  }
  if (s.modo === "usuario") return erro("Comando inválido neste modo. Digite enable para entrar no modo privilegiado.");
  if (texto === "configure terminal" || texto === "conf t" || texto === "configure t") { if (s.modo !== "privilegiado") return erro("configure terminal só no modo privilegiado (#)."); sessao.modo = "config"; return { saida: "", sessao }; }
  if (s.modo === "privilegiado") return erro("Comando inválido. Para configurar, digite configure terminal.");
  if (tokens[0].toLowerCase() === "hostname") { if (!/^[A-Za-z][\w-]{0,19}$/.test(tokens[1] ?? "")) return erro("hostname: nome inválido (letras, números e hífen, até 20)."); d.nome = tokens[1]; return { saida: "", sessao }; }
  if (tokens[0].toLowerCase() === "interface" || tokens[0].toLowerCase() === "int") {
    const nome = tokens.slice(1).join("").replace(/^fa(?=\d)/i, "Fa").replace(/^gi(?=\d)/i, "Gi").replace(/^fastethernet/i, "Fa").replace(/^gigabitethernet/i, "Gi");
    const p = d.portas.find((x) => x.nome.toLowerCase() === nome.toLowerCase());
    if (!p) return erro(`interface: ${nome || "?"} não existe. Interfaces: ${d.portas.map((x) => x.nome).join(", ")}.`);
    sessao.modo = "config-if"; sessao.interfaceAtual = p.nome; return { saida: "", sessao };
  }
  if (tokens[0].toLowerCase() === "vlan" && ehSwitch) {
    const n = Number(tokens[1]);
    if (!(n >= 2 && n <= 4094)) return erro("vlan: número entre 2 e 4094.");
    if (!d.vlans.some((v) => v.id === n)) d.vlans.push({ id: n, nome: `VLAN${String(n).padStart(4, "0")}` });
    sessao.modo = "config-vlan"; sessao.vlanAtual = n; return { saida: "", sessao };
  }
  if (s.modo === "config-vlan" && tokens[0].toLowerCase() === "name") { const v = d.vlans.find((x) => x.id === s.vlanAtual); if (v) v.nome = (tokens[1] ?? "").slice(0, 20); return { saida: "", sessao }; }
  if (tokens[0].toLowerCase() === "ip" && tokens[1]?.toLowerCase() === "route" && !ehSwitch) {
    const [, , rede, mascara, via] = tokens;
    if (!ipValido(rede ?? "") || !mascaraValida(mascara ?? "") || !via) return erro("Uso: ip route <rede> <máscara> <próximo salto | interface>. Ex.: ip route 0.0.0.0 0.0.0.0 10.0.0.1");
    if (!ipValido(via) && !d.portas.some((p) => p.nome.toLowerCase() === via.toLowerCase())) return erro(`ip route: ${via} não é um IP nem uma interface deste roteador.`);
    d.rotas = d.rotas.filter((r) => !(r.rede === rede && r.mascara === mascara));
    d.rotas.push({ rede, mascara, via });
    return { saida: "", sessao };
  }
  if (tokens[0].toLowerCase() === "no" && tokens[1]?.toLowerCase() === "ip" && tokens[2]?.toLowerCase() === "route") { d.rotas = d.rotas.filter((r) => !(r.rede === tokens[3] && r.mascara === tokens[4])); return { saida: "", sessao }; }
  if (s.modo === "config-if") {
    const p = d.portas.find((x) => x.nome === s.interfaceAtual)!;
    if (texto === "no shutdown" || texto === "no shut") { p.ligada = true; return { saida: `%LINK: ${p.nome} mudou para up`, sessao }; }
    if (texto === "shutdown" || texto === "shut") { p.ligada = false; return { saida: `%LINK: ${p.nome} mudou para administratively down`, sessao }; }
    if (tokens[0].toLowerCase() === "description") { p.descricao = tokens.slice(1).join(" ").slice(0, 60); return { saida: "", sessao }; }
    if (tokens[0].toLowerCase() === "ip" && tokens[1]?.toLowerCase() === "address") {
      if (ehSwitch) return erro("Este switch de camada 2 não tem IP nas portas. Configure VLANs com switchport.");
      if (!ipValido(tokens[2] ?? "") || !mascaraValida(tokens[3] ?? "")) return erro("Uso: ip address <ip> <máscara>. Ex.: ip address 192.168.1.1 255.255.255.0");
      p.ip = tokens[2]; p.mascara = tokens[3]; return { saida: "", sessao };
    }
    if (tokens[0].toLowerCase() === "switchport") {
      if (!ehSwitch) return erro("switchport é comando de switch.");
      if (tokens[1]?.toLowerCase() === "mode" && (tokens[2] === "access" || tokens[2] === "trunk")) { p.modo = tokens[2]; return { saida: "", sessao }; }
      if (tokens[1]?.toLowerCase() === "access" && tokens[2]?.toLowerCase() === "vlan") {
        const n = Number(tokens[3]);
        if (!(n >= 1 && n <= 4094)) return erro("switchport access vlan <1-4094>");
        if (!d.vlans.some((v) => v.id === n)) { d.vlans.push({ id: n, nome: `VLAN${String(n).padStart(4, "0")}` }); }
        p.vlan = n; p.modo = "access"; return { saida: "", sessao };
      }
      return erro("Uso: switchport mode access|trunk  ou  switchport access vlan <n>");
    }
  }
  return erro(`Comando desconhecido ou fora do modo certo: "${tokens[0]}". Digite ? para ver os comandos deste modo.`);
}

// ───────────── Exercícios ─────────────

export type Verificacao =
  | { tipo: "ping"; de: string; para: string; deve: boolean; texto: string }
  | { tipo: "vlan"; dispositivo: string; porta: string; vlan: number; texto: string }
  | { tipo: "rota"; dispositivo: string; rede: string; texto: string };

export interface ExercicioDeRede {
  id: string;
  titulo: string;
  objetivo: string;
  topologia: Topologia;
  verificacoes: Verificacao[];
  dicas: string[];
  solucao?: string;
  nivel: 1 | 2 | 3;
}

/** Roda as verificações de um exercício na topologia atual (com estado novo, para não depender de tabelas antigas). */
export function verificar(t: Topologia, ex: ExercicioDeRede): { verificacao: Verificacao; passou: boolean; detalhe: string }[] {
  const porNome = (nome: string) => t.dispositivos.find((d) => d.nome === nome || d.id === nome);
  return ex.verificacoes.map((v) => {
    if (v.tipo === "ping") {
      const de = porNome(v.de);
      const para = porNome(v.para);
      const ipDestino = para ? interfacesIp(para)[0]?.ip : v.para;
      if (!de || !ipDestino) return { verificacao: v, passou: !v.deve, detalhe: de ? `${v.para} sem IP` : `${v.de} não existe` };
      const r = ping(t, estadoNovo(), de.id, ipDestino);
      return { verificacao: v, passou: r.sucesso === v.deve, detalhe: r.resumo };
    }
    if (v.tipo === "vlan") {
      const d = porNome(v.dispositivo);
      const p = d?.portas.find((x) => x.nome === v.porta);
      return { verificacao: v, passou: Boolean(p && p.modo === "access" && p.vlan === v.vlan), detalhe: p ? `${p.nome}: ${p.modo} VLAN ${p.vlan}` : "porta não existe" };
    }
    const d = porNome(v.dispositivo);
    const tem = Boolean(d?.rotas.some((r) => `${r.rede}/${prefixo(r.mascara)}` === v.rede));
    return { verificacao: v, passou: tem, detalhe: tem ? "rota presente" : "rota ausente" };
  });
}
