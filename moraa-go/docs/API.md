# MORAA GO — API

API JSON em Express (TypeScript, ESM), executada com `tsx server/index.ts`. Banco SQLite embutido (`node:sqlite`) em `DATA_DIR/moraa.sqlite`; imagens em `DATA_DIR/uploads`. Os tipos de todas as respostas estão em `shared/types.ts`.

## Convenções

- Base: `/api`. Corpo e resposta em JSON (exceto upload, `multipart/form-data`).
- Erros: `{ "error": "mensagem em pt-BR", "fields"?: { campo: "mensagem" } }`.
- **Toda requisição que não seja GET precisa do cabeçalho `X-Requested-With: moraa`** (senão `403`).
- Sessão por cookie `moraa_sid` (envie `credentials: 'same-origin'`).
- Códigos: `400` validação · `401` sem login · `403` sem permissão/CSRF · `404` não encontrado (ou não é seu) · `409` conflito de estado/limite · `413` corpo > 100 kB · `429` limite de requisições.

## Endpoints

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/health` | público | `{ok:true}` |
| GET | `/api/meta` | público | `Meta`: bairros e contagens de anúncios ativos por cidade, `demoMode` |
| POST | `/api/auth/register` | público | `{name, email, password (≥10), acceptTerms:true}` → `201 {user}`; inicia sessão; grava data do consentimento e versão dos termos |
| POST | `/api/auth/login` | público | `{email, password}` → `{user}`; falha sempre `401` com mensagem genérica |
| POST | `/api/auth/logout` | público | encerra a sessão |
| GET | `/api/auth/me` | público | `{user: User \| null}` |
| DELETE | `/api/auth/account` | logado | apaga conta, sessões, anúncios, imagens e denúncias associadas (LGPD). Admin: `403` |
| GET | `/api/listings` | público | `SearchResult`. Query: `q, city, neighborhood, type, minPrice, maxPrice, bedrooms, features=a,b, sort, page`. Só `ativo`; destaques primeiro; 12 por página. Valores desconhecidos são ignorados; número malformado → `400` |
| GET | `/api/listings/featured` | público | até 6 destaques ativos (ou os mais recentes) |
| GET | `/api/listings/:slug` | público | `Listing` ativo (dono/admin veem também o não ativo). Conta visualização de visitantes |
| POST | `/api/listings/:id/contact` | público | `ContactResponse`: `demo` (nunca telefone), `whatsapp` (`https://wa.me/55<n>?text=…`) ou `indisponivel` |
| POST | `/api/listings/:id/report` | público | `{reason, details (0–1000)}` → `201` |
| POST | `/api/plans/interest` | público | `{plan}` → `201` (apenas contador agregado; não há pagamento) |
| GET | `/api/my/listings` | logado | `OwnedListing[]` do usuário |
| POST | `/api/my/listings` | logado | `ListingInput` → `201 OwnedListing` em `pendente`. Mais de 3 anúncios não rejeitados → `409` |
| GET | `/api/my/listings/:id` | dono | `OwnedListing` + campo extra `whatsapp` (para edição) |
| PUT | `/api/my/listings/:id` | dono | `ListingInput`; `ativo`/`rejeitado` voltam a `pendente` |
| POST | `/api/my/listings/:id/status` | dono | `{status:'pausado'\|'ativo'}`. Pausa só anúncio ativo; reativa só o que o próprio dono pausou (`ativo` se o conteúdo já estava aprovado, senão `pendente`) |
| DELETE | `/api/my/listings/:id` | dono | exclui anúncio e imagens |
| POST | `/api/my/listings/:id/images` | dono | multipart, campo `images` (até 8 por anúncio, 6 MB cada) → `201 OwnedListing`. Em anúncio `ativo`, volta a `pendente` |
| DELETE | `/api/my/listings/:id/images/:imageId` | dono | → `OwnedListing` |
| GET | `/api/admin/metrics` | admin | `AdminMetrics` |
| GET | `/api/admin/listings?status=` | admin | `OwnedListing[]` com `ownerEmail` |
| POST | `/api/admin/listings/:id/moderate` | admin | `{action:'aprovar'\|'rejeitar'\|'pausar'\|'destacar'\|'remover-destaque', note?}`; `rejeitar` exige `note` |
| DELETE | `/api/admin/listings/:id` | admin | exclui anúncio |
| GET | `/api/admin/reports?status=` | admin | `Report[]` (`aberta`/`resolvida`) |
| POST | `/api/admin/reports/:id/resolve` | admin | `{resolution}` → `Report` |

Fora de `/api`: `/uploads/*` (imagens enviadas), `/sitemap.xml`, `/robots.txt` e, se `dist/` existir, o SPA com fallback. Em `/imovel/:slug` o `index.html` recebe `<title>` e metatags `og:*` do anúncio ativo, com escape de HTML.

## Segurança

- **Senhas**: scrypt com salt aleatório por usuário e comparação em tempo constante; login calcula um hash mesmo quando o e-mail não existe.
- **Sessões**: token aleatório de 32 bytes; o banco guarda apenas o SHA-256. Cookie `HttpOnly`, `SameSite=Lax`, `Path=/`, 14 dias, `Secure` em produção ou sob HTTPS. Token trocado a cada login e apagado no logout.
- **CSRF**: cabeçalho `X-Requested-With: moraa` obrigatório em escritas, somado ao `SameSite=Lax`.
- **Cabeçalhos** (helmet): CSP `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`, `nosniff`, `X-Frame-Options: DENY`, `Permissions-Policy`; HSTS e `upgrade-insecure-requests` em produção.
- **Limites** (por IP): global 300/min; login 10 falhas/15 min por IP+e-mail; cadastro 10/h; contato 20/h; denúncia 8/h; upload 60/h; interesse em plano 20/h; escritas do anunciante 120/h. `createApp({ rateLimits: false })` desliga (testes).
- **Validação**: zod em todos os corpos e na busca; texto normalizado, sem caracteres de controle; `<`/`>` recusados em título, bairro e nome; HTML recusado na descrição. SQL sempre parametrizado.
- **Autorização**: `/my/*` devolve `404` para anúncio de outra pessoa; `/admin/*` devolve `403` a quem não é admin. Toda ação administrativa gera linha em `audit_log`.
- **Privacidade**: telefone só sai em `POST /listings/:id/contact`, com consentimento do anunciante, e nunca em anúncio demonstrativo. Respostas públicas trazem só o primeiro nome do anunciante. Não coletamos endereço: `approxLat/approxLng` = centro da cidade + deslocamento determinístico pelo nome do bairro, com 2 casas decimais.
- **Uploads**: formato conferido pelos bytes iniciais e pela decodificação do sharp (JPEG/PNG/WebP); a imagem é regravada em WebP (1280 px e 640 px), com orientação aplicada e sem metadados (EXIF/GPS); nomes aleatórios; `/uploads` servido com `nosniff`, CSP `sandbox`, cache longo e sem listagem.
- **Moderação**: anúncio novo, editado ou com fotos novas só fica público depois de aprovado.
- **Produção**: o servidor não inicia sem `ADMIN_PASSWORD` de 12+ caracteres. Em desenvolvimento, sem senha definida, usa `admin@moraago.local` / `moraa-admin-demo` e avisa no log. Senhas, tokens e telefones nunca são logados. `TRUST_PROXY=true` ativa `trust proxy` (necessário atrás de proxy HTTPS para IP e cookie `Secure` corretos).

## Dados demonstrativos

Com `SEED_DEMO` diferente de `false` e a tabela de anúncios vazia, o servidor cria a conta "Demonstração MORAA GO" (sem senha utilizável) e 10 anúncios `isDemo: true`, sem telefone, com imagens em `/img/demo/<chave>-1280.webp` e `-640.webp`. Os slugs são fixos (`<título>-demo01` … `-demo10`).

## Testes

`npx vitest run` — cada app de teste usa um `DATA_DIR` temporário próprio.
