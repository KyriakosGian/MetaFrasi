import test from 'node:test';
import assert from 'node:assert/strict';
import {createGeminiClient} from '../shared/gemini.js';
const task={text:'Example text',mode:'translate',targetLanguage:'el'};
test('requests use a key header, omit credentials and do not put secrets in URLs', async () => {
  let recorded;
  const client=createGeminiClient(async (url,options) => {
    recorded={url,options};
    return {ok:true,json:async () => ({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"text":"Example result"}' }]}}],usageMetadata:{totalTokenCount:20}})};
  });
  const result=await client.translate('fake-private-key','gemini-3.5-flash-lite',task,AbortSignal.timeout(1000));
  assert.equal(result.text,'Example result'); assert.equal(result.tokens,20);
  assert.equal(recorded.url.includes('fake-private-key'),false);
  assert.equal(recorded.options.headers['x-goog-api-key'],'fake-private-key');
  assert.equal(recorded.options.credentials,'omit'); assert.equal(recorded.options.referrerPolicy,'no-referrer');
  assert.equal(JSON.stringify(recorded.options.body).includes('https://example'),false);
});
test('model discovery follows pagination and filters non-text endpoints', async () => {
  let calls=0;
  const client=createGeminiClient(async url => {
    calls++;
    if (calls===1) return {ok:true,json:async () => ({models:[{name:'models/gemini-audio',supportedGenerationMethods:['generateContent']}],nextPageToken:'next page'})};
    assert.match(url,/pageToken=next%20page/);
    return {ok:true,json:async () => ({models:[{name:'models/gemini-3.5-flash-lite',supportedGenerationMethods:['generateContent']}]})};
  });
  const models=await client.listModels('fake-key'); assert.equal(models.length,1); assert.equal(calls,2);
});
test('API failures expose friendly errors without server bodies or automatic retries', async () => {
  for (const status of [400,401,403,404,429,503]) {
    let calls=0;
    const client=createGeminiClient(async () => {calls++; return {ok:false,status,json:async () => ({error:{message:'private raw detail'}})};});
    await assert.rejects(client.translate('fake-key','gemini-3.5-flash-lite',task),error => !error.message.includes('private raw detail'));
    assert.equal(calls,1);
  }
});
test('network failure and aborted requests remain distinguishable', async () => {
  const client=createGeminiClient(async () => {throw new Error('private network detail');});
  await assert.rejects(client.translate('fake-key','gemini-3.5-flash-lite',task),/connect to Google/);
  const controller=new AbortController(); controller.abort();
  await assert.rejects(client.translate('fake-key','gemini-3.5-flash-lite',task,controller.signal),/cancelled or timed out/);
});
