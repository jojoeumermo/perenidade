# Cantinho da Lua (área infantil): relatório de conformidade

Documento interno, para a revisão jurídica. Não é publicado no site. Em revisão. Outubro de 2026.

## O que existe

- `/criancas`: a área infantil (4 a 12 anos). Seis atividades: letras e sílabas, parlendas e fábulas, tabuada e frações,
  programação em blocos, internet segura e folhas para imprimir (caça-palavras e labirinto).
- `/criancas/adultos`: a página para pais, mães, responsáveis e educadores, com as configurações do aparelho.
- Código: `components/criancas/` e `app/[lang]/criancas/`.

## O que é coletado

**Nada.** Não há conta, cadastro, nome, foto, idade, voz, câmera, microfone, localização, upload, comentário, chat,
compartilhamento, anúncio, perfil, recomendação por comportamento, ranking, sequência diária nem compra.

Guardado **só no navegador do aparelho** (localStorage, chaves `lucia:criancas-*`):

| Chave | O que é | Quem apaga |
|---|---|---|
| `lucia:criancas-mudo` | Se o som está desligado | O adulto, em `/criancas/adultos` (botão "Apagar tudo") |
| `lucia:criancas-pausa` | Se o lembrete de pausa foi desligado | O mesmo botão |

Nenhuma requisição de rede sai das atividades: tudo é calculado no aparelho. A página carrega do próprio domínio.

## Pontos de atenção

1. **Síntese de voz.** As atividades usam `speechSynthesis`, a voz do próprio navegador. Em alguns navegadores (Chrome
   com vozes "Google", Edge com vozes "online"), o texto é enviado ao serviço da empresa do navegador para ser falado.
   O texto lido é sempre o do próprio site (letras, parlendas, fábulas), nunca algo digitado pela criança. A página
   para adultos explica isso e o som pode ser desligado.
2. **Portão de adulto.** Uma conta de multiplicação (6 a 12 × 13 a 19), sorteada a cada vez, antes de sair do Cantinho
   e antes das configurações. É uma barreira contra o toque acidental, **não** uma verificação de idade.
3. **Navegação.** Dentro de `/criancas`, o cabeçalho, o rodapé, o menu de baixo, a rádio e o aviso de abertura do
   site não aparecem (`components/OutsidePanel.tsx`, `naAreaInfantil`). O botão de acessibilidade continua. Não há
   link para fora do site dentro das atividades.
4. **Conteúdo.** Parlendas da tradição oral (domínio público) e fábulas atribuídas a Esopo recontadas com texto
   próprio. Desenhos: emoji do sistema e a mascote original em SVG. Nada de personagem, marca ou música de terceiros.
   Sem conteúdo político-partidário.
5. **Internet segura.** As histórias orientam a "contar a um adulto de confiança". A nota para o adulto cita o Disque
   100 e o Conselho Tutelar.

## Para o advogado confirmar

- **LGPD, art. 14** (dados de crianças e adolescentes): o entendimento é de que não há tratamento de dados pessoais
  de crianças, porque nada é coletado nem identificado. O armazenamento local (som e pausa) não identifica ninguém.
  Confirmar.
- **Estatuto Digital da Criança e do Adolescente (Lei nº 15.211/2025):** confirmar a vigência, se e como se aplica a
  um projeto sem fins lucrativos e sem CNPJ, e se algum dever (por exemplo, sobre verificação etária ou supervisão
  parental) alcança uma área sem conta e sem coleta.
- **Classificação indicativa:** confirmar se é necessária para conteúdo educativo sem vídeo.
- **Termos e Privacidade:** a seção do Cantinho foi acrescentada como rascunho (veja abaixo); revisar o texto.
- **Síntese de voz por serviço do navegador:** confirmar se o aviso na página para adultos basta.

## Textos acrescentados (rascunho)

- `content/paginas/termos.md`, seção "Cantinho da Lua (área infantil)".
- `content/paginas/privacidade.md`, seção "Cantinho da Lua (área infantil)".
- `content/paginas/criancas-adultos.md` (página para os adultos).
