# QR PDF Scanner — Setup & Run Guide

A React Native (JSX) Expo app that scans QR codes and generates downloadable PDFs from the scanned data.

---

## What the app does

1. Opens the device camera with a QR scanner overlay
2. Detects the QR code type (URL, Email, Phone, Wi-Fi, Text…)
3. Shows the scanned content on a result screen
4. Generates a formatted PDF report with one tap
5. Lets you share/save the PDF via your device's native share sheet

---

## Prerequisites

Make sure these are installed on your machine before starting.

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18 or 20 LTS | https://nodejs.org |
| npm | (comes with Node) | — |
| Expo CLI | latest | `npm install -g expo-cli` |
| Expo Go (phone) | latest | App Store / Play Store |

> **Expo Go** must be on the **same Wi-Fi network** as your computer.

---

## Step 1 — Copy the project files

Place all the provided files into a folder called `qr-pdf-scanner/`:

```
qr-pdf-scanner/
├── App.jsx
├── app.json
├── babel.config.js
├── package.json
└── src/
    └── screens/
        ├── ScannerScreen.jsx
        └── ResultScreen.jsx
```

---

## Step 2 — Install dependencies

Open a terminal inside the `qr-pdf-scanner/` folder and run:

```bash
npm install
```

Then install the Expo-native packages (this ensures correct native version pinning):

```bash
npx expo install expo-camera expo-print expo-sharing expo-file-system expo-status-bar
```

> **Why `npx expo install` instead of `npm install`?**
> Expo's installer automatically picks the correct package version compatible with your Expo SDK. Using plain `npm install` can cause version mismatches.

---

## Step 3 — Create placeholder assets (required by Expo)

Expo requires icon and splash images. Create a simple `assets/` folder with placeholder PNGs, or run this one-liner to generate minimal valid files:

```bash
mkdir -p assets

# macOS / Linux — create 1×1 pixel transparent PNGs
python3 -c "
import base64, os
# Minimal valid 1x1 transparent PNG (base64)
png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')
for name in ['icon.png','splash.png','adaptive-icon.png','favicon.png']:
    open(f'assets/{name}','wb').write(png)
print('Assets created.')
"
```

**On Windows (PowerShell):**

```powershell
New-Item -ItemType Directory -Force -Path assets
$png = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
foreach ($name in @("icon.png","splash.png","adaptive-icon.png","favicon.png")) {
    [IO.File]::WriteAllBytes("assets/$name", $png)
}
Write-Host "Assets created."
```

> You can replace these with real images later — 1024×1024 px for `icon.png`, 1242×2436 px for `splash.png`.

---

## Step 4 — Start the development server

```bash
npx expo start
```

You'll see output like this in your terminal:

```
Metro waiting on exp://192.168.x.x:8081
› Scan the QR code above with Expo Go (Android)
  or the Camera app (iOS)
```

A **QR code** will appear in the terminal (and optionally in a browser tab).

---

## Step 5 — Open the app in Expo Go

### On Android:
1. Open the **Expo Go** app
2. Tap **"Scan QR code"**
3. Scan the QR code shown in your terminal

### On iOS:
1. Open the default **Camera** app
2. Point it at the terminal QR code
3. Tap the **"Open in Expo Go"** banner that appears

The app will bundle and launch on your phone in ~30–60 seconds on first load.

---

## Step 6 — Using the app

1. **Grant camera permission** when prompted
2. **Point** the camera at any QR code
3. The app auto-detects and navigates to the result screen
4. Tap **"Generate PDF"** — a formatted report is created
5. Tap **"Share PDF"** to save or send it via your device's share sheet
6. Tap **"Scan Another QR"** to go back and scan again

---

## Project file overview

| File | Purpose |
|------|---------|
| `App.jsx` | Root component, manages screen navigation state |
| `src/screens/ScannerScreen.jsx` | Camera + QR scanner with overlay UI |
| `src/screens/ResultScreen.jsx` | Displays scanned data, generates & shares PDF |
| `app.json` | Expo app config (name, permissions, icons) |
| `package.json` | Dependencies list |
| `babel.config.js` | Babel transpiler config for Expo |

---

## Packages used and why

| Package | Why |
|---------|-----|
| `expo-camera` | Modern Expo camera with `CameraView` + built-in barcode scanner |
| `expo-print` | Converts HTML → native PDF binary (iOS & Android) |
| `expo-file-system` | Move the generated PDF to a stable cache path |
| `expo-sharing` | Opens the native OS share sheet to save/send the PDF |
| `expo-status-bar` | Controls the status bar color |

---

## Troubleshooting

### "Camera permission denied"
Go to **Settings → Apps → QR PDF Scanner → Permissions** and enable Camera.

### "expo-print is not installed" error
Run: `npx expo install expo-print` then restart with `npx expo start --clear`

### App won't connect / blank screen
- Make sure phone and computer are on the **same Wi-Fi network**
- Try `npx expo start --tunnel` which uses a public tunnel (requires `@expo/ngrok`)
- Or run `npx expo start --clear` to clear the Metro cache

### QR scanner not triggering
- Ensure there's good lighting
- Hold the phone steady ~15–30 cm from the QR code
- The torch button (bottom of scanner) can help in low light

### PDF share sheet doesn't open
Sharing is not available in the iOS Simulator. Test on a **real device**.

---

## Optional improvements

- **History tab** — persist scanned QR codes with `expo-sqlite` or `AsyncStorage`
- **Custom PDF branding** — update the `buildHtml()` function in `ResultScreen.jsx`
- **Multiple barcode types** — add `"pdf417"`, `"code128"`, etc. to `barcodeTypes` in `ScannerScreen.jsx`
- **Real app icon** — replace `assets/icon.png` with a 1024×1024 PNG

---

## Building for production (optional)

When ready to publish beyond Expo Go:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to your Expo account
eas login

# Configure the build
eas build:configure

# Build for Android (APK / AAB)
eas build --platform android

# Build for iOS (requires Apple Developer account)
eas build --platform ios
```
