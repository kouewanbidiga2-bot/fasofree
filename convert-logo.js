const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, 'fasofree-frontend-client', 'src', 'assets', 'logo.svg');
const pngPath = path.join(__dirname, 'fasofree-logo.png');

const svgContent = fs.readFileSync(svgPath, 'utf8');

sharp(Buffer.from(svgContent))
  .resize(800, 240)
  .png()
  .toFile(pngPath)
  .then(() => {
    console.log('Logo converted to PNG:', pngPath);
  })
  .catch(err => {
    console.error('Error:', err);
  });
