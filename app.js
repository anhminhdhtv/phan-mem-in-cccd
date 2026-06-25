// State Management
let pairs = [];
const PREVIEW_DPI = 96; // 1 inch = 96px in screen representation
const CM_TO_INCH = 0.393700787;
const CM_TO_TWIPS = 566.929; // 1 cm = 566.929 twips (dxa)

// DOM Elements
const paperSizeSelect = document.getElementById('paperSize');
const cccdListContainer = document.getElementById('cccdListContainer');
const emptyState = document.getElementById('emptyState');
const addPairBtn = document.getElementById('addPairBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const exportWordBtn = document.getElementById('exportWordBtn');
const globalDropzone = document.getElementById('globalDropzone');
const globalFileInput = document.getElementById('globalFileInput');
const simulatedPaper = document.getElementById('simulatedPaper');
const previewPaperLabel = document.getElementById('previewPaperLabel');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');

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

// App init
addPairBtn.addEventListener('click', () => {
  const success = createNewPair();
  if (!success) {
    const paperSize = paperSizeSelect.value;
    const maxPairs = paperSize === 'A5' ? 2 : 4;
    showToast('Giới hạn', `Không thể thêm. Khổ ${paperSize} giới hạn tối đa ${maxPairs} CCCD.`, 'warning');
  }
});
clearAllBtn.addEventListener('click', () => {
  if (pairs.length === 0) return;
  if (confirm('Bạn có chắc chắn muốn xóa toàn bộ danh sách CCCD?')) {
    clearAllPairs();
  }
});
exportWordBtn.addEventListener('click', exportToWord);

// Handle multiple file uploads and pair them up automatically
async function handleUploadedFiles(fileList) {
  const imageFiles = Array.from(fileList).filter(file => file.type.startsWith('image/'));
  if (imageFiles.length === 0) {
    showToast('Cảnh báo', 'Vui lòng chỉ chọn các tệp tin hình ảnh.', 'warning');
    return;
  }

  imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  showToast('Đang tải ảnh', `Đang xử lý ${imageFiles.length} hình ảnh...`, 'info');

  let addedAny = false;
  for (let i = 0; i < imageFiles.length; i += 2) {
    const file1 = imageFiles[i];
    const file2 = imageFiles[i + 1] || null;
    const success = await createNewPair(file1, file2);
    if (!success) {
      const paperSize = paperSizeSelect.value;
      const maxPairs = paperSize === 'A5' ? 2 : 4;
      showToast('Giới hạn', `Đã đạt giới hạn tối đa ${maxPairs} CCCD cho khổ ${paperSize}.`, 'warning');
      break;
    }
    addedAny = true;
  }
}

function enforceLimits() {
  const paperSize = paperSizeSelect.value;
  const maxPairs = paperSize === 'A5' ? 2 : 4;
  
  if (pairs.length > maxPairs) {
    const removedCount = pairs.length - maxPairs;
    for (let i = maxPairs; i < pairs.length; i++) {
      const el = document.getElementById(pairs[i].id);
      if (el) el.remove();
    }
    pairs = pairs.slice(0, maxPairs);
    updateLabels();
    updateLivePreview();
    showToast('Cấu hình', `Khổ ${paperSize} giới hạn tối đa ${maxPairs} CCCD. Đã tự động bỏ ${removedCount} cặp thừa.`, 'warning');
  }
}

// Create a new card pair object and DOM element
function createNewPair(frontFile = null, backFile = null) {
  const paperSize = paperSizeSelect.value;
  const maxPairs = paperSize === 'A5' ? 2 : 4;
  
  if (pairs.length >= maxPairs) {
    return false;
  }

  const pairId = 'pair_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  const pairState = {
    id: pairId,
    front: { originalSrc: null, croppedDataUrl: null, zoom: 100 },
    back: { originalSrc: null, croppedDataUrl: null, zoom: 100 }
  };
  
  pairs.push(pairState);
  
  // Render Pair Box in DOM with 4-pin perspective crop UI and zoom controls
  const pairHTML = `
    <div id="${pairId}" class="glass-panel p-5 border border-slate-800 cccd-pair-card flex flex-col gap-4 relative overflow-hidden">
      <div class="glow-effect"></div>
      
      <!-- Pair Header -->
      <div class="flex justify-between items-center pb-2 border-b border-slate-800/60 z-10">
        <div class="flex items-center gap-2">
          <span class="bg-indigo-600/10 text-indigo-400 text-xs font-bold px-2.5 py-1 rounded-md border border-indigo-500/10 pair-number-label">
            Cặp CCCD #${pairs.length}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button class="swap-btn btn-secondary-custom px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 hover:text-indigo-400" title="Hoán đổi mặt trước và sau">
            <i class="fa-solid fa-right-left"></i> Đổi Mặt
          </button>
          <button class="delete-pair-btn text-slate-400 hover:text-red-400 transition-colors p-1" title="Xóa cặp này">
            <i class="fa-solid fa-trash-can text-sm"></i>
          </button>
        </div>
      </div>
      
      <!-- Upload/Crop side by side -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 z-10">
        
        <!-- Mặt Trước (Front) Column -->
        <div class="flex flex-col gap-2">
          <div class="flex justify-between items-center">
            <span class="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Mặt Trước
            </span>
          </div>
          
          <!-- Dropzone/Perspective container -->
          <div class="card-upload-container border border-slate-800 rounded-xl bg-slate-900/30 overflow-hidden relative" style="aspect-ratio: 1.5857;">
            <!-- Dropzone state -->
            <div class="card-dropzone dropzone absolute inset-0 flex flex-col items-center justify-center p-4 text-center" data-side="front">
              <input type="file" accept="image/*" class="card-file-input absolute inset-0 opacity-0 cursor-pointer w-full h-full">
              <i class="fa-solid fa-camera text-2xl text-slate-600 mb-2"></i>
              <p class="text-[11px] text-slate-400 font-medium">Kéo thả mặt trước hoặc bấm chọn</p>
            </div>
            <!-- Image Crop state (Perspective Warp) -->
            <div class="card-crop-area hidden absolute inset-0 bg-slate-950 select-none">
              <div class="perspective-wrap">
                <div class="perspective-content">
                  <img class="original-image max-w-full max-h-full object-contain pointer-events-none" src="" alt="Mặt trước">
                  
                  <!-- Pins -->
                  <div class="pin absolute" data-pin="tl"></div>
                  <div class="pin absolute" data-pin="tr"></div>
                  <div class="pin absolute" data-pin="br"></div>
                  <div class="pin absolute" data-pin="bl"></div>
                  
                  <!-- SVG Overlay -->
                  <svg class="absolute inset-0 w-full h-full pointer-events-none z-20">
                    <polygon points="" class="fill-indigo-500/5 stroke-indigo-500 stroke-2" style="stroke-dasharray: 4;"></polygon>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Controls (Rotate + Zoom) -->
          <div class="card-controls hidden flex justify-between items-center bg-slate-900/60 p-2 rounded-lg border border-slate-800 text-xs">
            <div class="flex gap-1.5 items-center">
              <button class="rotate-left-btn bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1.5 rounded-md" title="Xoay trái 90 độ">
                <i class="fa-solid fa-rotate-left"></i>
              </button>
              <button class="rotate-right-btn bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1.5 rounded-md" title="Xoay phải 90 độ">
                <i class="fa-solid fa-rotate-right"></i>
              </button>
              
              <span class="w-[1px] h-4 bg-slate-800 mx-1"></span>
              <span class="text-[10px] text-slate-500 select-none">Thu phóng:</span>
              <button class="zoom-out-btn bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1.5 rounded-md" title="Thu nhỏ">
                <i class="fa-solid fa-magnifying-glass-minus text-[10px]"></i>
              </button>
              <span class="zoom-value text-[10px] text-indigo-400 font-bold w-9 text-center select-none">100%</span>
              <button class="zoom-in-btn bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1.5 rounded-md" title="Phóng to">
                <i class="fa-solid fa-magnifying-glass-plus text-[10px]"></i>
              </button>
            </div>
            <button class="remove-img-btn text-red-400 hover:text-red-300 font-semibold px-2 py-1" title="Xóa ảnh này">
              <i class="fa-solid fa-trash-can mr-1"></i> Xóa ảnh
            </button>
          </div>
        </div>

        <!-- Mặt Sau (Back) Column -->
        <div class="flex flex-col gap-2">
          <div class="flex justify-between items-center">
            <span class="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Mặt Sau
            </span>
          </div>
          
          <!-- Dropzone/Perspective container -->
          <div class="card-upload-container border border-slate-800 rounded-xl bg-slate-900/30 overflow-hidden relative" style="aspect-ratio: 1.5857;">
            <!-- Dropzone state -->
            <div class="card-dropzone dropzone absolute inset-0 flex flex-col items-center justify-center p-4 text-center" data-side="back">
              <input type="file" accept="image/*" class="card-file-input absolute inset-0 opacity-0 cursor-pointer w-full h-full">
              <i class="fa-solid fa-camera text-2xl text-slate-600 mb-2"></i>
              <p class="text-[11px] text-slate-400 font-medium">Kéo thả mặt sau hoặc bấm chọn</p>
            </div>
            <!-- Image Crop state (Perspective Warp) -->
            <div class="card-crop-area hidden absolute inset-0 bg-slate-950 select-none">
              <div class="perspective-wrap">
                <div class="perspective-content">
                  <img class="original-image max-w-full max-h-full object-contain pointer-events-none" src="" alt="Mặt sau">
                  
                  <!-- Pins -->
                  <div class="pin absolute" data-pin="tl"></div>
                  <div class="pin absolute" data-pin="tr"></div>
                  <div class="pin absolute" data-pin="br"></div>
                  <div class="pin absolute" data-pin="bl"></div>
                  
                  <!-- SVG Overlay -->
                  <svg class="absolute inset-0 w-full h-full pointer-events-none z-20">
                    <polygon points="" class="fill-indigo-500/5 stroke-indigo-500 stroke-2" style="stroke-dasharray: 4;"></polygon>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Controls (Rotate + Zoom) -->
          <div class="card-controls hidden flex justify-between items-center bg-slate-900/60 p-2 rounded-lg border border-slate-800 text-xs">
            <div class="flex gap-1.5 items-center">
              <button class="rotate-left-btn bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1.5 rounded-md" title="Xoay trái 90 độ">
                <i class="fa-solid fa-rotate-left"></i>
              </button>
              <button class="rotate-right-btn bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1.5 rounded-md" title="Xoay phải 90 độ">
                <i class="fa-solid fa-rotate-right"></i>
              </button>
              
              <span class="w-[1px] h-4 bg-slate-800 mx-1"></span>
              <span class="text-[10px] text-slate-500 select-none">Thu phóng:</span>
              <button class="zoom-out-btn bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1.5 rounded-md" title="Thu nhỏ">
                <i class="fa-solid fa-magnifying-glass-minus text-[10px]"></i>
              </button>
              <span class="zoom-value text-[10px] text-indigo-400 font-bold w-9 text-center select-none">100%</span>
              <button class="zoom-in-btn bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1.5 rounded-md" title="Phóng to">
                <i class="fa-solid fa-magnifying-glass-plus text-[10px]"></i>
              </button>
            </div>
            <button class="remove-img-btn text-red-400 hover:text-red-300 font-semibold px-2 py-1" title="Xóa ảnh này">
              <i class="fa-solid fa-trash-can mr-1"></i> Xóa ảnh
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
  
  // Append to container
  cccdListContainer.insertAdjacentHTML('beforeend', pairHTML);
  emptyState.classList.add('hidden');
  
  const pairEl = document.getElementById(pairId);
  setupPairEvents(pairEl, pairState);

  // If initial files are provided, load them
  if (frontFile) {
    loadCardImage(pairEl, pairState, 'front', frontFile);
  }
  if (backFile) {
    loadCardImage(pairEl, pairState, 'back', backFile);
  }

  updateLabels();
  updateLivePreview();
}

// Set up event listeners for a specific pair card element
function setupPairEvents(pairEl, pairState) {
  pairEl.querySelector('.delete-pair-btn').addEventListener('click', () => {
    deletePair(pairState.id);
  });

  pairEl.querySelector('.swap-btn').addEventListener('click', () => {
    swapSides(pairState);
  });

  const dropzones = pairEl.querySelectorAll('.card-dropzone');
  dropzones.forEach(zone => {
    const side = zone.getAttribute('data-side');
    const input = zone.querySelector('.card-file-input');

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        loadCardImage(pairEl, pairState, side, e.dataTransfer.files[0]);
      }
    });

    input.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        loadCardImage(pairEl, pairState, side, e.target.files[0]);
        input.value = ''; // reset
      }
    });
  });

  setupSideControls(pairEl, pairState, 'front');
  setupSideControls(pairEl, pairState, 'back');
}

// Setup controls handlers for a side (rotate, remove, zoom)
function setupSideControls(pairEl, pairState, side) {
  const sideCol = pairEl.querySelectorAll('.grid > div')[side === 'front' ? 0 : 1];
  const controlsEl = sideCol.querySelector('.card-controls');
  const rotateLeftBtn = controlsEl.querySelector('.rotate-left-btn');
  const rotateRightBtn = controlsEl.querySelector('.rotate-right-btn');
  const removeImgBtn = controlsEl.querySelector('.remove-img-btn');
  
  const zoomInBtn = controlsEl.querySelector('.zoom-in-btn');
  const zoomOutBtn = controlsEl.querySelector('.zoom-out-btn');
  const zoomValueText = controlsEl.querySelector('.zoom-value');
  const perspectiveContent = sideCol.querySelector('.perspective-content');

  rotateLeftBtn.addEventListener('click', () => {
    rotateSideImage(pairEl, pairState, side, -90);
  });

  rotateRightBtn.addEventListener('click', () => {
    rotateSideImage(pairEl, pairState, side, 90);
  });

  removeImgBtn.addEventListener('click', () => {
    removeCardImage(pairEl, pairState, side);
  });

  // Zoom In
  zoomInBtn.addEventListener('click', () => {
    const item = pairState[side];
    const oldZoom = item.zoom || 100;
    if (oldZoom < 400) {
      const zoom = Math.min(400, oldZoom + 25);
      item.zoom = zoom;
      zoomValueText.textContent = `${zoom}%`;
      
      const mouseX = perspectiveWrap.clientWidth / 2;
      const mouseY = perspectiveWrap.clientHeight / 2;
      const contentX = perspectiveWrap.scrollLeft + mouseX;
      const contentY = perspectiveWrap.scrollTop + mouseY;

      perspectiveContent.style.width = `${zoom}%`;
      perspectiveContent.style.height = `${zoom}%`;
      updatePolygonOverlay(pairEl, side);

      const ratio = zoom / oldZoom;
      perspectiveWrap.scrollLeft = (contentX * ratio) - mouseX;
      perspectiveWrap.scrollTop = (contentY * ratio) - mouseY;
    }
  });

  // Zoom Out
  zoomOutBtn.addEventListener('click', () => {
    const item = pairState[side];
    const oldZoom = item.zoom || 100;
    if (oldZoom > 100) {
      const zoom = Math.max(100, oldZoom - 25);
      item.zoom = zoom;
      zoomValueText.textContent = `${zoom}%`;
      
      const mouseX = perspectiveWrap.clientWidth / 2;
      const mouseY = perspectiveWrap.clientHeight / 2;
      const contentX = perspectiveWrap.scrollLeft + mouseX;
      const contentY = perspectiveWrap.scrollTop + mouseY;

      perspectiveContent.style.width = `${zoom}%`;
      perspectiveContent.style.height = `${zoom}%`;
      updatePolygonOverlay(pairEl, side);

      const ratio = zoom / oldZoom;
      perspectiveWrap.scrollLeft = (contentX * ratio) - mouseX;
      perspectiveWrap.scrollTop = (contentY * ratio) - mouseY;
    }
  });

  const perspectiveWrap = sideCol.querySelector('.perspective-wrap');

  // Mouse Wheel Zoom centered on cursor
  perspectiveWrap.addEventListener('wheel', (e) => {
    const item = pairState[side];
    if (!item.originalSrc) return;
    
    e.preventDefault();

    const rect = perspectiveWrap.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const oldScrollLeft = perspectiveWrap.scrollLeft;
    const oldScrollTop = perspectiveWrap.scrollTop;
    const contentX = oldScrollLeft + mouseX;
    const contentY = oldScrollTop + mouseY;

    const oldZoom = item.zoom || 100;
    let zoom = oldZoom;
    if (e.deltaY < 0) {
      zoom = Math.min(400, zoom + 15);
    } else {
      zoom = Math.max(100, zoom - 15);
    }

    if (zoom !== oldZoom) {
      item.zoom = zoom;
      zoomValueText.textContent = `${zoom}%`;
      perspectiveContent.style.width = `${zoom}%`;
      perspectiveContent.style.height = `${zoom}%`;
      updatePolygonOverlay(pairEl, side);

      // Adjust scroll based on direct zoom ratio
      const ratio = zoom / oldZoom;
      perspectiveWrap.scrollLeft = (contentX * ratio) - mouseX;
      perspectiveWrap.scrollTop = (contentY * ratio) - mouseY;
    }
  }, { passive: false });

  // Drag to Pan
  let isPanning = false;
  let startX = 0, startY = 0;
  let startScrollLeft = 0, startScrollTop = 0;

  perspectiveWrap.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('pin')) return; // ignore pin dragging
    const item = pairState[side];
    if (!item.originalSrc) return;

    isPanning = true;
    perspectiveWrap.style.cursor = 'grabbing';
    startX = e.clientX;
    startY = e.clientY;
    startScrollLeft = perspectiveWrap.scrollLeft;
    startScrollTop = perspectiveWrap.scrollTop;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    perspectiveWrap.scrollLeft = startScrollLeft - dx;
    perspectiveWrap.scrollTop = startScrollTop - dy;
  });

  window.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      const item = pairState[side];
      if (item && item.originalSrc) {
        perspectiveWrap.style.cursor = 'grab';
      } else {
        perspectiveWrap.style.cursor = 'auto';
      }
    }
  });

  perspectiveWrap.addEventListener('mouseover', (e) => {
    const item = pairState[side];
    if (item.originalSrc && !e.target.classList.contains('pin') && !isPanning) {
      perspectiveWrap.style.cursor = 'grab';
    }
  });

  // Touch panning
  perspectiveWrap.addEventListener('touchstart', (e) => {
    if (e.target.classList.contains('pin')) return;
    const item = pairState[side];
    if (!item.originalSrc) return;

    if (e.touches.length === 1) {
      isPanning = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startScrollLeft = perspectiveWrap.scrollLeft;
      startScrollTop = perspectiveWrap.scrollTop;
    }
  }, { passive: true });

  perspectiveWrap.addEventListener('touchmove', (e) => {
    if (!isPanning) return;
    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      perspectiveWrap.scrollLeft = startScrollLeft - dx;
      perspectiveWrap.scrollTop = startScrollTop - dy;
    }
  }, { passive: true });

  perspectiveWrap.addEventListener('touchend', () => {
    isPanning = false;
  });
}

// Load image into file reader and call UI setup
function loadCardImage(pairEl, pairState, side, file) {
  if (!file.type.startsWith('image/')) {
    showToast('Lỗi', 'Chỉ được tải lên tệp tin hình ảnh.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    if (pairState[side].originalSrc) {
      URL.revokeObjectURL(pairState[side].originalSrc);
    }
    pairState[side].originalSrc = e.target.result;
    pairState[side].zoom = 100; // Reset zoom on new image
    reloadSideUI(pairEl, pairState, side);
  };
  reader.readAsDataURL(file);
}

// Reload a specific side of the pair card (construct/bind pins and draw polygon)
function reloadSideUI(pairEl, pairState, side) {
  const sideCol = pairEl.querySelectorAll('.grid > div')[side === 'front' ? 0 : 1];
  const dropzone = sideCol.querySelector('.card-dropzone');
  const cropArea = sideCol.querySelector('.card-crop-area');
  const controls = sideCol.querySelector('.card-controls');
  const imgEl = cropArea.querySelector('.original-image');
  
  const item = pairState[side];
  
  if (item.originalSrc) {
    dropzone.classList.add('hidden');
    cropArea.classList.remove('hidden');
    controls.classList.remove('hidden');
    
    imgEl.src = item.originalSrc;
    
    imgEl.onload = function() {
      const pins = {
        tl: sideCol.querySelector('[data-pin="tl"]'),
        tr: sideCol.querySelector('[data-pin="tr"]'),
        br: sideCol.querySelector('[data-pin="br"]'),
        bl: sideCol.querySelector('[data-pin="bl"]')
      };
      
      const container = sideCol.querySelector('.perspective-content');
      
      // Update zoom elements UI state on reload
      const zoomValueText = sideCol.querySelector('.zoom-value');
      const zoomVal = item.zoom || 100;
      zoomValueText.textContent = `${zoomVal}%`;
      container.style.width = `${zoomVal}%`;
      container.style.height = `${zoomVal}%`;

      // Clear old drag event listeners by replacing with cloned nodes
      Object.keys(pins).forEach(key => {
        const oldPin = pins[key];
        const newPin = oldPin.cloneNode(true);
        oldPin.parentNode.replaceChild(newPin, oldPin);
        
        makePinDraggable(newPin, container, imgEl, () => {
          updatePolygonOverlay(pairEl, side);
        }, () => {
          // On drag release: warp the image and update preview
          warpCardWithPins(pairState, side);
        });
      });
      
      // Clean polygon lines overlay
      const oldPoly = container.querySelector('polygon');
      const newPoly = oldPoly.cloneNode(true);
      oldPoly.parentNode.replaceChild(newPoly, oldPoly);
      
      // Position pins on load (snaps to auto boundaries or defaults)
      initPinsForImage(pairEl, pairState, side);
      
      // Clear load trigger
      imgEl.onload = null;
    };
  } else {
    dropzone.classList.remove('hidden');
    cropArea.classList.add('hidden');
    controls.classList.add('hidden');
    imgEl.src = '';
  }
}

// Draggable logic with constraints bounding to the rendered image bounds
function makePinDraggable(pinEl, containerEl, imgEl, onDrag, onDragEnd) {
  let isDragging = false;
  let startX = 0, startY = 0;
  let startLeft = 0, startTop = 0;
  
  function onStart(e) {
    e.preventDefault();
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
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    const containerWidth = containerEl.clientWidth;
    const containerHeight = containerEl.clientHeight;
    
    const dx = clientX - startX;
    const dy = clientY - startY;

    let newLeftPx = (startLeft / 100 * containerWidth) + dx;
    let newTopPx = (startTop / 100 * containerHeight) + dy;
    
    // Constraint boundaries to rendered image area inside perspective-content wrapper
    const bounds = getCurrentImageBounds(containerEl, imgEl);
    
    newLeftPx = Math.max(bounds.left, Math.min(bounds.left + bounds.width, newLeftPx));
    newTopPx = Math.max(bounds.top, Math.min(bounds.top + bounds.height, newTopPx));
    
    pinEl.style.left = `${(newLeftPx / containerWidth) * 100}%`;
    pinEl.style.top = `${(newTopPx / containerHeight) * 100}%`;
    
    onDrag();
  }
  
  function onEnd() {
    if (isDragging) {
      isDragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      onDragEnd();
    }
  }
  
  pinEl.addEventListener('mousedown', onStart);
  pinEl.addEventListener('touchstart', onStart, { passive: false });
}

// Compute the bounds of the image element rendered within object-contain frame
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

// Place 4 pins relative to image bounding box (OpenCV auto-crop suggestion or defaults)
function initPinsForImage(pairEl, pairState, side) {
  const sideCol = pairEl.querySelectorAll('.grid > div')[side === 'front' ? 0 : 1];
  const container = sideCol.querySelector('.perspective-content');
  const imgEl = container.querySelector('.original-image');
  
  const bounds = getCurrentImageBounds(container, imgEl);
  const w_c = container.clientWidth;
  const h_c = container.clientHeight;
  
  let detectedCorners = null;
  if (window.cvReady) {
    detectedCorners = detectCardCornersOpenCV(imgEl);
  }
  
  const pins = {
    tl: container.querySelector('[data-pin="tl"]'),
    tr: container.querySelector('[data-pin="tr"]'),
    br: container.querySelector('[data-pin="br"]'),
    bl: container.querySelector('[data-pin="bl"]')
  };
  
  if (detectedCorners) {
    const mapped = detectedCorners.map(pt => {
      const px = (pt.x / imgEl.naturalWidth) * bounds.width + bounds.left;
      const py = (pt.y / imgEl.naturalHeight) * bounds.height + bounds.top;
      return {
        x: (px / w_c) * 100,
        y: (py / h_c) * 100
      };
    });
    
    pins.tl.style.left = `${mapped[0].x}%`;
    pins.tl.style.top = `${mapped[0].y}%`;
    
    pins.tr.style.left = `${mapped[1].x}%`;
    pins.tr.style.top = `${mapped[1].y}%`;
    
    pins.br.style.left = `${mapped[2].x}%`;
    pins.br.style.top = `${mapped[2].y}%`;
    
    pins.bl.style.left = `${mapped[3].x}%`;
    pins.bl.style.top = `${mapped[3].y}%`;
  } else {
    // Default 15% inset inside image bounding box
    const insetX = bounds.width * 0.15;
    const insetY = bounds.height * 0.15;
    
    pins.tl.style.left = `${((bounds.left + insetX) / w_c) * 100}%`;
    pins.tl.style.top = `${((bounds.top + insetY) / h_c) * 100}%`;
    
    pins.tr.style.left = `${((bounds.left + bounds.width - insetX) / w_c) * 100}%`;
    pins.tr.style.top = `${((bounds.top + insetY) / h_c) * 100}%`;
    
    pins.br.style.left = `${((bounds.left + bounds.width - insetX) / w_c) * 100}%`;
    pins.br.style.top = `${((bounds.top + bounds.height - insetY) / h_c) * 100}%`;
    
    pins.bl.style.left = `${((bounds.left + insetX) / w_c) * 100}%`;
    pins.bl.style.top = `${((bounds.top + bounds.height - insetY) / h_c) * 100}%`;
  }
  
  updatePolygonOverlay(pairEl, side);
  warpCardWithPins(pairState, side);
}

// Redraw connecting SVG polygon line
function updatePolygonOverlay(pairEl, side) {
  const sideCol = pairEl.querySelectorAll('.grid > div')[side === 'front' ? 0 : 1];
  const container = sideCol.querySelector('.perspective-content');
  
  const pins = {
    tl: container.querySelector('[data-pin="tl"]'),
    tr: container.querySelector('[data-pin="tr"]'),
    br: container.querySelector('[data-pin="br"]'),
    bl: container.querySelector('[data-pin="bl"]')
  };
  
  const poly = container.querySelector('polygon');
  const w = container.clientWidth;
  const h = container.clientHeight;
  
  const p_tl = { x: parseFloat(pins.tl.style.left) / 100 * w, y: parseFloat(pins.tl.style.top) / 100 * h };
  const p_tr = { x: parseFloat(pins.tr.style.left) / 100 * w, y: parseFloat(pins.tr.style.top) / 100 * h };
  const p_br = { x: parseFloat(pins.br.style.left) / 100 * w, y: parseFloat(pins.br.style.top) / 100 * h };
  const p_bl = { x: parseFloat(pins.bl.style.left) / 100 * w, y: parseFloat(pins.bl.style.top) / 100 * h };
  
  poly.setAttribute('points', `${p_tl.x},${p_tl.y} ${p_tr.x},${p_tr.y} ${p_br.x},${p_br.y} ${p_bl.x},${p_bl.y}`);
}

// Perform perspective transform warping based on custom pin selections
function warpCardWithPins(pairState, side) {
  if (!window.cvReady) return;
  
  const pairEl = document.getElementById(pairState.id);
  const sideCol = pairEl.querySelectorAll('.grid > div')[side === 'front' ? 0 : 1];
  const container = sideCol.querySelector('.perspective-content');
  const imgEl = container.querySelector('.original-image');
  
  const w_c = container.clientWidth;
  const h_c = container.clientHeight;
  const w_n = imgEl.naturalWidth;
  const h_n = imgEl.naturalHeight;
  
  if (!w_n || !h_n) return;
  
  const bounds = getCurrentImageBounds(container, imgEl);
  
  const pins = {
    tl: container.querySelector('[data-pin="tl"]'),
    tr: container.querySelector('[data-pin="tr"]'),
    br: container.querySelector('[data-pin="br"]'),
    bl: container.querySelector('[data-pin="bl"]')
  };
  
  function pinToImagePixel(pin) {
    const px = parseFloat(pin.style.left) / 100 * w_c;
    const py = parseFloat(pin.style.top) / 100 * h_c;
    
    let img_x = (px - bounds.left) / bounds.width * w_n;
    let img_y = (py - bounds.top) / bounds.height * h_n;
    
    img_x = Math.max(0, Math.min(w_n, img_x));
    img_y = Math.max(0, Math.min(h_n, img_y));
    
    return { x: img_x, y: img_y };
  }
  
  const p1 = pinToImagePixel(pins.tl);
  const p2 = pinToImagePixel(pins.tr);
  const p3 = pinToImagePixel(pins.br);
  const p4 = pinToImagePixel(pins.bl);
  
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
    tempCtx.drawImage(imgEl, 0, 0);
    
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
    
    pairState[side].croppedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    updateLivePreview();
    
    src.delete();
    srcCoords.delete();
    dstCoords.delete();
    M.delete();
    warped.delete();
    
  } catch (error) {
    console.error("Warp error:", error);
  }
}

// OpenCV contour suggestion logic: returns 4 detected card corners or null
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

// Rotate the original image data inside offscreen canvas
function rotateSideImage(pairEl, pairState, side, degree) {
  const item = pairState[side];
  if (!item.originalSrc) return;
  
  showToast('Xử lý ảnh', 'Đang xoay ảnh...', 'info');
  rotateImageData(item.originalSrc, degree, (rotatedDataUrl) => {
    item.originalSrc = rotatedDataUrl;
    
    const sideCol = pairEl.querySelectorAll('.grid > div')[side === 'front' ? 0 : 1];
    const imgEl = sideCol.querySelector('.original-image');
    imgEl.src = rotatedDataUrl;
    
    imgEl.onload = function() {
      initPinsForImage(pairEl, pairState, side);
      imgEl.onload = null;
    };
  });
}

// Canvas image rotation helper
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

// Delete image from a side
function removeCardImage(pairEl, pairState, side) {
  const sideCol = pairEl.querySelectorAll('.grid > div')[side === 'front' ? 0 : 1];
  const dropzone = sideCol.querySelector('.card-dropzone');
  const cropArea = sideCol.querySelector('.card-crop-area');
  const controls = sideCol.querySelector('.card-controls');
  const imgEl = cropArea.querySelector('.original-image');

  if (pairState[side].originalSrc) {
    pairState[side].originalSrc = null;
  }
  pairState[side].croppedDataUrl = null;

  dropzone.classList.remove('hidden');
  cropArea.classList.add('hidden');
  controls.classList.add('hidden');
  imgEl.src = '';

  updateLivePreview();
}

// Swap states and UI of front and back columns
function swapSides(pairState) {
  const pairEl = document.getElementById(pairState.id);
  
  const temp = pairState.front;
  pairState.front = pairState.back;
  pairState.back = temp;
  
  reloadSideUI(pairEl, pairState, 'front');
  reloadSideUI(pairEl, pairState, 'back');
  
  showToast('Đã đổi mặt', 'Hoán đổi thành công Mặt Trước & Mặt Sau.', 'success');
}

// Delete a card pair
function deletePair(pairId) {
  const index = pairs.findIndex(p => p.id === pairId);
  if (index !== -1) {
    const pair = pairs[index];
    pairs.splice(index, 1);
    const el = document.getElementById(pairId);
    el.remove();

    if (pairs.length === 0) {
      emptyState.classList.remove('hidden');
    }

    updateLabels();
    updateLivePreview();
  }
}

// Clear all card pairs
function clearAllPairs() {
  pairs = [];
  cccdListContainer.querySelectorAll('.cccd-pair-card').forEach(el => el.remove());
  emptyState.classList.remove('hidden');
  updateLivePreview();
}

// Update pair index labels
function updateLabels() {
  const labels = cccdListContainer.querySelectorAll('.pair-number-label');
  labels.forEach((label, idx) => {
    label.textContent = `Cặp CCCD #${idx + 1}`;
  });
}

// Live simulated paper preview rendering
function updateLivePreview() {
  const paperSize = paperSizeSelect.value;
  const paperOrientation = paperSize === 'A5' ? 'landscape' : 'portrait';
  
  // Dimensions in cm
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

  pairs.forEach((pair, idx) => {
    if (!pair.front.croppedDataUrl && !pair.back.croppedDataUrl) return;

    const pairWrapper = document.createElement('div');
    pairWrapper.style.display = 'flex';
    pairWrapper.style.justifyContent = 'center';
    pairWrapper.style.alignItems = 'center';
    pairWrapper.style.width = '100%';
    pairWrapper.style.marginBottom = `${rowSpacingCm * scale}px`;

    // Left card box (Front)
    const frontBox = document.createElement('div');
    frontBox.className = 'print-card-placeholder flex items-center justify-center overflow-hidden';
    frontBox.style.width = `${cardWidthCm * scale}px`;
    frontBox.style.height = `${cardHeightCm * scale}px`;
    frontBox.style.borderRadius = `${0.1 * scale}px`;
    
    if (pair.front.croppedDataUrl) {
      frontBox.innerHTML = `<img src="${pair.front.croppedDataUrl}" class="w-full h-full object-cover">`;
      frontBox.style.borderStyle = 'solid';
      frontBox.style.borderColor = '#e2e8f0';
    } else {
      frontBox.innerHTML = `<span style="font-size: ${Math.max(6, scale * 0.4)}px; color: #aaa;">Mặt trước</span>`;
    }

    // Spacer
    const spacer = document.createElement('div');
    spacer.style.width = `${cardSpacingCm * scale}px`;

    // Right card box (Back)
    const backBox = document.createElement('div');
    backBox.className = 'print-card-placeholder flex items-center justify-center overflow-hidden';
    backBox.style.width = `${cardWidthCm * scale}px`;
    backBox.style.height = `${cardHeightCm * scale}px`;
    backBox.style.borderRadius = `${0.1 * scale}px`;

    if (pair.back.croppedDataUrl) {
      backBox.innerHTML = `<img src="${pair.back.croppedDataUrl}" class="w-full h-full object-cover">`;
      backBox.style.borderStyle = 'solid';
      backBox.style.borderColor = '#e2e8f0';
    } else {
      backBox.innerHTML = `<span style="font-size: ${Math.max(6, scale * 0.4)}px; color: #aaa;">Mặt sau</span>`;
    }

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

// Add an initial pair to start the screen with one clean blank slot
updatePaperLabel();
createNewPair();
updateLivePreview();

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

