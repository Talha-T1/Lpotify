(() => {
  const $ = (id) => document.getElementById(id);
  let currentState = {};
  let lyricSignature = '';

  function formatTime(value) {
    const seconds = Math.max(0, Number(value) || 0);
    return Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
  }

  function lyricMessage(state) {
    if (!state.lyricsEnabled) return 'Şarkı sözleri kapalı';
    if (state.lyricsStatus === 'loading') return 'Şarkı sözleri yükleniyor…';
    if (state.lyricsStatus === 'missing') return 'Senkronlu şarkı sözü bulunamadı';
    if (state.lyricsStatus === 'error') return 'Şarkı sözleri alınamadı';
    return state.currentLyric || '♪';
  }

  function renderLyrics(state) {
    const list = $('lyricsList');
    const lines = Array.isArray(state.visibleLyrics) ? state.visibleLyrics : [];
    const signature = lines.map((line) => `${line.time}:${line.text}:${line.active}`).join('|')
      + ':' + state.lyricsEnabled + ':' + state.lyricsStatus;
    if (signature === lyricSignature) return;
    lyricSignature = signature;
    list.replaceChildren();

    if (!state.lyricsEnabled || state.lyricsStatus !== 'ready' || lines.length === 0) {
      const message = document.createElement('div');
      message.className = 'lyrics-message';
      message.textContent = lyricMessage(state);
      list.appendChild(message);
      return;
    }

    for (const line of lines) {
      const row = document.createElement('div');
      row.className = 'lyric-line' + (line.active ? ' active' : '');
      row.textContent = line.text;
      list.appendChild(row);
    }
    list.classList.remove('rise');
    void list.offsetHeight;
    list.classList.add('rise');
  }

  function render(state) {
    currentState = state || {};
    $('title').textContent = state.title || 'Lpotify';
    $('artist').textContent = state.artist || 'Bir şarkı seçin';
    if (state.coverUrl && $('cover').src !== state.coverUrl) $('cover').src = state.coverUrl;
    $('playIcon').innerHTML = state.isPlaying
      ? '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
    $('elapsed').textContent = formatTime(state.progress);
    $('duration').textContent = formatTime(state.duration);
    $('progress').max = Math.max(1, Number(state.duration) || 1);
    $('progress').value = Math.min(Number(state.progress) || 0, Number($('progress').max));
    $('repeat').classList.toggle('active-control', state.repeat && state.repeat !== 'off');
    $('repeat').dataset.mode = state.repeat === 'one' ? 'one' : state.repeat || 'off';
    $('lyricsToggle').classList.toggle('active-control', Boolean(state.lyricsEnabled));
    renderLyrics(state);
  }

  const send = (action) => window.lpotify?.sendMiniPlayerAction?.(action);
  $('previous').addEventListener('click', () => send({ action: 'previous' }));
  $('play').addEventListener('click', () => send({ action: 'play-pause' }));
  $('next').addEventListener('click', () => send({ action: 'next' }));
  $('repeat').addEventListener('click', () => send({ action: 'toggle-repeat' }));
  $('lyricsToggle').addEventListener('click', () => send({ action: 'toggle-lyrics' }));
  $('alwaysOnTop').addEventListener('click', async () => {
    const enabled = await window.lpotify?.toggleMiniPlayerAlwaysOnTop?.();
    $('alwaysOnTop').classList.toggle('active-control', Boolean(enabled));
    $('alwaysOnTop').title = enabled ? 'Her zaman önde: açık' : 'Her zaman önde: kapalı';
  });
  $('progress').addEventListener('input', (event) => send({ action: 'seek', time: Number(event.target.value) }));
  $('close').addEventListener('click', () => window.lpotify?.closeMiniPlayer?.());
  window.lpotify?.onMiniPlayerState?.(render);
  window.lpotify?.getMiniPlayerSettings?.().then((settings) => {
    const enabled = Boolean(settings?.alwaysOnTop);
    $('alwaysOnTop').classList.toggle('active-control', enabled);
    $('alwaysOnTop').title = enabled ? 'Her zaman önde: açık' : 'Her zaman önde: kapalı';
  });
  render(currentState);
})();
