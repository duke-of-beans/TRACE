const sharp = require('sharp');
const path = require('path');

// Create icon from raw SVG buffer with explicit density
async function generate() {
  const sizes = [192, 512];
  
  for (const size of sizes) {
    // Create the icon programmatically with sharp
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#111827"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#bg)"/>
      <rect x="${size * 0.22}" y="${size * 0.25}" width="${size * 0.56}" height="${size * 0.055}" rx="${size * 0.028}" fill="#4fc3f7"/>
      <rect x="${size * 0.45}" y="${size * 0.25}" width="${size * 0.09}" height="${size * 0.5}" rx="${size * 0.045}" fill="#4fc3f7"/>
      <rect x="${size * 0.31}" y="${size * 0.82}" width="${size * 0.375}" height="${size * 0.03}" rx="${size * 0.015}" fill="#4fc3f7" opacity="0.35"/>
    </svg>`;

    await sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(__dirname, '..', 'pwa', 'public', `icon-${size}.png`));
    console.log(`+ pwa icon-${size}.png`);
  }

  // Operator 192
  const opSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f1729"/><stop offset="100%" stop-color="#1a1a2e"/></linearGradient></defs>
    <rect width="192" height="192" rx="36" fill="url(#bg)"/>
    <rect x="42" y="48" width="108" height="9" rx="4.5" fill="#4fc3f7"/>
    <rect x="90" y="48" width="12" height="96" rx="6" fill="#4fc3f7"/>
    <rect x="66" y="156" width="60" height="5" rx="2.5" fill="#4fc3f7" opacity="0.4"/>
  </svg>`;
  await sharp(Buffer.from(opSvg)).png()
    .toFile(path.join(__dirname, '..', 'operator', 'public', 'icon-192.png'));
  console.log('+ operator icon-192.png');
  console.log('Done.');
}
generate();
