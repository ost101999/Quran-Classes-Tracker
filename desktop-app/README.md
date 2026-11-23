<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

The desktop project is in `desktop-app/`. The student portal is beside it in
`student-web-app/` and has its own deployment instructions.

From the repository root, `npm install`, `npm start`, `npm run build`, and
`npm run electron:build` still work. Use the existing launchers in the root
`build-tools/` folder to update the installed app. Running the installer build
from the root puts it in the root `dist_electron/` for existing shortcuts.
Running the build from `desktop-app/` puts it in `desktop-app/dist_electron/`.
The Chrome extension uses the root `chrome-tab-extension/` path so Chrome
profiles that already loaded it can keep using it.

View your app in AI Studio: https://ai.studio/apps/drive/1yVnLDAT_Apw4T5xix2UTVLk2mLbxB1GN

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
