// JDC AI Auto Interesting catalogue as supplied by WrapFinest (official distributor, Pampanga).
// Names, descriptions and prices come from the JDC catalogue pages the owner provided.
// price: number = same for every model it fits; object = per model; null = price on request.
// fit: which Tesla models the item is listed for ('3' | 'Y' | 'YL').

export const MODELS = [
  { id: 'YL', label: 'Model YL' },
  { id: 'Y', label: 'Model Y' },
  { id: '3', label: 'Model 3' },
];

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'mats', label: 'Mats & protection' },
  { id: 'shade', label: 'Sunroof shades' },
  { id: 'exterior', label: 'Exterior & body' },
  { id: 'interior', label: 'Interior & storage' },
  { id: 'drive', label: 'Steering & displays' },
  { id: 'charge', label: 'Charging' },
];

const ALL = ['YL', 'Y', '3'];

export const ACCESSORIES = [
  // ---- mats & protection
  { id: 'mat-carpet', cat: 'mats', name: 'Floor mat set with carpet', tag: 'Best seller', fit: ALL, price: { YL: 9000, Y: 7000, 3: 7000 }, img: { YL: 'mat-carpet-yl', Y: 'mat-carpet-y', 3: 'mat-carpet-3' },
    photos: ['real-mats-front'], desc: 'TPE injection-moulded tray with a detachable chenille carpet layer. Flexible, odorless, no sharp edges.' },
  { id: 'mat-plain', cat: 'mats', name: 'Floor mat set, plain', fit: ALL, price: { YL: 7000, Y: 6000, 3: 6000 }, img: { YL: 'mat-plain-yl', Y: 'mat-plain-y', 3: 'mat-plain-3' },
    desc: 'TPE injection-moulded all-weather tray. Flexible, rubber-like, odorless, no sharp edges.' },
  { id: 'trunk-mat', cat: 'mats', name: 'Trunk mat set', fit: ALL, price: { YL: 7500, Y: 8000, 3: 5500 }, img: { YL: 'trunk-mat-yl5', Y: 'trunk-mat-y', 3: 'trunk-mat-3' },
    desc: 'TPE injection-moulded trunk liners.', note: { YL: '5-piece set', Y: '6-piece set with back seat, frunk, trunk and lower trunk', 3: '3-piece set with frunk, trunk and lower trunk' } },
  { id: 'trunk-mat-2', cat: 'mats', name: 'Frunk and lower trunk mats', fit: ['YL'], price: 2500, img: 'trunk-mat-yl2', desc: 'TPE injection-moulded liners for the frunk and lower trunk. 2-piece set.' },
  { id: 'protective-set', cat: 'mats', name: 'Protective set', fit: ['YL', '3'], price: { YL: 9800, 3: 6000 }, img: { YL: 'protective-yl', 3: 'protective-3' },
    video: { YL: 'protective-yl' }, desc: 'Moulded guards for the high-wear areas of the cabin and trunk.', note: { YL: 'Threshold strips, front seat protectors, second-row seat protectors, console side kick pads and trunk sill protector', 3: '11-piece set: door edge, console, seat-bottom, trunk-edge and air-conditioner covers' } },

  // ---- sunroof shades
  { id: 'shade-manual', cat: 'shade', name: 'Manual retractable sunshade', fit: ['YL', '3'], price: { YL: 14500, 3: 13000 }, img: 'shade-manual',
    photos: ['real-shade'], desc: 'Fitted two-panel retractable shade for the glass roof. The front and rear panels slide together and latch in the middle. JDC rates it to block up to 95% of sun heat and glare, with UV protection for seats and dashboard.' },
  { id: 'shade-auto', cat: 'shade', name: 'Automatic sunshade with voice command', tag: 'Premium', fit: ['YL'], price: 25000, img: 'shade-auto',
    desc: 'Motorised shade for the Model YL panoramic roof with voice control, a manual button and ambient lighting modes. JDC rates it to block up to 95% of sun heat and glare.' },

  // ---- exterior & body
  { id: 'body-kit', cat: 'exterior', name: 'Yofer full body kit', tag: 'Fitted in our bay', fit: ['YL'], price: 42000, img: 'body-kit',
    photos: ['real/yofer-07173', 'real/yofer-07089', 'real/yofer-07123', 'real/yofer-07250', 'real/yofer-07229', 'real/yofer-07213', 'real/yofer-07106', 'real/yofer-07135', 'real/yofer-07163', 'real/yofer-07224'], desc: 'Gloss-black ABS front lip, side skirts and rear diffuser for a lower, wider look. Professionally aligned and fitted by WrapFinest, installation included.' },
  { id: 'chassis-guard', cat: 'exterior', name: 'Under chassis guard', fit: ALL, price: 22000, img: 'chassis-guard',
    desc: 'Magnesium-aluminium alloy plates with anti-corrosion coating that shield the battery, motors and cooling system from road debris. Bolt-on, direct fit.', note: 'Check fitment with us for your exact model' },
  { id: 'aerodisc', cat: 'exterior', name: 'Aerodisc wheel covers', fit: ALL, price: 12800, img: 'aerodisc', desc: 'UV-printed, gloss-finished wheel discs. Also available in custom-made designs.' },
  { id: 'mudguard', cat: 'exterior', name: 'Mudguards', fit: ALL, price: 1200, img: 'mudguard', desc: 'Drill-free mudguards for all four wheels. 4-piece set.' },
  { id: 'insect-net', cat: 'exterior', name: 'Insect-proof net', fit: ALL, price: 2500, img: 'insect-net', desc: 'Front air-intake insect net plus air-conditioning intake dirt-proof net. 3-piece set.' },
  { id: 'jack-pads', cat: 'exterior', name: 'Jack pads', fit: ALL, price: 750, img: 'jack-pads', desc: 'Rubber lifting pads that protect the battery tray and side skirts when jacking. 4-piece set with case.' },

  // ---- interior & storage
  { id: 'trunk-shelf', cat: 'interior', name: 'Trunk panel shelf', fit: ['YL', 'Y'], price: 4800, img: 'trunk-shelf', desc: 'Parcel shelf that covers the cargo area and keeps items hidden. Complete set, ready to install.' },
  { id: 'door-storage', cat: 'interior', name: 'Door storage boxes', fit: ALL, price: 1850, img: 'door-storage', photos: ['real/jdc11', 'real/jdc12'], desc: 'Storage compartments for both front and rear doors. 4-piece set.' },
  { id: 'trunk-storage', cat: 'interior', name: 'Trunk storage with lid', fit: ALL, price: 2200, img: 'trunk-storage', photos: ['real/jdc1'], desc: 'Lidded storage compartments for both sides of the trunk. 4-piece set.' },
  { id: 'console-box', cat: 'interior', name: 'Console storage box', fit: ALL, price: 2500, img: 'console-box', photos: ['real/jdc', 'real/jdc3', 'real/jdc4'], desc: 'Upper and lower storage trays for the centre console and armrest. Gray and black. 4-piece set.' },
  { id: 'under-screen', cat: 'interior', name: 'Under-screen storage', fit: ALL, price: 2500, img: 'under-screen', desc: 'Magnetic storage tray below the central screen, plus an ETC tray behind it.' },
  { id: 'console-tray', cat: 'interior', name: 'Console tray', fit: ALL, price: 1500, img: 'console-tray', video: 'console-tray', desc: 'Adds an organiser layer to the centre console. Black or white.' },
  { id: 'hidden-storage', cat: 'interior', name: 'Console hidden storage', fit: ALL, price: 700, img: 'hidden-storage', photos: ['real/jdc15'], desc: 'Hidden compartment for the centre console lid.' },
  { id: 'eyewear-storage', cat: 'interior', name: 'Eyewear and glove storage', fit: ALL, price: 650, img: 'eyewear-storage', photos: ['real/jdc16'], desc: 'Steering-column eyewear compartment and adhesive front storage in silicone. Black, gray or white.' },
  { id: 'silicone-set', cat: 'interior', name: 'Silicone protection set', fit: ALL, price: 1200, img: 'silicone-set', photos: ['real/jdc10', 'real/jdc6', 'real/jdc7', 'real/jdc8', 'real/jdc9'], desc: 'Screen frame, mirror frame, cup holder and wireless-charging pad protectors. Black, gray or white. 4-piece set.' },
  { id: 'screen-protector', cat: 'interior', name: 'Screen protectors', fit: ALL, price: 1500, img: 'screen-protector', desc: 'Tempered glass for the central screen and the rear screen. 2-piece set.' },
  { id: 'console-cover', cat: 'interior', name: 'Console cover', fit: ALL, price: 1200, img: 'console-cover', desc: 'Protective cover for the centre console lid. Black, gray or white.' },
  { id: 'pedal-cover', cat: 'interior', name: 'Pedal covers', fit: ALL, price: 1200, img: 'pedal-cover', photos: ['real/jdc17'], desc: 'Covers for the accelerator and brake pedals. Sporty, black or white. 2-piece set.' },
  { id: 'phone-holder', cat: 'interior', name: 'Magnetic phone holder', fit: ALL, price: 1500, img: 'phone-holder', desc: 'Folding magnetic phone mount that hides away when not in use.' },
  { id: 'stickers', cat: 'interior', name: 'Console trim stickers', fit: ALL, price: 600, img: 'stickers', desc: 'Adhesive trim for the centre console. Carbon, black or white. 3-piece set.' },
  { id: 'armrest-cover', cat: 'interior', name: 'Second-row armrest cover', fit: ['YL'], price: 950, img: 'armrest-cover', photos: ['real/jdc13'], desc: 'Silicone protective covers for the second-row armrests. Black.' },
  { id: 'cup-holder', cat: 'interior', name: 'Third-row cup holder', fit: ['YL'], price: 550, img: 'cup-holder', photos: ['real/jdc14'], desc: 'Side cup holder insert for the third row.' },
  { id: 'seat-hook', cat: 'interior', name: 'Rear seat hooks', fit: ['Y', '3'], price: 950, img: 'seat-hook', desc: 'Hidden folding hooks for the front seat backs.' },
  { id: 'air-outlet', cat: 'interior', name: 'Rear air outlet cover', fit: ['3'], price: 1000, img: 'air-outlet', desc: 'Snap-on cover for the rear centre air outlet.' },

  // ---- steering & displays
  { id: 'tita', cat: 'drive', name: 'TITA smart dashboard gauge', tag: '1-year warranty', fit: ALL, price: 11500, img: 'tita',
    desc: 'Compact wireless display behind the wheel showing speed, gear, range and more. Mounts on the steering column with no wire cutting. Full kit included.' },
  { id: 'shifter', cat: 'drive', name: 'Shifter lever', fit: ['YL', 'Y'], price: 12000, from: true, img: 'shifter',
    desc: 'Right-hand pull-out gear lever for R / D / P. ₱12,000 without display, ₱18,500 with a 3.7-inch display for speed, range and gear.' },
  { id: 'cyber-wheel', cat: 'drive', name: 'Cybertruck-style steering wheel', fit: ALL, price: 20000, img: 'cyber-wheel', desc: 'Squared-off steering wheel with an ergonomic grip. Black or white.' },
  { id: 'yoke', cat: 'drive', name: 'Yoke steering wheel', fit: ['Y', '3'], price: 16500, img: 'yoke', desc: 'Yoke-style steering wheel with an ergonomic grip. Black or white.' },

  // ---- charging
  { id: 'ev-charger', cat: 'charge', name: 'Portable EV charger', fit: ALL, price: 9800, img: 'ev-charger', desc: 'Type 2 portable charger with adjustable 6 to 16 A current, LED display, delayed charging and a 5 m cable. IP65.' },
  { id: 'gbt-adapter', cat: 'charge', name: 'Type 2 to GBT adapter', fit: ALL, price: 2500, img: 'gbt-adapter', desc: 'Lets a Type 2 vehicle charge at GBT stations. Rated up to 32 A.' },
  { id: 'console-charger', cat: 'charge', name: 'Console charger', fit: ALL, price: 1600, img: 'console-charger', photos: ['real/jdc18'], desc: 'Docking charger with built-in cables plus USB and Type-C ports. Lightning or Type-C versions.' },
  { id: 'rear-charger', cat: 'charge', name: 'Rear console charger', fit: ALL, price: 1650, img: 'rear-charger', desc: '3-in-1 rear vent dock with vent protection, two retractable charging cables and a fragrance slot.' },
];

export const priceFor = (item, model) => (item.price == null ? null : typeof item.price === 'number' ? item.price : item.price[model] ?? null);
export const imgFor = (item, model) => (typeof item.img === 'string' ? item.img : item.img[model] || Object.values(item.img)[0]);
// gallery for the zoom viewer: studio shot first, then real photos from our bay, then the product video
export function galleryFor(item, model, base) {
  const m = base + 'media/', key = imgFor(item, model), out = [{ src: `${m}acc/${key}-lg.webp`, thumb: `${m}acc/${key}.webp`, alt: item.name }];
  for (const p of item.photos || []) out.push({ src: `${m}acc/${p}.webp`, thumb: p.includes('yofer') ? `${m}acc/${p}-sm.webp` : `${m}acc/${p}.webp`, alt: `${item.name}, real photo`, real: true });
  const v = !item.video ? null : typeof item.video === 'string' ? item.video : item.video[model];
  if (v) out.push({ type: 'video', src: `${m}video/${v}.mp4`, poster: `${m}video/${v}-poster.jpg`, alt: `${item.name} video` });
  return out;
}
export const noteFor = (item, model) => (!item.note ? '' : typeof item.note === 'string' ? item.note : item.note[model] || '');
export const peso = n => '₱' + n.toLocaleString('en-PH');
