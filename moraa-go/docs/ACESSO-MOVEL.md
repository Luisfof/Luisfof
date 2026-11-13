# Acesso pelo Samsung Galaxy S20 FE e pelo iPhone

O que é entregue é uma **PWA** (site instalável), não um APK nativo.

## 1. Ver as capturas (qualquer aparelho)
As capturas reais estão em `docs/capturas/` no repositório (branch `claude/moraa-go-real-estate-3j7uut`) e na galeria publicada informada na entrega.

## 2. Abrir a plataforma no celular, na mesma rede Wi-Fi do computador MARTINS
1. No MARTINS, abra a pasta `Desktop\MORAA_GO_SIGNATURE\moraa-go` e execute `INICIAR.cmd`.
2. Descubra o IP do computador: `ipconfig` → "Endereço IPv4" (ex.: `192.168.0.15`).
3. No celular, conectado ao mesmo Wi-Fi, abra `http://192.168.0.15:8787`.
4. Se não abrir, o Firewall do Windows está bloqueando: permita "Node.js" em redes privadas quando o Windows perguntar.

Assim o site funciona por completo, mas **não pode ser instalado como app**: instalação de PWA exige HTTPS.

## 3. HTTPS para instalar a PWA (precisa da sua autorização)
Duas opções — nenhuma foi executada, pois expõem o servidor fora do computador:

- **Túnel temporário (teste):** com o servidor rodando, `npx cloudflared tunnel --url http://localhost:8787` gera uma URL `https://….trycloudflare.com` válida enquanto o comando estiver aberto. Qualquer pessoa com o link acessa; use só para teste e encerre depois.
- **Hospedagem (definitivo):** seguir "Implantar" no README em um serviço com HTTPS.

Com a URL HTTPS:
- **Samsung S20 FE (Chrome ou Samsung Internet):** abra a URL → menu ⋮ → "Instalar app" / "Adicionar à tela inicial". O rodapé do site também mostra o botão "Instalar o app" quando o navegador permite.
- **iPhone (Safari):** Compartilhar → "Adicionar à Tela de Início".

## O que foi preparado para o S20 FE (360 px de largura)
Layout mobile-first testado a 360 px; alvos de toque ≥ 44 px; campos com 16 px (sem zoom ao focar); teclados corretos (numérico, e-mail, telefone); `viewport-fit=cover` e áreas seguras; barra de contato fixa no detalhe; filtros em folha inferior; menu em tela cheia; imagens responsivas (`srcset`) e carregamento tardio; sem rolagem horizontal (verificado por teste automatizado).
