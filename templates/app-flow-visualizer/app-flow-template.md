# Regeneration Prompt — App Flow Reference

Use this prompt verbatim (or lightly adapted per project) to regenerate the project's `<project-directory-name>-flows.html` from scratch for any codebase regardless of language, framework, or platform.

---

## Prompt

Explore the codebase at the current working directory and generate a **single self-contained HTML file** called `<project-directory-name>-flows.html` (where `<project-directory-name>` is the name of the project's root directory — e.g., if the project lives in `~/Documents/Github/my-cool-app`, the output file is `my-cool-app-flows.html`) that documents and visualises all main user flows in the app. The file must have **no external dependencies** (no CDN, no external fonts, no separate JS/CSS files — everything inline).

### Step 1 — Explore the codebase thoroughly

Read the following before writing any output:

1. **Architecture doc** — any file matching `*-Architecture.md` or `ARCHITECTURE.md` in the project root — full architecture specification
2. **Conventions doc** — `CONVENTIONS.md` in the project root — coding standards and project rules
3. **Entry point(s)** — identify the application entry point(s) for the stack in use (e.g., `main.dart`, `main.ts`, `App.tsx`, `index.js`, `Program.cs`, `Application.java`, `manage.py`, etc.)
4. **Router / route definitions** — locate all route/navigation configuration files regardless of framework (e.g., GoRouter, React Router, Vue Router, Express routes, Spring `@RequestMapping`/`@Controller`, ASP.NET endpoint mapping, URL conf, etc.)
5. **All screen / page / view / component files** — the UI layer, wherever the project organises them (e.g., `screens/`, `pages/`, `views/`, `features/`, `components/`, `templates/`, etc.)
6. **All service / use-case / business-logic files** — the service layer (e.g., `services/`, `usecases/`, `domain/`, `application/`, `bl/`, etc.)
7. **All state management files** — providers, stores, reducers, controllers, blocs, view-models, or any state management pattern the project uses
8. **Constants / configuration** — app-wide constants, environment config, feature flags
9. **Dependency manifest** — the project's dependency file (`pubspec.yaml`, `package.json`, `pom.xml`, `build.gradle`, `Cargo.toml`, `requirements.txt`, `*.csproj`, `Gemfile`, `go.mod`, etc.)
10. **OpenAPI / API spec** — any `openapi.yaml`, `swagger.json`, or equivalent API contract file

For each flow, identify: name, entry point, exit point, steps, screens/pages touched, state managers used, services called, database tables written/read, external integrations.

---

### Step 2 — Build the HTML file with TWO views

The file uses a **left sidebar for section navigation** + a **topbar with two view tabs**: "Flow Cards" and "Architecture Diagram".

#### View 1 — Flow Cards

- Dark-themed card grid (`background: #0f1117`, surface cards `#181b24`)
- One card per flow: icon, name, route/endpoint, one-line summary, colour-coded tags
- Clicking a card opens a **modal detail panel** with: entry/exit, route pill, full summary, numbered steps list, state managers, services, DB tables, tags
- Search box in topbar filters by name/summary/route/service/state manager/db table
- Left sidebar filters by section (Core / Quality / Advanced / Reference + route map / state managers / services)
- Summary stats strip on "All Flows" view showing counts: flows, routes/endpoints, state managers, services, test frameworks, external integrations
- Reference tables for routes/endpoints, state managers, and service classes accessible from sidebar

#### View 2 — Architecture Diagram

Inspired by the ToDesktop architecture diagram style: **six vertical swim lanes** with nodes and animated SVG connection lines.

**Six lanes** (left → right):
1. **User / Entry** — user actors and entry points (green tint)
2. **UI Layer** — screens, pages, views, or components with route/endpoint sub-labels (blue tint)
3. **State Management** — providers, stores, reducers, controllers, view-models, or equivalent (purple tint)
4. **Services** — service classes, use cases, business logic (yellow tint)
5. **Data Layer** — database tables, ORM entities, repositories, caches (cyan tint)
6. **External** — third-party APIs, CLI tools, OS integrations, message queues, cloud services (gray tint)

**Right panel** — scrollable list of ALL flows. Clicking a flow:
- Highlights the nodes involved in that flow (glowing border, colour matched to flow type)
- Dims all other nodes
- Draws **animated dashed bezier curves** (SVG, `stroke-dasharray` + CSS animation) between connected node pairs, colour-coded by flow
- Shows a numbered steps panel below the flows list

**Node clicking** — clicking a highlighted node selects the first flow that uses it; clicking it again when already selected opens the full detail modal.

**Legend** strip above the right panel showing lane colour coding.

Connections redraw on scroll and window resize.

---

### Step 3 — Data format

All data lives in a single `APP_DATA` JavaScript object at the top of the `<script>` block with these keys:

```js
APP_DATA = {
  meta: {
    app,           // project name
    version,       // version from dependency manifest
    platform,      // detected platform/framework (e.g., "Flutter", "React", "Spring Boot", "ASP.NET", "Django", etc.)
    language,      // primary language (e.g., "Dart", "TypeScript", "Java", "C#", "Python", "Go", etc.)
    db,            // database technology if any (e.g., "SQLite", "PostgreSQL", "MongoDB", "DynamoDB", etc.)
    state,         // state management approach (e.g., "Riverpod", "Redux", "Vuex", "MobX", "Bloc", "Spring Beans", etc.)
    routing,       // routing framework (e.g., "GoRouter", "React Router", "Spring MVC", "Express", etc.)
    generated      // ISO timestamp of generation
  },
  flows: [
    {
      id, section, icon, color, name, route, entry, exit, summary,
      steps: [...],
      providers: [...],         // state managers, stores, reducers, controllers, etc. — MUST be called "providers"
      services: [...],
      db_tables: [...],
      nodes: { user:[...], screens:[...], providers:[...], services:[...], db:[...], external:[...] },
      tags: [[label, colorName], ...]
    }
  ],
  routes: [{ path, screen, notes }],          // or endpoints for backend apps
  providers: [{ name, type, purpose }],       // state managers, stores, reducers, etc. — MUST be called "providers"
  services: [{ name, responsibility }]
}
```

**CRITICAL — Property naming:** The flow-level property MUST be called `providers` (not `state_managers`). The APP_DATA top-level array MUST also be called `providers` (not `state_managers`). The JavaScript code references `f.providers` and `APP_DATA.providers` — using any other property name causes silent data loss in modals, reference tables, and search.

Additionally, define these four companion data structures AFTER `APP_DATA`:

**`DIAGRAM_NODES`** — flat array where each entry is `{ id, lane, label, sub, type }`:
- `id`: short kebab-case string with a lane prefix, e.g. `"u-user"`, `"s-login"`, `"p-auth"`, `"svc-api"`, `"db-users"`, `"ext-smtp"`. Use prefixes: `u-` (user/entry), `s-` (screen/ui), `p-` (state manager), `svc-` (service), `db-` (data layer), `ext-` (external).
- `lane`: integer 0–5 matching the six swim lanes (0=user, 1=ui, 2=state, 3=services, 4=data, 5=external)
- `label`: display name (class name, table name, or descriptive label)
- `sub`: one-line subtitle (route path, type signature, short description)
- `type`: one of `"user"`, `"screen"`, `"provider"`, `"service"`, `"db"`, `"external"` — drives CSS colouring via `node-${type}` class

**`FLOW_NODE_MAP`** — object keyed by flow `id`, value is an array of `DIAGRAM_NODES` `id` strings that participate in that flow. Every node referenced here MUST exist in `DIAGRAM_NODES`.

**`FLOW_CONNECTIONS`** — object keyed by flow `id`, value is an array of `[fromId, toId]` pairs representing directed edges. Every ID in every pair MUST exist in `DIAGRAM_NODES`. Edges should follow the left-to-right lane order (user → ui → state → service → data → external) where possible, but cross-lane and reverse connections are allowed.

**`FLOW_COLORS`** — object keyed by flow `id`, value is a hex colour string for that flow's connection lines (e.g. `"#34d399"`).

**CRITICAL**: Every flow in `APP_DATA.flows` MUST have a corresponding entry in ALL THREE of `FLOW_NODE_MAP`, `FLOW_CONNECTIONS`, and `FLOW_COLORS`. Missing entries are the #1 cause of broken connection drawing. After populating these structures, mentally verify: for every `f.id` in `APP_DATA.flows`, confirm `FLOW_NODE_MAP[f.id]` exists and is non-empty, `FLOW_CONNECTIONS[f.id]` exists and is non-empty, and `FLOW_COLORS[f.id]` exists.

---

### Step 4 — Visual design constraints

- Background: `#0f1117`, surface: `#181b24`, surface2: `#1e2230`, border: `#2a2f3f`
- Accent: `#5b8af4`, green: `#34d399`, yellow: `#fbbf24`, red: `#f87171`, orange: `#fb923c`, purple: `#a78bfa`, cyan: `#22d3ee`, muted: `#64748b`
- Font: `Inter, system-ui, sans-serif`
- Diagram canvas: dot-grid background (`background-image: linear-gradient(...)`)
- Lane column headers: sticky at top of canvas, showing lane name + colour dot
- Node cards: rounded corners, type-specific border/background tint, hover → accent border
- Connection lines: SVG `<path>` with cubic bezier, `stroke-dasharray: 6 4`, CSS `animation: dashFlow 1s linear infinite` (animates `stroke-dashoffset`)
- Scrollbars: `6px`, transparent track
- Modal: `backdrop-filter: blur(4px)`, `box-shadow: 0 24px 64px rgba(0,0,0,.6)`

---

### Step 5 — MANDATORY Architecture: Complete HTML, CSS, and JavaScript

This section defines the **exact** DOM structure, CSS, and JavaScript that the output file MUST use. These are not suggestions or examples — they are the proven reference implementation. **Copy them verbatim into the output**, adapting ONLY the data content (APP_DATA, DIAGRAM_NODES, etc.) and the sidebar section labels to match the detected project.

**DO NOT** redesign the layout, rename CSS classes, change the HTML nesting, use inline styles instead of CSS classes, use `classList.toggle('hide')` instead of the `.view.active` pattern, minify class names, or restructure the JavaScript. The patterns below are battle-tested; every deviation introduces bugs.

#### 5A — Complete HTML Structure

The output file MUST use this exact body structure. The sidebar section items, lane header labels, and data content change per project. Everything else is fixed.

```html
<body>
<div class="layout">
  <!-- ── Sidebar ── -->
  <nav class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <h1>PROJECT_NAME</h1>
      <p>App Flow Reference</p>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-label">Overview</div>
      <div class="sidebar-item active" data-section="all" onclick="filterSection('all', this)">
        <span class="dot dot-blue"></span> All Flows
      </div>
    </div>
    <!-- Repeat sidebar-section blocks for each category detected in the codebase -->
    <div class="sidebar-section">
      <div class="sidebar-section-label">CATEGORY_NAME</div>
      <div class="sidebar-item" data-section="SECTION_ID" onclick="filterSection('SECTION_ID', this)">
        <span class="dot dot-COLOR"></span> SECTION_LABEL
      </div>
      <!-- ... more items ... -->
    </div>
    <!-- Reference section — always present -->
    <div class="sidebar-section">
      <div class="sidebar-section-label">Reference</div>
      <div class="sidebar-item" data-section="routes" onclick="filterSection('routes', this)">
        <span class="dot dot-gray"></span> Route Map
      </div>
      <div class="sidebar-item" data-section="providers" onclick="filterSection('providers', this)">
        <span class="dot dot-gray"></span> Providers
      </div>
      <div class="sidebar-item" data-section="services" onclick="filterSection('services', this)">
        <span class="dot dot-gray"></span> Services
      </div>
    </div>
  </nav>

  <!-- ── Main ── -->
  <div class="main">
    <div class="topbar">
      <div class="view-tabs">
        <div class="view-tab active" onclick="switchView('cards', this)">Flow Cards</div>
        <div class="view-tab" onclick="switchView('diagram', this)">Architecture Diagram</div>
      </div>
      <input class="search-box" id="searchBox" placeholder="Search flows…" oninput="handleSearch(this.value)" />
    </div>

    <!-- Cards View -->
    <div class="view active" id="view-cards">
      <div class="cards-scroll">
        <div class="content" id="mainContent"><!-- rendered by JS --></div>
      </div>
    </div>

    <!-- Diagram View -->
    <div class="view" id="view-diagram">
      <div class="diagram-layout">
        <div class="diagram-canvas-wrap" id="diagramWrap">
          <div class="diagram-canvas" id="diagramCanvas">
            <!-- Lane headers — separate sticky row above the nodes -->
            <div class="lane-headers">
              <div class="lane-header"><span class="lane-dot" style="background:#34d399"></span>User / Entry</div>
              <div class="lane-header"><span class="lane-dot" style="background:#5b8af4"></span>LANE_1_LABEL</div>
              <div class="lane-header"><span class="lane-dot" style="background:#a78bfa"></span>LANE_2_LABEL</div>
              <div class="lane-header"><span class="lane-dot" style="background:#fbbf24"></span>Services</div>
              <div class="lane-header"><span class="lane-dot" style="background:#22d3ee"></span>LANE_4_LABEL</div>
              <div class="lane-header"><span class="lane-dot" style="background:#94a3b8"></span>External</div>
            </div>
            <!-- SVG connection overlay — MUST be inside diagramCanvas -->
            <svg id="connectionSvg"></svg>
            <!-- Nodes grid — 6-column CSS grid populated by buildDiagram() -->
            <div class="nodes-grid" id="nodesGrid"><!-- rendered by JS --></div>
          </div>
        </div>
        <!-- Right panel -->
        <div class="diagram-panel">
          <div class="legend">
            <div class="legend-item"><div class="legend-dot" style="background:rgba(52,211,153,.5)"></div> User/Entry</div>
            <div class="legend-item"><div class="legend-dot" style="background:rgba(91,138,244,.5)"></div> LANE_1_LABEL</div>
            <div class="legend-item"><div class="legend-dot" style="background:rgba(167,139,250,.5)"></div> LANE_2_LABEL</div>
            <div class="legend-item"><div class="legend-dot" style="background:rgba(251,191,36,.5)"></div> Service</div>
            <div class="legend-item"><div class="legend-dot" style="background:rgba(34,211,238,.5)"></div> LANE_4_LABEL</div>
            <div class="legend-item"><div class="legend-dot" style="background:rgba(100,116,139,.5)"></div> External</div>
          </div>
          <div class="panel-header">
            <span>Flows</span>
            <button class="clear-btn" onclick="clearFlowSelection()">Clear</button>
          </div>
          <div class="panel-flows" id="panelFlows"><!-- rendered by JS --></div>
          <div class="panel-steps" id="panelSteps" style="display:none">
            <div class="panel-steps-header">Steps</div>
            <div id="panelStepsList"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ── Detail Overlay ── -->
<div class="detail-overlay" id="detailOverlay" onclick="closeDetail(event)">
  <div class="detail-panel" id="detailPanel">
    <div class="detail-top">
      <span id="detailIcon" style="font-size:20px"></span>
      <h3 id="detailTitle"></h3>
      <button class="close-btn" onclick="closeDetailBtn()">✕</button>
    </div>
    <div class="detail-body" id="detailBody"></div>
  </div>
</div>
```

**LANE_LABEL placeholders**: Replace `LANE_1_LABEL` through `LANE_4_LABEL` with the terminology that matches the detected stack (e.g., "Screens" for Flutter, "Pages" for React, "Controllers" for Spring Boot; "Providers" for Riverpod, "Stores" for Redux, "Beans" for Spring; "Database" for SQLite/PostgreSQL, "Data Layer" for REST APIs).

**Structural rules — violations of any of these will break the diagram:**
- `#connectionSvg` MUST be a direct child of `#diagramCanvas`, NOT of `#diagramWrap` or `body`
- `#diagramCanvas` MUST have `position: relative` (set in CSS)
- `#diagramWrap` MUST be the scroll container with `overflow: auto`
- View switching uses `.view` / `.view.active` CSS classes, NOT a `.hide` class with `!important`
- Lane headers are a SEPARATE `<div class="lane-headers">` row, NOT embedded inside each lane column
- The SVG sits BETWEEN the lane headers and the nodes grid in source order

#### 5B — Complete CSS

Include ALL of the following CSS in a single `<style>` block in the `<head>`. This is the complete stylesheet — do not omit, minify class names, or restructure any of it.

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0f1117;
  --surface: #181b24;
  --surface2: #1e2230;
  --border: #2a2f3f;
  --accent: #5b8af4;
  --accent2: #7c5bf4;
  --green: #34d399;
  --yellow: #fbbf24;
  --red: #f87171;
  --orange: #fb923c;
  --purple: #a78bfa;
  --cyan: #22d3ee;
  --text: #e2e8f0;
  --muted: #64748b;
  --sidebar-w: 260px;
}

html, body { height: 100%; font-family: 'Inter', system-ui, sans-serif; background: var(--bg); color: var(--text); }

/* ── Layout ── */
.layout { display: flex; height: 100vh; overflow: hidden; }

.sidebar {
  width: var(--sidebar-w); min-width: var(--sidebar-w);
  background: var(--surface); border-right: 1px solid var(--border);
  display: flex; flex-direction: column; overflow-y: auto; flex-shrink: 0;
}
.sidebar-header { padding: 20px 16px 12px; border-bottom: 1px solid var(--border); }
.sidebar-header h1 { font-size: 15px; font-weight: 700; letter-spacing: .02em; color: var(--text); }
.sidebar-header p  { font-size: 11px; color: var(--muted); margin-top: 2px; }
.sidebar-section { padding: 8px 0; border-bottom: 1px solid var(--border); }
.sidebar-section-label { font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); padding: 6px 16px 4px; }
.sidebar-item {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 16px; cursor: pointer;
  font-size: 13px; color: var(--muted);
  border-left: 2px solid transparent; transition: all .15s;
}
.sidebar-item:hover  { background: var(--surface2); color: var(--text); }
.sidebar-item.active { background: var(--surface2); color: var(--accent); border-left-color: var(--accent); font-weight: 600; }
.sidebar-item .dot   { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

.main { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-width: 0; }

/* ── Top bar ── */
.topbar {
  flex-shrink: 0; background: var(--surface); border-bottom: 1px solid var(--border);
  padding: 0 28px; display: flex; align-items: center; gap: 0; height: 48px;
}
.view-tabs { display: flex; gap: 0; }
.view-tab {
  padding: 0 18px; height: 48px; display: flex; align-items: center;
  font-size: 12px; font-weight: 600; color: var(--muted);
  cursor: pointer; border-bottom: 2px solid transparent;
  letter-spacing: .02em; transition: all .15s; user-select: none;
}
.view-tab:hover { color: var(--text); }
.view-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.search-box {
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: 6px; padding: 6px 12px; font-size: 12px; color: var(--text);
  outline: none; width: 200px; margin-left: 16px;
}
.search-box::placeholder { color: var(--muted); }
.search-box:focus { border-color: var(--accent); }

/* ── View containers ── */
.view { display: none; flex: 1; overflow: hidden; }
.view.active { display: flex; flex-direction: column; }

/* ═══ CARDS VIEW ═══ */
.cards-scroll { overflow-y: auto; flex: 1; }
.content { padding: 28px; max-width: 1200px; }
.flow-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; margin-bottom: 32px; }
.flow-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  overflow: hidden; cursor: pointer; transition: border-color .15s, transform .1s;
}
.flow-card:hover { border-color: var(--accent); transform: translateY(-1px); }
.card-header { padding: 14px 16px 10px; display: flex; align-items: flex-start; gap: 12px; }
.card-icon { font-size: 22px; flex-shrink: 0; }
.card-title { font-size: 13px; font-weight: 700; line-height: 1.3; }
.card-subtitle { font-size: 11px; color: var(--muted); margin-top: 2px; }
.card-body { padding: 0 16px 14px; }
.card-desc { font-size: 12px; color: var(--muted); line-height: 1.6; }
.card-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
.tag { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 4px; letter-spacing: .03em; }

/* ═══ DIAGRAM VIEW ═══ */
.diagram-layout { display: flex; flex: 1; overflow: hidden; }
.diagram-canvas-wrap {
  flex: 1; overflow: auto; position: relative; background: var(--bg);
  background-image:
    linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px);
  background-size: 32px 32px;
}
.diagram-canvas {
  position: relative; min-width: 1200px;
  padding: 0 0 40px 0; user-select: none;
}

/* Lane headers — separate sticky row ABOVE the nodes grid */
.lane-headers {
  display: grid;
  grid-template-columns: 160px 200px 220px 200px 200px 200px;
  position: sticky; top: 0; z-index: 10;
  background: var(--bg); border-bottom: 1px solid var(--border); padding: 0;
}
.lane-header {
  padding: 10px 0 10px 16px;
  font-size: 10px; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; color: var(--muted);
  border-right: 1px solid var(--border);
}
.lane-header:last-child { border-right: none; }
.lane-header .lane-dot {
  display: inline-block; width: 7px; height: 7px;
  border-radius: 50%; margin-right: 6px; vertical-align: middle;
}

/* Nodes grid — MUST use same fixed column widths as lane-headers */
.nodes-grid {
  display: grid;
  grid-template-columns: 160px 200px 220px 200px 200px 200px;
  align-items: start; padding: 24px 0; gap: 0;
}
.lane-col {
  padding: 0 12px;
  border-right: 1px solid rgba(255,255,255,.04);
  display: flex; flex-direction: column; gap: 12px; min-height: 600px;
}
.lane-col:last-child { border-right: none; }

/* ── Node cards ── */
.node {
  border: 1px solid var(--border); border-radius: 7px;
  padding: 8px 11px; font-size: 11px; font-weight: 600;
  cursor: pointer; transition: all .2s; position: relative;
  background: var(--surface2); color: var(--muted); line-height: 1.3;
}
.node .node-sub { font-size: 9.5px; font-weight: 400; color: var(--muted); margin-top: 2px; opacity: .7; }
.node:hover { border-color: var(--accent); color: var(--text); }

/* ── Node type colouring — EVERY node MUST have one of these via class="node node-${type}" ── */
.node-user     { border-color: rgba(52,211,153,.3);  color: #6ee7b7; background: rgba(52,211,153,.07); }
.node-screen   { border-color: rgba(91,138,244,.3);  color: #93b4fb; background: rgba(91,138,244,.07); }
.node-provider { border-color: rgba(167,139,250,.3); color: #c4b5fd; background: rgba(167,139,250,.07); }
.node-service  { border-color: rgba(251,191,36,.3);  color: #fcd34d; background: rgba(251,191,36,.07); }
.node-db       { border-color: rgba(34,211,238,.3);  color: #67e8f9; background: rgba(34,211,238,.07); }
.node-external { border-color: rgba(100,116,139,.3); color: #94a3b8; background: rgba(100,116,139,.07); }

/* ── Highlighted node (belongs to active flow) ── */
.node.highlighted {
  border-width: 2px; color: #fff;
  box-shadow: 0 0 12px rgba(91,138,244,.4);
  transform: translateY(-1px); z-index: 2;
}
.node-user.highlighted     { border-color: #34d399; background: rgba(52,211,153,.18);  box-shadow: 0 0 12px rgba(52,211,153,.35); }
.node-screen.highlighted   { border-color: #5b8af4; background: rgba(91,138,244,.18);  box-shadow: 0 0 12px rgba(91,138,244,.35); }
.node-provider.highlighted { border-color: #a78bfa; background: rgba(167,139,250,.18); box-shadow: 0 0 12px rgba(167,139,250,.35); }
.node-service.highlighted  { border-color: #fbbf24; background: rgba(251,191,36,.18);  box-shadow: 0 0 12px rgba(251,191,36,.35); }
.node-db.highlighted       { border-color: #22d3ee; background: rgba(34,211,238,.18);  box-shadow: 0 0 12px rgba(34,211,238,.35); }
.node-external.highlighted { border-color: #94a3b8; background: rgba(100,116,139,.18); box-shadow: 0 0 12px rgba(100,116,139,.35); }

/* Dimmed when another flow is active */
.node.dimmed { opacity: .2; }

/* ── SVG connection overlay ── */
#connectionSvg {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none; z-index: 1; overflow: visible;
}

/* ── Right panel — flows list ── */
.diagram-panel {
  width: 300px; min-width: 300px; background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex; flex-direction: column; overflow: hidden;
}
.panel-header {
  padding: 14px 16px 10px; border-bottom: 1px solid var(--border);
  font-size: 11px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: var(--muted);
  display: flex; align-items: center; justify-content: space-between;
}
.panel-flows { overflow-y: auto; flex: 1; padding: 8px 0; }
.panel-flow-item {
  padding: 10px 16px; cursor: pointer;
  border-left: 2px solid transparent; transition: all .15s;
}
.panel-flow-item:hover { background: var(--surface2); }
.panel-flow-item.active { background: var(--surface2); border-left-color: var(--accent); }
.panel-flow-name { font-size: 12px; font-weight: 600; color: var(--text); }
.panel-flow-desc { font-size: 11px; color: var(--muted); margin-top: 2px; line-height: 1.4; }
.clear-btn {
  font-size: 10px; color: var(--muted); cursor: pointer;
  border: 1px solid var(--border); border-radius: 4px;
  padding: 2px 8px; background: none; transition: all .15s;
}
.clear-btn:hover { color: var(--text); border-color: var(--accent); }

/* Steps panel — below flows when a flow is selected */
.panel-steps { border-top: 1px solid var(--border); overflow-y: auto; max-height: 280px; flex-shrink: 0; }
.panel-steps-header {
  padding: 10px 16px 6px; font-size: 10px; font-weight: 700;
  letter-spacing: .08em; text-transform: uppercase; color: var(--muted);
}
.panel-step {
  display: flex; gap: 10px; padding: 7px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 11px; line-height: 1.5; color: var(--muted);
}
.panel-step:last-child { border-bottom: none; }
.panel-step-n {
  flex-shrink: 0; width: 18px; height: 18px; border-radius: 50%;
  background: var(--accent); color: #fff; font-size: 9px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; margin-top: 1px;
}

/* Legend */
.legend {
  display: flex; gap: 12px; flex-wrap: wrap; padding: 8px 16px;
  border-bottom: 1px solid var(--border); font-size: 10px; color: var(--muted);
}
.legend-item { display: flex; align-items: center; gap: 4px; }
.legend-dot { width: 8px; height: 8px; border-radius: 2px; }

/* ── Detail modal ── */
.detail-overlay {
  display: none; position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,.6); backdrop-filter: blur(4px);
  align-items: center; justify-content: center;
}
.detail-overlay.open { display: flex; }
.detail-panel {
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  width: min(820px, calc(100vw - 40px)); max-height: calc(100vh - 60px);
  overflow-y: auto; box-shadow: 0 24px 64px rgba(0,0,0,.6);
}
.detail-top {
  position: sticky; top: 0; background: var(--surface);
  border-bottom: 1px solid var(--border); padding: 16px 20px;
  display: flex; align-items: center; gap: 12px; z-index: 1;
}
.detail-top h3 { font-size: 15px; font-weight: 700; flex: 1; }
.close-btn {
  background: none; border: 1px solid var(--border); color: var(--muted);
  width: 28px; height: 28px; border-radius: 6px; cursor: pointer;
  font-size: 16px; display: flex; align-items: center; justify-content: center; transition: all .15s;
}
.close-btn:hover { border-color: var(--accent); color: var(--text); }
.detail-body { padding: 20px; }
.detail-section { margin-bottom: 20px; }
.detail-section-title { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
.steps { list-style: none; }
.steps li {
  display: flex; gap: 12px; font-size: 12.5px; line-height: 1.6;
  padding: 7px 0; border-bottom: 1px solid var(--border); color: var(--text);
}
.steps li:last-child { border-bottom: none; }
.step-num {
  flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%;
  background: var(--accent); color: #fff; font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; margin-top: 1px;
}
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.list-box { background: var(--surface2); border-radius: 8px; padding: 12px 14px; }
.list-box-title { font-size: 10px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
.list-box ul { list-style: none; }
.list-box li { font-size: 12px; padding: 3px 0; color: var(--muted); border-bottom: 1px solid var(--border); }
.list-box li:last-child { border-bottom: none; }
.list-box li strong { color: var(--text); }
.route-pill { display: inline-block; font-size: 11px; font-weight: 600; font-family: monospace; background: rgba(34,211,238,.1); color: var(--cyan); border-radius: 4px; padding: 1px 6px; }

/* Tag colours */
.tag-blue   { background: rgba(91,138,244,.15); color: #93b4fb; }
.tag-green  { background: rgba(52,211,153,.15); color: #6ee7b7; }
.tag-yellow { background: rgba(251,191,36,.15);  color: #fcd34d; }
.tag-red    { background: rgba(248,113,113,.15); color: #fca5a5; }
.tag-purple { background: rgba(167,139,250,.15); color: #c4b5fd; }
.tag-cyan   { background: rgba(34,211,238,.15);  color: #67e8f9; }
.tag-orange { background: rgba(251,146,60,.15);  color: #fdba74; }
.tag-gray   { background: rgba(100,116,139,.15); color: #94a3b8; }

/* Dot colours for sidebar */
.dot-blue   { background: #5b8af4; }
.dot-green  { background: #34d399; }
.dot-yellow { background: #fbbf24; }
.dot-red    { background: #f87171; }
.dot-purple { background: #a78bfa; }
.dot-cyan   { background: #22d3ee; }
.dot-orange { background: #fb923c; }
.dot-gray   { background: #64748b; }

/* Cards-view extras */
.summary-strip { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
.strip-stat { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 16px; text-align: center; min-width: 80px; }
.strip-stat .val { font-size: 22px; font-weight: 700; color: var(--accent); }
.strip-stat .lbl { font-size: 10px; color: var(--muted); margin-top: 2px; letter-spacing: .04em; }
.section-heading { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
.section-sub { font-size: 12px; color: var(--muted); margin-bottom: 16px; }
.route-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.route-table th { font-size: 10px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--border); }
.route-table td { padding: 7px 10px; border-bottom: 1px solid var(--border); color: var(--text); vertical-align: top; }
.route-table tr:last-child td { border-bottom: none; }
.route-table code { font-family: 'JetBrains Mono', monospace; font-size: 11px; background: var(--surface2); padding: 1px 5px; border-radius: 3px; color: var(--cyan); }

/* Connection line animation */
@keyframes dashFlow { to { stroke-dashoffset: -20; } }
.conn-line {
  fill: none; stroke-width: 1.5; stroke-dasharray: 6 4;
  animation: dashFlow 1s linear infinite;
  opacity: 0; transition: opacity .3s;
}
.conn-line.visible { opacity: 1; }
```

**DO NOT** omit the `.node-user` / `.node-screen` / `.node-provider` / `.node-service` / `.node-db` / `.node-external` type classes or their `.highlighted` variants. These are what make diagram nodes visible and distinguishable. Without them, nodes render as invisible ghost rectangles on the dark background.

**DO NOT** use `repeat(6, 1fr)` for `grid-template-columns`. Use the exact fixed pixel widths shown above (`160px 200px 220px 200px 200px 200px`) for BOTH `.lane-headers` and `.nodes-grid`. This ensures lane headers align perfectly with their columns.

**DO NOT** use a `.hide { display: none !important }` class for view switching. Use the `.view` / `.view.active` pattern shown above.

#### 5C — Complete JavaScript

The `<script>` block MUST contain the following functions in this order. The data structures (`APP_DATA`, `DIAGRAM_NODES`, `FLOW_NODE_MAP`, `FLOW_CONNECTIONS`, `FLOW_COLORS`) come first, then these functions, then the init calls at the very bottom.

**Global state** (declare after data structures):

```js
let currentSection = 'all';
let searchQuery = '';
let activeView = 'cards';
let activeFlowId = null;
const nodeEls = {};
```

**Tag helper** (generate tag HTML from `[label, colorName]` pairs):

```js
function tagHtml(tags) {
  return tags.map(function(t) {
    return '<span class="tag tag-' + t[1] + '">' + t[0] + '</span>';
  }).join('');
}
```

**renderFlows()** — generates the card grid HTML for a filtered list of flows.

**renderRoutes()** — generates the route reference table.

**renderProviders()** — generates the providers/state-managers reference table. MUST reference `APP_DATA.providers` (not `APP_DATA.state_managers`).

**renderServices()** — generates the services reference table.

**renderAll(section, query)** — master render function that switches between flows, routes, providers, and services views. For cards, filters by `section` and `query` on name, summary, route, providers, services, db_tables.

**buildDiagram()** — renders nodes into the 6-column grid and caches DOM refs. MUST:
1. Bucket `DIAGRAM_NODES` into 6 lane arrays
2. Render each lane as `<div class="lane-col">` with nodes inside
3. Each node div MUST have class `"node node-" + n.type` and id `"node-" + n.id`
4. After rendering, cache every element: `nodeEls[n.id] = document.getElementById('node-' + n.id)`
5. Build the right-panel flow list with `id="pflow-" + f.id`

```js
function buildDiagram() {
  var grid = document.getElementById('nodesGrid');
  var lanes = [[], [], [], [], [], []];
  DIAGRAM_NODES.forEach(function(n) { lanes[n.lane].push(n); });

  grid.innerHTML = lanes.map(function(col) {
    return '<div class="lane-col">' +
      col.map(function(n) {
        return '<div class="node node-' + n.type + '" id="node-' + n.id + '" data-nid="' + n.id + '" onclick="nodeClick(\'' + n.id + '\')">' +
          n.label +
          '<div class="node-sub">' + n.sub + '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }).join('');

  DIAGRAM_NODES.forEach(function(n) {
    nodeEls[n.id] = document.getElementById('node-' + n.id);
  });

  var panel = document.getElementById('panelFlows');
  panel.innerHTML = APP_DATA.flows.map(function(f) {
    return '<div class="panel-flow-item" id="pflow-' + f.id + '" onclick="selectFlow(\'' + f.id + '\')">' +
      '<div class="panel-flow-name">' + f.icon + ' ' + f.name + '</div>' +
      '<div class="panel-flow-desc">' + f.summary.substring(0, 70) + '…</div>' +
    '</div>';
  }).join('');
}
```

**getNodeCenter(nid)** — computes pixel centre relative to `#diagramCanvas`:

```js
function getNodeCenter(nid) {
  var el = nodeEls[nid];
  if (!el) return null;
  var canvas = document.getElementById('diagramCanvas');
  var canvasRect = canvas.getBoundingClientRect();
  var elRect = el.getBoundingClientRect();
  return {
    x: elRect.left - canvasRect.left + elRect.width / 2,
    y: elRect.top  - canvasRect.top  + elRect.height / 2
  };
}
```

**drawConnections(flowId)** — clears SVG, resizes, draws animated bezier paths with arrowhead markers:

```js
function drawConnections(flowId) {
  var svg = document.getElementById('connectionSvg');
  var canvas = document.getElementById('diagramCanvas');
  svg.setAttribute('width', canvas.scrollWidth);
  svg.setAttribute('height', canvas.scrollHeight);
  svg.innerHTML = '';
  if (!flowId) return;

  var pairs = FLOW_CONNECTIONS[flowId] || [];
  var color = FLOW_COLORS[flowId] || '#5b8af4';

  pairs.forEach(function(pair) {
    var fromId = pair[0], toId = pair[1];
    var a = getNodeCenter(fromId);
    var b = getNodeCenter(toId);
    if (!a || !b) return;

    var dx = b.x - a.x;
    var cx1 = a.x + dx * 0.5, cy1 = a.y;
    var cx2 = b.x - dx * 0.5, cy2 = b.y;

    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M' + a.x + ',' + a.y + ' C' + cx1 + ',' + cy1 + ' ' + cx2 + ',' + cy2 + ' ' + b.x + ',' + b.y);
    path.setAttribute('class', 'conn-line visible');
    path.setAttribute('stroke', color);

    var markerId = ('arrow-' + fromId + '-' + toId).replace(/[^a-zA-Z0-9-]/g, '_');
    var defs = svg.querySelector('defs');
    if (!defs) { defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); svg.appendChild(defs); }
    var marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', markerId);
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('refX', '5');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    var arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrow.setAttribute('d', 'M0,0 L6,3 L0,6 Z');
    arrow.setAttribute('fill', color);
    arrow.setAttribute('opacity', '0.8');
    marker.appendChild(arrow);
    defs.appendChild(marker);

    path.setAttribute('marker-end', 'url(#' + markerId + ')');
    svg.appendChild(path);
  });
}
```

**selectFlow(id)** — toggles flow highlight, dims non-participating nodes, draws connections:

```js
function selectFlow(id) {
  activeFlowId = (activeFlowId === id) ? null : id;

  document.querySelectorAll('.panel-flow-item').forEach(function(el) { el.classList.remove('active'); });
  if (activeFlowId) {
    var el = document.getElementById('pflow-' + activeFlowId);
    if (el) el.classList.add('active');
  }

  var activeNodes = activeFlowId ? new Set(FLOW_NODE_MAP[activeFlowId] || []) : null;
  DIAGRAM_NODES.forEach(function(n) {
    var el = nodeEls[n.id];
    if (!el) return;
    el.classList.remove('highlighted', 'dimmed');
    if (activeNodes) {
      if (activeNodes.has(n.id)) el.classList.add('highlighted');
      else el.classList.add('dimmed');
    }
  });

  var stepsPanel = document.getElementById('panelSteps');
  var stepsList = document.getElementById('panelStepsList');
  if (activeFlowId) {
    var flow = APP_DATA.flows.find(function(f) { return f.id === activeFlowId; });
    stepsList.innerHTML = flow.steps.map(function(s, i) {
      return '<div class="panel-step"><div class="panel-step-n">' + (i + 1) + '</div><div>' + s + '</div></div>';
    }).join('');
    stepsPanel.style.display = 'block';
  } else {
    stepsPanel.style.display = 'none';
  }

  drawConnections(activeFlowId);
}
```

**clearFlowSelection():**

```js
function clearFlowSelection() {
  selectFlow(null);
  activeFlowId = null;
}
```

**nodeClick(nid):**

```js
function nodeClick(nid) {
  var matchFlows = Object.entries(FLOW_NODE_MAP).filter(function(entry) { return entry[1].includes(nid); });
  if (matchFlows.length === 0) return;
  if (activeFlowId && FLOW_NODE_MAP[activeFlowId] && FLOW_NODE_MAP[activeFlowId].includes(nid)) {
    openDetail(activeFlowId);
    return;
  }
  selectFlow(matchFlows[0][0]);
}
```

**openDetail(id)** — opens the detail modal. MUST reference `f.providers` (not `f.state_managers`):

```js
function openDetail(id) {
  var f = APP_DATA.flows.find(function(x) { return x.id === id; });
  if (!f) return;
  document.getElementById('detailIcon').textContent = f.icon;
  document.getElementById('detailTitle').textContent = f.name;

  var steps = f.steps.map(function(s, i) {
    return '<li><span class="step-num">' + (i + 1) + '</span><span>' + s + '</span></li>';
  }).join('');
  var providers = f.providers.length
    ? '<ul>' + f.providers.map(function(p) { return '<li><strong>' + p + '</strong></li>'; }).join('') + '</ul>'
    : '<p style="color:var(--muted);font-size:12px">None</p>';
  var services = f.services.length
    ? '<ul>' + f.services.map(function(s) { return '<li><strong>' + s + '</strong></li>'; }).join('') + '</ul>'
    : '<p style="color:var(--muted);font-size:12px">None</p>';
  var tables = f.db_tables.length
    ? '<ul>' + f.db_tables.map(function(t) { return '<li><strong>' + t + '</strong></li>'; }).join('') + '</ul>'
    : '<p style="color:var(--muted);font-size:12px">None</p>';

  document.getElementById('detailBody').innerHTML =
    '<div class="detail-section"><div class="detail-section-title">Entry / Exit</div>' +
    '<div style="display:flex;gap:16px;font-size:12px"><div><span style="color:var(--muted)">Entry: </span>' + f.entry + '</div>' +
    '<div><span style="color:var(--muted)">Exit: </span>' + f.exit + '</div></div></div>' +
    '<div class="detail-section"><div class="detail-section-title">Route</div><span class="route-pill">' + f.route + '</span></div>' +
    '<div class="detail-section"><div class="detail-section-title">Summary</div><p style="font-size:12.5px;line-height:1.7;color:var(--muted)">' + f.summary + '</p></div>' +
    '<div class="detail-section"><div class="detail-section-title">Steps</div><ul class="steps">' + steps + '</ul></div>' +
    '<div class="two-col" style="margin-bottom:16px">' +
    '<div class="list-box"><div class="list-box-title">Providers</div>' + providers + '</div>' +
    '<div class="list-box"><div class="list-box-title">Services</div>' + services + '</div></div>' +
    '<div class="list-box" style="margin-bottom:16px"><div class="list-box-title">Database Tables</div>' + tables + '</div>' +
    '<div><div class="detail-section-title">Tags</div><div class="card-tags">' + tagHtml(f.tags) + '</div></div>';

  document.getElementById('detailOverlay').classList.add('open');
}
```

**closeDetail / closeDetailBtn / Escape handler:**

```js
function closeDetail(e) {
  if (e.target === document.getElementById('detailOverlay')) closeDetailBtn();
}
function closeDetailBtn() {
  document.getElementById('detailOverlay').classList.remove('open');
}
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeDetailBtn(); });
```

**filterSection / handleSearch / switchView:**

```js
function filterSection(section, el) {
  currentSection = section;
  searchQuery = '';
  document.getElementById('searchBox').value = '';
  document.querySelectorAll('.sidebar-item').forEach(function(x) { x.classList.remove('active'); });
  el.classList.add('active');
  renderAll(section, '');
  if (activeView !== 'cards') {
    switchView('cards', document.querySelector('.view-tab'));
  }
}

function handleSearch(val) {
  searchQuery = val.trim();
  renderAll(currentSection, searchQuery);
}

function switchView(view, tabEl) {
  document.querySelectorAll('.view-tab').forEach(function(t) { t.classList.remove('active'); });
  tabEl.classList.add('active');
  document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
  document.getElementById('view-' + view).classList.add('active');
  activeView = view;
  if (view === 'diagram') {
    setTimeout(function() { drawConnections(activeFlowId); }, 50);
  }
}
```

**INIT — the very last lines in the script block:**

```js
renderAll('all', '');
buildDiagram();

window.addEventListener('resize', function() {
  if (activeView === 'diagram') drawConnections(activeFlowId);
});
document.getElementById('diagramWrap').addEventListener('scroll', function() {
  drawConnections(activeFlowId);
});
```

**CRITICAL — `buildDiagram()` MUST be called at page load**, not deferred to the first view switch. Calling it only when the diagram tab is clicked causes `getBoundingClientRect()` to return zero-height values because the browser hasn't completed layout of the newly-visible container. Building the nodes on init (while the view is hidden) ensures they have stable DOM positions when the user first switches to the diagram.

---

### Step 6 — Behaviour requirements

- `Escape` key closes the detail modal
- Search filters the cards view in real-time; sidebar section filters switch back to cards view automatically
- `switchView(view, tabEl)` — toggles between cards and diagram views, redraws connections when switching to diagram with `setTimeout` (Step 5C)
- `selectFlow(id)` — toggles flow highlight; calling with same id deselects
- `clearFlowSelection()` — calls `selectFlow(null)` and resets `activeFlowId = null`
- `drawConnections(flowId)` — clears SVG, sizes it to canvas, draws animated bezier paths with arrowhead markers for all edge pairs of the active flow
- `buildDiagram()` — renders all nodes into a 6-column grid, caches DOM refs in `nodeEls`, and populates the flow panel. **Called once at page load.**
- Connections redraw on `diagramWrap` scroll and `window` resize events

---

### Step 7 — Stack detection guidance

When exploring the codebase, auto-detect the technology stack and adapt terminology accordingly. Use these heuristics:

| Signal File                | Stack / Framework         | UI Layer Term       | State Term            | Route Term          |
|---------------------------|---------------------------|---------------------|-----------------------|---------------------|
| `pubspec.yaml`            | Flutter / Dart            | Screens / Widgets   | Providers / Blocs     | Routes (GoRouter)   |
| `package.json` + React    | React / Next.js           | Pages / Components  | Stores / Context      | Routes              |
| `package.json` + Vue      | Vue / Nuxt                | Views / Components  | Stores (Pinia/Vuex)   | Routes              |
| `package.json` + Angular  | Angular                   | Components          | Services / NgRx       | Routes              |
| `pom.xml` or `build.gradle`| Spring Boot / Java       | Controllers / Views | Beans / Services      | Endpoints           |
| `*.csproj`                | ASP.NET / C#              | Pages / Views       | Services / DI         | Endpoints / Routes  |
| `requirements.txt` / `pyproject.toml` | Django / FastAPI / Flask | Views / Templates | Services / Managers | URL Patterns / Routes |
| `go.mod`                  | Go                        | Handlers / Templates| Services              | Routes / Mux        |
| `Cargo.toml`              | Rust                      | Handlers            | State / Services      | Routes              |
| `Gemfile`                 | Rails / Ruby              | Views / Controllers | Models / Services     | Routes              |
| `Package.swift`           | Swift / SwiftUI           | Views               | ObservableObjects     | Navigation          |
| `*.xcodeproj`             | iOS (UIKit / SwiftUI)     | ViewControllers / Views | ViewModels        | Navigation / Routes |
| `build.gradle` + Kotlin   | Android / Kotlin          | Activities / Fragments / Composables | ViewModels | Navigation          |

Use the detected terms consistently in lane header labels, legend text, sidebar labels, and reference table headings. Regardless of what the detected stack calls its state managers (providers, stores, reducers, view-models, beans), the JavaScript property name in `APP_DATA` MUST always be `providers` for code compatibility.

---

### Step 8 — Pre-output checklist

Before writing the final HTML, verify ALL of these invariants. A failure on any single one produces a broken output file:

1. **Every flow has connection data.** For each `f` in `APP_DATA.flows`, confirm `FLOW_NODE_MAP[f.id]`, `FLOW_CONNECTIONS[f.id]`, and `FLOW_COLORS[f.id]` all exist and are non-empty.
2. **Every node ID is consistent.** Every ID referenced in `FLOW_NODE_MAP` and `FLOW_CONNECTIONS` exists in the `DIAGRAM_NODES` array.
3. **No orphan edges.** Every `[fromId, toId]` pair in `FLOW_CONNECTIONS` uses IDs present in the corresponding `FLOW_NODE_MAP` entry for that flow.
4. **SVG is inside diagramCanvas.** The `<svg id="connectionSvg">` tag is a direct child of `<div id="diagramCanvas">`, not `#diagramWrap` or `body`.
5. **nodeEls is populated.** `buildDiagram()` caches every node's DOM element in `nodeEls` after rendering.
6. **getNodeCenter() uses getBoundingClientRect().** Not `offsetLeft`/`offsetTop`.
7. **drawConnections() uses createElementNS.** Not `innerHTML +=` for SVG elements.
8. **switchView() uses setTimeout.** Deferred redraw ensures the diagram is visible before measuring positions.
9. **Both scroll and resize listeners exist.** `diagramWrap` scroll + `window` resize both call `drawConnections(activeFlowId)`.
10. **buildDiagram() is called at page load.** The init block at the bottom of the script calls BOTH `renderAll('all', '')` AND `buildDiagram()`. NOT inside `switchView()`. NOT inside `DOMContentLoaded`.
11. **Every DIAGRAM_NODES entry has a `type` property.** One of: `"user"`, `"screen"`, `"provider"`, `"service"`, `"db"`, `"external"`. This drives the `node-${type}` CSS class.
12. **buildDiagram applies `node-${type}` class.** Each node div uses `class="node node-" + n.type`. NOT just `class="node"`.
13. **Node type CSS classes are present.** The stylesheet includes `.node-user`, `.node-screen`, `.node-provider`, `.node-service`, `.node-db`, `.node-external` with visible border colours, text colours, and backgrounds at 7% opacity. Plus all six `.highlighted` variants.
14. **Lane headers and nodes-grid use matching fixed-width columns.** Both use `grid-template-columns: 160px 200px 220px 200px 200px 200px`. NOT `repeat(6, 1fr)`.
15. **View switching uses `.view` / `.view.active`.** NOT a `.hide` class with `display: none !important`.
16. **Flow property is called `providers`.** Both `f.providers` on each flow object AND `APP_DATA.providers` at the top level. NOT `state_managers`.
17. **Lane headers are a separate row.** `<div class="lane-headers">` is a direct child of `#diagramCanvas`, NOT embedded inside each `.lane-col`.
18. **selectFlow uses CSS classes for highlighting.** `el.classList.add('highlighted')` / `el.classList.add('dimmed')`. NOT `el.style.boxShadow` or `el.style.opacity`.
19. **openDetail references `f.providers`.** NOT `f.state_managers`.
20. **renderAll search references `f.providers`.** NOT `f.state_managers`.

---

Output only the complete HTML file. Name it `<project-directory-name>-flows.html` as specified above.
