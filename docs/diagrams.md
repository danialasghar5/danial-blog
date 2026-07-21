# Diagram system

Theme-aware technical diagrams, assembled from a small vocabulary of nodes and
edges. A diagram renders as a **schematic-on-ink** in dark and a
**blueprint-on-paper** in light, from one set of markup — every node and edge
reads from the `--dg-*` CSS tokens in [`src/styles/global.css`](../src/styles/global.css).

**Architecture only.** These draw systems — services, data, queues, workers,
control flow. No decorative graphics, no stock illustration, no icon soup. If a
shape doesn't carry technical meaning, it doesn't go in.

## The identity

| Signal | Colour | Means |
|---|---|---|
| **sage** | `--dg-accent` | a guarantee / the correct path that holds |
| **clay** | `--dg-hazard` | a failure / hazard — retry, crash, duplicate, dead-letter |
| **grey** | `--dg-flow` | ordinary infrastructure and flow |

Use **at most two** signals in one diagram. Everything else is neutral.

## Authoring

Diagrams are inline components (not image files), imported into an `.mdx` post:

```mdx
import Diagram from '../../components/diagram/Diagram.astro';
import Service from '../../components/diagram/Service.astro';
import Database from '../../components/diagram/Database.astro';
import Edge from '../../components/diagram/Edge.astro';

<Diagram
  viewBox="0 0 520 300"
  label="Ingest path"
  caption="Figure 1. A request persists a row before returning."
  ariaLabel="A POST request persists a ticket to Postgres, then returns 202 Accepted.">
  <Service  x={150} y={20}  w={220} label="POST /api/tickets" />
  <Edge d="M260 66 V96" />
  <Database x={160} y={98}  w={200} label="tickets · Postgres" />
</Diagram>
```

Coordinates are explicit (there is no auto-layout). For a full worked example,
see [`figures/IdempotentWorkerFlow.astro`](../src/components/diagram/figures/IdempotentWorkerFlow.astro)
and [`figures/AtLeastOnceLoop.astro`](../src/components/diagram/figures/AtLeastOnceLoop.astro).
Reusable, post-specific diagrams live in `src/components/diagram/figures/`.

### `<Diagram>` (container)

| Prop | Required | Notes |
|---|---|---|
| `ariaLabel` | yes | Accessible description of the whole diagram. |
| `viewBox` | yes | e.g. `"0 0 760 520"`. Coordinates below are in these units. |
| `label` | | Eyebrow on the canvas (sage, mono, uppercased). |
| `caption` | | `<figcaption>` below — start with "Figure N.". |
| `scroll` | | `true` lets a dense diagram scroll horizontally instead of shrinking below legibility. |

The container fills the reading column and scales with its `viewBox`. It owns
the arrowhead marker and exposes it to edges via a `--dg-marker` variable, so
ids stay unique per diagram automatically.

### Nodes

| Component | Glyph | Key props |
|---|---|---|
| `Service` | rounded box | `x y w [h] label [sub]` |
| `Database` | cylinder | `x y w [h] label` |
| `Queue` | segmented box | `x y w [h] label [segments]` |
| `Worker` | boundary (wraps children) | `x y w h label` + slotted nodes |
| `Decision` | diamond | `cx cy [w] [h] label [label2]` |
| `Success` | sage gate + badge | `x y w [h] label [badge] [code]` |
| `Hazard` | clay box | `x y w [h] label [sub]` |

`Worker` is a container: place its inner nodes and edges as children, in the
same coordinate space.

### Edges

`<Edge d="…" variant="…" [label labelX labelY rotate] />`

- `d` — raw SVG path data (straight, elbow, or curved).
- `variant` — `flow` (default, grey) · `guarantee` (sage) · `hazard` (clay) · `future` (dashed).

The arrowhead colour follows the edge automatically (via `context-stroke`).

### Escape hatch

Any raw SVG element with a `dg-*` class works directly inside `<Diagram>` —
useful for one-off shapes like the dashed "future" annotation:

```jsx
<rect class="dg-futurebox" x="120" y="668" width="520" height="34" rx="9" />
<text class="dg-futuretext" x="380" y="690" text-anchor="middle">FUTURE — …</text>
```

## Adding a colour or node type

Add the token to **both** theme blocks in `global.css` (the `:root` light block
and the `[data-theme="dark"]` block), then a `.dg-*` class that consumes it.
Never hardcode a hex value inside a diagram — it will break one of the themes.
