  (async function () {
    const container = document.getElementById('slideshow');
    const slides = Array.from(container.querySelectorAll('.slide'));
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const dotsContainer = document.getElementById('dots');
    const progressBar = document.getElementById('progressBar');
    const settingsBtn = document.getElementById('settingsBtn');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalBody = document.getElementById('modalBody');
    const modalClose = document.getElementById('modalClose');
    const modalCancel = document.getElementById('modalCancel');
    const modalSave = document.getElementById('modalSave');
    const thumbnails = document.getElementById('thumbnails');
    const slideCount = document.getElementById('slideCount');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const confirmOverlay = document.getElementById('confirmOverlay');
    const confirmMsg = document.getElementById('confirmMsg');
    const confirmCancel = document.getElementById('confirmCancel');
    const confirmDelete = document.getElementById('confirmDelete');
    const ctxMenu = document.getElementById('ctxMenu');
    const ctxFitSub = document.getElementById('ctxFitSub');
    const ctxShapeMenu = document.getElementById('ctxShapeMenu');
    const shapePasteItem = document.getElementById('shapePasteItem');
    const slidePasteItem = document.getElementById('slidePasteItem');

    function showToast(msg, type = 'error') {
      const container = document.getElementById('toastContainer');
      const el = document.createElement('div');
      el.className = 'toast toast-' + type;
      el.textContent = msg;
      container.appendChild(el);
      setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 3500);
    }

    let ctxSlideIdx = -1;
    let ctxShapeIdx = -1;
    let ctxShapeId = null;
    let shapeClipboard = null;

    let current = 0;
    let slideUrls = {};
    let savedCount = 0;
    let settingsDirty = false;
    let dragSrcIndex = null;
    let dropPlaceholder = null;

    let deckName = new URLSearchParams(window.location.search).get('deck') || localStorage.getItem('deckName') || 'Default';
    if (new URLSearchParams(window.location.search).get('deck')) {
      localStorage.setItem('deckName', deckName);
    }
    let resizeData = {};
    let slideMode = {};
    let slideNames = {};
    let slideBgColors = {};
    let slideNotes = {};
    let activeResize = null;
    let undoData = null;
    let dragCandidate = null;
    let apiBaseUrl = localStorage.getItem('apiBaseUrl') || ('http://localhost:' + (location.port || '3002'));

    function resolveUrl(path) {
      if (!path) return path;
      if (path.startsWith('/api/')) return apiBaseUrl + path;
      if (path.match(/^https?:\/\//)) return path;
      return apiBaseUrl + '/' + path.replace(/^\//, '');
    }

    async function loadFromServer() {
      try {
        const resp = await fetch(resolveUrl('/api/data/' + encodeURIComponent(deckName)));
        if (!resp.ok) return;
        const data = await resp.json();
        const kv = data.kv || {};
        slideUrls = kv.urls || {};
        savedCount = kv.count || 1;
        resizeData = kv.resize || {};
        slideMode = kv.mode || {};
        slideNames = kv.names || {};
        slideBgColors = kv.bgColors || {};
        slideNotes = kv.notes || {};
        if (kv.apiUrl) {
          apiBaseUrl = kv.apiUrl;
          localStorage.setItem('apiBaseUrl', kv.apiUrl);
        }
      } catch (_) {
        showToast('Failed to load deck data');
      }
    }

    async function saveToServer() {
      try {
        const kv = {
          count: slides.length,
          urls: { ...slideUrls },
          resize: { ...resizeData },
          mode: { ...slideMode },
          names: { ...slideNames },
          bgColors: { ...slideBgColors },
          notes: { ...slideNotes },
          apiUrl: apiBaseUrl
        };
        const resp = await fetch(resolveUrl('/api/data/' + encodeURIComponent(deckName)), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kv })
        });
        if (!resp.ok) return;
        const result = await resp.json();
        if (result.kv && result.kv.urls) {
          slideUrls = result.kv.urls;
        }
      } catch (_) {
          showToast('Failed to save deck');
        }
    }

    function applyMode(img, idx) {
      if (!img) return;
      const mode = slideMode[idx] || 'contain';
      if (mode === 'cover') { img.style.objectFit = 'cover'; }
      else if (mode === 'contain') { img.style.objectFit = 'contain'; }
      else if (mode === 'fill') { img.style.objectFit = 'fill'; }
      else if (mode === 'original') { img.style.objectFit = 'none'; }
    }

    async function uploadImage(file) {
      const loading = document.getElementById('uploadLoading');
      loading.classList.add('show');
      try {
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (ev) => {
            const dataUrl = ev.target.result;
            const commaIdx = dataUrl.indexOf(',');
            const base64Data = dataUrl.substring(commaIdx + 1);
            const header = dataUrl.substring(0, commaIdx);
            const mime = (header.match(/:(.*?);/) || [])[1] || 'image/png';
            try {
              const resp = await fetch(resolveUrl('/api/upload'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: base64Data, mime })
              });
              const result = await resp.json();
              resolve(result.url);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } finally {
        loading.classList.remove('show');
      }
    }

    function applySlideImage(el, url) {
      const wrap = el.querySelector('.slide-img-wrap');
      const img = wrap?.querySelector('img');
      const fallback = el.querySelector('.fallback-msg');
      if (url && url.trim()) {
        el.classList.add('has-image');
        if (img && wrap) {
          img.src = resolveUrl(url.trim());
          applyMode(img, el.dataset.slide);
          wrap.style.display = 'block';
          const rd = resizeData[el.dataset.slide];
          if (rd) {
            wrap.style.left = rd.x;
            wrap.style.top = rd.y;
            wrap.style.width = rd.w;
            wrap.style.height = rd.h;
          } else {
            wrap.style.left = '10%';
            wrap.style.top = '10%';
            wrap.style.width = '80%';
            wrap.style.height = '80%';
          }
        }
        if (fallback) fallback.style.display = 'none';
      } else {
        el.classList.remove('has-image');
        el.style.backgroundImage = 'none';
        if (wrap) wrap.style.display = 'none';
        if (fallback) fallback.style.display = '';
      }
    }

    function applySlideBg(el, idx) {
      const color = slideBgColors[idx];
      if (color) {
        el.style.backgroundColor = color;
      } else {
        el.style.backgroundColor = '';
      }
    }

    function syncColorInputs() {
      slides.forEach((el, i) => {
        const input = el.querySelector('.bg-color-input');
        if (input) input.value = slideBgColors[i] || '#1a1a24';
      });
    }

    function applyAllImages() {
      slides.forEach((el, i) => {
        applySlideImage(el, slideUrls[i] || '');
        applySlideBg(el, i);
      });
      syncColorInputs();
    }

    function getSlideName(i) {
      return slideNames[i] || 'Slide ' + (i + 1);
    }

    function setupSlideDrop(el) {
      el.addEventListener('dragover', (e) => {
        if (document.documentElement.classList.contains('fullscreen')) return;
        e.preventDefault();
        el.classList.add('drag-over');
      });

      el.addEventListener('dragleave', () => {
        el.classList.remove('drag-over');
      });

      el.addEventListener('drop', async (e) => {
        if (document.documentElement.classList.contains('fullscreen')) return;
        e.preventDefault();
        el.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
          const idx = parseInt(el.dataset.slide);
          try {
            const serverUrl = await uploadImage(file);
            slideUrls[idx] = serverUrl;
            delete resizeData[idx];
            applySlideImage(el, serverUrl);
            saveToServer();
            rebuildThumbnails();
            update();
          } catch (_) {
            showToast('Failed to upload dropped image');
          }
        }
      });
    }

    function setupResize(el) {
      const wrap = el.querySelector('.slide-img-wrap');
      if (!wrap) return;
      const handles = wrap.querySelectorAll('.resize-handle');
      const props = el.querySelector('.img-props');

      if (props) {
        const btns = props.querySelectorAll('button');
        btns.forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(el.dataset.slide);
            const mode = btn.dataset.mode;
            slideMode[idx] = mode;
            const img = wrap.querySelector('img');
            applyMode(img, idx);
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            saveToServer();
          });
        });
        const colorInput = props.querySelector('.bg-color-input');
        if (colorInput) {
          colorInput.addEventListener('input', (e) => {
            e.stopPropagation();
            const idx = parseInt(el.dataset.slide);
            const color = e.target.value;
            if (color && color !== '#1a1a24') {
              slideBgColors[idx] = color;
            } else {
              delete slideBgColors[idx];
            }
            applySlideBg(el, idx);
            saveToServer();
            rebuildThumbnails();
          });
        }
      }

      el.addEventListener('click', (e) => {
        const clickedWrap = e.target.closest('.slide-img-wrap');
        slides.forEach(s => {
          const w = s.querySelector('.slide-img-wrap');
          if (w) w.classList.remove('selected');
        });
        if (clickedWrap && !document.documentElement.classList.contains('fullscreen')) {
          clickedWrap.classList.add('selected');
          const propsPanel = el.querySelector('.img-props');
          if (propsPanel) {
            const mode = slideMode[el.dataset.slide] || 'contain';
            propsPanel.querySelectorAll('button').forEach(b => {
              b.classList.toggle('active', b.dataset.mode === mode);
            });
          }
        }
      });

      handles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
          if (document.documentElement.classList.contains('fullscreen')) return;
          e.stopPropagation();
          const idx = parseInt(el.dataset.slide);
          if (idx !== current) return;
          const rect = wrap.getBoundingClientRect();
          const containerRect = el.getBoundingClientRect();
          dragCandidate = {
            idx,
            handle: handle.className.replace('resize-handle ', ''),
            startX: e.clientX,
            startY: e.clientY,
            startW: rect.width,
            startH: rect.height,
            startL: rect.left - containerRect.left,
            startT: rect.top - containerRect.top,
            containerRect
          };
        });
      });

      wrap.addEventListener('mousedown', (e) => {
        if (document.documentElement.classList.contains('fullscreen')) return;
        if (e.target.classList.contains('resize-handle')) return;
        const idx = parseInt(el.dataset.slide);
        if (idx !== current) return;
        const rect = wrap.getBoundingClientRect();
        const containerRect = el.getBoundingClientRect();
        dragCandidate = {
          idx,
          handle: 'move',
          startX: e.clientX,
          startY: e.clientY,
          startL: rect.left - containerRect.left,
          startT: rect.top - containerRect.top,
          startW: rect.width,
          startH: rect.height,
          containerRect
        };
      });

      const urlBar = el.querySelector('.slide-url-bar');
      if (urlBar) {
        const input = urlBar.querySelector('input');
        const btn = urlBar.querySelector('button');
        const idx = parseInt(el.dataset.slide);

        function applyUrl() {
          const val = input.value.trim();
          if (val) {
            slideUrls[idx] = val;
            delete resizeData[idx];
            applySlideImage(el, val);
            saveToServer();
            rebuildThumbnails();
            update();
          }
          urlBar.classList.remove('show');
        }

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          applyUrl();
        });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); applyUrl(); }
          if (e.key === 'Escape') { e.preventDefault(); urlBar.classList.remove('show'); }
        });
        input.addEventListener('click', (e) => e.stopPropagation());
      }
    }

    document.addEventListener('mousemove', (e) => {
      if (!dragCandidate && !activeResize) return;

      if (dragCandidate && !activeResize) {
        const dx = e.clientX - dragCandidate.startX;
        const dy = e.clientY - dragCandidate.startY;
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
        if (dragCandidate.idx !== current) { dragCandidate = null; return; }
        e.preventDefault();
        activeResize = dragCandidate;
        dragCandidate = null;
      }

      if (!activeResize) return;
      if (activeResize.idx !== current) { activeResize = null; return; }

      const dx = e.clientX - activeResize.startX;
      const dy = e.clientY - activeResize.startY;
      const h = activeResize.handle;
      const slideEl = slides[activeResize.idx];
      const wrap = slideEl?.querySelector('.slide-img-wrap');
      if (!wrap) return;

      let x = activeResize.startL;
      let y = activeResize.startT;
      let w = activeResize.startW;
      let hh = activeResize.startH;
      const min = 30;

      const sides = {
        'e':  () => { w = Math.max(min, activeResize.startW + dx); },
        'w':  () => { const dw = Math.min(activeResize.startW - min, dx); x = activeResize.startL + dw; w = activeResize.startW - dw; },
        's':  () => { hh = Math.max(min, activeResize.startH + dy); },
        'n':  () => { const dh = Math.min(activeResize.startH - min, dy); y = activeResize.startT + dh; hh = activeResize.startH - dh; },
        'ne': () => { w = Math.max(min, activeResize.startW + dx); const dh = Math.min(activeResize.startH - min, dy); y = activeResize.startT + dh; hh = activeResize.startH - dh; },
        'nw': () => { const dw = Math.min(activeResize.startW - min, dx); x = activeResize.startL + dw; w = activeResize.startW - dw; const dh = Math.min(activeResize.startH - min, dy); y = activeResize.startT + dh; hh = activeResize.startH - dh; },
        'se': () => { w = Math.max(min, activeResize.startW + dx); hh = Math.max(min, activeResize.startH + dy); },
        'sw': () => { const dw = Math.min(activeResize.startW - min, dx); x = activeResize.startL + dw; w = activeResize.startW - dw; hh = Math.max(min, activeResize.startH + dy); },
        'move': () => { x = activeResize.startL + dx; y = activeResize.startT + dy; }
      };

      if (sides[h]) sides[h]();

      wrap.style.left = x + 'px';
      wrap.style.top = y + 'px';
      wrap.style.width = w + 'px';
      wrap.style.height = hh + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (activeResize) {
        if (activeResize.idx !== current) { activeResize = null; dragCandidate = null; return; }
        const slideEl = slides[activeResize.idx];
        const wrap = slideEl?.querySelector('.slide-img-wrap');
        if (wrap) {
          const sw = slideEl.offsetWidth;
          const sh = slideEl.offsetHeight;
          const wr = wrap.getBoundingClientRect();
          const sr = slideEl.getBoundingClientRect();
          const x = ((wr.left - sr.left) / sw * 100) + '%';
          const y = ((wr.top - sr.top) / sh * 100) + '%';
          const w = (wr.width / sw * 100) + '%';
          const h = (wr.height / sh * 100) + '%';
          resizeData[activeResize.idx] = { x, y, w, h };
          wrap.style.left = x;
          wrap.style.top = y;
          wrap.style.width = w;
          wrap.style.height = h;
          saveToServer();
        }
        activeResize = null;
      }
      dragCandidate = null;
    });

    function createDropPlaceholder() {
      const el = document.createElement('div');
      el.className = 'drop-placeholder';
      return el;
    }

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

    function clearDropPlaceholder() {
      if (dropPlaceholder && dropPlaceholder.parentNode) {
        dropPlaceholder.parentNode.removeChild(dropPlaceholder);
      }
      dropPlaceholder = null;
    }

    function reorderSlides(fromIdx, toIdx) {
      if (fromIdx === toIdx) return;

      const urlsInOrder = slides.map((_, i) => slideUrls[i] || '');
      const resizeInOrder = slides.map((_, i) => resizeData[i] || null);
      const modeInOrder = slides.map((_, i) => slideMode[i] || 'contain');
      const namesInOrder = slides.map((_, i) => slideNames[i] || '');
      const bgInOrder = slides.map((_, i) => slideBgColors[i] || '');
      const notesInOrder = slides.map((_, i) => slideNotes[i] || '');

      const [moved] = slides.splice(fromIdx, 1);
      slides.splice(toIdx, 0, moved);

      const [movedUrl] = urlsInOrder.splice(fromIdx, 1);
      urlsInOrder.splice(toIdx, 0, movedUrl);

      const [movedResize] = resizeInOrder.splice(fromIdx, 1);
      resizeInOrder.splice(toIdx, 0, movedResize);

      const [movedMode] = modeInOrder.splice(fromIdx, 1);
      modeInOrder.splice(toIdx, 0, movedMode);

      const [movedName] = namesInOrder.splice(fromIdx, 1);
      namesInOrder.splice(toIdx, 0, movedName);

      const [movedBg] = bgInOrder.splice(fromIdx, 1);
      bgInOrder.splice(toIdx, 0, movedBg);

      const [movedNotes] = notesInOrder.splice(fromIdx, 1);
      notesInOrder.splice(toIdx, 0, movedNotes);

      slideUrls = {};
      resizeData = {};
      slideMode = {};
      slideNames = {};
      slideBgColors = {};
      urlsInOrder.forEach((url, i) => {
        if (url) slideUrls[i] = url;
      });
      resizeInOrder.forEach((rd, i) => {
        if (rd) resizeData[i] = rd;
      });
      modeInOrder.forEach((m, i) => {
        if (m) slideMode[i] = m;
      });
      namesInOrder.forEach((n, i) => {
        if (n) slideNames[i] = n;
      });
      bgInOrder.forEach((c, i) => {
        if (c) slideBgColors[i] = c;
      });
      notesInOrder.forEach((n, i) => {
        if (n) slideNotes[i] = n;
      });

      slides.forEach(el => container.appendChild(el));

      slides.forEach((el, i) => {
        el.dataset.slide = i;
        el.querySelector('.slide-label').textContent = getSlideName(i);
        applySlideImage(el, slideUrls[i] || '');
        applySlideBg(el, i);
      });

      if (current === fromIdx) current = toIdx;
      else if (fromIdx < toIdx && current > fromIdx && current <= toIdx) current--;
      else if (fromIdx > toIdx && current < fromIdx && current >= toIdx) current++;

      saveToServer();
      rebuildThumbnails();
      update();
    }

    function rebuildThumbnails() {
      thumbnails.innerHTML = '';
      slides.forEach((el, i) => {
        const item = document.createElement('div');
        item.className = 'thumb-item' + (i === current ? ' active' : '');
        item.dataset.index = i;
        item.draggable = true;

        const preview = document.createElement('div');
        preview.className = 'thumb-preview';
        const url = slideUrls[i];
        if (url && url.trim()) {
          preview.style.backgroundImage = 'url("' + resolveUrl(url).replace(/"/g, '\\"') + '")';
        } else {
          preview.innerHTML = '<span class="thumb-placeholder">&#x1F5BC;</span>';
        }
        if (slideBgColors[i]) {
          preview.style.backgroundColor = slideBgColors[i];
        }

        const info = document.createElement('div');
        info.className = 'thumb-info';

        const label = document.createElement('span');
        label.className = 'thumb-label';
        const labelText = getSlideName(i);
        label.textContent = labelText;

        const desc = document.createElement('span');
        desc.className = 'thumb-desc';
        desc.textContent = url && url.trim() ? (url.split('/').pop() || 'Image') : 'No image';

        info.appendChild(label);
        info.appendChild(desc);
        item.appendChild(preview);
        item.appendChild(info);

        item.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          const curName = getSlideName(i);
          const input = document.createElement('input');
          input.type = 'text';
          input.value = slideNames[i] || '';
          input.className = 'thumb-rename-input';
          input.placeholder = 'Slide ' + (i + 1);
          input.dataset.index = i;
          label.textContent = '';
          label.appendChild(input);
          input.focus();
          input.select();

          function commitRename() {
            const val = input.value.trim();
            if (val) {
              slideNames[i] = val;
            } else {
              delete slideNames[i];
            }
            label.textContent = getSlideName(i);
            const slideEl = slides[i];
            const slideLabel = slideEl.querySelector('.slide-label');
            if (slideLabel) slideLabel.textContent = getSlideName(i);
            const fbNum = slideEl.querySelector('.fb-num');
            if (fbNum) fbNum.textContent = getSlideName(i);
            saveToServer();
            const items = thumbnails.querySelectorAll('.thumb-item');
            items.forEach((it, idx) => {
              const lb = it.querySelector('.thumb-label');
              if (lb && idx === i) lb.textContent = getSlideName(i);
            });
          }

          input.addEventListener('blur', commitRename);
          input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
            if (ev.key === 'Escape') { ev.preventDefault(); label.textContent = getSlideName(i); }
          });
        });

        const dupBtn = document.createElement('button');
        dupBtn.className = 'thumb-dup-btn';
        dupBtn.textContent = '⧉';
        dupBtn.title = 'Duplicate slide';
        dupBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          duplicateSlide(i);
        });
        item.appendChild(dupBtn);

        if (slides.length > 1) {
          const delBtn = document.createElement('button');
          delBtn.className = 'thumb-del-btn';
          delBtn.textContent = 'x';
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showConfirm('Delete Slide ' + (i + 1) + '?', () => removeSlide(i));
          });
          item.appendChild(delBtn);
        }

        item.addEventListener('click', () => goTo(i));

        item.addEventListener('dragstart', (e) => {
          if (document.documentElement.classList.contains('fullscreen')) { e.preventDefault(); return; }
          dragSrcIndex = i;
          item.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', i);
        });

        item.addEventListener('dragend', () => {
          item.classList.remove('dragging');
          clearDropPlaceholder();
          dragSrcIndex = null;
        });

        item.addEventListener('dragover', (e) => {
          if (document.documentElement.classList.contains('fullscreen')) return;
          e.preventDefault();
          if (dragSrcIndex === null || dragSrcIndex === i) return;

          const rect = item.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const insertBefore = e.clientY < midY;

          if (dropPlaceholder && dropPlaceholder.parentNode) {
            const currentPos = Array.from(thumbnails.children).indexOf(dropPlaceholder);
            const targetPos = Array.from(thumbnails.children).indexOf(item);
            const expectedPos = insertBefore ? targetPos : targetPos + 1;
            if (currentPos === expectedPos) return;
            dropPlaceholder.remove();
          }

          dropPlaceholder = createDropPlaceholder();
          if (insertBefore) {
            thumbnails.insertBefore(dropPlaceholder, item);
          } else {
            thumbnails.insertBefore(dropPlaceholder, item.nextSibling);
          }
        });

        item.addEventListener('dragleave', (e) => {
          if (dropPlaceholder && !e.relatedTarget?.closest?.('.thumb-item, .drop-placeholder')) {
            clearDropPlaceholder();
          }
        });

        item.addEventListener('drop', (e) => {
          if (document.documentElement.classList.contains('fullscreen')) return;
          e.preventDefault();
          clearDropPlaceholder();
          if (dragSrcIndex !== null && dragSrcIndex !== i) {
            reorderSlides(dragSrcIndex, i);
          }
        });

        thumbnails.appendChild(item);
      });

      thumbnails.addEventListener('dragover', (e) => {
        if (document.documentElement.classList.contains('fullscreen')) return;
        if (dragSrcIndex === null) return;
        e.preventDefault();
        const children = Array.from(thumbnails.children);
        const lastItem = children.filter(c => c.classList.contains('thumb-item')).pop();
        if (!lastItem) return;
        const rect = lastItem.getBoundingClientRect();
        if (e.clientY > rect.bottom && !dropPlaceholder?.parentNode) {
          dropPlaceholder = createDropPlaceholder();
          thumbnails.appendChild(dropPlaceholder);
        }
      });

      thumbnails.addEventListener('dragleave', (e) => {
        if (dropPlaceholder && !thumbnails.contains(e.relatedTarget)) {
          clearDropPlaceholder();
        }
      });

      thumbnails.addEventListener('drop', (e) => {
        if (document.documentElement.classList.contains('fullscreen')) return;
        if (dragSrcIndex === null) return;
        e.preventDefault();
        const target = e.target.closest('.thumb-item');
        if (target) return;
        if (dropPlaceholder?.parentNode) {
          const toIdx = slides.length - 1;
          if (dragSrcIndex !== toIdx) reorderSlides(dragSrcIndex, toIdx);
          clearDropPlaceholder();
        }
      });

      slideCount.textContent = slides.length;
    }

    function rebuildSlides() {
      while (dotsContainer.firstChild) dotsContainer.removeChild(dotsContainer.firstChild);
      createDots();
      current = Math.min(current, slides.length - 1);
      update();
      applyAllImages();
      rebuildThumbnails();
    }

    function addSlide() {
      const idx = slides.length;
      const slide = document.createElement('div');
      slide.className = 'slide';
      slide.dataset.slide = idx;
      slide.innerHTML =
        '<div class="slide-img-wrap">' +
          '<img alt="" draggable="false">' +
          '<div class="resize-handle nw"></div>' +
          '<div class="resize-handle n"></div>' +
          '<div class="resize-handle ne"></div>' +
          '<div class="resize-handle e"></div>' +
          '<div class="resize-handle se"></div>' +
          '<div class="resize-handle s"></div>' +
          '<div class="resize-handle sw"></div>' +
          '<div class="resize-handle w"></div>' +
        '</div>' +
        '<div class="img-props" data-slide="' + idx + '">' +
          '<button data-mode="cover">Cover</button>' +
          '<button data-mode="contain">Contain</button>' +
          '<button data-mode="fill">Fill</button>' +
          '<button data-mode="original">Original</button>' +
          '<div class="bg-color-wrap"><input type="color" class="bg-color-input" value="#1a1a24" title="Background color"></div>' +
        '</div>' +
        '<div class="fallback-msg"><div class="fallback-box"><div class="fb-num">Slide Number ' + (idx + 1) + '</div><div class="fb-label">Import image or paste from clipboard</div></div></div>' +
        '<div class="slide-url-bar"><input type="text" placeholder="/api/image/..." spellcheck="false"><button>Apply</button></div>' +
        '<span class="slide-label">Slide ' + (idx + 1) + '</span>' +
        '<span class="slide-number">' + (idx + 1) + ' / ' + (idx + 1) + '</span>';
      container.appendChild(slide);
      slides.push(slide);
      setupSlideDrop(slide);
      setupResize(slide);
      applySlideImage(slide, slideUrls[idx] || '');
      applySlideBg(slide, idx);
      rebuildSlides();
      goTo(idx);
      saveToServer();
      settingsDirty = true;
    }

    function removeSlide(index) {
      if (slides.length <= 1) return;
      const el = slides[index];
      el.remove();
      slides.splice(index, 1);
      delete slideUrls[index];
      delete resizeData[index];
      delete slideMode[index];
      delete slideNames[index];
      delete slideBgColors[index];
      delete slideNotes[index];
      const reindexed = {};
      slides.forEach((_, i) => {
        if (slideUrls[i] !== undefined) reindexed[i] = slideUrls[i];
        else if (slideUrls[i + 1] !== undefined) reindexed[i] = slideUrls[i + 1];
      });
      slideUrls = reindexed;
      const resizeReindexed = {};
      slides.forEach((_, i) => {
        if (resizeData[i] !== undefined) resizeReindexed[i] = resizeData[i];
        else if (resizeData[i + 1] !== undefined) resizeReindexed[i] = resizeData[i + 1];
      });
      resizeData = resizeReindexed;
      const modeReindexed = {};
      slides.forEach((_, i) => {
        if (slideMode[i] !== undefined) modeReindexed[i] = slideMode[i];
        else if (slideMode[i + 1] !== undefined) modeReindexed[i] = slideMode[i + 1];
      });
      slideMode = modeReindexed;
      const namesReindexed = {};
      slides.forEach((_, i) => {
        if (slideNames[i] !== undefined) namesReindexed[i] = slideNames[i];
        else if (slideNames[i + 1] !== undefined) namesReindexed[i] = slideNames[i + 1];
      });
      slideNames = namesReindexed;
      const bgReindexed = {};
      slides.forEach((_, i) => {
        if (slideBgColors[i] !== undefined) bgReindexed[i] = slideBgColors[i];
        else if (slideBgColors[i + 1] !== undefined) bgReindexed[i] = slideBgColors[i + 1];
      });
      slideBgColors = bgReindexed;
      const notesReindexed = {};
      slides.forEach((_, i) => {
        if (slideNotes[i] !== undefined) notesReindexed[i] = slideNotes[i];
        else if (slideNotes[i + 1] !== undefined) notesReindexed[i] = slideNotes[i + 1];
      });
      slideNotes = notesReindexed;
      slides.forEach((el, i) => {
        el.dataset.slide = i;
        el.querySelector('.slide-label').textContent = getSlideName(i);
      });
      rebuildSlides();
      saveToServer();
      settingsDirty = true;
    }

    function duplicateSlide(index) {
      const idx = index + 1;
      const slide = document.createElement('div');
      slide.className = 'slide';
      slide.dataset.slide = idx;
      slide.innerHTML =
        '<div class="slide-img-wrap">' +
          '<img alt="" draggable="false">' +
          '<div class="resize-handle nw"></div>' +
          '<div class="resize-handle n"></div>' +
          '<div class="resize-handle ne"></div>' +
          '<div class="resize-handle e"></div>' +
          '<div class="resize-handle se"></div>' +
          '<div class="resize-handle s"></div>' +
          '<div class="resize-handle sw"></div>' +
          '<div class="resize-handle w"></div>' +
        '</div>' +
        '<div class="img-props" data-slide="' + idx + '">' +
          '<button data-mode="cover">Cover</button>' +
          '<button data-mode="contain">Contain</button>' +
          '<button data-mode="fill">Fill</button>' +
          '<button data-mode="original">Original</button>' +
          '<div class="bg-color-wrap"><input type="color" class="bg-color-input" value="#1a1a24" title="Background color"></div>' +
        '</div>' +
        '<div class="fallback-msg"><div class="fallback-box"><div class="fb-num">Slide Number ' + (idx + 1) + '</div><div class="fb-label">Import image or paste from clipboard</div></div></div>' +
        '<div class="slide-url-bar"><input type="text" placeholder="/api/image/..." spellcheck="false"><button>Apply</button></div>' +
        '<span class="slide-label">Slide ' + (idx + 1) + '</span>' +
        '<span class="slide-number">' + (idx + 1) + ' / ' + (idx + 1) + '</span>';
      const refSlide = slides[index];
      refSlide.parentNode.insertBefore(slide, refSlide.nextSibling);
      slides.splice(idx, 0, slide);

      if (slideUrls[index]) slideUrls[idx] = slideUrls[index];
      if (resizeData[index]) resizeData[idx] = { ...resizeData[index] };
      if (slideMode[index]) slideMode[idx] = slideMode[index];
      if (slideNames[index]) slideNames[idx] = slideNames[index] + ' (Copy)';
      if (slideBgColors[index]) slideBgColors[idx] = slideBgColors[index];
      if (slideNotes[index]) slideNotes[idx] = slideNotes[index];

      slides.forEach((el, i) => {
        el.dataset.slide = i;
        el.querySelector('.slide-label').textContent = getSlideName(i);
      });

      setupSlideDrop(slide);
      setupResize(slide);
      applySlideImage(slide, slideUrls[idx] || '');
      applySlideBg(slide, idx);
      rebuildSlides();
      goTo(idx);
      saveToServer();
      settingsDirty = true;
    }

    function createDots() {
      slides.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        dot.addEventListener('click', () => goTo(i));
        dotsContainer.appendChild(dot);
      });
    }

    function update() {
      slides.forEach((el, i) => {
        el.classList.remove('active', 'exit-prev', 'exit-next');
        if (i === current) el.classList.add('active');
      });

      const dots = dotsContainer.querySelectorAll('.dot');
      dots.forEach((d, i) => d.classList.toggle('active', i === current));

      const total = slides.length;
      progressBar.style.width = ((current + 1) / total * 100) + '%';

      prevBtn.disabled = current === 0;
      nextBtn.disabled = current === total - 1;

      slides.forEach((el, i) => {
        el.querySelector('.slide-number').textContent = (i + 1) + ' / ' + total;
        const slideLabel = el.querySelector('.slide-label');
        if (slideLabel) slideLabel.textContent = getSlideName(i);
        const fbNum = el.querySelector('.fb-num');
        if (fbNum) fbNum.textContent = getSlideName(i);
      });

      const items = thumbnails.querySelectorAll('.thumb-item');
      items.forEach((item, i) => item.classList.toggle('active', i === current));

      if (typeof redrawDrawings === 'function') redrawDrawings();
    }

    function goTo(index) {
      if (index < 0 || index >= slides.length || index === current) return;
      slides.forEach(el => el.classList.remove('exit-prev', 'exit-next'));
      current = index;
      update();
      const activeThumb = thumbnails.querySelector('.thumb-item.active');
      if (activeThumb) activeThumb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function prev() {
      if (current === 0) return;
      slides[current].classList.add('exit-prev');
      current--;
      update();
    }

    function next() {
      if (current === slides.length - 1) return;
      slides[current].classList.add('exit-next');
      current++;
      update();
    }

    function openSettings() {
      settingsDirty = false;
      modalBody.innerHTML = '';
      const apiDiv = document.createElement('div');
      apiDiv.className = 'slide-setting';
      apiDiv.style.borderBottom = '2px solid rgba(99, 102, 241, 0.3)';
      apiDiv.style.marginBottom = '0.5rem';
      const apiLabel = document.createElement('label');
      apiLabel.textContent = 'API Server URL';
      apiLabel.style.color = '#a5b4fc';
      const apiInput = document.createElement('input');
      apiInput.type = 'text';
      apiInput.placeholder = 'http://localhost:' + (location.port || '3002');
      apiInput.value = apiBaseUrl;
      apiInput.dataset.apiUrl = '1';
      apiInput.addEventListener('input', () => {
        settingsDirty = true;
      });
      apiDiv.appendChild(apiLabel);
      apiDiv.appendChild(apiInput);
      modalBody.appendChild(apiDiv);

      const exportDiv = document.createElement('div');
      exportDiv.className = 'export-section';
      const exportLabel = document.createElement('label');
      exportLabel.textContent = 'Export Deck';
      exportDiv.appendChild(exportLabel);
      const exportBtns = document.createElement('div');
      exportBtns.className = 'export-btns';
      const pdfBtn = document.createElement('button');
      pdfBtn.className = 'export-btn';
      pdfBtn.innerHTML = '<span class="icon">&#128196;</span> PDF';
      pdfBtn.addEventListener('click', exportPDF);
      const pptxBtn = document.createElement('button');
      pptxBtn.className = 'export-btn';
      pptxBtn.innerHTML = '<span class="icon">&#128202;</span> PPTX';
      pptxBtn.addEventListener('click', exportPPTX);
      exportBtns.appendChild(pdfBtn);
      exportBtns.appendChild(pptxBtn);
      exportDiv.appendChild(exportBtns);
      modalBody.appendChild(exportDiv);

      modalOverlay.classList.add('open');
    }

    function closeSettings() {
      modalOverlay.classList.remove('open');
    }

    function loadScript(url) {
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    async function exportPDF() {
      const btns = modalBody.querySelectorAll('.export-btn');
      btns.forEach(b => b.disabled = true);
      try {
        if (typeof jspdf === 'undefined') await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        if (typeof html2canvas === 'undefined') await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('l', 'mm', 'a4');
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        for (let i = 0; i < slides.length; i++) {
          const el = slides[i];
          el.classList.add('active');
          if (i > 0) pdf.addPage();
          const canvas = await html2canvas(el, {
            backgroundColor: slideBgColors[i] || '#1a1a24',
            scale: 2,
            useCORS: true,
            logging: false
          });
          el.classList.remove('active');
          const imgData = canvas.toDataURL('image/jpeg', 0.92);
          pdf.addImage(imgData, 'JPEG', 0, 0, pw, ph);
        }
        pdf.save(deckName + '.pdf');
      } catch (err) {
        alert('PDF export failed: ' + err.message);
      } finally {
        btns.forEach(b => b.disabled = false);
      }
    }

    async function exportPPTX() {
      const btns = modalBody.querySelectorAll('.export-btn');
      btns.forEach(b => b.disabled = true);
      try {
        if (typeof PptxGenJS === 'undefined') await loadScript('https://cdn.jsdelivr.net/gh/gitbrent/PptxGenJS@3.12.0/dist/pptxgen.bundle.js');
        if (typeof html2canvas === 'undefined') await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
        const pptx = new PptxGenJS();
        pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 });
        pptx.layout = 'WIDE';
        for (let i = 0; i < slides.length; i++) {
          const el = slides[i];
          el.classList.add('active');
          const canvas = await html2canvas(el, {
            backgroundColor: slideBgColors[i] || '#1a1a24',
            scale: 2,
            useCORS: true,
            logging: false
          });
          el.classList.remove('active');
          const imgData = canvas.toDataURL('image/png');
          const slide = pptx.addSlide();
          slide.addImage({ data: imgData, x: 0, y: 0, w: 13.333, h: 7.5 });
        }
        pptx.writeFile({ fileName: deckName + '.pptx' });
      } catch (err) {
        alert('PPTX export failed: ' + err.message);
      } finally {
        btns.forEach(b => b.disabled = false);
      }
    }

    function saveSettings() {
      const inputs = modalBody.querySelectorAll('input');
      inputs.forEach(input => {
        if (input.dataset.apiUrl !== undefined) {
          const val = input.value.trim();
          if (val) apiBaseUrl = val.replace(/\/+$/, '');
          localStorage.setItem('apiBaseUrl', apiBaseUrl);
          return;
        }
        const idx = parseInt(input.dataset.index);
        const val = input.value.trim();
        if (val) {
          slideUrls[idx] = val;
        } else {
          delete slideUrls[idx];
        }
      });
      saveToServer();
      applyAllImages();
      rebuildThumbnails();
      settingsDirty = false;
      closeSettings();
    }

    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });

    document.getElementById('sidebarClose').addEventListener('click', () => {
      sidebar.classList.add('collapsed');
    });

    document.getElementById('sidebarAddBtn').addEventListener('click', addSlide);

    async function loadDeck(name) {
      deckName = name;
      localStorage.setItem('deckName', name);
      setHeading(name);
      await loadFromServer();
      while (slides.length > 1) {
        const el = slides.pop();
        el.remove();
      }
      if (slides[0]) {
        slides[0].dataset.slide = 0;
        slides[0].querySelector('.slide-label').textContent = getSlideName(0);
        const fbNum = slides[0].querySelector('.fb-num');
        if (fbNum) fbNum.textContent = getSlideName(0);
        slides[0].querySelector('.slide-number').textContent = '1 / 1';
      }
      for (let i = 1; i < savedCount; i++) {
        const slide = document.createElement('div');
        slide.className = 'slide';
        slide.dataset.slide = i;
        slide.innerHTML =
          '<div class="slide-img-wrap">' +
            '<img alt="" draggable="false">' +
            '<div class="resize-handle nw"></div>' +
            '<div class="resize-handle n"></div>' +
            '<div class="resize-handle ne"></div>' +
            '<div class="resize-handle e"></div>' +
            '<div class="resize-handle se"></div>' +
            '<div class="resize-handle s"></div>' +
            '<div class="resize-handle sw"></div>' +
            '<div class="resize-handle w"></div>' +
          '</div>' +
          '<div class="img-props" data-slide="' + i + '">' +
            '<button data-mode="cover">Cover</button>' +
            '<button data-mode="contain">Contain</button>' +
            '<button data-mode="fill">Fill</button>' +
            '<button data-mode="original">Original</button>' +
            '<div class="bg-color-wrap"><input type="color" class="bg-color-input" value="#1a1a24" title="Background color"></div>' +
          '</div>' +
          '<div class="fallback-msg"><div class="fallback-box"><div class="fb-num">' + getSlideName(i) + '</div><div class="fb-label">Import image or paste from clipboard</div></div></div>' +
          '<div class="slide-url-bar"><input type="text" placeholder="/api/image/..." spellcheck="false"><button>Apply</button></div>' +
          '<span class="slide-label">' + getSlideName(i) + '</span>' +
          '<span class="slide-number">' + (i + 1) + ' / ' + savedCount + '</span>';
        container.appendChild(slide);
        slides.push(slide);
      }
      slides.forEach(el => { setupSlideDrop(el); setupResize(el); });
      createDots();
      applyAllImages();
      rebuildThumbnails();
      update();
      current = 0;
    }

    let renameInput = null;

    document.querySelector('.sidebar-header-left').addEventListener('dblclick', (e) => {
      const heading = e.target.closest('#deckNameHeading');
      if (!heading || renameInput) return;
      renameInput = document.createElement('input');
      renameInput.type = 'text';
      renameInput.value = deckName;
      renameInput.style.background = 'rgba(255,255,255,0.08)';
      renameInput.style.border = '1px solid #6366f1';
      renameInput.style.borderRadius = '0.25rem';
      renameInput.style.color = '#e2e8f0';
      renameInput.style.fontSize = '0.75rem';
      renameInput.style.padding = '0.1rem 0.3rem';
      renameInput.style.width = '100%';
      renameInput.style.outline = 'none';
      renameInput.style.fontFamily = 'inherit';
      renameInput.style.fontWeight = '600';
      renameInput.style.textTransform = 'uppercase';
      renameInput.style.letterSpacing = '0.06em';
      heading.replaceWith(renameInput);
      renameInput.focus();
      renameInput.select();

      async function saveRename() {
        const newName = renameInput.value.trim();
        if (!newName || newName === deckName) { cancelRename(); return; }
        renameInput.disabled = true;
        document.getElementById('renameSpinner').classList.add('show');
        try {
          const resp = await fetch(resolveUrl('/api/data/' + encodeURIComponent(deckName)));
          if (!resp.ok) throw new Error('Fetch failed');
          const data = await resp.json();
          const kv = data.kv || {};
          const saveResp = await fetch(resolveUrl('/api/data/' + encodeURIComponent(newName)), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kv })
          });
          if (!saveResp.ok) throw new Error('Save failed');
          const delResp = await fetch(resolveUrl('/api/data/' + encodeURIComponent(deckName)), { method: 'DELETE' });
          if (!delResp.ok) throw new Error('Delete failed');
          deckName = newName;
          localStorage.setItem('deckName', newName);
          setHeading(newName);
          await loadFromServer();
          applyAllImages();
          rebuildThumbnails();
          update();
          document.getElementById('renameSpinner').classList.remove('show');
        } catch (_) {
          document.getElementById('renameSpinner').classList.remove('show');
          showToast('Failed to rename deck');
          cancelRename();
        }
      }

      function cancelRename() {
        setHeading(deckName);
      }

      renameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveRename(); }
        if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
      });
      renameInput.addEventListener('blur', saveRename);
    });

    function setHeading(text) {
      if (renameInput) {
        const heading = document.createElement('h3');
        heading.id = 'deckNameHeading';
        heading.textContent = text;
        renameInput.replaceWith(heading);
        renameInput = null;
      } else {
        const existing = document.getElementById('deckNameHeading');
        if (existing) existing.textContent = text;
      }
    }

    setHeading(deckName);

    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    document.addEventListener('fullscreenchange', () => {
      const isFull = !!document.fullscreenElement;
      document.documentElement.classList.toggle('fullscreen', isFull);
      fullscreenBtn.innerHTML = isFull ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>' : '&#9974;';
      fullscreenBtn.title = isFull ? 'Exit fullscreen' : 'Fullscreen';
      sidebar.classList.toggle('collapsed', isFull);
      document.getElementById('settingsBtn').style.display = isFull ? 'none' : '';
      sidebarToggle.style.display = isFull ? 'none' : '';
      container.style.width = isFull ? '100%' : '';
      container.style.maxWidth = isFull ? 'none' : '';
      container.style.height = isFull ? '100vh' : '';
      container.style.borderRadius = isFull ? '0' : '';
      if (!isFull) {
        if (drawMode) toggleDrawMode(false);
        if (laserMode) toggleLaserMode(false);
        if (presenterMode) togglePresenterMode(false);
      }
      if (typeof resizeDrawCanvas === 'function') setTimeout(resizeDrawCanvas, 100);
      if (typeof resizeLaserCanvas === 'function') setTimeout(resizeLaserCanvas, 100);
    });

    settingsBtn.addEventListener('click', openSettings);
    modalClose.addEventListener('click', closeSettings);
    modalCancel.addEventListener('click', closeSettings);
    modalSave.addEventListener('click', saveSettings);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeSettings();
    });

    prevBtn.addEventListener('click', prev);
    nextBtn.addEventListener('click', next);

    function getSelectedImgIdx() {
      const sel = document.querySelector('.slide-img-wrap.selected');
      if (!sel) return -1;
      const slide = sel.closest('.slide');
      return slide ? parseInt(slide.dataset.slide) : -1;
    }

    function deleteSelectedImage() {
      const idx = getSelectedImgIdx();
      if (idx < 0) return;
      const wrap = slides[idx]?.querySelector('.slide-img-wrap');
      if (wrap) {
        wrap.classList.remove('selected');
      }
      undoData = { idx, url: slideUrls[idx] || null, resize: resizeData[idx] || null, mode: slideMode[idx] || null };
      delete slideUrls[idx];
      delete resizeData[idx];
      delete slideMode[idx];
      applySlideImage(slides[idx], '');
      saveToServer();
      rebuildThumbnails();
    }

    function undoDelete() {
      if (!undoData) return;
      let idx = undoData.idx;
      if (idx >= slides.length) idx = slides.length - 1;
      if (undoData.url) slideUrls[idx] = undoData.url;
      if (undoData.resize) resizeData[idx] = undoData.resize;
      if (undoData.mode) slideMode[idx] = undoData.mode;
      applySlideImage(slides[idx], undoData.url || '');
      undoData = null;
      saveToServer();
      rebuildThumbnails();
    }

    document.addEventListener('keydown', (e) => {
      if (modalOverlay.classList.contains('open')) {
        if (e.key === 'Escape') { e.preventDefault(); closeSettings(); }
        if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); saveSettings(); }
        return;
      }
      const isInPresenterNotes = document.activeElement === presenterNotes;
      const isContentEditable = document.activeElement && document.activeElement.isContentEditable;
      const navKeys = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'PageUp', 'PageDown', ' '];
      if (isInPresenterNotes && navKeys.includes(e.key)) return;
      if (isContentEditable) {
        if (navKeys.includes(e.key) || e.key === 'Delete' || e.key === 'Backspace') return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault(); next();
      }
      if (e.key === 'Home') { e.preventDefault(); goTo(0); }
      if (e.key === 'End') { e.preventDefault(); goTo(slides.length - 1); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedShapeEl) { e.preventDefault(); deleteSelectedShape(); return; }
        if (getSelectedImgIdx() >= 0) { e.preventDefault(); deleteSelectedImage(); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault(); undoDelete();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault(); duplicateSlide(current);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedShapeEl && !isContentEditable && !isInPresenterNotes) {
          e.preventDefault();
          const idx = parseInt(selectedShapeEl.closest('.slide').dataset.slide);
          const id = selectedShapeEl.dataset.shapeId;
          const shape = getShapeById(idx, id);
          if (shape) {
            shapeClipboard = JSON.parse(JSON.stringify(shape));
            showToast('Shape copied', 'success');
          }
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (shapeClipboard && !isContentEditable && !isInPresenterNotes) {
          e.preventDefault();
          const newId = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
          const pasteShape = JSON.parse(JSON.stringify(shapeClipboard));
          pasteShape.id = newId;
          pasteShape.x = parseFloat(pasteShape.x) + 2 + '%';
          pasteShape.y = parseFloat(pasteShape.y) + 2 + '%';
          if (!slideShapes[current]) slideShapes[current] = [];
          slideShapes[current].push(pasteShape);
          renderShapes(current);
          const pasteEl = slides[current].querySelector('.shape[data-shape-id="' + newId + '"]');
          if (pasteEl) selectShape(pasteEl);
          saveToServer();
          showToast('Shape pasted', 'success');
        }
      }
      if ((e.key === 'l' || e.key === 'L') && document.documentElement.classList.contains('fullscreen')) {
        e.preventDefault();
        if (!laserMode && drawMode) toggleDrawMode(false);
        toggleLaserMode(!laserMode);
      }
      if ((e.key === 'p' || e.key === 'P') && document.documentElement.classList.contains('fullscreen')) {
        e.preventDefault();
        togglePresenterMode(!presenterMode);
      }
      if ((e.key === 'd' || e.key === 'D') && document.documentElement.classList.contains('fullscreen')) {
        e.preventDefault();
        if (!drawMode && laserMode) toggleLaserMode(false);
        toggleDrawMode(!drawMode);
      }
      if (e.key === 'Escape') {
        if (ctxMenu.classList.contains('show') || ctxShapeMenu.classList.contains('show')) hideCtxMenu();
        if (lineDrawState) {
          if (lineDrawState.tempEl) lineDrawState.tempEl.remove();
          lineDrawState = null;
          slides[current].style.cursor = '';
        }
      }
    });

    document.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      let imgItem = null;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) { imgItem = items[i]; break; }
      }
      if (!imgItem) return;
      e.preventDefault();
      const selIdx = getSelectedImgIdx();
      const idx = selIdx >= 0 ? selIdx : current;
      pasteImageAt(idx, imgItem);
    });

    async function pasteImageAt(idx, imgItem) {
      if (idx < 0 || idx >= slides.length) return;
      const file = imgItem.getAsFile();
      if (!file) return;
      try {
        const serverUrl = await uploadImage(file);
        slideUrls[idx] = serverUrl;
        delete resizeData[idx];
        delete slideMode[idx];
        const wrap = slides[idx].querySelector('.slide-img-wrap');
        if (wrap) wrap.classList.remove('selected');
        applySlideImage(slides[idx], serverUrl);
        saveToServer();
        rebuildThumbnails();
        update();
      } catch (_) {
        showToast('Failed to paste image');
      }
    }

    container.addEventListener('contextmenu', (e) => {
      const slideEl = e.target.closest('.slide');
      if (!slideEl) return;
      e.preventDefault();
      const shapeEl = e.target.closest('.shape');
      if (shapeEl) {
        const slideIdx = parseInt(slideEl.dataset.slide);
        const shape = getShapeById(slideIdx, shapeEl.dataset.shapeId);
        if (!shape) return;
        selectShape(shapeEl);
        ctxShapeIdx = slideIdx;
        ctxShapeId = shape.id;
        shapePasteItem.style.display = shapeClipboard ? '' : 'none';
        ctxShapeMenu.style.left = e.clientX + 'px';
        ctxShapeMenu.style.top = e.clientY + 'px';
        ctxShapeMenu.classList.add('show');
      } else {
        ctxSlideIdx = parseInt(slideEl.dataset.slide);
        slidePasteItem.style.display = shapeClipboard ? '' : 'none';
        ctxMenu.style.left = e.clientX + 'px';
        ctxMenu.style.top = e.clientY + 'px';
        ctxMenu.classList.add('show');
        ctxFitSub.classList.remove('show');
      }
    });

    function hideCtxMenu() {
      ctxMenu.classList.remove('show');
      ctxShapeMenu.classList.remove('show');
      ctxFitSub.classList.remove('show');
      ctxSlideIdx = -1;
      ctxShapeIdx = -1;
      ctxShapeId = null;
    }

    ctxMenu.addEventListener('click', (e) => {
      const item = e.target.closest('.ctx-item');
      if (!item) return;
      const action = item.dataset.action;
      const idx = ctxSlideIdx;
      if (idx < 0 || idx >= slides.length) { hideCtxMenu(); return; }
      const slideEl = slides[idx];
      const hasImg = !!slideUrls[idx];
      switch (action) {
        case 'set-url':
          hideCtxMenu();
          goTo(idx);
          setTimeout(() => {
            const targetSlide = slides[idx];
            const urlBar = targetSlide.querySelector('.slide-url-bar');
            if (urlBar) {
              const input = urlBar.querySelector('input');
              input.value = slideUrls[idx] || '';
              urlBar.classList.add('show');
              input.focus();
              input.select();
            }
          }, 100);
          break;
        case 'remove':
          if (hasImg) {
            delete slideUrls[idx];
            delete resizeData[idx];
            delete slideMode[idx];
            const wrap = slideEl.querySelector('.slide-img-wrap');
            if (wrap) wrap.classList.remove('selected');
            applySlideImage(slideEl, '');
            saveToServer();
            rebuildThumbnails();
          }
          break;
        case 'duplicate':
          duplicateSlide(idx);
          break;
        case 'fit-cover':
        case 'fit-contain':
        case 'fit-fill':
        case 'fit-original':
          if (hasImg) {
            const mode = action.replace('fit-', '');
            slideMode[idx] = mode;
            const img = slideEl.querySelector('.slide-img-wrap img');
            applyMode(img, idx);
            saveToServer();
          }
          break;
        case 'copy':
          if (hasImg) {
            navigator.clipboard.writeText(slideUrls[idx]).catch(() => {});
          }
          break;
        case 'paste':
          navigator.clipboard.read().then(clipboardItems => {
            for (const ci of clipboardItems) {
              for (const type of ci.types) {
                if (type.startsWith('image/')) {
                  ci.getType(type).then(blob => {
                    const fakeItem = { getAsFile: () => blob };
                    pasteImageAt(idx, fakeItem);
                  });
                  return;
                }
              }
            }
          }).catch(() => {});
          break;
        case 'shape-paste': {
          if (!shapeClipboard) break;
          const newId = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
          const pasteShape = JSON.parse(JSON.stringify(shapeClipboard));
          pasteShape.id = newId;
          pasteShape.x = parseFloat(pasteShape.x) + 2 + '%';
          pasteShape.y = parseFloat(pasteShape.y) + 2 + '%';
          if (!slideShapes[idx]) slideShapes[idx] = [];
          slideShapes[idx].push(pasteShape);
          renderShapes(idx);
          const pasteEl = slides[idx].querySelector('.shape[data-shape-id="' + newId + '"]');
          if (pasteEl) selectShape(pasteEl);
          saveToServer();
          showToast('Shape pasted', 'success');
          break;
        }
      }
      hideCtxMenu();
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.ctx-menu')) hideCtxMenu();
    });

    ctxMenu.querySelector('.ctx-sub').addEventListener('click', (e) => {
      e.stopPropagation();
      ctxFitSub.classList.toggle('show');
    });

    ctxShapeMenu.addEventListener('click', (e) => {
      const item = e.target.closest('.ctx-item');
      if (!item) return;
      const action = item.dataset.action;
      const idx = ctxShapeIdx;
      const id = ctxShapeId;
      if (idx < 0 || idx >= slides.length || !id) { hideCtxMenu(); return; }
      const shapes = slideShapes[idx] || [];
      const shape = shapes.find(s => s.id === id);
      if (!shape) { hideCtxMenu(); return; }
      switch (action) {
        case 'shape-copy':
          shapeClipboard = JSON.parse(JSON.stringify(shape));
          showToast('Shape copied', 'success');
          break;
        case 'shape-cut':
          shapeClipboard = JSON.parse(JSON.stringify(shape));
          deleteSelectedShape();
          showToast('Shape cut', 'success');
          break;
        case 'shape-duplicate': {
          const newId = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
          const dup = JSON.parse(JSON.stringify(shape));
          dup.id = newId;
          dup.x = parseFloat(dup.x) + 2 + '%';
          dup.y = parseFloat(dup.y) + 2 + '%';
          shapes.push(dup);
          renderShapes(idx);
          const el = slides[idx].querySelector('.shape[data-shape-id="' + newId + '"]');
          if (el) selectShape(el);
          saveToServer();
          break;
        }
        case 'shape-delete':
          deleteSelectedShape();
          break;
        case 'shape-paste': {
          if (!shapeClipboard) break;
          const newId = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
          const pasteShape = JSON.parse(JSON.stringify(shapeClipboard));
          pasteShape.id = newId;
          pasteShape.x = parseFloat(pasteShape.x) + 2 + '%';
          pasteShape.y = parseFloat(pasteShape.y) + 2 + '%';
          if (!slideShapes[idx]) slideShapes[idx] = [];
          slideShapes[idx].push(pasteShape);
          renderShapes(idx);
          const pasteEl = slides[idx].querySelector('.shape[data-shape-id="' + newId + '"]');
          if (pasteEl) selectShape(pasteEl);
          saveToServer();
          showToast('Shape pasted', 'success');
          break;
        }
      }
      hideCtxMenu();
    });

    container.addEventListener('click', (e) => {
      if (e.target.closest('.nav-arrow') || e.target.closest('.dot') || e.target.closest('.settings-btn')) return;
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.slide-url-bar')) {
        document.querySelectorAll('.slide-url-bar.show').forEach(b => b.classList.remove('show'));
      }
    });

    await loadFromServer();

    for (let i = 1; i < savedCount; i++) {
      const slide = document.createElement('div');
      slide.className = 'slide';
      slide.dataset.slide = i;
      slide.innerHTML =
        '<div class="slide-img-wrap">' +
          '<img alt="" draggable="false">' +
          '<div class="resize-handle nw"></div>' +
          '<div class="resize-handle n"></div>' +
          '<div class="resize-handle ne"></div>' +
          '<div class="resize-handle e"></div>' +
          '<div class="resize-handle se"></div>' +
          '<div class="resize-handle s"></div>' +
          '<div class="resize-handle sw"></div>' +
          '<div class="resize-handle w"></div>' +
        '</div>' +
        '<div class="img-props" data-slide="' + i + '">' +
          '<button data-mode="cover">Cover</button>' +
          '<button data-mode="contain">Contain</button>' +
          '<button data-mode="fill">Fill</button>' +
          '<button data-mode="original">Original</button>' +
          '<div class="bg-color-wrap"><input type="color" class="bg-color-input" value="#1a1a24" title="Background color"></div>' +
        '</div>' +
        '<div class="fallback-msg"><div class="fallback-box"><div class="fb-num">Slide Number ' + (i + 1) + '</div><div class="fb-label">Import image or paste from clipboard</div></div></div>' +
        '<div class="slide-url-bar"><input type="text" placeholder="/api/image/..." spellcheck="false"><button>Apply</button></div>' +
        '<span class="slide-label">Slide ' + (i + 1) + '</span>' +
        '<span class="slide-number">' + (i + 1) + ' / ' + savedCount + '</span>';
      container.appendChild(slide);
      slides.push(slide);
    }

    // ---- Drawing / Annotation ----
    const drawCanvas = document.getElementById('drawCanvas');
    const drawCtx = drawCanvas.getContext('2d');
    const drawToolbar = document.getElementById('drawToolbar');
    const drawColorInput = document.getElementById('drawColor');
    const drawSizeInput = document.getElementById('drawSize');
    const drawSizeLabel = document.getElementById('drawSizeLabel');
    const drawUndoBtn = document.getElementById('drawUndo');
    const drawEraseBtn = document.getElementById('drawErase');
    const drawToggleToolbarBtn = document.getElementById('drawToggleBtnToolbar');
    const drawToggleBtn = document.getElementById('drawToggleBtn');
    let drawMode = false;
    let drawing = false;
    let drawData = {};

    function resizeDrawCanvas() {
      const rect = container.getBoundingClientRect();
      drawCanvas.width = rect.width;
      drawCanvas.height = rect.height;
      drawCtx.lineCap = 'round';
      drawCtx.lineJoin = 'round';
      redrawDrawings();
    }

    function redrawDrawings() {
      if (!drawCtx || !drawCanvas) return;
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
      const data = drawData[current];
      if (!data || data.length === 0) return;
      data.forEach(stroke => {
        drawCtx.strokeStyle = stroke.color;
        drawCtx.lineWidth = stroke.size;
        drawCtx.beginPath();
        stroke.points.forEach((p, i) => {
          if (i === 0) drawCtx.moveTo(p.x, p.y);
          else drawCtx.lineTo(p.x, p.y);
        });
        drawCtx.stroke();
      });
    }

    function getDrawPos(e) {
      const rect = container.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    drawCanvas.addEventListener('mousedown', (e) => {
      if (!drawMode) return;
      drawing = true;
      const pos = getDrawPos(e);
      if (!drawData[current]) drawData[current] = [];
      drawData[current].push({ color: drawColorInput.value, size: parseInt(drawSizeInput.value), points: [pos] });
      drawCtx.strokeStyle = drawColorInput.value;
      drawCtx.lineWidth = parseInt(drawSizeInput.value);
      drawCtx.beginPath();
      drawCtx.moveTo(pos.x, pos.y);
    });

    drawCanvas.addEventListener('mousemove', (e) => {
      if (!drawing || !drawMode) return;
      const pos = getDrawPos(e);
      const stroke = drawData[current][drawData[current].length - 1];
      stroke.points.push(pos);
      drawCtx.lineTo(pos.x, pos.y);
      drawCtx.stroke();
      drawCtx.beginPath();
      drawCtx.moveTo(pos.x, pos.y);
    });

    drawCanvas.addEventListener('mouseup', () => {
      drawing = false;
      drawCtx.beginPath();
    });
    drawCanvas.addEventListener('mouseleave', () => {
      drawing = false;
      drawCtx.beginPath();
    });

    drawCanvas.addEventListener('touchstart', (e) => {
      if (!drawMode) return;
      e.preventDefault();
      drawing = true;
      const pos = getDrawPos(e);
      if (!drawData[current]) drawData[current] = [];
      drawData[current].push({ color: drawColorInput.value, size: parseInt(drawSizeInput.value), points: [pos] });
      drawCtx.strokeStyle = drawColorInput.value;
      drawCtx.lineWidth = parseInt(drawSizeInput.value);
      drawCtx.beginPath();
      drawCtx.moveTo(pos.x, pos.y);
    }, { passive: false });

    drawCanvas.addEventListener('touchmove', (e) => {
      if (!drawing || !drawMode) return;
      e.preventDefault();
      const pos = getDrawPos(e);
      const stroke = drawData[current][drawData[current].length - 1];
      stroke.points.push(pos);
      drawCtx.lineTo(pos.x, pos.y);
      drawCtx.stroke();
      drawCtx.beginPath();
      drawCtx.moveTo(pos.x, pos.y);
    }, { passive: false });

    drawCanvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      drawing = false;
      drawCtx.beginPath();
    }, { passive: false });

    function toggleDrawMode(enable) {
      drawMode = enable;
      drawCanvas.classList.toggle('active', drawMode);
      drawToolbar.classList.toggle('show', drawMode);
      drawToggleBtn.style.background = drawMode ? 'rgba(99,102,241,0.3)' : '';
      drawToggleBtn.style.borderColor = drawMode ? '#6366f1' : '';
      if (!drawMode) { drawing = false; }
    }

    drawToggleBtn.addEventListener('click', () => {
      if (!drawMode && laserMode) toggleLaserMode(false);
      toggleDrawMode(!drawMode);
    });

    drawToggleToolbarBtn.addEventListener('click', () => {
      toggleDrawMode(false);
    });

    drawEraseBtn.addEventListener('click', () => {
      delete drawData[current];
      redrawDrawings();
    });

    drawUndoBtn.addEventListener('click', () => {
      if (drawData[current] && drawData[current].length > 0) {
        drawData[current].pop();
        redrawDrawings();
      }
    });

    drawSizeInput.addEventListener('input', () => {
      drawSizeLabel.textContent = drawSizeInput.value;
    });

    // ---- Laser Pointer (beam with fading trail, draws only on mousedown) ----
    const laserCanvas = document.getElementById('laserCanvas');
    const laserCtx = laserCanvas.getContext('2d');
    const laserToggleBtn = document.getElementById('laserToggleBtn');
    let laserMode = false;
    let laserActive = false;
    let laserPoints = [];
    const LASER_TRAIL_DURATION = 1500;
    let laserRafId = null;

    function resizeLaserCanvas() {
      const rect = container.getBoundingClientRect();
      laserCanvas.width = rect.width;
      laserCanvas.height = rect.height;
    }

    function drawLaserTrail(now) {
      laserCtx.clearRect(0, 0, laserCanvas.width, laserCanvas.height);
      laserPoints = laserPoints.filter(p => now - p.time < LASER_TRAIL_DURATION);
      if (laserPoints.length < 2) {
        if (laserPoints.length === 1) {
          const p = laserPoints[0];
          laserCtx.beginPath();
          laserCtx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          laserCtx.fillStyle = 'rgba(255,68,68,0.9)';
          laserCtx.fill();
        }
        laserRafId = requestAnimationFrame(drawLaserTrail);
        return;
      }
      for (let i = 1; i < laserPoints.length; i++) {
        const p0 = laserPoints[i - 1];
        const p1 = laserPoints[i];
        const age = now - p1.time;
        const opacity = Math.max(0, 1 - age / LASER_TRAIL_DURATION);
        const width = Math.max(1, 5 * opacity);
        laserCtx.beginPath();
        laserCtx.moveTo(p0.x, p0.y);
        laserCtx.lineTo(p1.x, p1.y);
        laserCtx.strokeStyle = `rgba(255,68,68,${opacity})`;
        laserCtx.lineWidth = width;
        laserCtx.stroke();
      }
      const last = laserPoints[laserPoints.length - 1];
      const grad = laserCtx.createRadialGradient(last.x, last.y, 0, last.x, last.y, 12);
      grad.addColorStop(0, 'rgba(255,68,68,0.95)');
      grad.addColorStop(0.3, 'rgba(255,68,68,0.5)');
      grad.addColorStop(1, 'rgba(255,68,68,0)');
      laserCtx.beginPath();
      laserCtx.arc(last.x, last.y, 12, 0, Math.PI * 2);
      laserCtx.fillStyle = grad;
      laserCtx.fill();
      laserCtx.beginPath();
      laserCtx.arc(last.x, last.y, 3, 0, Math.PI * 2);
      laserCtx.fillStyle = 'rgba(255,68,68,1)';
      laserCtx.fill();

      if (laserPoints.length > 0) {
        laserRafId = requestAnimationFrame(drawLaserTrail);
      } else {
        laserRafId = null;
      }
    }

    function toggleLaserMode(enable) {
      laserMode = enable;
      laserToggleBtn.style.background = laserMode ? 'rgba(99,102,241,0.3)' : '';
      laserToggleBtn.style.borderColor = laserMode ? '#6366f1' : '';
      document.body.style.cursor = laserMode ? 'default' : '';
      if (laserMode) {
        laserPoints = [];
        resizeLaserCanvas();
        laserRafId = requestAnimationFrame(drawLaserTrail);
      } else {
        laserPoints = [];
        laserCtx.clearRect(0, 0, laserCanvas.width, laserCanvas.height);
        if (laserRafId) { cancelAnimationFrame(laserRafId); laserRafId = null; }
      }
    }

    laserToggleBtn.addEventListener('click', () => {
      if (!document.documentElement.classList.contains('fullscreen')) return;
      if (!laserMode && drawMode) toggleDrawMode(false);
      toggleLaserMode(!laserMode);
    });

    // ---- Presenter Mode (Notes + Timer + Next Preview) ----
    const presenterBtn = document.getElementById('presenterBtn');
    const presenterPanel = document.getElementById('presenterPanel');
    const presenterNotes = document.getElementById('presenterNotes');
    const presenterTimer = document.getElementById('presenterTimer');
    const presenterTimerStart = document.getElementById('presenterTimerStart');
    const presenterTimerReset = document.getElementById('presenterTimerReset');
    const presenterNextPreview = document.getElementById('presenterNextPreview');
    const presenterNextLabel = document.getElementById('presenterNextLabel');
    let presenterMode = false;
    let timerRunning = false;
    let timerSeconds = 0;
    let timerInterval = null;

    function formatTime(secs) {
      const m = String(Math.floor(secs / 60)).padStart(2, '0');
      const s = String(secs % 60).padStart(2, '0');
      return m + ':' + s;
    }

    function updatePresenterTimerDisplay() {
      presenterTimer.textContent = formatTime(timerSeconds);
    }

    function startTimer() {
      if (timerRunning) return;
      timerRunning = true;
      timerInterval = setInterval(() => {
        timerSeconds++;
        updatePresenterTimerDisplay();
      }, 1000);
      presenterTimerStart.textContent = '\u23F8';
    }

    function stopTimer() {
      if (!timerRunning) return;
      timerRunning = false;
      clearInterval(timerInterval);
      timerInterval = null;
      presenterTimerStart.textContent = '\u25B6';
    }

    function resetTimer() {
      stopTimer();
      timerSeconds = 0;
      updatePresenterTimerDisplay();
    }

    presenterTimerStart.addEventListener('click', () => {
      if (timerRunning) stopTimer();
      else startTimer();
    });

    presenterTimerReset.addEventListener('click', resetTimer);

    function updatePresenterPanel() {
      if (!presenterMode) return;
      presenterNotes.value = slideNotes[current] || '';
      const nextIdx = current + 1;
      if (nextIdx < slides.length) {
        const nextUrl = slideUrls[nextIdx];
        if (nextUrl && nextUrl.trim()) {
          presenterNextPreview.style.backgroundImage = 'url("' + resolveUrl(nextUrl).replace(/"/g, '\\"') + '")';
          presenterNextPreview.style.backgroundSize = 'cover';
          presenterNextPreview.style.backgroundPosition = 'center';
          presenterNextPreview.textContent = '';
        } else {
          presenterNextPreview.style.backgroundImage = '';
          presenterNextPreview.textContent = getSlideName(nextIdx);
        }
        presenterNextLabel.textContent = getSlideName(nextIdx);
      } else {
        presenterNextPreview.style.backgroundImage = '';
        presenterNextPreview.textContent = '\u2014';
        presenterNextLabel.textContent = 'Last slide';
      }
    }

    let notesSaveTimer = null;
    presenterNotes.addEventListener('input', () => {
      const val = presenterNotes.value.trim();
      if (val) slideNotes[current] = val;
      else delete slideNotes[current];
      if (notesSaveTimer) clearTimeout(notesSaveTimer);
      notesSaveTimer = setTimeout(saveToServer, 800);
    });

    function togglePresenterMode(enable) {
      presenterMode = enable;
      presenterPanel.classList.toggle('show', presenterMode);
      presenterBtn.style.background = presenterMode ? 'rgba(99,102,241,0.3)' : '';
      presenterBtn.style.borderColor = presenterMode ? '#6366f1' : '';
      if (presenterMode) {
        resetTimer();
        updatePresenterPanel();
      } else {
        stopTimer();
      }
    }

    presenterBtn.addEventListener('click', () => {
      if (!document.documentElement.classList.contains('fullscreen')) return;
      togglePresenterMode(!presenterMode);
    });

    // Hook into update() to refresh presenter panel on slide change
    const origUpdate = update;
    update = function () {
      origUpdate();
      if (presenterMode) updatePresenterPanel();
    };

    document.addEventListener('mousedown', (e) => {
      if (!laserMode) return;
      laserActive = true;
      const rect = container.getBoundingClientRect();
      laserPoints.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, time: performance.now() });
      if (!laserRafId) laserRafId = requestAnimationFrame(drawLaserTrail);
    });

    document.addEventListener('mousemove', (e) => {
      document.body.style.cursor = laserMode ? 'default' : '';
      if (!laserMode || !laserActive) return;
      const rect = container.getBoundingClientRect();
      laserPoints.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, time: performance.now() });
      if (!laserRafId) laserRafId = requestAnimationFrame(drawLaserTrail);
    });

    document.addEventListener('mouseup', () => {
      laserActive = false;
    });

    document.addEventListener('mouseleave', () => {
      if (!laserMode) return;
      laserActive = false;
      laserPoints = [];
      laserCtx.clearRect(0, 0, laserCanvas.width, laserCanvas.height);
      if (laserRafId) { cancelAnimationFrame(laserRafId); laserRafId = null; }
    });

    document.addEventListener('touchstart', (e) => {
      if (!laserMode) return;
      laserActive = true;
      const rect = container.getBoundingClientRect();
      const t = e.touches[0];
      laserPoints.push({ x: t.clientX - rect.left, y: t.clientY - rect.top, time: performance.now() });
      if (!laserRafId) laserRafId = requestAnimationFrame(drawLaserTrail);
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!laserMode || !laserActive) return;
      const rect = container.getBoundingClientRect();
      const t = e.touches[0];
      laserPoints.push({ x: t.clientX - rect.left, y: t.clientY - rect.top, time: performance.now() });
      if (!laserRafId) laserRafId = requestAnimationFrame(drawLaserTrail);
    }, { passive: true });

    document.addEventListener('touchend', () => {
      laserActive = false;
    }, { passive: true });

    window.addEventListener('resize', () => {
      resizeDrawCanvas();
      resizeLaserCanvas();
    });
    resizeDrawCanvas();
    resizeLaserCanvas();

    // ---- Shapes ----
    let slideShapes = {};
    let selectedShapeEl = null;
    let shapeDragState = null;
    let lineDrawState = null;

    function finishLineDraw() {
      if (!lineDrawState || !lineDrawState.active) return;
      const { type, x1, y1, x2, y2, tempEl } = lineDrawState;
      if (tempEl) tempEl.remove();
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.5) { lineDrawState = null; slides[current].style.cursor = ''; return; }
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      if (!slideShapes[current]) slideShapes[current] = [];
      const id = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const shape = {
        id, type,
        x: x1 + '%',
        y: y1 + '%',
        w: dist + '%',
        h: '0.3%',
        rotation: angle,
        fill: 'transparent', stroke: '#6366f1', strokeWidth: 3,
        fillOpacity: 1, strokeOpacity: 1,
        text: '', fontSize: 14, color: '#ffffff', fontFamily: 'Poppins', textAlign: 'center'
      };
      slideShapes[current].push(shape);
      renderShapes(current);
      const el = slides[current].querySelector('.shape[data-shape-id="' + id + '"]');
      if (el) selectShape(el);
      saveToServer();
      lineDrawState = null;
      slides[current].style.cursor = '';
    }

    function getDefaultShape(type) {
      const base = { x: '25%', y: '20%', w: '20%', h: '20%', rotation: 0, fill: 'transparent', stroke: '#6366f1', strokeWidth: 2, fillOpacity: 1, strokeOpacity: 1, text: '', fontSize: 14, color: '#ffffff', fontFamily: 'Poppins', textAlign: 'center' };
      switch (type) {
        case 'rect': return { ...base, type: 'rect' };
        case 'circle': return { ...base, type: 'circle' };
        case 'line': return { ...base, type: 'line', w: '30%', h: '0.3%', fill: 'none', stroke: '#ffffff', strokeWidth: 3, lineWeight: 3, lineDash: 'solid' };
        case 'arrow': return { ...base, type: 'arrow', w: '30%', h: '0.3%', fill: 'none', stroke: '#ffffff', strokeWidth: 3, lineWeight: 3, lineDash: 'solid' };
        case 'text': return { ...base, type: 'text', w: '20%', h: '8%', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, fillOpacity: 0, strokeOpacity: 0, text: 'Text', fontSize: 28, fontWeight: '400', fontStyle: 'normal', textDecoration: 'none', textAlign: 'center', direction: 'ltr', bgColor: 'transparent', bgOpacity: 0 };
        case 'image': return { ...base, type: 'image', w: '25%', h: '25%', src: '', fill: 'transparent', stroke: 'transparent', strokeWidth: 0, fillOpacity: 0, strokeOpacity: 0 };
        default: return { ...base, type: 'rect' };
      }
    }

    function hexToRgba(hex, opacity) {
      if (!hex || hex === 'transparent' || hex === 'none') return hex;
      const r = parseInt(hex.slice(1,3), 16);
      const g = parseInt(hex.slice(3,5), 16);
      const b = parseInt(hex.slice(5,7), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + (opacity == null ? 1 : opacity) + ')';
    }

    function styleShapeEl(el, shape) {
      el.style.left = shape.x;
      el.style.top = shape.y;
      el.style.width = shape.w;
      el.style.height = shape.h;
      el.style.transform = shape.rotation ? 'rotate(' + shape.rotation + 'deg)' : '';
      if (shape.type === 'rect' || shape.type === 'circle') {
        el.style.background = shape.fill && shape.fill !== 'transparent' ? hexToRgba(shape.fill, shape.fillOpacity) : 'transparent';
        el.style.borderColor = shape.stroke && shape.stroke !== 'transparent' ? hexToRgba(shape.stroke, shape.strokeOpacity) : 'transparent';
        el.style.borderWidth = (shape.strokeWidth || 0) + 'px';
        el.style.borderRadius = shape.type === 'circle' ? '50%' : '0';
      } else if (shape.type === 'line' || shape.type === 'arrow') {
        const lw = shape.lineWeight || 3;
        const dash = shape.lineDash || 'solid';
        const fillColor = shape.fill && shape.fill !== 'transparent' && shape.fill !== 'none' ? hexToRgba(shape.fill, shape.fillOpacity) : null;
        const color = fillColor || (shape.stroke ? hexToRgba(shape.stroke, shape.strokeOpacity) : 'transparent');
        el.style.height = lw + 'px';
        el.style.border = 'none';
        el.style.borderRadius = '0';
        el.style.transformOrigin = '0 50%';
        if (dash === 'solid') {
          el.style.background = color;
        } else {
          let grad = '';
          if (dash === 'dashed') {
            grad = 'repeating-linear-gradient(90deg, ' + color + ' 0px, ' + color + ' 8px, transparent 8px, transparent 12px)';
          } else if (dash === 'dotted') {
            grad = 'repeating-linear-gradient(90deg, ' + color + ' 0px, ' + color + ' 2px, transparent 2px, transparent 6px)';
          } else if (dash === 'dashdot') {
            grad = 'repeating-linear-gradient(90deg, ' + color + ' 0px, ' + color + ' 6px, transparent 6px, transparent 10px, ' + color + ' 10px, ' + color + ' 12px, transparent 12px, transparent 16px)';
          }
          el.style.background = grad;
        }
        if (shape.type === 'arrow') el.style.color = color;
      } else if (shape.type === 'text') {
        let label = el.querySelector('.shape-label');
        if (!label) {
          label = document.createElement('div');
          label.className = 'shape-label';
          el.appendChild(label);
        }
        label.textContent = shape.text || 'Text';
        label.style.color = shape.color || '#ffffff';
        label.style.fontSize = (shape.fontSize || 28) + 'px';
        label.style.fontWeight = shape.fontWeight || '400';
        label.style.fontStyle = shape.fontStyle || 'normal';
        label.style.textDecoration = shape.textDecoration || 'none';
        label.style.fontFamily = shape.fontFamily || 'Poppins';
        label.style.textAlign = shape.textAlign || 'center';
        label.style.direction = shape.direction || 'ltr';
        label.style.display = 'block';
        el.style.background = shape.bgColor && shape.bgColor !== 'transparent' ? hexToRgba(shape.bgColor, shape.bgOpacity) : 'transparent';
        el.style.border = 'none';
        el.style.borderRadius = '0';
      } else if (shape.type === 'image') {
        let img = el.querySelector('img');
        let placeholder = el.querySelector('.shape-img-placeholder');
        if (shape.src) {
          if (placeholder) placeholder.remove();
          if (!img) {
            img = document.createElement('img');
            el.appendChild(img);
          }
          img.src = resolveUrl(shape.src);
          img.alt = '';
        } else {
          if (img) img.remove();
          if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.className = 'shape-img-placeholder';
            placeholder.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
            el.appendChild(placeholder);
          }
        }
        el.style.border = 'none';
        el.style.borderRadius = '0';
      } else {
        // Non-text shape label
        let label = el.querySelector('.shape-label');
        if (shape.text) {
          if (!label) {
            label = document.createElement('div');
            label.className = 'shape-label';
            el.appendChild(label);
          }
          label.textContent = shape.text;
          label.style.color = shape.color || '#ffffff';
          label.style.fontSize = (shape.fontSize || 14) + 'px';
          label.style.fontFamily = shape.fontFamily || 'Poppins';
          label.style.textAlign = shape.textAlign || 'center';
          label.style.display = 'flex';
        } else if (label) {
          label.remove();
        }
      }
    }

    function createShapeEl(shape) {
      const el = document.createElement('div');
      el.className = 'shape shape-' + shape.type;
      el.dataset.shapeId = shape.id;
      styleShapeEl(el, shape);
      if (shape.type === 'text') {
        el.spellcheck = false;
      }
      if (shape.type === 'line' || shape.type === 'arrow') {
        const startH = document.createElement('div');
        startH.className = 'line-handle start';
        el.appendChild(startH);
        const endH = document.createElement('div');
        endH.className = 'line-handle end';
        el.appendChild(endH);
      } else {
        ['nw','n','ne','e','se','s','sw','w'].forEach(dir => {
          const h = document.createElement('div');
          h.className = 'resize-handle ' + dir;
          el.appendChild(h);
        });
        const rotH = document.createElement('div');
        rotH.className = 'rot-handle';
        el.appendChild(rotH);
      }
      return el;
    }

    function renderShapes(slideIdx) {
      const slideEl = slides[slideIdx];
      if (!slideEl) return;
      slideEl.querySelectorAll('.shape').forEach(el => {
        if (selectedShapeEl === el) selectedShapeEl = null;
        el.remove();
      });
      const shapes = slideShapes[slideIdx] || [];
      shapes.forEach(shape => {
        const el = createShapeEl(shape);
        slideEl.appendChild(el);
      });
    }

    function renderAllShapes() {
      slides.forEach((_, i) => renderShapes(i));
    }

    function addShapeToSlide(type) {
      if (!slideShapes[current]) slideShapes[current] = [];
      const id = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const shape = { id, ...getDefaultShape(type) };
      slideShapes[current].push(shape);
      renderShapes(current);
      const el = slides[current].querySelector('.shape[data-shape-id="' + id + '"]');
      if (el) selectShape(el);
      saveToServer();
    }

    function deleteSelectedShape() {
      if (!selectedShapeEl) return;
      const idx = parseInt(selectedShapeEl.closest('.slide').dataset.slide);
      const id = selectedShapeEl.dataset.shapeId;
      slideShapes[idx] = (slideShapes[idx] || []).filter(s => s.id !== id);
      selectedShapeEl.remove();
      selectedShapeEl = null;
      hideShapeProps();
      saveToServer();
    }

    function getShapeById(slideIdx, id) {
      return (slideShapes[slideIdx] || []).find(s => s.id === id);
    }

    function selectShape(el) {
      if (selectedShapeEl === el) return;
      slides.forEach(s => {
        s.querySelectorAll('.shape.selected').forEach(sh => sh.classList.remove('selected'));
        const wrap = s.querySelector('.slide-img-wrap');
        if (wrap) wrap.classList.remove('selected');
      });
      if (el) {
        el.classList.add('selected');
        selectedShapeEl = el;
        showShapeProps();
      } else {
        selectedShapeEl = null;
        hideShapeProps();
      }
    }

    const shapeProps = document.getElementById('shapeProps');
    const shapeFill = document.getElementById('shapeFill');
    const shapeFillOpacity = document.getElementById('shapeFillOpacity');
    const shapeFillOpacityLabel = document.getElementById('shapeFillOpacityLabel');
    const shapeStroke = document.getElementById('shapeStroke');
    const shapeStrokeOpacity = document.getElementById('shapeStrokeOpacity');
    const shapeStrokeOpacityLabel = document.getElementById('shapeStrokeOpacityLabel');
    const shapeStrokeWidth = document.getElementById('shapeStrokeWidth');
    const shapeRotation = document.getElementById('shapeRotation');
    const shapeRotationSlider = document.getElementById('shapeRotationSlider');
    const shapeDelBtn = document.getElementById('shapeDelBtn');
    const shapeFontSize = document.getElementById('shapeFontSize');
    const shapeFontFamily = document.getElementById('shapeFontFamily');
    const shapeFontSizeGroup = document.getElementById('shapeFontSizeGroup');
    const shapeFontGroup = document.getElementById('shapeFontGroup');
    const shapeAlignGroup = document.getElementById('shapeAlignGroup');
    const shapeAlignBtns = shapeAlignGroup ? shapeAlignGroup.querySelectorAll('.shape-align-btn') : [];
    const shapeFormatGroup = document.getElementById('shapeFormatGroup');
    const shapeBoldBtn = document.getElementById('shapeBoldBtn');
    const shapeItalicBtn = document.getElementById('shapeItalicBtn');
    const shapeUnderlineBtn = document.getElementById('shapeUnderlineBtn');
    const shapeDirGroup = document.getElementById('shapeDirGroup');
    const shapeDirBtns = shapeDirGroup ? shapeDirGroup.querySelectorAll('.shape-dir-btn') : [];
    const shapeBgGroup = document.getElementById('shapeBgGroup');
    const shapeBgColor = document.getElementById('shapeBgColor');
    const shapeBgOpacity = document.getElementById('shapeBgOpacity');
    const shapeBgOpacityLabel = document.getElementById('shapeBgOpacityLabel');
    const shapeLineWeight = document.getElementById('shapeLineWeight');
    const shapeLineWeightSlider = document.getElementById('shapeLineWeightSlider');
    const shapeLineDash = document.getElementById('shapeLineDash');

    function showShapeProps() {
      const shape = selectedShapeEl ? getShapeById(
        parseInt(selectedShapeEl.closest('.slide').dataset.slide),
        selectedShapeEl.dataset.shapeId
      ) : null;
      if (!shape) return;
      const strokeGrp = document.getElementById('shapeStrokeGroup');
      const swGrp = document.getElementById('shapeStrokeWidthGroup');
      const fillOpGrp = document.getElementById('shapeFillOpacityGroup');
      const strokeOpGrp = document.getElementById('shapeStrokeOpacityGroup');
      if (shape.type === 'text') {
        shapeFill.value = shape.color || '#ffffff';
        shapeFontSize.value = shape.fontSize || 28;
        shapeFontFamily.value = shape.fontFamily || 'Poppins';
        strokeGrp.style.display = 'none';
        swGrp.style.display = 'none';
        fillOpGrp.style.display = 'none';
        strokeOpGrp.style.display = 'none';
        shapeFontSizeGroup.style.display = '';
        shapeFontGroup.style.display = '';
        shapeFormatGroup.style.display = '';
        shapeAlignGroup.style.display = '';
        shapeDirGroup.style.display = '';
        shapeBgGroup.style.display = '';
        shapeBgColor.value = (shape.bgColor && shape.bgColor !== 'transparent') ? shape.bgColor : '#000000';
        const bgOp = shape.bgOpacity == null ? 0 : shape.bgOpacity;
        shapeBgOpacity.value = bgOp;
        shapeBgOpacityLabel.textContent = Math.round(bgOp * 100) + '%';
        shapeBoldBtn.classList.toggle('active', shape.fontWeight === 'bold');
        shapeItalicBtn.classList.toggle('active', shape.fontStyle === 'italic');
        shapeUnderlineBtn.classList.toggle('active', shape.textDecoration === 'underline');
        const align = shape.textAlign || 'center';
        shapeAlignBtns.forEach(b => b.classList.toggle('active', b.dataset.align === align));
        const dir = shape.direction || 'ltr';
        shapeDirBtns.forEach(b => b.classList.toggle('active', b.dataset.dir === dir));
      } else if (shape.type === 'image') {
        const fillGrp = shapeFill.closest('.shape-prop-group');
        if (fillGrp) fillGrp.style.display = 'none';
        strokeGrp.style.display = 'none';
        swGrp.style.display = 'none';
        fillOpGrp.style.display = 'none';
        strokeOpGrp.style.display = 'none';
        shapeFontSizeGroup.style.display = 'none';
        shapeFontGroup.style.display = 'none';
        shapeFormatGroup.style.display = 'none';
        shapeAlignGroup.style.display = 'none';
        shapeDirGroup.style.display = 'none';
        shapeBgGroup.style.display = 'none';
        const imgSrcGroup = document.getElementById('shapeImageSrcGroup');
        if (imgSrcGroup) {
          imgSrcGroup.style.display = '';
          const srcInput = document.getElementById('shapeImageSrc');
          if (srcInput) srcInput.value = shape.src || '';
        }
      } else {
        const isLine = shape.type === 'line' || shape.type === 'arrow';
        shapeFill.value = (shape.fill && shape.fill !== 'transparent' && shape.fill !== 'none') ? shape.fill : '#6366f1';
        shapeFillOpacity.value = shape.fillOpacity == null ? 1 : shape.fillOpacity;
        shapeFillOpacityLabel.textContent = Math.round((shape.fillOpacity == null ? 1 : shape.fillOpacity) * 100) + '%';
        shapeStroke.value = (shape.stroke && shape.stroke !== 'transparent') ? shape.stroke : '#ffffff';
        shapeStrokeOpacity.value = shape.strokeOpacity == null ? 1 : shape.strokeOpacity;
        shapeStrokeOpacityLabel.textContent = Math.round((shape.strokeOpacity == null ? 1 : shape.strokeOpacity) * 100) + '%';
        shapeStrokeWidth.value = shape.strokeWidth || 2;
        strokeGrp.style.display = isLine ? 'none' : '';
        swGrp.style.display = isLine ? 'none' : '';
        fillOpGrp.style.display = isLine ? 'none' : '';
        strokeOpGrp.style.display = isLine ? 'none' : '';
        shapeFontSizeGroup.style.display = 'none';
        shapeFontGroup.style.display = 'none';
        shapeFormatGroup.style.display = 'none';
        shapeAlignGroup.style.display = 'none';
        shapeDirGroup.style.display = 'none';
        shapeBgGroup.style.display = 'none';
        const lwGrp = document.getElementById('shapeLineWeightGroup');
        const ldGrp = document.getElementById('shapeLineDashGroup');
        lwGrp.style.display = isLine ? '' : 'none';
        ldGrp.style.display = isLine ? '' : 'none';
        if (isLine && shapeLineWeight) {
          const lw = shape.lineWeight || 3;
          shapeLineWeight.value = lw;
          if (shapeLineWeightSlider) shapeLineWeightSlider.value = lw;
        }
        if (isLine && shapeLineDash) {
          shapeLineDash.value = shape.lineDash || 'solid';
        }
      }
      const rot = shape.rotation || 0;
      shapeRotation.value = rot;
      if (shapeRotationSlider) shapeRotationSlider.value = rot;
      shapeProps.classList.add('show');
    }

    function hideShapeProps() {
      shapeProps.classList.remove('show');
    }

    function updateShapeFromProps() {
      if (!selectedShapeEl) return;
      const slideIdx = parseInt(selectedShapeEl.closest('.slide').dataset.slide);
      const id = selectedShapeEl.dataset.shapeId;
      const shapes = slideShapes[slideIdx] || [];
      const i = shapes.findIndex(s => s.id === id);
      if (i < 0) return;
      const shape = shapes[i];
      if (shape.type === 'text') {
        shape.color = shapeFill.value;
        shape.fontSize = parseInt(shapeFontSize.value) || 28;
        shape.fontFamily = shapeFontFamily.value || 'Poppins';
        shape.fontWeight = shapeBoldBtn.classList.contains('active') ? 'bold' : '400';
        shape.fontStyle = shapeItalicBtn.classList.contains('active') ? 'italic' : 'normal';
        shape.textDecoration = shapeUnderlineBtn.classList.contains('active') ? 'underline' : 'none';
        const activeAlign = shapeAlignGroup.querySelector('.shape-align-btn.active');
        shape.textAlign = activeAlign ? activeAlign.dataset.align : 'center';
        const activeDir = shapeDirGroup.querySelector('.shape-dir-btn.active');
        shape.direction = activeDir ? activeDir.dataset.dir : 'ltr';
        shape.bgColor = shapeBgColor.value;
        shape.bgOpacity = parseFloat(shapeBgOpacity.value) || 0;
      } else if (shape.type === 'image') {
        const srcInput = document.getElementById('shapeImageSrc');
        if (srcInput) shape.src = srcInput.value;
      } else {
        shape.fill = shapeFill.value;
        shape.fillOpacity = parseFloat(shapeFillOpacity.value) || 0;
        shape.stroke = shapeStroke.value;
        shape.strokeOpacity = parseFloat(shapeStrokeOpacity.value) || 0;
        shape.strokeWidth = parseFloat(shapeStrokeWidth.value) || 0;
        if (shape.type === 'line' || shape.type === 'arrow') {
          shape.lineWeight = parseInt(shapeLineWeight.value) || 3;
          shape.lineDash = shapeLineDash ? shapeLineDash.value : 'solid';
        }
      }
      shape.rotation = parseFloat(shapeRotation.value) || 0;
      styleShapeEl(selectedShapeEl, shape);
      clearTimeout(textSaveTimer);
      textSaveTimer = setTimeout(saveToServer, 300);
    }

    shapeFill.addEventListener('input', updateShapeFromProps);
    shapeFillOpacity.addEventListener('input', () => {
      shapeFillOpacityLabel.textContent = Math.round(parseFloat(shapeFillOpacity.value) * 100) + '%';
      updateShapeFromProps();
    });
    shapeStroke.addEventListener('input', updateShapeFromProps);
    shapeStrokeOpacity.addEventListener('input', () => {
      shapeStrokeOpacityLabel.textContent = Math.round(parseFloat(shapeStrokeOpacity.value) * 100) + '%';
      updateShapeFromProps();
    });
    shapeStrokeWidth.addEventListener('input', updateShapeFromProps);
    function syncLineWeight(val) {
      shapeLineWeight.value = val;
      if (shapeLineWeightSlider) shapeLineWeightSlider.value = val;
      updateShapeFromProps();
    }
    shapeLineWeight.addEventListener('input', () => syncLineWeight(shapeLineWeight.value));
    if (shapeLineWeightSlider) {
      shapeLineWeightSlider.addEventListener('input', () => syncLineWeight(shapeLineWeightSlider.value));
    }
    if (shapeLineDash) {
      shapeLineDash.addEventListener('change', updateShapeFromProps);
    }
    shapeFontSize.addEventListener('input', updateShapeFromProps);
    shapeFontFamily.addEventListener('change', updateShapeFromProps);
    shapeBgColor.addEventListener('input', updateShapeFromProps);
    shapeBgOpacity.addEventListener('input', () => {
      shapeBgOpacityLabel.textContent = Math.round(parseFloat(shapeBgOpacity.value) * 100) + '%';
      updateShapeFromProps();
    });
    function syncRotation(val) {
      shapeRotation.value = val;
      if (shapeRotationSlider) shapeRotationSlider.value = val;
      updateShapeFromProps();
    }
    shapeRotation.addEventListener('input', () => syncRotation(shapeRotation.value));
    if (shapeRotationSlider) {
      shapeRotationSlider.addEventListener('input', () => syncRotation(shapeRotationSlider.value));
    }
    shapeDelBtn.addEventListener('click', deleteSelectedShape);

    const shapeImageSrc = document.getElementById('shapeImageSrc');
    const shapeImageBrowseBtn = document.getElementById('shapeImageBrowseBtn');
    if (shapeImageSrc) {
      shapeImageSrc.addEventListener('change', updateShapeFromProps);
      shapeImageSrc.addEventListener('input', updateShapeFromProps);
    }
    if (shapeImageBrowseBtn) {
      shapeImageBrowseBtn.addEventListener('click', () => {
        let hiddenInput = document.getElementById('shapeImageInput');
        if (!hiddenInput) {
          hiddenInput = document.createElement('input');
          hiddenInput.id = 'shapeImageInput';
          hiddenInput.type = 'file';
          hiddenInput.accept = 'image/*';
          hiddenInput.style.display = 'none';
          hiddenInput.addEventListener('change', async function() {
            const file = this.files && this.files[0];
            if (!file) return;
            const sid = this.dataset.shapeId;
            const sIdx = parseInt(this.dataset.slideIdx);
            if (!sid || isNaN(sIdx)) return;
            try {
              const url = await uploadImage(file);
              const el = document.querySelector('.shape[data-shape-id="' + sid + '"]');
              const sh = getShapeById(sIdx, sid);
              if (el && sh) {
                sh.src = url;
                styleShapeEl(el, sh);
                const srcInput = document.getElementById('shapeImageSrc');
                if (srcInput) srcInput.value = url;
                saveToServer();
              }
            } catch (err) {
              showToast('Failed to upload image');
            }
            this.value = '';
          });
          document.body.appendChild(hiddenInput);
        }
        hiddenInput.dataset.shapeId = selectedShapeEl ? selectedShapeEl.dataset.shapeId : '';
        hiddenInput.dataset.slideIdx = selectedShapeEl ? selectedShapeEl.closest('.slide').dataset.slide : '';
        hiddenInput.click();
      });
    }

    const shapeZFrontBtn = document.getElementById('shapeZFrontBtn');
    const shapeZBackBtn = document.getElementById('shapeZBackBtn');

    function moveSelectedShape(toFront) {
      if (!selectedShapeEl) return;
      const idx = parseInt(selectedShapeEl.closest('.slide').dataset.slide);
      const id = selectedShapeEl.dataset.shapeId;
      const shapes = slideShapes[idx] || [];
      const i = shapes.findIndex(s => s.id === id);
      if (i < 0) return;
      const [shape] = shapes.splice(i, 1);
      if (toFront) {
        shapes.push(shape);
      } else {
        shapes.unshift(shape);
      }
      renderShapes(idx);
      const el = slides[idx].querySelector('.shape[data-shape-id="' + id + '"]');
      if (el) selectShape(el);
      saveToServer();
    }

    shapeZFrontBtn.addEventListener('click', () => moveSelectedShape(true));
    shapeZBackBtn.addEventListener('click', () => moveSelectedShape(false));

    shapeAlignBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        shapeAlignBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateShapeFromProps();
      });
    });

    [shapeBoldBtn, shapeItalicBtn, shapeUnderlineBtn].forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        updateShapeFromProps();
      });
    });

    shapeDirBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        shapeDirBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateShapeFromProps();
      });
    });

    // Container-level delegation for shape mouse events
    container.addEventListener('mousedown', (e) => {
      if (lineDrawState) {
        if (e.button !== 0) return;
        if (document.documentElement.classList.contains('fullscreen')) return;
        const sr = slides[current].getBoundingClientRect();
        const xPct = (e.clientX - sr.left) / sr.width * 100;
        const yPct = (e.clientY - sr.top) / sr.height * 100;
        if (!lineDrawState.active) {
          lineDrawState.x1 = xPct;
          lineDrawState.y1 = yPct;
          lineDrawState.x2 = xPct;
          lineDrawState.y2 = yPct;
          lineDrawState.active = true;
          lineDrawState.tempEl = document.createElement('div');
          lineDrawState.tempEl.className = 'shape shape-' + lineDrawState.type;
          lineDrawState.tempEl.style.pointerEvents = 'none';
          lineDrawState.tempEl.style.opacity = '0.6';
          lineDrawState.tempEl.style.border = 'none';
          lineDrawState.tempEl.style.background = '#6366f1';
          lineDrawState.tempEl.style.borderRadius = '0';
          lineDrawState.tempEl.style.transformOrigin = '0 50%';
          if (lineDrawState.type === 'arrow') {
            lineDrawState.tempEl.style.color = '#6366f1';
            const head = document.createElement('div');
            head.style.cssText = 'position:absolute;right:-1px;top:50%;transform:translateY(-50%);width:0;height:0;border-top:8px solid transparent;border-bottom:8px solid transparent;border-left:12px solid currentColor;pointer-events:none';
            lineDrawState.tempEl.appendChild(head);
          }
          slides[current].appendChild(lineDrawState.tempEl);
        }
        lineDrawState.x2 = xPct;
        lineDrawState.y2 = yPct;
        e.stopPropagation();
        return;
      }

      const shapeEl = e.target.closest('.shape');
      if (!shapeEl) return;
      if (document.documentElement.classList.contains('fullscreen')) return;
      if (e.button !== 0) return;

      const isHandle = e.target.classList.contains('resize-handle');
      const isRotate = e.target.classList.contains('rot-handle');
      const isLineHandle = e.target.classList.contains('line-handle');
      const slideIdx = parseInt(shapeEl.closest('.slide').dataset.slide);
      if (slideIdx !== current) return;
      const shape = getShapeById(slideIdx, shapeEl.dataset.shapeId);
      if (!shape) return;
      if (isLineHandle && (shape.type === 'line' || shape.type === 'arrow')) {
        e.stopPropagation();
        e.preventDefault();
        const sr = slides[current].getBoundingClientRect();
        const xPct = (e.clientX - sr.left) / sr.width * 100;
        const yPct = (e.clientY - sr.top) / sr.height * 100;
        shapeDragState = {
          shapeId: shape.id,
          idx: slideIdx,
          handle: 'line-' + (e.target.classList.contains('end') ? 'end' : 'start'),
          startX: e.clientX,
          startY: e.clientY,
          startL: parseFloat(shape.x),
          startT: parseFloat(shape.y),
          startW: parseFloat(shape.w),
          startH: parseFloat(shape.h),
          startRotation: shape.rotation || 0,
          startMX: xPct,
          startMY: yPct
        };
        return;
      }

      if (isRotate) {
        e.stopPropagation();
        e.preventDefault();
        const rect = shapeEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        shapeDragState = {
          shapeId: shape.id,
          idx: slideIdx,
          handle: 'rotate',
          startX: e.clientX,
          startY: e.clientY,
          cx, cy,
          startAngle: Math.atan2(e.clientY - cy, e.clientX - cx),
          startRotation: shape.rotation || 0
        };
        return;
      }

      if (isHandle) {
        e.stopPropagation();
        e.preventDefault();
        const handleDir = e.target.className.replace('resize-handle ', '');
        const sl = shapeEl.offsetLeft;
        const st = shapeEl.offsetTop;
        const sw2 = shapeEl.offsetWidth;
        const sh2 = shapeEl.offsetHeight;
        shapeDragState = {
          shapeId: shape.id,
          idx: slideIdx,
          handle: handleDir,
          startX: e.clientX,
          startY: e.clientY,
          startL: sl,
          startT: st,
          startW: sw2,
          startH: sh2
        };
        return;
      }

      selectShape(shapeEl);
      e.stopPropagation();

      if (shape.type === 'text') {
        const lbl = shapeEl.querySelector('.shape-label');
        if (lbl && lbl.contentEditable === 'true') return;
      }

      const sl = shapeEl.offsetLeft;
      const st = shapeEl.offsetTop;
      const sw2 = shapeEl.offsetWidth;
      const sh2 = shapeEl.offsetHeight;
      shapeDragState = {
        shapeId: shape.id,
        idx: slideIdx,
        handle: 'move',
        startX: e.clientX,
        startY: e.clientY,
        startL: sl,
        startT: st,
        startW: sw2,
        startH: sh2,
        active: false
      };
    });

    // Double-click to edit text on any shape
    container.addEventListener('dblclick', (e) => {
      const shapeEl = e.target.closest('.shape');
      if (!shapeEl) return;
      const slideIdx = parseInt(shapeEl.closest('.slide').dataset.slide);
      const shape = getShapeById(slideIdx, shapeEl.dataset.shapeId);
      if (!shape) return;

      selectShape(shapeEl);

      if (shape.type === 'text') {
        const lbl = shapeEl.querySelector('.shape-label');
        if (!lbl) return;
        lbl.contentEditable = true;
        lbl.focus();
        if (!lbl._textInputSetup) {
          lbl.addEventListener('blur', function() {
            this.contentEditable = false;
            shape.text = this.textContent || '';
            saveToServer();
          });
          lbl._textInputSetup = true;
        }
        return;
      }

      if (shape.type === 'image') {
        const input = document.getElementById('shapeImageInput') || (() => {
          const inp = document.createElement('input');
          inp.id = 'shapeImageInput';
          inp.type = 'file';
          inp.accept = 'image/*';
          inp.style.display = 'none';
          inp.addEventListener('change', async function() {
            const file = this.files && this.files[0];
            if (!file) return;
            const sid = this.dataset.shapeId;
            const sIdx = parseInt(this.dataset.slideIdx);
            if (!sid || isNaN(sIdx)) return;
            try {
              const url = await uploadImage(file);
              const el = document.querySelector('.shape[data-shape-id="' + sid + '"]');
              const sh = getShapeById(sIdx, sid);
              if (el && sh) {
                sh.src = url;
                styleShapeEl(el, sh);
                const srcInput = document.getElementById('shapeImageSrc');
                if (srcInput) srcInput.value = url;
                saveToServer();
              }
            } catch (err) {
              showToast('Failed to upload image');
            }
            this.value = '';
          });
          document.body.appendChild(inp);
          return inp;
        })();
        input.dataset.shapeId = shape.id;
        input.dataset.slideIdx = slideIdx;
        input.click();
        return;
      }

      // Ensure text props
      if (!shape.text) shape.text = '';
      if (!shape.fontSize) shape.fontSize = 14;
      if (!shape.color) shape.color = '#ffffff';
      if (!shape.fontFamily) shape.fontFamily = 'Poppins';

      // Create or find label
      let label = shapeEl.querySelector('.shape-label');
      if (!label) {
        label = document.createElement('div');
        label.className = 'shape-label';
        shapeEl.appendChild(label);
      }
      label.textContent = shape.text;
      label.style.color = shape.color;
      label.style.fontSize = shape.fontSize + 'px';
      label.style.fontFamily = shape.fontFamily;
      label.style.textAlign = shape.textAlign || 'center';
      label.contentEditable = true;
      label.style.display = 'flex';
      label.focus();

      // Save on blur (use one-time setup)
      if (!label._textInputSetup) {
        label.addEventListener('blur', function() {
          this.contentEditable = false;
          shape.text = this.textContent || '';
          saveToServer();
        });
        label._textInputSetup = true;
      }
    });

    // Text input for text shapes and shape labels (debounced)
    let textSaveTimer = null;
    document.addEventListener('input', (e) => {
      const shapeEl = e.target.closest('.shape');
      if (!shapeEl) return;
      if (!e.target.classList.contains('shape-label')) return;
      const slideIdx = parseInt(shapeEl.closest('.slide').dataset.slide);
      const shapes = slideShapes[slideIdx] || [];
      const shape = shapes.find(s => s.id === shapeEl.dataset.shapeId);
      if (shape) {
        shape.text = e.target.textContent || '';
      }
      clearTimeout(textSaveTimer);
      textSaveTimer = setTimeout(saveToServer, 300);
    });

    // Deselect shape on outside click
    document.addEventListener('click', (e) => {
      if (e.target.closest('.shape') || e.target.closest('.shape-props')) return;
      if (selectedShapeEl) {
        selectedShapeEl.classList.remove('selected');
        selectedShapeEl = null;
        hideShapeProps();
      }
    });

    // Shape drag/resize handlers
    document.addEventListener('mousemove', (e) => {
      if (lineDrawState && lineDrawState.active && lineDrawState.tempEl) {
        const sr = slides[current].getBoundingClientRect();
        const xPct = (e.clientX - sr.left) / sr.width * 100;
        const yPct = (e.clientY - sr.top) / sr.height * 100;
        lineDrawState.x2 = xPct;
        lineDrawState.y2 = yPct;
        const dx = xPct - lineDrawState.x1;
        const dy = yPct - lineDrawState.y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const el = lineDrawState.tempEl;
        el.style.left = lineDrawState.x1 + '%';
        el.style.top = lineDrawState.y1 + '%';
        el.style.width = dist + '%';
        el.style.height = '3px';
        el.style.transform = 'rotate(' + angle + 'deg)';
        return;
      }
      if (!shapeDragState) return;
      if (shapeDragState.idx !== current) { shapeDragState = null; return; }
      const slideEl = slides[shapeDragState.idx];
      if (!slideEl) return;
      const shapeEl = slideEl.querySelector('.shape[data-shape-id="' + shapeDragState.shapeId + '"]');
      if (!shapeEl) { shapeDragState = null; return; }

      const h = shapeDragState.handle;

      if (h === 'rotate') {
        const angle = Math.atan2(e.clientY - shapeDragState.cy, e.clientX - shapeDragState.cx);
        const deg = (angle - shapeDragState.startAngle) * 180 / Math.PI;
        const rot = (shapeDragState.startRotation + deg) % 360;
        const snapped = Math.round(rot / 15) * 15;
        shapeEl.style.transform = 'rotate(' + snapped + 'deg)';
        return;
      }

      if (h === 'line-end' || h === 'line-start') {
        const sr = slides[shapeDragState.idx].getBoundingClientRect();
        const mxPct = (e.clientX - sr.left) / sr.width * 100;
        const myPct = (e.clientY - sr.top) / sr.height * 100;
        let x1, y1, x2, y2;
        if (h === 'line-end') {
          x1 = shapeDragState.startL;
          y1 = shapeDragState.startT;
          x2 = mxPct;
          y2 = myPct;
        } else {
          const angleRad = shapeDragState.startRotation * Math.PI / 180;
          x2 = shapeDragState.startL + shapeDragState.startW * Math.cos(angleRad);
          y2 = shapeDragState.startT + shapeDragState.startW * Math.sin(angleRad);
          x1 = mxPct;
          y1 = myPct;
        }
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
        shapeEl.style.left = x1 + '%';
        shapeEl.style.top = y1 + '%';
        shapeEl.style.width = Math.max(dist, 0.1) + '%';
        shapeEl.style.transform = 'rotate(' + angleDeg + 'deg)';
        return;
      }

      const dx = e.clientX - shapeDragState.startX;
      const dy = e.clientY - shapeDragState.startY;

      if (h === 'move' && !shapeDragState.active) {
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
        shapeDragState.active = true;
      }

      let x = shapeDragState.startL;
      let y = shapeDragState.startT;
      let w = shapeDragState.startW;
      let hh = shapeDragState.startH;
      const min = 20;

      const sides = {
        'e':  () => { w = Math.max(min, shapeDragState.startW + dx); },
        'w':  () => { const dw = Math.min(shapeDragState.startW - min, dx); x = shapeDragState.startL + dw; w = shapeDragState.startW - dw; },
        's':  () => { hh = Math.max(min, shapeDragState.startH + dy); },
        'n':  () => { const dh = Math.min(shapeDragState.startH - min, dy); y = shapeDragState.startT + dh; hh = shapeDragState.startH - dh; },
        'ne': () => { w = Math.max(min, shapeDragState.startW + dx); const dh = Math.min(shapeDragState.startH - min, dy); y = shapeDragState.startT + dh; hh = shapeDragState.startH - dh; },
        'nw': () => { const dw = Math.min(shapeDragState.startW - min, dx); x = shapeDragState.startL + dw; w = shapeDragState.startW - dw; const dh = Math.min(shapeDragState.startH - min, dy); y = shapeDragState.startT + dh; hh = shapeDragState.startH - dh; },
        'se': () => { w = Math.max(min, shapeDragState.startW + dx); hh = Math.max(min, shapeDragState.startH + dy); },
        'sw': () => { const dw = Math.min(shapeDragState.startW - min, dx); x = shapeDragState.startL + dw; w = shapeDragState.startW - dw; hh = Math.max(min, shapeDragState.startH + dy); },
        'move': () => { x = shapeDragState.startL + dx; y = shapeDragState.startT + dy; }
      };
      if (sides[h]) sides[h]();

      shapeEl.style.left = x + 'px';
      shapeEl.style.top = y + 'px';
      shapeEl.style.width = w + 'px';
      shapeEl.style.height = hh + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (lineDrawState && lineDrawState.active) {
        finishLineDraw();
        return;
      }
      if (!shapeDragState) return;
      if (shapeDragState.idx !== current) { shapeDragState = null; return; }
      const slideEl = slides[shapeDragState.idx];
      if (!slideEl) { shapeDragState = null; return; }
      const shapeEl = slideEl.querySelector('.shape[data-shape-id="' + shapeDragState.shapeId + '"]');
      if (!shapeEl) { shapeDragState = null; return; }
      const shape = getShapeById(shapeDragState.idx, shapeDragState.shapeId);
      if (!shape) { shapeDragState = null; return; }

      if (shapeDragState.handle === 'rotate') {
        const match = shapeEl.style.transform.match(/rotate\(([-\d.]+)deg\)/);
        if (match) {
          shape.rotation = parseFloat(match[1]) || 0;
          shapeRotation.value = shape.rotation;
          if (shapeRotationSlider) shapeRotationSlider.value = shape.rotation;
        }
      } else if (shapeDragState.handle === 'line-start' || shapeDragState.handle === 'line-end') {
        const sw = slideEl.offsetWidth;
        const sh = slideEl.offsetHeight;
        shape.x = (shapeEl.offsetLeft / sw * 100) + '%';
        shape.y = (shapeEl.offsetTop / sh * 100) + '%';
        shape.w = (shapeEl.offsetWidth / sw * 100) + '%';
        const match = shapeEl.style.transform.match(/rotate\(([-\d.]+)deg\)/);
        shape.rotation = match ? parseFloat(match[1]) : 0;
        shapeEl.style.left = shape.x;
        shapeEl.style.top = shape.y;
        shapeEl.style.width = shape.w;
        shapeEl.style.transform = shape.rotation ? 'rotate(' + shape.rotation + 'deg)' : '';
      } else {
        const sw = slideEl.offsetWidth;
        const sh = slideEl.offsetHeight;
        shape.x = (shapeEl.offsetLeft / sw * 100) + '%';
        shape.y = (shapeEl.offsetTop / sh * 100) + '%';
        shape.w = (shapeEl.offsetWidth / sw * 100) + '%';
        shape.h = (shapeEl.offsetHeight / sh * 100) + '%';
        shapeEl.style.left = shape.x;
        shapeEl.style.top = shape.y;
        shapeEl.style.width = shape.w;
        shapeEl.style.height = shape.h;
      }

      shapeDragState = null;
      saveToServer();
    });

    // ---- Float shape button & popup ----
    const shapeFloatBtn = document.getElementById('shapeFloatBtn');
    const shapePopup = document.getElementById('shapePopup');
    shapeFloatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      shapePopup.classList.toggle('show');
    });
    shapePopup.querySelectorAll('.shape-popup-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = btn.dataset.shape;
        if (type === 'line' || type === 'arrow') {
          lineDrawState = { type, active: false };
          if (selectedShapeEl) {
            selectedShapeEl.classList.remove('selected');
            selectedShapeEl = null;
            hideShapeProps();
          }
          slides[current].style.cursor = 'crosshair';
          shapePopup.classList.remove('show');
          return;
        }
        addShapeToSlide(type);
        shapePopup.classList.remove('show');
      });
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#shapeFloatBtn') && !e.target.closest('.shape-popup')) {
        shapePopup.classList.remove('show');
      }
    });

    // ---- Integrate shapes into save/load ----
    const origSave = saveToServer;
    saveToServer = async function () {
      const kv = {
        count: slides.length,
        urls: { ...slideUrls },
        resize: { ...resizeData },
        mode: { ...slideMode },
        names: { ...slideNames },
        bgColors: { ...slideBgColors },
        notes: { ...slideNotes },
        shapes: { ...slideShapes },
        apiUrl: apiBaseUrl
      };
      try {
        const resp = await fetch(resolveUrl('/api/data/' + encodeURIComponent(deckName)), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kv })
        });
        if (!resp.ok) return;
        const result = await resp.json();
        if (result.kv && result.kv.urls) slideUrls = result.kv.urls;
      } catch (_) { showToast('Failed to save deck'); }
    };

    // Load shapes from server (initial loadFromServer ran before our override)
    try {
      const resp = await fetch(resolveUrl('/api/data/' + encodeURIComponent(deckName)));
      if (resp.ok) {
        const kv = (await resp.json()).kv || {};
        slideShapes = kv.shapes || {};
      }
    } catch (_) {}

    // ---- Integrate shapes into slide operations ----
    const origAddSlide = addSlide;
    addSlide = function () {
      origAddSlide();
      renderShapes(slides.length - 1);
    };

    const _origRemoveSlide = removeSlide;
    removeSlide = function (index) {
      delete slideShapes[index];
      _origRemoveSlide(index);
      const reindexed = {};
      slides.forEach((_, i) => {
        if (slideShapes[i] !== undefined) reindexed[i] = slideShapes[i];
        else if (slideShapes[i + 1] !== undefined) reindexed[i] = slideShapes[i + 1];
      });
      slideShapes = reindexed;
      renderAllShapes();
    };

    const origDuplicateSlide = duplicateSlide;
    duplicateSlide = function (index) {
      const idx = index + 1;
      origDuplicateSlide(index);
      if (slideShapes[index]) {
        slideShapes[idx] = slideShapes[index].map(s => ({ ...s, id: 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) }));
      }
      renderShapes(idx);
    };

    const origReorder = reorderSlides;
    reorderSlides = function (fromIdx, toIdx) {
      const shapesInOrder = slides.map((_, i) => slideShapes[i] || null);
      const [movedShapes] = shapesInOrder.splice(fromIdx, 1);
      shapesInOrder.splice(toIdx, 0, movedShapes);
      origReorder(fromIdx, toIdx);
      slideShapes = {};
      shapesInOrder.forEach((sh, i) => { if (sh) slideShapes[i] = sh; });
      renderAllShapes();
    };

    // Clean up selection on slide change
    const origShapeUpdate = update;
    update = function () {
      origShapeUpdate();
      if (selectedShapeEl) {
        const slideEl = selectedShapeEl.closest('.slide');
        if (!slideEl || !slideEl.classList.contains('active')) {
          selectedShapeEl.classList.remove('selected');
          selectedShapeEl = null;
          hideShapeProps();
        }
      }
    };

    slides.forEach(el => { setupSlideDrop(el); setupResize(el); });

    createDots();
    applyAllImages();
    rebuildThumbnails();
    renderAllShapes();
    update();

    const skeletonSlide = document.getElementById('skeletonSlide');
    if (skeletonSlide) skeletonSlide.classList.add('skeleton-hidden');

    if (window.innerWidth <= 900) {
      sidebar.classList.add('collapsed');
    }

  })();
