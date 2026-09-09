import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const androidDirectory = resolve('android');
const wrapper = resolve(androidDirectory, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const releaseProperties = resolve(androidDirectory, 'keystore.properties');
const releaseRequested = process.argv.includes('--release');
const task = releaseRequested ? 'assembleRelease' : 'assembleDebug';

if (!existsSync(wrapper)) {
  console.error('The Android project is missing. Run: npx cap add android');
  process.exit(1);
}

if (releaseRequested && !existsSync(releaseProperties)) {
  console.error('Release signing is not configured. Copy android/keystore.properties.example to android/keystore.properties and complete it.');
  process.exit(1);
}

const versionCode = process.env.TDCON_VERSION_CODE;
const versionName = process.env.TDCON_VERSION_NAME;
if (versionCode && !/^[1-9]\d*$/.test(versionCode)) {
  console.error('TDCON_VERSION_CODE must be a positive integer.');
  process.exit(1);
}

const gradleArguments = [task];
if (versionCode) gradleArguments.push(`-PversionCode=${versionCode}`);
if (versionName) gradleArguments.push(`-PversionName=${versionName}`);

const result = spawnSync(wrapper, gradleArguments, {
  cwd: androidDirectory,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const variant = releaseRequested ? 'release' : 'debug';
console.log(`APK generated at android/app/build/outputs/apk/${variant}/app-${variant}.apk`);
