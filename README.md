# Tactical Shooter

A browser-based 3D tactical shooter inspired by Valorant. Built with Three.js and vanilla JavaScript — no build step required.

## Features

- **Valorant-accurate mouse sensitivity** — Uses the same `m_yaw` / `m_pitch` (0.07°) formula as Valorant, adjustable from 0.1–10 in Settings
- **Main menu & map select** — Haven Lite map with 2 plant sites (A & B)
- **Buy menu** — Press `B` to buy sidearms, SMGs, rifles, snipers, and armor
- **Weapon system** — Classic, Ghost, Sheriff, Stinger, Spectre, Bulldog, Guardian, Vandal, Phantom, Marshal, Operator with Valorant-style stats
- **Spray patterns & recoil** — Per-weapon recoil patterns matching Valorant's vertical climb and horizontal sway
- **5 enemy bots** — Defenders patrol sites and engage when they see you; no allied bots
- **Round system** — Buy phase → combat → credits on kill/win

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Look (Valorant sensitivity) |
| Left Click | Shoot |
| R | Reload |
| B | Buy menu |
| 1 / 2 | Primary / secondary weapon |
| 4 (hold) | Plant spike at site |
| Ctrl | Crouch |
| Space | Jump |
| Esc | Close buy menu |

## Run Locally

ES modules require a local HTTP server:

```bash
# Python
python3 -m http.server 8080

# Node
npx serve .
```

Open `http://localhost:8080` in your browser.

## Sensitivity

The in-game formula matches Valorant:

```
rotation (degrees) = mouseDelta × sensitivity × 0.07
```

At sensitivity 0.5, each pixel of mouse movement rotates the view by 0.035°. This matches Valorant's sensitivity system so you can use the same value.
