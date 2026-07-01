    const SERVER = "http://localhost:3002";
    const list = document.getElementById('deckList');
    const emptyMsg = document.getElementById('emptyMsg');
    const deckCount = document.getElementById('deckCount');
    const newInput = document.getElementById('newDeckInput');
    const createBtn = document.getElementById('createBtn');
    const viewToggle = document.getElementById('viewToggle');
    const viewLabel = document.getElementById('viewLabel');
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const pagination = document.getElementById('pagination');
    const pagePrev = document.getElementById('pagePrev');
    const pageNext = document.getElementById('pageNext');
    const pageInfo = document.getElementById('pageInfo');

    function showToast(msg, type = 'error') {
      const container = document.getElementById('toastContainer');
      const el = document.createElement('div');
      el.className = 'toast toast-' + type;
      el.textContent = msg;
      container.appendChild(el);
      setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 3500);
    }

    let allDecks = [];
    let searchQuery = '';
    let sortBy = localStorage.getItem('deckSortBy') || 'modified';
    const PAGE_SIZE = 20;
    let currentPage = 1;

    const MODES = ['grid', 'list', 'compact'];
    const MODE_ICONS = { grid: '&#9638;', list: '&#9776;', compact: '&#8212;' };
    const MODE_LABELS = { grid: 'Grid', list: 'List', compact: 'Compact' };
    let viewMode = localStorage.getItem('deckViewMode') || 'grid';
    if (!MODES.includes(viewMode)) viewMode = 'grid';

    function applyViewMode() {
      list.classList.remove('grid', 'compact');
      list.classList.add(viewMode);
      viewLabel.textContent = MODE_LABELS[viewMode];
      viewToggle.querySelector('.icon').innerHTML = MODE_ICONS[viewMode];
      localStorage.setItem('deckViewMode', viewMode);
      if (list.querySelector('.skeleton-card')) showSkeletons();
    }

    viewToggle.addEventListener('click', () => {
      const idx = MODES.indexOf(viewMode);
      viewMode = MODES[(idx + 1) % MODES.length];
      applyViewMode();
    });

    applyViewMode();

    sortSelect.value = sortBy;

    function sortDecks() {
      allDecks.sort((a, b) => {
        if (!!b.starred - !!a.starred) return !!b.starred - !!a.starred;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'count') return (b.count || 0) - (a.count || 0);
        if (sortBy === 'modified') return (b.modified || '').localeCompare(a.modified || '');
        return 0;
      });
    }

    sortSelect.addEventListener('change', () => {
      sortBy = sortSelect.value;
      localStorage.setItem('deckSortBy', sortBy);
      currentPage = 1;
      if (allDecks.length) { sortDecks(); renderDecks(); }
    });

    function resolveUrl(path) {
      if (!path) return '';
      if (path.match(/^https?:\/\//)) return path;
      if (path.startsWith('/api/')) return SERVER + path;
      return SERVER + '/' + path.replace(/^\//, '');
    }

    function timeAgo(iso) {
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return mins + 'm ago';
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return hrs + 'h ago';
      const days = Math.floor(hrs / 24);
      if (days < 30) return days + 'd ago';
      const months = Math.floor(days / 30);
      if (months < 12) return months + 'mo ago';
      return Math.floor(months / 12) + 'y ago';
    }

    function renderDecks() {
      list.innerHTML = '';
      const q = searchQuery.toLowerCase();
      const filtered = q ? allDecks.filter(d => d.name.toLowerCase().includes(q)) : allDecks;
      const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      if (currentPage > totalPages) currentPage = totalPages;
      const start = (currentPage - 1) * PAGE_SIZE;
      const page = filtered.slice(start, start + PAGE_SIZE);
      deckCount.textContent = filtered.length + '/' + allDecks.length;
      if (filtered.length === 0) {
        emptyMsg.style.display = '';
        emptyMsg.textContent = q ? 'No decks match "' + q + '".' : 'No decks yet. Create one below.';
        pagination.style.display = 'none';
        return;
      }
      emptyMsg.style.display = 'none';
      page.forEach(d => {
        const a = document.createElement('a');
        a.className = 'deck-card';
        a.href = 'slideshow.html?deck=' + encodeURIComponent(d.name);
        const thumbUrl = d.firstImage ? resolveUrl(d.firstImage) : '';
        const thumbHtml = thumbUrl
          ? "background-image:url('" + thumbUrl.replace(/'/g, "\\'") + "')"
          : '';
        const timeStr = d.lastOpened ? timeAgo(d.lastOpened) : '';
        const starred = !!d.starred;
        a.innerHTML =
          '<div class="thumb" style="' + thumbHtml + '">' + (thumbUrl ? '' : '&#x1F5BC;') + '<button class="star-btn' + (starred ? ' on' : '') + '" data-name="' + d.name.replace(/"/g, '&quot;') + '" title="' + (starred ? 'Unstar' : 'Star') + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' +
          '</button></div>' +
          '<div class="info"><div class="name">' + d.name.replace(/</g, '&lt;') + '</div><div class="count">' + d.count + ' slide' + (d.count !== 1 ? 's' : '') + '</div><div class="time">' + timeStr + '</div></div>' +
          '<span class="arrow">&rarr;</span>' +
          '<button class="rename-btn" data-name="' + d.name.replace(/"/g, '&quot;') + '" title="Rename deck">&#9998;</button>' +
          '<button class="del-btn" data-name="' + d.name.replace(/"/g, '&quot;') + '" title="Delete deck">&times;</button>';
        list.appendChild(a);
      });
      document.querySelectorAll('.deck-card .del-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          const name = btn.dataset.name;
          showConfirm('Delete "' + name + '"? This cannot be undone.', () => deleteDeck(name));
        });
      });
      document.querySelectorAll('.deck-card .rename-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          showRename(btn.dataset.name);
        });
      });
      document.querySelectorAll('.deck-card .star-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          toggleStar(btn.dataset.name, btn);
        });
      });
      document.querySelectorAll('.deck-card').forEach(card => {
        card.addEventListener('contextmenu', e => {
          e.preventDefault();
          const name = card.querySelector('.del-btn').dataset.name;
          showCtxMenu(e.clientX, e.clientY, name);
        });
      });
      renderPagination(totalPages, filtered.length);
    }

    function renderPagination(totalPages, totalItems) {
      if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
      }
      pagination.style.display = 'flex';
      pagePrev.disabled = currentPage <= 1;
      pageNext.disabled = currentPage >= totalPages;
      let info = 'Page ' + currentPage + ' of ' + totalPages;
      const start = (currentPage - 1) * PAGE_SIZE + 1;
      const end = Math.min(currentPage * PAGE_SIZE, totalItems);
      info += ' (' + start + '-' + end + ')';
      pageInfo.textContent = info;
    }

    pagePrev.addEventListener('click', () => {
      if (currentPage > 1) { currentPage--; renderDecks(); }
    });
    pageNext.addEventListener('click', () => {
      const q = searchQuery.toLowerCase();
      const filtered = q ? allDecks.filter(d => d.name.toLowerCase().includes(q)) : allDecks;
      const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      if (currentPage < totalPages) { currentPage++; renderDecks(); }
    });

    function showSkeletons() {
      const count = viewMode === 'grid' ? 6 : 4;
      list.innerHTML = '';
      for (let i = 0; i < count; i++) {
        const sk = document.createElement('div');
        sk.className = 'skeleton-card';
        list.appendChild(sk);
      }
      emptyMsg.style.display = 'none';
    }

    function hideSkeletons() {
      list.querySelectorAll('.skeleton-card').forEach(el => el.remove());
    }

    async function loadDecks() {
      showSkeletons();
      try {
        const resp = await fetch(SERVER + '/api/decks');
        const data = await resp.json();
        allDecks = data.decks || [];
        sortDecks();
        renderDecks();
      } catch (_) {
        list.innerHTML = '';
        showToast('Failed to load decks');
      }
    }

    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      currentPage = 1;
      renderDecks();
    });

    function getUntitledName() {
      const names = new Set(allDecks.map(d => d.name));
      let i = 0;
      while (names.has('Untitled' + (i || ''))) i++;
      return 'Untitled' + (i || '');
    }

    function openDeck(name) {
      window.location.href = 'slideshow.html?deck=' + encodeURIComponent(name);
    }

    createBtn.addEventListener('click', () => {
      const name = newInput.value.trim() || getUntitledName();
      openDeck(name);
    });

    document.getElementById('createHeaderBtn').addEventListener('click', () => {
      openDeck(getUntitledName());
    });

    newInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') createBtn.click();
    });

    const confirmOverlay = document.getElementById('confirmOverlay');
    const confirmMsg = document.getElementById('confirmMsg');
    const confirmCancel = document.getElementById('confirmCancel');
    const confirmDelete = document.getElementById('confirmDelete');
    let confirmCb = null;

    function showConfirm(msg, cb) {
      confirmMsg.textContent = msg;
      confirmCb = cb;
      confirmOverlay.classList.add('open');
    }

    function hideConfirm() {
      confirmOverlay.classList.remove('open');
      confirmCb = null;
    }

    confirmCancel.addEventListener('click', hideConfirm);
    confirmDelete.addEventListener('click', () => {
      const cb = confirmCb;
      hideConfirm();
      if (cb) cb();
    });
    confirmOverlay.addEventListener('click', (e) => {
      if (e.target === confirmOverlay) hideConfirm();
    });

    async function toggleStar(name, btn) {
      try {
        const resp = await fetch(SERVER + '/api/star/' + encodeURIComponent(name), { method: 'PATCH' });
        if (!resp.ok) throw new Error('Star failed');
        const data = await resp.json();
        const deck = allDecks.find(d => d.name === name);
        if (deck) deck.starred = data.starred;
        sortDecks();
        renderDecks();
      } catch (_) {
        showToast('Failed to update star');
      }
    }

    async function deleteDeck(name) {
      try {
        const resp = await fetch(SERVER + '/api/data/' + encodeURIComponent(name), { method: 'DELETE' });
        if (!resp.ok) throw new Error('Delete failed');
        loadDecks();
      } catch (_) {
        showToast('Failed to delete deck');
      }
    }

    const renameOverlay = document.getElementById('renameOverlay');
    const renameInput = document.getElementById('renameInput');
    const renameCancel = document.getElementById('renameCancel');
    const renameSave = document.getElementById('renameSave');
    let renameOldName = null;

    function showRename(oldName) {
      renameOldName = oldName;
      renameInput.value = oldName;
      renameOverlay.classList.add('open');
      setTimeout(() => renameInput.focus(), 100);
    }

    function hideRename() {
      renameOverlay.classList.remove('open');
      renameOldName = null;
    }

    renameCancel.addEventListener('click', hideRename);
    renameSave.addEventListener('click', async () => {
      const newName = renameInput.value.trim();
      if (!newName || newName === renameOldName) { hideRename(); return; }
      try {
        const resp = await fetch(SERVER + '/api/data/' + encodeURIComponent(renameOldName));
        if (!resp.ok) throw new Error('Fetch failed');
        const data = await resp.json();
        const kv = data.kv || {};
        const saveResp = await fetch(SERVER + '/api/data/' + encodeURIComponent(newName), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kv })
        });
        if (!saveResp.ok) throw new Error('Save failed');
        const delResp = await fetch(SERVER + '/api/data/' + encodeURIComponent(renameOldName), { method: 'DELETE' });
        if (!delResp.ok) throw new Error('Delete failed');
        hideRename();
        loadDecks();
      } catch (_) {
        showToast('Failed to rename deck');
        hideRename();
      }
    });
    renameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') renameSave.click();
      if (e.key === 'Escape') hideRename();
    });
    renameOverlay.addEventListener('click', (e) => {
      if (e.target === renameOverlay) hideRename();
    });

    const ctxMenu = document.getElementById('ctxMenu');
    let ctxDeckName = null;

    function showCtxMenu(x, y, name) {
      ctxDeckName = name;
      const deck = allDecks.find(d => d.name === name);
      const starItem = document.getElementById('ctxStar');
      const starSvg = starItem.querySelector('svg');
      starItem.innerHTML = '';
      if (starSvg) starItem.appendChild(starSvg);
      starItem.appendChild(document.createTextNode(deck && deck.starred ? ' Unstar' : ' Star'));
      ctxMenu.style.left = x + 'px';
      ctxMenu.style.top = y + 'px';
      ctxMenu.classList.add('show');
    }

    function hideCtxMenu() {
      ctxMenu.classList.remove('show');
      ctxDeckName = null;
    }

    document.addEventListener('click', (e) => {
      if (!ctxMenu.contains(e.target)) hideCtxMenu();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideCtxMenu();
    });

    ctxMenu.querySelectorAll('.ctx-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        const name = ctxDeckName;
        hideCtxMenu();
        if (!name) return;
        if (action === 'rename') showRename(name);
        else if (action === 'delete') showConfirm('Delete "' + name + '"? This cannot be undone.', () => deleteDeck(name));
        else if (action === 'duplicate') duplicateDeck(name);
        else if (action === 'star') toggleStar(name, null);
      });
    });

    async function duplicateDeck(name) {
      try {
        const resp = await fetch(SERVER + '/api/data/' + encodeURIComponent(name));
        if (!resp.ok) throw new Error('Fetch failed');
        const data = await resp.json();
        const kv = data.kv || {};
        let copyName = name + ' (Copy)';
        let i = 2;
        const existingResp = await fetch(SERVER + '/api/decks');
        const existingData = await existingResp.json();
        const existingNames = (existingData.decks || []).map(d => d.name);
        while (existingNames.includes(copyName)) {
          copyName = name + ' (Copy ' + i + ')';
          i++;
        }
        const saveResp = await fetch(SERVER + '/api/data/' + encodeURIComponent(copyName), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kv })
        });
        if (!saveResp.ok) throw new Error('Save failed');
        loadDecks();
      } catch (_) {
        showToast('Failed to duplicate deck');
      }
    }

    loadDecks();
