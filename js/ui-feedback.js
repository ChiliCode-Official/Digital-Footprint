(function () {
  const showToast = (message, type = 'info') => {
    let toast = document.getElementById('gk-toast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'gk-toast'; toast.setAttribute('role', 'status'); document.body.appendChild(toast); }
    toast.className = `gk-toast gk-toast-${type} show`;
    toast.textContent = String(message);
    clearTimeout(window.__gkToastTimer);
    window.__gkToastTimer = setTimeout(() => toast.classList.remove('show'), 3600);
  };
  window.showToast = showToast;
  window.alert = (message) => showToast(message, 'info');
})();
