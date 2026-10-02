// The game screen: connects the rules, the theme's scene, sounds and the
// controls in index.html. src/main.js creates it once the theme is loaded,
// calls frame() once per animation frame and decides when the game saves.
import { formatNumber, formatPercent } from '../format.js';
import { doublePrice } from '../offline.js';

// Why progress is not (or no longer) saved, and the text that says so.
const NOTICE_TEXTS = {
  unavailable: 'save.unavailable',
  newer: 'save.newer',
  failed: 'save.failed',
};

// Marks every button that starts an ad (CrazyGames: it must be clear that an
// ad comes).
const VIDEO_SVG =
  '<svg class="video" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5L15 12L10 14.5Z"/></svg>';

// How long a note like "no ad available" stays in the boost card.
const MESSAGE_SECONDS = 4;

// The calendar day of the device, "YYYY-MM-DD", for the daily ad limit.
function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatClock(seconds) {
  const whole = Math.ceil(seconds);
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

const LOCK_SVG =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="8" rx="2" fill="currentColor"/><path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>';

// Ads only run through adFlow (src/core/adflow.js), and only after a click.
// Callbacks: onRestart after the player confirmed starting over, onReload when
// the player continues in this tab after another one saved, onSettings with
// the changed settings ({ language } or { muted }), onPurchase after a buy and
// onReward after the reward of an ad.
export function createApp({
  rules,
  state,
  scene,
  icons = {},
  locationIcons = {},
  coinIcon = '',
  audio,
  i18n,
  adFlow,
  onRestart,
  onReload = () => {},
  onSettings = () => {},
  onPurchase = () => {},
  onReward = () => {},
}) {
  const ref = (name) => document.querySelector(`[data-ref="${name}"]`);
  const t = (key, params) => i18n.t(key, params);
  const money = (value) => formatNumber(value, i18n.language, { rounding: 'floor' });
  const amount = (value) => formatNumber(value, i18n.language, { rounding: 'ceil' });
  const levels = rules.theme.roast.levels;
  const levelColor = Object.fromEntries(levels.map((level) => [level.id, level.color]));

  const stage = document.querySelector('.stage');
  const flyLayer = document.createElement('div');
  flyLayer.className = 'fx-layer';
  flyLayer.style.position = 'fixed';
  flyLayer.style.zIndex = '4';
  document.querySelector('.game').appendChild(flyLayer);

  let shownMoney = state.money; // what the money pill shows while it counts up
  let lastGoalKey = '';
  let lastItemsKey = '';
  let knownItems = new Set();
  let lastFullNote = -Infinity;
  let lastLostNote = -Infinity;
  let lastWishKey = '';
  let noticeKey = null;
  let welcome = null; // time away, earnings and doubling in the open welcome dialog
  let boostKey = '';
  let boostMessage = null; // { key, until } shown in the boost card for a moment
  let otherTab = false; // another tab saved; src/main.js stops this one

  // ---- Gauge, built from the theme's roast levels ----------------------------

  const percent = (p) => `${p * 100}%`;
  const labelNodes = {};
  for (const level of levels) {
    const [from, to] = rules.levelRange(level.id);
    const zone = document.createElement('div');
    zone.className = `zone ${level.id}`;
    zone.style.left = percent(from);
    zone.style.width = percent(to - from);
    zone.style.background = level.color;
    ref('gauge').prepend(zone);
    const label = document.createElement('span');
    label.className = level.id;
    label.style.left = percent((from + to) / 2);
    ref('gauge-labels').append(label);
    labelNodes[level.id] = label;
  }
  document.querySelector('.tick.first').style.left = percent(rules.firstCrack);
  document.querySelector('.tick.second').style.left = percent(rules.secondCrack);

  // ---- Texts -------------------------------------------------------------------

  function applyTexts() {
    document.documentElement.lang = i18n.language;
    document.title = t('app.title');
    ref('scene').setAttribute('aria-label', t('scene.label'));
    ref('pan-title').textContent = t('pan.title');
    for (const level of levels) labelNodes[level.id].textContent = t(`levels.${level.id}`);
    ref('eject').textContent = t('pan.eject');
    ref('shop-title').textContent = t('shop.title');
    ref('stats-title').textContent = t('stats.title');
    ref('stats-cart-label').textContent = t('stats.cart');
    ref('stats-guests-label').textContent = t('stats.guests');
    ref('stats-price-label').textContent = t('stats.price');
    ref('stats-espresso-label').textContent = t('stats.espresso');
    ref('stats-lost-label').textContent = t('stats.lost');
    ref('stats-location-label').textContent = t('stats.location');
    ref('language').textContent = t('settings.languageShort');
    ref('language').setAttribute('aria-label', t('settings.language'));
    ref('sound').setAttribute('aria-label', t('settings.sound'));
    ref('restart').setAttribute('aria-label', t('settings.restart'));
    ref('restart-title').textContent = t('restart.title');
    ref('restart-body').textContent = t('restart.body');
    ref('restart-cancel').textContent = t('restart.cancel');
    ref('restart-confirm').textContent = t('restart.confirm');
    ref('welcome-title').textContent = t('offline.title');
    ref('welcome-close').textContent = t('offline.continue');
    ref('ad-text').textContent = t('ads.playing');
    ref('tab-title').textContent = t('tab.title');
    ref('tab-body').textContent = t('tab.body');
    ref('tab-continue').textContent = t('tab.continue');
    ref('move-cancel').textContent = t('move.cancel');
    ref('move-confirm').textContent = t('move.confirm');
    renderMoveDialog();
    if (noticeKey) ref('notice').textContent = t(noticeKey);
    renderWelcome();
    boostKey = '';
    lastGoalKey = '';
    lastItemsKey = '';
    lastWishKey = '';
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
        if (event.roaster === 'pan') floater(scene.points.pan, t('floaters.firstCrack'), 'note');
        break;
      case 'secondCrack':
        audio.play('secondCrack', { quiet: event.roaster !== 'pan' }, 0.25);
        if (event.roaster === 'pan') floater(scene.points.pan, t('floaters.secondCrack'), 'note');
        break;
      case 'eject':
        audio.play('eject', {}, 0.15);
        break;
      case 'bag':
        audio.play('bag', {}, 0.12);
        break;
      case 'sale': {
        audio.play('sale', {}, 0.04);
        const guest = state.customers.find((c) => c.id === event.id);
        const point = scene.points.guest(guest?.x ?? rules.slots[0]);
        floater(point, t('goal.reward', { value: money(event.price) }), 'gold');
        flyCoins(sceneClient(point), 3);
        break;
      }
      case 'brewTap':
        audio.play('steam', {}, 0.06);
        break;
      case 'brewed':
        audio.play('cup', {}, 0.1);
        break;
      case 'switch':
        audio.play('switch', {}, 0.03);
        floater(scene.points.drumSign(event.roaster), t(`levels.${event.level}`), 'note');
        break;
      case 'lost':
        if (state.t - lastLostNote > 7) {
          lastLostNote = state.t;
          floater(scene.points.queue, t('floaters.leaving'), 'note warn');
        }
        break;
      case 'purchase':
        audio.play('purchase');
        if (i18n.has(`banners.${event.id}`)) banner(t(`banners.${event.id}`));
        break;
      case 'goal': {
        audio.play('goal');
        const box = ref('goal').getBoundingClientRect();
        flyCoins({ x: box.right - 30, y: box.top + box.height / 2 }, 3);
        break;
      }
      case 'move':
        audio.play('goal');
        // Notes from the old roastery ("First crack!") would float over the new one.
        ref('fx').replaceChildren();
        banner(t(`locations.${event.location}.banner`));
        knownItems = new Set();
        lastItemsKey = '';
        lastGoalKey = '';
        break;
      case 'boost':
        audio.play('purchase');
        banner(t('boost.started', { minutes: formatNumber(rules.theme.boost.seconds / 60, i18n.language) }));
        break;
      case 'delivery':
        audio.play('bell');
        floater(scene.points.bike(rules.theme.delivery.stopX), t('floaters.delivery'), 'note');
        break;
      case 'deliveryCaught': {
        audio.play('catch');
        const point = scene.points.bike(state.delivery?.x ?? rules.theme.delivery.stopX);
        floater(point, t('floaters.caught', { value: money(event.reward) }), 'gold');
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
    ref('money').textContent = money(Math.floor(shownMoney));
    const perMinute = rules.incomePerMinute(state);
    ref('rate').textContent = perMinute > 0 ? t('rate.perMinute', { value: money(perMinute) }) : '';
    ref('rate').classList.toggle('boosted', state.boost > 0);
  }

  // The boost card in the side panel, never in the scene (CLAUDE.md): an
  // offer (ad and purchase side by side, equal in size), the running boost
  // with its time, or only the purchase once the ads of the day are used up.
  function renderBoost() {
    const card = ref('boost');
    const offered = rules.boostOffered(state);
    card.hidden = !offered;
    if (!offered) return;
    const { boost } = rules.theme;
    const running = state.boost > 0;
    const day = localDay();
    const adsShown = adFlow.canOfferReward();
    const adsLeft = rules.adBoostsLeft(state, day);
    const canAd = adsShown && rules.canAdBoost(state, day);
    const price = rules.boostPrice(state);
    if (boostMessage && state.t > boostMessage.until) boostMessage = null;
    const key = [running, canAd, adsShown, adsLeft, price, boostMessage?.key, i18n.language].join('|');
    if (key !== boostKey) {
      boostKey = key;
      const minutes = formatNumber(boost.seconds / 60, i18n.language);
      card.classList.toggle('running', running);
      ref('boost-badge').textContent = t('boost.badge', { factor: formatNumber(boost.factor, i18n.language) });
      ref('boost-title').textContent = running ? t('boost.activeTitle') : t('boost.title');
      ref('boost-sub').textContent = running ? t('boost.activeNote') : t('boost.offerNote', { minutes });
      ref('boost-actions').hidden = running;
      const ad = ref('boost-ad');
      ad.hidden = !canAd;
      ad.innerHTML = VIDEO_SVG;
      ad.append(t('boost.ad'));
      ad.setAttribute('aria-label', t('boost.adLabel', { minutes }));
      const buy = ref('boost-buy');
      buy.innerHTML = `${coinIcon}<span></span><span class="progress"></span>`;
      buy.querySelector('span').textContent = canAd ? amount(price) : t('boost.buy', { price: amount(price) });
      buy.setAttribute('aria-label', t('boost.buyLabel', { minutes, price: amount(price) }));
      let note = '';
      if (boostMessage) note = t(boostMessage.key);
      else if (adsShown) note = adsLeft > 0 ? t('boost.adsLeft', { count: adsLeft }) : t('boost.adsUsedUp');
      ref('boost-note').textContent = note;
    }
    ref('boost-time').textContent = running ? formatClock(state.boost) : '';
    ref('boost-fill').style.width = `${(state.boost / boost.seconds) * 100}%`;
    const buy = ref('boost-buy');
    buy.disabled = running || state.money < price;
    buy.querySelector('.progress').style.width = `${price > 0 ? Math.min(100, (state.money / price) * 100) : 0}%`;
  }

  function renderGoal() {
    const goal = rules.currentGoal(state);
    const key = goal ? `${goal.id}:${goal.done}:${i18n.language}` : `end:${state.location}:${rules.moveOffered(state)}:${i18n.language}`;
    if (key === lastGoalKey) return;
    lastGoalKey = key;
    const node = ref('goal');
    node.classList.toggle('done', Boolean(goal?.done));
    node.classList.toggle('all-done', !goal);
    // After the last goal: save up for the move, or more is coming soon.
    const next = rules.moveOffered(state) ? rules.nextLocation(state) : null;
    let text = next ? t(`locations.${next.id}.goal`) : t('goal.allDone');
    // Goals that ask for an amount (e.g. "Earn {value} from sales") get it from theme.json.
    const goalText = goal && t(`goals.${goal.id}`, { value: amount(goal.condition.min ?? 1) });
    if (goal) text = goal.done ? `${t('goal.done')} ${goalText}` : goalText;
    ref('goal-text').textContent = text;
    ref('goal-reward').textContent = goal ? t('goal.reward', { value: money(goal.reward) }) : '';
  }

  function renderRoast() {
    const pan = state.pan;
    const roasting = pan.phase === 'roasting';
    const p = pan.phase === 'empty' ? 0 : pan.p;
    // What a guest in line waits for, preferably one the pan can still roast
    // (see plan()).
    const wish = rules.plan(state).wish;
    ref('needle').style.left = percent(p);

    const wishKey = `${wish}:${i18n.language}`;
    if (wishKey !== lastWishKey) {
      lastWishKey = wishKey;
      const wishNode = ref('wish');
      if (wish) {
        const [before, after] = t('wish.text').split('{level}');
        const strong = document.createElement('b');
        strong.textContent = t(`levels.${wish}`);
        strong.style.color = levelColor[wish];
        wishNode.replaceChildren(before, strong, after ?? '');
      } else {
        wishNode.textContent = t('wish.none');
      }
    }

    const target = ref('target');
    target.classList.toggle('show', Boolean(wish));
    if (wish) {
      const [from, to] = rules.levelRange(wish);
      target.style.left = percent(from);
      target.style.width = percent(to - from);
      target.style.borderColor = levelColor[wish];
    }
    const inWish = roasting && wish !== null && rules.levelAt(p) === wish;
    ref('gauge').classList.toggle('hit', inWish);

    let status;
    let alert = false;
    if (pan.phase === 'empty') status = rules.isAutomatic(state, 'pan') ? t('status.emptyAuto') : t('status.empty');
    else if (roasting && p < rules.firstCrack) status = t('status.drying');
    else if (roasting && p < rules.firstCrack + 0.06) {
      status = t('status.crack');
      alert = true;
    } else if (roasting) status = t('status.roast', { level: t(`levels.${rules.levelAt(p)}`) });
    else if (pan.phase === 'cooling') status = t('status.cooling');
    else {
      status = t('status.waiting');
      alert = true;
    }
    if (rules.isAutomatic(state, 'pan')) status = `${status} · ${t('auto.helper')}`;
    const statusNode = ref('status');
    statusNode.textContent = status;
    statusNode.classList.toggle('alert', alert);

    const stir = ref('stir');
    stir.textContent = pan.phase === 'empty' ? t('pan.load') : t('pan.stir');
    stir.disabled = !(pan.phase === 'empty' || roasting);
    const eject = ref('eject');
    eject.disabled = !(roasting && p >= rules.firstCrack);
    eject.classList.toggle('ready', inWish);
  }

  function itemNode(item) {
    const card = document.createElement('div');
    card.className = 'item';
    card.dataset.item = item.id;
    const icon = document.createElement('div');
    icon.className = 'item-icon';
    icon.innerHTML = icons[item.id] ?? '';
    const info = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'item-name';
    name.textContent = t(`items.${item.id}.name`);
    const effect = document.createElement('div');
    effect.className = 'item-effect';
    effect.textContent = t(`items.${item.id}.effect`);
    info.append(name, effect);
    const buy = document.createElement('button');
    buy.type = 'button';
    buy.className = 'item-buy';
    buy.dataset.action = 'buy';
    buy.dataset.id = item.id;
    const price = rules.itemPrice(state, item);
    buy.innerHTML = `${coinIcon}<span></span><span class="progress"></span>`;
    buy.querySelector('span').textContent = amount(price);
    buy.setAttribute('aria-label', t('shop.buyLabel', { name: t(`items.${item.id}.name`), price: amount(price) }));
    card.append(icon, info, buy);
    return card;
  }

  function lockedNode(item) {
    const index = rules.items.indexOf(item);
    const card = document.createElement('div');
    card.className = 'item locked';
    const icon = document.createElement('div');
    icon.className = 'item-icon';
    icon.innerHTML = icons[item.id] ?? '';
    const info = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'item-name';
    name.textContent = t(`items.${item.id}.name`);
    const note = document.createElement('div');
    note.className = 'lock-note';
    const condition = index === 0 ? t('shop.lockedFirst') : t('shop.lockedAfter', { name: t(`items.${rules.items[index - 1].id}.name`) });
    note.innerHTML = LOCK_SVG;
    note.append(condition);
    info.append(name, note);
    card.append(icon, info);
    return card;
  }

  // The move to the next location, at the end of the upgrades: locked until
  // its condition is met, then with its cost like an upgrade.
  function moveNode(next, locked) {
    const card = document.createElement('div');
    card.className = locked ? 'item move locked' : 'item move';
    card.dataset.item = 'move';
    const icon = document.createElement('div');
    icon.className = 'item-icon';
    icon.innerHTML = locationIcons[next.id] ?? '';
    const info = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'item-name';
    name.textContent = t(`locations.${next.id}.move`);
    info.append(name);
    if (locked) {
      const note = document.createElement('div');
      note.className = 'lock-note';
      note.innerHTML = LOCK_SVG;
      const after = next.reveal?.owned;
      note.append(after ? t('shop.lockedAfter', { name: t(`items.${after}.name`) }) : t('shop.lockedFirst'));
      info.append(note);
      card.append(icon, info);
      return card;
    }
    const effect = document.createElement('div');
    effect.className = 'item-effect';
    effect.textContent = t(`locations.${next.id}.effect`);
    info.append(effect);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'item-buy';
    button.dataset.action = 'move';
    const cost = rules.moveCost(state);
    button.innerHTML = `${coinIcon}<span></span><span class="progress"></span>`;
    button.querySelector('span').textContent = amount(cost);
    button.setAttribute('aria-label', t('move.label', { name: t(`locations.${next.id}.move`), price: amount(cost) }));
    card.append(icon, info, button);
    return card;
  }

  function renderItems() {
    const visible = rules.visibleItems(state).filter((item) => rules.itemPrice(state, item) !== undefined);
    const locked = rules.lockedItems(state).slice(0, 2);
    const next = rules.nextLocation(state);
    const offered = rules.moveOffered(state);
    const showMove = next !== null && (offered || locked.length < 2);
    const key = `${visible.map((item) => `${item.id}:${rules.itemPrice(state, item)}`).join('|')}|${locked.map((item) => item.id)}|${state.location}:${showMove}:${offered}|${i18n.language}`;
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
      if (showMove) nodes.push(moveNode(next, !offered));
      if (nodes.length === 0) {
        const done = document.createElement('div');
        done.className = 'teaser';
        done.textContent = t('shop.allBought');
        nodes.push(done);
      }
      list.replaceChildren(...nodes);
    }
    for (const card of list.querySelectorAll('.item:not(.locked)')) {
      const item = rules.items.find((candidate) => candidate.id === card.dataset.item);
      const price = item ? rules.itemPrice(state, item) : rules.moveCost(state);
      const affordable = price !== undefined && state.money >= price;
      card.classList.toggle('affordable', affordable);
      const buy = card.querySelector('.item-buy');
      buy.disabled = !affordable;
      buy.querySelector('.progress').style.width = `${Math.min(100, (state.money / price) * 100)}%`;
    }
  }

  function renderStats() {
    ref('stats-location').textContent = t(`locations.${rules.locationOf(state).id}.name`);
    const cart = ref('stats-cart');
    cart.textContent = t('stats.cartValue', { count: state.stock.length, capacity: rules.cartCapacity(state) });
    cart.classList.toggle('warn', state.stock.length >= rules.cartCapacity(state));
    ref('stats-guests').textContent = t('stats.guestsValue', { seconds: formatNumber(rules.arrivalInterval(state), i18n.language) });
    ref('stats-price').textContent = money(rules.price(state));
    const espresso = state.owned.espresso > 0;
    ref('stats-espresso-label').hidden = !espresso;
    ref('stats-espresso').hidden = !espresso;
    if (espresso) ref('stats-espresso').textContent = money(rules.price(state, rules.espresso));
    const lost = ref('stats-lost');
    lost.textContent = money(state.stats.lost);
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
    const goal = rules.currentGoal(state);
    const pan = state.pan;
    if (state.delivery?.phase === 'wait' && !state.delivery.caught) {
      const point = sceneClient(scene.points.bike(state.delivery.x));
      placeHand(point.x, point.y);
      return;
    }
    const moveButton = document.querySelector('.item-buy[data-action="move"]');
    if (!goal && moveButton && !moveButton.disabled) {
      const box = moveButton.getBoundingClientRect();
      placeHand(box.left + box.width / 2, box.top + 6);
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
    if (goal.id === 'eject' && pan.phase === 'roasting' && ref('gauge').classList.contains('hit')) {
      const box = ref('eject').getBoundingClientRect();
      placeHand(box.left + box.width / 2, box.top + 6);
      return;
    }
    // Goals that ask to tap something in the scene: a drum (its roast) or
    // the espresso machine.
    if (goal.condition.stat === 'switches' && state.drums.length > 0) {
      const point = sceneClient(scene.points.drumSign(0));
      placeHand(point.x, point.y);
      return;
    }
    if (goal.condition.stat === 'brews' && state.owned.espresso > 0) {
      const point = sceneClient(scene.points.espresso);
      placeHand(point.x, point.y);
      return;
    }
    const item = rules.items.find((candidate) => candidate.id === goal.id);
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
      floater(scene.points.cart, t('floaters.full'), 'note warn');
    }
  }

  // Lets tests follow the game without reading pixels.
  function renderData() {
    const root = document.documentElement.dataset;
    root.goal = rules.currentGoal(state)?.id ?? 'end';
    root.location = rules.locationOf(state).id;
    root.pan = state.pan.phase;
    root.money = String(Math.floor(state.money));
  }

  function render(dt) {
    renderHud(dt);
    renderBoost();
    renderGoal();
    renderRoast();
    renderItems();
    renderStats();
    renderHand();
    renderNotes();
    renderData();
  }

  // ---- Welcome back, other tab, save notice ----------------------------------------

  function describeDuration(seconds) {
    const minutes = Math.max(1, Math.round(seconds / 60));
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    if (days > 0) return t('duration.daysHours', { days, hours });
    if (hours > 0) return t('duration.hoursMinutes', { hours, minutes: minutes % 60 });
    return t('duration.minutes', { minutes });
  }

  function renderWelcome() {
    if (!welcome) return;
    const { offline } = rules.theme;
    ref('welcome-body').textContent = t('offline.body', { duration: describeDuration(welcome.awaySeconds) });
    const amountNode = ref('welcome-amount');
    amountNode.innerHTML = coinIcon;
    amountNode.append(t('goal.reward', { value: money(welcome.amount) }));
    ref('welcome-note').textContent = t('offline.note', {
      rate: formatPercent(offline.rate, i18n.language),
      hours: formatNumber(offline.maxHours, i18n.language),
    });
    // Doubling once per return: with an ad, or bought for doublePrice().
    const doubleAd = ref('double-ad');
    doubleAd.hidden = Boolean(welcome.doubled) || !adFlow.canOfferReward();
    doubleAd.innerHTML = VIDEO_SVG;
    doubleAd.append(t('offline.doubleAd'));
    const doubleBuy = ref('double-buy');
    doubleBuy.hidden = Boolean(welcome.doubled);
    doubleBuy.innerHTML = coinIcon;
    doubleBuy.append(t('offline.doubleBuy', { price: amount(doublePrice(rules, welcome.amount)) }));
    doubleBuy.disabled = state.money < doublePrice(rules, welcome.amount);
    const status = ref('welcome-status');
    let text = '';
    if (welcome.doubled) text = t('offline.doubled', { amount: money(welcome.doubled) });
    else if (welcome.adFailed) text = t('ads.unavailable');
    status.textContent = text;
    status.hidden = text === '';
  }

  // Pays the earnings shown in the welcome dialog once more.
  function grantDouble(shown) {
    if (welcome !== shown || shown.doubled) return false;
    state.money += shown.amount;
    shown.doubled = shown.amount;
    renderWelcome();
    return true;
  }

  const welcomeDialog = ref('welcome-dialog');
  welcomeDialog.addEventListener('close', () => {
    welcome = null;
  });

  // Shows what the roastery earned while the player was away. Gaps while the
  // dialog is open (e.g. another switch of tabs) add up.
  function showWelcome({ awaySeconds, amount }) {
    welcome ??= { awaySeconds: 0, amount: 0, doubled: 0, adFailed: false };
    welcome.awaySeconds += awaySeconds;
    welcome.amount += amount;
    renderWelcome();
    if (!welcomeDialog.open && typeof welcomeDialog.showModal === 'function') welcomeDialog.showModal();
  }

  // Another tab saved: this one no longer saves or runs (src/main.js) and
  // offers to continue with the newer save. Browsers may close a modal dialog
  // after repeated Escape presses even if "cancel" is prevented, so it reopens.
  const tabDialog = ref('tab-dialog');
  tabDialog.addEventListener('cancel', (event) => event.preventDefault());
  tabDialog.addEventListener('close', () => {
    if (otherTab) tabDialog.showModal();
  });

  function showOtherTab() {
    otherTab = true;
    if (!tabDialog.open && typeof tabDialog.showModal === 'function') tabDialog.showModal();
  }

  // While an ad runs, the game stands still (src/main.js), the sound is off and
  // a modal dialog blocks every control until the ad has ended.
  const adDialog = ref('ad-dialog');
  adDialog.addEventListener('cancel', (event) => event.preventDefault());
  adDialog.addEventListener('close', () => {
    if (adFlow.busy) adDialog.showModal();
  });
  let mutedBeforeAd = false;
  let adsStarted = 0;
  adFlow.on((type) => {
    if (type === 'start') {
      adsStarted += 1;
      document.documentElement.dataset.ads = String(adsStarted);
      mutedBeforeAd = audio.isMuted();
      audio.setMuted(true);
      if (!adDialog.open && typeof adDialog.showModal === 'function') adDialog.showModal();
    } else {
      audio.setMuted(mutedBeforeAd);
      if (adDialog.open) adDialog.close();
    }
  });
  document.documentElement.dataset.ads = '0';

  function showBoostMessage(key) {
    boostMessage = { key, until: state.t + MESSAGE_SECONDS };
  }

  async function watchBoostAd() {
    if (adFlow.busy) return;
    const watched = await adFlow.reward(() => rules.startAdBoost(state, localDay()));
    if (watched) onReward();
    else showBoostMessage('ads.unavailable');
  }

  async function watchDoubleAd() {
    const shown = welcome;
    if (!shown || shown.doubled || adFlow.busy) return;
    const watched = await adFlow.reward(() => grantDouble(shown));
    if (watched) {
      onReward();
    } else if (welcome === shown) {
      shown.adFailed = true;
      renderWelcome();
    }
  }

  function buyDouble() {
    const shown = welcome;
    if (!shown || shown.doubled) return;
    const price = doublePrice(rules, shown.amount);
    if (state.money < price) return;
    state.money -= price;
    grantDouble(shown);
    onPurchase();
  }

  // Asks before the move: what stays behind and what the new location gives.
  const moveDialog = ref('move-dialog');
  function renderMoveDialog() {
    const next = rules.nextLocation(state);
    if (!next) return;
    ref('move-title').textContent = t(`locations.${next.id}.moveTitle`);
    ref('move-body').textContent = t(`locations.${next.id}.moveBody`);
  }

  function showNotice(kind) {
    noticeKey = NOTICE_TEXTS[kind];
    const node = ref('notice');
    node.textContent = t(noticeKey);
    node.hidden = false;
  }

  // ---- Input -------------------------------------------------------------------

  function unlockAudio() {
    audio.unlock();
  }

  // Touch browsers allow audio only from touchend or click, not pointerdown.
  for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) {
    document.addEventListener(type, unlockAudio, { capture: true });
  }

  ref('scene').addEventListener('pointerdown', (event) => {
    const hit = event.target.closest('[data-hit]');
    if (!hit) return;
    event.preventDefault();
    const kind = hit.dataset.hit;
    if (kind === 'pan') rules.tapPan(state);
    else if (kind === 'delivery') rules.tapDelivery(state);
    else if (kind === 'espresso') rules.tapEspresso(state);
    else if (kind.startsWith('drum-')) rules.tapDrum(state, Number(kind.slice(5)));
  });

  const restartDialog = ref('restart-dialog');

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === 'stir') rules.tapPan(state);
    else if (action === 'eject') rules.eject(state, 'pan');
    else if (action === 'buy') {
      if (rules.buyItem(state, button.dataset.id)) onPurchase(button.dataset.id);
    } else if (action === 'sound') {
      audio.setMuted(!audio.isMuted());
      ref('sound').classList.toggle('muted', audio.isMuted());
      onSettings({ muted: audio.isMuted() });
    } else if (action === 'language') {
      i18n.setLanguage(i18n.language === 'de' ? 'en' : 'de');
      applyTexts();
      render(0);
      onSettings({ language: i18n.language });
    } else if (action === 'restart') {
      if (typeof restartDialog.showModal === 'function') restartDialog.showModal();
    } else if (action === 'restart-cancel') {
      restartDialog.close();
    } else if (action === 'restart-confirm') {
      restartDialog.close();
      onRestart();
    } else if (action === 'welcome-close') {
      welcomeDialog.close();
    } else if (action === 'move') {
      renderMoveDialog();
      if (typeof moveDialog.showModal === 'function') moveDialog.showModal();
    } else if (action === 'move-cancel') {
      moveDialog.close();
    } else if (action === 'move-confirm') {
      moveDialog.close();
      if (rules.move(state)) onPurchase();
    } else if (action === 'boost-ad') {
      watchBoostAd();
    } else if (action === 'boost-buy') {
      if (rules.buyBoost(state)) onPurchase();
    } else if (action === 'double-ad') {
      watchDoubleAd();
    } else if (action === 'double-buy') {
      buyDouble();
    } else if (action === 'tab-continue') {
      onReload();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLElement && event.target.closest('button, dialog')) return;
    if (event.code === 'Space') {
      event.preventDefault();
      rules.tapPan(state);
    } else if (event.key === 'e' || event.key === 'E' || event.key === 'Enter') {
      rules.eject(state, 'pan');
    }
  });

  // ---- Frames ------------------------------------------------------------------

  // Advances the game by dt seconds and draws it.
  function frame(dt) {
    rules.advance(state, dt);
    for (const event of rules.drainEvents(state)) handle(event);
    scene.update(state, dt);
    render(dt);
  }

  // Plays a short gap on (e.g. some seconds in a hidden tab) without sounds
  // and effects for what happened meanwhile. The player did not see it, so a
  // boost waits.
  function skip(seconds) {
    rules.advanceUnseen(state, seconds);
    rules.drainEvents(state);
    scene.update(state, 0);
    render(0);
  }

  ref('sound').classList.toggle('muted', audio.isMuted());
  applyTexts();
  scene.update(state, 0);
  render(0);

  return { frame, skip, applyTexts, showWelcome, showOtherTab, showNotice };
}
