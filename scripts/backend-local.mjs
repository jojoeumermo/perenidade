// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
//
// Um substituto local do serviço de banco e contas, para desenvolver e testar o painel sem
// tocar no banco de verdade. Escuta só em 127.0.0.1 e guarda tudo na memória.
//
//   npm run dev:local      sobe este servidor e o site apontando para ele
//
// Contas de teste (qualquer senha serve aqui, e só aqui):
//   coord@local  vice@local  curadora@local  prof@local (educador de matemática)  mentora@local  designer@local
//   jornal@local  revisor@local  leitora@local
// Segundo fator: no cadastro e na confirmação, o código é sempre 123456.
import crypto from "node:crypto";
import http from "node:http";
import { criarBanco } from "./banco-local.mjs";

export const PORTA = 54399;
export const URL_LOCAL = `http://127.0.0.1:${PORTA}`;
// Segredo fixo de desenvolvimento: não abre nada fora desta máquina.
const SEGREDO = "instituto-lucia-desenvolvimento-local";

const b64 = (valor) => Buffer.from(valor).toString("base64url");
function assinar(dados) {
  const cabeca = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const corpo = b64(JSON.stringify(dados));
  return `${cabeca}.${corpo}.${crypto.createHmac("sha256", SEGREDO).update(`${cabeca}.${corpo}`).digest("base64url")}`;
}
function conferir(token) {
  const [cabeca, corpo, selo] = String(token ?? "").split(".");
  if (!cabeca || !corpo || !selo) return null;
  const esperado = crypto.createHmac("sha256", SEGREDO).update(`${cabeca}.${corpo}`).digest("base64url");
  if (esperado.length !== selo.length || !crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(selo))) return null;
  try {
    const dados = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8"));
    return dados.exp && dados.exp < Date.now() / 1000 ? null : dados;
  } catch {
    return null;
  }
}
const longe = Math.floor(Date.now() / 1000) + 10 * 365 * 86400;
export const CHAVE_ANON = assinar({ role: "anon", iss: "local", exp: longe });
export const CHAVE_SERVICO = assinar({ role: "service_role", iss: "local", exp: longe });

export async function iniciar({ silencioso = false } = {}) {
  const banco = await criarBanco();
  const contas = { coord: "Jonathan Santos", vice: "Vera Vice", curadora: "Carla Curadora", prof: "Paulo Professor", mentora: "Marta Mentora", designer: "Davi Designer", jornal: "Joana Jornalista", revisor: "Rui Revisor", leitora: "Lia Leitora" };
  const ids = {};
  for (const [chave, nome] of Object.entries(contas)) {
    ids[chave] = await banco.criarUsuario(`${chave}@local`, nome);
    await banco.rpc({ papel: "authenticated", sub: ids[chave] }, "eu");
    await banco.rpc({ papel: "authenticated", sub: ids[chave] }, "perfil_salvar", { p_nome: nome, p_bio: "" });
  }
  await banco.dono("select public.promover_coordenacao('coord@local')");
  const coord = { papel: "authenticated", sub: ids.coord };
  await banco.rpc(coord, "papel_conceder", { p_usuario: ids.vice, p_papel: "vice", p_disciplina: null });
  await banco.rpc(coord, "papel_conceder", { p_usuario: ids.mentora, p_papel: "mentoria", p_disciplina: "matematica" });
  await banco.rpc(coord, "papel_conceder", { p_usuario: ids.designer, p_papel: "design", p_disciplina: null });
  await banco.rpc(coord, "papel_conceder", { p_usuario: ids.curadora, p_papel: "curadoria", p_disciplina: null });
  await banco.rpc(coord, "papel_conceder", { p_usuario: ids.prof, p_papel: "educacao", p_disciplina: "matematica" });
  await banco.rpc(coord, "papel_conceder", { p_usuario: ids.jornal, p_papel: "jornalismo", p_disciplina: null });
  await banco.rpc(coord, "papel_conceder", { p_usuario: ids.revisor, p_papel: "revisao", p_disciplina: null });

  const renovacoes = new Map();
  const links = new Map();
  const arquivos = new Map();
  /** Aplicativos autenticadores de mentira, por pessoa. */
  const fatores = new Map();
  const fatoresDe = (id) => fatores.get(id) ?? [];

  const usuarioPorEmail = async (email) => (await banco.dono("select * from auth.users where email = $1", [String(email ?? "").trim().toLowerCase()])).rows[0] ?? null;
  const usuarioPorId = async (id) => (await banco.dono("select * from auth.users where id = $1", [id])).rows[0] ?? null;
  const usuarioJson = (u) => ({ id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: u.created_at, app_metadata: { provider: "email" }, user_metadata: u.raw_user_meta_data ?? {}, identities: [], factors: fatoresDe(u.id), created_at: u.created_at });
  function sessao(u, aal = "aal1") {
    const agora = Math.floor(Date.now() / 1000);
    const renovacao = crypto.randomBytes(16).toString("hex");
    renovacoes.set(renovacao, { id: u.id, aal });
    const amr = [{ method: "password", timestamp: agora }, ...(aal === "aal2" ? [{ method: "totp", timestamp: agora }] : [])];
    return { access_token: assinar({ aud: "authenticated", role: "authenticated", sub: u.id, email: u.email, aal, amr, session_id: crypto.randomUUID(), iat: agora, exp: agora + 3600 }), token_type: "bearer", expires_in: 3600, expires_at: agora + 3600, refresh_token: renovacao, user: usuarioJson(u) };
  }
  const portador = (req) => conferir((req.headers.authorization ?? "").replace(/^Bearer\s+/i, ""));

  const json = (res, status, corpo) => {
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(corpo === undefined ? "" : JSON.stringify(corpo));
  };

  const servidor = http.createServer(async (req, res) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "authorization, apikey, content-type, prefer, accept, accept-profile, content-profile, x-client-info, x-supabase-api-version, x-upsert, cache-control, range");
    res.setHeader("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }
    const url = new URL(req.url, URL_LOCAL);
    const pedacos = [];
    for await (const pedaco of req) pedacos.push(pedaco);
    const bruto = Buffer.concat(pedacos);
    let corpo = {};
    if ((req.headers["content-type"] ?? "").includes("json")) {
      try {
        corpo = bruto.length ? JSON.parse(bruto.toString("utf8")) : {};
      } catch {
        corpo = {};
      }
    }

    try {
      // ── Funções do banco ──
      const funcao = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(url.pathname);
      if (funcao && req.method === "POST") {
        const dados = portador(req);
        const quem = dados?.role === "service_role" ? { papel: "service_role" } : dados?.role === "authenticated" && dados.sub ? { papel: "authenticated", sub: dados.sub, aal: dados.aal } : { papel: "anon" };
        try {
          return json(res, 200, await banco.rpc({ ...quem, ip: req.socket.remoteAddress }, funcao[1], corpo));
        } catch (erro) {
          return json(res, 400, { code: "P0001", message: String(erro?.message ?? erro), details: null, hint: null });
        }
      }

      // ── Contas ──
      if (url.pathname === "/auth/v1/token" && req.method === "POST") {
        const tipo = url.searchParams.get("grant_type");
        if (tipo === "password") {
          let u = await usuarioPorEmail(corpo.email);
          if (!u) {
            if (!/^[^@\s]+@[^@\s]+$/.test(String(corpo.email ?? ""))) return json(res, 400, { error_code: "invalid_credentials", msg: "Invalid login credentials" });
            await banco.criarUsuario(String(corpo.email).trim().toLowerCase(), String(corpo.email).split("@")[0]);
            u = await usuarioPorEmail(corpo.email);
          }
          return json(res, 200, sessao(u));
        }
        if (tipo === "refresh_token") {
          const antiga = renovacoes.get(corpo.refresh_token);
          const u = antiga ? await usuarioPorId(antiga.id) : null;
          if (!u) return json(res, 400, { error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
          renovacoes.delete(corpo.refresh_token);
          return json(res, 200, sessao(u, antiga.aal));
        }
        return json(res, 400, { error_code: "invalid_grant", msg: "unsupported grant type" });
      }
      if (url.pathname === "/auth/v1/otp" && req.method === "POST") {
        const email = String(corpo.email ?? "").trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && !email.endsWith("@local")) return json(res, 422, { error_code: "validation_failed", msg: "Unable to validate email address" });
        if (!(await usuarioPorEmail(email))) await banco.criarUsuario(email, email.split("@")[0]);
        const token = crypto.randomBytes(12).toString("hex");
        const destino = url.searchParams.get("redirect_to") ?? corpo.options?.emailRedirectTo ?? "http://localhost:3100/pt/painel";
        links.set(token, { email, destino });
        if (!silencioso) console.log(`[local] link de entrada para ${email}: ${URL_LOCAL}/auth/v1/verify?token=${token}`);
        return json(res, 200, {});
      }
      if (url.pathname === "/auth/v1/verify" && req.method === "GET") {
        const link = links.get(url.searchParams.get("token"));
        if (!link) return json(res, 403, { error_code: "otp_expired", msg: "Email link is invalid or has expired" });
        links.delete(url.searchParams.get("token"));
        const s = sessao(await usuarioPorEmail(link.email));
        res.writeHead(302, { location: `${link.destino}#access_token=${s.access_token}&refresh_token=${s.refresh_token}&expires_in=3600&expires_at=${s.expires_at}&token_type=bearer&type=magiclink` });
        return res.end();
      }
      if (url.pathname === "/auth/v1/user" && req.method === "GET") {
        const dados = portador(req);
        const u = dados?.sub ? await usuarioPorId(dados.sub) : null;
        return u ? json(res, 200, usuarioJson(u)) : json(res, 403, { error_code: "session_not_found", msg: "Session not found" });
      }
      // ── Segundo fator (de mentira: o código é sempre 123456) ──
      if (url.pathname === "/auth/v1/factors" && req.method === "POST") {
        const dados = portador(req);
        if (!dados?.sub) return json(res, 401, { error_code: "no_authorization", msg: "No authorization" });
        const fator = { id: crypto.randomUUID(), friendly_name: String(corpo.friendly_name ?? ""), factor_type: "totp", status: "unverified", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        fatores.set(dados.sub, [...fatoresDe(dados.sub), fator]);
        const desenho = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect width='200' height='200' fill='white'/><text x='100' y='95' text-anchor='middle' font-size='16'>teste local</text><text x='100' y='125' text-anchor='middle' font-size='22'>123456</text></svg>`;
        return json(res, 200, { id: fator.id, type: "totp", totp: { qr_code: desenho, secret: "CHAVEDETESTELOCAL", uri: "otpauth://totp/local?secret=CHAVEDETESTELOCAL" } });
      }
      const fatorPedido = /^\/auth\/v1\/factors\/([0-9a-f-]{36})(\/challenge|\/verify)?$/.exec(url.pathname);
      if (fatorPedido) {
        const dados = portador(req);
        const lista = dados?.sub ? fatoresDe(dados.sub) : [];
        const fator = lista.find((item) => item.id === fatorPedido[1]);
        if (!fator) return json(res, 404, { error_code: "mfa_factor_not_found", msg: "Factor not found" });
        if (req.method === "DELETE" && !fatorPedido[2]) {
          fatores.set(dados.sub, lista.filter((item) => item.id !== fator.id));
          return json(res, 200, { id: fator.id });
        }
        if (req.method === "POST" && fatorPedido[2] === "/challenge") return json(res, 200, { id: crypto.randomUUID(), type: "totp", expires_at: Math.floor(Date.now() / 1000) + 300 });
        if (req.method === "POST" && fatorPedido[2] === "/verify") {
          if (String(corpo.code ?? "") !== "123456") return json(res, 422, { error_code: "mfa_verification_failed", msg: "Invalid TOTP code entered" });
          fator.status = "verified";
          return json(res, 200, sessao(await usuarioPorId(dados.sub), "aal2"));
        }
      }
      if (url.pathname === "/auth/v1/logout" && req.method === "POST") {
        res.writeHead(204);
        return res.end();
      }
      if (url.pathname === "/__dev/links") return json(res, 200, [...links.entries()].map(([token, link]) => ({ ...link, link: `${URL_LOCAL}/auth/v1/verify?token=${token}` })));

      // ── Arquivos (rádio) ──
      const envio = /^\/storage\/v1\/object\/(radio\/.+)$/.exec(url.pathname);
      if (envio && req.method === "POST") {
        const dados = portador(req);
        const pode = dados?.sub ? await banco.dono("select 1 from interno.papeis where usuario = $1 and papel in ('coordenacao', 'vice')", [dados.sub]) : { rows: [] };
        if (pode.rows.length === 0) return json(res, 403, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
        arquivos.set(envio[1], { tipo: req.headers["content-type"] ?? "application/octet-stream", dados: bruto });
        return json(res, 200, { Key: envio[1], Id: crypto.randomUUID() });
      }
      const guardado = /^\/storage\/v1\/object\/(?:authenticated\/)?(envios\/.+)$/.exec(url.pathname);
      if (guardado) {
        const dados = portador(req);
        const caminho = decodeURIComponent(guardado[1]);
        const pasta = caminho.split("/")[1];
        if (dados?.role === "service_role") {
          if (req.method === "GET") {
            const arquivo = arquivos.get(caminho);
            if (!arquivo) return json(res, 404, { message: "not found" });
            res.writeHead(200, { "content-type": arquivo.tipo, "content-length": arquivo.dados.length });
            return res.end(arquivo.dados);
          }
          if (req.method === "DELETE") {
            arquivos.delete(caminho);
            return json(res, 200, { message: "ok" });
          }
        }
        const papeisDe = dados?.sub ? (await banco.dono("select papel from interno.papeis where usuario = $1", [dados.sub])).rows.map((linha) => linha.papel) : [];
        const escreve = papeisDe.some((papel) => ["coordenacao", "vice", "curadoria", "educacao", "jornalismo", "design"].includes(papel));
        const le = pasta === dados?.sub || papeisDe.some((papel) => ["coordenacao", "vice", "curadoria", "revisao"].includes(papel));
        if (req.method === "POST") {
          if (!escreve || pasta !== dados?.sub) return json(res, 403, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
          // O cliente manda o arquivo dentro de um formulário de várias partes: tira de lá o tipo e os bytes.
          let tipo = req.headers["content-type"] ?? "";
          let conteudo = bruto;
          const limite = /^multipart\/form-data;\s*boundary=(.+)$/i.exec(tipo)?.[1];
          if (limite) {
            const texto = bruto.toString("latin1");
            const parte = texto.split(`--${limite}`).find((pedaco) => /filename=/i.test(pedaco));
            const corte = parte ? parte.indexOf("\r\n\r\n") : -1;
            if (corte < 0) return json(res, 400, { statusCode: "400", error: "invalid_request", message: "no file" });
            tipo = /content-type:\s*([^\r\n]+)/i.exec(parte.slice(0, corte))?.[1]?.trim() ?? "";
            conteudo = Buffer.from(parte.slice(corte + 4).replace(/\r\n$/, ""), "latin1");
          }
          if (!["image/webp", "image/jpeg", "application/pdf"].includes(tipo) || conteudo.length > 8388608) return json(res, 415, { statusCode: "415", error: "invalid_mime_type", message: "mime type not supported" });
          arquivos.set(caminho, { tipo, dados: conteudo });
          return json(res, 200, { Key: caminho, Id: crypto.randomUUID() });
        }
        if (req.method === "GET") {
          const arquivo = le ? arquivos.get(caminho) : null;
          if (!arquivo) return json(res, 404, { message: "not found" });
          res.writeHead(200, { "content-type": arquivo.tipo, "content-length": arquivo.dados.length });
          return res.end(arquivo.dados);
        }
      }
      const leitura = /^\/storage\/v1\/object\/public\/(radio\/.+)$/.exec(url.pathname);
      if (leitura && req.method === "GET") {
        const arquivo = arquivos.get(decodeURIComponent(leitura[1]));
        if (!arquivo) return json(res, 404, { message: "not found" });
        res.writeHead(200, { "content-type": arquivo.tipo, "content-length": arquivo.dados.length, "accept-ranges": "bytes" });
        return res.end(arquivo.dados);
      }
      return json(res, 404, { message: `sem substituto local para ${req.method} ${url.pathname}` });
    } catch (erro) {
      console.error("[local]", req.method, url.pathname, erro);
      return json(res, 500, { code: "XX000", message: String(erro?.message ?? erro) });
    }
  });

  await new Promise((resolve) => servidor.listen(PORTA, "127.0.0.1", resolve));
  if (!silencioso) console.log(`[local] banco e contas de teste em ${URL_LOCAL}`);
  return { banco, ids, servidor };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  await iniciar();
}
