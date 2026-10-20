import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {DEFAULT_INSTRUCTIONS} from '../shared/core.js';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.METAFRASI_PLAYWRIGHT || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = path.resolve(process.env.METAFRASI_TEST_ARTIFACTS || path.join(root,'artifacts')); fs.mkdirSync(artifacts,{recursive:true});
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
async function rect(selector=':host') {
  return ui(selector,function(){const b=this.getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom,width:b.width,height:b.height};});
}
async function drag(selector,dx,dy) {
  const b=await rect(selector),x=b.left+b.width/2,y=b.top+b.height/2;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(x+dx,y+dy,{steps:8});await page.mouse.up();
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
      const source=JSON.parse(JSON.parse(options.body).contents[0].parts[0].text).sourceText;
      const text=state.mode==='echo'?source:state.mode==='html'?'<img src=x onerror=alert(1)>':prompt.includes('Summarize the supplied')?'Eine kurze Zusammenfassung in der Zielsprache.':'Η ανάγνωση αναδεικνύει νέες ιδέες. Η μετάφραση διατηρεί το νόημα και τις σημαντικές λεπτομέρειες.';
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
    await page.screenshot({path:path.join(artifacts,'compact-button.png')});
  });
  await test('full translation, plain-text result, caching and close',async()=>{
    await selectPassage();await click('#translate');
    await poll(()=>ui('#copy',function(){return !this.hidden;}),'Translation did not finish');
    assert.match(await ui('#output',function(){return this.textContent;}),/Η ανάγνωση/);
    assert.match(await ui('#meta',function(){return this.textContent;}),/^\d+ ms · gemini-3\.5-flash-lite · 30 tokens$/);
    const position=await ui(':host',function(){const b=this.getBoundingClientRect();return {left:b.left,top:b.top};});
    assert.ok(position.left>200&&position.top>100,'The result should be anchored beside the selected passage, not at the viewport origin.');
    await page.screenshot({path:path.join(artifacts,'translation.png')});
    await click('#back');await click('#translate');
    await poll(()=>ui('#meta',function(){return this.textContent.includes('cache');}),'Cache did not serve repeated request');
    assert.match(await ui('#meta',function(){return this.textContent;}),/0 tokens \(cache\)/);
    await page.keyboard.press('Escape');assert.equal(await ui(':host',function(){return this.hidden;}),true);
  });
  await test('wider panel supports pointer and keyboard movement and resizing without API calls',async()=>{
    await selectPassage();await click('#translate');
    await poll(()=>ui('#copy',function(){return !this.hidden;}),'Missing result');
    assert.equal((await rect('#result')).width,460);
    const before=await rect(),calls=await worker.evaluate(()=>__test.calls.length);
    await drag('#move',-140,-120);
    let after=await rect();
    assert.ok(Math.abs(after.left-(before.left-140))<1&&Math.abs(after.top-(before.top-120))<1,'Dragging did not move the panel');
    const size=await rect('#result');
    await drag('#resize',120,130);
    let resized=await rect('#result');
    assert.ok(Math.abs(resized.width-(size.width+120))<1&&Math.abs(resized.height-(size.height+130))<1,'Dragging did not resize the panel');
    await ui('#move',function(){this.focus();});await page.keyboard.press('ArrowRight');
    assert.ok(Math.abs((await rect()).left-(after.left+10))<1);
    await ui('#resize',function(){this.focus();});await page.keyboard.press('ArrowDown');
    assert.ok(Math.abs((await rect('#result')).height-(resized.height+10))<1);
    assert.equal(await worker.evaluate(()=>__test.calls.length),calls,'Moving or resizing must not request a translation');
    resized=await rect('#result');
    await click('#back');await click('#translate');
    await poll(()=>ui('#copy',function(){return !this.hidden;}),'Missing repeated result');
    assert.equal((await rect('#result')).width,resized.width,'The chosen size should survive returning to the launcher');
    await page.screenshot({path:path.join(artifacts,'movable-panel.png')});
    await click('#close-result');assert.equal(await ui(':host',function(){return this.hidden;}),true);
  });
  await test('a pending translation keeps its dragged position when the response arrives',async()=>{
    await config({delay:1200});
    await page.locator('#second').evaluate(element=>{element.textContent='A delayed translation keeps its manually chosen position.';});
    await selectPassage('second');await click('#translate');await drag('#move',-160,-150);
    const moved=await rect();
    await poll(()=>ui('#copy',function(){return !this.hidden;}),'Delayed result did not finish');
    const completed=await rect();
    assert.ok(Math.abs(completed.left-moved.left)<1&&Math.abs(completed.top-moved.top)<1,'The completed result jumped back to the selection');
  });
  await test('dragging and resizing stay on screen and long results scroll inside the panel',async()=>{
    await config({mode:'echo'});
    await page.locator('#second').evaluate(element=>{element.textContent='A long passage for testing the scrolling translation window. '.repeat(35);});
    await selectPassage('second');await click('#translate');
    await poll(()=>ui('#copy',function(){return !this.hidden;}),'Long result did not finish');
    await drag('#move',-1500,-1500);
    let bounds=await rect();assert.equal(bounds.left,8);assert.equal(bounds.top,8);
    await drag('#resize',100,-2000);
    assert.equal((await rect('#result')).height,160);
    assert.equal(await ui('.body',function(){return this.scrollHeight>this.clientHeight;}),true);
    const copy=await rect('#copy');bounds=await rect();
    assert.ok(copy.bottom<=bounds.bottom&&copy.top>=bounds.top,'Result controls must remain visible');
    await drag('#resize',2000,2000);
    bounds=await rect();assert.ok(bounds.right<=1272&&bounds.bottom<=892,JSON.stringify(bounds));
    await drag('#resize',-2000,-2000);
    assert.equal((await rect('#result')).width,280);assert.equal((await rect('#result')).height,160);
    await drag('#move',2000,2000);
    bounds=await rect();assert.ok(bounds.right<=1272&&bounds.bottom<=892,JSON.stringify(bounds));
    await page.setViewportSize({width:320,height:260});
    await poll(async()=>{const b=await rect();return b.left>=8&&b.top>=8&&b.right<=312&&b.bottom<=252;},'Panel did not move inside the resized viewport');
    await ui('#original',function(){this.open=true;});
    await page.keyboard.press('Escape');
    await page.setViewportSize({width:1280,height:900});
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
  await test('HTML bullets and nested indentation survive selection and plain-text rendering',async()=>{
    await page.goto(origin+'/tests/fixtures/lists.html');await config({mode:'echo'});
    await selectPassage('bullets');await click('#translate');
    await poll(()=>ui('#copy',function(){return !this.hidden;}),'List result did not finish');
    const output=await ui('#output',function(){return this.textContent;});
    assert.match(output,/^• First item\./m);assert.match(output,/^  ◦ Nested first item\./m);
    assert.match(output,/^  ◦ Nested second item\./m);assert.match(output,/^• Second item\./m);
    assert.equal(/HIDDEN|Unselected/.test(output),false);
    assert.equal(await ui('#output',function(){return this.children.length;}),0);
    await page.screenshot({path:path.join(artifacts,'list-translation.png')});
  });
  await test('partial ordered selection retains original numbering without extra text',async()=>{
    await page.goto(origin+'/tests/fixtures/lists.html');await config({mode:'echo'});
    await page.evaluate(()=>{
      const start=document.getElementById('ordered-start').firstChild,end=document.getElementById('ordered-end').firstChild;
      const range=document.createRange();range.setStart(start,0);range.setEnd(end,end.length);
      const selected=getSelection();selected.removeAllRanges();selected.addRange(range);
      document.getElementById('ordered').dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));
    });
    await poll(()=>ui(':host',function(){return !this.hidden;}),'No partial-list control');await click('#translate');
    await poll(()=>ui('#copy',function(){return !this.hidden;}),'Ordered result did not finish');
    assert.equal(await ui('#output',function(){return this.textContent;}),'5. Start here.\n9. Jump here.\n10. Continue here.');
  });
  await test('reversed, alphabetical, roman and mixed-block lists retain structure',async()=>{
    await page.goto(origin+'/tests/fixtures/lists.html');await config({mode:'echo'});
    for(const [id,expected] of [
      ['reversed','7. Reverse first.\n6. Reverse second.'],
      ['letters','B. Letter first.\nC. Letter second.'],
      ['roman','iv. Roman first.\nv. Roman second.']
    ]) {
      await selectPassage(id);await click('#translate');await poll(()=>ui('#copy',function(){return !this.hidden;}),'Missing formatted list result');
      assert.equal(await ui('#output',function(){return this.textContent;}),expected);await page.keyboard.press('Escape');
    }
    await selectPassage('mixed');await click('#translate');await poll(()=>ui('#copy',function(){return !this.hidden;}),'Missing mixed selection result');
    const output=await ui('#output',function(){return this.textContent;});
    assert.match(output,/A selected introduction\.\n/);assert.match(output,/^• A selected bullet\./m);assert.match(output,/\nA selected conclusion\.$/);
    assert.equal(output.includes('Unselected'),false);
  });
  await test('a word selected inside a list stays a word without surrounding item text',async()=>{
    await page.goto(origin+'/tests/fixtures/lists.html');await config({mode:'echo'});
    await page.evaluate(()=>{
      const item=document.getElementById('ordered-start'),range=document.createRange();range.setStart(item.firstChild,6);range.setEnd(item.firstChild,10);
      const selected=getSelection();selected.removeAllRanges();selected.addRange(range);item.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));
    });
    await poll(()=>ui(':host',function(){return !this.hidden;}),'No word control');await click('#translate');
    await poll(()=>ui('#copy',function(){return !this.hidden;}),'Missing word result');
    assert.equal(await ui('#output',function(){return this.textContent;}),'here');
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
  await test('editable instructions save, survive reload, reach both actions and reset without speculative requests',async()=>{
    const editor=options.locator('#translation-instructions');
    assert.equal(await editor.inputValue(),DEFAULT_INSTRUCTIONS);
    assert.equal(await editor.getAttribute('maxlength'),'4000');
    const custom='Use a formal tone and retain product names.';
    const calls=await worker.evaluate(()=>__test.calls.length);
    await editor.fill(custom);await options.locator('#save').click();
    await options.getByText('Preferences saved. Select a new passage to use them.').waitFor();
    assert.equal(await worker.evaluate(()=>__test.calls.length),calls);
    await options.reload();await poll(async()=>await editor.inputValue()===custom,'Instructions were not restored after reload');
    await options.locator('nav a[href="#instructions"]').click();
    await options.locator('#instructions').screenshot({path:path.join(artifacts,'translation-instructions.png')});
    await selectPassage();await click('#translate');
    await poll(()=>ui('#copy',function(){return !this.hidden;}),'Missing custom-instructions translation');
    let body=await worker.evaluate(()=>JSON.parse(__test.calls.at(-1).body));
    assert.ok(body.systemInstruction.parts[0].text.includes(custom));
    await page.keyboard.press('Escape');await selectPassage('second');await click('#expand');await click('#summarize');
    await poll(()=>ui('#copy',function(){return !this.hidden;}),'Missing custom-instructions summary');
    body=await worker.evaluate(()=>JSON.parse(__test.calls.at(-1).body));
    assert.ok(body.systemInstruction.parts[0].text.includes(custom));
    assert.match(body.systemInstruction.parts[0].text,/Summarize the supplied/);
    const afterRequests=await worker.evaluate(()=>__test.calls.length);
    await options.locator('#reset-instructions').click();
    assert.equal(await editor.inputValue(),DEFAULT_INSTRUCTIONS);
    assert.equal(await worker.evaluate(async()=>(await chrome.storage.local.get('settings')).settings.instructions),custom,'Reset should wait for Save preferences');
    await options.locator('#save').click();
    await options.getByText('Preferences saved. Select a new passage to use them.').waitFor();
    assert.equal(await worker.evaluate(()=>__test.calls.length),afterRequests);
    await options.reload();await poll(async()=>await editor.inputValue()===DEFAULT_INSTRUCTIONS,'Reset did not persist');
    assert.equal(await options.locator('#page-status').textContent(),'','Reloading a Settings section must retain privileged access');
    assert.equal(await options.locator('#save').isEnabled(),true);
    await editor.fill('Unsaved draft retained during model discovery.');await options.locator('#connect').click();
    await options.getByText('Key accepted by Google and saved. Your model list is ready.').waitFor();
    assert.equal(await editor.inputValue(),'Unsaved draft retained during model discovery.');
    await options.reload();await poll(async()=>await editor.inputValue()===DEFAULT_INSTRUCTIONS,'Unsaved instructions should not be stored');
    await options.setViewportSize({width:390,height:844});
    await options.locator('nav a[href="#instructions"]').click();
    assert.equal(await options.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await options.locator('#instructions').screenshot({path:path.join(artifacts,'translation-instructions-mobile.png')});
    await options.setViewportSize({width:1280,height:900});
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
