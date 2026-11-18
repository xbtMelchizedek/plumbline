/**
 * Offline getCredentialReceipt correlation harness.
 *
 * Published by @almondous on flop-labs/network#321 and reproduced here
 * with path layout arranged by scripts/apply-and-test.mjs. Fail-closed:
 * any accidental real fetch throws.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FlopClient as Original} from './client/package/dist/index.js';
import {FlopClient as Candidate} from './candidate/dist/index.js';
// Fail closed if any accidental real fetch is attempted. All client I/O is injected below.
globalThis.fetch=()=>{throw Error('Real network forbidden');};
const receipt=(id='request-a',state='estimated')=>({request_id:id,correlation_id:'task',model:'synthetic',reserved_spend:1,settled_spend:null,settled_spend_raw:null,terminal_event:null,channel_id:null,created_at:1,state,response_status:503});
for(const [name,Client,patched] of [['original',Original,false],['candidate',Candidate,true]]){
 function setup(responder){const calls=[];return {calls,client:new Client({baseURL:'https://synthetic.invalid/v1',apiKey:'SYNTHETIC',fetch:async (url,init)=>{calls.push({url,init});return responder(calls.length);}})};}
 const response=(r,status=200)=>new Response(JSON.stringify(r),{status,headers:{'content-type':'application/json'}});
 for(const state of ['reserved','estimated','settled','released'])test(`${name}: preserves ${state} and unknown amounts`,async()=>{const r=receipt('request-a',state),s=setup(()=>response(r));assert.deepEqual(await s.client.getCredentialReceipt('request-a'),r);assert.equal(s.calls.length,1);assert.equal(s.calls[0].init.method,'GET');});
 for(const id of ['request-b','REQUEST-A'])test(`${name}: mismatched ID ${id}`,async()=>{const s=setup(()=>response(receipt(id)));if(patched)await assert.rejects(s.client.getCredentialReceipt('request-a'),{name:'FlopValidationError',message:'Receipt request ID does not match requested ID'});else assert.equal((await s.client.getCredentialReceipt('request-a')).request_id,id);assert.equal(s.calls.length,1);});
 for(const status of [404,503])test(`${name}: HTTP ${status} no retry`,async()=>{const s=setup(()=>response({error:'synthetic'},status));await assert.rejects(s.client.getCredentialReceipt('request-a'),{name:'FlopHTTPError'});assert.equal(s.calls.length,1);});
 test(`${name}: transport failure no retry`,async()=>{const s=setup(()=>{throw Error('synthetic transport failure')});await assert.rejects(s.client.getCredentialReceipt('request-a'),{name:'FlopTransportError'});assert.equal(s.calls.length,1);});
 test(`${name}: malformed receipt`,async()=>{const r=receipt();delete r.state;const s=setup(()=>response(r));await assert.rejects(s.client.getCredentialReceipt('request-a'),{name:'FlopValidationError'});});
 test(`${name}: ID encoded as single segment`,async()=>{const id='request/a?b#c%',s=setup(()=>response(receipt(id)));assert.equal((await s.client.getCredentialReceipt(id)).request_id,id);assert.equal(s.calls[0].url,'https://synthetic.invalid/v1/keys/me/receipts/'+encodeURIComponent(id));});
 test(`${name}: malformed request has no I/O`,async()=>{const s=setup(()=>response(receipt()));await assert.rejects(s.client.getCredentialReceipt('..'),{name:'FlopValidationError'});assert.equal(s.calls.length,0);});
 test(`${name}: later reconciliation preserves raw precision`,async()=>{const settled={...receipt('request-a','settled'),settled_spend_raw:'123456789012345678901234567890'};const s=setup(n=>response(n===1?receipt():settled));assert.equal((await s.client.getCredentialReceipt('request-a')).state,'estimated');assert.deepEqual(await s.client.getCredentialReceipt('request-a'),settled);assert.equal(s.calls.length,2);});
}
