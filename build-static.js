const fs = require('fs');
const path = require('path');

const root = __dirname;
const output = path.join(root, 'dist');

const publicFiles = [
  'index.html',
  'form-athlete.html',
  'form-club.html',
  'style.css',
  'forms.css',
  'forms.js',
  'forms-i18n.js',
  'i18n.js',
  'main.js',
  'ball-video.js',
  'gallery-carousel.js',
  'hero-field.js',
  'sections-fx.js',
  'threejs-balls.js',
  'threejs-hero.js',
  'threejs-process.js',
  '0608.mp4',
  'Design_sans_titre__57_-removebg-preview.png',
  'VFF noir (1).png'
];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const file of publicFiles) {
  fs.copyFileSync(path.join(root, file), path.join(output, file));
}

fs.cpSync(path.join(root, 'assets'), path.join(output, 'assets'), {
  recursive: true
});

console.log(`Static site prepared in ${output}`);
