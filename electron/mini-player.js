(() => {
  const $ = (id) => document.getElementById(id);
  let currentState = {};

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

  function render(state) {
    currentState = state || {};
    $('title').textContent = state.title || 'Lpotify';
    $('artist').textContent = state.artist || 'Bir şarkı seçin';
    $('play').textContent = state.isPlaying ? '❚❚' : '▶';
    $('elapsed').textContent = formatTime(state.progress);
    $('duration').textContent = formatTime(state.duration);
    $('progress').max = Math.max(1, Number(state.duration) || 1);
    $('progress').value = Math.min(Number(state.progress) || 0, Number($('progress').max));
    $('repeat').classList.toggle('active', state.repeat && state.repeat !== 'off');
    $('repeat').textContent = state.repeat === 'one' ? '↻¹' : '↻';
    $('lyricsToggle').classList.toggle('active', Boolean(state.lyricsEnabled));
    $('lyricCurrent').textContent = lyricMessage(state);
    $('lyricNext').textContent = state.lyricsEnabled ? (state.nextLyric || '') : '';
  }

  const send = (action) => window.lpotify?.sendMiniPlayerAction?.(action);
  $('previous').addEventListener('click', () => send({ action: 'previous' }));
  $('play').addEventListener('click', () => send({ action: 'play-pause' }));
  $('next').addEventListener('click', () => send({ action: 'next' }));
  $('repeat').addEventListener('click', () => send({ action: 'toggle-repeat' }));
  $('lyricsToggle').addEventListener('click', () => send({ action: 'toggle-lyrics' }));
  $('progress').addEventListener('input', (event) => send({ action: 'seek', time: Number(event.target.value) }));
  $('close').addEventListener('click', () => window.lpotify?.closeMiniPlayer?.());
  window.lpotify?.onMiniPlayerState?.(render);
  render(currentState);
})();
