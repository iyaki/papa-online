// Regenerates the PWA icons from client/favicon.png (the 1024px source art).
// One-off usage: npm i --no-save sharp && node scripts/generate-icons.mjs
// Commit the generated PNGs. sharp decodes by content, so the JPEG-with-.png-
// extension source is handled correctly.
import sharp from 'sharp';

const buf = await sharp('client/favicon.png').png().toBuffer();
for (const [size, name] of [
    [192, 'icon-192.png'],
    [512, 'icon-512.png'],
    [180, 'apple-touch-icon.png'],
]) {
    await sharp(buf).resize(size, size).png().toFile(`client/${name}`);
    console.log(`client/${name}: ${size}x${size}`);
}
