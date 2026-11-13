// Baixa as fotografias (licença Unsplash — uso livre, inclusive comercial) e gera
// as versões otimizadas em public/img. Os arquivos gerados já estão versionados;
// rode este script apenas para regenerar.  Uso: npm run imagens
import sharp from 'sharp';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';

const U = (id, w = 1600) => `https://images.unsplash.com/photo-${id}?w=${w}&q=82&fm=jpg`;
const demo = {
  'casa-oliveiras-a': '1600047509807-ba8f99d2cdde', 'casa-oliveiras-b': '1554995207-c18c203602cb', 'casa-oliveiras-c': '1600585152220-90363fe7e115',
  'apto-bueno-a': '1545324418-cc1a3fa10c00', 'apto-bueno-b': '1600607687939-ce8a6c25118c', 'apto-bueno-c': '1484154218962-a197022b5858',
  'studio-univ-a': '1586023492125-27b2c045efd7', 'studio-univ-b': '1493809842364-78817add7ffb',
  'sobrado-paraiso-a': '1600566753190-17f0baa2a6c3', 'sobrado-paraiso-b': '1600566753086-00f18fb6b3ea', 'sobrado-paraiso-c': '1600607687644-c7171b42498f',
  'apto-jdgoias-a': '1512915922686-57c11dde9b6b', 'apto-jdgoias-b': '1600210492486-724fe5c67fb0', 'apto-jdgoias-c': '1512918728675-ed5a9ecdebfd',
  'casa-galvao-a': '1523217582562-09d0def993a6', 'casa-galvao-b': '1502672260266-1c1ef2d93688', 'casa-galvao-c': '1522708323590-d24dbb6b0267',
  'apto-oeste-a': '1574362848149-11496d93a7c7', 'apto-oeste-b': '1505691938895-1758d7feb511', 'apto-oeste-c': '1560448204-e02f11c3d0e2',
  'sobrado-luz-a': '1613490493576-7fde63acd811', 'sobrado-luz-b': '1613977257363-707ba9348227', 'sobrado-luz-c': '1580587771525-78b9dba3b914',
  'casa-santos-a': '1600607688969-a5bfcd646154', 'casa-santos-b': '1600585154340-be6161a56a0c',
  'sala-centro-a': '1600573472592-401b489a3cdc', 'sala-centro-b': '1487958449943-2429e8be8625',
};
const editorial = { hero: '1600585154526-990dced4db0d', 'vidro-ambar': '1431576901776-e539bd916ba2', torres: '1486406146926-c627a92ad1ab' };
const folhas = { 'folha-a': '1501004318641-b39e6451bec6', 'folha-c': '1453904300235-0f2f60b15b5d' };

const exists = (p) => access(p).then(() => true, () => false);
async function get(id, w) {
  const f = `.cache-img/${id}-${w}.jpg`;
  if (await exists(f)) return readFile(f);
  const r = await fetch(U(id, w));
  if (!r.ok) throw new Error(`${id}: HTTP ${r.status}`);
  const b = Buffer.from(await r.arrayBuffer());
  await writeFile(f, b);
  return b;
}
await mkdir('.cache-img', { recursive: true });
await mkdir('public/img/demo', { recursive: true });

for (const [key, id] of Object.entries(demo)) {
  const src = await get(id, 1600);
  await sharp(src).resize(1280, 960, { fit: 'cover', position: 'attention' }).webp({ quality: 74 }).toFile(`public/img/demo/${key}-1280.webp`);
  await sharp(src).resize(640, 480, { fit: 'cover', position: 'attention' }).webp({ quality: 70 }).toFile(`public/img/demo/${key}-640.webp`);
  console.log('demo', key);
}
{
  const src = await get(editorial.hero, 3200);
  // leve gradação: mais contraste e azul nas sombras para casar com a paleta "noite de cerrado"
  const graded = sharp(src).modulate({ saturation: 1.12, brightness: 0.96 }).linear(1.08, -8);
  await graded.clone().resize(1600).webp({ quality: 66 }).toFile('public/img/hero-1600.webp');
  await graded.clone().resize(900).webp({ quality: 74 }).toFile('public/img/hero-900.webp');
  await graded.clone().resize(1200, 630, { fit: 'cover', position: 'bottom' }).jpeg({ quality: 82 }).toFile('public/img/og.jpg');
  for (const k of ['vidro-ambar', 'torres']) {
    const s = await get(editorial[k], 1600);
    await sharp(s).resize(1200).webp({ quality: 72 }).toFile(`public/img/${k}.webp`);
  }
  console.log('editorial ok');
}
// Folhagem de primeiro plano: recorta o fundo branco (alfa por luminância/saturação),
// escurece e desfoca — simula objeto próximo à lente, fora de foco.
for (const [key, id] of Object.entries(folhas)) {
  const src = await get(id, 1100);
  const { data, info } = await sharp(src).resize(900).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, o = 0; i < data.length; i += 3, o += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max ? (max - min) / max : 0;
    const lum = (r + g + b) / 765;
    let a = Math.min(1, Math.max(0, (1 - lum) * 1.6 + sat * 2.2 - 0.35));
    if (g < r * 0.92 && lum > 0.35) a *= 0.15; // pele / vasos / madeira saem
    out[o] = Math.round(r * 0.32); out[o + 1] = Math.round(g * 0.42); out[o + 2] = Math.round(b * 0.45); out[o + 3] = Math.round(a * 255);
  }
  const cut = key === 'folha-c' ? Math.round(info.height * 0.66) : info.height; // remove o vaso
  const base = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left: 0, top: 0, width: info.width, height: cut }).png().toBuffer();
  await sharp(base).trim({ threshold: 12 }).extend({ top: 30, bottom: 30, left: 30, right: 30, background: { r: 0, g: 0, b: 0, alpha: 0 } }).blur(7).webp({ quality: 60, alphaQuality: 60 }).toFile(`public/img/${key}.webp`);
  console.log('folha', key);
}
