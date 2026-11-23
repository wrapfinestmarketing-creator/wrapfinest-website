// Single source of truth for product facts shown on the site.
// Every number here comes from the approved creative brief (docs/CREATIVE-BRIEF.md).

// `film` is what the film lets through as seen from outside (red, green, blue): Artic70 is the clear blue one.
export const TINTS = [
  { id: 'SD5', name: 'Nitro SD5', shade: 'Super Dark', vlt: 5, irr: 99, uvr: 99, tser: 97.2, film: [0.065, 0.07, 0.078] },
  { id: 'VD10', name: 'Nitro VD10', shade: 'Dark', vlt: 10, irr: 99, uvr: 99, tser: 93.1, film: [0.13, 0.136, 0.146] },
  { id: 'MD20', name: 'Nitro MD20', shade: 'Medium Dark', vlt: 20, irr: 98, uvr: 99, tser: 89.3, film: [0.24, 0.248, 0.262] },
  { id: 'M35', name: 'Nitro M35', shade: 'Medium Light', vlt: 35, irr: 99, uvr: 99, tser: 83.6, film: [0.4, 0.412, 0.432] },
  { id: 'A70', name: 'Nitro Artic70', shade: 'Clear Blue', vlt: 70, irr: 98, uvr: 99, tser: 65.5, film: [0.6, 0.79, 0.98] },
];
// Thermoshield X comes in three shades. The deck gives its specs for the film as a whole, not per shade.
export const ARMOR = [
  { id: 'TX20', name: 'Thermoshield X 20', shade: 'Medium Dark', vlt: 20, film: [0.24, 0.248, 0.262] },
  { id: 'TX35', name: 'Thermoshield X 35', shade: 'Light Medium', vlt: 35, film: [0.4, 0.412, 0.432] },
  { id: 'TX70', name: 'Thermoshield X 70', shade: 'Clear Blue', vlt: 70, film: [0.6, 0.79, 0.98] },
];
// The glass a visitor can tint, in the order the tint shader numbers it (src/tint.js), with the film each starts on.
export const GLASS = [
  { id: 'w', name: 'Windshield', short: 'Windshield', film: 'A70' },
  { id: 'f', name: 'Front doors', short: 'Front', film: 'M35' },
  { id: 'r', name: 'Rear doors', short: 'Rear', film: 'MD20' },
  { id: 'k', name: 'Rear glass', short: 'Rear glass', film: 'MD20' },
  { id: 'o', name: 'Roof', short: 'Roof', film: 'VD10' },
];

// Finish Studio: one 360 set of frames, repainted live (src/paint.js). `paint` is the recipe:
// c = paint colour, kd = how strongly the paint is lit, ks = clear-coat reflections,
// km = metallic (reflections pick up the paint colour), satin = soft, spread-out reflections,
// lift (< 1) = brighter shaded side, for light colours.
// `still` is the fallback picture when the browser cannot run the paint shader.
export const FINISHES = [
  { id: 'gloss', still: 'finish-gloss', paint: { c: '#b00c1c', kd: 0.92, ks: 1, km: 0.55, satin: 0 }, f1: 'Apex Ultra · PCU ultra gloss', label: 'Ultra Gloss', product: 'F1 Apex Ultra · PCU', service: 'Paint protection film',
    blurb: 'Clear PCU film over your factory color. Mirror gloss above 100 GU, 12-year warranty.' },
  { id: 'satin', still: 'finish-satin', paint: { c: '#c4161f', kd: 0.95, ks: 1, km: 0.55, satin: 1 }, f1: 'Apex Satin · satin PPF', label: 'Satin', product: 'F1 Apex Satin', service: 'Paint protection film',
    blurb: 'Turns gloss paint into a smooth satin finish while protecting it. 8-year warranty.' },
  { id: 'onyx', still: 'finish-onyx', paint: { c: '#050506', kd: 1, ks: 1.05, km: 0, satin: 0 }, f1: 'Onyx · gloss black PPF', label: 'Gloss Black', product: 'F1 Onyx', service: 'Paint protection film',
    blurb: 'Deep gloss-black protection film with the same gloss and anti-yellowing as Apex. 10-year warranty.' },
  { id: 'color', label: 'Color Change', product: 'HyperPro UltraShield · KK Vinyl USA', service: 'Color change wrap', swatches: true,
    blurb: 'A new color with real protection underneath. Sample shades shown; see the full swatch books in the studio.' },
];

// Illustrative sample shades only (not manufacturer color names).
export const SWATCHES = [
  { name: 'Signal Orange', color: '#ee6a12', still: 'finish-orange', paint: { c: '#ee6a12', kd: 1, ks: 1, km: 0.1, satin: 0 } },
  { name: 'Royal Blue', color: '#12279a', still: 'finish-blue', paint: { c: '#1230b4', kd: 1, ks: 1, km: 0.45, satin: 0 } },
  { name: 'Racing Green', color: '#0f3d24', still: 'finish-green', paint: { c: '#0f4a2a', kd: 1, ks: 1, km: 0.45, satin: 0 } },
  { name: 'Nardo-style Grey', color: '#8b8f92', still: 'finish-grey', paint: { c: '#8b8f92', kd: 1, ks: 0.9, km: 0, satin: 0 } },
  { name: 'Pearl White', color: '#ecece9', still: 'finish-white', paint: { c: '#f6f6f3', kd: 1.04, ks: 0.45, km: 0, lift: 0.7, satin: 0 } },
  { name: 'Midnight Purple', color: '#2c1548', still: 'finish-purple', paint: { c: '#3a1a66', kd: 1, ks: 1, km: 0.5, satin: 0 } },
  { name: 'Sun Yellow', color: '#f0cf1d', still: 'finish-yellow', paint: { c: '#f2cf14', kd: 1, ks: 0.9, km: 0.05, satin: 0 } },
  { name: 'Miami Teal', color: '#18a79c', still: 'finish-teal', paint: { c: '#18a79c', kd: 1, ks: 1, km: 0.15, satin: 0 } },
];

export const TINT_LAYERS = [
  'Scratch-resistant coat',
  'Multi-layer element',
  'Nano ceramic tech',
  'Glare reduction material',
  'IR rejection material',
  'UV rejection material',
  'Nano ceramic tech',
  'PET polyester film',
  'Mounting adhesive',
];

export const CONTACT = {
  phone: '0998 564 0802',
  phoneHref: 'tel:+639985640802',
  email: 'wrapfinestpampanga@gmail.com',
  messenger: 'https://m.me/wrapfinestpampanga',
  facebook: 'https://www.facebook.com/wrapfinestpampanga',
  map: 'https://maps.app.goo.gl/krx5VT7D8T2r8pCt9',
  formEndpoint: 'https://formsubmit.co/ajax/wrapfinestpampanga@gmail.com',
};
