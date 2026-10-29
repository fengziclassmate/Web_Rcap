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

document.getElementById('login').addEventListener('click', () => window.desktopControls.pasteLogin().catch(showError));
document.getElementById('browser').addEventListener('click', () => window.desktopControls.openBrowser().catch(showError));
document.getElementById('hide').addEventListener('click', () => window.desktopControls.hide().catch(showError));
document.getElementById('quit').addEventListener('click', () => window.desktopControls.quit().catch(showError));
document.getElementById('retry').addEventListener('click', () => window.desktopControls.retry().catch(showError));
document.getElementById('fit').addEventListener('click', () => window.desktopControls.fit().catch(showError));

let gesture = null;
function beginGesture(event, kind) {
  if (event.button !== 0 || (kind === 'move' && event.target.closest('.controls'))) return;
  event.preventDefault();
  event.currentTarget.setPointerCapture(event.pointerId);
  const startX = event.screenX;
  const startY = event.screenY;
  const next = { kind, bounds: null, startX, startY, pointerId: event.pointerId };
  gesture = next;
  window.desktopControls.bounds().then((bounds) => {
    if (gesture === next) next.bounds = bounds;
  }).catch(showError);
}
document.querySelector('header').addEventListener('pointerdown', (event) => beginGesture(event, 'move'));
const resize = document.getElementById('resize');
resize.addEventListener('pointerdown', (event) => beginGesture(event, 'resize'));
document.addEventListener('pointermove', (event) => {
  if (!gesture?.bounds || gesture.pointerId !== event.pointerId) return;
  const { kind, bounds, startX, startY } = gesture;
  const dx = event.screenX - startX;
  const dy = event.screenY - startY;
  window.desktopControls.setBounds(kind === 'move'
    ? { ...bounds, x: bounds.x + dx, y: bounds.y + dy }
    : { ...bounds, width: bounds.width + dx, height: bounds.height + dy }).catch(showError);
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
  controlError.textContent = message;
  controlError.title = message;
  controlError.hidden = !message;
  errorMessage.textContent = message;
  errorPanel.hidden = !message;
});
