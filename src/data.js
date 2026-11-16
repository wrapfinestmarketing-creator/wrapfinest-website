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

// Paint/finish presets for the 3D car. rough/metal/cc/ccr drive the shader.
export const FACTORY = { color: '#a30d18', rough: 0.1, metal: 0.0, cc: 1.0, ccr: 0.02 };

export const FINISHES = [
  {
    id: 'gloss', label: 'Ultra Gloss', product: 'F1 Apex Ultra · PCU',
    blurb: 'Clear PCU film over your factory color. Mirror gloss above 100 GU, 12-year warranty.',
    keepsColor: true, rough: 0.1, metal: 0.0, cc: 1.0, ccr: 0.02,
  },
  {
    id: 'satin', label: 'Satin', product: 'F1 Apex Satin',
    blurb: 'Turns any gloss paint into a smooth satin finish while protecting it. 8-year warranty.',
    keepsColor: true, rough: 0.5, metal: 0.0, cc: 1.0, ccr: 0.4,
  },
  {
    id: 'onyx', label: 'Gloss Black', product: 'F1 Onyx',
    blurb: 'Deep gloss-black protection film with the same gloss and anti-yellowing as Apex. 10-year warranty.',
    color: '#030304', rough: 0.08, metal: 0.0, cc: 1.0, ccr: 0.02,
  },
  {
    id: 'color', label: 'Color Change', product: 'HyperPro UltraShield · KK Vinyl USA',
    blurb: 'A new color with real protection underneath. Sample shades shown; see the full swatch books in the studio.',
    swatches: true, rough: 0.1, metal: 0.0, cc: 1.0, ccr: 0.02,
  },
];

// Illustrative sample shades only (not manufacturer color names).
export const SWATCHES = [
  { name: 'Signal Orange', color: '#e8501c' },
  { name: 'Deep Blue', color: '#0f2f7a' },
  { name: 'Racing Green', color: '#0d3b2a' },
  { name: 'Nardo-style Grey', color: '#7d8388' },
  { name: 'Pearl White', color: '#e9e9e6', metal: 0.05 },
  { name: 'Midnight Purple', color: '#2a1447' },
  { name: 'Sun Yellow', color: '#e3b40e' },
  { name: 'Miami Teal', color: '#11a39a' },
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
