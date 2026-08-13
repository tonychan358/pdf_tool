import { t } from './i18n.mjs';

function matches(file, accept) {
  if (accept === 'pdf') return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (accept === 'image') return /^image\/(jpeg|png)$/.test(file.type) || /\.(jpe?g|png)$/i.test(file.name);
  return true;
}

export function createDropzone(el, { accept = 'pdf', multiple = false, onChange = () => {} }) {
  const state = { files: [], enabled: true };
  const input = document.createElement('input');
  input.type = 'file';
  input.hidden = true;
  input.multiple = multiple;
  input.accept = accept === 'image' ? 'image/jpeg,image/png' : 'application/pdf';
  el.after(input);

  const take = list => {
    // 停用期間（例如工具正在跑緊一個 job）一律拒收新輸入——見 setEnabled()
    // 底下嘅解釋：呢個守衛先係令「畫面唔會喺 job 中途改變選擇」真正生效嘅
    // 一步，冧咗佢嘅話 CSS 上嘅停用外觀就淨係得個樣。
    if (!state.enabled) return;
    const total = list.length;
    const incoming = Array.from(list).filter(f => matches(f, accept));
    if (incoming.length === 0) {
      onChange(state.files, accept === 'image' ? 'error.notImage' : 'error.notPdf', { type: 0, limit: 0 });
      return;
    }
    const kept = multiple ? incoming : [incoming[0]];
    state.files = multiple ? state.files.concat(incoming) : kept;
    // 兩種「使用者以為加咗、其實冇加到」嘅檔案，成因唔同，要分開計唔可以夾埋：
    // type —— 類型唔合資格（例如揀圖片工具卻拖入 PDF），同「有冇超過上限」無關；
    // limit —— 類型啱，但單檔模式下超出一個檔嘅上限，只有第一個會被留低。
    // 兩者混報會令用戶收到錯誤原因（見 dropzone 呼叫方點樣分別顯示呢兩句）。
    onChange(state.files, null, {
      type: total - incoming.length,
      limit: incoming.length - kept.length,
      keptName: incoming.length > kept.length ? kept[0].name : undefined,
    });
  };

  el.addEventListener('click', () => { if (state.enabled) input.click(); });
  input.addEventListener('change', () => { take(input.files); input.value = ''; });
  el.addEventListener('dragover', e => { e.preventDefault(); if (state.enabled) el.classList.add('over'); });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', e => {
    e.preventDefault();
    el.classList.remove('over');
    take(e.dataTransfer.files);
  });

  return {
    get files() { return state.files; },
    // 淨係寫入內部 state，唔會再觸發 onChange——俾外部（toolpage.mjs 嘅 sync()）
    // 喺自己已經係 onChange 嘅呼叫源頭之下，可以將最新結果寫返入嚟而唔會遞迴。
    setFiles(v) { state.files = v; },
    clear() { state.files = []; onChange(state.files, null, { type: 0, limit: 0 }); },
    // 工具跑緊一個 job 嗰陣攞嚟停用呢個 dropzone：停止接受新拖放／選檔，等
    // 「畫面上顯示緊嘅檔案清單」喺成個 job 期間唔會變——否則用戶中途換咗
    // 檔，job 用嘅仍然係舊選擇，完成時卻話俾佢哋知「完成，已下載」，變成
    // 一個關於冇用到嘅選擇嘅假成功。CSS 嘅 .dropzone.disabled（見
    // design.css）負責視覺提示，input.disabled 令鍵盤／輔助工具都攞唔到
    // 呢粒 input，state.enabled 先係 take() 實際擋住新輸入嗰道閘。
    setEnabled(v) {
      state.enabled = v;
      input.disabled = !v;
      el.classList.toggle('disabled', !v);
    },
  };
}

// ul → { files, onChange, from }。用嚟俾 sortable 拖曳監聽器喺事件觸發嗰一刻
// 讀「現在」嘅 files/onChange，而唔係閉包住某一次 render 嗰份快照。用 WeakMap
// 唔會留住已經冇再用（detached）嘅 ul 元素。
const sortState = new WeakMap();

export function renderFileList(ul, files, { sortable = false, onChange = () => {} } = {}) {
  // 淨係喺可拖曳排序嘅清單先顯示「可以拖曳」嘅 grab 游標（design.css 嘅
  // `.filelist.sortable li`）——split／organize／nup／margin 呢幾個單檔或者
  // 唔支援排序嘅工具，清單本身冇拖曳排序功能，之前成塊 `.filelist li`
  // 一律套 cursor:grab 會呃使用者以為呢度拖得郁。
  ul.classList.toggle('sortable', sortable);
  ul.innerHTML = '';
  files.forEach((f, i) => {
    const li = document.createElement('li');
    li.draggable = sortable;
    li.dataset.index = String(i);
    li.innerHTML =
      `${sortable ? '<span class="grip">⠿</span>' : ''}` +
      `<span class="name"></span><button type="button" data-i18n="common.remove"></button>`;
    li.querySelector('.name').textContent = f.name;
    const btn = li.querySelector('button');
    // 呢粒掣係跟住檔案清單動態生成嘅，唔會跟住之後嘅語言切換自動重繪
    // （唔似其他靜態 HTML 入面嘅 data-i18n 元素，一開波已經喺 document 度俾
    // i18n.mjs 嘅 apply() 揀中）。淨係喺呢度用 t() 現砌一次文字，只夠俾
    // *呢一刻* 嘅語言啱——用戶之後切語言，呢粒掣會同其他成頁嘢一齊變晒
    // 新語言，但佢會獨留喺舊字，好突兀（尤其係揀語言之後冇再郁檔案清單，
    // 成粒掣可以一直卡喺舊語言）。加返 data-i18n 屬性等佢一樣畀 apply()
    // 揾到：呢粒 li 一 appendChild 落 ul（已經喺 document 入面），下次 lang-
    // toggle 觸發 apply() 就會揾到呢粒掣，同其他靜態文字一齊被重寫。呢度
    // 照舊即刻用 t() 填一次係為咗首次 render 唔使等第二次 apply() 先有字。
    btn.textContent = t('common.remove');
    // 呢個保持原樣：li 每次 render 都係新建嘅，佢個 onClick 閉包住嘅 files/i
    // 本身就一定係「今次呢次 render」嘅資料，冇過時問題，唔使搬去 sortState。
    btn.addEventListener('click', e => {
      e.stopPropagation();
      onChange(files.filter((_, j) => j !== i));
    });
    ul.appendChild(li);
  });

  if (!sortable) return;

  const existing = sortState.get(ul);
  if (existing) {
    // 呢個 ul 之前已經掛過拖曳監聽器——淨係更新佢哋下次觸發時要讀嘅狀態，
    // 唔再重複 addEventListener（否則監聽器會逐次 render 疊加）。
    existing.files = files;
    existing.onChange = onChange;
    return;
  }

  // 第一次見到呢個 ul：建立佢專屬嘅狀態格（包括 from，唔係模組級共用變量，
  // 兩個唔同嘅 ul／dropzone 各自有自己嗰份，唔會漏拖到隔籬個 list），並只喺
  // 呢一次掛齊四個監聽器。
  const state = { files, onChange, from: null };
  sortState.set(ul, state);

  ul.addEventListener('dragstart', e => {
    state.from = Number(e.target.dataset.index);
    e.target.classList.add('dragging');
  });
  ul.addEventListener('dragend', e => e.target.classList.remove('dragging'));
  ul.addEventListener('dragover', e => e.preventDefault());
  ul.addEventListener('drop', e => {
    e.preventDefault();
    const li = e.target.closest('li');
    if (!li || state.from === null) return;
    const to = Number(li.dataset.index);
    const next = state.files.slice();
    next.splice(to, 0, next.splice(state.from, 1)[0]);
    state.from = null;
    state.onChange(next);
  });
}
