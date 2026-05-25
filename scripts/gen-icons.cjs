const sharp = require("sharp");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#1a1a2e"/>
  <text x="256" y="310" font-family="monospace" font-size="240" font-weight="bold" fill="#4fc3f7" text-anchor="middle">T</text>
</svg>`;

async function main() {
  const buf = Buffer.from(svg);
  await sharp(buf).resize(192).png().toFile("pwa/public/icon-192.png");
  await sharp(buf).resize(512).png().toFile("pwa/public/icon-512.png");
  console.log("Icons generated: icon-192.png, icon-512.png");
}

main().catch(console.error);
