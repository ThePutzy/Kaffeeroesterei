// The game screen: plain DOM, built once and then updated in place.
// Ids in the markup come from validated theme data ([a-z0-9_]); all texts are
// set through textContent.
import { formatNumber, formatPercent } from '../format.js';
import { LANGUAGES } from '../i18n.js';

const TABS = ['generators', 'upgrades', 'achievements', 'prestige'];
const BUY_AMOUNTS = ['1', '10', 'max'];
const LANGUAGE_NAMES = { en: 'English', de: 'Deutsch' };
const MAX_FLOATERS = 12;
const TOAST_MS = 3500;

// A cog drawn from a dashed ring; decorative, the button carries a label.
const SETTINGS_ICON =
  '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">' +
  '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="3.5" stroke-dasharray="3.2 2.7"/>' +
  '<circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

// Marks every button that plays an ad, as CrazyGames requires.
const VIDEO_ICON =
  '<svg class="video-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' +
  '<rect x="2" y="5" width="20" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>' +
  '<path d="M10 9l5 3-5 3z" fill="currentColor"/></svg>';

// Theme art is optional; paths are validated theme data, relative to the page.
function artImage(theme, path, className, size) {
  if (!path) return '';
  return `<img class="${className}" src="themes/${theme.id}/${path}" alt="" width="${size}" height="${size}" draggable="false">`;
}

function markup(theme, upgrades, achievements) {
  const art = theme.art ?? {};
  const generators = theme.generators
    .map(
      ({ id, icon }) => `
        <li class="row generator" data-id="${id}">
          ${artImage(theme, icon, 'row-icon', 40)}
          <div class="row-main">
            <div class="row-title" id="generator-${id}-title"><span data-field="name"></span> <span class="count" data-field="owned"></span></div>
            <div class="row-detail" data-field="production"></div>
          </div>
          <button type="button" class="buy" data-action="buy-generator" data-id="${id}" aria-describedby="generator-${id}-title">
            <span class="buy-label" data-field="buyLabel"></span>
            <span class="price" data-field="price"></span>
          </button>
        </li>`,
    )
    .join('');
  const upgradeRows = upgrades
    .map(
      ({ id }) => `
        <li class="row upgrade" data-id="${id}" hidden>
          <div class="row-main">
            <div class="row-title" id="upgrade-${id}-name" data-field="name"></div>
            <div class="row-detail" id="upgrade-${id}-effect" data-field="effect"></div>
          </div>
          <button type="button" class="buy" data-action="buy-upgrade" data-id="${id}" aria-describedby="upgrade-${id}-name upgrade-${id}-effect">
            <span class="price" data-field="price"></span>
          </button>
        </li>`,
    )
    .join('');
  const achievementTiles = achievements
    .map(
      ({ id }) => `
        <li class="tile achievement" data-id="${id}">
          <div class="tile-title" data-field="name"></div>
          <div class="tile-detail" data-field="condition"></div>
        </li>`,
    )
    .join('');

  return `
    <header class="topbar">
      <div class="balance">
        <div class="balance-amount">${artImage(theme, art.currency, 'currency-icon', 24)}<span data-ref="currency"></span></div>
        <div class="balance-rate" data-ref="rate"></div>
      </div>
      <button type="button" class="icon-button" data-action="open-settings" data-label="settings.title">${SETTINGS_ICON}</button>
    </header>
    <section class="roaster">
      <button type="button" class="click-button" data-action="click">
        ${artImage(theme, art.click, 'click-art', 96)}
        <span class="click-label" data-text="click.action"></span>
        <span class="click-value" data-ref="clickValue"></span>
      </button>
      <div class="floaters" aria-hidden="true" data-ref="floaters"></div>
      <div class="boost" data-ref="boost">
        <p class="boost-title" data-ref="boostTitle"></p>
        <div class="boost-actions" data-ref="boostActions">
          <button type="button" class="boost-button" data-action="boost-ad" data-ref="boostAd">${VIDEO_ICON}<span data-text="ads.watch"></span></button>
          <button type="button" class="boost-button" data-action="boost-buy" data-ref="boostBuy"></button>
        </div>
      </div>
    </section>
    <nav class="tabs" role="tablist" data-label="tabs.label">
      ${TABS.map(
        (tab) =>
          `<button type="button" role="tab" id="tab-${tab}" aria-controls="panel-${tab}" data-action="select-tab" data-tab="${tab}" data-text="tabs.${tab}"></button>`,
      ).join('')}
    </nav>
    <main class="panels">
      <section class="panel" role="tabpanel" id="panel-generators" aria-labelledby="tab-generators" data-panel="generators">
        <div class="segmented" role="radiogroup" data-label="buy.amount">
          ${BUY_AMOUNTS.map(
            (amount) => `<button type="button" role="radio" data-action="set-amount" data-amount="${amount}"></button>`,
          ).join('')}
        </div>
        <ul class="list">${generators}</ul>
        <p class="note" data-ref="generatorsHint" data-text="generator.nextUnlock"></p>
      </section>
      <section class="panel" role="tabpanel" id="panel-upgrades" aria-labelledby="tab-upgrades" data-panel="upgrades" hidden>
        <ul class="list">${upgradeRows}</ul>
        <p class="note" data-ref="upgradesEmpty" data-text="upgrades.none"></p>
        <p class="note" data-ref="upgradesBought"></p>
      </section>
      <section class="panel" role="tabpanel" id="panel-achievements" aria-labelledby="tab-achievements" data-panel="achievements" hidden>
        <p class="note" data-ref="achievementsProgress"></p>
        <ul class="grid">${achievementTiles}</ul>
      </section>
      <section class="panel prestige" role="tabpanel" id="panel-prestige" aria-labelledby="tab-prestige" data-panel="prestige" hidden>
        <p class="prestige-points" data-ref="prestigePoints"></p>
        <p data-ref="prestigeBonus"></p>
        <p class="note" data-ref="prestigeExplain"></p>
        <p class="prestige-gain" data-ref="prestigeGain"></p>
        <button type="button" class="primary" data-action="prestige" data-ref="prestigeButton" data-text="prestige.action"></button>
      </section>
    </main>
    <dialog class="dialog" data-ref="settings" aria-labelledby="settings-title">
      <form method="dialog">
        <h2 id="settings-title" data-text="settings.title"></h2>
        <div class="settings-brand">${artImage(theme, art.logo, 'brand-logo', 40)}<span data-text="app.title"></span></div>
        <label class="field">
          <span data-text="settings.language"></span>
          <select data-ref="languageSelect">
            ${LANGUAGES.map((language) => `<option value="${language}" lang="${language}">${LANGUAGE_NAMES[language]}</option>`).join('')}
          </select>
        </label>
        <p class="note" data-ref="storageNote" hidden></p>
        <div class="dialog-actions">
          <button type="button" class="danger" data-action="reset" data-text="settings.reset"></button>
          <button value="close" class="primary" data-text="dialog.close"></button>
        </div>
      </form>
    </dialog>
    <dialog class="dialog" data-ref="confirmReset" aria-labelledby="reset-title">
      <form method="dialog">
        <h2 id="reset-title" data-text="reset.confirm.title"></h2>
        <p data-text="reset.confirm.body"></p>
        <div class="dialog-actions">
          <button value="cancel" data-text="dialog.cancel"></button>
          <button value="confirm" class="danger" data-text="reset.confirm.yes"></button>
        </div>
      </form>
    </dialog>
    <dialog class="dialog" data-ref="offline" aria-labelledby="offline-title">
      <form method="dialog">
        <h2 id="offline-title" data-text="offline.title"></h2>
        <p data-ref="offlineBody"></p>
        <p class="note" data-ref="offlineNote"></p>
        <div class="dialog-actions equal">
          <button type="button" class="primary" data-action="offline-double" data-ref="offlineDouble">${VIDEO_ICON}<span data-text="offline.double"></span></button>
          <button value="close" class="primary" data-text="offline.continue" autofocus></button>
        </div>
      </form>
    </dialog>
    <dialog class="dialog" data-ref="confirmPrestige" aria-labelledby="prestige-title">
      <form method="dialog">
        <h2 id="prestige-title" data-text="prestige.confirm.title"></h2>
        <p data-ref="confirmPrestigeBody"></p>
        <div class="dialog-actions">
          <button value="cancel" data-text="dialog.cancel"></button>
          <button value="confirm" class="primary" data-text="prestige.action"></button>
        </div>
      </form>
    </dialog>
    <dialog class="dialog" data-ref="otherTab" aria-labelledby="other-tab-title" closedby="none">
      <h2 id="other-tab-title" data-text="tab.title"></h2>
      <p data-text="tab.body"></p>
      <div class="dialog-actions">
        <button type="button" class="primary" data-action="reload" data-text="tab.continue"></button>
      </div>
    </dialog>
    <dialog class="ad-overlay" data-ref="adOverlay" aria-labelledby="ad-overlay-text" closedby="none">
      <p id="ad-overlay-text" data-text="ads.playing"></p>
    </dialog>
    <div class="toasts" role="status" aria-live="polite" data-ref="toasts"></div>`;
}

// Why progress is not (or no longer) saved, and the text that says so.
const STORAGE_TEXTS = {
  unavailable: 'settings.storageUnavailable',
  newer: 'settings.saveNewer',
  failed: 'settings.saveFailed',
};

function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

function setHidden(node, hidden) {
  if (node.hidden !== hidden) node.hidden = hidden;
}

function setDisabled(button, disabled) {
  if (button.disabled !== disabled) button.disabled = disabled;
}

function rowsBy(root, selector) {
  return new Map(
    [...root.querySelectorAll(selector)].map((row) => [
      row.dataset.id,
      {
        row,
        button: row.querySelector('button'),
        fields: Object.fromEntries([...row.querySelectorAll('[data-field]')].map((node) => [node.dataset.field, node])),
      },
    ]),
  );
}

export function createUi({
  root,
  game,
  i18n,
  adFlow = null,
  storageProblem = null, // 'unavailable' | 'newer' | 'failed', see STORAGE_TEXTS
  onLanguageChange = () => {},
  onReset = () => {},
}) {
  const { economy } = game;
  const { theme } = economy;
  const upgrades = [...(theme.upgrades ?? [])].sort((a, b) => a.cost - b.cost);
  const achievements = theme.achievements ?? [];
  let activeTab = 'generators';
  let buyAmount = '1';
  let offlineShown = null; // time away and earnings shown in the open dialog, if any
  const shownUpgrades = new Set(); // upgrades visible in the last render
  let rendered = false;

  root.innerHTML = markup(theme, upgrades, achievements);
  const refs = Object.fromEntries([...root.querySelectorAll('[data-ref]')].map((node) => [node.dataset.ref, node]));
  const generatorRows = rowsBy(root, '.generator');
  const upgradeRows = rowsBy(root, '.upgrade');
  const achievementTiles = rowsBy(root, '.achievement');
  const tabButtons = [...root.querySelectorAll('[role="tab"]')];
  const panels = [...root.querySelectorAll('[role="tabpanel"]')];
  const amountButtons = [...root.querySelectorAll('[data-action="set-amount"]')];

  // rounding: see formatNumber; 'floor' for amounts the player has, 'ceil' for prices.
  const format = (value, rounding) => formatNumber(value, i18n.language, { rounding });
  const name = (kind, id, fallback = id) => i18n.t(`${kind}.${id}.name`, {}, fallback);

  function describeEffect(effect) {
    return i18n.t(`upgrade.effect.${effect.type}`, {
      factor: format(effect.factor),
      generator: effect.generator ? name('generator', effect.generator) : '',
    });
  }

  function describeCondition(condition) {
    return i18n.t(`condition.${condition.type}`, {
      value: format(condition.value),
      generator: condition.generator ? name('generator', condition.generator) : '',
    });
  }

  function describeDuration(seconds) {
    const minutes = Math.max(1, Math.round(seconds / 60));
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    if (days > 0) return i18n.t('duration.daysHours', { days, hours });
    if (hours > 0) return i18n.t('duration.hoursMinutes', { hours, minutes: minutes % 60 });
    return i18n.t('duration.minutes', { minutes });
  }

  // Several gaps while the dialog is open add up in the same record, so a
  // reward for this dialog can tell whether the dialog is still open.
  function showOffline({ awaySeconds, amount }) {
    offlineShown ??= { awaySeconds: 0, amount: 0, doubled: false };
    offlineShown.awaySeconds += awaySeconds;
    offlineShown.amount += amount;
    setText(
      refs.offlineBody,
      i18n.t('offline.body', { duration: describeDuration(offlineShown.awaySeconds), amount: format(offlineShown.amount) }),
    );
    setText(
      refs.offlineNote,
      i18n.t('offline.note', {
        rate: formatPercent(theme.offline.rate, i18n.language),
        hours: format(theme.offline.maxHours),
      }),
    );
    setHidden(refs.offlineDouble, offlineShown.doubled || !adFlow?.canOfferReward());
    openDialog(refs.offline);
  }

  function formatClock(seconds) {
    const whole = Math.ceil(seconds);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  }

  function watchAd(grant, onUnavailable = () => toast(i18n.t('ads.unavailable'))) {
    adFlow?.reward(grant).then((watched) => {
      if (!watched) onUnavailable();
      render();
    });
  }

  // Texts that only change with the language.
  function translate() {
    document.documentElement.lang = i18n.language;
    document.title = i18n.t('app.title');
    for (const node of root.querySelectorAll('[data-text]')) setText(node, i18n.t(node.dataset.text));
    for (const node of root.querySelectorAll('[data-label]')) node.setAttribute('aria-label', i18n.t(node.dataset.label));
    for (const button of amountButtons) {
      setText(button, button.dataset.amount === 'max' ? i18n.t('buy.max') : `×${button.dataset.amount}`);
    }
    for (const [id, { fields }] of generatorRows) setText(fields.name, name('generator', id));
    for (const upgrade of upgrades) {
      const { fields } = upgradeRows.get(upgrade.id);
      const effect = describeEffect(upgrade.effect);
      const named = i18n.has(`upgrade.${upgrade.id}.name`);
      setText(fields.name, named ? name('upgrade', upgrade.id) : effect);
      setText(fields.effect, named ? effect : '');
    }
    for (const achievement of achievements) {
      const { fields } = achievementTiles.get(achievement.id);
      const condition = describeCondition(achievement.condition);
      const named = i18n.has(`achievement.${achievement.id}.name`);
      setText(fields.name, named ? name('achievement', achievement.id) : condition);
      setText(fields.condition, named ? condition : '');
    }
    setText(refs.prestigeExplain, i18n.t('prestige.explain', { bonus: formatPercent(theme.prestige.bonusPerPoint, i18n.language) }));
    refs.languageSelect.value = i18n.language;
  }

  function selectTab(tab) {
    activeTab = tab;
    for (const button of tabButtons) {
      const selected = button.dataset.tab === tab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    for (const panel of panels) setHidden(panel, panel.dataset.panel !== tab);
  }

  function selectAmount(amount) {
    buyAmount = amount;
    for (const button of amountButtons) {
      const checked = button.dataset.amount === amount;
      button.setAttribute('aria-checked', String(checked));
      button.tabIndex = checked ? 0 : -1;
    }
  }

  // Everything that changes while playing.
  function render() {
    const { state } = game;
    setText(refs.currency, i18n.t('currency.amount', { value: format(state.currency, 'floor') }));
    setText(refs.rate, i18n.t('stats.perSecond', { value: format(economy.productionPerSecond(state)) }));
    setText(refs.clickValue, i18n.t('click.value', { value: format(economy.clickValue(state)) }));

    // Producers appear one at a time: everything owned plus the next one.
    const production = economy.productionByGenerator(state);
    let lastOwned = -1;
    theme.generators.forEach(({ id }, index) => {
      if (state.generators[id] > 0) lastOwned = index;
    });
    theme.generators.forEach(({ id }, index) => {
      const { row, button, fields } = generatorRows.get(id);
      setHidden(row, index > lastOwned + 1);
      const amount = buyAmount === 'max' ? Math.max(1, economy.maxAffordable(state, id)) : Number(buyAmount);
      const price = economy.generatorCost(state, id, amount);
      setText(fields.owned, i18n.t('generator.owned', { value: format(state.generators[id]) }));
      setText(fields.production, i18n.t('generator.production', { value: format(production.get(id)) }));
      setText(fields.buyLabel, i18n.t('buy.label', { amount: format(amount) }));
      setText(fields.price, format(price, 'ceil'));
      setDisabled(button, !(price <= state.currency));
    });
    setHidden(refs.generatorsHint, lastOwned + 1 >= theme.generators.length - 1);

    let available = 0;
    for (const upgrade of upgrades) {
      const { row, button, fields } = upgradeRows.get(upgrade.id);
      const visible = economy.isUpgradeAvailable(state, upgrade.id);
      if (visible) available += 1;
      // Upgrades that appear while playing go to the end of the list; sorted
      // in by price they would push the row under the pointer down.
      if (visible && !shownUpgrades.has(upgrade.id) && rendered) row.parentElement.append(row);
      if (visible) shownUpgrades.add(upgrade.id);
      else shownUpgrades.delete(upgrade.id);
      setHidden(row, !visible);
      setText(fields.price, format(upgrade.cost, 'ceil'));
      setDisabled(button, !(upgrade.cost <= state.currency));
    }
    setHidden(refs.upgradesEmpty, available > 0);
    setText(refs.upgradesBought, i18n.t('upgrades.bought', { count: state.upgrades.length, total: upgrades.length }));

    for (const [id, { row }] of achievementTiles) row.classList.toggle('is-unlocked', state.achievements.includes(id));
    setText(
      refs.achievementsProgress,
      i18n.t('achievements.progress', { unlocked: state.achievements.length, total: achievements.length }),
    );

    const gain = economy.prestigeGain(state);
    setText(refs.prestigePoints, i18n.t('prestige.points', { value: format(state.prestigePoints) }));
    setText(
      refs.prestigeBonus,
      i18n.t('prestige.bonus', { value: formatPercent(economy.prestigeMultiplier(state) - 1, i18n.language) }),
    );
    setText(
      refs.prestigeGain,
      gain >= 1
        ? i18n.t('prestige.gain', { value: format(gain) })
        : i18n.t('prestige.notYet', { value: format(theme.prestige.threshold), current: format(state.runEarned, 'floor') }),
    );
    setDisabled(refs.prestigeButton, gain < 1);

    const { factor, seconds } = theme.boost;
    const boostActive = state.boostSeconds > 0;
    const price = economy.boostPrice(state);
    // Nothing is offered before anything produces: a price of 0 would look
    // free, and no ad should be offered before the player has played a bit.
    setHidden(refs.boost, !boostActive && !(price > 0));
    setText(
      refs.boostTitle,
      boostActive
        ? i18n.t('boost.active', { factor: format(factor), time: formatClock(state.boostSeconds) })
        : i18n.t('boost.offer', { factor: format(factor), minutes: format(seconds / 60) }),
    );
    // While the boost runs the buttons only turn invisible, so the layout
    // below them does not jump when they come back.
    const visibility = boostActive ? 'hidden' : '';
    if (refs.boostActions.style.visibility !== visibility) refs.boostActions.style.visibility = visibility;
    setHidden(refs.boostAd, !adFlow?.canOfferReward());
    setText(refs.boostBuy, i18n.t('boost.buy', { price: format(price, 'ceil') }));
    setDisabled(refs.boostBuy, !(price > 0 && price <= state.currency));
    rendered = true;
  }

  // Notices wait while a dialog is open: behind its backdrop they are hard to
  // see and hidden from screen readers. Notices already on screen when a
  // dialog opens come back once it is closed.
  const pendingToasts = [];
  const dialogOpen = () => root.querySelector('dialog[open]') !== null;

  function showToast(text) {
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = text;
    refs.toasts.append(node);
    setTimeout(() => node.remove(), TOAST_MS);
  }

  function toast(text) {
    if (dialogOpen()) pendingToasts.push(text);
    else showToast(text);
  }

  function openDialog(dialog) {
    if (dialog.open) return;
    for (const node of [...refs.toasts.children]) {
      pendingToasts.push(node.textContent);
      node.remove();
    }
    dialog.showModal();
  }

  function spawnFloater() {
    if (refs.floaters.childElementCount >= MAX_FLOATERS) return;
    const node = document.createElement('span');
    node.className = 'floater';
    node.textContent = i18n.t('click.value', { value: format(economy.clickValue(game.state)) });
    node.style.setProperty('--offset', `${Math.round((Math.random() - 0.5) * 80)}px`);
    node.addEventListener('animationend', () => node.remove());
    refs.floaters.append(node);
  }

  function openPrestigeConfirm() {
    setText(refs.confirmPrestigeBody, i18n.t('prestige.confirm.body', { points: format(economy.prestigeGain(game.state)) }));
    refs.confirmPrestige.returnValue = '';
    openDialog(refs.confirmPrestige);
  }

  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled || !root.contains(target)) return;
    const { action, id } = target.dataset;
    if (action === 'click') {
      if (game.click()) spawnFloater();
    } else if (action === 'buy-generator') {
      if (buyAmount === 'max') game.buyMaxGenerator(id);
      else game.buyGenerator(id, Number(buyAmount));
    } else if (action === 'buy-upgrade') {
      game.buyUpgrade(id);
    } else if (action === 'set-amount') {
      selectAmount(target.dataset.amount);
    } else if (action === 'select-tab') {
      selectTab(target.dataset.tab);
    } else if (action === 'open-settings') {
      openDialog(refs.settings);
    } else if (action === 'prestige') {
      openPrestigeConfirm();
    } else if (action === 'reset') {
      refs.settings.close();
      refs.confirmReset.returnValue = '';
      openDialog(refs.confirmReset);
    } else if (action === 'boost-buy') {
      game.buyBoost();
    } else if (action === 'boost-ad') {
      watchAd(() => game.activateBoost());
    } else if (action === 'reload') {
      window.location.reload();
    } else if (action === 'offline-double' && offlineShown && !offlineShown.doubled) {
      const shown = offlineShown;
      const bonus = shown.amount;
      watchAd(
        () => {
          game.grant(bonus);
          shown.doubled = true;
          if (offlineShown !== shown) return; // the dialog was closed meanwhile
          setHidden(refs.offlineDouble, true);
          setText(refs.offlineNote, i18n.t('offline.doubled', { amount: format(bonus) }));
        },
        () => {
          // Said in the dialog itself: a notice would wait until it is closed.
          if (offlineShown === shown) setText(refs.offlineNote, i18n.t('ads.unavailable'));
          else toast(i18n.t('ads.unavailable'));
        },
      );
    }
    render();
  });

  // Arrow keys move between the buy amounts, as in other radio groups.
  root.querySelector('.segmented').addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    const next = BUY_AMOUNTS[(BUY_AMOUNTS.indexOf(buyAmount) + step + BUY_AMOUNTS.length) % BUY_AMOUNTS.length];
    selectAmount(next);
    root.querySelector(`[data-action="set-amount"][data-amount="${next}"]`).focus();
    render();
    event.preventDefault();
  });

  // Arrow keys move between tabs, as in other tab lists.
  root.querySelector('[role="tablist"]').addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    const next = TABS[(TABS.indexOf(activeTab) + step + TABS.length) % TABS.length];
    selectTab(next);
    root.querySelector(`#tab-${next}`).focus();
    event.preventDefault();
  });

  refs.confirmPrestige.addEventListener('close', () => {
    if (refs.confirmPrestige.returnValue === 'confirm') game.prestige();
    render();
  });

  refs.confirmReset.addEventListener('close', () => {
    if (refs.confirmReset.returnValue === 'confirm') onReset();
    render();
  });

  refs.offline.addEventListener('close', () => {
    offlineShown = null;
  });

  refs.languageSelect.addEventListener('change', () => {
    i18n.setLanguage(refs.languageSelect.value);
    translate();
    render();
    onLanguageChange(i18n.language);
  });

  game.on((event) => {
    if (event.type === 'achievements') {
      for (const id of event.ids) {
        const achievement = achievements.find((entry) => entry.id === id);
        toast(i18n.t('achievement.unlocked', { name: name('achievement', id, describeCondition(achievement.condition)) }));
      }
    } else if (event.type === 'prestige') {
      toast(i18n.t('prestige.done', { value: formatPercent(economy.prestigeMultiplier(game.state) - 1, i18n.language) }));
    } else if (event.type === 'offline') {
      showOffline(event);
    } else if (event.type === 'reset') {
      toast(i18n.t('reset.done'));
    } else if (event.type === 'boost') {
      toast(i18n.t('boost.started', { factor: format(theme.boost.factor), minutes: format(theme.boost.seconds / 60) }));
    }
  });

  // While an ad runs or another tab owns the save, nothing in the game can be
  // used. Browsers may close a modal dialog after repeated Escape presses even
  // if "cancel" is prevented, so these dialogs reopen and the rest is inert.
  let adRunning = false;
  let otherTab = false;
  function updateBlocked() {
    for (const child of root.children) {
      if (child !== refs.adOverlay && child !== refs.otherTab) child.inert = adRunning || otherTab;
    }
  }
  function keepOpen(dialog, isNeeded) {
    dialog.addEventListener('cancel', (event) => event.preventDefault());
    dialog.addEventListener('close', () => {
      if (isNeeded()) openDialog(dialog);
    });
  }

  adFlow?.on((type) => {
    adRunning = type === 'start';
    updateBlocked();
    if (adRunning) openDialog(refs.adOverlay);
    if (!adRunning && refs.adOverlay.open) refs.adOverlay.close();
  });
  keepOpen(refs.adOverlay, () => adFlow?.busy);

  // Another tab saved: this one no longer saves, and continuing here means
  // loading that newer save.
  function showOtherTab() {
    otherTab = true;
    updateBlocked();
    openDialog(refs.otherTab);
  }
  keepOpen(refs.otherTab, () => otherTab);

  for (const dialog of root.querySelectorAll('dialog')) {
    dialog.addEventListener('close', () =>
      // After the other close handlers, which may open the next dialog.
      setTimeout(() => {
        if (!dialogOpen()) for (const text of pendingToasts.splice(0)) showToast(text);
      }),
    );
  }

  function showStorageProblem(kind) {
    const key = STORAGE_TEXTS[kind];
    refs.storageNote.dataset.text = key; // translate() keeps it in the chosen language
    setText(refs.storageNote, i18n.t(key));
    setHidden(refs.storageNote, false);
    toast(i18n.t(key));
  }

  selectTab(activeTab);
  selectAmount(buyAmount);
  translate();
  render();
  if (storageProblem) showStorageProblem(storageProblem);

  return { render, translate, toast, showOtherTab, showStorageProblem };
}
