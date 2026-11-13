# MORAA GO — identidade visual

## Conceito: "Entardecer no Cerrado"
A hora em que as casas acendem. Noite azul-profunda, a luz quente que sai de uma porta aberta, o amarelo do ipê e o vermelho da terra de Goiás. O produto fala de **chegar** — por isso a cena principal é uma porta iluminada, e a assinatura é *"Abra a porta certa."*

## Símbolo — "Duplo Vão"
Os dois **A** de MOR**AA**, sem travessa, viram dois vãos (soleiras). Lado a lado desenham um **M**. O segundo vão sobe um degrau: é o **GO** — movimento, e a sigla do estado.
Não usa casinha, telhado com chaminé, chave ou pin de mapa.

- Arquivos: `public/favicon.svg`, `public/icons/*` (48, 192, 512, maskable, apple-touch). Componente: `Symbol` e `Logo` em `src/components/ui.tsx`.
- Área de respiro: metade da altura do símbolo. Tamanho mínimo: 20 px (símbolo), 90 px de largura (assinatura completa).
- Versões: sobre noite (principal), sobre cal, monocromática sobre ipê.
- Não distorcer, não aplicar sombra/gradiente, não trocar as cores dos vãos entre si.

## Cores
| Token | Hex | Uso |
|---|---|---|
| `--noite-800` | `#0B1220` | Fundo escuro, texto principal |
| `--noite-900` | `#070C17` | Hero, rodapé |
| `--ipe-500` | `#FFC21A` | Ação principal, preço, destaque |
| `--brasa-500` | `#F2542D` | Acento quente, numerais, bloco GO |
| `--brasa-700` | `#B23312` | Texto de acento sobre claro (contraste AA) |
| `--cal-100` | `#F6F1E7` | Fundo claro |
| `--buriti-500` | `#1F7A5A` | Sucesso / "no ar" |

Regra de contraste: texto sobre ipê e sobre brasa é sempre noite; texto de acento sobre cal usa brasa-700.

## Tipografia
**Archivo** (variável, eixos peso e largura), auto-hospedada.
- Títulos: peso 800, largura 68–74 (condensada), caixa alta, entrelinha 0,82–0,98.
- Rótulos: peso 700, largura 118 (expandida), caixa alta, espaçamento 0,14em.
- Texto: peso 400–600, largura normal, 16 px mínimo, entrelinha 1,55.

## Forma e acabamento
Cantos de 3–6 px (arquitetônico, não "bolha"). Botões são blocos sólidos com uma "soleira" inferior de 3 px. Linhas finas e réguas de 2 px estruturam as páginas. Sem glassmorphism, sem gradientes decorativos, sem 3D.

## Fotografia e cena
Arquitetura real ao entardecer, luz quente vinda de dentro, materiais visíveis (painel escuro, ripado de madeira, concreto). No hero, cinco camadas: fotografia → gradação de cor → brilho quente na porta → folhagem desfocada próxima à lente (com paralaxe) → grão de filme. Toda imagem ilustrativa é identificada.

## Voz
Direta, próxima, sem jargão imobiliário. "Abra a porta certa." · "Escolha seu chão." · "Do anúncio à chave, sem atravessador." · "Porta errada." (404)
