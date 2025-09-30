/* eslint-disable no-console */

const STORAGE_KEYS = {
  apiKey: 'omr_api_key',
  model: 'omr_model',
  uiTheme: 'omr_ui_theme',
  uiTransparency: 'omr_ui_transparency',
};

function qs(id) { return document.getElementById(id); }
function showToast(msg) {
  const t = qs('toast');
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 1500);
}

document.addEventListener('DOMContentLoaded', () => {
  const apiKeyEl = qs('apiKey');
  const modelEl = qs('model');
  const themeEls = document.querySelectorAll('input[name="theme"]');
  const transEl = qs('transparency');
  const btnSave = qs('btnSave');
  const btnTest = qs('btnTest');

  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
    if (!res) return;
    apiKeyEl.value = res.apiKey || '';
    modelEl.value = res.model || 'gpt-4.1-mini';
    for (const r of themeEls) r.checked = r.value === (res.theme || 'light');
    const transparency = Math.round((res.transparency ?? 0.92) * 100);
    transEl.value = String(transparency);
  });

  btnSave.addEventListener('click', () => {
    const theme = [...themeEls].find((r) => r.checked)?.value || 'light';
    const transparency = (Number(transEl.value || '92') / 100);
    chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      payload: {
        apiKey: apiKeyEl.value.trim(),
        model: modelEl.value,
        theme,
        transparency,
      },
    }, (res) => {
      if (res?.ok) showToast('Salvo');
    });
  });

  btnTest.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'TEST_OPENAI', payload: { apiKey: apiKeyEl.value.trim(), model: modelEl.value } }, (res) => {
      showToast(res?.ok ? 'Conectado' : 'Falha');
    });
  });
});

