// O Melhor Robô - background (service worker)
// Responsável por: context menus, comandos, roteamento de mensagens, OpenAI API, memória curta

/* eslint-disable no-console */

const STORAGE_KEYS = {
  apiKey: 'omr_api_key',
  model: 'omr_model',
  uiTheme: 'omr_ui_theme', // 'light' | 'dark'
  uiTransparency: 'omr_ui_transparency', // 0..1
  chatMemory: 'omr_chat_memory', // map por tabId ou origin
};

const DEFAULTS = {
  model: 'gpt-4.1-mini',
  uiTheme: 'light',
  uiTransparency: 0.92,
  memoryTurns: 10,
};

// Utilitários de storage
async function getFromStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (items) => resolve(items));
  });
}

async function setInStorage(obj) {
  return new Promise((resolve) => {
    chrome.storage.local.set(obj, () => resolve());
  });
}

// Context Menus (PT-BR, separados)
function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    // Categoria: IA na Mão (texto selecionado)
    chrome.contextMenus.create({
      id: 'ia-mao-root',
      title: '🤖 Agente IA (Ação com Texto)',
      contexts: ['selection'],
    });
    const chatActions = [
      { id: 'cmd-bate-bola', title: '/bate-bola' },
      { id: 'cmd-diganaoaoprecoce', title: '/diganaoaoprecoce' },
      { id: 'cmd-comopromptisso', title: '/comoPromptisso' },
      { id: 'cmd-critica', title: '/criticaSincera' },
      { id: 'cmd-ideias', title: '/ideiasMirabolantes' },
    ];
    chatActions.forEach((a) => {
      chrome.contextMenus.create({
        id: a.id,
        parentId: 'ia-mao-root',
        title: a.title,
        contexts: ['selection'],
      });
    });

    // Categoria: IA na Cara (página)
    chrome.contextMenus.create({ id: 'ia-cara-root', title: '🧠 IA na Cara', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'flash-insights', parentId: 'ia-cara-root', title: '⚡ Flash Insights (Resumo Rápido)', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'deep-dive', parentId: 'ia-cara-root', title: '🧠 Deep Dive (Análise Detalhada)', contexts: ['page'] });

    // Categoria: Trecos Úteis
    chrome.contextMenus.create({ id: 'trecos-root', title: '🧰 Trecos Úteis', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'print-selecao', parentId: 'trecos-root', title: 'Print de Tela (Selecionar área)', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'voice-toggle', parentId: 'trecos-root', title: 'Ditado por Voz (Iniciar/Parar)', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'duplicar-aba', parentId: 'trecos-root', title: 'Duplicar Aba', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'renomear-aba', parentId: 'trecos-root', title: 'Renomear Aba (sessão)', contexts: ['page'] });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;
  const tabId = tab.id;
  const selectionText = info.selectionText || '';
  switch (info.menuItemId) {
    case 'cmd-bate-bola':
    case 'cmd-diganaoaoprecoce':
    case 'cmd-comopromptisso':
    case 'cmd-critica':
    case 'cmd-ideias': {
      chrome.tabs.sendMessage(tabId, { type: 'OPEN_CHAT_WITH_SELECTION', selectionText, slash: menuIdToSlash(info.menuItemId) });
      break;
    }
    case 'flash-insights': {
      chrome.tabs.sendMessage(tabId, { type: 'RUN_FLASH_INSIGHTS' });
      break;
    }
    case 'deep-dive': {
      chrome.tabs.sendMessage(tabId, { type: 'RUN_DEEP_DIVE' });
      break;
    }
    case 'print-selecao': {
      chrome.tabs.sendMessage(tabId, { type: 'START_SCREENSHOT_SELECTION' });
      break;
    }
    case 'voice-toggle': {
      chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_VOICE' });
      break;
    }
    case 'duplicar-aba': {
      duplicateCurrentTab(tab);
      break;
    }
    case 'renomear-aba': {
      chrome.tabs.sendMessage(tabId, { type: 'PROMPT_RENAME_TAB' });
      break;
    }
    default:
      break;
  }
});

function menuIdToSlash(menuId) {
  switch (menuId) {
    case 'cmd-bate-bola':
      return '/bate-bola';
    case 'cmd-diganaoaoprecoce':
      return '/diganaoaoprecoce';
    case 'cmd-comopromptisso':
      return '/comoPromptisso';
    case 'cmd-critica':
      return '/criticaSincera';
    case 'cmd-ideias':
      return '/ideiasMirabolantes';
    default:
      return '';
  }
}

// Comandos (atalhos)
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  switch (command) {
    case 'ia_texto_selecionado':
      chrome.tabs.sendMessage(tab.id, { type: 'OPEN_CHAT_WITH_SELECTION_REQUEST' });
      break;
    case 'flash_insights':
      chrome.tabs.sendMessage(tab.id, { type: 'RUN_FLASH_INSIGHTS' });
      break;
    case 'deep_dive':
      chrome.tabs.sendMessage(tab.id, { type: 'RUN_DEEP_DIVE' });
      break;
    case 'screenshot_select':
      chrome.tabs.sendMessage(tab.id, { type: 'START_SCREENSHOT_SELECTION' });
      break;
    case 'voice_toggle':
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_VOICE' });
      break;
    case 'duplicate_tab':
      duplicateCurrentTab(tab);
      break;
    case 'rename_tab':
      chrome.tabs.sendMessage(tab.id, { type: 'PROMPT_RENAME_TAB' });
      break;
    default:
      break;
  }
});

async function duplicateCurrentTab(tab) {
  try {
    const originalTabId = tab.id;
    // solicitar posição de scroll ao content
    const [{ result: scrollY } = { result: 0 }] = await chrome.scripting.executeScript({
      target: { tabId: originalTabId },
      func: () => window.scrollY,
    });
    const newTab = await chrome.tabs.create({ url: tab.url, active: false, index: tab.index + 1 });
    // aplicar scroll quando pronto
    setTimeout(() => {
      chrome.scripting.executeScript({
        target: { tabId: newTab.id },
        func: (y) => window.scrollTo({ top: y, behavior: 'instant' }),
        args: [scrollY],
      });
    }, 800);
  } catch (e) {
    console.error('Erro ao duplicar aba:', e);
  }
}

// Mensageria principal
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === 'GET_TAB_ID') {
        sendResponse({ tabId: sender?.tab?.id });
        return;
      }
      if (msg?.type === 'GET_SETTINGS') {
        const { omr_api_key, omr_model, omr_ui_theme, omr_ui_transparency } = await getFromStorage([
          STORAGE_KEYS.apiKey,
          STORAGE_KEYS.model,
          STORAGE_KEYS.uiTheme,
          STORAGE_KEYS.uiTransparency,
        ]);
        sendResponse({
          apiKey: omr_api_key || '',
          model: omr_model || DEFAULTS.model,
          theme: omr_ui_theme || DEFAULTS.uiTheme,
          transparency: typeof omr_ui_transparency === 'number' ? omr_ui_transparency : DEFAULTS.uiTransparency,
        });
        return;
      }

      if (msg?.type === 'SAVE_SETTINGS') {
        const { apiKey, model, theme, transparency } = msg.payload || {};
        const toSave = {};
        if (typeof apiKey === 'string') toSave[STORAGE_KEYS.apiKey] = apiKey;
        if (typeof model === 'string') toSave[STORAGE_KEYS.model] = model;
        if (theme) toSave[STORAGE_KEYS.uiTheme] = theme;
        if (typeof transparency === 'number') toSave[STORAGE_KEYS.uiTransparency] = transparency;
        await setInStorage(toSave);
        sendResponse({ ok: true });
        return;
      }

      if (msg?.type === 'TEST_OPENAI') {
        const ok = await testOpenAI(msg.payload?.apiKey, msg.payload?.model || DEFAULTS.model);
        sendResponse({ ok });
        return;
      }

      if (msg?.type === 'OPENAI_CHAT') {
        const { messages, system, model, tabId, memoryKey } = msg.payload;
        const completion = await runChatWithMemory({ messages, system, model, tabId, memoryKey });
        sendResponse({ ok: true, completion });
        return;
      }

      if (msg?.type === 'CAPTURE_VISIBLE_TAB') {
        const dataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: 'png' });
        sendResponse({ ok: true, dataUrl });
        return;
      }
    } catch (e) {
      console.error('Erro na mensagem:', msg?.type, e);
      sendResponse({ ok: false, error: e?.message || String(e) });
    }
  })();
  return true; // manter canal assíncrono
});

async function getApiConfig() {
  const { omr_api_key, omr_model } = await getFromStorage([STORAGE_KEYS.apiKey, STORAGE_KEYS.model]);
  return {
    apiKey: omr_api_key || '',
    model: omr_model || DEFAULTS.model,
  };
}

async function testOpenAI(apiKey, model) {
  try {
    const usedKey = apiKey || (await getApiConfig()).apiKey;
    if (!usedKey) return false;
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${usedKey}`,
      },
      body: JSON.stringify({
        model: model || DEFAULTS.model,
        input: [
          { role: 'system', content: 'Teste rápido de conectividade.' },
          { role: 'user', content: 'Responda com OK' },
        ],
        max_output_tokens: 5,
      }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    const text = json?.output?.[0]?.content?.[0]?.text || json?.output_text || '';
    return typeof text === 'string';
  } catch (e) {
    console.error('Falha ao testar OpenAI:', e);
    return false;
  }
}

async function runChatWithMemory({ messages, system, model, tabId, memoryKey }) {
  const { apiKey, model: storedModel } = await getApiConfig();
  const finalModel = model || storedModel;
  const key = memoryKey || `tab:${tabId || 'global'}`;
  const memory = (await getFromStorage([STORAGE_KEYS.chatMemory]))[STORAGE_KEYS.chatMemory] || {};
  const turns = Array.isArray(memory[key]) ? memory[key] : [];

  // limite 10 interações, fallback 5 se necessário
  const maxTurns = DEFAULTS.memoryTurns;
  const contextTurns = turns.slice(-maxTurns);

  const payloadMessages = [];
  if (system) payloadMessages.push({ role: 'system', content: system });
  for (const m of contextTurns) payloadMessages.push(m);
  for (const m of messages) payloadMessages.push(m);

  const completion = await callOpenAIResponses({ apiKey, model: finalModel, messages: payloadMessages });

  // Atualiza memória
  const newTurns = [...contextTurns, ...messages];
  if (completion?.assistant) newTurns.push({ role: 'assistant', content: completion.assistant });
  memory[key] = newTurns.slice(-maxTurns);
  await setInStorage({ [STORAGE_KEYS.chatMemory]: memory });

  return completion;
}

async function callOpenAIResponses({ apiKey, model, messages }) {
  // Tenta Responses API; fallback simples ao Chat Completions se necessário
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: messages,
        temperature: 0.7,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || 'Erro na API OpenAI');
    const text = json?.output?.[0]?.content?.[0]?.text || json?.output_text || '';
    return { assistant: text, raw: json };
  } catch (e) {
    console.warn('Falling back to Chat Completions:', e?.message);
    const res2 = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages }),
    });
    const json2 = await res2.json();
    if (!res2.ok) throw new Error(json2?.error?.message || 'Erro na API OpenAI (fallback)');
    const text2 = json2?.choices?.[0]?.message?.content || '';
    return { assistant: text2, raw: json2 };
  }
}

