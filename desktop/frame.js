import { resizeWindowBounds } from './window-geometry.mjs';

const opacity = document.getElementById('opacity');
const value = document.getElementById('opacity-value');
const errorPanel = document.getElementById('load-error');
const errorMessage = document.getElementById('error-message');
const controlError = document.getElementById('control-error');

function showError(error) {
  const message = error.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
  controlError.textContent = message;
  controlError.title = message;
  controlError.hidden = false;
  controlError.dataset.kind = 'error';
  controlError.setAttribute('role', 'alert');
}

opacity.value = localStorage.getItem('background-opacity') ?? '85';
function applyOpacity() {
  value.textContent = `${opacity.value}%`;
  window.desktopControls.setOpacity(Number(opacity.value)).then(() => {
    localStorage.setItem('background-opacity', opacity.value);
  }).catch(showError);
}
opacity.addEventListener('input', applyOpacity);
applyOpacity();

const cardOpacity = document.getElementById('card-opacity');
const cardValue = document.getElementById('card-opacity-value');
cardOpacity.value = localStorage.getItem('card-opacity') ?? '85';
function applyCardOpacity() {
  cardValue.textContent = `${cardOpacity.value}%`;
  window.desktopControls.setCardOpacity(Number(cardOpacity.value)).then(() => {
    localStorage.setItem('card-opacity', cardOpacity.value);
  }).catch(showError);
}
cardOpacity.addEventListener('input', applyCardOpacity);
applyCardOpacity();

window.desktopControls.onAppearance((appearance) => {
  opacity.value = String(appearance.backgroundOpacity);
  cardOpacity.value = String(appearance.cardOpacity);
  value.textContent = `${opacity.value}%`;
  cardValue.textContent = `${cardOpacity.value}%`;
  opacity.disabled = cardOpacity.disabled = !appearance.ready;
  if (appearance.ready) {
    localStorage.setItem('background-opacity', opacity.value);
    localStorage.setItem('card-opacity', cardOpacity.value);
  }
});

document.getElementById('login').addEventListener('click', () => window.desktopControls.pasteLogin().catch(showError));
document.getElementById('browser').addEventListener('click', () => window.desktopControls.openBrowser().catch(showError));
document.getElementById('hide').addEventListener('click', () => window.desktopControls.hide().catch(showError));
document.getElementById('quit').addEventListener('click', () => window.desktopControls.quit().catch(showError));
document.getElementById('retry').addEventListener('click', () => window.desktopControls.retry().catch(showError));
document.getElementById('fit').addEventListener('click', () => window.desktopControls.fit().catch(showError));

let gesture = null;
function beginGesture(event, kind, edge = '') {
  if (event.button !== 0 || (kind === 'move' && event.target.closest('.controls'))) return;
  event.preventDefault();
  event.currentTarget.setPointerCapture(event.pointerId);
  const startX = event.screenX;
  const startY = event.screenY;
  const next = { kind, edge, bounds: null, startX, startY, pointerId: event.pointerId };
  gesture = next;
  window.desktopControls.bounds().then((bounds) => {
    if (gesture === next) next.bounds = bounds;
  }).catch(showError);
}
document.querySelector('header').addEventListener('pointerdown', (event) => beginGesture(event, 'move'));
const resize = document.querySelector('.resize-se');
document.querySelectorAll('[data-edge]').forEach((edge) => edge.addEventListener('pointerdown', (event) => beginGesture(event, 'resize', edge.dataset.edge)));
document.addEventListener('pointermove', (event) => {
  if (!gesture?.bounds || gesture.pointerId !== event.pointerId) return;
  const { kind, edge, bounds, startX, startY } = gesture;
  const dx = event.screenX - startX;
  const dy = event.screenY - startY;
  window.desktopControls.setBounds(kind === 'move'
    ? { ...bounds, x: bounds.x + dx, y: bounds.y + dy }
    : resizeWindowBounds(bounds, edge, dx, dy, bounds.workArea)).catch(showError);
});
document.addEventListener('pointerup', () => { gesture = null; });
document.addEventListener('pointercancel', () => { gesture = null; });
resize.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  window.desktopControls.bounds().then((bounds) => window.desktopControls.setBounds({ ...bounds,
    width: bounds.width + (event.key === 'ArrowLeft' ? -20 : event.key === 'ArrowRight' ? 20 : 0),
    height: bounds.height + (event.key === 'ArrowUp' ? -20 : event.key === 'ArrowDown' ? 20 : 0),
  })).catch(showError);
});
window.desktopControls.onStatus((message) => {
  controlError.setAttribute('role', message ? 'alert' : 'status');
  controlError.dataset.kind = 'error';
  controlError.textContent = message;
  controlError.title = message;
  controlError.hidden = !message;
  errorMessage.textContent = message;
  errorPanel.hidden = !message;
});
window.desktopControls.onAuthStatus(({ kind, message }) => {
  controlError.dataset.kind = kind;
  controlError.textContent = message;
  controlError.title = message;
  controlError.hidden = !message;
  controlError.setAttribute('role', kind === 'error' ? 'alert' : 'status');
});
