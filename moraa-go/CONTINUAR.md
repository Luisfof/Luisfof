# CONTINUAR MORAA GO

Ao receber **"CONTINUAR MORAA GO"**: leia este arquivo, `PROGRESSO.md` e `TESTES.md`; não reconstrua etapas concluídas.

## Estado
Todas as fases (0–9) concluídas e enviadas ao GitHub: repositório `Luisfof/Luisfof`, branch `claude/moraa-go-real-estate-3j7uut`, pasta `moraa-go/`.
Cópia no computador MARTINS: `C:\Users\LUIS\Desktop\MORAA_GO_SIGNATURE\moraa-go` (a versão antiga em `MORAA_GO_CODEx` está intacta).

## Retomar o ambiente
```bash
cd moraa-go && npm install && npm run build && npm test && npm run test:e2e
npm start    # http://localhost:8787 — admin demo: admin@moraago.local / moraa-admin-demo
```
Para regenerar imagens (`npm run imagens`) é preciso acesso a `images.unsplash.com`; no contêiner de nuvem use
`NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/preparar-imagens.mjs`.

## Próximos passos sugeridos (em ordem)
1. Com autorização: publicar em host HTTPS (README → Implantar) e testar a instalação da PWA no S20 FE e no iPhone.
2. Trocar as fotografias ilustrativas por fotos próprias de Senador Canedo/Goiânia (hero e seções).
3. Recuperação de senha e verificação de e-mail.
4. Favoritos e alerta de novos imóveis por filtro.
5. Medir Lighthouse em produção e gerar variante AVIF do hero.
6. Revisão jurídica dos textos legais; definir DPO.

## Onde mexer
- Visual: `src/styles/tokens.css` (tokens), `layout.css` (hero, cards, seções), `pages.css` (páginas internas).
- Hero: `src/pages/Home.tsx` + bloco "Hero cinematográfico" em `layout.css`.
- Regras de negócio/API: `server/routes/*`, `server/validation.ts`; contrato em `shared/types.ts`.
- Dados demonstrativos: `server/seed.ts`.
