// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O assistente aberto do site (app/api/assistente/route.ts) reaproveita a conferência e o pedido da Edge Function
// (supabase/functions/assistente/assistente.ts e provedores.ts), que importam SÓ OS TIPOS do SDK da Anthropic pelo endereço
// do Deno ("npm:…"). O site não instala esse SDK nem chama o Claude: a rota usa só os provedores gratuitos de formato
// aberto. Esta declaração dá ao `tsc` do site os poucos tipos que aqueles arquivos citam; nada disso vira código.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "npm:@anthropic-ai/sdk@0.133.0" {
  namespace Anthropic {
    namespace Beta {
      namespace Messages {
        type MessageCreateParamsNonStreaming = { [campo: string]: any; betas?: string[]; fallbacks?: string };
        type BetaContentBlockParam = any;
        type BetaJSONOutputFormat = any;
        type BetaTextBlock = { type: "text"; text: string; citations?: unknown };
        type BetaMessage = { stop_reason: string | null; content: any[] };
      }
    }
  }
  class Anthropic {
    static AuthenticationError: any;
    static PermissionDeniedError: any;
    static RateLimitError: any;
    static BadRequestError: any;
    static APIConnectionTimeoutError: any;
    static APIConnectionError: any;
    static APIError: any;
  }
  export default Anthropic;
}
