import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, PDFString, StandardFonts } from '../vendor/pdf-lib.esm.min.js';

// The old samples have repeated content: page counts alone cannot detect a
// duplicate, omitted or misplaced page. Keep fixtures local and deterministic.
const markedFixtures = new Map();
for (const [name, ids] of [
  ['marked-8p.pdf', ['P01','P02','P03','P04','P05','P06','P07','P08']],
  ['marked-fronts.pdf', ['F1','F2','F3']],
  ['marked-backs.pdf', ['B3','B2','B1']],
]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const id of ids) {
    const page = pdf.addPage([400, 600]);
    page.drawText(id, { x: 40, y: 500, font, size: 48 });
    page.node.set(PDFName.of('WizardPage'), PDFString.of(id));
  }
  markedFixtures.set('/test-fixtures/' + name, await pdf.save());
}

const root = process.cwd(), scratch = resolve('.wiz2-check'), artifacts = resolve('docs/verification/wiz2');
await mkdir(scratch, { recursive: true });
await mkdir(artifacts, { recursive: true });
const profile = await mkdtemp(resolve(scratch, 'profile-'));
const mime = { '.html':'text/html; charset=utf-8', '.mjs':'text/javascript', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.pdf':'application/pdf', '.png':'image/png', '.bcmap':'application/octet-stream' };
const server = http.createServer(async (req,res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const body = markedFixtures.get(new URL(req.url, base).pathname) || await readFile(path === root ? resolve(root, 'index.html') : path);
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0,'127.0.0.1',r));
const base = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
  '--no-sandbox','--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { stdio:['ignore','ignore','pipe'], windowsHide:true });
chrome.stderr.on('data',chunk=>{ if (process.env.CHROME_DEBUG) process.stderr.write(chunk); });
chrome.on('exit',(code,signal)=>console.log('Chrome exit',code,signal));
const chromeClosed = new Promise(resolve => chrome.once('close', resolve));
const delay = ms => new Promise(r => setTimeout(r,ms));
let pages;
for (let i=0;i<30;i++) { try { const port=(await readFile(resolve(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]; pages=await (await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1000)})).json(); if(pages.length) break; } catch {} await delay(100); }
if (!pages) throw new Error('Chrome unavailable');
const ws = new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
console.log('Connecting CDP');
await new Promise(r=>ws.addEventListener('open',r));
let id=0; const pending=new Map(), errors=[], external=[], downloads=[], checks=[];
ws.addEventListener('message',e=>{
  const msg=JSON.parse(e.data);
  if(msg.id) { const p=pending.get(msg.id); pending.delete(msg.id); if(msg.error) p.reject(new Error(JSON.stringify(msg.error))); else p.resolve(msg.result); }
  if(msg.method==='Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails);
  if(msg.method==='Runtime.consoleAPICalled' && msg.params.type==='error') errors.push(msg.params.args);
  if(msg.method==='Network.requestWillBeSent' && /^https?:/.test(msg.params.request.url) && !msg.params.request.url.startsWith(base)) external.push(msg.params.request.url);
  if(msg.method==='Browser.downloadWillBegin') downloads.push(msg.params);
});
const send=(method,params={})=>new Promise((resolve,reject)=>{ const current=++id; const timer=setTimeout(()=>reject(new Error('CDP timeout '+method)),30000); pending.set(current,{resolve:r=>{clearTimeout(timer);resolve(r);},reject}); ws.send(JSON.stringify({id:current,method,params})); });
const evaluate=async expression=>{
  const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});
  if(result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};
const wait=async(expression,timeout=20000)=>{const start=Date.now();while(Date.now()-start<timeout){if(await evaluate(expression))return;await delay(50);}throw new Error('Timed out: '+expression);};
const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const go=async path=>{await send('Page.navigate',{url:base+path});await wait(`document.querySelector('[data-app-chrome]') && document.querySelector('#lang-toggle')?.textContent`);await delay(100);};
const viewport=width=>send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
const shot=async name=>{const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(resolve(artifacts,name+'.png'),Buffer.from(result.data,'base64'));};
const check=async(label,expression)=>{assert.ok(await evaluate(expression),label);checks.push(label);console.log('PASS',label);};
const upload=async(drop,paths)=>{
  await evaluate(`(async()=>{const dt=new DataTransfer();for(const path of ${JSON.stringify(paths)}){const blob=await(await fetch(path)).blob();dt.items.add(new File([blob],decodeURIComponent(path.split('/').pop()),{type:blob.type}));}const input=document.querySelector(${JSON.stringify(drop)}).nextElementSibling;input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
};
const visible=`e=>e.getClientRects().length>0 && getComputedStyle(e).visibility!=='hidden'`;
const ready = `document.querySelector('[data-step="3"]')?.hidden===false`;
const settings = `document.querySelector('[data-step="2"]')?.hidden===false`;
const captureDownload = () => evaluate(`window.__delivery=[];HTMLAnchorElement.prototype.click=function(){if(this.download){window.__delivery.push(this.download);fetch(this.href).then(r=>r.arrayBuffer()).then(b=>window.__deliveryBytes=new Uint8Array(b));}};`);
const pageIDs = `async bytes => {const {PDFDocument,PDFName}=await import('/vendor/pdf-lib.esm.min.js');const pdf=await PDFDocument.load(bytes);return pdf.getPages().map(p=>p.node.get(PDFName.of('WizardPage'))?.decodeText());}`;
const rename = name => evaluate(`document.querySelector('#download-name').value=${JSON.stringify(name)};document.querySelector('#download-name').dispatchEvent(new Event('input',{bubbles:true}));`);
const storedCount = `new Promise((resolve,reject)=>{const req=indexedDB.open('pdf-toolbox-handoff',1);req.onsuccess=()=>{const db=req.result;const tx=db.transaction('results','readonly');const count=tx.objectStore('results').count();count.onsuccess=()=>resolve(count.result);tx.oncomplete=()=>db.close();tx.onerror=()=>reject(tx.error);};req.onerror=()=>reject(req.error);})`;
const seedHandoff = ({ id, targetTool, age = 0 }) => evaluate(`(async()=>{const bytes=new Uint8Array(await(await fetch('/test-fixtures/sample-8p.pdf')).arrayBuffer());await new Promise((resolve,reject)=>{const req=indexedDB.open('pdf-toolbox-handoff',1);req.onsuccess=()=>{const db=req.result;const tx=db.transaction('results','readwrite');tx.objectStore('results').put({id:${JSON.stringify(id)},targetTool:${JSON.stringify(targetTool)},name:'seed.pdf',bytes,createdAt:Date.now()-${age}});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};req.onerror=()=>reject(req.error);});})()`);
async function layout(label) {
  const overflow=await evaluate(`document.documentElement.scrollWidth>innerWidth`);
  assert.equal(overflow,false,label+' overflow');
  checks.push(label+' no overflow');
  console.log('PASS',label,'no overflow');
}

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await mkdir(resolve(scratch,'downloads'),{recursive:true});
await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:resolve(scratch,'downloads'),eventsEnabled:true});
try {
  await viewport(1440); await go('/index.html');
  await check('home links and one shared header',`document.querySelectorAll('main a.tool-card').length===7 && document.querySelectorAll('#lang-toggle').length===1 && document.querySelectorAll('.menu-pop a').length===8`);
  await shot('home-desktop');
  for(const width of [320,375,760,1000,1440]){await viewport(width);await layout('home zh '+width);}
  await viewport(375);await shot('home-mobile');
  await click('#lang-toggle');await wait(`document.documentElement.lang==='en'`);
  for(const width of [320,375,760,1000,1440]){await viewport(width);await layout('home en '+width);}
  await viewport(1440);await go('/tools/merge.html');
  await check('merge starts in upload step',`!document.querySelector('[data-step="1"]').hidden && document.querySelector('[data-step="2"]').hidden && document.querySelector('[data-step="3"]').hidden`);
  await upload('#drop',['/test-fixtures/sample-8p.pdf','/test-fixtures/sample-12p.pdf']);
  await wait(`document.querySelector('#summary-pages').textContent.includes('20')`);
  await check('merge metadata 20 pages and step 2',`document.querySelector('[data-step="1"]').hidden && !document.querySelector('[data-step="2"]').hidden && document.querySelectorAll('.filelist li').length===2`);
  await evaluate(`(()=>{const list=document.querySelector('.filelist');const dt=new DataTransfer();list.children[0].dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));list.children[1].dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:dt}));})()`);
  await check('drag ordering',`document.querySelector('.filelist .name').textContent==='sample-12p.pdf'`);
  await evaluate(`(()=>{const list=document.querySelector('.filelist');const dt=new DataTransfer();list.children[0].dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));list.children[1].dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:dt}));})()`);
  await evaluate(`document.querySelector('.filelist li:nth-child(2) .move').focus()`);
  await click('.filelist li:nth-child(2) .move');
  await check('arrow ordering',`document.querySelector('.filelist .name').textContent==='sample-12p.pdf'`);
  await check('keyboard focus follows moved row',`document.activeElement.closest('li')===document.querySelector('.filelist li') && document.activeElement.classList.contains('move')`);
  await click('[data-wizard-action="upload"]');
  await check('back upload keeps file list',`!document.querySelector('[data-step="1"]').hidden && document.querySelector('[data-step="1"] .filelist li .name').textContent==='sample-12p.pdf'`);
  await upload('#drop',['/test-fixtures/fronts.pdf']);
  await wait(`document.querySelectorAll('.filelist li').length===3`);
  await click('.filelist li:nth-child(2) .remove');
  await upload('#drop',['/test-fixtures/backs-reversed.pdf']);
  await check('deleted file stays deleted on add',`document.querySelectorAll('.filelist li').length===3 && ![...document.querySelectorAll('.filelist .name')].some(el=>el.textContent==='sample-8p.pdf')`);
  await click('#lang-toggle');await wait(`document.documentElement.lang==='zh-Hant'`);
  await wait(`document.querySelector('#summary-pages').textContent.includes('18')`);
  await shot('merge-sort-desktop');
  for(const width of [320,375,760,1000,1440]){await viewport(width);await layout('merge sort zh '+width);}
  await viewport(375);await shot('merge-sort-mobile');
  await check('file buttons have 44px targets',`[...document.querySelectorAll('.row-actions button')].filter(${visible}).every(e=>e.getBoundingClientRect().width>=44 && e.getBoundingClientRect().height>=44)`);
  await viewport(1440);
  await evaluate(`window.__downloads=[];const original=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download)window.__downloads.push({name:this.download,href:this.href});else original.call(this);}`);
  await evaluate(`(()=>{document.querySelector('#run').click();window.__runningLocked=document.querySelector('#drop').getAttribute('aria-disabled')==='true' && [...document.querySelectorAll('.filelist button')].every(b=>b.disabled);document.querySelector('.filelist .remove').dispatchEvent(new MouseEvent('click',{bubbles:true}));window.__guardKeptFiles=document.querySelectorAll('.filelist li').length===3;})()`);
  await check('running locks upload and list',`window.__runningLocked`);
  await check('running guard rejects direct list events',`window.__guardKeptFiles`);
  await wait(`!document.querySelector('[data-step="3"]').hidden`);
  await check('completion does not auto download',`window.__downloads.length===0 && document.querySelector('[data-result-meta]').textContent.includes('18')`);
  await click('#lang-toggle');await wait(`document.documentElement.lang==='en'`);
  await check('dynamic completion language and default name',`document.querySelector('#download-name').value.toLowerCase().includes('merged') && document.querySelector('[data-result-meta]').textContent.includes('18 pages')`);
  await evaluate(`document.querySelector('#download-name').value='teacher-final.pdf';document.querySelector('#download-name').dispatchEvent(new Event('input',{bubbles:true}));`);
  await click('#lang-toggle');await wait(`document.documentElement.lang==='zh-Hant'`);
  await check('custom filename survives language switch',`document.querySelector('#download-name').value==='teacher-final.pdf'`);
  await click('#wantCompress');
  await check('precompression locks download',`document.querySelector('#download').disabled`);
  await wait(`!document.querySelector('#download').disabled`,60000);
  await check('larger compression uses original with explanation',`document.querySelector('[data-compress-msg]').textContent.includes('沒有比原檔小')`);
  await click('#download');
  await check('download keeps editable name',`window.__downloads.at(-1).name==='teacher-final.pdf'`);
  await shot('merge-complete-desktop');
  for(const width of [320,375,760,1000,1440]){await viewport(width);await layout('merge complete zh '+width);}
  await viewport(375);await shot('merge-complete-mobile');
  await evaluate(`window.__idbOpen=IDBFactory.prototype.open;IDBFactory.prototype.open=function(){throw new Error('test blocked storage');};`);
  await click('[data-target-tool="margin"]');
  await wait(`!document.querySelector('[data-download-msg]').hidden && document.querySelector('[data-download-msg]').classList.contains('error')`);
  await check('blocked IndexedDB write shows a translated error and stays on result',`location.pathname.endsWith('/merge.html') && document.querySelector('[data-download-msg]').textContent.includes('IndexedDB') && !document.querySelector('#download').disabled`);
  await evaluate(`IDBFactory.prototype.open=window.__idbOpen`);
  await click('[data-wizard-action="adjust"]');
  await click('.filelist li .remove');
  await check('changing files invalidates completion',`!document.querySelector('[data-step="2"]').hidden && document.querySelector('[data-step="3"]').hidden`);
  await click('#run');await wait(`!document.querySelector('[data-step="3"]').hidden`);
  await click('[data-wizard-action="restart"]');
  await check('restart clears everything',`!document.querySelector('[data-step="1"]').hidden && document.querySelectorAll('.filelist li').length===0`);

  await evaluate(`(async()=>{const {PDFDocument}=await import('/vendor/pdf-lib.esm.min.js');const pdf=await PDFDocument.create();const image=await pdf.embedPng(await(await fetch('/test-fixtures/images-to-pdf/phone-portrait.png')).arrayBuffer());pdf.addPage([595,842]).drawImage(image,{x:0,y:0,width:595,height:842});const dt=new DataTransfer();dt.items.add(new File([await pdf.save()],'raster.pdf',{type:'application/pdf'}));const input=document.querySelector('#drop').nextElementSibling;input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`document.querySelector('#summary-pages').textContent==='1 頁'`);
  await click('#run');await wait(`!document.querySelector('[data-step="3"]').hidden`);
  await evaluate(`HTMLAnchorElement.prototype.click=function(){if(this.download){window.__capturedName=this.download;window.__blobPromise=fetch(this.href).then(r=>r.arrayBuffer()).then(b=>window.__capturedBytes=new Uint8Array(b));}}`);
  await click('#wantCompress');
  await click('input[value="strong"]');
  await click('input[value="light"]');
  await wait(`!document.querySelector('#download').disabled`,60000);
  await check('rapid compression choices keep latest result',`document.querySelector('input[value="light"]').checked && !document.querySelector('[data-saving]').hidden && document.querySelector('[data-compress-msg]').hidden`);
  await click('#download');await wait(`window.__capturedBytes?.length>0`);
  await check('compressed download retains page count and actual size',`(async()=>{const {PDFDocument}=await import('/vendor/pdf-lib.esm.min.js');const {formatSize}=await import('/assets/core/naming.mjs');return (await PDFDocument.load(window.__capturedBytes)).getPageCount()===1 && document.querySelector('[data-download-size]').textContent.includes(formatSize(window.__capturedBytes.length));})()`);
  await click('input[value="standard"]');await wait(`!document.querySelector('#download').disabled`,60000);
  await check('standard compression reduces raster PDF',`!document.querySelector('[data-saving]').hidden`);
  await click('input[value="strong"]');await wait(`!document.querySelector('#download').disabled`,60000);
  await check('strong compression reduces raster PDF',`!document.querySelector('[data-saving]').hidden`);
  await shot('merge-compressed-mobile');
  await click('#lang-toggle');await wait(`document.documentElement.lang==='en'`);
  await check('compressed dynamic text updates language',`document.querySelector('[data-saving]').textContent.includes('smaller') && document.querySelector('[data-download-note]').textContent==='All 1 pages retained'`);
  for(const width of [320,375,760,1000,1440]){await viewport(width);await layout('merge complete en '+width);}
  await click('#wantCompress');
  await check('turn compression off restores original size',`document.querySelector('[data-compression-options]').hidden && document.querySelector('[data-saving]').hidden`);
  await click('[data-wizard-action="adjust"]');await click('#run');await wait(`!document.querySelector('[data-step="3"]').hidden`);
  await evaluate(`window.__getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=()=>null;`);
  await click('#wantCompress');await wait(`!document.querySelector('#download').disabled`,60000);
  await check('compression failure leaves original downloadable',`document.querySelector('[data-compress-msg]').classList.contains('error') && document.querySelector('[data-compress-msg]').textContent.includes('original') && !document.querySelector('#download').disabled`);
  await evaluate(`HTMLCanvasElement.prototype.getContext=window.__getContext`);
  await click('[data-wizard-action="restart"]');
  await evaluate(`(()=>{const dt=new DataTransfer();dt.items.add(new File(['not a pdf'],'broken.pdf',{type:'application/pdf'}));const input=document.querySelector('#drop').nextElementSibling;input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await click('#run');await wait(`!document.querySelector('#msg').hidden && document.querySelector('#msg').classList.contains('error')`);
  console.log('Error message',await evaluate(`document.querySelector('#msg').textContent`));
  await check('per-file error attribution in English',`document.querySelector('#msg').textContent.includes('broken.pdf') && !/[\\u3400-\\u9fff]/.test(document.querySelector('#msg').textContent)`);
  await click('#lang-toggle');await wait(`document.documentElement.lang==='zh-Hant'`);
  await check('nested error reason updates language',`document.querySelector('#msg').textContent.includes('broken.pdf') && document.querySelector('#msg').textContent.includes('損壞')`);

  await go('/index.html');
  await evaluate(`(async()=>{
    document.querySelector('main').innerHTML='<div data-wizard><ol data-stepper>'+[1,2,3].map(n=>'<li data-step-number="'+n+'"><span class="num"></span><span data-i18n="wizard.settings"></span></li>').join('')+'</ol><section data-step="1"><h1 tabindex="-1">Upload</h1><div id="drop" class="dropzone">PDF</div></section><section data-step="2" hidden><h2 tabindex="-1">Review</h2><ul id="filelist"></ul><button id="run">Run</button></section><section data-step="3" hidden><div data-completion></div></section><div id="msg" hidden></div></div>';
    const {mountTool}=await import('/assets/core/toolpage.mjs');
    const bytes=new Uint8Array(await(await fetch('/test-fixtures/fronts.pdf')).arrayBuffer());
    window.__multiCtrl=await mountTool({dropEl:document.querySelector('#drop'),listEl:document.querySelector('#filelist'),runBtn:document.querySelector('#run'),msgEl:document.querySelector('#msg'),multiple:true,run:async()=>[{name:'one.pdf',bytes},{name:'two.pdf',bytes}]});
    HTMLAnchorElement.prototype.click=function(){if(this.download){window.__zipName=this.download;fetch(this.href).then(r=>r.arrayBuffer()).then(b=>window.__zipBytes=new Uint8Array(b));}};
  })()`);
  // The legacy ZIP helper expects JSZip to be supplied by each tool page.
  await evaluate(`new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/jszip.min.js';script.onload=resolve;script.onerror=reject;document.head.append(script);})`);
  await upload('#drop',['/test-fixtures/fronts.pdf']);await click('#run');await wait(`!document.querySelector('[data-step="3"]').hidden`);
  await check('shared multi-output UI hides compression and handoff',`document.querySelector('[data-single]').hidden && document.querySelector('[data-next]').hidden && !document.querySelector('[data-multiple]').hidden && document.querySelector('[data-multi-count]').textContent.includes('2')`);
  await click('[data-download-zip]');await wait(`window.__zipBytes?.length>0`);
  await check('shared multi-output creates real ZIP',`(async()=>{const zip=await JSZip.loadAsync(window.__zipBytes);return window.__zipName.endsWith('.zip') && Object.keys(zip.files).length===2;})()`);

  for(const tool of ['split','interleave','images-to-pdf','organize','nup','margin']) {
    await viewport(1440);await go('/tools/'+tool+'.html');
    await check(tool+' shared chrome and three-step shell',`document.querySelectorAll('#lang-toggle').length===1 && document.querySelector('.app-footer') && document.querySelectorAll('[data-step-number]').length===3 && !document.querySelector('[data-step="1"]').hidden && document.querySelector('[data-step="2"]').hidden && document.querySelector('[data-step="3"]').hidden`);
    for(const width of [375,760,1440]){await viewport(width);await layout(tool+' upload zh '+width);}
    if(tool==='interleave') {
      await upload('#dropFront',['/test-fixtures/marked-fronts.pdf']);await upload('#dropBack',['/test-fixtures/marked-backs.pdf']);
      await wait(`!document.querySelector('#run').disabled`);
    } else await upload('#drop',[tool==='images-to-pdf'?'/test-fixtures/images-to-pdf/portrait.png':'/test-fixtures/marked-8p.pdf']);
    if(tool==='organize') {
      await wait(`document.querySelectorAll('.thumb canvas').length===8 && !document.querySelector('#run').disabled`);
      await click('.thumb:first-child .acts button:nth-child(3)');
      await check('organize rotation updates thumbnail',`document.querySelector('.thumb:first-child canvas').style.transform==='rotate(90deg)'`);
      await click('.thumb:nth-child(2) .acts button:nth-child(4)');
      await check('organize page deletion updates summary',`document.querySelectorAll('.thumb.removed').length===1 && document.querySelector('#kept').textContent.includes('7')`);
      await click('.thumb:nth-child(2) .acts button:nth-child(4)');
      await click('.thumb:first-child .acts button:nth-child(2)');
      await check('organize keyboard reorder moves the rotated page',`document.querySelector('.thumb:nth-child(2) canvas').style.transform==='rotate(90deg)'`);
      await click('.thumb:nth-child(2) .acts button:first-child');
    }
    if(tool==='split') {await wait(`document.querySelector('#pagecount').textContent.includes('8')`);await click('#preview');await wait(`!document.querySelector('#previewCard').hidden`);}
    await wait(`!document.querySelector('#run').disabled`);
    await wait(settings);
    await check(tool+' settings and summary visible',`!document.querySelector('[data-step="2"]').hidden && !!document.querySelector('[data-step="2"] .side-panel')`);
    for(const width of [375,760,1000,1440]){await viewport(width);await layout(tool+' settings zh '+width);}
    await shot(tool+'-settings-desktop');
    await viewport(375);await shot(tool+'-settings-mobile');
    if(tool!=='images-to-pdf') {
      await check(tool+' mobile single-file remove stays alongside text',`[...document.querySelectorAll('.filelist li')].every(row=>{const button=row.querySelector('.remove').getBoundingClientRect(), info=row.querySelector('.file-info').getBoundingClientRect(), paper=row.querySelector('.paper-thumb').getBoundingClientRect();return button.left>=info.right && button.top<paper.bottom && button.bottom>paper.top && button.width>=44;})`);
      await evaluate(`window.__shortName=document.querySelector('.filelist .name').textContent;document.querySelector('.filelist .name').textContent='A-very-long-unique-classroom-document-name-abcdefghijklmnopqrstuvwxyz-0123456789.pdf';`);
      await layout(tool+' long filename 375');
      await check(tool+' long filename wraps within text area',`(()=>{const row=document.querySelector('.filelist li'),name=row.querySelector('.name').getBoundingClientRect(),button=row.querySelector('.remove').getBoundingClientRect();return name.height>30 && name.right<=button.left && button.right<=row.getBoundingClientRect().right;})()`);
      await shot(tool+'-long-filename-mobile');
      await evaluate(`document.querySelector('.filelist .name').textContent=window.__shortName`);
    }
    if(tool==='split') await check('split mode has a unique translated fieldset legend',`document.querySelector('fieldset.split-modes legend').textContent==='拆分方式' && [...document.querySelectorAll('fieldset.split-modes label')].filter(e=>e.textContent==='每 N 頁一份').length===1`);
    await click('#lang-toggle');await wait(`document.documentElement.lang==='en'`);
    for(const width of [375,760,1000]){await viewport(width);await layout(tool+' settings en '+width);}
    await check(tool+' settings title translates immediately',`!/[\u3400-\u9fff]/.test(document.querySelector('[data-step="2"] h1').textContent)`);
    if(tool==='split') await check('split preview translates immediately',`document.querySelector('#previewBody').textContent.includes('p.1-4') && !/[\u3400-\u9fff]/.test(document.querySelector('#previewBody').textContent)`);
    await click('[data-wizard-action="upload"]');
    await check(tool+' back to upload preserves selection',`!document.querySelector('[data-step="1"]').hidden && document.querySelectorAll('.filelist li').length>0`);
    await click('[data-wizard-action="adjust"][data-continue]');await wait(settings);
    // Save failure exercises the real tool path after loading/copying pages.
    // An already-disabled option (or thumbnail button) must stay disabled.
    await evaluate(`(async()=>{
      window.__settings=[...document.querySelectorAll('[data-step="2"] input,[data-step="2"] select,[data-step="2"] textarea,#thumbs button')];
      window.__sentinel=window.__settings.at(-1);window.__sentinel.disabled=true;
      window.__disabledBefore=window.__settings.map(el=>el.disabled);
      const {PDFDocument}=await import('/vendor/pdf-lib.esm.min.js');window.__save=PDFDocument.prototype.save;
      PDFDocument.prototype.save=async function(){throw new Error('verification save failure');};
      document.querySelector('#run').click();
      window.__failureLocked=window.__settings.every(el=>el.disabled);
      if('${tool}'==='organize'){const lang=document.documentElement.lang;document.documentElement.lang=lang==='en'?'zh-Hant':'en';document.documentElement.lang=lang;}
    })()`);
    await check(tool+' settings lock immediately on failed run',`window.__failureLocked`);
    await wait(`document.querySelector('#msg').classList.contains('error') && document.querySelector('#msg').textContent.includes('verification save failure')`);
    await check(tool+' failure restores input and original disabled states',`[...document.querySelectorAll('[data-step="2"] input,[data-step="2"] select,[data-step="2"] textarea,#thumbs button')].every((el,i)=>el.disabled===window.__disabledBefore[i]) && !document.querySelector('#run').disabled && [...document.querySelectorAll('.dropzone')].every(el=>el.getAttribute('aria-disabled')==='false')`);
    await evaluate(`(async()=>{const {PDFDocument}=await import('/vendor/pdf-lib.esm.min.js');PDFDocument.prototype.save=window.__save;})()`);
    await captureDownload();
    await evaluate(`(()=>{
      window.__values=window.__settings.map(el=>({value:el.value,checked:el.checked}));
      document.querySelector('#run').click();
      window.__successLocked=window.__settings.every(el=>el.disabled);
      window.__settings.forEach(el=>el.click());
      window.__clicksBlocked=window.__settings.every((el,i)=>el.value===window.__values[i].value && el.checked===window.__values[i].checked);
      // Force mutable DOM values as a second line of defence: snapshots must
      // keep producing the selected layout even across subsequent awaits.
      window.__settings.filter(el=>el.type==='radio').forEach(el=>{el.checked=el.value==='4'||el.value==='bottom'||el.value==='landscape'||el.value==='each';});
      for(const id of ['gutter','size','everyN']){const el=document.getElementById(id);if(el)el.value='50';}
      const reverse=document.querySelector('#reverse');if(reverse)reverse.checked=false;
    })()`);
    await check(tool+' successful run locks settings and rejects setting clicks',`window.__successLocked && window.__clicksBlocked`);
    await wait(ready,30000);
    await check(tool+' success restores original disabled states',`window.__settings.every((el,i)=>el.disabled===window.__disabledBefore[i])`);
    await evaluate(`window.__settings.forEach((el,i)=>{if(el.tagName!=='BUTTON'){el.value=window.__values[i].value;el.checked=window.__values[i].checked;}});`);
    await check(tool+' completion waits for explicit download',`window.__delivery.length===0 && !!document.querySelector('[data-completion-heading]').textContent`);
    await check(tool+' does not offer itself as a handoff target',`!document.querySelector('[data-target-tool="${tool}"]') && !document.querySelector('[data-target-tool="images-to-pdf"]') && document.querySelectorAll('[data-target-tool]').length<=3`);
    if(tool==='split') {
      await check('split multiple results only offer ZIP',`document.querySelector('[data-single]').hidden && document.querySelector('[data-next]').hidden && !document.querySelector('[data-multiple]').hidden && document.querySelector('[data-multi-count]').textContent.includes('2')`);
      await click('[data-download-zip]');await wait(`window.__deliveryBytes?.length>0`);
      await check('split ZIP page identity and order survive attempted setting changes',`(async()=>{const zip=await JSZip.loadAsync(window.__deliveryBytes);const files=Object.values(zip.files).filter(f=>!f.dir);const ids=await Promise.all(files.map(async f=>(${pageIDs})(await f.async('uint8array'))));return JSON.stringify(ids)===JSON.stringify([['P01','P02','P03','P04'],['P05','P06','P07','P08']]);})()`);
    } else {
      await rename(tool+'-checked.pdf');
      await check(tool+' single PDF completion has filename compression and handoff',`!document.querySelector('[data-single]').hidden && !!document.querySelector('#wantCompress') && !document.querySelector('[data-next]').hidden`);
      await click('#download');await wait(`window.__deliveryBytes?.length>0`);
      const expectedPages = {'interleave':6,'images-to-pdf':1,'organize':8,'nup':4,'margin':8}[tool];
      await check(tool+' downloaded PDF has expected name and page count',`(async()=>{const {PDFDocument}=await import('/vendor/pdf-lib.esm.min.js');return window.__delivery[0]==='${tool}-checked.pdf' && (await PDFDocument.load(window.__deliveryBytes)).getPageCount()===${expectedPages};})()`);
      if(tool==='organize') await check('organize output retains selected rotation',`(async()=>{const {PDFDocument}=await import('/vendor/pdf-lib.esm.min.js');return (await PDFDocument.load(window.__deliveryBytes)).getPage(0).getRotation().angle===90;})()`);
      if(tool==='interleave') await check('interleave exact front/back identity and order retain reverse snapshot',`(async()=>JSON.stringify(await (${pageIDs})(window.__deliveryBytes))===JSON.stringify(['F1','B1','F2','B2','F3','B3']))()`);
      if(tool==='organize') await check('organize keeps exact page identities during locked actions',`(async()=>JSON.stringify(await (${pageIDs})(window.__deliveryBytes))===JSON.stringify(['P01','P02','P03','P04','P05','P06','P07','P08']))()`);
      if(tool==='nup'||tool==='margin'||tool==='images-to-pdf') await check(tool+' output retains original layout despite forced DOM setting mutation',`(async()=>{const {PDFDocument}=await import('/vendor/pdf-lib.esm.min.js');const p=(await PDFDocument.load(window.__deliveryBytes)).getPage(0),s=p.getSize();return ${tool==='nup'?'s.width>s.height':tool==='images-to-pdf'?'s.height>s.width':'Math.abs(s.width-(400+40*72/25.4))<0.01 && s.height===600'};})()`);
    }
    for(const width of [375,760,1440]){await viewport(width);await layout(tool+' complete en '+width);}
    await click('#lang-toggle');await wait(`document.documentElement.lang==='zh-Hant'`);
    await check(tool+' completion title translates immediately',`/[\u3400-\u9fff]/.test(document.querySelector('[data-completion-heading]').textContent)`);
    for(const width of [375,760,1440]){await viewport(width);await layout(tool+' complete zh '+width);}
    await shot(tool+'-complete-desktop');
    await viewport(375);await shot(tool+'-complete-mobile');
    await click('[data-wizard-action="restart"]');
    await check(tool+' restart clears selection',`!document.querySelector('[data-step="1"]').hidden && document.querySelectorAll('.filelist li').length===0`);
  }

  await viewport(1440);await go('/tools/merge.html');
  await upload('#drop',['/test-fixtures/sample-8p.pdf','/test-fixtures/sample-12p.pdf']);
  await click('#run');await wait(ready);await rename('relay-merged.pdf');
  await click('[data-target-tool="margin"]');
  await wait(`location.pathname.endsWith('/margin.html') && ${settings} && document.querySelector('#msg').textContent.includes('relay-merged.pdf')`);
  await check('merge handoff enters margin step 2 with editable name and notice',`document.querySelector('.filelist .name').textContent==='relay-merged.pdf' && !location.search.includes('handoff') && document.querySelector('#msg').dataset.i18n==='handoff.loaded'`);
  await check('consumed merge record is immediately removed',`(async()=>await ${storedCount}===0)()`);
  await click('#lang-toggle');await wait(`document.documentElement.lang==='en'`);
  await check('handoff loaded notice updates language',`document.querySelector('#msg').textContent==='Loaded the previous result: relay-merged.pdf'`);
  await click('#run');await wait(ready);await rename('relay-margin.pdf');
  await check('margin completion omits margin card',`!document.querySelector('[data-target-tool="margin"]')`);
  await click('[data-target-tool="nup"]');
  await wait(`location.pathname.endsWith('/nup.html') && ${settings} && document.querySelector('.filelist .name')?.textContent==='relay-margin.pdf'`);
  await wait(`document.querySelector('#sheetsInfo').textContent.includes('20') && document.querySelector('#sheetsInfo').textContent.includes('10')`);
  await check('margin handoff enters nup with original page count',`!location.search.includes('handoff') && document.querySelector('#msg').textContent.includes('relay-margin.pdf')`);
  await check('consumed margin record is immediately removed',`(async()=>await ${storedCount}===0)()`);
  await captureDownload();await click('#run');await wait(ready);await click('#download');await wait(`window.__deliveryBytes?.length>0`);
  await check('merge margin nup chain downloads ten-page PDF',`(async()=>{const {PDFDocument}=await import('/vendor/pdf-lib.esm.min.js');return (await PDFDocument.load(window.__deliveryBytes)).getPageCount()===10 && !document.querySelector('[data-target-tool="nup"]');})()`);
  await shot('handoff-nup-complete');
  await go('/tools/nup.html');
  await check('refresh after handoff does not load a second time',`!document.querySelector('[data-step="1"]').hidden && document.querySelectorAll('.filelist li').length===0`);

  await seedHandoff({id:'expired-case',targetTool:'margin',age:3600001});
  await go('/tools/margin.html?handoff=expired-case');
  await wait(`document.querySelector('#msg').dataset.i18n==='handoff.expired'`);
  await check('expired record is deleted without loading',`(async()=>await ${storedCount}===0 && document.querySelectorAll('.filelist li').length===0)()`);
  await seedHandoff({id:'once-case',targetTool:'margin'});
  await check('same handoff record can only be consumed once',`(async()=>{const {consumeHandoff}=await import('/assets/core/handoff.mjs');const file=await consumeHandoff('once-case','margin');try{await consumeHandoff('once-case','margin');return false;}catch(e){return file.name==='seed.pdf' && e.i18nKey==='handoff.missing';}})()`);
  await check('blocked IndexedDB read reports translated failure',`(async()=>{const {consumeHandoff}=await import('/assets/core/handoff.mjs');const original=IDBFactory.prototype.open;IDBFactory.prototype.open=function(){throw new Error('test blocked');};try{await consumeHandoff('blocked-case','margin');return false;}catch(e){return e.i18nKey==='handoff.readFailed';}finally{IDBFactory.prototype.open=original;}})()`);
  await go('/tools/margin.html?handoff=missing-case');
  await wait(`document.querySelector('#msg').dataset.i18n==='handoff.missing'`);
  await check('missing handoff leaves upload available with visible error',`!document.querySelector('[data-step="1"]').hidden && document.querySelector('#msg').classList.contains('error')`);

  await evaluate(`(async()=>{const {PDFDocument}=await import('/vendor/pdf-lib.esm.min.js');const pdf=await PDFDocument.load(await(await fetch('/test-fixtures/sample-8p.pdf')).arrayBuffer());const payload=new Uint8Array(19*1024*1024);for(let i=0;i<payload.length;i+=65536)crypto.getRandomValues(payload.subarray(i,Math.min(i+65536,payload.length)));await pdf.attach(payload,'large-test.bin');const bytes=await pdf.save();window.__largeHandoffSize=bytes.length;const {handoff}=await import('/assets/core/handoff.mjs');await handoff(bytes,'large-relay.pdf','nup');})()`);
  await wait(`location.pathname.endsWith('/nup.html') && ${settings} && document.querySelector('.filelist .name')?.textContent==='large-relay.pdf'`,30000);
  await wait(`document.querySelector('#sheetsInfo').textContent.includes('8')`);
  await check('IndexedDB transfers a real PDF larger than 18 MB',`(async()=>{const {formatSize}=await import('/assets/core/naming.mjs');const input=document.querySelector('#drop').nextElementSibling;return document.querySelector('.filelist .size').textContent.includes('19.') && document.querySelector('#sheetsInfo').textContent.includes('4') && await ${storedCount}===0;})()`);
  // Delay IndexedDB's success callback before the application sees it. This
  // exercises the upload/list/job collision window on real mounted pages.
  for (const tool of ['nup','margin','split','interleave','organize']) {
    await seedHandoff({id:'delayed-'+tool,targetTool:tool});
    const hook = await send('Page.addScriptToEvaluateOnNewDocument', { source: `
      const originalOpen=window.__originalOpen=IDBFactory.prototype.open;
      IDBFactory.prototype.open=function(...args){
        const request=originalOpen.apply(this,args);
        Object.defineProperty(request,'onsuccess',{set(handler){
          request.addEventListener('success',event=>{
            window.__idbWaiting=true;
            window.__releaseIDB=()=>handler.call(request,event);
          });
        }});
        return request;
      };
    ` });
    try {
      await go('/tools/'+tool+'.html?handoff=delayed-'+tool);
      await wait(`window.__idbWaiting===true`);
      const drop = tool==='interleave' ? '#dropFront' : '#drop';
      await check(tool+' delayed handoff holds upload and processing lock',`[...document.querySelectorAll('.dropzone')].every(el=>el.getAttribute('aria-disabled')==='true' && el.nextElementSibling.disabled) && document.querySelector('#run').disabled && document.querySelector('[data-wizard]').getAttribute('aria-busy')==='true'`);
      await upload(drop, ['/test-fixtures/marked-8p.pdf']);
      await evaluate(`document.querySelector('#run').dispatchEvent(new MouseEvent('click',{bubbles:true}));`);
      await check(tool+' delayed handoff rejects manual selection and direct job events',`document.querySelectorAll('.filelist li').length===0 && document.querySelector('[data-step="3"]').hidden && document.querySelector('#msg').hidden`);
      await evaluate(`window.__releaseIDB()`);
      await wait(`document.querySelector('#msg').dataset.i18n==='handoff.loaded' && document.querySelector('[data-wizard]').getAttribute('aria-busy')==='false'`,30000);
      await check(tool+' delayed handoff releases input only after applying the relay',`document.querySelector('.filelist .name').textContent==='seed.pdf' && [...document.querySelectorAll('.dropzone')].every(el=>el.getAttribute('aria-disabled')==='false')`);
      await upload(drop, ['/test-fixtures/marked-8p.pdf']);
      await wait(`document.querySelector('.filelist .name')?.textContent==='marked-8p.pdf'`);
      await check(tool+' manual selection works again after relay completes',`document.querySelector('#msg').dataset.i18n!=='handoff.loaded' || document.querySelector('#msg').hidden || document.querySelector('#msg').dataset.i18n==='organize.rendering'`);
    } finally {
      await evaluate(`IDBFactory.prototype.open=window.__originalOpen`);
      await send('Page.removeScriptToEvaluateOnNewDocument', {identifier:hook.identifier});
    }
  }

  // Also force a newer selection/job generation independently of disabled UI.
  // Late successful reads and late errors must leave both state and notice alone.
  for (const collision of ['manual','processing','missing']) {
    await go('/index.html');
    if (collision!=='missing') await seedHandoff({id:'stale-'+collision,targetTool:'nup'});
    await evaluate(`(async()=>{
      const {createInputGuard}=await import('/assets/core/wizard-state.mjs');
      const {receiveHandoff}=await import('/assets/core/handoff.mjs');
      window.__relayGuard=createInputGuard();window.__relayApplied=false;window.__relayNotices=[];
      const original=IDBFactory.prototype.open;
      IDBFactory.prototype.open=function(...args){const request=original.apply(this,args);Object.defineProperty(request,'onsuccess',{set(handler){request.addEventListener('success',event=>{window.__releaseStale=()=>handler.call(request,event);});}});return request;};
      history.replaceState(null,'','?handoff=stale-${collision}');
      window.__relayDone=receiveHandoff({targetTool:'nup',inputGuard:window.__relayGuard,onFile:()=>{window.__relayApplied=true;},onLoaded:()=>window.__relayNotices.push('loaded'),onError:key=>window.__relayNotices.push(key)});
      IDBFactory.prototype.open=original;
    })()`);
    await wait(`typeof window.__releaseStale==='function'`);
    await evaluate(`window.__relayGuard.invalidate();window.__selected='manual.pdf';window.__processing=${collision==='processing'};window.__releaseStale();window.__relayDone`);
    await check('late relay preserves newer '+collision+' state without stale notices',`!window.__relayApplied && window.__selected==='manual.pdf' && window.__relayNotices.length===0 && !window.__relayGuard.locked`);
  }

  assert.deepEqual(external,[],'external requests');
  assert.deepEqual(errors,[],'console exceptions');
  console.log('PASS zero external requests and zero browser exceptions');
  await writeFile(resolve(artifacts,'browser-result.json'),JSON.stringify({external,errors,downloads,checks,passed:true},null,2)+'\n');
} finally {
  await send('Browser.close').catch(()=>{});ws.close();server.close();
  await Promise.race([chromeClosed, delay(3000)]);
  if (chrome.exitCode === null && chrome.signalCode === null) chrome.kill();
  if (!profile.startsWith(scratch + sep)) throw new Error('Unexpected browser profile path');
  // Windows 的 Crashpad 可能在瀏覽器關閉後仍短暫持有 profile，不能把清理失敗誤報為驗證失敗。
  await rm(profile, {recursive:true,force:true,maxRetries:10,retryDelay:300}).catch(error => {
    if (!['EBUSY', 'EPERM'].includes(error.code)) throw error;
    console.warn('Temporary Chrome profile is still locked:', profile);
  });
}
