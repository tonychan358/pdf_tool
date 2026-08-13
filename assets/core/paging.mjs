// 純計算模組：不得 import 任何嘢、不得掂 DOM 或 pdf-lib。
// 全部頁碼為 1-indexed，範圍頭尾包含。

// 每個拋出嘅 Error 都附一個機讀 `code`（同埋有用時附加資料，例如 `part`／`totalPages`），
// 俾上層（例如 tools/split.html）可以將佢哋映射去 i18n key，而毋須解析 `message` 文字。
// `message` 本身保持中文原文唔變——現有測試用 regex 對住佢，改咗會扑爆。
function err(message, code, data) {
  return Object.assign(new Error(message), { code, ...(data || {}) });
}

export function groupByCount(totalPages, n) {
  if (!Number.isInteger(totalPages) || totalPages < 1) throw err('總頁數必須為正整數', 'TOTAL_PAGES_INVALID');
  if (!Number.isInteger(n) || n < 1) throw err('每份頁數必須為正整數', 'EVERY_N_INVALID');
  const out = [];
  for (let start = 1; start <= totalPages; start += n) {
    out.push({ start, end: Math.min(start + n - 1, totalPages) });
  }
  return out;
}

export function eachPage(totalPages) {
  return groupByCount(totalPages, 1);
}

export function parseRanges(spec, totalPages) {
  if (!Number.isInteger(totalPages) || totalPages < 1) throw err('總頁數必須為正整數', 'TOTAL_PAGES_INVALID');
  // 全形逗號（，）同全形／排版用連接號（－ U+FF0D、– en dash、— em dash）都
  // 要正規化做半形 , 同 -——用中文輸入法打「1－3」（全形減號）或者複製貼上
  // 排版過嘅內容帶埋 en/em dash 都好常見，唔正規化嘅話下面嗰個 regex 會完全
  // 認唔到，拋一句「無法辨識的範圍」，但使用者眼中打嘅明明就係一個正常範圍。
  const parts = String(spec)
    .replace(/，/g, ',')
    .replace(/[－–—]/g, '-')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) throw err('請輸入頁碼範圍，例如 1-3,4-8', 'RANGES_EMPTY');
  return parts.map(part => {
    const m = part.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!m) throw err(`無法辨識的範圍：${part}`, 'RANGE_UNPARSEABLE', { part });
    const start = Number(m[1]);
    const end = m[2] === undefined ? start : Number(m[2]);
    if (start < 1 || end > totalPages) throw err(`範圍 ${part} 超出文件頁數（共 ${totalPages} 頁）`, 'RANGE_OUT_OF_BOUNDS', { part, totalPages });
    if (start > end) throw err(`範圍 ${part} 的起始頁大於結束頁`, 'RANGE_REVERSED', { part });
    return { start, end };
  });
}

// interleave 回傳的 index 為 0-indexed，因為會直接交予 pdf-lib copyPages 使用。
// 雖然本檔中頁碼一律 1-indexed，但 interleave 的輸出需特別處理。
export function interleave(frontCount, backCount, reverseBack) {
  for (const v of [frontCount, backCount]) {
    if (!Number.isInteger(v) || v < 0) throw err('頁數必須為非負整數', 'INTERLEAVE_COUNT_INVALID');
  }
  const back = Array.from({ length: backCount }, (_, i) => (reverseBack ? backCount - 1 - i : i));
  const out = [];
  const max = Math.max(frontCount, backCount);
  for (let i = 0; i < max; i++) {
    if (i < frontCount) out.push({ stack: 'front', index: i });
    if (i < backCount) out.push({ stack: 'back', index: back[i] });
  }
  return out;
}

export const A4 = { W: 595.28, H: 841.89 };

export function nupLayout({ pageW, pageH, per, gutter = 10 }) {
  if (per !== 2 && per !== 4) throw err('每版頁數只支援 2 或 4', 'NUP_PER_INVALID');
  if (!(pageW > 0) || !(pageH > 0)) throw err('頁面尺寸必須為正數', 'PAGE_SIZE_INVALID');

  const cols = 2;
  const rows = per === 2 ? 1 : 2;
  const sheetW = per === 2 ? A4.H : A4.W;
  const sheetH = per === 2 ? A4.W : A4.H;

  const cellW = (sheetW - gutter * (cols + 1)) / cols;
  const cellH = (sheetH - gutter * (rows + 1)) / rows;
  // gutter 冇上限檢查嘅話，夠大就會令 cellW／cellH 跌到 0 或以下——scale 隨住
  // 變成 0 或負數，畫出嚟嘅版面會鏡射／退化成一堆疊埋一齊嘅點，但 pdf-lib
  // 唔會拋錯，出到嚟嘅 PDF 打得開，用戶要打印咗先發現唔對路。呢度守住呢個
  // 不變量：每格必須有正嘅闊同高先算做「有位放內容」。
  if (!(cellW > 0) || !(cellH > 0)) {
    throw err('頁間留白太大，版面已經冇位放內容', 'GUTTER_TOO_LARGE', { gutter, cellW, cellH });
  }
  const scale = Math.min(cellW / pageW, cellH / pageH);
  const w = pageW * scale;
  const h = pageH * scale;

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellX = gutter + c * (cellW + gutter);
      // PDF y 軸向上：第 0 行喺最頂，所以由 sheetH 減落嚟
      const cellTop = sheetH - gutter - r * (cellH + gutter);
      const cellY = cellTop - cellH;
      cells.push({
        x: cellX + (cellW - w) / 2,
        y: cellY + (cellH - h) / 2,
        w, h, scale,
      });
    }
  }
  return { sheetW, sheetH, cells };
}

// 顯示時的視覺邊 → mediabox 上要撐大的邊。
// /Rotate 為順時針旋轉角度（對顯示內容而言）。
// 因此用戶睇到的視覺邊是 mediabox 順時針旋轉後的結果。
// marginEdge 是逆向映射：用戶睇到邊 E，問「原始 mediabox 嘅邊係邊個」。
// 答案是 (E 的索引減去旋轉步數)。
const EDGE_ORDER = ['top', 'right', 'bottom', 'left'];

export function marginEdge(visualEdge, rotationDeg) {
  const i = EDGE_ORDER.indexOf(visualEdge);
  if (i === -1) throw err(`未知的邊：${visualEdge}`, 'EDGE_UNKNOWN', { visualEdge });
  const steps = ((Math.round(rotationDeg / 90) % 4) + 4) % 4;
  return EDGE_ORDER[(i - steps + 4) % 4];
}

// 將 srcW×srcH 等比縮放（可放大亦可縮小）去啱好塞入 boxW×boxH，並喺框內置中。
// 用喺 images-to-pdf（相片置中喺一版 A4）等場景，日後 N-up／margin 等工具亦可能重用。
export function fitInto({ srcW, srcH, boxW, boxH }) {
  for (const v of [srcW, srcH, boxW, boxH]) {
    if (!(v > 0)) throw err('尺寸必須為正數', 'FIT_SIZE_INVALID');
  }
  const scale = Math.min(boxW / srcW, boxH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { w, h, x: (boxW - w) / 2, y: (boxH - h) / 2, scale };
}
