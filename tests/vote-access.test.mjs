import test from 'node:test';
import assert from 'node:assert/strict';
import {canVoteFixture} from '../site/vote-access.js';

const fixture={id:'round5',ended_at:'2026-11-07T21:00:00.000Z'};
const start=Date.parse(fixture.ended_at);

test('coach access authorizes vote during the same 72-hour window',()=>{
 assert.equal(canVoteFixture(fixture,[],true,start+1),true);
 assert.equal(canVoteFixture(fixture,[],true,start-1),false);
 assert.equal(canVoteFixture(fixture,[],true,start+72*3600e3-1),true);
 assert.equal(canVoteFixture(fixture,[],true,start+72*3600e3),false);
});
test('non-coach admins get no voting rights automatically',()=>{
 assert.equal(canVoteFixture(fixture,[],false,start+1),false);
});
test('existing called players continue to vote normally',()=>{
 assert.equal(canVoteFixture(fixture,['round5'],false,start+1),true);
 assert.equal(canVoteFixture(fixture,['round6'],false,start+1),false);
});
test('a fixture without a valid end has no active vote',()=>{
 assert.equal(canVoteFixture({id:'round6',ended_at:null},[],true,start+1),false);
});
