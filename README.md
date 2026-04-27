# Spin the Wheel

A minimalist, GPU-smooth spin-the-wheel — built in vanilla HTML/CSS/JS. No frameworks, no build step, no dependencies.

**Live demo →** [willegyr.github.io/SpinTheWheel](https://willegyr.github.io/SpinTheWheel/)

---

## Features

- **Dynamic items** — add, remove, shuffle, or clear. Saved to `localStorage` so they survive reloads.
- **Buttery-smooth spin** — rotation runs entirely on the compositor thread via the Web Animations API; a busy main thread never makes it stutter.
- **14 themes** — high-contrast dark themes, a light theme, and a few neon variants. Choice persists.
- **Confetti burst** on each win.
- **Mobile-friendly** — responsive layout, touch-sized tap targets, no sideways scroll.
- **Keyboard shortcuts** — `Space` to spin, `Esc` to close the result modal.
- **Remove-winner workflow** — one click drops the winner from the wheel for tournament-style picking.

## Themes

| | |
| --- | --- |
| **Midnight** *(default)* | deep navy + sky blue |
| **Crimson** | near-black + bright red |
| **Emerald** | near-black + saturated green |
| **Magenta** | near-black + hot pink |
| **Tangerine** | near-black + bright orange |
| **Volt** | near-black + electric yellow |
| **Verdant** | dark forest + sage |
| **Velvet & Gold** | wine + champagne |
| **Synthwave** | neon purple/pink/cyan |
| **Tokyo Neon** | pure black + multi-neon |
| **Brutalist Mono** | black + red + white |
| **Sakura** | dark + soft pink |
| **Vaporwave** | purple gradient + cyan/lime |
| **Glacier** *(light)* | ice blue + frost |

## Tech notes

A few things that turned out to matter for "extremely smooth":

- **Pre-rendered wheel.** Segments, gradients, labels, and rims are baked into an offscreen canvas once per items change. During spin the visible canvas just blits the cached image at a new rotation — no per-frame canvas redraws.
- **Compositor-thread rotation.** `Element.animate()` with 48 pre-eased keyframes drives `transform: rotate(...)`. Because the canvas is its own GPU layer (`will-change: transform; translateZ(0)`), the rotation is interpolated entirely by the compositor.
- **`body.is-spinning` perf mode.** While the wheel is spinning, `backdrop-filter` on the panel and the aurora/ring/glow CSS animations are paused — these are the heaviest re-rasterisation sources and aren't visible on the wheel itself.
- **Themes as CSS variables.** Every theme is just a different set of values for `--bg`, `--accent`, etc., applied via `body[data-theme="..."]`. No JS-side colour math.

## Project layout

```
.
├── index.html      # markup + theme switcher container
├── styles.css      # variables, themes, layout, animations
├── script.js       # wheel rendering, spin loop, items, confetti
└── README.md
```

## Running locally

Three static files — open `index.html` directly, or serve them:

```bash
python -m http.server 8000
# then http://localhost:8000
```

## License

MIT — see [`LICENSE`](LICENSE).
