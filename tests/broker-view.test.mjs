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
test('floor-bound players show unavailable -15% rather than inventing a number',()=>{
 const html=brokerProfileHtml(1_350_000,brokerEstimate(1_350_000,0,true),0);
 assert.match(html,/Non alcanzable/);
 assert.match(html,/Neste prezo non é posible/);
 assert.doesNotMatch(html,/undefined|NaN/);
});
test('broker explanation is stable with games counted and no extra market actions',()=>{
 const html=brokerProfileHtml(700_000,brokerEstimate(700_000,0,true),2);
 assert.match(html,/Partidos Fantasy puntuados: 2/);
 assert.match(html,/20 % da diferenza/);
 assert.doesNotMatch(html,/data-action="toggle"|data-action="save-lineup"/);
});
