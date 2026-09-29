// Connects the model, the scene, sounds and the controls. Nothing is saved:
// a reload starts the prototype from the beginning.

import * as M from './model.js';
import { createScene, LABEL_COLORS } from './scene.js';
import { createAudio } from './audio.js';
import { TEXTS, format } from './texts.js';

const LANGUAGE_KEY = 'roastery-prototype.lang';
const ref = (name) => document.querySelector(`[data-ref="${name}"]`);

const ICONS = {
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

const COIN_SVG =
  '<svg class="coin" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#C9901A"/><circle cx="16" cy="15" r="13" fill="#F2C14E"/><g transform="translate(16 15) rotate(-25)"><ellipse rx="5.5" ry="7.5" fill="#C9901A"/><path d="M0 -6Q-2.5 0 0 6" stroke="#F2C14E" stroke-width="1.6" fill="none"/></g></svg>';

function readLanguage() {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved === 'de' || saved === 'en') return saved;
  } catch {
    // Storage may be blocked; fall back to the browser language.
  }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const code = String(tag).slice(0, 2).toLowerCase();
    if (code === 'de' || code === 'en') return code;
  }
  return 'en';
}

function readSeed() {
  const fromUrl = Number.parseInt(new URLSearchParams(location.search).get('seed') ?? '', 10);
  return Number.isFinite(fromUrl) ? fromUrl : Date.now() % 2147483647;
}

const state = M.createState(readSeed());
const scene = createScene(ref('scene'));
const audio = createAudio();
let language = readLanguage();
let text = TEXTS[language];
let numbers = new Intl.NumberFormat(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 0 });

const stage = document.querySelector('.stage');
const flyLayer = document.createElement('div');
flyLayer.className = 'fx-layer';
flyLayer.style.position = 'fixed';
flyLayer.style.zIndex = '4';
document.querySelector('.game').appendChild(flyLayer);

let shownMoney = 0;
let lastGoalKey = '';
let lastItemsKey = '';
let knownItems = new Set();
let lastFullNote = -Infinity;
let lastLostNote = -Infinity;
let lastWishKey = '';
let endAt = null;
let endShown = false;

// ---- Texts -------------------------------------------------------------------

function applyTexts() {
  text = TEXTS[language];
  numbers = new Intl.NumberFormat(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 0 });
  document.documentElement.lang = language;
  document.title = text.title;
  ref('scene').setAttribute('aria-label', text.title);
  ref('pan-title').textContent = text.pan;
  ref('label-light').textContent = text.levels.light;
  ref('label-medium').textContent = text.levels.medium;
  ref('label-dark').textContent = text.levels.dark;
  ref('eject').textContent = text.eject;
  ref('shop-title').textContent = text.shop;
  ref('stats-title').textContent = text.stats.title;
  ref('stats-cart-label').textContent = text.stats.cart;
  ref('stats-guests-label').textContent = text.stats.guests;
  ref('stats-price-label').textContent = text.stats.price;
  ref('stats-lost-label').textContent = text.stats.lost;
  ref('language').textContent = language === 'de' ? 'EN' : 'DE';
  ref('language').setAttribute('aria-label', text.language);
  ref('sound').setAttribute('aria-label', text.sound);
  ref('restart').setAttribute('aria-label', text.restart);
  ref('end-title').textContent = text.end.title;
  ref('end-body').textContent = text.end.body;
  ref('end-close').textContent = text.end.close;
  lastGoalKey = '';
  lastItemsKey = '';
}

// ---- Effects -----------------------------------------------------------------

function stagePoint(point) {
  const client = scene.toClient(point.x, point.y);
  const box = stage.getBoundingClientRect();
  return { x: client.x - box.left, y: client.y - box.top };
}

function floater(point, label, classes = '') {
  const node = document.createElement('div');
  node.className = `floater ${classes}`;
  node.textContent = label;
  const at = stagePoint(point);
  const width = stage.clientWidth;
  at.x = Math.min(Math.max(at.x, 70), width - 70);
  node.style.left = `${at.x}px`;
  node.style.top = `${at.y}px`;
  ref('fx').appendChild(node);
  node.addEventListener('animationend', () => node.remove());
}

function flyCoins(from, count = 3) {
  const pill = ref('money-pill').querySelector('.coin').getBoundingClientRect();
  const to = { x: pill.left + pill.width / 2, y: pill.top + pill.height / 2 };
  for (let i = 0; i < count; i += 1) {
    const coin = document.createElement('div');
    coin.className = 'coin-fly';
    flyLayer.appendChild(coin);
    const lift = 60 + Math.random() * 50;
    const jitter = (Math.random() - 0.5) * 30;
    const animation = coin.animate(
      [
        { transform: `translate(${from.x + jitter}px, ${from.y}px) scale(.6)`, opacity: 0 },
        { transform: `translate(${(from.x + to.x) / 2 + jitter}px, ${Math.min(from.y, to.y) - lift}px) scale(1.1)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${to.x}px, ${to.y}px) scale(.8)`, opacity: 1 },
      ],
      { duration: 650 + i * 90, easing: 'ease-in', delay: i * 60 },
    );
    animation.onfinish = () => {
      coin.remove();
      const pillNode = ref('money-pill');
      pillNode.classList.remove('bump');
      void pillNode.offsetWidth;
      pillNode.classList.add('bump');
    };
  }
}

function sceneClient(point) {
  return scene.toClient(point.x, point.y);
}

function banner(label) {
  const node = ref('banner');
  node.hidden = false;
  node.textContent = label;
  node.style.animation = 'none';
  void node.offsetWidth;
  node.style.animation = '';
}

function handle(event) {
  switch (event.type) {
    case 'load':
      if (event.roaster === 'pan') audio.play('load');
      break;
    case 'stir':
      audio.play('stir', {}, event.roaster === 'pan' ? 0.05 : 0.1);
      break;
    case 'crack':
      audio.play('crack', { quiet: event.roaster !== 'pan' }, 0.25);
      if (event.roaster === 'pan') floater(scene.points.pan, text.floaters.firstCrack, 'note');
      break;
    case 'secondCrack':
      audio.play('secondCrack', { quiet: event.roaster !== 'pan' }, 0.25);
      if (event.roaster === 'pan') floater(scene.points.pan, text.floaters.secondCrack, 'note');
      break;
    case 'eject':
      audio.play('eject', {}, 0.15);
      break;
    case 'bag':
      audio.play('bag', {}, 0.12);
      break;
    case 'sale': {
      audio.play('sale', { matched: event.matched }, 0.04);
      const guest = state.customers.find((c) => c.id === event.id);
      const point = scene.points.guest(guest?.x ?? M.SLOTS[0]);
      floater(point, `+${numbers.format(event.price)}`, 'gold');
      if (event.matched) floater({ x: point.x, y: point.y - 36 }, text.floaters.perfect, 'perfect');
      flyCoins(sceneClient(point), event.matched ? 3 : 2);
      break;
    }
    case 'lost':
      if (state.t - lastLostNote > 7) {
        lastLostNote = state.t;
        floater(scene.points.queue, text.floaters.leaving, 'note warn');
      }
      break;
    case 'purchase':
      audio.play('purchase');
      if (text.banners[event.id]) banner(text.banners[event.id]);
      break;
    case 'goal': {
      audio.play('goal');
      const box = ref('goal').getBoundingClientRect();
      flyCoins({ x: box.right - 30, y: box.top + box.height / 2 }, 3);
      break;
    }
    case 'delivery':
      audio.play('bell');
      floater({ x: 945, y: 520 }, text.floaters.delivery, 'note');
      break;
    case 'deliveryCaught': {
      audio.play('catch');
      const point = scene.points.bike(state.delivery?.x ?? 945);
      floater(point, format(text.floaters.caught, { value: numbers.format(event.reward) }), 'gold');
      flyCoins(sceneClient(point), 5);
      break;
    }
    default:
      break;
  }
  scene.effect(event, state);
}

// ---- Rendering ---------------------------------------------------------------

function renderHud(dt) {
  const target = state.money;
  shownMoney = target < shownMoney ? target : shownMoney + (target - shownMoney) * Math.min(1, dt * 10);
  if (target - shownMoney < 0.5) shownMoney = target;
  ref('money').textContent = numbers.format(Math.floor(shownMoney));
  const perMinute = M.incomePerMinute(state);
  ref('rate').textContent = perMinute > 0 ? format(text.perMinute, { value: numbers.format(perMinute) }) : '';
}

function renderGoal() {
  const goal = M.currentGoal(state);
  const key = goal ? `${goal.id}:${goal.done}:${language}` : `end:${language}`;
  if (key === lastGoalKey) return;
  lastGoalKey = key;
  const node = ref('goal');
  node.classList.toggle('done', Boolean(goal?.done));
  ref('goal-text').textContent = goal ? (goal.done ? `${text.goalDone} ${text.goals[goal.id]}` : text.goals[goal.id]) : text.end.title;
  ref('goal-reward').textContent = goal ? format(text.reward, { value: goal.reward }) : '';
}

function wishLevel() {
  return M.queue(state)[0]?.order ?? null;
}

function renderRoast() {
  const pan = state.pan;
  const roasting = pan.phase === 'roasting';
  const p = pan.phase === 'empty' ? 0 : pan.p;
  const wish = wishLevel();
  ref('needle').style.left = `${p * 100}%`;

  const wishKey = `${wish}:${language}`;
  if (wishKey !== lastWishKey) {
    lastWishKey = wishKey;
    const wishNode = ref('wish');
    if (wish) {
      const [before, after] = text.wish.split('{level}');
      const strong = document.createElement('b');
      strong.textContent = text.levels[wish];
      strong.style.color = LABEL_COLORS[wish];
      wishNode.replaceChildren(before, strong, after);
    } else {
      wishNode.textContent = text.wishNone;
    }
  }

  const target = ref('target');
  target.classList.toggle('show', Boolean(wish));
  if (wish) {
    const [from, to] = M.LEVEL_RANGES[wish];
    target.style.left = `${from * 100}%`;
    target.style.width = `${(to - from) * 100}%`;
    target.style.borderColor = LABEL_COLORS[wish];
  }
  const inWish = roasting && wish !== null && M.levelAt(p) === wish;
  ref('gauge').classList.toggle('hit', inWish);
  ref('gauge').classList.toggle('goal-match', M.currentGoal(state)?.id === 'match');

  let status;
  let alert = false;
  if (pan.phase === 'empty') status = M.isAutomatic(state, 'pan') ? text.status.emptyAuto : text.status.empty;
  else if (roasting && p < M.FIRST_CRACK) status = text.status.drying;
  else if (roasting && p < M.FIRST_CRACK + 0.06) {
    status = text.status.crack;
    alert = true;
  } else if (roasting) status = format(text.status.roast, { level: text.levels[M.levelAt(p)] });
  else if (pan.phase === 'cooling') status = text.status.cooling;
  else {
    status = text.status.waiting;
    alert = true;
  }
  if (state.owned.helper) status = `${status} · ${state.owned.profile ? text.auto.profile : text.auto.helper}`;
  const statusNode = ref('status');
  statusNode.textContent = status;
  statusNode.classList.toggle('alert', alert);

  const stir = ref('stir');
  stir.textContent = pan.phase === 'empty' ? text.load : text.stir;
  stir.disabled = !(pan.phase === 'empty' || roasting);
  const eject = ref('eject');
  eject.disabled = !(roasting && p >= M.FIRST_CRACK);
  eject.classList.toggle('ready', inWish);
}

function itemNode(item) {
  const card = document.createElement('div');
  card.className = 'item';
  card.dataset.item = item.id;
  const icon = document.createElement('div');
  icon.className = 'item-icon';
  icon.innerHTML = ICONS[item.id];
  const info = document.createElement('div');
  const name = document.createElement('div');
  name.className = 'item-name';
  name.textContent = text.items[item.id].name;
  const effect = document.createElement('div');
  effect.className = 'item-effect';
  effect.textContent = text.items[item.id].effect;
  info.append(name, effect);
  const buy = document.createElement('button');
  buy.type = 'button';
  buy.className = 'item-buy';
  buy.dataset.action = 'buy';
  buy.dataset.id = item.id;
  const price = M.itemPrice(state, item);
  buy.innerHTML = `${COIN_SVG}<span>${numbers.format(price)}</span><span class="progress"></span>`;
  buy.setAttribute('aria-label', `${text.buy}: ${text.items[item.id].name}, ${numbers.format(price)}`);
  card.append(icon, info, buy);
  return card;
}

const LOCK_SVG =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="8" rx="2" fill="currentColor"/><path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>';

function lockedNode(item) {
  const index = M.ITEMS.indexOf(item);
  const card = document.createElement('div');
  card.className = 'item locked';
  const icon = document.createElement('div');
  icon.className = 'item-icon';
  icon.innerHTML = ICONS[item.id];
  const info = document.createElement('div');
  const name = document.createElement('div');
  name.className = 'item-name';
  name.textContent = text.items[item.id].name;
  const note = document.createElement('div');
  note.className = 'lock-note';
  const condition = index === 0 ? text.lockSale : format(text.lockAfter, { name: text.items[M.ITEMS[index - 1].id].name });
  note.innerHTML = LOCK_SVG;
  note.append(condition);
  info.append(name, note);
  card.append(icon, info);
  return card;
}

function renderItems() {
  const visible = M.visibleItems(state).filter((item) => M.itemPrice(state, item) !== undefined);
  const locked = M.ITEMS.filter((item) => !item.reveal(state)).slice(0, 2);
  const key = `${visible.map((item) => `${item.id}:${M.itemPrice(state, item)}`).join('|')}|${locked.map((item) => item.id)}|${language}`;
  const list = ref('items');
  if (key !== lastItemsKey) {
    lastItemsKey = key;
    const nodes = visible.map((item) => {
      const node = itemNode(item);
      if (knownItems.has(item.id)) node.style.animation = 'none';
      return node;
    });
    knownItems = new Set(visible.map((item) => item.id));
    nodes.push(...locked.map(lockedNode));
    if (nodes.length === 0) {
      const done = document.createElement('div');
      done.className = 'teaser';
      done.textContent = text.allBought;
      nodes.push(done);
    }
    list.replaceChildren(...nodes);
  }
  for (const card of list.querySelectorAll('.item:not(.locked)')) {
    const item = M.ITEMS.find((candidate) => candidate.id === card.dataset.item);
    const price = M.itemPrice(state, item);
    const affordable = price !== undefined && state.money >= price;
    card.classList.toggle('affordable', affordable);
    const buy = card.querySelector('.item-buy');
    buy.disabled = !affordable;
    buy.querySelector('.progress').style.width = `${Math.min(100, (state.money / price) * 100)}%`;
  }
}

function renderStats() {
  const decimals = new Intl.NumberFormat(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 1 });
  const cart = ref('stats-cart');
  cart.textContent = format(text.stats.cartValue, { count: state.stock.length, capacity: M.capacity(state) });
  cart.classList.toggle('warn', state.stock.length >= M.capacity(state));
  ref('stats-guests').textContent = format(text.stats.guestsValue, { seconds: decimals.format(M.arrivalInterval(state)) });
  ref('stats-price').textContent = format(text.stats.priceValue, { base: M.price(state, false), matched: M.price(state, true) });
  const lost = ref('stats-lost');
  lost.textContent = numbers.format(state.stats.lost);
  lost.classList.toggle('warn', state.t - state.stats.lostAt < 10);
}

function placeHand(x, y) {
  const hand = ref('hand');
  hand.hidden = false;
  hand.style.left = `${x}px`;
  hand.style.top = `${y}px`;
}

function renderHand() {
  const hand = ref('hand');
  const goal = M.currentGoal(state);
  const pan = state.pan;
  if (state.delivery?.phase === 'wait' && !state.delivery.caught) {
    const point = sceneClient(scene.points.bike(state.delivery.x));
    placeHand(point.x, point.y);
    return;
  }
  if (!goal || goal.done) {
    hand.hidden = true;
    return;
  }
  if ((goal.id === 'stir' || goal.id === 'eject') && pan.phase === 'empty') {
    const point = sceneClient(scene.points.pan);
    placeHand(point.x, point.y);
    return;
  }
  if (goal.id === 'eject' && pan.phase === 'roasting' && pan.p >= M.FIRST_CRACK) {
    const box = ref('eject').getBoundingClientRect();
    placeHand(box.left + box.width / 2, box.top + 6);
    return;
  }
  const item = M.ITEMS.find((candidate) => candidate.id === goal.id);
  const button = item && document.querySelector(`.item-buy[data-id="${item.id}"]`);
  if (button && !button.disabled) {
    const box = button.getBoundingClientRect();
    placeHand(box.left + box.width / 2, box.top + 6);
    return;
  }
  hand.hidden = true;
}

function renderNotes() {
  if (state.stockFullFor > 1.5 && state.t - lastFullNote > 9) {
    lastFullNote = state.t;
    floater(scene.points.cart, text.floaters.full, 'note warn');
  }
}

function renderEnd() {
  if (endShown || M.currentGoal(state)) return;
  endAt ??= state.t;
  if (state.t - endAt < 2.5) return;
  endShown = true;
  const dialog = ref('end');
  if (typeof dialog.showModal === 'function') dialog.showModal();
}

function renderData() {
  const root = document.documentElement.dataset;
  root.goal = M.currentGoal(state)?.id ?? 'end';
  root.pan = state.pan.phase;
  root.money = String(Math.floor(state.money));
}

function render(dt) {
  renderHud(dt);
  renderGoal();
  renderRoast();
  renderItems();
  renderStats();
  renderHand();
  renderNotes();
  renderEnd();
  renderData();
}

// ---- Input -------------------------------------------------------------------

function unlockAudio() {
  audio.unlock();
}

document.addEventListener('pointerdown', unlockAudio, { capture: true });
document.addEventListener('keydown', unlockAudio, { capture: true });

ref('scene').addEventListener('pointerdown', (event) => {
  const hit = event.target.closest('[data-hit]');
  if (!hit) return;
  event.preventDefault();
  const kind = hit.dataset.hit;
  if (kind === 'pan') M.tapPan(state);
  else if (kind === 'delivery') M.tapDelivery(state);
  else if (kind.startsWith('drum-')) M.tapDrum(state, Number(kind.slice(5)));
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (action === 'stir') M.tapPan(state);
  else if (action === 'eject') M.eject(state, 'pan');
  else if (action === 'buy') M.buyItem(state, button.dataset.id);
  else if (action === 'sound') {
    audio.setMuted(!audio.isMuted());
    ref('sound').classList.toggle('muted', audio.isMuted());
  } else if (action === 'language') {
    language = language === 'de' ? 'en' : 'de';
    try {
      localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // Without storage the choice lasts this visit.
    }
    applyTexts();
  } else if (action === 'restart') {
    if (window.confirm(text.restartConfirm)) location.reload();
  } else if (action === 'close-end') {
    ref('end').close();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLElement && event.target.closest('button, dialog')) return;
  if (event.code === 'Space') {
    event.preventDefault();
    M.tapPan(state);
  } else if (event.key === 'e' || event.key === 'E' || event.key === 'Enter') {
    M.eject(state, 'pan');
  }
});

// ---- Loop --------------------------------------------------------------------

ref('sound').classList.toggle('muted', audio.isMuted());
applyTexts();
let last = performance.now();

function frame(now) {
  const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
  last = now;
  M.advance(state, dt);
  for (const event of M.drainEvents(state)) handle(event);
  scene.update(state, dt);
  render(dt);
  requestAnimationFrame(frame);
}

// With ?debug in the address, tests and screenshots can reach the state.
if (new URLSearchParams(location.search).has('debug')) window.roastery = { state, model: M };

scene.update(state, 0);
render(0);
document.documentElement.dataset.ready = 'true';
requestAnimationFrame((now) => {
  last = now;
  frame(now);
});
