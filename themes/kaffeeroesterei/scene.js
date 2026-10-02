// The roastery as one SVG scene: a cross-section with the roasting room on
// the left and the street with the coffee cart on the right. Everything is
// drawn here as code; nothing is loaded from elsewhere. The game core loads
// this module from theme.json ("scene") and passes in what the rules know:
// the first crack, the guests' places and the roast levels with their colors.
//
// Scene units: 1000 x 700, the floor at y = 610. The SVG keeps the bottom
// edge and draws the background far beyond the view box, so any window shape
// shows a full picture while the playable part stays in the view box.

const NS = 'http://www.w3.org/2000/svg';
export const FLOOR = 610;
export const PAN = { x: 130, y: 438 };
const SIEVE = { x: 215, y: 492 };
export const DRUM_X = [330, 500];
export const CART = { x: 747, counter: 510 };
const HATCH = { x: 620, y: 478 };
const BIKE_Y = 664;

// Set by createScene() from the theme's roast levels.
let FIRST_CRACK = 0.4;
let SLOTS = [850, 895, 940];
let LABEL_COLORS = {};
let LEVEL_DOTS = {};
let LEVEL_ROAST = {};
let SHELF_X = {};

// The sign on a drum's hopper, where it shows its roast.
const SIGN_Y = -200;
// Guests with less patience left than this show it.
const IMPATIENT_SECONDS = 5;
// The espresso machine in the café window, and what guests order from it.
const MACHINE = { x: 712, y: 394 };
let ESPRESSO_ORDER = 'espresso';
let ESPRESSO_CUPS = 0;

const ROAST_STOPS = [
  [0, [143, 170, 92]],
  [0.18, [196, 184, 104]],
  [0.32, [201, 154, 88]],
  [0.4, [176, 118, 66]],
  [0.58, [132, 78, 42]],
  [0.76, [92, 52, 28]],
  [0.9, [58, 34, 20]],
  [1, [34, 22, 16]],
];

export function roastColor(p) {
  const x = Math.min(1, Math.max(0, p));
  const i = ROAST_STOPS.findIndex(([at]) => at >= x);
  if (i <= 0) return rgb(ROAST_STOPS[0][1]);
  const [a, ca] = ROAST_STOPS[i - 1];
  const [b, cb] = ROAST_STOPS[i];
  const f = (x - a) / (b - a);
  return rgb(ca.map((v, k) => v + (cb[k] - v) * f));
}


function rgb(c) {
  return `rgb(${c.map((v) => Math.round(v)).join(',')})`;
}

function el(name, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (parent) parent.appendChild(node);
  return node;
}

function group(parent, markup = '', attrs = {}) {
  const g = el('g', attrs, parent);
  if (markup) g.innerHTML = markup;
  return g;
}

// ---- Static art --------------------------------------------------------------

const DEFS = `
<linearGradient id="g-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4EADA"/><stop offset="1" stop-color="#E8D6BB"/></linearGradient>
<pattern id="p-tiles" width="60" height="30" patternUnits="userSpaceOnUse" y="422">
  <rect width="60" height="30" fill="#F8F3EA"/>
  <path d="M0 .75H60M30 0V15M0 15.75H60M.75 15V30M59.25 15V30" stroke="#E2D7C6" stroke-width="1.5" fill="none"/>
</pattern>
<pattern id="p-bricks" width="44" height="24" patternUnits="userSpaceOnUse">
  <rect width="44" height="24" fill="#6A4632"/>
  <path d="M0 .75H44M22 0V12M0 12.75H44M0 12V24" stroke="#5A3A29" stroke-width="1.5" fill="none"/>
</pattern>
<linearGradient id="g-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BF8E60"/><stop offset="1" stop-color="#A06F46"/></linearGradient>
<linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#86C0DC"/><stop offset=".55" stop-color="#CBE5EC"/><stop offset="1" stop-color="#F8E4C0"/></linearGradient>
<radialGradient id="g-sun"><stop offset="0" stop-color="#FFF6DB"/><stop offset=".35" stop-color="#FFF1C9" stop-opacity=".8"/><stop offset="1" stop-color="#FFF1C9" stop-opacity="0"/></radialGradient>
<radialGradient id="g-lamp"><stop offset="0" stop-color="#FFD58F" stop-opacity=".5"/><stop offset="1" stop-color="#FFD58F" stop-opacity="0"/></radialGradient>
<linearGradient id="g-copper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3B77E"/><stop offset=".5" stop-color="#C8783F"/><stop offset="1" stop-color="#8E4F28"/></linearGradient>
<linearGradient id="g-enamel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#46434B"/><stop offset=".45" stop-color="#2C2A30"/><stop offset="1" stop-color="#1B1A1E"/></linearGradient>
<linearGradient id="g-steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#D3D9DE"/><stop offset=".55" stop-color="#9DA6AE"/><stop offset="1" stop-color="#7A838B"/></linearGradient>
<radialGradient id="g-flame" cx=".5" cy=".85" r=".85"><stop offset="0" stop-color="#FFF4B0"/><stop offset=".4" stop-color="#FFB53D"/><stop offset=".78" stop-color="#FF6A2B"/><stop offset="1" stop-color="#FF4A20" stop-opacity="0"/></radialGradient>
<radialGradient id="g-glow"><stop offset="0" stop-color="#FF9A3C" stop-opacity=".75"/><stop offset="1" stop-color="#FF7A2B" stop-opacity="0"/></radialGradient>
<linearGradient id="g-kraft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DDBA88"/><stop offset="1" stop-color="#BF955F"/></linearGradient>
<linearGradient id="g-cafe-window" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE7B8"/><stop offset="1" stop-color="#F2B46B"/></linearGradient>
<linearGradient id="g-shaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF8E6" stop-opacity=".35"/><stop offset="1" stop-color="#FFF8E6" stop-opacity="0"/></linearGradient>
<linearGradient id="g-sky-harbor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4E4F7C"/><stop offset=".5" stop-color="#C77A7A"/><stop offset="1" stop-color="#FFC98E"/></linearGradient>
<radialGradient id="g-sun-harbor"><stop offset="0" stop-color="#FFE3A0"/><stop offset=".4" stop-color="#FFC77E" stop-opacity=".75"/><stop offset="1" stop-color="#FFB46E" stop-opacity="0"/></radialGradient>
`;

function windowsGrid(x0, y0, cols, rows, w, h, dx, dy, fill, frame) {
  let out = '';
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = x0 + c * dx;
      const y = y0 + r * dy;
      out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${fill}" stroke="${frame}" stroke-width="4"/>`;
      out += `<rect x="${x - 3}" y="${y + h}" width="${w + 6}" height="5" rx="1.5" fill="${frame}"/>`;
    }
  }
  return out;
}

const STREET = `
<rect x="600" y="-600" width="1300" height="1210" fill="url(#g-sky)"/>
<circle cx="930" cy="96" r="150" fill="url(#g-sun)"/>
<g fill="#FFFFFF" opacity=".85">
  <ellipse cx="730" cy="70" rx="40" ry="11"/><ellipse cx="756" cy="62" rx="26" ry="13"/>
  <ellipse cx="1080" cy="120" rx="52" ry="12"/><ellipse cx="1108" cy="110" rx="30" ry="14"/>
</g>
<g data-ref="buildings">
  <rect x="650" y="190" width="132" height="430" fill="#E6CDAA"/>
  <rect x="645" y="182" width="142" height="12" rx="2" fill="#C9A987"/>
  ${windowsGrid(668, 216, 2, 3, 34, 46, 56, 74, '#8DB4C8', '#F6ECDC')}
  <rect x="782" y="128" width="126" height="492" fill="#C9907D"/>
  <rect x="777" y="120" width="136" height="12" rx="2" fill="#AE7766"/>
  ${windowsGrid(800, 152, 2, 4, 34, 48, 54, 72, '#7FA6BC', '#E9D2C6')}
  <rect x="908" y="206" width="160" height="414" fill="#A9BCA0"/>
  <rect x="903" y="198" width="170" height="12" rx="2" fill="#8FA486"/>
  ${windowsGrid(926, 232, 3, 3, 30, 42, 48, 70, '#8DB4C8', '#EEF1E6')}
  <rect x="1068" y="160" width="260" height="460" fill="#DABF96"/>
  ${windowsGrid(1088, 190, 4, 4, 32, 44, 56, 70, '#8DB4C8', '#F4E8D2')}
</g>
<rect x="600" y="610" width="1300" height="52" fill="#D9D1C5"/>
<path d="M660 610V662M740 610V662M820 610V662M900 610V662M980 610V662M1060 610V662" stroke="#C7BDAF" stroke-width="2"/>
<rect x="600" y="660" width="1300" height="9" fill="#BBB0A2"/>
<rect x="600" y="669" width="1300" height="200" fill="#62666E"/>
<path d="M660 690H720M780 690H840M900 690H960M1020 690H1080" stroke="#E8E2D6" stroke-width="5" stroke-linecap="round" opacity=".7"/>
`;

// Arched warehouse windows; every third one is lit in the evening.
function archWindows(x0, y0, cols, rows, w, h, dx, dy, frame) {
  let out = '';
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = x0 + c * dx;
      const y = y0 + r * dy;
      const glass = (r * cols + c + x0) % 3 === 0 ? '#FFD98A' : '#4F4560';
      out += `<path d="M${x} ${y + h}V${y + w / 2}A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2}V${y + h}Z" fill="${glass}" stroke="${frame}" stroke-width="4"/>`;
    }
  }
  return out;
}

// The second location: brick warehouses at the harbor in the evening, a crane
// behind them. It covers the sky and houses of the street; pavement and road
// stay.
const HARBOR = `
<rect x="600" y="-600" width="1300" height="1210" fill="url(#g-sky-harbor)"/>
<circle cx="1010" cy="300" r="170" fill="url(#g-sun-harbor)"/>
<g fill="none" stroke="#5E5873" stroke-linejoin="round" opacity=".85">
  <path d="M1210 620V150M1250 620V150" stroke-width="7"/>
  <path d="M1210 600L1250 560L1210 520L1250 480L1210 440L1250 400L1210 360L1250 320L1210 280L1250 240L1210 200L1250 160" stroke-width="3"/>
  <path d="M1040 150H1400M1040 150L1230 100L1400 150M1230 100V150" stroke-width="6"/>
  <path d="M1080 150V300" stroke-width="2"/>
</g>
<rect x="1066" y="300" width="28" height="18" rx="2" fill="#5E5873" opacity=".85"/>
<g data-ref="harbor-buildings">
  <path d="M650 620V250H668V232H686V214H704V196H736V214H754V232H772V250H790V620Z" fill="#B4553E"/>
  ${archWindows(668, 270, 3, 4, 26, 44, 40, 80, '#EBD7B5')}
  <rect x="786" y="168" width="148" height="452" fill="#93432F"/>
  <rect x="781" y="160" width="158" height="12" rx="2" fill="#E3CDA9"/>
  <path d="M860 150V128H900" stroke="#3A2A2A" stroke-width="6" fill="none"/>
  <path d="M896 128V176" stroke="#3A2A2A" stroke-width="2"/>
  ${archWindows(804, 196, 3, 5, 26, 44, 42, 80, '#E3CDA9')}
  <path d="M934 620V240L1012 196L1090 240V620Z" fill="#C06A4B"/>
  <circle cx="1012" cy="236" r="14" fill="#FFD98A" stroke="#EBD7B5" stroke-width="4"/>
  ${archWindows(952, 280, 3, 4, 28, 46, 44, 80, '#EBD7B5')}
  <rect x="1090" y="214" width="260" height="406" fill="#8C3F31"/>
  <rect x="1085" y="206" width="270" height="12" rx="2" fill="#E3CDA9"/>
  ${archWindows(1110, 240, 5, 4, 28, 46, 46, 82, '#E3CDA9')}
</g>
<path d="M600 340Q700 372 790 344Q862 368 934 348Q1010 374 1090 350Q1200 376 1330 352" stroke="#3A2A2A" stroke-width="1.5" fill="none"/>
<g fill="#FFE29A">
  <circle cx="640" cy="352" r="4"/><circle cx="690" cy="360" r="4"/><circle cx="740" cy="356" r="4"/><circle cx="830" cy="356" r="4"/>
  <circle cx="880" cy="360" r="4"/><circle cx="975" cy="360" r="4"/><circle cx="1030" cy="362" r="4"/><circle cx="1140" cy="364" r="4"/>
  <circle cx="1200" cy="368" r="4"/><circle cx="1270" cy="362" r="4"/>
</g>
`;

// ---- Upgrades after the café --------------------------------------------------

// Chalkboard sign on the pavement, right of the cart.
const BOARD = `
<g transform="translate(832 612)">
  <ellipse cy="1" rx="20" ry="3" fill="#000" opacity=".14"/>
  <path d="M-17 0L-6 -58H6L17 0" stroke="#7A4F32" stroke-width="4" fill="none" stroke-linejoin="round"/>
  <rect x="-15" y="-54" width="30" height="38" rx="3" fill="#2A2A2A" stroke="#8A5B3A" stroke-width="2.5"/>
  <g fill="none" stroke="#F4E6CF" stroke-width="1.8" stroke-linecap="round">
    <path d="M-8 -42H5V-36Q5 -30 -1.5 -30Q-8 -30 -8 -36Z"/>
    <path d="M5 -40Q9 -40 9 -37Q9 -34 5 -34"/>
    <path d="M-9 -24H9"/>
  </g>
</g>
`;

// A cup of espresso on a saucer, standing on y = 0.
function cupMarkup() {
  return `<ellipse cy="-0.5" rx="7" ry="1.6" fill="#C9CFD4"/><path d="M-5 -10H5V-4Q5 0 0 0Q-5 0 -5 -4Z" fill="#F4E6CF" stroke="#8A6246" stroke-width="1.2"/><path d="M5 -8Q8.5 -8 8.5 -6Q8.5 -4 5 -4" stroke="#8A6246" stroke-width="1.2" fill="none"/><ellipse cy="-9.5" rx="4" ry="1.1" fill="#6E4023"/>`;
}

// Espresso machine in the top of the café window, above the cart's awning,
// with the cups it has made next to it and how far the next one is above it.
const ESPRESSO = `
<g transform="translate(712 394)">
  <rect x="-16" y="-45" width="32" height="5" rx="2.5" fill="#3A2A2A" opacity=".45"/>
  <rect data-ref="brew-fill" x="-16" y="-45" width="0" height="5" rx="2.5" fill="#F2C14E"/>
  <g data-ref="cups">${[30, 46, 62].map((x) => `<g class="ready-cup hidden" transform="translate(${x} 0)">${cupMarkup()}</g>`).join('')}</g>
  <rect x="-20" y="-36" width="40" height="36" rx="4" fill="#C9CFD4" stroke="#7A838B" stroke-width="2"/>
  <rect x="-20" y="-36" width="40" height="9" rx="4" fill="#8E979E"/>
  <rect x="-7" y="-25" width="14" height="7" rx="2" fill="#4A4646"/>
  <path d="M-6 -12H6V-6Q6 -2 0 -2Q-6 -2 -6 -6Z" fill="#F4E6CF"/>
  <circle cx="12" cy="-31" r="2.4" fill="#E0664F"/>
  <g class="steam" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity=".7">
    <path d="M-3 -14Q-6 -18 -3 -22"/><path d="M3 -14Q6 -18 3 -22"/>
  </g>
</g>
`;

// Framed certificate of the roasting course, on the wall of the roastery.
const DIPLOMA = `
<g transform="translate(272 214)">
  <rect x="-27" y="-22" width="54" height="42" rx="2" fill="#8B5A36"/>
  <rect x="-23" y="-18" width="46" height="34" fill="#F7EEDC"/>
  <path d="M-16 -10H16M-16 -4H10M-16 2H6" stroke="#B9A07A" stroke-width="2" stroke-linecap="round"/>
  <circle cx="13" cy="9" r="5.5" fill="#E0B25A"/>
  <path d="M10 13L9 20L13 17.5L17 20L16 13" fill="#C8553D"/>
</g>
`;

function cargoBikeMarkup() {
  return `
  <g class="ride">
    <circle cx="-46" cy="-14" r="14" fill="none" stroke="#2A2A2A" stroke-width="4"/>
    <circle cx="40" cy="-14" r="14" fill="none" stroke="#2A2A2A" stroke-width="4"/>
    <rect x="-70" y="-58" width="50" height="30" rx="4" fill="#C8783F" stroke="#8E4F28" stroke-width="2"/>
    <g transform="translate(-45 -43) rotate(-25)"><ellipse rx="6" ry="8.5" fill="#6E4023"/><path d="M0 -7Q-3 0 0 7" stroke="#C8783F" stroke-width="1.8" fill="none"/></g>
    <path d="M-46 -14L-20 -30H18L40 -14M-20 -30L-26 -54M18 -30L10 -48" stroke="#2E8C84" stroke-width="5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M-32 -56H-20" stroke="#2A2A2A" stroke-width="4" stroke-linecap="round"/>
    <rect x="2" y="-52" width="18" height="6" rx="3" fill="#2A2A2A"/>
    <g class="person">
      <path d="M12 -50L6 -86" stroke="#3D5A80" stroke-width="14" stroke-linecap="round"/>
      <path d="M8 -80L-22 -58" stroke="#3D5A80" stroke-width="7" stroke-linecap="round"/>
      <path d="M12 -48L-2 -26" stroke="#2F3E46" stroke-width="8" stroke-linecap="round"/>
      <circle cx="4" cy="-100" r="11" fill="#D9A27C"/>
      <path d="M-7 -102Q-5 -114 5 -113Q15 -112 14 -101Q9 -107 3 -107Q-3 -107 -7 -102Z" fill="#6B4226"/>
    </g>
  </g>`;
}

const CAFE = `
<rect x="648" y="150" width="262" height="470" fill="#ECDCC2"/>
<rect x="643" y="142" width="272" height="12" rx="2" fill="#CDB594"/>
${windowsGrid(668, 168, 3, 1, 44, 50, 80, 0, '#8DB4C8', '#F7EEDF')}
<rect x="648" y="246" width="262" height="374" fill="#7C3544"/>
<rect x="648" y="246" width="262" height="8" fill="#5E2733"/>
<rect x="742" y="258" width="150" height="40" rx="8" fill="#2A1D17" stroke="#E0B25A" stroke-width="3"/>
<g transform="translate(817 279)" fill="none" stroke="#F4E6CF" stroke-width="3.5" stroke-linecap="round">
  <path d="M-16 -6H12V6Q12 14 -2 14Q-16 14 -16 6Z" fill="#F4E6CF" stroke="none"/>
  <path d="M12 -2Q20 -2 20 4Q20 9 12 9"/>
  <path d="M-8 -12Q-4 -16 -8 -20M0 -12Q4 -16 0 -20" stroke-width="2.5"/>
</g>
<g>
  <path d="M660 306H898V334Q889 344 880 334Q871 344 862 334Q853 344 844 334Q835 344 826 334Q817 344 808 334Q799 344 790 334Q781 344 772 334Q763 344 754 334Q745 344 736 334Q727 344 718 334Q709 344 700 334Q691 344 682 334Q673 344 664 334Q660 338 660 334Z" fill="#F4E6CF"/>
  <path d="M678 306V336M714 306V338M750 306V338M786 306V338M822 306V338M858 306V338M894 306V336" stroke="#B8475A" stroke-width="18"/>
</g>
<rect x="674" y="352" width="210" height="116" rx="6" fill="url(#g-cafe-window)" stroke="#3E1A22" stroke-width="7"/>
<path d="M744 352V468M814 352V468" stroke="#3E1A22" stroke-width="5"/>
<g fill="#6B3A2E" opacity=".55">
  <circle cx="706" cy="412" r="11"/><path d="M690 468Q690 428 706 428Q722 428 722 468Z"/>
  <circle cx="790" cy="406" r="11"/><path d="M774 468Q774 422 790 422Q806 422 806 468Z"/>
  <circle cx="846" cy="414" r="10"/><path d="M832 468Q832 430 846 430Q860 430 860 468Z"/>
</g>
<g fill="#FFF6E4"><rect x="724" y="444" width="10" height="9" rx="2"/><rect x="826" y="446" width="9" height="8" rx="2"/></g>
<circle cx="709" cy="370" r="4" fill="#FFF3C8"/><circle cx="779" cy="370" r="4" fill="#FFF3C8"/><circle cx="849" cy="370" r="4" fill="#FFF3C8"/>
`;

const ROOM = `
<rect x="-800" y="-600" width="1400" height="1030" fill="url(#g-wall)"/>
<rect x="-800" y="-600" width="1400" height="606" fill="#E3D1B5"/>
<rect x="-800" y="0" width="1400" height="22" fill="#7A5236"/>
<rect x="-800" y="20" width="1400" height="3" fill="#5E3E28"/>
<rect x="-800" y="422" width="1400" height="190" fill="url(#p-tiles)"/>
<rect x="-800" y="414" width="1400" height="9" fill="#7A5236"/>
<rect x="-800" y="598" width="1400" height="14" fill="#CDBDA7"/>
<g>
  <rect x="36" y="146" width="188" height="188" rx="6" fill="#6B4A36"/>
  <rect x="46" y="156" width="168" height="168" fill="url(#g-sky)"/>
  <g fill="#FFFFFF" opacity=".8"><ellipse cx="98" cy="196" rx="30" ry="9"/><ellipse cx="116" cy="190" rx="18" ry="9"/></g>
  <path d="M46 290Q90 262 130 280T214 270V324H46Z" fill="#A9BCA0"/>
  <rect x="127" y="156" width="6" height="168" fill="#6B4A36"/>
  <rect x="46" y="237" width="168" height="6" fill="#6B4A36"/>
  <rect x="28" y="330" width="204" height="11" rx="3" fill="#8A6246"/>
  <path d="M190 330L184 312H208L202 330Z" fill="#C8553D"/>
  <g fill="#5E8C4A"><ellipse cx="190" cy="304" rx="7" ry="12" transform="rotate(-25 190 304)"/><ellipse cx="202" cy="302" rx="7" ry="13" transform="rotate(20 202 302)"/><ellipse cx="196" cy="298" rx="6" ry="13"/></g>
  <path d="M46 324L10 610H250L214 324Z" fill="url(#g-shaft)"/>
</g>
<g>
  <rect x="238" y="296" width="66" height="104" rx="4" fill="#5B3E2C"/>
  <rect x="244" y="302" width="54" height="92" rx="2" fill="#F3EADB"/>
  <rect x="250" y="308" width="42" height="11" rx="2" fill="#8FAA5C"/>
  <rect x="250" y="322" width="42" height="11" rx="2" fill="#C4B868"/>
  <rect x="250" y="336" width="42" height="11" rx="2" fill="#B07642"/>
  <rect x="250" y="350" width="42" height="11" rx="2" fill="#844E2A"/>
  <rect x="250" y="364" width="42" height="11" rx="2" fill="#5C341C"/>
  <rect x="250" y="378" width="42" height="11" rx="2" fill="#2A1A12"/>
</g>
<g>
  <rect x="330" y="244" width="252" height="10" rx="3" fill="#8A6246"/>
  <path d="M350 254V270H360M556 254V270H546" stroke="#6B4A36" stroke-width="5" fill="none"/>
  <rect x="340" y="206" width="26" height="38" rx="4" fill="#2FA39A"/><rect x="337" y="200" width="32" height="8" rx="3" fill="#24756F"/>
  <rect x="374" y="214" width="26" height="30" rx="4" fill="#D9A441"/><rect x="371" y="208" width="32" height="8" rx="3" fill="#B7862E"/>
  <path d="M412 244V214Q412 206 420 206H434Q442 206 442 214V244Z" fill="#E8F1F2" opacity=".85"/><rect x="412" y="222" width="30" height="22" fill="#6E4023"/>
  <rect x="452" y="210" width="28" height="34" rx="3" fill="url(#g-kraft)"/><rect x="452" y="222" width="28" height="9" fill="#E0803C"/>
  <rect x="486" y="214" width="28" height="30" rx="3" fill="url(#g-kraft)"/><rect x="486" y="224" width="28" height="8" fill="#9C3F63"/>
  <rect x="522" y="204" width="24" height="40" rx="4" fill="#C8553D"/><rect x="519" y="198" width="30" height="8" rx="3" fill="#A23F2C"/>
  <rect x="554" y="222" width="22" height="22" rx="3" fill="#6D597A"/>
</g>
<g>
  <path d="M130 -600V68" stroke="#3B2A20" stroke-width="3"/>
  <path d="M104 68H156L170 98H90Z" fill="#24584F"/><ellipse cx="130" cy="99" rx="11" ry="5" fill="#FFE8B0"/>
  <ellipse cx="130" cy="170" rx="170" ry="120" fill="url(#g-lamp)"/>
  <path d="M440 -600V68" stroke="#3B2A20" stroke-width="3"/>
  <path d="M414 68H466L480 98H400Z" fill="#24584F"/><ellipse cx="440" cy="99" rx="11" ry="5" fill="#FFE8B0"/>
  <ellipse cx="440" cy="170" rx="170" ry="120" fill="url(#g-lamp)"/>
</g>
<rect x="-800" y="610" width="1400" height="260" fill="url(#g-floor)"/>
<rect x="-800" y="610" width="1400" height="4" fill="#8E6240"/>
<path d="M-40 614V700M40 614V700M120 614V700M200 614V700M280 614V700M360 614V700M440 614V700M520 614V700" stroke="#9A6B43" stroke-width="2" opacity=".55"/>
`;

const WALL = `
<rect x="598" y="-600" width="44" height="1216" fill="url(#p-bricks)"/>
<rect x="598" y="440" width="44" height="78" fill="#3A271C"/>
<rect x="594" y="432" width="52" height="10" rx="2" fill="#8A6246"/>
<rect x="590" y="516" width="60" height="9" rx="2" fill="#A07654"/>
<rect x="640" y="-600" width="3" height="1216" fill="#4E3223"/>
`;

const SACKS = `
<g>
  <path d="M-58 612C-70 548-62 486-34 466C-12 452 22 452 40 466C64 486 70 548 60 612Z" fill="#C9A46B" stroke="#A8834D" stroke-width="3"/>
  <path d="M-26 470Q2 462 30 470" stroke="#8E6B3A" stroke-width="3" fill="none"/>
  <circle cx="2" cy="530" r="18" fill="none" stroke="#7E6A45" stroke-width="3" opacity=".55"/>
  <path d="M2 518Q12 530 2 542Q-8 530 2 518Z" fill="#7E6A45" opacity=".55"/>
  <path d="M28 612C24 570 32 536 52 524C68 516 88 518 98 530C112 546 112 580 106 612Z" fill="#D3B07A" stroke="#A8834D" stroke-width="3"/>
  <g fill="#8FAA5C"><ellipse cx="-66" cy="606" rx="5" ry="3.4"/><ellipse cx="-78" cy="608" rx="5" ry="3.4" transform="rotate(30 -78 608)"/><ellipse cx="118" cy="607" rx="5" ry="3.4"/></g>
</g>
`;

const TABLE = `
<ellipse cx="130" cy="612" rx="120" ry="7" fill="#000" opacity=".12"/>
<rect x="40" y="524" width="12" height="88" rx="3" fill="#7A4F32"/>
<rect x="208" y="524" width="12" height="88" rx="3" fill="#7A4F32"/>
<rect x="46" y="570" width="168" height="8" rx="2" fill="#8A5B3A"/>
<rect x="70" y="548" width="44" height="22" rx="3" fill="#B98352"/>
<g fill="#8FAA5C"><ellipse cx="82" cy="548" rx="5" ry="3.4"/><ellipse cx="94" cy="546" rx="5" ry="3.4"/><ellipse cx="104" cy="548" rx="5" ry="3.4"/></g>
<rect x="30" y="510" width="200" height="16" rx="3" fill="#8A5B3A"/>
<rect x="25" y="498" width="210" height="14" rx="4" fill="#A77446"/>
<rect x="25" y="498" width="210" height="4" rx="2" fill="#C59462"/>
`;

const STOVE = `
<rect x="62" y="470" width="136" height="30" rx="6" fill="#2E2B2B"/>
<rect x="62" y="470" width="136" height="5" rx="2" fill="#4A4545"/>
<circle cx="84" cy="486" r="5" fill="#8C8580"/><circle cx="176" cy="486" r="5" fill="#8C8580"/>
<ellipse cx="130" cy="468" rx="36" ry="5" fill="#4A4646"/>
`;

function panMarkup() {
  let beans = '';
  const spots = [
    [-40, -3, 20], [-28, 2, -30], [-16, -4, 60], [-4, 3, 10], [8, -3, -50], [20, 2, 35], [32, -2, -15], [42, 2, 70],
    [-34, 6, -60], [-20, 8, 15], [-6, 9, -20], [8, 8, 45], [22, 8, -35], [36, 6, 10], [-12, -8, 80], [14, -8, -70],
  ];
  const extra = [[-48, 3, 40], [48, -4, -40], [-26, -9, 25], [26, -9, -25], [0, -9, 5], [-44, -6, -10], [44, 8, 60], [0, 12, -80]];
  const bean = ([x, y, r], cls) =>
    `<g class="bean ${cls}" transform="translate(${x} ${y}) rotate(${r})"><ellipse rx="5.4" ry="3.6"/><path d="M-4 0Q0 -1.5 4 0" stroke="#000" stroke-opacity=".25" stroke-width="1" fill="none"/></g>`;
  beans += spots.map((spot) => bean(spot, '')).join('');
  beans += extra.map((spot) => bean(spot, 'extra')).join('');
  return `
  <g data-ref="pan-scale">
    <path d="M-120 -3H-62" stroke="#3B3737" stroke-width="9" stroke-linecap="round"/>
    <rect x="-128" y="-8" width="34" height="11" rx="5" fill="#8B5A36"/>
    <path d="M-60 0Q-58 20 -30 22H30Q58 20 60 0Z" fill="#2F2C2C"/>
    <ellipse rx="60" ry="13" fill="#403B3B"/>
    <ellipse rx="54" ry="10" fill="#1F1C1C"/>
    <g data-ref="pan-beans" transform="translate(0 -1)">${beans}</g>
  </g>`;
}

function flameMarkup() {
  return `
  <ellipse class="gas-ring" cy="2" rx="40" ry="5" fill="none" stroke="#6EB6FF" stroke-width="3"/>
  <g class="flame">
    <path class="tongue t1" d="M-46 0Q-50 -12 -42 -24Q-38 -12 -32 -8Q-32 -2 -46 0Z" fill="url(#g-flame)"/>
    <path class="tongue t2" d="M-30 0Q-34 -14 -22 -28Q-12 -14 -14 0Z" fill="url(#g-flame)"/>
    <path class="tongue t3" d="M-10 0Q-12 -12 0 -22Q12 -12 10 0Z" fill="url(#g-flame)"/>
    <path class="tongue t2" d="M14 0Q12 -14 22 -28Q34 -14 30 0Z" fill="url(#g-flame)"/>
    <path class="tongue t1" d="M32 0Q32 -8 42 -24Q50 -12 46 0Z" fill="url(#g-flame)"/>
    <ellipse cy="1" rx="44" ry="3.5" fill="#6EB6FF" opacity=".8"/>
  </g>`;
}

function smokeMarkup() {
  return `
  <g class="smoke" fill="none" stroke-linecap="round">
    <path class="wisp w1" d="M-24 0Q-34 -20 -22 -40T-26 -84"/>
    <path class="wisp w2" d="M0 0Q-10 -24 4 -46T0 -96"/>
    <path class="wisp w3" d="M24 0Q34 -18 22 -38T28 -80"/>
  </g>`;
}

function helperMarkup() {
  return `
  <g class="person helper">
    <rect x="-24" y="-118" width="48" height="112" rx="16" fill="#D9A441"/>
    <path d="M-17 -104H17V-4H-17Z" fill="#F3E7D3"/>
    <path d="M-17 -104Q0 -118 17 -104" stroke="#F3E7D3" stroke-width="4" fill="none"/>
    <rect x="-9" y="-78" width="18" height="14" rx="3" fill="#E6D5BC"/>
    <rect x="-5" y="-130" width="10" height="12" fill="#C98E66"/>
    <circle cy="-142" r="17" fill="#D9A27C"/>
    <path d="M-17 -146Q-14 -164 2 -163Q18 -162 17 -144Q10 -154 -2 -153Q-12 -152 -17 -146Z" fill="#3A2418"/>
    <circle cx="10" cy="-164" r="8" fill="#3A2418"/>
    <circle cx="-7" cy="-142" r="1.8" fill="#2A1A12"/><circle cx="4" cy="-142" r="1.8" fill="#2A1A12"/>
    <g class="stir-arm">
      <path d="M-58 -84L-66 -40" stroke="#B98352" stroke-width="5" stroke-linecap="round"/>
      <path d="M-16 -100Q-36 -96 -54 -84" stroke="#D9A441" stroke-width="12" stroke-linecap="round" fill="none"/>
      <circle cx="-56" cy="-84" r="6.5" fill="#D9A27C"/>
    </g>
  </g>`;
}

function drumMarkup() {
  return `
  <ellipse cy="2" rx="86" ry="8" fill="#000" opacity=".16"/>
  <g class="machine">
    <rect x="31" y="-1300" width="18" height="1130" fill="url(#g-steel)"/>
    <path d="M31 -250H49M31 -360H49M31 -470H49M31 -580H49" stroke="#6F777E" stroke-width="5"/>
    <rect x="-56" y="-50" width="112" height="50" rx="6" fill="#232226"/>
    <rect x="-66" y="-8" width="22" height="8" rx="3" fill="#15151A"/><rect x="44" y="-8" width="22" height="8" rx="3" fill="#15151A"/>
    <ellipse data-ref="glow" cy="-40" rx="46" ry="16" fill="url(#g-glow)" opacity="0"/>
    <rect x="-66" y="-172" width="132" height="128" rx="16" fill="url(#g-enamel)"/>
    <rect x="-66" y="-126" width="132" height="8" fill="#B06B3B"/>
    <path d="M-28 -172L-40 -226H40L28 -172Z" fill="url(#g-steel)"/>
    <rect x="-44" y="-232" width="88" height="10" rx="3" fill="#C7CED4"/>
    <ellipse cy="-231" rx="40" ry="6" fill="#8FAA5C"/>
    <rect x="-10" y="-178" width="20" height="8" rx="2" fill="#6F777E"/>
    <circle cx="-8" cy="-108" r="46" fill="url(#g-copper)"/>
    <circle cx="-8" cy="-108" r="37" fill="none" stroke="#A7622F" stroke-width="3"/>
    <g fill="#F7C99A" opacity=".85">
      <circle cx="-8" cy="-150" r="2.5"/><circle cx="34" cy="-108" r="2.5"/><circle cx="-8" cy="-66" r="2.5"/><circle cx="-50" cy="-108" r="2.5"/>
      <circle cx="22" cy="-138" r="2.5"/><circle cx="22" cy="-78" r="2.5"/><circle cx="-38" cy="-78" r="2.5"/><circle cx="-38" cy="-138" r="2.5"/>
    </g>
    <circle cx="-8" cy="-108" r="22" fill="#241710"/>
    <circle data-ref="ring" cx="-8" cy="-108" r="27" fill="none" stroke="#8FAA5C" stroke-width="5" stroke-dasharray="0 170" transform="rotate(-90 -8 -108)" stroke-linecap="round"/>
    <circle data-ref="window" cx="-8" cy="-108" r="18" fill="#8FAA5C" opacity=".0"/>
    <g class="paddles" data-ref="paddles"><path d="M-8 -124V-92M-24 -108H8" stroke="#E8B27A" stroke-width="3" stroke-linecap="round" opacity=".7"/></g>
    <rect x="44" y="-156" width="20" height="54" rx="4" fill="#3D3B41"/>
    <circle cx="54" cy="-142" r="6" fill="#F3EADB"/><path d="M54 -142L57 -146" stroke="#C8553D" stroke-width="2"/>
    <circle data-ref="lamp" cx="54" cy="-122" r="3.5" fill="#6E6A6E"/>
    <circle cx="54" cy="-111" r="3.5" fill="#6E6A6E"/>
    <path d="M-44 -70L-58 -44H-40L-30 -66Z" fill="#9DA6AE"/>
    <g transform="translate(-30 -22)">
      <path d="M-40 18V2M40 18V2" stroke="#6F777E" stroke-width="5"/>
      <ellipse rx="48" ry="11" fill="#C7CED4"/>
      <ellipse rx="42" ry="8" fill="#5D646A"/>
      <ellipse data-ref="tray-beans" rx="40" ry="7" fill="#8FAA5C" opacity="0"/>
      <g transform="scale(1 .22)"><path class="tray-arm" data-ref="tray-arm" d="M0 0H38" stroke="#E4E8EB" stroke-width="10" stroke-linecap="round"/></g>
    </g>
    <g data-ref="full" opacity="0" transform="translate(40 -200)">
      <circle r="14" fill="#E0664F"/><path d="M0 -7V2M0 6V7" stroke="#FFF" stroke-width="3.5" stroke-linecap="round"/>
    </g>
    <g transform="translate(0 ${SIGN_Y})"><g class="drum-sign" data-ref="sign">
      <rect x="-25" y="-16" width="50" height="32" rx="6" fill="#F7EEDC" stroke="#8A6246" stroke-width="2.5"/>
      <g class="sign-level">
        <g transform="translate(-10 0) rotate(-25)"><ellipse data-ref="sign-bean" rx="7" ry="9.5" fill="#6E4023"/><path d="M0 -7Q-3 0 0 7" stroke="#F7EEDC" stroke-opacity=".7" stroke-width="1.6" fill="none"/></g>
        <g data-ref="sign-dots"><circle cx="11" cy="-8" r="3.2"/><circle cx="11" cy="0" r="3.2"/><circle cx="11" cy="8" r="3.2"/></g>
      </g>
      <g class="sign-auto" fill="none" stroke="#2E8C84" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M-9.4 -3.4A10 10 0 0 1 9.4 -3.4M9.4 -3.4L10.5 -9M9.4 -3.4L4 -5"/>
        <path d="M9.4 3.4A10 10 0 0 1 -9.4 3.4M-9.4 3.4L-10.5 9M-9.4 3.4L-4 5"/>
        <g transform="rotate(-25)"><ellipse rx="3.6" ry="5" fill="#6E4023" stroke="none"/></g>
      </g>
    </g></g>
  </g>
  <g class="placeholder" data-ref="placeholder">
    <path d="M-66 -44V-156Q-66 -172 -50 -172H-28L-40 -226H40L28 -172H50Q66 -172 66 -156V-44Q66 -30 52 -30H-52Q-66 -30 -66 -44Z" fill="#FFFFFF" fill-opacity=".28" stroke="#BFAE93" stroke-width="3" stroke-dasharray="10 8"/>
    <circle cy="-110" r="22" fill="#FFFFFF" fill-opacity=".55" stroke="#BFAE93" stroke-width="3"/>
    <path d="M-10 -110H10M0 -120V-100" stroke="#A89579" stroke-width="4" stroke-linecap="round"/>
  </g>`;
}

const CART_ART = `
<ellipse cx="747" cy="612" rx="96" ry="7" fill="#000" opacity=".14"/>
<path d="M668 512V410M826 512V410" stroke="#8A6246" stroke-width="6"/>
<g>
  <path d="M654 400H840V432Q832 441 824 432Q816 441 808 432Q800 441 792 432Q784 441 776 432Q768 441 760 432Q752 441 744 432Q736 441 728 432Q720 441 712 432Q704 441 696 432Q688 441 680 432Q672 441 664 432Q656 441 654 432Z" fill="#F4E6CF"/>
  <path d="M670 400V434M702 400V436M734 400V436M766 400V436M798 400V436M830 400V434" stroke="#2E8C84" stroke-width="16"/>
  <rect x="650" y="394" width="194" height="9" rx="4" fill="#24716B"/>
</g>
<g data-ref="seller" class="person">
  <rect x="728" y="468" width="40" height="50" rx="14" fill="#3D5A80"/>
  <rect x="742" y="458" width="12" height="12" fill="#B97A55"/>
  <circle cx="748" cy="448" r="15" fill="#C98E66"/>
  <path d="M733 446Q734 428 750 429Q765 430 763 448Q757 438 748 438Q739 438 733 446Z" fill="#1E1A18"/>
  <circle cx="743" cy="449" r="1.6" fill="#2A1A12"/><circle cx="753" cy="449" r="1.6" fill="#2A1A12"/>
  <path d="M732 470H764V482H732Z" fill="#F3E7D3" opacity=".9"/>
</g>
<rect x="662" y="508" width="170" height="13" rx="3" fill="#B98352"/>
<rect x="662" y="518" width="170" height="3" fill="#946338"/>
<rect x="672" y="521" width="150" height="62" rx="10" fill="#2E8C84"/>
<rect x="672" y="521" width="150" height="8" fill="#F1E3C6"/>
<rect x="672" y="574" width="150" height="9" rx="4" fill="#24716B"/>
<circle cx="747" cy="552" r="17" fill="#F1E3C6"/>
<g transform="translate(747 552) rotate(-25)"><ellipse rx="9" ry="12.5" fill="#6E4023"/><path d="M0 -10Q-4 0 0 10" stroke="#F1E3C6" stroke-width="2.4" fill="none"/></g>
<g>
  <circle cx="697" cy="588" r="22" fill="#2A2A2A"/><circle cx="697" cy="588" r="15" fill="#4A4646"/>
  <path d="M697 574V602M683 588H711M687 578L707 598M707 578L687 598" stroke="#C9A15C" stroke-width="2.5"/>
  <circle cx="697" cy="588" r="4.5" fill="#C9A15C"/>
  <circle cx="797" cy="588" r="22" fill="#2A2A2A"/><circle cx="797" cy="588" r="15" fill="#4A4646"/>
  <path d="M797 574V602M783 588H811M787 578L807 598M807 578L787 598" stroke="#C9A15C" stroke-width="2.5"/>
  <circle cx="797" cy="588" r="4.5" fill="#C9A15C"/>
</g>
<g data-ref="stock"></g>
`;

const SIGN = `
<g transform="translate(0 -68)">
<path d="M640 300H724" stroke="#2A1D17" stroke-width="6" stroke-linecap="round"/>
<path d="M646 300L668 322" stroke="#2A1D17" stroke-width="4"/>
<g class="swing">
  <path d="M672 300V314M712 300V314" stroke="#6F777E" stroke-width="2.5"/>
  <rect x="656" y="312" width="72" height="52" rx="10" fill="#2A1D17" stroke="#E0B25A" stroke-width="3.5"/>
  <g transform="translate(692 340) rotate(-25)"><ellipse rx="11" ry="15" fill="#C8783F"/><path d="M0 -12Q-5 0 0 12" stroke="#2A1D17" stroke-width="2.6" fill="none"/></g>
  <path d="M708 326Q712 320 708 314M716 330Q720 324 716 318" stroke="#F4E6CF" stroke-width="2.4" fill="none" stroke-linecap="round"/>
</g>
</g>
`;

function bikeMarkup() {
  return `
  <g class="bike">
    <ellipse cy="2" rx="70" ry="6" fill="#000" opacity=".18"/>
    <g class="wheel"><circle cx="-44" cy="-20" r="20" fill="none" stroke="#222" stroke-width="5"/><path d="M-44 -38V-2M-62 -20H-26" stroke="#666" stroke-width="2"/></g>
    <g class="wheel"><circle cx="42" cy="-20" r="20" fill="none" stroke="#222" stroke-width="5"/><path d="M42 -38V-2M24 -20H60" stroke="#666" stroke-width="2"/></g>
    <path d="M-44 -20L-20 -46H22L42 -20M-6 -46L4 -70M22 -46L28 -62" stroke="#2F5D57" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="-84" y="-86" width="64" height="44" rx="6" fill="#2FA39A"/>
    <rect x="-84" y="-86" width="64" height="9" rx="4" fill="#24756F"/>
    <path d="M-52 -74L-47 -64H-36L-45 -57L-41 -46L-52 -53L-63 -46L-59 -57L-68 -64H-57Z" fill="#F2C14E"/>
    <path d="M12 -60Q16 -84 30 -88" stroke="#E07A5F" stroke-width="13" stroke-linecap="round" fill="none"/>
    <path d="M26 -84L-6 -70" stroke="#E07A5F" stroke-width="7" stroke-linecap="round"/>
    <circle cx="34" cy="-104" r="12" fill="#C98E66"/>
    <path d="M22 -106Q24 -122 36 -121Q48 -120 46 -104Z" fill="#2FA39A"/>
    <g data-ref="bike-badge" class="badge">
      <circle cx="-52" cy="-118" r="16" fill="#F2C14E" stroke="#FFF" stroke-width="3"/>
      <path d="M-52 -127V-116M-52 -110V-109" stroke="#2A1D17" stroke-width="4" stroke-linecap="round"/>
    </g>
  </g>`;
}

// ---- Guests ------------------------------------------------------------------

const COATS = ['#3D5A80', '#E07A5F', '#81B29A', '#6D597A', '#F2A541', '#4A6C6F', '#B5838D', '#52796F'];
const SKINS = ['#F1C7A5', '#D9A27C', '#B97A55', '#8D5A3B', '#EFD2B9'];
const HAIRS = ['#2B1D14', '#6B4226', '#C99A5B', '#1C1C1C', '#A0522D', '#D6CEC4'];
const PANTS = ['#2F3E46', '#3A3A3A', '#5C4B3B', '#354F52'];

function darker(hex, amount = 0.2) {
  const n = Number.parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * (1 - amount)));
  return rgb(c);
}

function hairPath(style, color) {
  if (style === 0) return `<path d="M-12 -120Q-12 -134 0 -134Q12 -134 12 -120Q6 -127 0 -127Q-6 -127 -12 -120Z" fill="${color}"/>`;
  if (style === 1) return `<path d="M-12 -118Q-13 -134 0 -134Q13 -134 12 -118Q7 -128 -1 -127Q-8 -126 -12 -118Z" fill="${color}"/><circle cx="-9" cy="-132" r="6" fill="${color}"/>`;
  if (style === 2) return `<path d="M-13 -104Q-15 -134 0 -134Q15 -134 13 -104Q12 -116 9 -124Q0 -128 -9 -124Q-12 -116 -13 -104Z" fill="${color}"/>`;
  return `<path d="M-13 -120Q-13 -136 0 -136Q13 -136 13 -120Z" fill="${color}"/><rect x="-14" y="-122" width="28" height="5" rx="2.5" fill="${darker(color, 0.25)}"/>`;
}

function guestMarkup(look) {
  const coat = COATS[look % COATS.length];
  const skin = SKINS[Math.floor(look / 8) % SKINS.length];
  const hair = HAIRS[Math.floor(look / 40) % HAIRS.length];
  const pants = PANTS[Math.floor(look / 7) % PANTS.length];
  const style = Math.floor(look / 3) % 4;
  const hat = style === 3 ? COATS[(look + 3) % COATS.length] : hair;
  return `
  <ellipse rx="22" ry="4.5" fill="#000" opacity=".16"/>
  <g class="flip"><g class="figure">
    <g class="leg leg-a"><rect x="-9" y="-48" width="8" height="46" rx="3.5" fill="${pants}"/><ellipse cx="-7" cy="-2" rx="7" ry="3.5" fill="#2A2320"/></g>
    <g class="leg leg-b"><rect x="1" y="-48" width="8" height="46" rx="3.5" fill="${darker(pants, 0.15)}"/><ellipse cx="3" cy="-2" rx="7" ry="3.5" fill="#2A2320"/></g>
    <path d="M-16 -90Q-18 -56 -15 -42H15Q18 -56 16 -90Q12 -102 0 -102Q-12 -102 -16 -90Z" fill="${coat}"/>
    <path d="M0 -100V-44" stroke="${darker(coat, 0.18)}" stroke-width="1.5"/>
    <rect x="-4" y="-108" width="8" height="8" fill="${darker(skin, 0.08)}"/>
    <circle cy="-119" r="12" fill="${skin}"/>
    ${hairPath(style, hat)}
    <circle cx="-5" cy="-119" r="1.5" fill="#2A1A12"/>
    <g class="arm"><rect x="-5" y="-96" width="9" height="40" rx="4.5" fill="${darker(coat, 0.12)}"/><circle cx="-0.5" cy="-56" r="4.5" fill="${skin}"/>
      <g class="carried" opacity="0"><rect x="-9" y="-58" width="18" height="22" rx="3" fill="url(#g-kraft)"/><rect class="carried-label" x="-9" y="-50" width="18" height="6" fill="#E0803C"/></g>
      <g class="carried-cup" opacity="0" transform="translate(0 -50)">${cupMarkup()}</g>
    </g>
  </g></g>
  <g class="bubble" transform="translate(0 -160)"><g class="bubble-body">
    <path class="bubble-shape" d="M-24 -20H24Q30 -20 30 -14V10Q30 16 24 16H6L0 24L-6 16H-24Q-30 16 -30 10V-14Q-30 -20 -24 -20Z" fill="#FFFDF8" stroke="#2A1D17" stroke-opacity=".15" stroke-width="2"/>
    <g class="wish">
      <g transform="translate(-9 -2) rotate(-25)"><ellipse class="wish-bean" rx="9" ry="12" fill="#6E4023"/><path d="M0 -9Q-4 0 0 9" stroke="#FFFDF8" stroke-opacity=".7" stroke-width="2" fill="none"/></g>
      <g class="wish-dots"><circle cx="15" cy="-8" r="3.6"/><circle cx="15" cy="0" r="3.6"/><circle cx="15" cy="8" r="3.6"/></g>
    </g>
    <g class="wish-cup" transform="translate(-1 9) scale(1.7)">${cupMarkup()}<path d="M-2 -13Q-4 -15 -2 -17M2 -13Q0 -15 2 -17" stroke="#C9B9A6" stroke-width="1" fill="none" stroke-linecap="round"/></g>
    <text class="sigh" x="0" y="4" text-anchor="middle" font-size="22" font-weight="700" fill="#6B5B4E">…</text>
  </g></g>`;
}

// ---- The scene ---------------------------------------------------------------

export function createScene(svg, { firstCrack, slots, levels, espresso: espressoSettings = {} }) {
  FIRST_CRACK = firstCrack;
  SLOTS = slots;
  LABEL_COLORS = Object.fromEntries(levels.map((level) => [level.id, level.color]));
  LEVEL_DOTS = Object.fromEntries(levels.map((level, index) => [level.id, index + 1]));
  LEVEL_ROAST = Object.fromEntries(levels.map((level) => [level.id, level.target]));
  ESPRESSO_ORDER = espressoSettings.order ?? ESPRESSO_ORDER;
  ESPRESSO_CUPS = espressoSettings.cups ?? 0;
  // One shelf per roast level, side by side on the counter of the cart.
  SHELF_X = Object.fromEntries(levels.map((level, index) => [level.id, 662 + ((index + 0.5) * 170) / levels.length]));
  svg.setAttribute('viewBox', '0 0 1000 700');
  svg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
  el('defs', {}, svg).innerHTML = DEFS;

  group(svg, STREET);
  const harbor = group(svg, HARBOR, { class: 'harbor hidden' });
  const cafe = group(svg, CAFE, { class: 'cafe hidden' });
  group(svg, ROOM);
  group(svg, WALL);
  const sign = group(svg, SIGN, { class: 'sign hidden' });
  group(svg, SACKS);

  const drums = DRUM_X.map((x) => {
    const g = group(svg, drumMarkup(), { class: 'drum empty-slot', transform: `translate(${x} ${FLOOR})` });
    return { g, x, ref: (name) => g.querySelector(`[data-ref="${name}"]`) };
  });

  const helper = group(svg, helperMarkup(), { class: 'helper-wrap hidden', transform: `translate(178 ${FLOOR - 108})` });
  group(svg, TABLE);
  group(svg, STOVE);
  const flame = group(svg, flameMarkup(), { transform: `translate(${PAN.x} 466)`, class: 'flame-wrap off' });
  const pan = group(svg, panMarkup(), { transform: `translate(${PAN.x} ${PAN.y})`, class: 'pan' });
  const smoke = group(svg, smokeMarkup(), { transform: `translate(${PAN.x} ${PAN.y - 14})`, class: 'smoke-wrap' });
  const sieve = group(
    svg,
    `<ellipse rx="22" ry="6" fill="#C7CED4"/><ellipse rx="18" ry="4" fill="#5D646A"/><ellipse data-ref="sieve-beans" rx="16" ry="3.6" fill="#8FAA5C" opacity="0"/>`,
    { transform: `translate(${SIEVE.x} ${SIEVE.y})` },
  );
  const panHit = el('rect', { x: 20, y: 360, width: 210, height: 150, fill: 'transparent', 'data-hit': 'pan', class: 'hit' }, svg);

  const diploma = group(svg, DIPLOMA, { class: 'diploma hidden' });
  const espresso = group(svg, ESPRESSO, { class: 'espresso hidden' });
  group(svg, CART_ART);
  const board = group(svg, BOARD, { class: 'board hidden' });
  const stockLayer = svg.querySelector('[data-ref="stock"]');
  const guestsLayer = group(svg, '', { class: 'guests' });
  // The cargo bike rides past on the road now and then (see styles.css).
  const cargoBike = group(svg, cargoBikeMarkup(), { class: 'cargo-bike hidden', transform: 'translate(0 698)' });
  const bike = group(svg, bikeMarkup(), { class: 'bike-wrap hidden', transform: `translate(1200 ${BIKE_Y})` });
  const bikeHit = el('rect', { x: -95, y: -140, width: 170, height: 150, fill: 'transparent', 'data-hit': 'delivery', class: 'hit' }, bike);
  drums.forEach(({ g }, index) => {
    el('rect', { x: -70, y: -240, width: 140, height: 250, fill: 'transparent', 'data-hit': `drum-${index}`, class: 'hit' }, g);
  });
  // Big enough to tap on a phone (about 44 px), though the machine is small.
  const espressoHit = el('rect', { x: MACHINE.x - 44, y: MACHINE.y - 90, width: 126, height: 114, fill: 'transparent', 'data-hit': 'espresso', class: 'hit hidden' }, svg);
  const fxLayer = group(svg, '', { class: 'fx' });

  const buildings = svg.querySelector('[data-ref="buildings"]');
  const harborBuildings = svg.querySelector('[data-ref="harbor-buildings"]');
  const panBeans = [...pan.querySelectorAll('.bean')];
  const brewFill = espresso.querySelector('[data-ref="brew-fill"]');
  const readyCups = [...espresso.querySelectorAll('.ready-cup')];
  let cupsShown = 0;
  const sieveBeans = sieve.querySelector('[data-ref="sieve-beans"]');
  const guestNodes = new Map();
  const particles = [];
  let stockShown = [];
  let lastPanColor = '';

  function toClient(x, y) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(x, y).matrixTransform(matrix);
    return { x: point.x, y: point.y };
  }

  // ---- Particles ----

  function spawn(node, from, to, duration, lift, spin = 0) {
    fxLayer.appendChild(node);
    particles.push({ node, from, to, duration, lift, spin, t: 0 });
  }

  function flyBeans(from, to, color, count, spread = 18) {
    for (let i = 0; i < count; i += 1) {
      const node = el('ellipse', { rx: 5, ry: 3.4, fill: color });
      const start = { x: from.x + (Math.random() - 0.5) * spread, y: from.y + (Math.random() - 0.5) * 6 };
      const end = { x: to.x + (Math.random() - 0.5) * spread, y: to.y + (Math.random() - 0.5) * 4 };
      spawn(node, start, end, 0.45 + Math.random() * 0.25, 40 + Math.random() * 50, (Math.random() - 0.5) * 720);
    }
  }

  function flyBag(from, to, level) {
    const node = el('g');
    node.innerHTML = `<rect x="-9" y="-12" width="18" height="24" rx="3" fill="url(#g-kraft)"/><rect x="-9" y="-3" width="18" height="7" fill="${LABEL_COLORS[level]}"/>`;
    spawn(node, from, to, 0.7, 90);
  }

  function burst(at, color, count = 8, radius = 34) {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const node = el('path', { d: 'M0 -5L1.5 -1.5L5 0L1.5 1.5L0 5L-1.5 1.5L-5 0L-1.5 -1.5Z', fill: color });
      const end = { x: at.x + Math.cos(angle) * radius, y: at.y + Math.sin(angle) * radius * 0.7 };
      spawn(node, at, end, 0.5, 6, 180);
    }
  }

  function puff(at) {
    const node = el('circle', { r: 10, fill: '#FFFFFF', opacity: 0.6 });
    spawn(node, at, { x: at.x + (Math.random() - 0.5) * 30, y: at.y - 70 }, 1.2, 0);
    node.dataset.fade = '1';
  }

  function stepParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.t += dt;
      const f = Math.min(1, p.t / p.duration);
      const x = p.from.x + (p.to.x - p.from.x) * f;
      const y = p.from.y + (p.to.y - p.from.y) * f - Math.sin(Math.PI * f) * p.lift;
      const scale = p.node.dataset.fade ? 1 + f * 1.4 : 1;
      p.node.setAttribute('transform', `translate(${x} ${y}) rotate(${p.spin * f}) scale(${scale})`);
      if (p.node.dataset.fade) p.node.setAttribute('opacity', String(0.55 * (1 - f)));
      if (f >= 1) {
        p.node.remove();
        particles.splice(i, 1);
      }
    }
  }

  // ---- Stock on the cart ----

  function bagMarkup(level) {
    return `<path d="M-8 12V-8L-5 -12H5L8 -8V12Z" fill="url(#g-kraft)" stroke="#A47A45" stroke-width="1"/><rect x="-8" y="-1" width="16" height="6" fill="${LABEL_COLORS[level]}"/>`;
  }

  // The place of the slot-th bag on a roast's shelf: three in front, the
  // rest in a row behind them.
  function stockPosition(level, slot) {
    const back = slot >= 3;
    const k = back ? slot - 3 : slot - 1;
    return { x: SHELF_X[level] + (back ? (k - 0.5) * 18 : k * 18), y: CART.counter - (back ? 36 : 12) };
  }

  function renderStock(stock) {
    const same = stock.length === stockShown.length && stock.every((level, i) => level === stockShown[i]);
    if (same) return;
    const grew = stock.length > stockShown.length;
    const counts = {};
    const bags = stock.map((level, index) => {
      const slot = counts[level] ?? 0;
      counts[level] = slot + 1;
      return { level, slot, newest: grew && index === stock.length - 1 };
    });
    // The back row first, so the front row covers it.
    bags.sort((a, b) => Number(b.slot >= 3) - Number(a.slot >= 3));
    stockLayer.replaceChildren();
    for (const { level, slot, newest } of bags) {
      const { x, y } = stockPosition(level, slot);
      const place = group(stockLayer, '', { transform: `translate(${x} ${y})` });
      const bag = group(place, bagMarkup(level));
      if (newest) bag.classList.add('pop');
    }
    stockShown = [...stock];
  }

  // ---- Guests ----

  function syncGuests(customers, dt) {
    const seen = new Set();
    for (const guest of customers) {
      seen.add(guest.id);
      let node = guestNodes.get(guest.id);
      if (!node) {
        const g = group(guestsLayer, guestMarkup(guest.look), { class: 'guest' });
        node = { g, x: guest.x, dots: [...g.querySelectorAll('.wish-dots circle')] };
        if (guest.order === ESPRESSO_ORDER) {
          g.classList.add('espresso');
        } else {
          g.querySelector('.wish-bean').setAttribute('fill', roastColor(LEVEL_ROAST[guest.order]));
          node.dots.forEach((dot, i) => {
            dot.setAttribute('fill', i < LEVEL_DOTS[guest.order] ? LABEL_COLORS[guest.order] : '#E6DDD2');
          });
        }
        guestNodes.set(guest.id, node);
      }
      const moving = Math.abs(guest.x - node.x) > 0.01;
      const leaving = guest.phase === 'out';
      node.g.classList.toggle('walking', moving);
      node.g.classList.toggle('leaving', leaving);
      node.g.classList.toggle('passing', guest.phase === 'pass' || (leaving && !guest.bag));
      node.g.classList.toggle('served', Boolean(guest.bag));
      node.g.classList.toggle('impatient', guest.phase === 'queue' && guest.patience < IMPATIENT_SECONDS);
      if (guest.bag && !node.bagSet) {
        if (guest.bag !== ESPRESSO_ORDER) node.g.querySelector('.carried-label').setAttribute('fill', LABEL_COLORS[guest.bag]);
        node.bagSet = true;
      }
      node.x = guest.x;
      node.g.setAttribute('transform', `translate(${guest.x} ${FLOOR})`);
    }
    for (const [id, node] of guestNodes) {
      if (!seen.has(id)) {
        node.g.remove();
        guestNodes.delete(id);
      }
    }
  }

  // ---- Frame update ----

  function update(s, dt) {
    const panState = s.pan;
    const roasting = panState.phase === 'roasting';
    flame.classList.toggle('off', !roasting);
    const color = roasting ? roastColor(panState.p) : panState.phase === 'empty' ? 'none' : roastColor(panState.p);
    if (color !== lastPanColor) {
      for (const bean of panBeans) bean.setAttribute('fill', color === 'none' ? '#8FAA5C' : color);
      pan.classList.toggle('empty', panState.phase !== 'roasting');
      lastPanColor = color;
    }
    pan.classList.toggle('bigger', s.owned.biggerPan > 0);
    smoke.style.opacity = roasting ? String(Math.min(0.9, 0.15 + panState.p)) : '0';
    smoke.classList.toggle('dark', roasting && panState.p > 0.7);
    const cooling = panState.phase === 'cooling' || panState.phase === 'waiting';
    sieveBeans.setAttribute('opacity', cooling ? '1' : '0');
    if (cooling && panState.batch) sieveBeans.setAttribute('fill', roastColor(LEVEL_ROAST[panState.batch.level]));
    helper.classList.toggle('hidden', !(s.owned.helper > 0));
    helper.classList.toggle('busy', s.owned.helper > 0 && roasting);

    drums.forEach((drum, index) => {
      const state = s.drums[index];
      drum.g.classList.toggle('empty-slot', !state);
      drum.g.classList.toggle('next-slot', !state && index === s.drums.length && s.owned.helper > 0);
      if (!state) return;
      const active = state.phase === 'roasting';
      drum.g.classList.toggle('roasting', active);
      drum.ref('glow').setAttribute('opacity', active ? '1' : '0');
      drum.ref('ring').setAttribute('stroke-dasharray', `${(active ? state.p : 0) * 170} 170`);
      drum.ref('ring').setAttribute('stroke', roastColor(state.p));
      drum.ref('window').setAttribute('fill', roastColor(state.p));
      drum.ref('window').setAttribute('opacity', active ? '1' : '0');
      drum.ref('lamp').setAttribute('fill', active ? (state.p >= FIRST_CRACK ? '#F2C14E' : '#7BC96F') : '#6E6A6E');
      const trayFull = state.phase === 'cooling' || state.phase === 'waiting';
      drum.ref('tray-beans').setAttribute('opacity', trayFull ? '1' : '0');
      if (trayFull && state.batch) drum.ref('tray-beans').setAttribute('fill', roastColor(LEVEL_ROAST[state.batch.level]));
      drum.g.classList.toggle('cooling', trayFull);
      drum.ref('full').setAttribute('opacity', state.phase === 'waiting' ? '1' : '0');
      if (drum.level !== state.level) {
        drum.level = state.level;
        const auto = state.level === 'auto';
        drum.ref('sign').classList.toggle('auto', auto);
        if (!auto) {
          drum.ref('sign-bean').setAttribute('fill', roastColor(LEVEL_ROAST[state.level]));
          [...drum.ref('sign-dots').children].forEach((dot, i) => {
            dot.setAttribute('fill', i < LEVEL_DOTS[state.level] ? LABEL_COLORS[state.level] : '#E6DDD2');
          });
        }
      }
    });

    cafe.classList.toggle('hidden', !(s.owned.cafe > 0));
    buildings.classList.toggle('hidden', s.owned.cafe > 0);
    board.classList.toggle('hidden', !(s.owned.board > 0));
    const machine = s.owned.espresso > 0 && s.owned.cafe > 0;
    espresso.classList.toggle('hidden', !machine);
    espressoHit.classList.toggle('hidden', !machine);
    if (machine) {
      const cups = Math.min(s.espresso.cups, readyCups.length);
      if (cups !== cupsShown) {
        readyCups.forEach((cup, i) => cup.classList.toggle('hidden', i >= cups));
        if (cups > cupsShown) readyCups[cups - 1]?.classList.add('pop');
        cupsShown = cups;
      }
      brewFill.setAttribute('width', String(32 * Math.min(1, s.espresso.p)));
      espresso.classList.toggle('full', s.espresso.cups >= ESPRESSO_CUPS);
    }
    cargoBike.classList.toggle('hidden', !(s.owned.cargoBike > 0));
    diploma.classList.toggle('hidden', !(s.owned.diploma > 0));
    flame.classList.toggle('strong', s.owned.burner > 0);
    // Every location after the first one is at the harbor.
    harbor.classList.toggle('hidden', !(s.location > 0));
    harborBuildings.classList.toggle('hidden', s.owned.cafe > 0);
    sign.classList.toggle('hidden', !(s.owned.sign > 0));
    renderStock(s.stock);
    syncGuests(s.customers, dt);

    const d = s.delivery;
    bike.classList.toggle('hidden', !d);
    if (d) {
      bike.setAttribute('transform', `translate(${d.x} ${BIKE_Y})`);
      bike.classList.toggle('waiting', d.phase === 'wait' && !d.caught);
      bike.classList.toggle('riding', d.phase !== 'wait');
      bike.classList.toggle('leaving', d.phase === 'out');
    }
    stepParticles(dt);
  }

  // ---- Effects for model events ----

  function roasterPoint(which) {
    if (which === 'pan') return { x: PAN.x, y: PAN.y - 6 };
    return { x: DRUM_X[which] - 8, y: FLOOR - 108 };
  }

  function trayPoint(which) {
    if (which === 'pan') return { x: SIEVE.x, y: SIEVE.y - 4 };
    return { x: DRUM_X[which] - 30, y: FLOOR - 26 };
  }

  function effect(event, s) {
    switch (event.type) {
      case 'load':
        if (event.roaster === 'pan') flyBeans({ x: 20, y: 470 }, { x: PAN.x, y: PAN.y - 4 }, '#8FAA5C', 7, 40);
        break;
      case 'stir':
        if (event.roaster === 'pan') {
          pan.classList.remove('stirred');
          void pan.getBBox();
          pan.classList.add('stirred');
        }
        break;
      case 'brewTap':
        puff({ x: MACHINE.x, y: MACHINE.y - 30 });
        break;
      case 'switch': {
        const sign = drums[event.roaster]?.ref('sign');
        sign?.classList.remove('pop');
        void sign?.getBBox();
        sign?.classList.add('pop');
        break;
      }
      case 'crack':
        burst(roasterPoint(event.roaster), '#FFE3A3', event.roaster === 'pan' ? 10 : 6);
        break;
      case 'secondCrack':
        burst(roasterPoint(event.roaster), '#FFC37A', 6, 26);
        break;
      case 'eject': {
        const color = roastColor(LEVEL_ROAST[event.level]);
        flyBeans(roasterPoint(event.roaster), trayPoint(event.roaster), color, event.roaster === 'pan' ? 9 : 12, 20);
        puff(trayPoint(event.roaster));
        break;
      }
      case 'bag': {
        const slot = Math.max(0, s.stock.filter((level) => level === event.level).length - 1);
        flyBag(trayPoint(event.roaster), stockPosition(event.level, slot), event.level);
        break;
      }
      case 'purchase':
        if (event.id === 'drum') burst({ x: DRUM_X[s.drums.length - 1], y: FLOOR - 110 }, '#F2C14E', 14, 90);
        if (event.id === 'helper') burst({ x: 178, y: 420 }, '#F2C14E', 12, 60);
        if (event.id === 'sign') burst({ x: 692, y: 270 }, '#F2C14E', 10, 50);
        if (event.id === 'cafe') burst({ x: 779, y: 300 }, '#F2C14E', 18, 140);
        if (event.id === 'biggerPan') burst({ x: PAN.x, y: PAN.y }, '#F2C14E', 10, 70);
        if (event.id === 'board') burst({ x: 832, y: 580 }, '#F2C14E', 10, 50);
        if (event.id === 'espresso') burst({ x: 712, y: 376 }, '#F2C14E', 12, 60);
        if (event.id === 'cargoBike') burst({ x: 900, y: 640 }, '#F2C14E', 12, 80);
        if (event.id === 'burner') burst({ x: PAN.x, y: 466 }, '#6EB6FF', 14, 60);
        if (event.id === 'diploma') burst({ x: 272, y: 214 }, '#F2C14E', 12, 60);
        break;
      default:
        break;
    }
  }

  return {
    svg,
    update,
    effect,
    toClient,
    points: {
      pan: { x: PAN.x, y: PAN.y - 30 },
      cart: { x: CART.x, y: CART.counter - 40 },
      queue: { x: SLOTS[1], y: FLOOR - 170 },
      drum: (index) => ({ x: DRUM_X[index], y: FLOOR - 120 }),
      drumSign: (index) => ({ x: DRUM_X[index], y: FLOOR + SIGN_Y - 30 }),
      espresso: { x: MACHINE.x + 10, y: MACHINE.y - 40 },
      guest: (x) => ({ x, y: FLOOR - 130 }),
      bike: (x) => ({ x: x - 30, y: BIKE_Y - 90 }),
    },
    hits: { pan: panHit, bike: bikeHit },
  };
}

// Icons for the next locations in the upgrade list, keyed by location id.
export const LOCATION_ICONS = {
  harbor:
    '<svg viewBox="0 0 40 40"><path d="M5 36V15L20 6L35 15V36Z" fill="#B4553E"/><path d="M3 16L20 5L37 16" stroke="#8C3F31" stroke-width="3" fill="none" stroke-linejoin="round"/><path d="M14 36V25A6 6 0 0 1 26 25V36Z" fill="#FFD98A" stroke="#EBD7B5" stroke-width="2"/><circle cx="20" cy="15" r="3" fill="#FFD98A" stroke="#EBD7B5" stroke-width="1.5"/></svg>',
};

// Icons for the upgrade list, keyed by item id, and the currency.
export const ITEM_ICONS = {
  board:
    '<svg viewBox="0 0 40 40"><path d="M9 37L17 5H23L31 37" stroke="#8B5A36" stroke-width="3" fill="none" stroke-linejoin="round"/><rect x="11" y="9" width="18" height="22" rx="2" fill="#2A2A2A" stroke="#8B5A36" stroke-width="2"/><path d="M15 16H23V20Q23 24 19 24Q15 24 15 20Z M23 17.5Q26 17.5 26 19.5Q26 21.5 23 21.5" stroke="#F4E6CF" stroke-width="1.6" fill="none"/></svg>',
  espresso:
    '<svg viewBox="0 0 40 40"><rect x="8" y="7" width="24" height="26" rx="3" fill="#C9CFD4" stroke="#7A838B" stroke-width="1.5"/><rect x="8" y="7" width="24" height="7" rx="3" fill="#8E979E"/><rect x="16" y="14" width="8" height="5" rx="1" fill="#4A4646"/><path d="M15 24H23V27Q23 30 19 30Q15 30 15 27Z" fill="#F4E6CF"/><rect x="6" y="32" width="28" height="4" rx="2" fill="#4A4646"/><circle cx="27" cy="10.5" r="1.8" fill="#E0664F"/></svg>',
  cargoBike:
    '<svg viewBox="0 0 40 40"><circle cx="9" cy="30" r="6" fill="none" stroke="#2A2A2A" stroke-width="2.5"/><circle cx="32" cy="30" r="6" fill="none" stroke="#2A2A2A" stroke-width="2.5"/><rect x="2" y="13" width="15" height="10" rx="2" fill="#C8783F"/><path d="M9 30L17 23H26L32 30M17 23L15 12M26 23L23 15" stroke="#2E8C84" stroke-width="2.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/><rect x="21" y="13" width="7" height="3" rx="1.5" fill="#2A2A2A"/></svg>',
  burner:
    '<svg viewBox="0 0 40 40"><ellipse cx="20" cy="33" rx="13" ry="3.5" fill="#4A4646"/><path d="M20 5Q30 15 27 24Q25 31 20 31Q15 31 13 24Q10 15 20 5Z" fill="#6EB6FF"/><path d="M20 13Q26 20 24 25Q23 29 20 29Q17 29 16 25Q14 20 20 13Z" fill="#E8F4FF"/></svg>',
  diploma:
    '<svg viewBox="0 0 40 40"><rect x="4" y="7" width="32" height="23" rx="2" fill="#F7EEDC" stroke="#8B5A36" stroke-width="2.5"/><path d="M10 14H30M10 18H25M10 22H20" stroke="#B9A07A" stroke-width="2" stroke-linecap="round"/><circle cx="28" cy="27" r="5" fill="#E0B25A"/><path d="M25 31L24 37L28 34.5L32 37L31 31" fill="#C8553D"/></svg>',
  biggerPan:
    '<svg viewBox="0 0 40 40"><ellipse cx="18" cy="22" rx="14" ry="5" fill="#403B3B"/><path d="M4 22Q5 30 12 30H24Q31 30 32 22Z" fill="#2F2C2C"/><path d="M32 21H38" stroke="#8B5A36" stroke-width="4" stroke-linecap="round"/><g fill="#844E2A"><ellipse cx="12" cy="21" rx="3" ry="2"/><ellipse cx="18" cy="20" rx="3" ry="2"/><ellipse cx="24" cy="22" rx="3" ry="2"/></g><path d="M30 5V15M25 10H35" stroke="#1D746D" stroke-width="3.4" stroke-linecap="round"/></svg>',
  sign: '<svg viewBox="0 0 40 40"><path d="M4 7H33" stroke="#2A1D17" stroke-width="3" stroke-linecap="round"/><path d="M12 7V12M26 7V12" stroke="#6F777E" stroke-width="2"/><rect x="7" y="12" width="26" height="21" rx="5" fill="#2A1D17" stroke="#E0B25A" stroke-width="2"/><g transform="translate(20 22.5) rotate(-25)"><ellipse rx="4.6" ry="6.2" fill="#C8783F"/><path d="M0 -5Q-2 0 0 5" stroke="#2A1D17" stroke-width="1.4" fill="none"/></g></svg>',
  helper:
    '<svg viewBox="0 0 40 40"><path d="M8 38Q8 21 20 21Q32 21 32 38Z" fill="#D9A441"/><path d="M14 23H26V38H14Z" fill="#F3E7D3"/><circle cx="20" cy="12" r="6.5" fill="#D9A27C"/><path d="M13.5 11Q14 4 20.5 4.5Q27 5 26.5 11Q24 7.5 20 7.5Q16 7.5 13.5 11Z" fill="#3A2418"/><circle cx="25" cy="5.5" r="3.2" fill="#3A2418"/></svg>',
  drum: '<svg viewBox="0 0 40 40"><path d="M29 14V2" stroke="#9DA6AE" stroke-width="3"/><path d="M15 14L13 6H27L25 14Z" fill="#9DA6AE"/><rect x="8" y="14" width="24" height="19" rx="4" fill="#2C2A30"/><circle cx="19" cy="24" r="7.5" fill="#C8783F"/><circle cx="19" cy="24" r="3.6" fill="#241710"/><rect x="10" y="33" width="20" height="4" rx="1.5" fill="#1B1A1E"/></svg>',
  profile:
    '<svg viewBox="0 0 40 40"><rect x="6" y="5" width="28" height="30" rx="5" fill="#2A1D17"/><rect x="9" y="8" width="22" height="24" rx="3" fill="#F3EADB"/><path d="M11 29Q16 27 19 21T29 13" stroke="#C8553D" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M11 13H17M11 17H15" stroke="#C4AD95" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="17" r="2.4" fill="#2FA39A"/></svg>',
  cafe: '<svg viewBox="0 0 40 40"><rect x="8" y="3" width="24" height="7" rx="2" fill="#2A1D17"/><rect x="5" y="12" width="30" height="25" fill="#7C3544"/><path d="M4 12H36V17Q34 20 32 17Q30 20 28 17Q26 20 24 17Q22 20 20 17Q18 20 16 17Q14 20 12 17Q10 20 8 17Q6 20 4 17Z" fill="#F4E6CF"/><rect x="9" y="22" width="15" height="11" rx="1.5" fill="#FFD9A0"/><rect x="27" y="22" width="5" height="15" fill="#3E1A22"/></svg>',
};

export const COIN_ICON =
  '<svg class="coin" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#C9901A"/><circle cx="16" cy="15" r="13" fill="#F2C14E"/><g transform="translate(16 15) rotate(-25)"><ellipse rx="5.5" ry="7.5" fill="#C9901A"/><path d="M0 -6Q-2.5 0 0 6" stroke="#F2C14E" stroke-width="1.6" fill="none"/></g></svg>';
