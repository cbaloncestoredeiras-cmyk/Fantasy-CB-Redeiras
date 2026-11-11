import test from 'node:test';
import assert from 'node:assert/strict';
import {rankingMoves} from '../site/ranking-trends.js';
const fixtures=[
 {id:'f5',round_number:5,status:'finalized'},
 {id:'f6',round_number:6,status:'finalized'},
 {id:'f7',round_number:7,status:'scheduled'}
];
test('ranking deltas use prior finalized snapshots only',()=>{
 const weekly=[{round_number:5,team_id:'a',round_points:10},{round_number:5,team_id:'b',round_points:20},
 {round_number:6,team_id:'a',round_points:50},{round_number:6,team_id:'b',round_points:0},
 {round_number:7,team_id:'b',round_points:1000}];
 const now=[{team_id:'a',position:1},{team_id:'b',position:2},{team_id:'new',position:3}];
 const moves=rankingMoves(fixtures,weekly,now);
 assert.equal(moves.get('a'),1);
 assert.equal(moves.get('b'),-1);
 assert.equal(moves.has('new'),false);
 assert.equal(rankingMoves(fixtures.slice(0,1),weekly,now).size,0);
});
test('movement uses rank ties instead of arbitrary player IDs',()=>{
 const weekly=[{round_number:5,team_id:'a',round_points:20},{round_number:5,team_id:'b',round_points:20}];
 const moves=rankingMoves(fixtures,weekly,[{team_id:'a',position:1},{team_id:'b',position:2}]);
 assert.equal(moves.get('a'),0);
 assert.equal(moves.get('b'),-1);
});
test('cannot display movements from unpublished or missing score snapshots',()=>{
 assert.equal(rankingMoves(fixtures,[],[{team_id:'a',position:1}]).size,0);
 assert.equal(rankingMoves(fixtures.map(f=>({...f,status:'scheduled'})),[{round_number:5,team_id:'a',round_points:10}],[{team_id:'a',position:1}]).size,0);
});
