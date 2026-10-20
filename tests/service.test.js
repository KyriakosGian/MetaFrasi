import test from 'node:test';
import assert from 'node:assert/strict';
import {createService,authorizeMessage} from '../shared/service.js';
import {DEFAULTS, DEFAULT_INSTRUCTIONS, MAX_INSTRUCTIONS_LENGTH} from '../shared/core.js';
function fixture(customClient = {}) {
  const data = {settings:{...DEFAULTS,apiKey:'fake-key',cloudConsent:true},models:[{id:DEFAULTS.model,name:'Flash Lite'}]};
  const calls = [];
  const storage = {async get(key) {return structuredClone({[key]:data[key]});},async set(value) {Object.assign(data,structuredClone(value));}};
  const client = {async listModels() {return data.models;},async translate(key,model,task,signal,instructions) {calls.push({key,model,task,signal,instructions}); return {text:`${task.mode}:${task.targetLanguage}`,tokens:12};},...customClient};
  const service = createService({storage,client});
  return {data,calls,service};
}
const task = {requestId:'test-request',text:'A fictional passage.',mode:'translate',targetLanguage:'el'};
test('cache separates targets and modes and does not persist temporary language', async () => {
  const {service,calls,data} = fixture();
  assert.equal((await service.translate('1:0',task)).cached,false);
  assert.equal((await service.translate('1:0',task)).cached,true);
  await service.translate('1:0',{...task,mode:'summary'});
  await service.translate('1:0',{...task,targetLanguage:'de'});
  assert.equal(calls.length,3); assert.equal(data.settings.targetLanguage,'en');
});
test('preferences cannot overwrite the API key and key removal prevents future requests', async () => {
  const {service,data,calls} = fixture();
  await service.savePreferences({...DEFAULTS,apiKey:'attacker',targetLanguage:'el'});
  assert.equal(data.settings.apiKey,'fake-key');
  await service.disconnect();
  await assert.rejects(service.translate('1:0',task),/Connect your/);
  assert.equal(calls.length,0); assert.equal(data.settings.apiKey,'');
});
test('saved instructions remain private, override page-supplied instructions and invalidate cached results', async () => {
  const {service,calls,data}=fixture();
  await service.translate('1:0',task);
  const instructions='Use concise, formal language.';
  await service.savePreferences({...DEFAULTS,instructions});
  assert.equal(calls.length,1,'Saving instructions must not call Gemini');
  assert.equal((await service.getOptions()).instructions,instructions);
  assert.equal('instructions' in await service.getPublic(),false);
  assert.equal(data.settings.instructions,instructions);
  const result=await service.translate('1:0',{...task,instructions:'Page-supplied instructions'});
  assert.equal(result.cached,false);
  assert.equal(calls.at(-1).instructions,instructions);
  assert.equal('instructions' in calls.at(-1).task,false);
  await service.translate('1:0',{...task,mode:'summary'});
  assert.equal(calls.at(-1).instructions,instructions);
  await service.savePreferences({...DEFAULTS,instructions:'   '});
  assert.equal((await service.getOptions()).instructions,DEFAULT_INSTRUCTIONS);
  assert.equal((await service.translate('1:0',task)).cached,false);
  assert.equal(calls.at(-1).instructions,DEFAULT_INSTRUCTIONS);
});
test('invalid instruction updates are rejected and older preference clients preserve saved instructions', async () => {
  const {service,data}=fixture();
  await service.savePreferences({...DEFAULTS,instructions:'Retain technical terms.'});
  for (const instructions of [null, {}, 'x'.repeat(MAX_INSTRUCTIONS_LENGTH+1)]) {
    await assert.rejects(service.savePreferences({...DEFAULTS,instructions}),/4,000/);
    assert.equal(data.settings.instructions,'Retain technical terms.');
  }
  const {instructions,...oldPreferences}=DEFAULTS;
  await service.savePreferences({...oldPreferences,theme:'light'});
  assert.equal(data.settings.instructions,'Retain technical terms.');
});
test('changing instructions cancels an in-flight result produced with the old instructions', async () => {
  let resolve;
  const {service}=fixture({translate:async()=>new Promise(done=>{resolve=done;})});
  const pending=service.translate('1:0',task);
  await new Promise(done=>setImmediate(done));
  await service.savePreferences({...DEFAULTS,instructions:'Use a different tone.'});
  resolve({text:'Old instructions result',tokens:1});
  await assert.rejects(pending,/cancelled/);
});
test('no request is sent without consent or while paused', async () => {
  for (const change of [{cloudConsent:false},{enabled:false},{apiKey:''}]) {
    const {service,data,calls} = fixture(); Object.assign(data.settings,change);
    await assert.rejects(service.translate('1:0',task)); assert.equal(calls.length,0);
  }
});
test('connecting requires consent and clears account-dependent cached results', async () => {
  const {service,calls} = fixture();
  await service.translate('1:0',task);
  await assert.rejects(service.connect({apiKey:'another-fake-key',cloudConsent:false}));
  await service.connect({apiKey:'another-fake-key',cloudConsent:true});
  assert.equal((await service.translate('1:0',task)).cached,false);
  assert.equal(calls.at(-1).key,'another-fake-key');
});
test('pending requests are deduplicated per frame and cancellation cannot cross frames', async () => {
  let signal, resolve;
  const {service} = fixture({translate:async (...args) => {signal=args[3]; return new Promise(done => {resolve=done;});}});
  const first = service.translate('1:0',task);
  await new Promise(done => setImmediate(done));
  await assert.rejects(service.translate('1:0',task),/already running/);
  service.cancel('2:0',task.requestId); assert.equal(signal.aborted,false);
  service.cancel('1:0','wrong-id'); assert.equal(signal.aborted,false);
  service.cancel('1:0',task.requestId); assert.equal(signal.aborted,true);
  resolve({text:'late result',tokens:1}); await assert.rejects(first,/cancelled/);
});
test('changing a key discards a late response from the previous key', async () => {
  let resolve;
  const {service} = fixture({translate:async () => new Promise(done => {resolve=done;})});
  const pending = service.translate('1:0',task);
  await new Promise(done => setImmediate(done));
  await service.connect({apiKey:'new-fake-key',cloudConsent:true});
  resolve({text:'old-account result',tokens:1}); await assert.rejects(pending,/cancelled/);
});

test('a delayed key check cannot undo key removal or overwrite newer preferences', async () => {
  for (const action of ['disconnect', 'preferences']) {
    let finish;
    const {service, data} = fixture({listModels: () => new Promise(resolve => {finish = resolve;})});
    const pending = service.connect({apiKey: 'replacement-fake-key', cloudConsent: true});
    await new Promise(resolve => setImmediate(resolve));
    if (action === 'disconnect') await service.disconnect();
    else await service.savePreferences({...DEFAULTS, targetLanguage: 'de'});
    finish([{id: DEFAULTS.model, name: 'Flash Lite'}]);
    await assert.rejects(pending, /Settings changed while checking/);
    assert.equal(data.settings.apiKey, action === 'disconnect' ? '' : 'fake-key');
    if (action === 'preferences') assert.equal(data.settings.targetLanguage, 'de');
  }
});
test('privileged messages require the exact Settings origin and path', () => {
  const id='extension-id', url=`chrome-extension://${id}/options.html`;
  const page={id,url:'https://example.test',tab:{id:1},frameId:0};
  assert.equal(authorizeMessage({type:'GET_SETTINGS'},page,id,url),true);
  assert.equal(authorizeMessage({type:'GET_OPTIONS'},page,id,url),false);
  assert.equal(authorizeMessage({type:'CONNECT'},{id,url},id,url),true);
  assert.equal(authorizeMessage({type:'CONNECT'},{id,url:`${url}#instructions`},id,url),true);
  assert.equal(authorizeMessage({type:'SAVE_PREFERENCES'},{id,url:`${url}?spoof=1#instructions`},id,url),false);
  assert.equal(authorizeMessage({type:'CONNECT'},{id,url:`${url}?spoof=1`},id,url),false);
  assert.equal(authorizeMessage({type:'TRANSLATE'},{...page,id:'another-extension'},id,url),false);
  assert.equal(authorizeMessage({type:'UNKNOWN'},page,id,url),false);
});
