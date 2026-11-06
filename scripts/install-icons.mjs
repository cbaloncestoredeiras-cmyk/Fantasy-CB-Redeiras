// Offline-generated install icons in the official CB Redeiras navy and celeste.
// No third-party fonts, runtime fetches or opaque binary assets.
import {deflateSync} from 'node:zlib';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const table=new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}
const crc=bytes=>{let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
const be=n=>Buffer.from([(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]);
const chunk=(type,data)=>{const tag=Buffer.from(type,'ascii');return Buffer.concat([be(data.length),tag,data,be(crc(Buffer.concat([tag,data])))]);};
function icon(size){
 const rows=Buffer.alloc(size*(size*4+1)),colors=[[7,29,51,255],[51,169,219,255],[113,196,248,255],[244,252,255,255]];
 const edge=.095;
 for(let y=0;y<size;y++){rows[y*(size*4+1)]=0;for(let x=0;x<size;x++){
  const u=(x+.5)/size,v=(y+.5)/size;
  const dx=Math.max(edge-u,0,u-(1-edge)),dy=Math.max(edge-v,0,v-(1-edge));
  const inside=dx*dx+dy*dy<=edge*edge;
  let k=0;
  // Two simple tidal bands; recognisable at phone icon sizes.
  if(v>.75+Math.sin(u*8.4-.65)*.035)k=1;
  else if(v>.675+Math.sin(u*9.2+1)*.041)k=2;
  // Strong geometric R: upright, rounded bowl and diagonal stem.
  const stem=u>.285&&u<.38&&v>.235&&v<.68;
  const outer=Math.hypot((u-.455)/.155,(v-.36)/.132)<1;
  const inner=Math.hypot((u-.445)/.069,(v-.355)/.053)<1;
  const diagonal=Math.abs(u-(.335+(v-.49)*.75))<.051&&v>.49&&v<.73;
  if(stem||(outer&&!inner)||diagonal)k=3;
  const o=y*(size*4+1)+1+x*4;
  for(let c=0;c<4;c++)rows[o+c]=c===3&&!inside?0:colors[k][c];
 }}
 const ihdr=Buffer.concat([be(size),be(size),Buffer.from([8,6,0,0,0])]);
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
export function writeInstallIcons(target){
 mkdirSync(target,{recursive:true});
 for(const size of [180,192,512])writeFileSync(resolve(target,'fantasy-'+size+'.png'),icon(size));
}
