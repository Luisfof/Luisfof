# TESTES — MORAA GO

Última execução: 13/11/2026, ambiente Linux (contêiner de nuvem), Node 22.23, Chromium headless (Playwright 1.63).

| Verificação | Comando | Resultado |
|---|---|---|
| Tipagem (frontend + backend) | `npx tsc --noEmit` | sem erros |
| Build de produção | `npm run build` | ok — JS 314 kB (98 kB gzip), CSS 41 kB (10 kB gzip) |
| API (Vitest + Supertest) | `npm test` | **57 / 57** |
| E2E + acessibilidade (Playwright + axe) | `npm run test:e2e` | **25 / 25** (1 teste só-mobile é pulado no perfil desktop) |
| Vulnerabilidades de dependências | `npm audit` (na instalação) | 0 |

## O que os testes de API cobrem
Saúde e metadados; seed 100% demonstrativo; filtros de busca (cidade, bairro, tipo, preço, quartos, características, palavra-chave), ordenação e paginação; respostas públicas nunca contêm telefone/e-mail; cadastro, login, logout, sessão; senha fraca e termos não aceitos; cabeçalho anti-CSRF obrigatório; validação de anúncio por campo; ciclo pendente → aprovado → público; pausar/reativar; edição volta à moderação; isolamento entre donos (404) e bloqueio de não-admin (403); rejeição exige motivo; contato: demo / autorizado (wa.me) / não autorizado; denúncia e resolução; upload: PNG válido recodificado em WebP, arquivo falso rejeitado, EXIF removido, limite de 8; contador de interesse em planos; métricas; exclusão de conta; limite de 3 anúncios; escape de HTML nas metatags sociais; limite de tentativas.

## O que os testes E2E cobrem
- Home → busca do hero → resultados filtrados.
- Filtros combinados, ordenação por preço, estado vazio, limpar filtros.
- Detalhe demonstrativo: sem telefone no HTML, contato simulado, envio de denúncia.
- Fluxo completo: rota protegida → cadastro (com erro de validação) → anúncio com foto → "Em moderação" → invisível na busca → admin aprova → visível → contato retorna link do WhatsApp sem expor o número na página → dono pausa → sai da busca.
- Admin protegido (401 sem sessão); planos não cobram.
- SEO/PWA: manifest instalável com ícone maskable, service worker registrado, sitemap, Open Graph por anúncio.
- Acessibilidade (axe, WCAG 2 A/AA, violações sérias/críticas = 0) e ausência de rolagem horizontal em 10 páginas, em desktop 1440 e mobile 360 px.
- Mobile 360: menu, filtros em folha inferior, alvos de toque ≥ 44 px.

## Revisão visual
Capturas reais em `docs/capturas/` (360, 390, 768 e 1440 px; primeira dobra e página inteira). Defeitos encontrados e corrigidos durante a revisão: título cobrindo a porta iluminada no desktop; aviso de cookies cobrindo a busca no hero; assinatura "MORAA GO" ilegível em tamanho pequeno; botão cortado na barra fixa do detalhe a 360 px; contraste insuficiente no contador de fotos; coluna vazia no formulário em telas largas.

## Não testado / limites conhecidos
- Não houve teste em aparelho físico (Samsung S20 FE / iPhone) — só emulação a 360 px. Ver `docs/ACESSO-MOVEL.md`.
- Sem medição Lighthouse neste ambiente; a imagem do hero em desktop tem ~350 kB.
- A abertura real do WhatsApp não é verificável sem internet no ambiente de teste (o link gerado é verificado).
- Limitadores de requisição são em memória (válidos para um único processo).
