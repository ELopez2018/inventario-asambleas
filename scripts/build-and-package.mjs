import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const { ZipArchive } = require('archiver');

const rootDir = process.cwd();
const packageJsonPath = path.join(rootDir, 'package.json');
const packageLockPath = path.join(rootDir, 'package-lock.json');
const appVersionPath = path.join(rootDir, 'src', 'app', 'core', 'app-version.ts');
const distDir = path.join(rootDir, 'dist', 'inventario-front');
const browserDistDir = path.join(distDir, 'browser');
const releaseDir = path.join(rootDir, 'releases');

const versionFlag = process.argv[2] ?? 'patch';
const versionTypeByFlag = new Map([
  ['M', 'major'],
  ['major', 'major'],
  ['m', 'minor'],
  ['minor', 'minor'],
  ['patch', 'patch'],
  ['p', 'patch'],
]);

const versionType = versionTypeByFlag.get(versionFlag);

if (!versionType) {
  console.error(`Modificador de version no valido: "${versionFlag}". Use M, m o sin modificador.`);
  process.exit(1);
}

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
const packageName = packageJson.name;
const currentVersion = String(packageJson.version ?? '0.0.0');
const nextVersion = incrementVersion(currentVersion, versionType);
const originalPackageJsonText = await readFile(packageJsonPath, 'utf8');
const originalPackageLockText = (await fileExists(packageLockPath))
  ? await readFile(packageLockPath, 'utf8')
  : null;
const originalAppVersionText = (await fileExists(appVersionPath))
  ? await readFile(appVersionPath, 'utf8')
  : null;

console.log(`Compilando ${packageName} ${currentVersion} -> ${nextVersion} (${versionType})...`);

packageJson.version = nextVersion;
await writeJson(packageJsonPath, packageJson);
await updatePackageLockVersion(packageLockPath, nextVersion);
await writeAppVersion(nextVersion);

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const build = spawnSync(npmCommand, ['run', 'build:prod'], {
  cwd: rootDir,
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

if (build.status !== 0) {
  await restoreVersionFiles(originalPackageJsonText, originalPackageLockText, originalAppVersionText);

  if (build.error) {
    console.error(build.error);
  }

  console.error(`Codigo de salida de compilacion: ${build.status ?? 'desconocido'}.`);
  console.error('La compilacion fallo. No se actualizo la version ni se genero ZIP.');
  process.exit(build.status ?? 1);
}

const sourceDir = await directoryExists(browserDistDir) ? browserDistDir : distDir;

await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });

const zipFileName = `${packageName}-${nextVersion}.zip`;
const zipPath = path.join(releaseDir, zipFileName);

await createZipFromDirectory(sourceDir, zipPath);
await assertOnlyReleaseZip(zipPath);

console.log(`ZIP generado: ${path.relative(rootDir, zipPath)}`);

function incrementVersion(version, type) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);

  if (!match) {
    throw new Error(`Version semantica no valida en package.json: "${version}".`);
  }

  let [, majorRaw, minorRaw, patchRaw] = match;
  let major = Number(majorRaw);
  let minor = Number(minorRaw);
  let patch = Number(patchRaw);

  if (type === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (type === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }

  return `${major}.${minor}.${patch}`;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function updatePackageLockVersion(filePath, version) {
  const exists = await fileExists(filePath);

  if (!exists) {
    return;
  }

  const packageLock = JSON.parse(await readFile(filePath, 'utf8'));
  packageLock.version = version;

  if (packageLock.packages?.['']) {
    packageLock.packages[''].version = version;
  }

  await writeJson(filePath, packageLock);
}

async function writeAppVersion(version) {
  await writeFile(appVersionPath, `export const APP_VERSION = '${version}';\n`, 'utf8');
}

async function restoreVersionFiles(packageJsonText, packageLockText, appVersionText) {
  await writeFile(packageJsonPath, packageJsonText, 'utf8');

  if (packageLockText !== null) {
    await writeFile(packageLockPath, packageLockText, 'utf8');
  }

  if (appVersionText !== null) {
    await writeFile(appVersionPath, appVersionText, 'utf8');
  }
}

async function createZipFromDirectory(sourceDir, zipPath) {
  await new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('warning', reject);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    void archive.finalize();
  });
}

async function assertOnlyReleaseZip(zipPath) {
  const entries = await readdir(releaseDir);
  const expectedName = path.basename(zipPath);
  const unexpectedEntries = entries.filter((entry) => entry !== expectedName);

  if (unexpectedEntries.length > 0) {
    throw new Error(`El directorio releases contiene archivos inesperados: ${unexpectedEntries.join(', ')}`);
  }
}

async function fileExists(filePath) {
  try {
    const fileStat = await stat(filePath);
    return fileStat.isFile();
  } catch {
    return false;
  }
}

async function directoryExists(directoryPath) {
  try {
    const directoryStat = await stat(directoryPath);
    return directoryStat.isDirectory();
  } catch {
    return false;
  }
}
