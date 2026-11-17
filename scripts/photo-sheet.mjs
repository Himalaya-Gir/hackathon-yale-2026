// Package A1: contact sheets of photo candidates, to LOOK at them before assigning (PLAN.md §3).
// Usage: node scripts/photo-sheet.mjs <dir> <outPrefix> [regex]
import sharp from 'sharp'; import fs from 'fs';
const [dir, out, re] = process.argv.slice(2);
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg') && (!re || new RegExp(re).test(f))).sort();
const W = 300, H = 169, L = 20, cols = 7, per = 42;
for (let s = 0; s * per < files.length; s++) {
  const part = files.slice(s * per, (s + 1) * per); const comps = [];
  for (let i = 0; i < part.length; i++) {
    try {
      const m = await sharp(`${dir}/${part[i]}`).metadata();
      const buf = await sharp(`${dir}/${part[i]}`).resize(W, H, { fit: 'cover', position: 'attention' }).jpeg().toBuffer();
      const label = Buffer.from(`<svg width="${W}" height="${L}"><rect width="100%" height="100%" fill="black"/><text x="3" y="15" fill="white" font-size="14" font-family="Arial">${part[i].replace('.jpg', '').replace(/&/g, '+').slice(0, 30)} ${m.width}</text></svg>`);
      comps.push({ input: buf, left: (i % cols) * W, top: Math.floor(i / cols) * (H + L) + L }, { input: label, left: (i % cols) * W, top: Math.floor(i / cols) * (H + L) });
    } catch (e) { console.log('bad', part[i], e.message); }
  }
  await sharp({ create: { width: W * cols, height: Math.ceil(part.length / cols) * (H + L), channels: 3, background: '#111' } }).composite(comps).jpeg({ quality: 72 }).toFile(`${out}-${s}.jpg`);
  console.log(`${out}-${s}.jpg`, part.length);
}
