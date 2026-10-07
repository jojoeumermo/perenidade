import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, locales } from "@/i18n/config";

/** Primeiro idioma do navegador que o site oferece; senão, português. */
function preferred(request: NextRequest): string {
  const header = request.headers.get("accept-language") ?? "";
  for (const part of header.split(",")) {
    const code = part.split(";")[0].trim().toLowerCase().split("-")[0];
    if (isLocale(code)) return code;
  }
  return defaultLocale;
}

// Todo endereço sem prefixo de idioma ("/", "/trilhas") é redirecionado para o idioma da pessoa.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (locales.some((code) => pathname === `/${code}` || pathname.startsWith(`/${code}/`))) return;
  const url = request.nextUrl.clone();
  url.pathname = `/${preferred(request)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Ignora arquivos internos do Next e qualquer caminho com extensão (ícone, sitemap, robots, .well-known).
  matcher: ["/((?!_next|\\.well-known|.*\\..*).*)"],
};
