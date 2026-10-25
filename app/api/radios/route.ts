// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Busca de emissoras brasileiras no Radio Browser (radio-browser.info), o diretório aberto de rádios. Serve ao
// jornalismo para achar emissoras e indicá-las à lista "Rádios do povo". O diretório não diz a linha editorial de
// ninguém: quem decide se a emissora cabe na lista é a equipe, ouvindo. Usado só pelo painel.
import { buscarJson, responder, termo } from "@/lib/externo";

// O diretório roda em mais de um servidor; se um não responde, tenta o próximo.
const servidores = ["de1.api.radio-browser.info", "de2.api.radio-browser.info", "fi1.api.radio-browser.info"];

interface Estacao {
  stationuuid?: string;
  name?: string;
  url_resolved?: string;
  homepage?: string;
  tags?: string;
  state?: string;
  codec?: string;
  bitrate?: number;
  votes?: number;
  lastcheckok?: number;
}

export async function GET(pedido: Request) {
  const parametros = new URL(pedido.url).searchParams;
  const busca = termo(parametros.get("q"), 2, 60);
  const campo = parametros.get("por") === "tag" ? "tag" : "name";
  if (!busca) return responder({ emissoras: [] }, 3600);
  for (const servidor of servidores) {
    const lista = await buscarJson<Estacao[]>(
      `https://${servidor}/json/stations/search?countrycode=BR&${campo}=${encodeURIComponent(busca)}&hidebroken=true&order=votes&reverse=true&limit=30`,
      { guardar: 21600, prazo: 6000 },
    );
    if (!Array.isArray(lista)) continue;
    const emissoras = lista
      .filter((item) => item.stationuuid && item.name)
      .map((item) => ({
        id: item.stationuuid!,
        nome: item.name!.trim().slice(0, 120),
        lugar: (item.state ?? "").slice(0, 60),
        site: /^https:\/\//.test(item.homepage ?? "") ? item.homepage!.slice(0, 300) : "",
        transmissao: /^https:\/\//.test(item.url_resolved ?? "") ? item.url_resolved!.slice(0, 300) : "",
        etiquetas: (item.tags ?? "").split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 8),
        formato: [item.codec, item.bitrate ? `${item.bitrate} kbps` : ""].filter(Boolean).join(" · "),
        votos: item.votes ?? 0,
      }));
    return responder({ emissoras, fonte: "Radio Browser", servidor }, 21600);
  }
  return responder({ emissoras: [], erro: "indisponivel" }, 0);
}
