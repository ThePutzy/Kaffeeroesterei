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

function markup(theme, upgrades, achievements) {
  const generators = theme.generators
    .map(
      ({ id }) => `
        <li class="row generator" data-id="${id}">
          <div class="row-main">
            <div class="row-title"><span data-field="name"></span> <span class="count" data-field="owned"></span></div>
            <div class="row-detail" data-field="production"></div>
          </div>
          <button type="button" class="buy" data-action="buy-generator" data-id="${id}">
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
            <div class="row-title" data-field="name"></div>
            <div class="row-detail" data-field="effect"></div>
          </div>
          <button type="button" class="buy" data-action="buy-upgrade" data-id="${id}">
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
        <div class="balance-amount" data-ref="currency"></div>
        <div class="balance-rate" data-ref="rate"></div>
      </div>
      <button type="button" class="icon-button" data-action="open-settings" data-label="settings.title">${SETTINGS_ICON}</button>
    </header>
    <section class="roaster">
      <button type="button" class="click-button" data-action="click">
        <span class="click-label" data-text="click.action"></span>
        <span class="click-value" data-ref="clickValue"></span>
      </button>
      <div class="floaters" aria-hidden="true" data-ref="floaters"></div>
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
        <label class="field">
          <span data-text="settings.language"></span>
          <select data-ref="languageSelect">
            ${LANGUAGES.map((language) => `<option value="${language}" lang="${language}">${LANGUAGE_NAMES[language]}</option>`).join('')}
          </select>
        </label>
        <div class="dialog-actions">
          <button value="close" class="primary" data-text="dialog.close"></button>
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
    <div class="toasts" role="status" aria-live="polite" data-ref="toasts"></div>`;
}

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

export function createUi({ root, game, i18n, onLanguageChange = () => {} }) {
  const { economy } = game;
  const { theme } = economy;
  const upgrades = [...(theme.upgrades ?? [])].sort((a, b) => a.cost - b.cost);
  const achievements = theme.achievements ?? [];
  let activeTab = 'generators';
  let buyAmount = '1';

  root.innerHTML = markup(theme, upgrades, achievements);
  const refs = Object.fromEntries([...root.querySelectorAll('[data-ref]')].map((node) => [node.dataset.ref, node]));
  const generatorRows = rowsBy(root, '.generator');
  const upgradeRows = rowsBy(root, '.upgrade');
  const achievementTiles = rowsBy(root, '.achievement');
  const tabButtons = [...root.querySelectorAll('[role="tab"]')];
  const panels = [...root.querySelectorAll('[role="tabpanel"]')];
  const amountButtons = [...root.querySelectorAll('[data-action="set-amount"]')];

  const format = (value) => formatNumber(value, i18n.language);
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
    for (const button of amountButtons) button.setAttribute('aria-checked', String(button.dataset.amount === amount));
  }

  // Everything that changes while playing.
  function render() {
    const { state } = game;
    setText(refs.currency, i18n.t('currency.amount', { value: format(state.currency) }));
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
      setText(fields.price, format(price));
      setDisabled(button, !(price <= state.currency));
    });
    setHidden(refs.generatorsHint, lastOwned + 1 >= theme.generators.length - 1);

    let available = 0;
    for (const upgrade of upgrades) {
      const { row, button, fields } = upgradeRows.get(upgrade.id);
      const visible = economy.isUpgradeAvailable(state, upgrade.id);
      if (visible) available += 1;
      setHidden(row, !visible);
      setText(fields.price, format(upgrade.cost));
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
        : i18n.t('prestige.notYet', { value: format(theme.prestige.threshold), current: format(state.runEarned) }),
    );
    setDisabled(refs.prestigeButton, gain < 1);
  }

  function toast(text) {
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = text;
    refs.toasts.append(node);
    setTimeout(() => node.remove(), TOAST_MS);
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
    refs.confirmPrestige.showModal();
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
      refs.settings.showModal();
    } else if (action === 'prestige') {
      openPrestigeConfirm();
    }
    render();
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
    }
  });

  selectTab(activeTab);
  selectAmount(buyAmount);
  translate();
  render();

  return { render, translate, toast };
}
