const fs = require('fs');
const path = require('path');

// Simple secrets checker — looks for committed .env and obvious secret patterns.
// This is intentionally conservative and fails if potentially sensitive data is present.

const repoRoot = path.resolve(__dirname, '..');
const patterns = [
  /(^|\s)AWS_ACCESS_KEY_ID=\w+/i,
  /(^|\s)AWS_SECRET_ACCESS_KEY=\w+/i,
  /(^|\s)PRIVATE_KEY\s*=|-----BEGIN RSA PRIVATE KEY-----/i,
  /(^|\s)DB_PASSWORD=.+/i,
  /(^|\s)DATABASE_URL=.*(password=|:).+/i,
  /(^|\s)REDIS_PASSWORD=.+/i,
  /(^|\s)JWT_SECRET=.{8,}/i,
  /(^|\s)PAYMENT_WEBHOOK_SECRET=.+/i,
  /-----BEGIN .*PRIVATE KEY-----/i,
];

const exclude = ['.env.example', '.gitignore', 'README.md'];

function isExcludedByName(file) {
  const base = path.basename(file).toLowerCase();
  if (exclude.includes(base)) return true;
  if (base.startsWith('.env') && base !== '.env.example') return true; // ignore local env files like .env.local
  return false;
}

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function (file) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      if (file === 'node_modules' || file === 'dist' || file === '.git' || file === 'tools') return;
      results = results.concat(walk(full));
    } else {
      results.push(full);
    }
  });
  return results;
}

function checkFile(file) {
  const base = path.basename(file);
  if (isExcludedByName(file)) return null;
  // Only scan text-like files
  const ext = path.extname(file).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.gif', '.zip', '.tgz', '.exe', '.dll'].includes(ext)) return null;
  try {
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        return { file, pattern: pattern.toString() };
      }
    }
  } catch (err) {
    // ignore binary or unreadable files
    return null;
  }
  return null;
}

function main() {
  console.log('Running repository secret checks...');
  const files = walk(repoRoot);
  const findings = [];
  for (const f of files) {
    const r = checkFile(f);
    if (r) findings.push(r);
  }

  if (findings.length) {
    console.error('Potential secrets found in repository:');
    findings.forEach((f) => console.error(` - ${f.file} matches ${f.pattern}`));
    process.exitCode = 2;
    process.exit(2);
  }

  console.log('No obvious secrets found.');
}

main();
