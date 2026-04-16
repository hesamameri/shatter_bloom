# Shatter Bloom — Cinematic Edition

A dramatic wall-fracture effect for the browser: branching cracks propagate from an impact point, light pulses and seeps through the fissures, dust falls from the cracks, and the wall shatters with physics-driven fragments to reveal a radiant glow.

![demo](demo.jpg)

## Quick Start

1. Include files:

```html
<link rel="stylesheet" href="style.css">

<img class="shatter-bloom" src="your-image.jpg" alt="">

<script src="src/breaking-wall.js"></script>
```

2. Optional — set values directly on the image with data attributes:

```html
<img
  class="shatter-bloom"
  src="your-image.jpg"
  data-wall-duration="2"
  data-wall-fracture-count="55"
  data-wall-crack-branches="7"
  data-wall-crack-depth="5"
  data-wall-light-color="#fffbe6"
  data-wall-light-intensity="0.9"
  data-wall-shake-intensity="1"
  data-wall-auto-play="true"
/>
```

The plugin auto-attaches to all `.shatter-bloom` images.

## JavaScript API

The global object is `window.ShatterBloom`.

| Method | Description |
|---|---|
| `ShatterBloom.defaults` | Default settings object |
| `ShatterBloom.attach(target, options?)` | Attach to one image |
| `ShatterBloom.attachAll(selector?, options?)` | Attach to many images |
| `ShatterBloom.destroy(target)` | Destroy one instance |

`target` can be an `HTMLImageElement` or a CSS selector string.

### Instance methods

```js
const inst = ShatterBloom.attach("#my-img", { duration: 3 }); // 3 minutes
inst.play();    // start the effect
inst.pause();   // pause mid-animation
inst.reset();   // reset to initial state
inst.destroy(); // clean up completely
inst.updateOptions({ fractureCount: 80 }); // live-update & rebuild
```

### Events

```js
img.addEventListener("shatterbloom:done", () => {
  console.log("Effect finished!");
});
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `duration` | number | `2` | Total effect duration in **minutes** |
| `fractureCount` | number | `55` | Number of Voronoi fragment cells |
| `crackWidth` | number | `1.8` | Base crack-line width in px |
| `lightColor` | string | `"#fffbe6"` | Colour of the light behind the wall |
| `lightIntensity` | number | `1.0` | Brightness of the reveal glow (0–1) |
| `delaySpread` | number | `0.35` | Per-fragment timing randomness (0–1) |
| `gravity` | number | `420` | px/s² for falling fragments |
| `rotationSpeed` | number | `1.8` | Max random spin speed (rad/s) |
| `crackPhase` | number | `0.30` | Fraction of duration — crack propagation |
| `rumblePhase` | number | `0.12` | Fraction of duration — tension build / pulse |
| `lightPhase` | number | `0.18` | Fraction of duration — light floods cracks |
| `breakPhase` | number | `0.30` | Fraction of duration — fragments shatter |
| `impactPoint` | object/null | `null` | `{x:0-1, y:0-1}` or null for auto-centre |
| `crackBranches` | number | `7` | Primary crack arms from impact point |
| `crackDepth` | number | `5` | Max branching recursion depth |
| `dustCount` | number | `120` | Number of dust / debris particles |
| `shakeIntensity` | number | `1.0` | Screen-shake multiplier (0 = off) |
| `lightRayCount` | number | `18` | Volumetric light rays through cracks |
| `impactStrength` | number | `1.0` | Visual strength of impact pulses (0 = off, up to 2) |
| `impactBPM` | number | `90` | Beats per minute — sync to your track's tempo |
| `autoPlay` | boolean | `true` | Start automatically on load |
| `loop` | boolean | `false` | Loop the effect |
| `easing` | string | `"easeOutCubic"` | Easing function name |

## Supported data attributes

All options can be set via `data-wall-*` attributes (camelCase → kebab-case):

- `data-wall-duration`
- `data-wall-fracture-count`
- `data-wall-crack-width`
- `data-wall-crack-branches`
- `data-wall-crack-depth`
- `data-wall-light-color`
- `data-wall-light-intensity`
- `data-wall-light-ray-count`
- `data-wall-delay-spread`
- `data-wall-gravity`
- `data-wall-rotation-speed`
- `data-wall-crack-phase`
- `data-wall-rumble-phase`
- `data-wall-light-phase`
- `data-wall-break-phase`
- `data-wall-dust-count`
- `data-wall-shake-intensity`
- `data-wall-impact-strength`
- `data-wall-impact-bpm`
- `data-wall-auto-play`
- `data-wall-loop`
- `data-wall-easing`

## Cinematic Features

- **Branching crack tree** — cracks propagate outward from a central impact point with organic branching and depth variation
- **5-phase animation** — crack → rumble → light → break → reveal, each with independent timing control
- **Volumetric light rays** — pulsing god-rays emanate from the impact point through cracks
- **Dust & debris particles** — small specks fall from cracks, glow when lit
- **Screen shake** — subtle micro-tremors during rumble, a heavier hit when the wall breaks
- **3D-like fragment physics** — fragments push outward from impact, scale down for depth, rotate and fall under gravity
- **Pulsing light build-up** — tension-building glow during the rumble phase before the full break
- **Impact pulse shockwave** — continuous rhythmic hits at the impact point synced to BPM, with expanding rings and screen shake
- **Glass-like crack propagation** — each crack snaps into existence instantly (not drawn slowly), propagating outward from the impact
- **Sun-intensity lighting** — multi-pass radial glow with white-hot core, god-rays, and full-screen bloom on reveal
- **9-zone impact point** — choose where the impact originates via `impactPoint: {x, y}` (normalised 0–1)

## Notes

- Duration is in **minutes**, not seconds.
- Use **local** or **same-origin** images to avoid canvas CORS restrictions.
- Phase ratios should sum to ≤ 1.0; the remainder becomes the final reveal hold.
- Cells near the impact point are denser and break first for a realistic shatter pattern.
- The plugin uses **Voronoi tessellation** for natural-looking fracture geometry.
- Set `impactBPM` to your track's tempo for beat-synced shockwave pulses.
- Use `impactPoint: {x: 0.17, y: 0.83}` to place the impact in the bottom-left, etc.

## License

MIT © [Hesam Ameri](https://hesamameri.dev)
