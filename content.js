// Content script: UI do chat, overlay de seleção, ditado, renomeio de aba
/* eslint-disable no-console */

(function () {
  const STATE = {
    theme: 'light',
    transparency: 0.92,
    model: 'gpt-4.1-mini',
    selectionText: '',
    voiceActive: false,
    chatOpen: false,
    memoryKey: null,
  };

  // Monta Shadow DOM para isolar estilos
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  document.documentElement.appendChild(host);

  // Carrega CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('styles.css');
  shadow.appendChild(link);

  // Fonte Montserrat (fallback se CSP bloquear)
  const gf = document.createElement('link');
  gf.rel = 'stylesheet';
  gf.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600&display=swap';
  shadow.appendChild(gf);

  const root = document.createElement('div');
  root.className = 'omr-root';
  shadow.appendChild(root);

  // Ícone flutuante (draggable)
  const fab = document.createElement('div');
  fab.className = 'omr-fab';
  fab.title = 'O Melhor Robô';
  fab.textContent = '🤖';
  root.appendChild(fab);

  // Janela do chat
  const chat = document.createElement('div');
  chat.className = 'omr-chat';
  chat.style.display = 'none';

  const header = document.createElement('div');
  header.className = 'omr-header';
  const titleWrap = document.createElement('div');
  titleWrap.className = 'omr-title';
  const title = document.createElement('span');
  title.textContent = 'O Melhor Robô';
  const modelEl = document.createElement('span');
  modelEl.style.fontWeight = '400';
  modelEl.style.color = 'var(--omr-muted)';
  modelEl.textContent = ` · ${STATE.model}`;
  titleWrap.appendChild(title);
  titleWrap.appendChild(modelEl);

  const controls = document.createElement('div');
  controls.className = 'omr-controls';
  const btnClear = iconBtn('🗑️', 'Limpar conversa');
  const btnMin = iconBtn('➖', 'Minimizar');
  const btnMax = iconBtn('⛶', 'Maximizar');
  const btnClose = iconBtn('✕', 'Fechar');
  controls.append(btnClear, btnMin, btnMax, btnClose);

  header.append(titleWrap, controls);
  chat.appendChild(header);

  const body = document.createElement('div');
  body.className = 'omr-body';
  chat.appendChild(body);

  const input = document.createElement('div');
  input.className = 'omr-input';
  const ta = document.createElement('textarea');
  ta.className = 'omr-textarea';
  ta.placeholder = 'Digite aqui... Use / para comandos';
  const send = document.createElement('button');
  send.className = 'omr-sendbtn';
  send.textContent = 'Enviar';
  input.append(ta, send);
  chat.appendChild(input);

  root.appendChild(chat);

  // Aplicar tema/transparência iniciais
  applySettings();
  // Carregar ajustes salvos
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
    if (res) {
      STATE.theme = res.theme || STATE.theme;
      STATE.transparency = typeof res.transparency === 'number' ? res.transparency : STATE.transparency;
      STATE.model = res.model || STATE.model;
      modelEl.textContent = ` · ${STATE.model}`;
      applySettings();
    }
  });

  function applySettings() {
    if (STATE.theme === 'dark') {
      root.classList.add('omelhorrobo-dark');
    } else {
      root.classList.remove('omelhorrobo-dark');
    }
    chat.style.background = `rgba(${STATE.theme === 'dark' ? '15,15,15' : '255,255,255'}, ${STATE.transparency})`;
  }

  function iconBtn(symbol, title) {
    const b = document.createElement('div');
    b.className = 'omr-iconbtn';
    b.title = title;
    b.textContent = symbol;
    return b;
  }

  // Drag do FAB
  enableFabDrag(fab);
  function enableFabDrag(el) {
    let isDown = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;
    el.addEventListener('mousedown', (e) => {
      isDown = true;
      el.style.transition = 'none';
      startX = e.clientX; startY = e.clientY;
      const rect = el.getBoundingClientRect();
      startLeft = rect.left; startTop = rect.top;
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      const dx = e.clientX - startX; const dy = e.clientY - startY;
      el.style.left = `${startLeft + dx}px`;
      el.style.top = `${startTop + dy}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      el.style.position = 'fixed';
    });
    window.addEventListener('mouseup', () => { isDown = false; el.style.transition = ''; });
  }

  // Toggle chat
  fab.addEventListener('click', () => {
    STATE.chatOpen = !STATE.chatOpen;
    chat.style.display = STATE.chatOpen ? 'flex' : 'none';
    fab.style.display = STATE.chatOpen ? 'none' : 'flex';
  });
  btnClose.addEventListener('click', () => { STATE.chatOpen = false; chat.style.display = 'none'; fab.style.display = 'flex'; });
  btnMin.addEventListener('click', () => { chat.style.height = '56px'; body.style.display = 'none'; input.style.display = 'none'; });
  btnMax.addEventListener('click', () => {
    if (chat.style.position !== 'fixed') chat.style.position = 'fixed';
    chat.style.left = '12px'; chat.style.top = '12px'; chat.style.right = '12px'; chat.style.bottom = '12px';
    chat.style.width = 'auto'; chat.style.height = 'auto';
    body.style.display = ''; input.style.display = 'flex';
  });
  btnClear.addEventListener('click', () => { body.innerHTML = ''; });

  // Slash commands UI
  const slashMenu = document.createElement('div');
  slashMenu.className = 'omr-slash-menu';
  slashMenu.style.display = 'none';
  const commands = [
    '/bate-bola',
    '/diganaoaoprecoce',
    '/comoPromptisso',
    '/criticaSincera',
    '/ideiasMirabolantes',
  ];
  for (const c of commands) {
    const it = document.createElement('div');
    it.className = 'omr-slash-item';
    it.textContent = c;
    it.addEventListener('click', () => {
      insertCommand(c);
      slashMenu.style.display = 'none';
      ta.focus();
    });
    slashMenu.appendChild(it);
  }
  chat.appendChild(slashMenu);

  function insertCommand(cmd) {
    const start = ta.selectionStart || 0;
    const end = ta.selectionEnd || 0;
    const txt = ta.value;
    ta.value = txt.slice(0, start) + cmd + ' ' + txt.slice(end);
    ta.selectionStart = ta.selectionEnd = start + cmd.length + 1;
  }

  ta.addEventListener('input', () => {
    autoGrow(ta);
    const v = ta.value;
    if (v.endsWith('/')) {
      slashMenu.style.display = 'block';
    } else if (!v.includes('/')) {
      slashMenu.style.display = 'none';
    }
  });

  function autoGrow(t) {
    t.style.height = 'auto';
    t.style.height = Math.min(160, t.scrollHeight) + 'px';
  }

  // Envio
  send.addEventListener('click', onSend);
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  });

  function pushMsg(role, content) {
    const div = document.createElement('div');
    div.className = 'omr-msg ' + (role === 'user' ? 'user' : 'bot');
    const pre = document.createElement('div');
    if (role === 'bot') {
      pre.innerHTML = renderMarkdownBasic(content);
      enhanceCodeBlocks(pre);
    } else {
      pre.textContent = content;
    }
    div.appendChild(pre);
    const acts = document.createElement('div');
    acts.className = 'omr-msg-actions';
    const copy = document.createElement('span'); copy.textContent = 'copiar';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(content); toast('Copiado'); } catch {}
    });
    const resend = document.createElement('span'); resend.textContent = 'reenviar';
    resend.addEventListener('click', () => { ta.value = content; ta.focus(); });
    acts.append(copy, resend);
    div.appendChild(acts);
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function renderMarkdownBasic(text) {
    // mínimo: **bold**, *italic*, `code`, ```blocks```
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    // code blocks ```
    html = html.replace(/```([\s\S]*?)```/g, (m, p1) => `<pre><code>${p1}</code></pre>`);
    // inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // line breaks
    html = html.replace(/\n/g, '<br/>');
    return html;
  }

  function enhanceCodeBlocks(container) {
    const blocks = container.querySelectorAll('pre > code');
    blocks.forEach((code) => {
      const wrapper = document.createElement('div');
      const openBtn = document.createElement('button');
      openBtn.textContent = 'Abrir Sandbox';
      Object.assign(openBtn.style, { marginBottom: '6px' });
      openBtn.addEventListener('click', () => {
        const blob = new Blob([code.textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      });
      code.parentElement.insertAdjacentElement('beforebegin', openBtn);
    });
  }

  function resolveSystemPrompt() {
    return (
      'Você é "O Melhor Robô", um assistente de IA altamente adaptável e prático, integrado ao navegador. ' +
      'Sua principal função é auxiliar o usuário a processar e interagir com um TEXTO SELECIONADO fornecido. '
    );
  }

  function applySlashBehavior(text, selection) {
    // Retorna { system, user }
    if (text.startsWith('/bate-bola')) {
      return { system: resolveSystemPrompt(), user: `Responda com uma única frase criativa e direta sobre: ${selection}` };
    }
    if (text.startsWith('/diganaoaoprecoce')) {
      return { system: resolveSystemPrompt(), user: `Verifique ambiguidade e peça dados se faltar. Texto: ${selection}` };
    }
    if (text.startsWith('/comoPromptisso')) {
      return { system: resolveSystemPrompt(), user: `Gere um prompt otimizado para a tarefa descrita usando este texto como contexto: ${selection}` };
    }
    if (text.startsWith('/criticaSincera')) {
      return { system: resolveSystemPrompt(), user: `Forneça crítica honesta e construtiva sobre: ${selection}` };
    }
    if (text.startsWith('/ideiasMirabolantes')) {
      return { system: resolveSystemPrompt(), user: `Gere ideias inovadoras relacionadas a: ${selection}` };
    }
    return { system: resolveSystemPrompt(), user: text + (selection ? `\n\nContexto:\n${selection}` : '') };
  }

  async function onSend() {
    const text = (ta.value || '').trim();
    if (!text) return;
    const selection = STATE.selectionText || window.getSelection()?.toString() || '';
    const { system, user } = applySlashBehavior(text, selection);
    pushMsg('user', text);
    ta.value = ''; autoGrow(ta);
    const tabId = await getTabId();
    chrome.runtime.sendMessage({
      type: 'OPENAI_CHAT',
      payload: {
        messages: [ { role: 'user', content: user } ],
        system,
        model: STATE.model,
        tabId,
        memoryKey: location.origin,
      }
    }, (res) => {
      if (!res?.ok) { toast('Erro ao conectar IA'); return; }
      const answer = res.completion?.assistant || '(sem resposta)';
      pushMsg('bot', answer);
    });
  }

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'omr-toast';
    t.textContent = msg;
    root.appendChild(t);
    t.style.display = 'block';
    setTimeout(() => { t.remove(); }, 1800);
  }

  async function getTabId() {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_TAB_ID' });
      if (res?.tabId) return res.tabId;
    } catch {}
    return undefined;
  }

  // Mensagens do background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'OPEN_CHAT_WITH_SELECTION') {
      STATE.selectionText = msg.selectionText || '';
      if (msg.slash) { ta.value = msg.slash + ' '; ta.focus(); }
      STATE.chatOpen = true; chat.style.display = 'flex';
    }
    if (msg?.type === 'OPEN_CHAT_WITH_SELECTION_REQUEST') {
      const sel = window.getSelection()?.toString() || '';
      STATE.selectionText = sel;
      STATE.chatOpen = true; chat.style.display = 'flex';
    }
    if (msg?.type === 'RUN_FLASH_INSIGHTS') {
      const text = document.body?.innerText?.slice(0, 15000) || '';
      ta.value = '/bate-bola ' + text.slice(0, 3000);
      STATE.chatOpen = true; chat.style.display = 'flex'; ta.focus();
    }
    if (msg?.type === 'RUN_DEEP_DIVE') {
      const text = document.body?.innerText?.slice(0, 15000) || '';
      ta.value = '/ideiasMirabolantes ' + text.slice(0, 3000);
      STATE.chatOpen = true; chat.style.display = 'flex'; ta.focus();
    }
    if (msg?.type === 'TOGGLE_VOICE') {
      toggleVoice();
    }
    if (msg?.type === 'PROMPT_RENAME_TAB') {
      const t = prompt('Novo título da aba:');
      if (t) { document.title = t; toast('Título alterado (sessão)'); }
    }
    if (msg?.type === 'START_SCREENSHOT_SELECTION') {
      startScreenshotSelection();
    }
  });

  // Ditado de voz (pt-BR)
  let rec = null;
  function ensureRecognizer() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('Ditado indisponível'); return null; }
    const r = new SR();
    r.lang = 'pt-BR';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    return r;
  }
  function toggleVoice() {
    if (!rec) rec = ensureRecognizer();
    if (!rec) return;
    if (STATE.voiceActive) {
      rec.stop(); STATE.voiceActive = false; toast('Ditado parado'); return;
    }
    rec.onresult = (e) => {
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const t = res[0].transcript;
        if (res.isFinal) finalText += t + ' ';
      }
      if (finalText) { ta.value += (ta.value ? ' ' : '') + finalText.trim(); autoGrow(ta); }
    };
    rec.onerror = () => { /* silêncio para robustez */ };
    rec.onend = () => { if (STATE.voiceActive) rec.start(); };
    rec.start();
    STATE.voiceActive = true; toast('Ditado iniciado (pt-BR)');
  }

  // Seleção de área para screenshot + clipboard
  async function startScreenshotSelection() {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,.2)', cursor: 'crosshair', zIndex: '2147483646'
    });
    document.documentElement.appendChild(overlay);

    const rectEl = document.createElement('div');
    Object.assign(rectEl.style, { position: 'absolute', border: '2px solid #0ea5e9', background: 'rgba(14,165,233,.15)' });
    overlay.appendChild(rectEl);

    let sx = 0, sy = 0, ex = 0, ey = 0, dragging = false;
    overlay.addEventListener('mousedown', (e) => { dragging = true; sx = e.clientX; sy = e.clientY; ex = sx; ey = sy; updateRect(); });
    overlay.addEventListener('mousemove', (e) => { if (!dragging) return; ex = e.clientX; ey = e.clientY; updateRect(); });
    overlay.addEventListener('mouseup', async () => {
      dragging = false;
      const x = Math.min(sx, ex); const y = Math.min(sy, ey);
      const w = Math.abs(ex - sx); const h = Math.abs(ey - sy);
      try {
        const { ok, dataUrl } = await chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' });
        if (!ok) throw new Error('Falha no capture');
        const cropped = await cropDataUrl(dataUrl, x, y, w, h);
        await copyPngToClipboard(cropped);
        toast('Imagem copiada');
      } catch (e) {
        toast('Erro no print');
      } finally {
        overlay.remove();
      }
    });

    function updateRect() {
      const x = Math.min(sx, ex); const y = Math.min(sy, ey);
      const w = Math.abs(ex - sx); const h = Math.abs(ey - sy);
      Object.assign(rectEl.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    }
  }

  async function cropDataUrl(dataUrl, x, y, w, h) {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const scale = window.devicePixelRatio || 1;
    const cnv = document.createElement('canvas');
    cnv.width = w * scale; cnv.height = h * scale;
    const ctx = cnv.getContext('2d');
    ctx.drawImage(img, x * scale, y * scale, w * scale, h * scale, 0, 0, w * scale, h * scale);
    return await new Promise((resolve) => cnv.toBlob((b) => resolve(b), 'image/png'));
  }

  async function copyPngToClipboard(blob) {
    try {
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
    } catch (e) {
      // fallback: nada
    }
  }
})();

