// Gera os ícones PNG da PWA a partir do símbolo "Duplo Vão". Uso: node scripts/gerar-icones.mjs
import sharp from 'sharp';
const mark = (pad, rx) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="${rx}" fill="#0b1220"/><g transform="translate(32 32) scale(${pad}) translate(-32 -32)"><path d="M9 50 21.5 21 34 50" fill="none" stroke="#ffc21a" stroke-width="8.5" stroke-miterlimit="6"/><path d="M30 43 42.5 14 55 43" fill="none" stroke="#f2542d" stroke-width="8.5" stroke-miterlimit="6"/></g></svg>`;
const out = async (svg, size, file) => sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toFile(`public/icons/${file}`);
await out(mark(1, 10), 48, 'icon-48.png');
await out(mark(1, 10), 192, 'icon-192.png');
await out(mark(1, 10), 512, 'icon-512.png');
await out(mark(0.68, 0), 192, 'maskable-192.png'); // área segura p/ máscara adaptativa do Android
await out(mark(0.68, 0), 512, 'maskable-512.png');
await out(mark(0.8, 0), 180, 'apple-touch-icon.png');
console.log('ícones ok');
