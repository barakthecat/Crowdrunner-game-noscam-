# Crowd Runner (no scam)

The crowd-runner game the App Store ads promise but never deliver. It runs in the browser
(Three.js, no build step, no assets to download), and it's made to play on a phone.

## How to play

- **Drag** left/right to steer your squad (or use the arrow keys / A-D on a computer).
- **Gates** change your troop count: `+N`, `−N`, `×N`, `÷N`. Pick the better side.
- Your squad **fires nonstop**. Shooting a `+`/`−` gate raises its number (up to a limit),
  so a red `−5` can become a blue `+5` if you aim at it long enough.
- **Barrels** show their health. Shoot them open for loot: a gun (more firepower) or
  extra troops. If you run into an unbroken barrel, you lose troops equal to its number.
- **Red crowds** charge at you. Shooting them thins them out; touching them trades troop for troop.
- **Spikes** take out part of the squad if you run over them.
- **Stone walls** split the road into lanes. Once you're in a lane, you're committed.
- At the end, a **boss** walks at you swinging a club. Shoot it down before it flattens your squad.

Coins from each level buy permanent **Recruits** (more starting troops) and
**Firepower** upgrades. Progress is saved in your browser.

Levels are generated from the level number, so each level is the same every time you replay it,
and later levels get longer and harder.

## Running it

It's a static site: any web server works.

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

To play on an iPhone, turn on GitHub Pages for this repo (Settings → Pages → deploy from
the `main` branch, root folder), open the Pages URL in Safari, then Share → **Add to Home Screen**
so it runs full screen like an app.

Debug: add `?debug` to the URL to expose game state as `window.__cr` in the console.

## Code

- `index.html`: page shell, HUD, menus, styles
- `js/main.js`: game loop, crowd/enemy/boss logic, shooting, rendering
- `js/level.js`: seeded level generator and difficulty scaling
- `js/models.js`: procedural models (soldiers, boss, gun) and canvas textures/labels
- `js/audio.js`: small WebAudio sound effects
