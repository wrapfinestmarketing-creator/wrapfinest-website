# WrapFinest — Creative Brief & Build Spec

> Status: **DRAFT — awaiting owner approval.** This is the single source of truth for the build.
> Nothing in the site may contradict the facts in §3. Anything not listed here is not claimed.

---

## 1. The idea

**"Armor, engineered for the Philippine road."**

The site is one continuous, scroll-driven film. A **Tesla Model YL** sits in a dark studio under
WrapFinest's signature **hexagon light ceiling**. As the visitor scrolls, we *install the products
on the car in front of them*: clear film flows over the body, rain beads off the ceramic top coat,
the finish changes on demand, the windows darken as you drag the tint slider, and stones bounce off a
Thermoshield-armored windshield and roof.

The visitor doesn't read about protection — they watch it happen, then book.

**Award-level qualities we are aiming for (Awwwards / FWA / CSS Design Awards criteria):**
design, usability, creativity, content — plus performance on mid-range Android phones.

---

## 2. Brand system

### Colors
| Token | Hex | Use |
|---|---|---|
| `--carbon` | `#0A0B0D` | Page background |
| `--graphite` | `#16181C` | Cards, panels |
| `--charcoal` | `#2F302F` | Logo charcoal, borders |
| `--wf-orange` | `#EF4523` | Logo orange — primary accent, CTAs, film edge glow |
| `--ember` | `#FF6A3D` | Hover / glow states only |
| `--ceramic` | `#F2F2F0` | Primary text |
| `--steel` | `#8A8F98` | Secondary text, spec labels |
| `--f1-red` | `#E10600` | **Only** on F1 Auto Films marks / distributor badge |
| `--heat` → `--cool` | `#FF3B1F` → `#3FA9FF` | Heat-rejection visualisations only |

Visual motifs taken from the real shop: **hexagon light grid**, **orange/charcoal checker floor**,
**light-tunnel bay**. These become the site's patterns, transitions, and loaders.

### Typography (Google Fonts, free)
- **Display:** *Unbounded* (wide, geometric — echoes the italic-wide WRAPFINEST wordmark), uppercase, tight tracking.
- **Body:** *Manrope*.
- **Spec readouts / numbers:** *JetBrains Mono* (instrument-panel feel for VLT, IRR, GU, mil).

### Logo
Vector SVG extracted from `logo assets.ai`. Preloader draws the **WF** mark as a stroke, then fills
orange — a "film being laid down" reveal.

### Voice
Confident, technical, short sentences. English. Numbers over adjectives.
Philippine context everywhere: monsoon, acid rain, UV index 8–11, 60–70 °C cabins, NLEX/SCTEX gravel.

---

## 3. Approved facts (do not invent beyond these)

### Business
- **WrapFinest** — Blk 11 Lot 17, WrapFinest Building, Friendship Hiway, Brgy. Calibutbut, Bacolor, Pampanga
- Phone / Viber: **0998 564 0802** · Email: **wrapfinestpampanga@gmail.com**
- Open **every day, 9:00 AM – 6:00 PM**
- Map: https://maps.app.goo.gl/krx5VT7D8T2r8pCt9 · Facebook / Messenger: facebook.com/wrapfinestpampanga
- **Official Distributor of F1 Auto Films — Central Luzon** (f1autofilms.com)
- **1,000+ cars protected** · Highly skilled, trained technicians
- Featured work (real WrapFinest jobs): Mustang Dark Horse, Challenger SRT Hellcat Redeye, Corvette C8, Tesla Model 3 Performance, BYD, Xpeng, Shelby GT500, Maserati, Land Cruiser, BRZ, Range Rover, and more.

### Starting prices (always "Starts at"; final quote depends on vehicle size)
| Service | Starts at |
|---|---|
| Premium PPF | ₱100,000 |
| Full color change (wrap / colored PPF) | ₱75,000 |
| Nano ceramic tint | ₱9,000 |
| Thermoshield X | ₱20,000 |

⚠️ **Never** show F1 dealer/roll pricing from the distributor deck.

### Paint Protection Film (all PPF: built-in ceramic top coat → hydrophobic, low maintenance, durable, made for PH weather)
**F1 Apex Ultra — PCU (hero product)**
- Aliphatic Polycarbonate Polyurethane (PCU) — next generation beyond standard TPU
- Gauges **7.5 mil (Apex 75 Ultra)** & **8.5 mil (Apex 85 Ultra)**
- **>100 gloss units** @60° · **95.4% UV rejection** · **2,000 h QUV** weathering, ΔE\*ab < 2
- **23.33 MPa** tensile (+46% vs spec) · **385%** elongation · **3,120 gf/in** cured adhesion (>3× spec)
- **100% heat-activated self-healing** of fine scratches
- Hydrolytic stability: **no milky haze in rainy season**, resists acid-rain etching & water spots
- **12-year material integrity warranty**
- PCU vs TPU comparison: water spots / piercing / surface hardness / humid clarity (from deck p.4)

**F1 Apex Satin** — satin (matte) PPF, 190 microns, self-healing, **8-year warranty**
**F1 Onyx** — gloss black PPF, same gloss level & anti-yellowing as Apex 75/85, **10-year warranty**
**HyperPro UltraShield (KK Vinyl USA)** — colored PPF for color change with protection
**KK Vinyl USA** — vinyl for full color-change wraps
Messaging: *WrapFinest's colored PPF and F1 Apex Ultra are made for Philippine weather.*

### Nano Ceramic Tint — F1 Nitro
- **9-layer** nano ceramic construction: scratch-resistant coat · multi-layer element · nano ceramic · glare reduction · IR rejection · UV rejection · nano ceramic · PET polyester · mounting adhesive
- Zero signal loss · RFID friendly · **10-year warranty**

| Product | Shade | VLT | IRR | UVR | TSER |
|---|---|---|---|---|---|
| Nitro SD5 | Super Dark | 5% | 99% | 99% | 97.2% |
| Nitro VD10 | Very Dark | 14% | 99% | 99% | 93.1% |
| Nitro MD20 | Medium Dark | 23% | 98% | 99% | 89.3% |
| Nitro M35 | Medium | 36% | 99% | 99% | 83.6% |
| Nitro LM40 | Light Medium | 41% | 99% | 99% | 81.6% |
| Nitro L50 | Light | 45% | 99% | 99% | 79.6% |
| Nitro VL60 | Very Light | 62% | 99% | 99% | 72.2% |
| Nitro Artic70 | Clear Blue | 76% | 98% | 99% | 65.5% |

(Do not show Sprint or Graphite.)

### Glass Protection — F1 Thermoshield X
- **First in the Philippines to combine glass protection, anti-theft, and heat-rejecting tint in one film**
- Installed on the **outside** of the glass — stops heat before it enters the glass
- **5 mil / 127 µm EPU** · **up to 98% IR** · **up to 99.9% UV** · zero signal loss · RFID friendly
- Road debris & stone-chip defense (324.5% elongation) · self-healing wiper micro-scratches
- Anti-theft / smash-and-grab resistance (~4,270 PSI), holds shattered glass together
- Acoustic glass damping (constrained-layer damping) — quieter cabin
- **Cold, water-based install — no heat gun.** Safe for panoramic / sunroof glass on EVs (Tesla, BYD), where heat-gun tinting risks cracking the glass
- Shades: Clear Blue · Light Medium · Medium Dark
- Warranty: **2 years windshield · 6 years all other panels**

### Coating — Ronin Vision ceramic coating, 5 years

---

## 4. Site structure — one scroll film + quote

| # | Chapter | What happens (scroll-scrubbed unless noted) |
|---|---|---|
| 0 | **Preloader** | WF mark draws in orange stroke; hex grid lights up cell by cell as assets load. |
| 1 | **Hero** | Model YL in the hexagon studio, slow orbit, light sweeps across the paint following the cursor (gyro on phones). Headline: *ARMOR, ENGINEERED FOR THE PHILIPPINE ROAD.* CTAs: **Get a Quote** · **Watch it protect ↓**. Badge: Official F1 Auto Films Distributor — Central Luzon. |
| 2 | **01 · Paint Protection Film** | Scroll lays transparent film panels onto hood → fenders → doors → bumpers; edges glow WF-orange then seal. A stone strikes the hood: ripple, no chip. A key scratch appears, heat shimmer, it **self-heals**. Counters tick: 7.5/8.5 mil · >100 GU · 385% stretch · 12 yrs. Toggle **PCU vs TPU**. |
| 3 | **02 · Built-in Ceramic Top Coat** | Monsoon arrives: rain falls on the car, water **beads and rolls off** (custom shader). Copy: acid rain, water spots, haze-free in rainy season. Uses the real rainy-Mustang footage as a transition. |
| 4 | **03 · Finish Studio** (interactive) | Live configurator on the 3D car: **Ultra Gloss (Apex Ultra) · Satin (Apex Satin) · Gloss Black (Onyx) · Colors (HyperPro / KK Vinyl swatches)**. Material swaps with a "film wipe" transition. Button: *Quote this finish* (pre-fills form). |
| 5 | **04 · Nitro Ceramic Tint** (interactive) | Camera moves to side glass. Drag the slider SD5 → Artic70: glass darkens live, readouts animate VLT / IRR / UVR / TSER from §3 table, a cabin-heat bar cools. Below: the **9-layer stack** explodes apart on scroll with labels. |
| 6 | **05 · Thermoshield X** | Camera rises to windshield and panoramic roof. (a) **Stone chips** fly at the windshield in slow motion and bounce off. (b) **Debris falls** on the glass roof; film holds. (c) **Sun rays** hit the roof — 98% IR reflected back out (heat → cool color). (d) Split screen: *heat-gun tint → glass crack* vs *Thermoshield cold wet install → safe*. (e) Smash-and-grab: hammer hit, glass cracks but stays in place. Claim + shades + 2/6-yr warranty. |
| 7 | **Ronin Vision Coating** | Compact section: 5-year ceramic coating, gloss macro shot. |
| 8 | **The Work** | Drag/scroll horizontal gallery of real jobs inside hexagon masks; hover reveals car + products used. Full-screen play of the WrapFinest compilation reel (XPEL/Avery Dennison shots removed). |
| 9 | **Clients Speak** | 4–5 short UGC testimony clips (10–20 s each, subtitled) as vertical cards. |
| 10 | **Pricing** | Four "Starts at" cards; hover flips to "what's included / warranty". |
| 11 | **The Studio** | Shop exterior + hex bay footage, address, hours, map button, Messenger, call. |
| 12 | **Get a Quote** | Form: name, mobile, email, car make/model/year, services (multi), finish/tint shade (pre-filled from configurator/slider), preferred date, message. Sends to wrapfinestpampanga@gmail.com. Plus **Message us on Messenger** and **Call** buttons. |
| — | **Footer** | Logo, contact, F1 distributor badge, socials, © WrapFinest. |

Persistent UI: minimal top bar (logo · chapters · **Get a Quote**), chapter progress rail on the right
(hexagon dots), floating Messenger button on mobile.

---

## 5. Technical plan

- **Stack:** Vite + Three.js (WebGL) + GSAP ScrollTrigger + Lenis smooth scroll. Plain HTML/CSS/JS output — no server needed.
- **Hosting:** GitHub Pages, built and deployed by GitHub Actions on every push to `main`.
- **3D car:** Tesla Model YL, `.glb`, Draco/Meshopt compressed, target **≤ 8 MB**. No Tesla badge/logo on the model, and no copy implying Tesla endorsement. Separate meshes for body panels, windshield, roof glass, side glass, wheels so each chapter can target them.
- **Effects:** custom shaders for film sheen, water beading, heat/IR visualisation, glass crack; particles for stones/debris/rain.
- **Video:** compilation & UGC re-encoded (H.264 + WebM), 720p/1080p, short loops ≤ 6 MB each, lazy-loaded.
- **Form:** FormSubmit.co → wrapfinestpampanga@gmail.com (owner clicks one confirmation email on first submission). Honeypot anti-spam.
- **Performance budget:** first meaningful paint < 2.5 s on 4G; total initial JS < 300 KB gz; 3D loads progressively behind the preloader.
- **Mobile:** same story, lighter model/effects, gyro-driven light; 60 fps target on mid-range Android.
- **Accessibility:** `prefers-reduced-motion` → static frames + short videos instead of scroll animation; keyboard-operable configurator and slider; real text (not images) for all specs; color contrast AA.
- **SEO:** title/description, Open Graph share image, LocalBusiness (AutoBodyShop) schema with address/hours/phone, `sitemap.xml`.

---

## 6. Assets to generate in Higgsfield

| Asset | Type | Purpose |
|---|---|---|
| Tesla Model YL 3D model | 3D (from reference photo) | Hero/star of every chapter. Fallback: licensed Model Y-type GLB, debadged. |
| Hexagon studio environment | Image (HDRI-style 360) | Reflections on the car paint so it looks like the real WrapFinest bay |
| Water beading macro | Video loop 5–8 s | Ceramic top coat chapter background |
| Stone-chip slow-motion on windshield | Video 5 s | Thermoshield chapter, mobile/reduced-motion fallback |
| Sun on panoramic roof, heat haze | Video 5 s | Heat-rejection fallback |
| Satin / Onyx / color finish beauty shots | Images | Finish Studio fallback + social cards |
| Open Graph share image | Image 1200×630 | Link previews on Facebook/Messenger |

Real photos & footage take priority everywhere a real one exists. Generated media is used only for
things a camera can't easily capture (slow-mo impacts, macro water, the 3D car).

---

## 7. Content sources (in `/home/user/wrapfinest-assets`)
- `photos/` — 11 real job & installer photos
- `videos/WF-compilation.mp4` (2:00), `videos/UGC-testimonials.mp4` (3:02)
- `logo/` — PNG set + `logo.svg`
- `docs/` — Apex Ultra PCU deck, Thermoshield X deck, F1 distributor deck, Nitro spec sheet

---

## 8. Build phases
1. **Foundation** — project setup, design tokens, fonts, layout, preloader, nav, GitHub Pages deploy → preview link.
2. **3D core** — Model YL in hexagon studio, hero, camera rig driven by scroll.
3. **Chapters 01–05** — PPF install, ceramic beading, Finish Studio, Nitro tint slider, Thermoshield scenes.
4. **Content sections** — work gallery, UGC, pricing, studio, quote form.
5. **Polish** — mobile tuning, reduced-motion, SEO, performance pass, cross-browser QA.
6. **Owner review** → revisions → launch (later: custom domain).
