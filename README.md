# Forge

A personal strength coach + day planner + psychology log. It's a PWA: no server, no accounts, and it's free to host.
Data is stored on your phone (localStorage). **Export a backup in Settings now and then.**

## Run it on your computer
Double-clicking index.html mostly works, but install and offline mode need a web server:
```
cd forge
python -m http.server 8000
```
Then open http://localhost:8000

## Put it online free (GitHub Pages)
1. Create a new repository on github.com, e.g. `forge` (Public).
2. Upload every file in this folder, keeping the `icons/` folder.
3. Go to Settings → Pages → Source: *Deploy from a branch* → Branch: `main` / root → Save.
4. After about 1 minute it's live at `https://<your-username>.github.io/forge/`

## Install on your phone
- **Android (Chrome):** open the link → ⋮ menu → *Add to Home screen / Install app*.
- **iPhone (Safari):** open the link → Share → *Add to Home Screen*.

It then opens full-screen like a normal app and works offline.

## Files
- `program.js`: the program, RPE chart and autoregulation engine
- `app.js`: the screens (Today, Train, Mind, Plan, Settings)
- `style.css`: the design
- `PROGRAM.md`: the training plan and the research behind it
