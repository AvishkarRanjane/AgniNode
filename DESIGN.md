# AgniNode — Design System & Visual Specification (DESIGN.md)

**Product:** AgniNode — Next-Gen IoT Dual-MCU Smart Arc-Fault, Shock & Fire Prevention System  
**Version:** 3.2.0  
**Design Philosophy:** Industrial Safety Red & Pure White Theme with Apple-Inspired Prognostic Glassmorphism  
**Target Platform:** Web (Desktop, Tablet, Mobile) & Embedded Touch Control Panels  

---

## 1. Executive Summary & Design Vision

AgniNode is an enterprise-grade IoT fire and electrical fault mitigation ecosystem. The design language marries **high-visibility industrial safety equipment** (reminiscent of pressurized fire extinguishers and critical power breaker stations) with **Apple-inspired predictive health intelligence** (frosted glassmorphic panels, glowing concentric health rings, and proactive time-series forecast cones).

### Core Pillars
1. **High-Contrast Safety Urgency:** Immediate, unambiguous visual cues for Normal, Warning, Trip, and Alarm states.
2. **Apple-Inspired Prognostics:** Rather than merely reacting to hardware trips after damage occurs, the interface surfaces continuous time-series forecasts (predicting arc faults and dielectric breakdown minutes or hours before failure).
3. **Engineering Rigor:** Real-time 60 FPS CRT-style AC oscilloscope waveforms with physical division graticules and precision monospace telemetry.
4. **Zero-Gimmick Professionalism:** 100% standardized SVG vector icons with zero emojis, ensuring compliance with mission-critical control room standards.

---

## 2. Color Palette & Design Tokens

The palette is anchored by high-visibility **Safety Fire Red**, **Pure White**, and deep obsidian **Atmospheric Glass**.

### 2.1 Brand & Emergency Accent Colors
| Token Name | Hex Code | Semantic Role |
| :--- | :--- | :--- |
| `--fire-red` | `#e50914` | Primary brand color, hardware trip indicator, critical emergency alerts |
| `--fire-bright` | `#ff1e2d` | High-frequency noise bursts, active fault waveforms, active alarm sirens |
| `--fire-dark` | `#b7094c` | Gradient backdrops, secondary danger headers, deep glow accents |
| `--white-pure` | `#ffffff` | Primary text headings, active gauges, high-contrast action buttons |
| `--white-soft` | `#f8fafc` | Sub-headings, secondary metrics, active badge text |
| `--white-muted` | `#cbd5e1` | Monospace telemetry captions, secondary sensor labels |

### 2.2 Neutral & Surface Backgrounds (Dark Mode Exclusive)
| Token Name | Value | Semantic Role |
| :--- | :--- | :--- |
| `--bg` | `#070203` | Base viewport background, ultra-deep obsidian black with subtle warm tint |
| `--bg-deep` | `#0c0406` | Oscilloscope canvas background, CRT CRT graticule field |
| `--panel` | `rgba(18, 6, 9, 0.85)` | Primary card glass with `backdrop-filter: blur(28px) saturate(180%)` |
| `--panel-elevated` | `rgba(28, 8, 12, 0.90)` | Floating modals, predictive prognostic center, active dropdowns |
| `--line` | `rgba(255, 255, 255, 0.08)` | Subtle translucent separator borders and card perimeter strokes |
| `--line-bright` | `rgba(229, 9, 20, 0.35)` | Accent card borders, active test bench indicators |

### 2.3 Sensor Channel Colors (Oscilloscope & Charts)
| Signal Channel | Hex Code | Visual Styling |
| :--- | :--- | :--- |
| **AC Line Voltage (V)** | `#38bdf8` | Vibrant Sky Cyan, 2.2px line with 8px blur shadow glow |
| **Phase Current (IL)** | `#ffffff` | Crisp Pure White (turns `#ff4d5a` on series/parallel arc flashover) |
| **Neutral Current (IN)** | `rgba(255, 255, 255, 0.65)` | Translucent White with 3x3 dashed phase line |
| **Residual Leakage (IΔn)** | `#ff1e2d` | Coral Red vector differential, 3.0px width with 12px outer glow |
| **Historical Telemetry** | `#34d399` | Emerald Green historical trendline |
| **Projected Forecast Cone** | `#f59e0b` / `#f97316` | Amber/Orange dashed projection line with translucent gradient fill |
| **Hardware Trip Limit Line** | `#e50914` | Crimson Red dashed threshold limit (65 dB for AFDD, 30 mA for RCCB) |

---

## 3. Typography Hierarchy

AgniNode utilizes a tripartite typographic scale optimized for rapid glanceability under high-stress conditions.

### 3.1 Font Families
* **Display / Brand Headings:** `'Outfit', system-ui, -apple-system, sans-serif`
  - *Weights:* 700 (Bold), 800 (ExtraBold), 900 (Black)
  - *Character:* Clean geometric letterforms with strong architectural presence.
* **UI & Body Prose:** `'Plus Jakarta Sans', system-ui, -apple-system, sans-serif`
  - *Weights:* 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)
  - *Character:* Humanist sans-serif with high legibility at micro-sizes.
* **Telemetry, Metrics & CRT Scope:** `'JetBrains Mono', 'SF Mono', monospace`
  - *Weights:* 500 (Medium), 600 (SemiBold), 700 (Bold)
  - *Character:* Tabular alignment ensuring numbers never jitter or shift column positions.

### 3.2 Type Scale
| Level | Font Family | Size | Weight | Line Height | Letter Spacing |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Title** | Outfit | 36px - 44px | 900 | 1.1 | -0.03em |
| **Banner Alarm Header** | Outfit | 28px - 32px | 900 | 1.15 | -0.02em |
| **Section Header (H2)** | Plus Jakarta Sans | 20px - 22px | 800 | 1.25 | -0.02em |
| **Card Title (H3/H4)** | Plus Jakarta Sans | 14px - 16px | 700 | 1.3 | -0.01em |
| **Sensor KPI Value** | JetBrains Mono | 28px - 34px | 800 | 1.0 | -0.02em |
| **Body Text** | Plus Jakarta Sans | 13px - 14px | 500 | 1.45 | normal |
| **Micro Caption / Labels** | Plus Jakarta Sans | 10px - 11px | 600 | 1.3 | 0.05em (Caps) |
| **Engineering Monospace** | JetBrains Mono | 10px - 12px | 600 | 1.2 | 0.02em |

---

## 4. Glassmorphism, Elevation & Border Radius Tokens

### 4.1 Corner Radii
* **Pills & Badges:** `9999px` (fully rounded capsule)
* **Buttons & Inputs:** `8px`
* **Dropdowns & Segmented Controls:** `10px`
* **KPI Telemetry Cards:** `14px`
* **CRT Oscilloscope & Chart Cards:** `16px`
* **Prognostic Analytics Panel:** `18px - 20px`

### 4.2 Elevation & Glassmorphism Spec
```css
/* Primary Glass Panel */
background: rgba(18, 6, 9, 0.85) !important;
backdrop-filter: blur(28px) saturate(180%);
-webkit-backdrop-filter: blur(28px) saturate(180%);
border: 1px solid rgba(229, 9, 20, 0.28) !important;
box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
```

---

## 5. Key Interface Components & UX Patterns

### 5.1 Atmospheric Fire Emergency Banner (`#banner`)
* **Normal State:** Deep burgundy-to-black gradient (`linear-gradient(90deg, #b7094c 0%, rgba(20, 5, 8, 0.95) 100%)`).
* **Warning State:** High-contrast amber-crimson gradient.
* **Alarm State:** Urgent pulsating safety red (`linear-gradient(90deg, #ff0033 0%, #e50914 100%)`), text blinking animation at 1.2s intervals.
* **Embedded Actions:**
  - `Trigger Panel Alarm` / `Silence Hardware Alarm` button with high-contrast inverted white-on-red styling.
  - `Sound On` / `Muted` audible siren control button with live soundwave icon.
  - `Acknowledge alarm` operator action button.

### 5.2 Real-Time 60 FPS CRT AC Oscilloscope (`#scopeCanvas`)
* **Canvas Styling:** CRT curvature, subtle scanline effect, and internal division graticules (`10x8` division matrix).
* **Live Traces:**
  - AC Voltage sinusoid (3 full cycles, 50.0 Hz line wave, sky cyan).
  - Current waveform with dynamic series arc zero-crossing dwell shoulders and parallel arc sags.
  - Residual leakage vector imbalance trace.
* **Heads-Up Annotations:** Monospace timestamp, timebase (5.0 ms/div), voltage/current scaling, and live FPS counter.

### 5.3 Fault Progression Sequence Visualizer (Apple-Inspired Timeline)
* **Stage 1 (Nominal Baseline):** Clean 50 Hz sine, HF < 15 dB, Insulation > 45 MΩ (Emerald Green `#10b981`).
* **Stage 2 (Micro-Thermal Creep):** Terminal vibration looseness, contact resistance creep (Sky Cyan `#38bdf8`).
* **Stage 3 (Sub-Cycle Sparking):** HF noise bursts 35-50 dB, leakage drift (Amber `#f59e0b`).
* **Stage 4 (Shoulder Widening):** Severe ionization, flat shoulders >0.8 ms (Orange `#f97316`).
* **Stage 5 (Imminent Flashover):** Breached threshold, trip < 40 ms (Fire Red `#e50914` with pulsing glow).

### 5.4 Apple Health Rings (Circular SVG Gauges)
* **Contact Connection Health Ring:** Circular SVG gauge tracking vibration looseness & terminal torque.
* **Dielectric Insulation Health Ring:** Circular SVG gauge tracking cable degradation & moisture ingress.
* **Stroke Transition:** `stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)`.

### 5.5 Dual Time-Series Forecast Cones
* **AFDD Predictive Cone:** Historical HF noise transitioning into a 15m / 1h / 4h projected trajectory cone against the IEC 62606 65 dB trip line.
* **RCCB Predictive Cone:** Residual leakage drift rate transitioning into a projected line against the 30 mA shock boundary.

---

## 6. Iconography & Vector Assets Standards

* **Icon System:** Standardized SVG vector paths (Feather / Lucide style).
* **Rule:** **Strictly ZERO Emojis.** All indicators must use industrial-grade vector glyphs.
* **Stroke Width:** Uniform `2.0px` to `2.4px`.
* **Cap / Join:** `stroke-linecap="round"` and `stroke-linejoin="round"`.
* **Sizing:** `13px` - `14px` for inline buttons, `16px` for headers, `20px` - `24px` for KPI badges.

---

## 7. Responsive Breakpoints

| Breakpoint Name | Viewport Width | Layout Behavior |
| :--- | :--- | :--- |
| **Desktop Ultra** | `>= 1440px` | 4-column KPI grid, dual forecast charts side-by-side |
| **Desktop Standard**| `1024px - 1439px` | 4-column KPI grid, 2-column prognostic split |
| **Tablet** | `768px - 1023px` | 2-column KPI grid, sequence visualizer wraps vertically |
| **Mobile** | `< 768px` | Single-column stacked cards, full-width touch targets |

---

## 8. Deployment & Repository Links

* **Live Web Application:** `https://agninode-e0242.web.app`
* **Real-time Dashboard:** `https://agninode-e0242.web.app/dashboard`
* **Public GitHub Repository:** `https://github.com/AvishkarRanjane/AgniNode`
* **Technology Stack:** HTML5, CSS3, JavaScript (ES6+), Firebase Firestore & Hosting, Chart.js, HTML5 Web Audio API.
