# AQUALIMA × SHAMS ENERGY — Android APK

## Build in the cloud (no Android Studio needed)
1. Create a free private GitHub repo and upload everything in this folder (keep the `.github` folder).
2. Open the repo → **Actions** → **Build Android APK** → **Run workflow**.
3. After ~5–8 min, download the APK from the run's **Artifacts**.

Without signing secrets you get a *debug* APK (installs fine for testing/internal use).

## Professional signed release APK
Create a keystore once (keep it safe — you need the same one for every future update):

    keytool -genkeypair -v -keystore release.jks -alias aqualima -keyalg RSA -keysize 2048 -validity 10000

Then in GitHub → Settings → Secrets and variables → Actions, add:
- `KEYSTORE_BASE64` — output of `base64 -w0 release.jks`
- `KEYSTORE_PASSWORD`, `KEY_ALIAS` (e.g. `aqualima`), `KEY_PASSWORD`

## Customize
- App name / package ID: `capacitor.config.json` (`appName`, `appId`)
- Icon / splash: replace the PNGs in `assets/`
- App content: `www/index.html` (original file + one-line change; `www/android-shim.js` adds saving files and printing on Android)
