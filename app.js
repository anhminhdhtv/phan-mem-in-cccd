// State Management
let pairs = [];
let selectedSide = { pairId: null, side: null };
let activeUploadTarget = null; // { pairState, side }

const PREVIEW_DPI = 96; // 1 inch = 96px in screen representation
const CM_TO_INCH = 0.393700787;
const CM_TO_TWIPS = 566.929; // 1 cm = 566.929 twips (dxa)

// DOM Elements
const paperSizeSelect = document.getElementById('paperSize');
const clearAllBtn = document.getElementById('clearAllBtn');
const exportWordBtn = document.getElementById('exportWordBtn');
const printBtn = document.getElementById('printBtn');
const globalDropzone = document.getElementById('globalDropzone');
const globalFileInput = document.getElementById('globalFileInput');
const slotFileInput = document.getElementById('slotFileInput');
const simulatedPaper = document.getElementById('simulatedPaper');
const previewPaperLabel = document.getElementById('previewPaperLabel');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');

// Duplicate & Sync Elements
const duplicatePair1Btn = document.getElementById('duplicatePair1Btn');
const syncPair1Checkbox = document.getElementById('syncPair1Checkbox');


// Centralized Editor Elements
const editorEmptyState = document.getElementById('editorEmptyState');
const editorActiveState = document.getElementById('editorActiveState');
const editorTitleLabel = document.getElementById('editorTitleLabel');
const editorSwapBtn = document.getElementById('editorSwapBtn');
const editorOriginalImage = document.getElementById('editorOriginalImage');
const editorPerspectiveContent = document.getElementById('editorPerspectiveContent');
const editorPolygon = document.getElementById('editorPolygon');
const editorRotateLeftBtn = document.getElementById('editorRotateLeftBtn');
const editorRotateRightBtn = document.getElementById('editorRotateRightBtn');
const editorZoomInBtn = document.getElementById('editorZoomInBtn');
const editorZoomOutBtn = document.getElementById('editorZoomOutBtn');
const editorZoomValue = document.getElementById('editorZoomValue');
const editorRemoveImgBtn = document.getElementById('editorRemoveImgBtn');
const editorPinTL = document.getElementById('editorPinTL');
const editorPinTR = document.getElementById('editorPinTR');
const editorPinBR = document.getElementById('editorPinBR');
const editorPinBL = document.getElementById('editorPinBL');

// Initialize Theme
let currentTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', currentTheme);
updateThemeUI();

// OpenCV.js Auto Detection Setup
window.cvReady = false;
function checkOpenCV() {
  if (window.cv && window.cv.Mat) {
    onOpenCvRuntimeInitialized();
  } else {
    setTimeout(checkOpenCV, 100);
  }
}
checkOpenCV();

function onOpenCvRuntimeInitialized() {
  window.cvReady = true;
  const opencvStatus = document.getElementById('opencvStatus');
  if (opencvStatus) {
    opencvStatus.className = 'text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg flex items-center gap-2';
    opencvStatus.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
      <span>Cân phẳng thủ công (OpenCV) Sẵn sàng</span>
    `;
  }
  showToast('Hệ thống', 'Bộ nhận diện góc nghiêng OpenCV đã sẵn sàng!', 'success');
}

themeToggle.addEventListener('click', () => {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem('theme', currentTheme);
  updateThemeUI();
});

function updateThemeUI() {
  if (currentTheme === 'dark') {
    themeIcon.className = 'fa-solid fa-sun';
    document.body.classList.remove('bg-slate-50', 'text-slate-900');
    document.body.classList.add('bg-slate-950', 'text-slate-100');
  } else {
    themeIcon.className = 'fa-solid fa-moon';
    document.body.classList.remove('bg-slate-950', 'text-slate-100');
    document.body.classList.add('bg-slate-50', 'text-slate-900');
  }
}

// Preset Sizes Mapping (Width x Height in cm)
const PRESETS = {
  standard: { w: 8.56, h: 5.398 },
  medium: { w: 10.0, h: 6.3 },
  large: { w: 12.0, h: 7.5 }
};

// Event Listeners for settings
paperSizeSelect.addEventListener('change', () => {
  enforceLimits();
  updatePaperLabel();
  updateLivePreview();
});

function updatePaperLabel() {
  previewPaperLabel.textContent = paperSizeSelect.value;
}

// Global drag & drop
globalDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  globalDropzone.classList.add('dragover');
});
globalDropzone.addEventListener('dragleave', () => {
  globalDropzone.classList.remove('dragover');
});
globalDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  globalDropzone.classList.remove('dragover');
  if (e.dataTransfer.files) {
    handleUploadedFiles(e.dataTransfer.files);
  }
});
globalFileInput.addEventListener('change', (e) => {
  if (e.target.files) {
    handleUploadedFiles(e.target.files);
    globalFileInput.value = ''; // Reset file input
  }
});

// Slot-specific upload listener
slotFileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0] && activeUploadTarget) {
    const { pairState, side } = activeUploadTarget;
    loadCardImage(pairState, side, e.target.files[0]);
    slotFileInput.value = ''; // reset
    activeUploadTarget = null;
  }
});

clearAllBtn.addEventListener('click', () => {
  const hasImages = pairs.some(p => p.front.originalSrc || p.back.originalSrc);
  if (!hasImages) return;
  if (confirm('Bạn có chắc chắn muốn xóa toàn bộ danh sách ảnh CCCD?')) {
    clearAllPairs();
  }
});

exportWordBtn.addEventListener('click', exportToWord);

if (printBtn) {
  printBtn.addEventListener('click', () => {
    const hasImages = pairs.some(p => p.front.croppedDataUrl || p.back.croppedDataUrl);
    if (!hasImages) {
      showToast('Lỗi', 'Không có hình ảnh đã cắt để in. Vui lòng thêm và căn chỉnh ảnh trước.', 'error');
      return;
    }
    window.print();
  });
}

// Handle multiple file uploads and fill slots sequentially
async function handleUploadedFiles(fileList) {
  const imageFiles = Array.from(fileList).filter(file => file.type.startsWith('image/'));
  if (imageFiles.length === 0) {
    showToast('Cảnh báo', 'Vui lòng chỉ chọn các tệp tin hình ảnh.', 'warning');
    return;
  }

  imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  showToast('Đang tải ảnh', `Đang xử lý ${imageFiles.length} hình ảnh...`, 'info');

  let filledCount = 0;
  for (let i = 0; i < imageFiles.length; i++) {
    const success = await fillNextEmptySlot(imageFiles[i]);
    if (!success) {
      showToast('Giới hạn', `Đã điền đầy tất cả các khung hình hiện có trên khổ giấy.`, 'warning');
      break;
    }
    filledCount++;
  }
  
  updateLivePreview();
  
  if (filledCount > 0) {
    let lastPair = null;
    let lastSide = null;
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      if (pair.front.originalSrc) {
        lastPair = pair;
        lastSide = 'front';
      }
      if (pair.back.originalSrc) {
        lastPair = pair;
        lastSide = 'back';
      }
    }
    if (lastPair && lastSide) {
      selectedSide = { pairId: lastPair.id, side: lastSide };
      updateLivePreview();
      loadEditor(lastPair, lastSide);
    }
  }
}

async function fillNextEmptySlot(file) {
  const isSyncEnabled = syncPair1Checkbox && syncPair1Checkbox.checked;
  for (let i = 0; i < pairs.length; i++) {
    if (isSyncEnabled && i > 0) {
      break;
    }
    const pair = pairs[i];
    if (!pair.front.originalSrc) {
      await loadCardImageAsync(pair, 'front', file);
      return true;
    }
    if (!pair.back.originalSrc) {
      await loadCardImageAsync(pair, 'back', file);
      return true;
    }
  }
  return false;
}

function loadCardImageAsync(pairState, side, file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      pairState[side].originalSrc = e.target.result;
      pairState[side].croppedDataUrl = null;
      pairState[side].pins = null;
      pairState[side].zoom = 100;
      
      const img = new Image();
      img.onload = function() {
        const w_n = img.naturalWidth;
        const h_n = img.naturalHeight;
        
        let detectedCorners = null;
        if (window.cvReady) {
          detectedCorners = detectCardCornersOpenCV(img);
        }
        
        if (detectedCorners) {
          pairState[side].pins = {
            tl: { x: detectedCorners[0].x, y: detectedCorners[0].y },
            tr: { x: detectedCorners[1].x, y: detectedCorners[1].y },
            br: { x: detectedCorners[2].x, y: detectedCorners[2].y },
            bl: { x: detectedCorners[3].x, y: detectedCorners[3].y }
          };
        } else {
          const insetX = w_n * 0.15;
          const insetY = h_n * 0.15;
          pairState[side].pins = {
            tl: { x: insetX, y: insetY },
            tr: { x: w_n - insetX, y: insetY },
            br: { x: w_n - insetX, y: h_n - insetY },
            bl: { x: insetX, y: h_n - insetY }
          };
        }
        
        warpCard(pairState, side).then(() => {
          if (pairState === pairs[0]) {
            syncPair1ToOthers();
          }
          resolve();
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function loadCardImage(pairState, side, file) {
  if (!file.type.startsWith('image/')) {
    showToast('Lỗi', 'Chỉ được tải lên tệp tin hình ảnh.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    if (pairState[side].originalSrc) {
      try { URL.revokeObjectURL(pairState[side].originalSrc); } catch(err) {}
    }
    
    pairState[side].originalSrc = e.target.result;
    pairState[side].croppedDataUrl = null;
    pairState[side].pins = null;
    pairState[side].zoom = 100;
    
    selectedSide = { pairId: pairState.id, side: side };
    
    if (pairState === pairs[0]) {
      syncPair1ToOthers();
    }
    
    updateLivePreview();
    loadEditor(pairState, side);
  };
  reader.readAsDataURL(file);
}

function enforceLimits() {
  const paperSize = paperSizeSelect.value;
  const targetPairs = paperSize === 'A5' ? 2 : 4;
  
  let needsSync = false;
  if (pairs.length > targetPairs) {
    const remainingIds = pairs.slice(0, targetPairs).map(p => p.id);
    if (selectedSide.pairId && !remainingIds.includes(selectedSide.pairId)) {
      resetEditor();
    }
    for (let i = targetPairs; i < pairs.length; i++) {
      const p = pairs[i];
      if (p.front.originalSrc) URL.revokeObjectURL(p.front.originalSrc);
      if (p.back.originalSrc) URL.revokeObjectURL(p.back.originalSrc);
    }
    pairs = pairs.slice(0, targetPairs);
  } else {
    if (pairs.length < targetPairs) {
      needsSync = true;
    }
    while (pairs.length < targetPairs) {
      pairs.push({
        id: 'pair_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        front: { originalSrc: null, croppedDataUrl: null, zoom: 100, pins: null },
        back: { originalSrc: null, croppedDataUrl: null, zoom: 100, pins: null }
      });
    }
  }
  
  if (needsSync && syncPair1Checkbox && syncPair1Checkbox.checked) {
    syncPair1ToOthers();
  }
}

function clearAllPairs() {
  if (syncPair1Checkbox) syncPair1Checkbox.checked = false;
  pairs.forEach(p => {
    if (p.front.originalSrc) {
      try { URL.revokeObjectURL(p.front.originalSrc); } catch(e) {}
    }
    if (p.back.originalSrc) {
      try { URL.revokeObjectURL(p.back.originalSrc); } catch(e) {}
    }
    p.front = { originalSrc: null, croppedDataUrl: null, zoom: 100, pins: null };
    p.back = { originalSrc: null, croppedDataUrl: null, zoom: 100, pins: null };
  });
  resetEditor();
  updateLivePreview();
  showToast('Xóa tất cả', 'Đã xóa toàn bộ ảnh thẻ CCCD.', 'success');
}

function resetEditor() {
  selectedSide = { pairId: null, side: null };
  editorActiveState.classList.add('hidden');
  editorEmptyState.classList.remove('hidden');
  editorOriginalImage.src = '';
  editorPolygon.setAttribute('points', '');
}

function loadEditor(pairState, side) {
  editorEmptyState.classList.add('hidden');
  editorActiveState.classList.remove('hidden');
  
  const pairIndex = pairs.indexOf(pairState) + 1;
  const sideText = side === 'front' ? 'Mặt Trước' : 'Mặt Sau';
  editorTitleLabel.textContent = `Cặp #${pairIndex} - ${sideText}`;
  
  editorOriginalImage.src = pairState[side].originalSrc;
  
  editorOriginalImage.onload = function() {
    const w_n = editorOriginalImage.naturalWidth;
    const h_n = editorOriginalImage.naturalHeight;
    if (!w_n || !h_n) return;
    
    const container = editorPerspectiveContent;
    const w_c = container.clientWidth;
    const h_c = container.clientHeight;
    
    const bounds = getCurrentImageBounds(container, editorOriginalImage);
    
    const zoomVal = pairState[side].zoom || 100;
    editorZoomValue.textContent = `${zoomVal}%`;
    container.style.width = `${zoomVal}%`;
    container.style.height = `${zoomVal}%`;
    
    const wrap = container.parentNode;
    wrap.scrollLeft = 0;
    wrap.scrollTop = 0;
    
    if (!pairState[side].pins) {
      let detectedCorners = null;
      if (window.cvReady) {
        detectedCorners = detectCardCornersOpenCV(editorOriginalImage);
      }
      
      if (detectedCorners) {
        pairState[side].pins = {
          tl: { x: detectedCorners[0].x, y: detectedCorners[0].y },
          tr: { x: detectedCorners[1].x, y: detectedCorners[1].y },
          br: { x: detectedCorners[2].x, y: detectedCorners[2].y },
          bl: { x: detectedCorners[3].x, y: detectedCorners[3].y }
        };
      } else {
        const insetX = w_n * 0.15;
        const insetY = h_n * 0.15;
        pairState[side].pins = {
          tl: { x: insetX, y: insetY },
          tr: { x: w_n - insetX, y: insetY },
          br: { x: w_n - insetX, y: h_n - insetY },
          bl: { x: insetX, y: h_n - insetY }
        };
      }
    }
    
    updateEditorPinsUI(pairState, side);
    
    if (!pairState[side].croppedDataUrl) {
      warpCardWithPins(pairState, side);
    }
    
    editorOriginalImage.onload = null;
  };
}

function updateEditorPinsUI(pairState, side) {
  const container = editorPerspectiveContent;
  const w_c = container.clientWidth;
  const h_c = container.clientHeight;
  const w_n = editorOriginalImage.naturalWidth;
  const h_n = editorOriginalImage.naturalHeight;
  
  if (!w_n || !h_n) return;
  
  const bounds = getCurrentImageBounds(container, editorOriginalImage);
  const itemPins = pairState[side].pins;
  
  const pinTL = document.getElementById('editorPinTL');
  const pinTR = document.getElementById('editorPinTR');
  const pinBR = document.getElementById('editorPinBR');
  const pinBL = document.getElementById('editorPinBL');
  
  function setPinStyle(pinEl, naturalPt) {
    const px = (naturalPt.x / w_n) * bounds.width + bounds.left;
    const py = (naturalPt.y / h_n) * bounds.height + bounds.top;
    pinEl.style.left = `${(px / w_c) * 100}%`;
    pinEl.style.top = `${(py / h_c) * 100}%`;
  }
  
  setPinStyle(pinTL, itemPins.tl);
  setPinStyle(pinTR, itemPins.tr);
  setPinStyle(pinBR, itemPins.br);
  setPinStyle(pinBL, itemPins.bl);
  
  updateEditorPolygonOverlay();
}

function updateEditorPolygonOverlay() {
  const container = editorPerspectiveContent;
  const w = container.clientWidth;
  const h = container.clientHeight;
  
  const pinTL = document.getElementById('editorPinTL');
  const pinTR = document.getElementById('editorPinTR');
  const pinBR = document.getElementById('editorPinBR');
  const pinBL = document.getElementById('editorPinBL');
  
  const p_tl = { x: parseFloat(pinTL.style.left) / 100 * w, y: parseFloat(pinTL.style.top) / 100 * h };
  const p_tr = { x: parseFloat(pinTR.style.left) / 100 * w, y: parseFloat(pinTR.style.top) / 100 * h };
  const p_br = { x: parseFloat(pinBR.style.left) / 100 * w, y: parseFloat(pinBR.style.top) / 100 * h };
  const p_bl = { x: parseFloat(pinBL.style.left) / 100 * w, y: parseFloat(pinBL.style.top) / 100 * h };
  
  editorPolygon.setAttribute('points', `${p_tl.x},${p_tl.y} ${p_tr.x},${p_tr.y} ${p_br.x},${p_br.y} ${p_bl.x},${p_bl.y}`);
}

function setupEditorPinsDragHandlers() {
  const pins = {
    tl: document.getElementById('editorPinTL'),
    tr: document.getElementById('editorPinTR'),
    br: document.getElementById('editorPinBR'),
    bl: document.getElementById('editorPinBL')
  };
  
  Object.keys(pins).forEach(pinName => {
    makeEditorPinDraggable(pins[pinName], pinName);
  });
}

function makeEditorPinDraggable(pinEl, pinName) {
  let isDragging = false;
  let startX = 0, startY = 0;
  let startLeft = 0, startTop = 0;
  
  function onStart(e) {
    e.preventDefault();
    if (!selectedSide.pairId) return;
    
    isDragging = true;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    startX = clientX;
    startY = clientY;
    startLeft = parseFloat(pinEl.style.left) || 0;
    startTop = parseFloat(pinEl.style.top) || 0;
    
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }
  
  function onMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    
    const activePair = pairs.find(p => p.id === selectedSide.pairId);
    if (!activePair) return;
    const activeItem = activePair[selectedSide.side];
    
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    const container = editorPerspectiveContent;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    const dx = clientX - startX;
    const dy = clientY - startY;

    let newLeftPx = (startLeft / 100 * containerWidth) + dx;
    let newTopPx = (startTop / 100 * containerHeight) + dy;
    
    const bounds = getCurrentImageBounds(container, editorOriginalImage);
    
    newLeftPx = Math.max(bounds.left, Math.min(bounds.left + bounds.width, newLeftPx));
    newTopPx = Math.max(bounds.top, Math.min(bounds.top + bounds.height, newTopPx));
    
    pinEl.style.left = `${(newLeftPx / containerWidth) * 100}%`;
    pinEl.style.top = `${(newTopPx / containerHeight) * 100}%`;
    
    const w_n = editorOriginalImage.naturalWidth;
    const h_n = editorOriginalImage.naturalHeight;
    let img_x = (newLeftPx - bounds.left) / bounds.width * w_n;
    let img_y = (newTopPx - bounds.top) / bounds.height * h_n;
    img_x = Math.max(0, Math.min(w_n, img_x));
    img_y = Math.max(0, Math.min(h_n, img_y));
    
    console.log(`Pin ${pinName} moved. Screen distance: dx=${dx}, dy=${dy}. Natural mapped coord: (${img_x}, ${img_y}) relative to natural size (${w_n}x${h_n}). Bounds info:`, bounds);
    
    if (!activeItem.pins) activeItem.pins = {};
    activeItem.pins[pinName] = { x: img_x, y: img_y };
    
    updateEditorPolygonOverlay();
  }
  
  function onEnd() {
    if (isDragging) {
      isDragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      
      const activePair = pairs.find(p => p.id === selectedSide.pairId);
      if (activePair) {
        warpCardWithPins(activePair, selectedSide.side);
      }
    }
  }
  
  pinEl.addEventListener('mousedown', onStart);
  pinEl.addEventListener('touchstart', onStart, { passive: false });
}

function getCurrentImageBounds(container, img) {
  const containerW = container.clientWidth;
  const containerH = container.clientHeight;
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  
  if (!imgW || !imgH) {
    return { left: 0, top: 0, width: containerW, height: containerH };
  }
  
  const containerRatio = containerW / containerH;
  const imgRatio = imgW / imgH;
  
  let w, h, x, y;
  if (imgRatio > containerRatio) {
    w = containerW;
    h = containerW / imgRatio;
    x = 0;
    y = (containerH - h) / 2;
  } else {
    h = containerH;
    w = containerH * imgRatio;
    x = (containerW - w) / 2;
    y = 0;
  }
  
  return { left: x, top: y, width: w, height: h };
}

function rotateActiveImage(degree) {
  if (!selectedSide.pairId) return;
  const activePair = pairs.find(p => p.id === selectedSide.pairId);
  const activeItem = activePair[selectedSide.side];
  if (!activeItem.originalSrc) return;
  
  showToast('Xử lý ảnh', 'Đang xoay ảnh...', 'info');
  rotateImageData(activeItem.originalSrc, degree, (rotatedDataUrl) => {
    activeItem.originalSrc = rotatedDataUrl;
    activeItem.pins = null;
    activeItem.croppedDataUrl = null;
    loadEditor(activePair, selectedSide.side);
  });
}

function adjustEditorZoom(delta) {
  if (!selectedSide.pairId) return;
  const activePair = pairs.find(p => p.id === selectedSide.pairId);
  const activeItem = activePair[selectedSide.side];
  const oldZoom = activeItem.zoom || 100;
  
  let zoom = oldZoom + delta;
  zoom = Math.max(100, Math.min(400, zoom));
  
  if (zoom !== oldZoom) {
    activeItem.zoom = zoom;
    editorZoomValue.textContent = `${zoom}%`;
    
    const container = editorPerspectiveContent;
    const wrap = container.parentNode;
    const mouseX = wrap.clientWidth / 2;
    const mouseY = wrap.clientHeight / 2;
    const contentX = wrap.scrollLeft + mouseX;
    const contentY = wrap.scrollTop + mouseY;

    container.style.width = `${zoom}%`;
    container.style.height = `${zoom}%`;
    updateEditorPinsUI(activePair, selectedSide.side);

    const ratio = zoom / oldZoom;
    wrap.scrollLeft = (contentX * ratio) - mouseX;
    wrap.scrollTop = (contentY * ratio) - mouseY;
    if (activePair === pairs[0]) {
      syncPair1ToOthers();
    }
  }
}

function warpCardWithPins(pairState, side) {
  warpCard(pairState, side).then(() => {
    if (pairState === pairs[0]) {
      syncPair1ToOthers();
    }
    updateLivePreview();
  });
}

function warpCard(pairState, side) {
  return new Promise((resolve) => {
    const item = pairState[side];
    if (!item.originalSrc || !item.pins) {
      resolve();
      return;
    }
    
    const img = new Image();
    img.onload = function() {
      const w_n = img.naturalWidth;
      const h_n = img.naturalHeight;
      if (!w_n || !h_n) {
        resolve();
        return;
      }
      
      const p1 = item.pins.tl;
      const p2 = item.pins.tr;
      const p3 = item.pins.br;
      const p4 = item.pins.bl;
      
      // Fallback: standard 2D rectangular crop if OpenCV is not loaded
      if (!window.cvReady) {
        console.log("Fallback crop running. Pins:", JSON.stringify(item.pins));
        const xs = [p1.x, p2.x, p3.x, p4.x];
        const ys = [p1.y, p2.y, p3.y, p4.y];
        const minX = Math.max(0, Math.min(...xs));
        const maxX = Math.min(w_n, Math.max(...xs));
        const minY = Math.max(0, Math.min(...ys));
        const maxY = Math.min(h_n, Math.max(...ys));
        
        const cropW = maxX - minX;
        const cropH = maxY - minY;
        console.log("Calculated boundaries:", { minX, maxX, minY, maxY, cropW, cropH, w_n, h_n });
        
        const canvas = document.createElement('canvas');
        canvas.width = 856;
        canvas.height = 540;
        const ctx = canvas.getContext('2d');
        
        if (cropW > 0 && cropH > 0) {
          ctx.drawImage(img, minX, minY, cropW, cropH, 0, 0, 856, 540);
        } else {
          console.warn("Fallback crop skipped (invalid size), drawing full image.");
          ctx.drawImage(img, 0, 0, w_n, h_n, 0, 0, 856, 540);
        }
        
        item.croppedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        resolve();
        return;
      }
      
      // Proceed with OpenCV perspective warp
      const w1 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const w2 = Math.hypot(p3.x - p4.x, p3.y - p4.y);
      const h1 = Math.hypot(p4.x - p1.x, p4.y - p1.y);
      const h2 = Math.hypot(p3.x - p2.x, p3.y - p2.y);
      
      const maxWidth = Math.max(w1, w2);
      const maxHeight = Math.max(h1, h2);
      
      const isVertical = maxWidth < maxHeight;
      const targetWidth = isVertical ? 540 : 856;
      const targetHeight = isVertical ? 856 : 540;
      
      try {
        const cv = window.cv;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w_n;
        tempCanvas.height = h_n;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0);
        
        let src = cv.imread(tempCanvas);
        
        let srcCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
          p1.x, p1.y,
          p2.x, p2.y,
          p3.x, p3.y,
          p4.x, p4.y
        ]);
        
        let dstCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
          0, 0,
          targetWidth, 0,
          targetWidth, targetHeight,
          0, targetHeight
        ]);
        
        let M = cv.getPerspectiveTransform(srcCoords, dstCoords);
        let warped = new cv.Mat();
        let dsize = new cv.Size(targetWidth, targetHeight);
        
        cv.warpPerspective(src, warped, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
        
        let canvas = document.createElement('canvas');
        if (isVertical) {
          canvas.width = 856;
          canvas.height = 540;
          let ctx = canvas.getContext('2d');
          
          let tempCanvasWarped = document.createElement('canvas');
          tempCanvasWarped.width = 540;
          tempCanvasWarped.height = 856;
          cv.imshow(tempCanvasWarped, warped);
          
          ctx.translate(856 / 2, 540 / 2);
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(tempCanvasWarped, -540 / 2, -856 / 2);
        } else {
          canvas.width = 856;
          canvas.height = 540;
          cv.imshow(canvas, warped);
        }
        
        item.croppedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        
        src.delete();
        srcCoords.delete();
        dstCoords.delete();
        M.delete();
        warped.delete();
        
        resolve();
      } catch (error) {
        console.error("Warp error:", error);
        resolve();
      }
    };
    img.src = item.originalSrc;
  });
}

function detectCardCornersOpenCV(imgElement) {
  try {
    const cv = window.cv;
    const tempCanvas = document.createElement('canvas');
    const w_n = imgElement.naturalWidth;
    const h_n = imgElement.naturalHeight;
    tempCanvas.width = w_n;
    tempCanvas.height = h_n;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(imgElement, 0, 0);
    
    let src = cv.imread(tempCanvas);
    
    const maxDimension = 800;
    let scale = 1;
    if (src.cols > maxDimension || src.rows > maxDimension) {
      scale = maxDimension / Math.max(src.cols, src.rows);
    }
    
    let srcResized = new cv.Mat();
    if (scale !== 1) {
      let dsize = new cv.Size(src.cols * scale, src.rows * scale);
      cv.resize(src, srcResized, dsize, 0, 0, cv.INTER_AREA);
    } else {
      srcResized = src.clone();
    }
    
    let gray = new cv.Mat();
    cv.cvtColor(srcResized, gray, cv.COLOR_RGBA2GRAY);
    
    let blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    
    let edges = new cv.Mat();
    cv.Canny(blurred, edges, 50, 150);
    
    let dMat = cv.Mat.ones(3, 3, cv.CV_8U);
    cv.dilate(edges, edges, dMat);
    dMat.delete();
    
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    
    let maxArea = 0;
    let bestRect = null;
    
    const imgArea = srcResized.cols * srcResized.rows;
    const minArea = imgArea * 0.05;
    
    for (let i = 0; i < contours.size(); ++i) {
      let cnt = contours.get(i);
      let rect = cv.minAreaRect(cnt);
      let w = rect.size.width;
      let h = rect.size.height;
      
      if (w > 0 && h > 0) {
        let area = w * h;
        if (area > minArea) {
          let ratio = w / h;
          let isCardRatio = (ratio >= 1.25 && ratio <= 1.9) || (ratio >= 0.52 && ratio <= 0.8);
          if (isCardRatio && area > maxArea) {
            maxArea = area;
            bestRect = {
              center: { x: rect.center.x, y: rect.center.y },
              size: { width: rect.size.width, height: rect.size.height },
              angle: rect.angle
            };
          }
        }
      }
      cnt.delete();
    }
    
    src.delete();
    srcResized.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
    
    if (bestRect) {
      let angle = bestRect.angle * Math.PI / 180;
      let width = bestRect.size.width;
      let height = bestRect.size.height;
      let center = bestRect.center;

      let dx = Math.cos(angle);
      let dy = Math.sin(angle);

      let p1 = { x: center.x - (width/2)*dx + (height/2)*dy, y: center.y - (width/2)*dy - (height/2)*dx };
      let p2 = { x: center.x + (width/2)*dx + (height/2)*dy, y: center.y + (width/2)*dy - (height/2)*dx };
      let p3 = { x: center.x + (width/2)*dx - (height/2)*dy, y: center.y + (width/2)*dy + (height/2)*dx };
      let p4 = { x: center.x - (width/2)*dx - (height/2)*dy, y: center.y - (width/2)*dy + (height/2)*dx };

      let pts = [p1, p2, p3, p4].map(p => ({ x: p.x / scale, y: p.y / scale }));
      
      pts.sort((a, b) => (a.x + a.y) - (b.x + b.y));
      const topLeft = pts[0];
      const bottomRight = pts[3];
      
      const remainder = [pts[1], pts[2]];
      remainder.sort((a, b) => (a.y - a.x) - (b.y - b.x));
      const topRight = remainder[0];
      const bottomLeft = remainder[1];
      
      return [topLeft, topRight, bottomRight, bottomLeft];
    }
  } catch (err) {
    console.error("OpenCV corners detection error:", err);
  }
  return null;
}

function rotateImageData(srcDataUrl, degree, callback) {
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    
    if (degree === 90 || degree === -90 || degree === 270) {
      canvas.width = h;
      canvas.height = w;
    } else {
      canvas.width = w;
      canvas.height = h;
    }
    
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(degree * Math.PI / 180);
    ctx.drawImage(img, -w / 2, -h / 2);
    
    callback(canvas.toDataURL('image/jpeg', 0.95));
  };
  img.src = srcDataUrl;
}

function updatePrintPageStyle() {
  let styleEl = document.getElementById('print-page-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'print-page-style';
    document.head.appendChild(styleEl);
  }
  
  const paperSize = paperSizeSelect.value;
  styleEl.innerHTML = `
    @media print {
      @page {
        size: ${paperSize === 'A5' ? 'A5 landscape' : 'A4 portrait'};
        margin: 0.8cm;
      }
    }
  `;
}

function updateLivePreview() {
  updatePrintPageStyle();
  const paperSize = paperSizeSelect.value;
  const paperOrientation = paperSize === 'A5' ? 'landscape' : 'portrait';
  
  const PAPER_DIMENSIONS = {
    A5: { w: 21.0, h: 14.8 },
    A4: { w: 29.7, h: 21.0 }
  };

  const currentPaper = PAPER_DIMENSIONS[paperSize] || PAPER_DIMENSIONS.A5;
  let paperWidth = currentPaper.w;
  let paperHeight = currentPaper.h;

  if (paperOrientation === 'portrait') {
    paperWidth = currentPaper.h;
    paperHeight = currentPaper.w;
  }

  const aspectRatio = paperWidth / paperHeight;
  const layoutPreview = document.getElementById('layoutPreview');
  if (layoutPreview) {
    layoutPreview.style.aspectRatio = aspectRatio.toString();
  }
  simulatedPaper.style.aspectRatio = aspectRatio.toString();
  simulatedPaper.innerHTML = '';

  const cardWidthCm = 8.56;
  const cardHeightCm = 5.4;
  const cardSpacingCm = 2.0;
  const rowSpacingCm = 2.0;

  const marginCm = 0.8;
  const scale = simulatedPaper.clientWidth / paperWidth;

  simulatedPaper.style.padding = `${marginCm * scale}px`;

  enforceLimits();

  pairs.forEach((pair, idx) => {
    const pairWrapper = document.createElement('div');
    pairWrapper.className = 'print-pair-row';
    pairWrapper.style.display = 'flex';
    pairWrapper.style.justifyContent = 'center';
    pairWrapper.style.alignItems = 'center';
    pairWrapper.style.width = '100%';
    pairWrapper.style.marginBottom = `${rowSpacingCm * scale}px`;

    const frontBox = createCardSlotElement(pair, 'front', idx + 1, scale, cardWidthCm, cardHeightCm);
    
    const spacer = document.createElement('div');
    spacer.className = 'print-card-spacer';
    spacer.style.width = `${cardSpacingCm * scale}px`;

    const backBox = createCardSlotElement(pair, 'back', idx + 1, scale, cardWidthCm, cardHeightCm);

    pairWrapper.appendChild(frontBox);
    pairWrapper.appendChild(spacer);
    pairWrapper.appendChild(backBox);
    simulatedPaper.appendChild(pairWrapper);
  });
}

// Window resize observers to keep visual simulation scaled correctly
window.addEventListener('resize', updateLivePreview);
const resizeObserver = new ResizeObserver(() => {
  updateLivePreview();
});
resizeObserver.observe(simulatedPaper);

// Toast alerts helper
function showToast(title, message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastTitle = document.getElementById('toastTitle');
  const toastMsg = document.getElementById('toastMsg');
  const toastIcon = document.getElementById('toastIcon');

  toastTitle.textContent = title;
  toastMsg.textContent = message;

  if (type === 'success') {
    toastIcon.className = 'text-emerald-400 bg-emerald-500/10 p-2 rounded-lg';
    toastIcon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
  } else if (type === 'error') {
    toastIcon.className = 'text-red-400 bg-red-500/10 p-2 rounded-lg';
    toastIcon.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
  } else if (type === 'warning') {
    toastIcon.className = 'text-amber-400 bg-amber-500/10 p-2 rounded-lg';
    toastIcon.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i>';
  } else {
    toastIcon.className = 'text-indigo-400 bg-indigo-500/10 p-2 rounded-lg';
    toastIcon.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
  }

  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

// Helper to convert base64 image data url to ArrayBuffer for docx.js
function base64ToArrayBuffer(base64DataUrl) {
  const base64 = base64DataUrl.split(',')[1];
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate the Word document according to the settings and cropped card data URLs
async function exportToWord() {
  if (pairs.length === 0) {
    showToast('Lỗi', 'Không có dữ liệu CCCD để xuất. Vui lòng thêm ít nhất một cặp CCCD.', 'error');
    return;
  }

  const hasImages = pairs.some(p => p.front.croppedDataUrl || p.back.croppedDataUrl);
  if (!hasImages) {
    showToast('Lỗi', 'Không có hình ảnh đã cắt nào. Vui lòng tải và chọn góc cắt ảnh.', 'error');
    return;
  }

  showToast('Đang khởi tạo', 'Đang tạo tệp Word (.docx)...', 'info');

  try {
    const { Document, Packer, Paragraph, Table, TableRow, TableCell, ImageRun, WidthType, AlignmentType, PageOrientation, BorderStyle } = window.docx;

    const paperSize = paperSizeSelect.value;
    const paperOrientation = paperSize === 'A5' ? 'landscape' : 'portrait';
    const cardWidthCm = 8.56;
    const cardHeightCm = 5.4;
    const cardSpacingCm = 2.0;
    const rowSpacingCm = 2.0;

    // Define dimensions in Twips for A5, A4
    const PAPER_DIMENSIONS_TWIPS = {
      A5: { w: Math.round(21.0 * CM_TO_TWIPS), h: Math.round(14.8 * CM_TO_TWIPS) },
      A4: { w: Math.round(29.7 * CM_TO_TWIPS), h: Math.round(21.0 * CM_TO_TWIPS) }
    };

    const currentPaper = PAPER_DIMENSIONS_TWIPS[paperSize] || PAPER_DIMENSIONS_TWIPS.A5;
    let widthTwips = currentPaper.w;
    let heightTwips = currentPaper.h;

    if (paperOrientation === 'portrait') {
      widthTwips = currentPaper.h;
      heightTwips = currentPaper.w;
    }

    const marginCm = 0.8;
    const marginTwips = Math.round(marginCm * CM_TO_TWIPS);

    const CM_TO_PX = 37.7952;
    const cardWidthPx = Math.round(cardWidthCm * CM_TO_PX);
    const cardHeightPx = Math.round(cardHeightCm * CM_TO_PX);

    const docChildren = [];
    
    docChildren.push(new Paragraph({
      text: "Tài liệu in Căn cước công dân (Ghép Mặt Trước - Mặt Sau)",
      alignment: AlignmentType.CENTER,
      spacing: {
        after: Math.round(1.0 * CM_TO_TWIPS)
      }
    }));

    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      
      if (!pair.front.croppedDataUrl && !pair.back.croppedDataUrl) {
        continue;
      }

      let frontImageRun = null;
      if (pair.front.croppedDataUrl) {
        const frontBuffer = base64ToArrayBuffer(pair.front.croppedDataUrl);
        frontImageRun = new ImageRun({
          data: frontBuffer,
          transformation: {
            width: cardWidthPx,
            height: cardHeightPx
          }
        });
      }

      let backImageRun = null;
      if (pair.back.croppedDataUrl) {
        const backBuffer = base64ToArrayBuffer(pair.back.croppedDataUrl);
        backImageRun = new ImageRun({
          data: backBuffer,
          transformation: {
            width: cardWidthPx,
            height: cardHeightPx
          }
        });
      }

      const cells = [];

      cells.push(new TableCell({
        width: {
          size: Math.round(cardWidthCm * CM_TO_TWIPS),
          type: WidthType.DXA
        },
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE }
        },
        children: [
          new Paragraph({
            children: frontImageRun ? [frontImageRun] : [],
            alignment: AlignmentType.RIGHT
          })
        ]
      }));

      cells.push(new TableCell({
        width: {
          size: Math.round(cardSpacingCm * CM_TO_TWIPS),
          type: WidthType.DXA
        },
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE }
        },
        children: [
          new Paragraph({ text: "" })
        ]
      }));

      cells.push(new TableCell({
        width: {
          size: Math.round(cardWidthCm * CM_TO_TWIPS),
          type: WidthType.DXA
        },
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE }
        },
        children: [
          new Paragraph({
            children: backImageRun ? [backImageRun] : [],
            alignment: AlignmentType.LEFT
          })
        ]
      }));

      const pairTable = new Table({
        alignment: AlignmentType.CENTER,
        width: {
          size: Math.round((cardWidthCm * 2 + cardSpacingCm) * CM_TO_TWIPS),
          type: WidthType.DXA
        },
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE }
        },
        rows: [
          new TableRow({
            children: cells
          })
        ]
      });

      docChildren.push(pairTable);

      if (i < pairs.length - 1) {
        docChildren.push(new Paragraph({
          spacing: {
            after: Math.round(rowSpacingCm * CM_TO_TWIPS)
          }
        }));
      }
    }

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: {
              width: widthTwips,
              height: heightTwips,
            },
            orientation: paperOrientation === 'landscape' ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            margin: {
              top: marginTwips,
              bottom: marginTwips,
              left: marginTwips,
              right: marginTwips
            }
          }
        },
        children: docChildren
      }]
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `cccd_${paperSize}_${paperOrientation}_${Date.now()}.docx`);
      showToast('Thành công', 'Đã tải xuống tệp Word chứa ảnh thẻ.', 'success');
    }).catch(err => {
      console.error(err);
      showToast('Lỗi', 'Không thể biên dịch file Word.', 'error');
    });

  } catch (error) {
    console.error(error);
    showToast('Lỗi hệ thống', 'Có lỗi xảy ra trong quá trình xuất Word.', 'error');
  }
}

function createCardSlotElement(pair, side, index, scale, widthCm, heightCm) {
  const box = document.createElement('div');
  box.style.width = `${widthCm * scale}px`;
  box.style.height = `${heightCm * scale}px`;
  box.style.borderRadius = `${0.1 * scale}px`;
  
  const isSelected = selectedSide.pairId === pair.id && selectedSide.side === side;
  const hasImage = !!pair[side].croppedDataUrl;
  const isSyncEnabled = syncPair1Checkbox && syncPair1Checkbox.checked;
  const isLocked = isSyncEnabled && index > 1;
  
  if (hasImage) {
    box.className = `print-card-placeholder filled-slot ${isSelected ? 'selected' : ''} ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`;
    box.innerHTML = `<img src="${pair[side].croppedDataUrl}" class="w-full h-full object-cover">`;
    if (isLocked) {
      box.style.position = 'relative';
      const badge = document.createElement('div');
      badge.style.position = 'absolute';
      badge.style.top = '4px';
      badge.style.right = '4px';
      badge.style.background = 'rgba(15, 23, 42, 0.8)';
      badge.style.color = '#818cf8';
      badge.style.border = '1px solid rgba(129, 140, 248, 0.2)';
      badge.style.fontSize = '8px';
      badge.style.fontWeight = 'bold';
      badge.style.padding = '2px 6px';
      badge.style.borderRadius = '4px';
      badge.style.pointerEvents = 'none';
      badge.innerHTML = '<i class="fa-solid fa-lock text-[8px] mr-1"></i>Đồng bộ';
      box.appendChild(badge);
    }
  } else {
    box.className = `print-card-placeholder clickable-slot ${isSelected ? 'selected' : ''} ${isLocked ? 'opacity-50 cursor-not-allowed' : ''} flex flex-col items-center justify-center p-2 text-center`;
    const fontSize = Math.max(7, scale * 0.35);
    const iconSize = Math.max(10, scale * 0.5);
    
    const sideLabel = side === 'front' ? 'Mặt Trước' : 'Mặt Sau';
    box.innerHTML = `
      <i class="fa-solid ${isLocked ? 'fa-lock' : 'fa-camera'} mb-1" style="font-size: ${iconSize}px;"></i>
      <span style="font-size: ${fontSize}px; font-weight: 600;">${sideLabel} #${index}</span>
      <span style="font-size: ${fontSize * 0.8}px; opacity: 0.7;">${isLocked ? 'Đồng bộ Cặp #1' : 'Click để thêm'}</span>
    `;
  }
  
  box.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isLocked) {
      showToast('Đồng bộ đang bật', 'Vui lòng chỉnh sửa Cặp #1. Các ô còn lại sẽ tự động đồng bộ.', 'info');
      return;
    }
    if (pair[side].originalSrc) {
      selectedSide = { pairId: pair.id, side: side };
      updateLivePreview();
      loadEditor(pair, side);
    } else {
      activeUploadTarget = { pairState: pair, side: side };
      slotFileInput.click();
    }
  });
  
  return box;
}

function initEditorEvents() {
  setupEditorPinsDragHandlers();
  
  editorSwapBtn.addEventListener('click', () => {
    if (!selectedSide.pairId) return;
    const activePair = pairs.find(p => p.id === selectedSide.pairId);
    if (activePair) {
      const temp = activePair.front;
      activePair.front = activePair.back;
      activePair.back = temp;
      if (activePair === pairs[0]) {
        syncPair1ToOthers();
      }
      updateLivePreview();
      loadEditor(activePair, selectedSide.side);
      showToast('Đã đổi mặt', 'Hoán đổi thành công Mặt Trước & Mặt Sau.', 'success');
    }
  });

  editorRotateLeftBtn.addEventListener('click', () => rotateActiveImage(-90));
  editorRotateRightBtn.addEventListener('click', () => rotateActiveImage(90));

  editorZoomInBtn.addEventListener('click', () => adjustEditorZoom(25));
  editorZoomOutBtn.addEventListener('click', () => adjustEditorZoom(-25));

  editorRemoveImgBtn.addEventListener('click', () => {
    if (!selectedSide.pairId) return;
    const activePair = pairs.find(p => p.id === selectedSide.pairId);
    if (activePair) {
      const side = selectedSide.side;
      if (activePair[side].originalSrc) {
        try { URL.revokeObjectURL(activePair[side].originalSrc); } catch(err) {}
      }
      activePair[side] = { originalSrc: null, croppedDataUrl: null, zoom: 100, pins: null };
      if (activePair === pairs[0]) {
        syncPair1ToOthers();
      }
      resetEditor();
      updateLivePreview();
      showToast('Đã xóa ảnh', 'Đã xóa hình ảnh của mặt này.', 'success');
    }
  });

  const editorPerspectiveWrap = editorPerspectiveContent.parentNode;
  editorPerspectiveWrap.addEventListener('wheel', (e) => {
    if (!selectedSide.pairId) return;
    const activePair = pairs.find(p => p.id === selectedSide.pairId);
    const activeItem = activePair[selectedSide.side];
    if (!activeItem.originalSrc) return;
    
    e.preventDefault();

    const rect = editorPerspectiveWrap.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const oldScrollLeft = editorPerspectiveWrap.scrollLeft;
    const oldScrollTop = editorPerspectiveWrap.scrollTop;
    const contentX = oldScrollLeft + mouseX;
    const contentY = oldScrollTop + mouseY;

    const oldZoom = activeItem.zoom || 100;
    let zoom = oldZoom;
    if (e.deltaY < 0) {
      zoom = Math.min(400, zoom + 15);
    } else {
      zoom = Math.max(100, zoom - 15);
    }

    if (zoom !== oldZoom) {
      activeItem.zoom = zoom;
      editorZoomValue.textContent = `${zoom}%`;
      editorPerspectiveContent.style.width = `${zoom}%`;
      editorPerspectiveContent.style.height = `${zoom}%`;
      updateEditorPinsUI(activePair, selectedSide.side);

      const ratio = zoom / oldZoom;
      editorPerspectiveWrap.scrollLeft = (contentX * ratio) - mouseX;
      editorPerspectiveWrap.scrollTop = (contentY * ratio) - mouseY;
      if (activePair === pairs[0]) {
        syncPair1ToOthers();
      }
    }
  }, { passive: false });

  let isPanning = false;
  let panStartX = 0, panStartY = 0;
  let panStartScrollLeft = 0, panStartScrollTop = 0;

  editorPerspectiveWrap.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('pin')) return;
    if (!selectedSide.pairId) return;
    const activePair = pairs.find(p => p.id === selectedSide.pairId);
    if (!activePair[selectedSide.side].originalSrc) return;

    isPanning = true;
    editorPerspectiveWrap.style.cursor = 'grabbing';
    panStartX = e.clientX;
    panStartY = e.clientY;
    panStartScrollLeft = editorPerspectiveWrap.scrollLeft;
    panStartScrollTop = editorPerspectiveWrap.scrollTop;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartX;
    const dy = e.clientY - panStartY;
    editorPerspectiveWrap.scrollLeft = panStartScrollLeft - dx;
    editorPerspectiveWrap.scrollTop = panStartScrollTop - dy;
  });

  window.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      if (selectedSide.pairId) {
        editorPerspectiveWrap.style.cursor = 'grab';
      } else {
        editorPerspectiveWrap.style.cursor = 'auto';
      }
    }
  });

  editorPerspectiveWrap.addEventListener('mouseover', (e) => {
    if (!selectedSide.pairId) return;
    const activePair = pairs.find(p => p.id === selectedSide.pairId);
    if (activePair && activePair[selectedSide.side].originalSrc && !e.target.classList.contains('pin') && !isPanning) {
      editorPerspectiveWrap.style.cursor = 'grab';
    }
  });
}

// Sync and Duplicate logic
function syncPair1ToOthers(force = false) {
  if (!syncPair1Checkbox) return;
  if (!syncPair1Checkbox.checked && !force) return;

  const pair1 = pairs[0];
  if (!pair1) return;

  if (force && !pair1.front.originalSrc && !pair1.back.originalSrc) {
    showToast('Cảnh báo', 'Vui lòng tải ảnh và chỉnh sửa Cặp #1 trước khi thực hiện.', 'warning');
    if (syncPair1Checkbox) syncPair1Checkbox.checked = false;
    return;
  }

  for (let i = 1; i < pairs.length; i++) {
    const destPair = pairs[i];

    // Revoke old URLs if needed
    if (destPair.front.originalSrc && destPair.front.originalSrc !== pair1.front.originalSrc) {
      try { URL.revokeObjectURL(destPair.front.originalSrc); } catch (e) {}
    }
    if (destPair.back.originalSrc && destPair.back.originalSrc !== pair1.back.originalSrc) {
      try { URL.revokeObjectURL(destPair.back.originalSrc); } catch (e) {}
    }

    // Clone front settings
    destPair.front = {
      originalSrc: pair1.front.originalSrc,
      croppedDataUrl: pair1.front.croppedDataUrl,
      zoom: pair1.front.zoom || 100,
      pins: pair1.front.pins ? JSON.parse(JSON.stringify(pair1.front.pins)) : null
    };

    // Clone back settings
    destPair.back = {
      originalSrc: pair1.back.originalSrc,
      croppedDataUrl: pair1.back.croppedDataUrl,
      zoom: pair1.back.zoom || 100,
      pins: pair1.back.pins ? JSON.parse(JSON.stringify(pair1.back.pins)) : null
    };
  }

  // Reload the editor if editing a non-first pair and sync is active
  if (selectedSide.pairId && selectedSide.pairId !== pair1.id) {
    if (syncPair1Checkbox && syncPair1Checkbox.checked) {
      // Swapping view back to pair1
      selectedSide = { pairId: pair1.id, side: selectedSide.side };
      loadEditor(pair1, selectedSide.side);
    } else {
      // Just reload the current copy pair with new data
      const activePair = pairs.find(p => p.id === selectedSide.pairId);
      if (activePair) {
        loadEditor(activePair, selectedSide.side);
      }
    }
  }

  updateLivePreview();
}

// Bind new actions
if (duplicatePair1Btn) {
  duplicatePair1Btn.addEventListener('click', () => {
    syncPair1ToOthers(true);
    showToast('Thành công', 'Đã sao chép Cặp #1 cho tất cả các ô còn lại!', 'success');
  });
}

if (syncPair1Checkbox) {
  syncPair1Checkbox.addEventListener('change', () => {
    if (syncPair1Checkbox.checked) {
      const pair1 = pairs[0];
      if (pair1 && (pair1.front.originalSrc || pair1.back.originalSrc)) {
        syncPair1ToOthers(true);
        showToast('Đồng bộ bật', 'Đang tự động đồng bộ Cặp #1 sang tất cả các ô.', 'success');
      } else {
        syncPair1Checkbox.checked = false;
        showToast('Cảnh báo', 'Vui lòng thêm ảnh vào Cặp #1 trước khi bật tự động đồng bộ.', 'warning');
      }
    } else {
      updateLivePreview();
    }
  });
}

// Initialize layout with correct slot counts and bind editor events
updatePaperLabel();
enforceLimits();
updateLivePreview();
initEditorEvents();


// Keep-alive heartbeat and shutdown handling
function initHeartbeat() {
  const shutdownUrl = new URL('/shutdown', window.location.href).href;
  const pingUrl = new URL('/ping', window.location.href).href;

  function sendPing() {
    fetch(pingUrl, { method: 'GET', mode: 'no-cors', cache: 'no-store' }).catch(() => {});
  }
  
  // Send ping immediately and then every 3 seconds
  sendPing();
  setInterval(sendPing, 3000);

  // Send shutdown request when closing or unloading page
  window.addEventListener('beforeunload', () => {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(shutdownUrl);
    } else {
      fetch(shutdownUrl, { method: 'POST', mode: 'no-cors', keepalive: true }).catch(() => {});
    }
  });
}
initHeartbeat();

