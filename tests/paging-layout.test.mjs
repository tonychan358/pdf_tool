import test from 'node:test';
import assert from 'node:assert/strict';
import { A4, nupLayout, marginEdge } from '../assets/core/paging.mjs';

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} ≉ ${b}`);

test('A4 常數', () => {
  near(A4.W, 595.28);
  near(A4.H, 841.89);
});

test('nupLayout：2-up 用橫向 A4，兩格左右排', () => {
  const l = nupLayout({ pageW: A4.W, pageH: A4.H, per: 2, gutter: 0 });
  near(l.sheetW, A4.H);
  near(l.sheetH, A4.W);
  assert.equal(l.cells.length, 2);
  assert.ok(l.cells[0].x < l.cells[1].x, '第一格喺左');
});

test('nupLayout：4-up 用直向 A4，2x2 由左至右由上至下', () => {
  const l = nupLayout({ pageW: A4.W, pageH: A4.H, per: 4, gutter: 0 });
  near(l.sheetW, A4.W);
  near(l.sheetH, A4.H);
  assert.equal(l.cells.length, 4);
  assert.ok(l.cells[0].x < l.cells[1].x, 'cell0 喺 cell1 左邊');
  assert.ok(l.cells[0].y > l.cells[2].y, 'cell0 喺 cell2 上面（PDF y 軸向上）');
  near(l.cells[0].y, l.cells[1].y);
  near(l.cells[0].x, l.cells[2].x);
});

test('nupLayout：縮放為等比且不超出格', () => {
  const l = nupLayout({ pageW: A4.W, pageH: A4.H, per: 4, gutter: 10 });
  const c = l.cells[0];
  const cellW = (l.sheetW - 3 * 10) / 2;
  const cellH = (l.sheetH - 3 * 10) / 2;
  near(c.w, A4.W * c.scale);
  near(c.h, A4.H * c.scale);
  assert.ok(c.w <= cellW + 0.01 && c.h <= cellH + 0.01, '唔可以爆格');
  near(c.scale, Math.min(cellW / A4.W, cellH / A4.H));
});

test('nupLayout：內容喺格內置中', () => {
  const gutter = 10;
  const l = nupLayout({ pageW: 100, pageH: 100, per: 4, gutter });
  const cellW = (l.sheetW - 3 * gutter) / 2;
  const c = l.cells[0];
  near(c.x, gutter + (cellW - c.w) / 2);
});

test('nupLayout：橫向來源頁照計', () => {
  const l = nupLayout({ pageW: 842, pageH: 595, per: 2, gutter: 0 });
  assert.equal(l.cells.length, 2);
  assert.ok(l.cells[0].scale > 0);
});

test('nupLayout：per 只收 2 或 4', () => {
  assert.throws(() => nupLayout({ pageW: 100, pageH: 100, per: 3 }), /每版頁數/);
  assert.throws(() => nupLayout({ pageW: 100, pageH: 100, per: 1 }), /每版頁數/);
});

test('nupLayout：非法尺寸拋錯', () => {
  assert.throws(() => nupLayout({ pageW: 0, pageH: 100, per: 2 }), /頁面尺寸/);
});

test('nupLayout：非法輸入嘅 Error 附有機讀 code', () => {
  assert.throws(() => nupLayout({ pageW: 100, pageH: 100, per: 3 }), (e) => e.code === 'NUP_PER_INVALID');
  assert.throws(() => nupLayout({ pageW: 0, pageH: 100, per: 2 }), (e) => e.code === 'PAGE_SIZE_INVALID');
});

test('nupLayout：留白太大令格仔冇晒位，拋錯', () => {
  // per=4 用 A4.W（較窄嗰邊）分 2 欄、3 條 gutter，係兩種 per 入面最快跌穿 0 嘅
  // 情況——gutter=300 遠超 A4.W/3（約 198.43），cellW 一定跌到負數。
  assert.throws(() => nupLayout({ pageW: A4.W, pageH: A4.H, per: 4, gutter: 300 }), /留白太大/);
  assert.throws(() => nupLayout({ pageW: A4.W, pageH: A4.H, per: 2, gutter: 300 }), /留白太大/);
});

test('nupLayout：留白太大嘅 Error 附有機讀 code', () => {
  assert.throws(() => nupLayout({ pageW: A4.W, pageH: A4.H, per: 4, gutter: 300 }), (e) => e.code === 'GUTTER_TOO_LARGE');
});

test('nupLayout：留白啱啱好貼近臨界值都唔可以令格仔變零或負數', () => {
  // A4.W/3 ≈ 198.4267 係 per=4 嘅精確臨界值；貼近但未超過就唔應該拋錯。
  assert.doesNotThrow(() => nupLayout({ pageW: A4.W, pageH: A4.H, per: 4, gutter: 198 }));
});

test('marginEdge：無旋轉時原樣', () => {
  assert.equal(marginEdge('right', 0), 'right');
  assert.equal(marginEdge('bottom', 0), 'bottom');
});

test('marginEdge：未知的邊拋錯，附有機讀 code', () => {
  assert.throws(() => marginEdge('diagonal', 0), (e) => e.code === 'EDGE_UNKNOWN' && e.visualEdge === 'diagonal');
});

test('marginEdge：90 度順時針旋轉', () => {
  // 頁面顯示時順時針轉 90°。
  // 用戶睇到嘅右邊實際是 mediabox 嘅上邊（轉 90° 後）。
  // marginEdge 逆向映射：用戶睇到邊，回傳原始 mediabox 嘅邊。
  assert.equal(marginEdge('right', 90), 'top');
  assert.equal(marginEdge('bottom', 90), 'right');
});

test('marginEdge：180 度', () => {
  assert.equal(marginEdge('right', 180), 'left');
  assert.equal(marginEdge('bottom', 180), 'top');
});

test('marginEdge：270 度順時針旋轉', () => {
  assert.equal(marginEdge('right', 270), 'bottom');
  assert.equal(marginEdge('bottom', 270), 'left');
});

test('marginEdge：角度正規化（-90、450 等同 270、90）', () => {
  assert.equal(marginEdge('right', -90), marginEdge('right', 270));
  assert.equal(marginEdge('right', 450), marginEdge('right', 90));
});

test('marginEdge：圓形性質——逆向映射必須是雙射', () => {
  // marginEdge 把「視覺邊」映射到「mediabox 邊」。
  // 如果向前旋轉 mediabox 邊，應該回到視覺邊。
  // 這鎖定了映射方向，防止將來反向。
  const EDGE_ORDER = ['top', 'right', 'bottom', 'left'];
  const forward = (edge, rotDeg) => {
    const i = EDGE_ORDER.indexOf(edge);
    const steps = ((Math.round(rotDeg / 90) % 4) + 4) % 4;
    return EDGE_ORDER[(i + steps) % 4];
  };

  for (const rotation of [0, 90, 180, 270]) {
    for (const visualEdge of EDGE_ORDER) {
      const mediaboxEdge = marginEdge(visualEdge, rotation);
      const recovered = forward(mediaboxEdge, rotation);
      assert.equal(recovered, visualEdge,
        `圓形失敗：visual ${visualEdge} @${rotation}° → mediabox ${mediaboxEdge} → forward → ${recovered}`);
    }
  }
});
