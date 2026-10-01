// The game screen: connects the rules, the theme's scene, sounds and the
// controls in index.html. src/main.js creates it once the theme is loaded and
// calls frame() once per animation frame.
import { formatNumber } from '../format.js';

const LOCK_SVG =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="8" rx="2" fill="currentColor"/><path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>';

export function createApp({ rules, state, scene, icons = {}, coinIcon = '', audio, i18n, onRestart }) {
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

  let shownMoney = 0;
  let lastGoalKey = '';
  let lastItemsKey = '';
  let knownItems = new Set();
  let lastFullNote = -Infinity;
  let lastLostNote = -Infinity;
  let lastWishKey = '';

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
    ref('stats-lost-label').textContent = t('stats.lost');
    ref('language').textContent = t('settings.languageShort');
    ref('language').setAttribute('aria-label', t('settings.language'));
    ref('sound').setAttribute('aria-label', t('settings.sound'));
    ref('restart').setAttribute('aria-label', t('settings.restart'));
    ref('restart-title').textContent = t('restart.title');
    ref('restart-body').textContent = t('restart.body');
    ref('restart-cancel').textContent = t('restart.cancel');
    ref('restart-confirm').textContent = t('restart.confirm');
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
        audio.play('sale', { matched: event.matched }, 0.04);
        const guest = state.customers.find((c) => c.id === event.id);
        const point = scene.points.guest(guest?.x ?? rules.slots[0]);
        floater(point, t('goal.reward', { value: money(event.price) }), 'gold');
        if (event.matched) floater({ x: point.x, y: point.y - 36 }, t('floaters.perfect'), 'perfect');
        flyCoins(sceneClient(point), event.matched ? 3 : 2);
        break;
      }
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
  }

  function renderGoal() {
    const goal = rules.currentGoal(state);
    const key = goal ? `${goal.id}:${goal.done}:${i18n.language}` : `end:${i18n.language}`;
    if (key === lastGoalKey) return;
    lastGoalKey = key;
    const node = ref('goal');
    node.classList.toggle('done', Boolean(goal?.done));
    node.classList.toggle('all-done', !goal);
    let text = t('goal.allDone');
    if (goal) text = goal.done ? `${t('goal.done')} ${t(`goals.${goal.id}`)}` : t(`goals.${goal.id}`);
    ref('goal-text').textContent = text;
    ref('goal-reward').textContent = goal ? t('goal.reward', { value: money(goal.reward) }) : '';
  }

  function wishLevel() {
    return rules.queue(state)[0]?.order ?? null;
  }

  function renderRoast() {
    const pan = state.pan;
    const roasting = pan.phase === 'roasting';
    const p = pan.phase === 'empty' ? 0 : pan.p;
    const wish = wishLevel();
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
    ref('gauge').classList.toggle('goal-match', rules.currentGoal(state)?.id === 'match');

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
    if (rules.isAutomatic(state, 'pan')) status = `${status} · ${state.owned.profile > 0 ? t('auto.profile') : t('auto.helper')}`;
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

  function renderItems() {
    const visible = rules.visibleItems(state).filter((item) => rules.itemPrice(state, item) !== undefined);
    const locked = rules.lockedItems(state).slice(0, 2);
    const key = `${visible.map((item) => `${item.id}:${rules.itemPrice(state, item)}`).join('|')}|${locked.map((item) => item.id)}|${i18n.language}`;
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
        done.textContent = t('shop.allBought');
        nodes.push(done);
      }
      list.replaceChildren(...nodes);
    }
    for (const card of list.querySelectorAll('.item:not(.locked)')) {
      const item = rules.items.find((candidate) => candidate.id === card.dataset.item);
      const price = rules.itemPrice(state, item);
      const affordable = price !== undefined && state.money >= price;
      card.classList.toggle('affordable', affordable);
      const buy = card.querySelector('.item-buy');
      buy.disabled = !affordable;
      buy.querySelector('.progress').style.width = `${Math.min(100, (state.money / price) * 100)}%`;
    }
  }

  function renderStats() {
    const cart = ref('stats-cart');
    cart.textContent = t('stats.cartValue', { count: state.stock.length, capacity: rules.capacity(state) });
    cart.classList.toggle('warn', state.stock.length >= rules.capacity(state));
    ref('stats-guests').textContent = t('stats.guestsValue', { seconds: formatNumber(rules.arrivalInterval(state), i18n.language) });
    ref('stats-price').textContent = t('stats.priceValue', { base: money(rules.price(state, false)), matched: money(rules.price(state, true)) });
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
    if (!goal || goal.done) {
      hand.hidden = true;
      return;
    }
    if ((goal.id === 'stir' || goal.id === 'eject') && pan.phase === 'empty') {
      const point = sceneClient(scene.points.pan);
      placeHand(point.x, point.y);
      return;
    }
    if (goal.id === 'eject' && pan.phase === 'roasting' && pan.p >= rules.firstCrack) {
      const box = ref('eject').getBoundingClientRect();
      placeHand(box.left + box.width / 2, box.top + 6);
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
    if (kind === 'pan') rules.tapPan(state);
    else if (kind === 'delivery') rules.tapDelivery(state);
    else if (kind.startsWith('drum-')) rules.tapDrum(state, Number(kind.slice(5)));
  });

  const restartDialog = ref('restart-dialog');

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === 'stir') rules.tapPan(state);
    else if (action === 'eject') rules.eject(state, 'pan');
    else if (action === 'buy') rules.buyItem(state, button.dataset.id);
    else if (action === 'sound') {
      audio.setMuted(!audio.isMuted());
      ref('sound').classList.toggle('muted', audio.isMuted());
    } else if (action === 'language') {
      i18n.setLanguage(i18n.language === 'de' ? 'en' : 'de');
      applyTexts();
      render(0);
    } else if (action === 'restart') {
      if (typeof restartDialog.showModal === 'function') restartDialog.showModal();
    } else if (action === 'restart-cancel') {
      restartDialog.close();
    } else if (action === 'restart-confirm') {
      restartDialog.close();
      onRestart();
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

  ref('sound').classList.toggle('muted', audio.isMuted());
  applyTexts();
  scene.update(state, 0);
  render(0);

  return { frame, applyTexts };
}
