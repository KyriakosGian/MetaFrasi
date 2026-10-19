import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.METAFRASI_PLAYWRIGHT || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = path.join(root,'artifacts'); fs.mkdirSync(artifacts,{recursive:true});
const profile = fs.mkdtempSync(path.join(artifacts,'browser-profile-'));
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((request,response) => {
  const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if (!file.startsWith(root+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {response.writeHead(404);response.end();return;}
  response.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain'});fs.createReadStream(file).pipe(response);
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let context, page, worker, cdp, failures=0, passed=0;
const errors=[];
async function poll(check, message, timeout=5000) {
  const start=Date.now();
  while(Date.now()-start<timeout) {if(await check()) return; await new Promise(resolve=>setTimeout(resolve,50));}
  throw new Error(message);
}
async function element(selector) {
  const {root:documentNode}=await cdp.send('DOM.getDocument',{depth:-1,pierce:true});
  function find(node) {
    if(node.attributes?.includes('data-metafrasi')) return node;
    for(const child of [...(node.children||[]),...(node.shadowRoots||[])]) {const found=find(child);if(found)return found;}
  }
  const host=find(documentNode); if(!host)return null;
  if(selector===':host')return host.nodeId;
  return (await cdp.send('DOM.querySelector',{nodeId:host.shadowRoots[0].nodeId,selector})).nodeId || null;
}
async function ui(selector,fn,...args) {
  const nodeId=await element(selector); if(!nodeId)return undefined;
  const {object}=await cdp.send('DOM.resolveNode',{nodeId});
  const result=await cdp.send('Runtime.callFunctionOn',{objectId:object.objectId,functionDeclaration:fn.toString(),arguments:args.map(value=>({value})),returnByValue:true});
  return result.result.value;
}
async function click(selector) {
  const nodeId=await element(selector);assert.ok(nodeId,`Missing UI element ${selector}`);
  const {model}=await cdp.send('DOM.getBoxModel',{nodeId}); const b=model.border;
  await page.mouse.click((b[0]+b[2])/2,(b[1]+b[5])/2);
}
async function selectPassage(id='passage') {
  await page.locator('#'+id).evaluate(element => {
    const range=document.createRange();range.selectNodeContents(element);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
    element.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));
  });
  await poll(()=>ui(':host',function(){return !this.hidden;}),'Selection control did not appear.');
}
async function fixture() {await page.goto(origin+'/tests/fixtures/reading.html');await page.locator('#passage').waitFor();}
async function config(value) {await worker.evaluate(value=>Object.assign(globalThis.__test,value),value);}
async function test(name,fn) {
  try {await config({mode:'success',delay:0});await fixture();await fn();passed++;console.log('PASS '+name);}
  catch(error){failures++;console.error('FAIL '+name+': '+error.message);await page.screenshot({path:path.join(artifacts,`failure-${failures}.png`)}).catch(()=>{});}
}
try {
  const extensionPaths=[root,...(process.env.METAFRASI_TYPEPILOT?[process.env.METAFRASI_TYPEPILOT]:[])].join(',');
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,viewport:{width:1280,height:900},args:[`--disable-extensions-except=${extensionPaths}`,`--load-extension=${extensionPaths}`,'--disable-background-networking']});
  context.on('page',newPage=>newPage.on('pageerror',error=>errors.push(error.message)));
  // No test is allowed to reach a real external service.
  await context.route(/^https?:\/\//,route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  await poll(async()=>{worker=context.serviceWorkers().find(item=>item.url().endsWith('/background.js'));return Boolean(worker);},'Extension worker did not start.');
  // With two extensions, identify MetaFrasi through its manifest, not creation order.
  for(const candidate of context.serviceWorkers()) {
    if(await candidate.evaluate(()=>chrome.runtime.getManifest().name)==='MetaFrasi') {worker=candidate;break;}
  }
  const extensionId=new URL(worker.url()).host;
  await worker.evaluate(()=>{
    globalThis.__test={calls:[],mode:'success',delay:0};
    globalThis.fetch=async(url,options={})=>{
      if(!String(url).startsWith('https://generativelanguage.googleapis.com/'))throw new Error('Unexpected external request');
      const state=globalThis.__test;state.calls.push({url:String(url),body:options.body||'',hasKey:Boolean(options.headers?.['x-goog-api-key'])});
      if(String(url).includes('/models?'))return new Response(JSON.stringify({models:[
        {name:'models/gemini-3.5-flash-lite',displayName:'Gemini 3.5 Flash-Lite',supportedGenerationMethods:['generateContent']},
        {name:'models/gemini-3.8-flash',displayName:'Gemini 3.8 Flash',supportedGenerationMethods:['generateContent']},
        {name:'models/gemini-image',supportedGenerationMethods:['generateContent']}
      ]}),{status:200});
      if(state.delay)await new Promise((resolve,reject)=>{
        const timer=setTimeout(resolve,state.delay);options.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});
      });
      if(state.mode==='quota')return new Response('{}',{status:429});
      const prompt=JSON.parse(options.body).systemInstruction.parts[0].text;
      const text=state.mode==='html'?'<img src=x onerror=alert(1)>':prompt.includes('Summarize the supplied')?'Eine kurze Zusammenfassung in der Zielsprache.':'Η ανάγνωση αναδεικνύει νέες ιδέες. Η μετάφραση διατηρεί το νόημα και τις σημαντικές λεπτομέρειες.';
      return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({text})}]}}],usageMetadata:{totalTokenCount:30}}),{status:200});
    };
  });
  const options=await context.newPage();await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator('#api-key').fill('fake-browser-test-key');await options.locator('#consent').check();await options.locator('#connect').click();
  await options.getByText('Key accepted by Google and saved. Your model list is ready.').waitFor();
  assert.equal(await options.locator('#model-select option').count(),2);
  await options.locator('#target-language').selectOption('el');await options.locator('#save').click();
  await options.getByText('Preferences saved. Select a new passage to use them.').waitFor();
  await options.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await options.screenshot({path:path.join(artifacts,'settings-dark.png')});
  page=await context.newPage();cdp=await context.newCDPSession(page);
  await test('double-click shows Translate without sending a translation request',async()=>{
    const before=await worker.evaluate(()=>__test.calls.length);
    await page.locator('#passage').dblclick({position:{x:35,y:16}});
    await poll(()=>ui('#translate',function(){return this.textContent.includes('Greek');}),'Missing default-language button');
    assert.equal(await worker.evaluate(()=>__test.calls.length),before);
  });
  await test('full translation, plain-text result, caching and close',async()=>{
    await selectPassage();await click('#translate');
    await poll(()=>ui('#copy',function(){return !this.hidden;}),'Translation did not finish');
    assert.match(await ui('#output',function(){return this.textContent;}),/Η ανάγνωση/);
    const position=await ui(':host',function(){const b=this.getBoundingClientRect();return {left:b.left,top:b.top};});
    assert.ok(position.left>200&&position.top>100,'The result should be anchored beside the selected passage, not at the viewport origin.');
    await page.screenshot({path:path.join(artifacts,'translation.png')});
    await click('#back');await click('#translate');
    await poll(()=>ui('#meta',function(){return this.textContent.includes('cache');}),'Cache did not serve repeated request');
    await page.keyboard.press('Escape');assert.equal(await ui(':host',function(){return this.hidden;}),true);
  });
  await test('temporary language and summary preserve the saved default',async()=>{
    await selectPassage();await click('#expand');
    await ui('#language',function(value){this.value=value;this.dispatchEvent(new Event('change',{bubbles:true}));},'de');
    await click('#summarize');await poll(()=>ui('#copy',function(){return !this.hidden;}),'Summary did not finish');
    assert.equal(await ui('#output',function(){return this.textContent;}),'Eine kurze Zusammenfassung in der Zielsprache.');
    assert.match(await ui('#title',function(){return this.textContent;}),/Summary · German/);
    assert.equal(await worker.evaluate(async()=> (await chrome.storage.local.get('settings')).settings.targetLanguage),'el');
    await page.keyboard.press('Escape');await selectPassage('second');
    assert.match(await ui('#translate',function(){return this.textContent;}),/Greek/);
  });
  await test('native, rich and shadow editors do not activate MetaFrasi',async()=>{
    for(const selector of ['#editor','#rich','#input','#shadow-editor input']) {
      await page.locator(selector).dblclick();await new Promise(resolve=>setTimeout(resolve,180));
      assert.notEqual(await ui(':host',function(){return !this.hidden;}),true,`Unexpected control in ${selector}`);
    }
  });
  await test('model output cannot create markup in the page',async()=>{
    await config({mode:'html'});await selectPassage('second');await click('#translate');
    await poll(()=>ui('#copy',function(){return !this.hidden;}),'Result did not finish');
    assert.equal(await ui('#output',function(){return this.textContent;}),'<img src=x onerror=alert(1)>');
    assert.equal(await ui('#output',function(){return this.children.length;}),0);
  });
  await test('quota errors are visible and do not trigger automatic retries',async()=>{
    await config({mode:'quota'});await selectPassage('bottom');
    const count=await worker.evaluate(()=>__test.calls.length);await click('#translate');
    await poll(()=>ui('#output',function(){return this.textContent.includes('rate or usage limit');}),'Missing quota error');
    assert.equal(await worker.evaluate(()=>__test.calls.length),count+1);
  });
  await test('closing a pending request prevents a late result from reopening the panel',async()=>{
    await config({delay:1500});await selectPassage('bottom');await click('#translate');await page.keyboard.press('Escape');
    await new Promise(resolve=>setTimeout(resolve,1600));assert.equal(await ui(':host',function(){return this.hidden;}),true);
  });
  await test('overlay remains inside a narrow viewport',async()=>{
    await page.setViewportSize({width:420,height:720});await selectPassage();await click('#translate');
    await poll(()=>ui('#copy',function(){return !this.hidden;}),'Missing result');
    const bounds=await ui(':host',function(){const b=this.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};});
    assert.ok(bounds.left>=0&&bounds.right<=420&&bounds.top>=0&&bounds.bottom<=720,JSON.stringify(bounds));
    await page.setViewportSize({width:1280,height:900});
  });
  await test('website demo, responsive layout and English content',async()=>{
    await page.goto(origin+'/docs/');await page.locator('#demo-translate').click();
    assert.equal(await page.locator('#demo-result').isVisible(),true);
    await page.locator('#demo-menu').click();await page.locator('#demo-summary').click();
    assert.match(await page.locator('#demo-title').textContent(),/Summary/);
    await page.locator('#demo-close').click();
    await page.screenshot({path:path.join(artifacts,'website-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(artifacts,'website-mobile.png'),fullPage:true});
  });
  await options.locator('#theme').selectOption('light');await options.locator('#save').click();
  await options.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await options.screenshot({path:path.join(artifacts,'settings-light.png')});
  assert.deepEqual(errors,[],'Unexpected page errors');
  console.log(`Browser checks: ${passed} passed, ${failures} failed. All Gemini responses were mocked.`);
  fs.writeFileSync(path.join(artifacts,'browser-results.json'),JSON.stringify({passed,failures,errors,liveGeminiTested:false},null,2));
} finally {
  await context?.close();await new Promise(resolve=>server.close(resolve));
  // Only remove the disposable profile created by this run inside this workspace.
  const resolved=path.resolve(profile);
  if(!resolved.startsWith(path.resolve(artifacts)+path.sep)||!path.basename(resolved).startsWith('browser-profile-'))throw new Error('Unexpected test profile path');
  fs.rmSync(resolved,{recursive:true,force:true});
}
if(failures)process.exitCode=1;
