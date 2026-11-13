# PROGRESSO — MORAA GO

## Fases
- [x] **0 Diagnóstico** — Repositório `Luisfof/Luisfof` (branch `claude/moraa-go-real-estate-3j7uut`), contêiner de nuvem com Node 22 e Chromium. Remote Desktop Commander disponível: computador **MARTINS** online (Node 24, Git). Projeto anterior localizado em `C:\Users\LUIS\Desktop\MORAA_GO_CODEx` — lido apenas `MODELO_NEGOCIO.md` como referência de regras; nada foi alterado nele.
- [x] **1 Direção de arte** — "Entardecer no Cerrado" (ver `docs/MARCA.md`).
- [x] **2 Marca e assets** — símbolo "Duplo Vão", assinatura, favicon, ícones PWA, fotografias tratadas, folhagem recortada para primeiro plano.
- [x] **3 Frontend** — 10 rotas responsivas.
- [x] **4 Backend** — API Express + SQLite, autenticação, moderação, upload seguro (subagente dedicado).
- [x] **5 Admin e complementos** — moderação, denúncias, métricas, planos demonstrativos, páginas legais.
- [x] **6 PWA** — manifest, service worker, offline, ícones.
- [x] **7 Testes** — ver `TESTES.md`.
- [x] **8 Capturas e crítica visual** — `docs/capturas/`.
- [x] **9 Entrega** — README, docs, checkpoints, cópia no MARTINS.

## Decisões
- **Imagem de referência (Casa das Ferragens):** não chegou anexada à conversa. A direção foi construída a partir da descrição textual do prompt (cenografia, camadas com desfoque, luz cinematográfica, grotesca de impacto, marca integrada).
- **Geração de imagens por IA (ElevenLabs):** tentada; a conta não tinha créditos suficientes. Nada foi cobrado. Optou-se por fotografia do Unsplash, após o usuário aprovar o acesso de rede a `images.unsplash.com` (ambiente `luisfof-moraa-go`).
- **Mapa:** esquemático, desenhado em SVG, sem tiles de terceiros (privacidade e CSP restrita); link externo para o OpenStreetMap.
- **Banco:** SQLite nativo do Node (sem compilação nativa — roda igual em Windows e Linux).
- **Destaques na busca:** sobem apenas na ordenação padrão; ordenar por preço é estrito.
- **Aviso de cookies:** informativo (só cookie essencial); na home aparece após a primeira dobra.
- **Processo único** serve API + site, para simplificar túnel/hospedagem.

## Bloqueios / pendências que dependem do usuário
- Publicação com HTTPS (necessária para instalar a PWA no S20 FE) — não executada sem autorização.
- Fotografia própria da região para substituir as ilustrativas.
- Revisão jurídica dos termos e definição do encarregado (DPO).
- Recuperação de senha por e-mail (exige serviço de e-mail).

## Não foi feito (e não foi declarado como feito)
Nenhuma automação externa, notificação a terceiros, publicação em produção, cobrança ou exclusão de dados.
