import test from 'node:test';
import assert from 'node:assert/strict';
import {brokerEstimate} from '../site/logic.js';
import {brokerProfileHtml} from '../site/broker-view.js';
test('profile has only 3 visible numeric broker thresholds and collapsed explanation',()=>{
 const estimate=brokerEstimate(2_250_000,0,true,[]);
 const html=brokerProfileHtml(2_250_000,estimate,0);
 assert.match(html,/Manter o prezo/);
 assert.match(html,/Subir un 15 %/);
 assert.match(html,/Baixar un 15 %/);
 assert.match(html,/Como funciona o bróker\?/);
 assert.match(html,/<details class="broker-explainer"><summary>/);
 assert.doesNotMatch(html,/<details[^>]* open/);
 assert.match(html,/>5</);
 assert.match(html,/>11,7</);
});
test('floor-limited players show the numerical threshold with a truthful footnote',()=>{
 const estimate=brokerEstimate(1_350_000,0,true);
 const html=brokerProfileHtml(1_350_000,estimate,0);
 assert.equal(estimate.canReachMinus15,false);
 assert.ok(Number.isFinite(estimate.thresholdMinus15));
 assert.ok(estimate.thresholdMinus15<0);
 assert.ok(estimate.maxDropPercent>-15);
 assert.match(html,/limiar teórico/);
 assert.match(html,/descenso do 15 % non é alcanzable/);
 assert.doesNotMatch(html,/Non alcanzable|NaN|undefined/);
});
test('three thresholds remain numeric for cheap and expensive players',()=>{
 for(const price of [700_000,1_350_000,2_250_000]){
  const estimate=brokerEstimate(price,0,true);
  assert.ok([estimate.expected,estimate.thresholdPlus15,estimate.thresholdMinus15].every(Number.isFinite));
  const html=brokerProfileHtml(price,estimate,0);
  assert.match(html,/Baixar un 15 %/);
  assert.match(html,/Subir un 15 %/);
 }
});
test('broker explanation is stable with games counted and no extra market actions',()=>{
 const html=brokerProfileHtml(700_000,brokerEstimate(700_000,0,true),2);
 assert.match(html,/Partidos Fantasy puntuados: 2/);
 assert.match(html,/20 % da diferenza/);
 assert.doesNotMatch(html,/data-action="toggle"|data-action="save-lineup"/);
});
