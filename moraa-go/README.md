# MORAA GO

Plataforma de classificados de **aluguel de imóveis** para Senador Canedo, Goiânia e região metropolitana (GO).
Projeto novo, independente da versão anterior (`MORAA_GO_CODEx`), que não foi alterada.

> **Ambiente de demonstração.** Os 10 anúncios iniciais são demonstrativos e identificados como tal.
> Não há cobrança, checkout ou imóveis reais. Nada foi publicado em produção.

## O que tem

| Área | Situação |
|---|---|
| Home cinematográfica com busca | Pronto |
| Busca com filtros (cidade, bairro, tipo, preço, quartos, características, palavra-chave, ordenação, paginação) | Pronto |
| Detalhe com galeria, valores, mapa esquemático aproximado, contato autorizado, denúncia, compartilhar | Pronto |
| Cadastro/login, publicação com validação e upload de até 8 fotos | Pronto |
| Área do anunciante (editar, pausar, reativar, excluir, métricas, excluir conta — LGPD) | Pronto |
| Painel administrativo (fila de moderação, destaque, denúncias, métricas, log de auditoria) | Pronto |
| Planos e destaques | **Demonstrativo** — só registra interesse |
| Termos, privacidade, como funciona, aviso de cookies | Pronto (textos-modelo; exigem revisão jurídica) |
| PWA (manifest, service worker, offline, ícones, instalável) | Pronto — exige HTTPS para instalar |
| SEO (metadados, Open Graph por anúncio, sitemap.xml, robots.txt) | Pronto |

## Stack

- **Frontend:** React 19 + TypeScript + Vite, React Router, CSS próprio com design tokens (`src/styles/tokens.css`), fonte Archivo variável auto-hospedada.
- **Backend:** Node.js ≥ 22.13 + Express + SQLite nativo (`node:sqlite`, sem dependência nativa de banco), Zod, Helmet, Sharp.
- **Testes:** Vitest + Supertest (API), Playwright + axe-core (E2E e acessibilidade).
- Um único processo serve API e frontend compilado — simples de hospedar.

```
moraa-go/
  src/        frontend (pages, components, styles)
  server/     API (routes, db, security, validation, seed, static/SEO)
  shared/     contrato de tipos usado pelos dois lados
  public/     imagens, ícones, manifest, service worker
  tests/      testes de API        e2e/  testes de ponta a ponta
  scripts/    capturas, imagens, ícones
  docs/       API.md, MARCA.md, ACESSO-MOVEL.md, capturas/
```

## Rodar

```bash
npm install
cp .env.example .env        # opcional em desenvolvimento
npm run build               # compila o frontend para dist/
npm start                   # http://localhost:8787  (API + site)
```

No Windows, basta dar dois cliques em `INICIAR.cmd`.

Desenvolvimento com recarga automática: `npm run dev` (site em http://localhost:5173, API em :8787).

**Conta administrativa de demonstração** (apenas quando `NODE_ENV` não é `production` e `ADMIN_PASSWORD` está vazio):
`admin@moraago.local` / `moraa-admin-demo`. Em produção o servidor **se recusa a iniciar** sem `ADMIN_PASSWORD` forte.

## Testes e capturas

```bash
npm test            # 57 testes de API
npm run build && npm run test:e2e   # 25 testes E2E + acessibilidade (desktop e perfil Galaxy 360px)
npm run capturas    # regenera docs/capturas/ com a aplicação real
```

Resultados em [TESTES.md](TESTES.md).

## Implantar (quando autorizado)

Qualquer host Node com disco persistente e HTTPS (Render, Railway, Fly.io, VPS):

1. Variáveis: `NODE_ENV=production`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (≥ 12 caracteres), `PUBLIC_URL=https://seu-dominio`, `TRUST_PROXY=true`, `DATA_DIR=/caminho/persistente`, `SEED_DEMO=false` para começar sem anúncios demonstrativos.
2. Build: `npm ci && npm run build` · Start: `npm start`.
3. Faça backup periódico de `DATA_DIR` (banco `moraa.sqlite` + `uploads/`).

Antes de abrir ao público: revisão jurídica dos termos/privacidade, canal do encarregado (DPO), recuperação de senha por e-mail e armazenamento de imagens/limitador de requisições externos se houver mais de uma instância.

## Segurança e privacidade (resumo)

Senhas com scrypt; sessão em cookie HttpOnly/SameSite com token armazenado só como hash; proteção CSRF por cabeçalho; CSP restrita; limites de requisição; validação Zod em todas as entradas; uploads verificados por assinatura, recodificados e sem EXIF/GPS; telefone nunca aparece em respostas públicas — só via clique, com autorização do anunciante; sem endereço completo; sem rastreadores. Detalhes em [docs/API.md](docs/API.md).

## Créditos de imagem

Fotografias de arquitetura obtidas do Unsplash (licença Unsplash: uso gratuito, inclusive comercial, sem exigência de atribuição). Os identificadores de cada foto estão em `scripts/preparar-imagens.mjs`. São **ilustrativas** e sinalizadas na interface; não retratam imóveis anunciados. Substitua por fotografia própria da região antes do lançamento.
