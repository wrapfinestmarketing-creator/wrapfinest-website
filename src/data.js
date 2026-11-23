// Single source of truth for product facts shown on the site.
// Every number here comes from the approved creative brief (docs/CREATIVE-BRIEF.md).

export const TINTS = [
  { id: 'SD5', name: 'Nitro SD5', shade: 'Super Dark', vlt: 5, irr: 99, uvr: 99, tser: 97.2 },
  { id: 'VD10', name: 'Nitro VD10', shade: 'Very Dark', vlt: 14, irr: 99, uvr: 99, tser: 93.1 },
  { id: 'MD20', name: 'Nitro MD20', shade: 'Medium Dark', vlt: 23, irr: 98, uvr: 99, tser: 89.3 },
  { id: 'M35', name: 'Nitro M35', shade: 'Medium', vlt: 36, irr: 99, uvr: 99, tser: 83.6 },
  { id: 'LM40', name: 'Nitro LM40', shade: 'Light Medium', vlt: 41, irr: 99, uvr: 99, tser: 81.6 },
  { id: 'L50', name: 'Nitro L50', shade: 'Light', vlt: 45, irr: 99, uvr: 99, tser: 79.6 },
  { id: 'VL60', name: 'Nitro VL60', shade: 'Very Light', vlt: 62, irr: 99, uvr: 99, tser: 72.2 },
  { id: 'A70', name: 'Nitro Artic70', shade: 'Clear Blue', vlt: 76, irr: 98, uvr: 99, tser: 65.5 },
];

// Finish Studio: one 360 set of frames, repainted live (src/paint.js). `paint` is the recipe:
// c = paint colour, kd = how strongly the paint is lit, ks = clear-coat reflections,
// km = metallic (reflections pick up the paint colour), satin = soft, spread-out reflections,
// lift (< 1) = brighter shaded side, for light colours.
// `still` is the fallback picture when the browser cannot run the paint shader.
export const FINISHES = [
  { id: 'gloss', still: 'finish-gloss', paint: { c: '#b00c1c', kd: 0.92, ks: 1, km: 0.55, satin: 0 }, f1: 'Apex Ultra · PCU ultra gloss', label: 'Ultra Gloss', product: 'F1 Apex Ultra · PCU', service: 'Paint protection film',
    blurb: 'Clear PCU film over your factory color. Mirror gloss above 100 GU, 12-year warranty.' },
  { id: 'satin', still: 'finish-satin', paint: { c: '#a30f1e', kd: 0.95, ks: 1, km: 0.3, satin: 1 }, f1: 'Apex Satin · satin PPF', label: 'Satin', product: 'F1 Apex Satin', service: 'Paint protection film',
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
  { name: 'Nardo-style Grey', color: '#8b8f92', still: 'finish-grey', paint: { c: '#8b8f92', kd: 1.08, ks: 0.95, km: 0, lift: 0.75, satin: 0 } },
  { name: 'Pearl White', color: '#ecece9', still: 'finish-white', paint: { c: '#f4f4f1', kd: 1.1, ks: 0.85, km: 0, lift: 0.55, satin: 0 } },
  { name: 'Midnight Purple', color: '#2c1548', still: 'finish-purple', paint: { c: '#3a1a66', kd: 1, ks: 1, km: 0.5, satin: 0 } },
  { name: 'Sun Yellow', color: '#f0cf1d', still: 'finish-yellow', paint: { c: '#f2cf14', kd: 1.08, ks: 1, km: 0.05, lift: 0.8, satin: 0 } },
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
