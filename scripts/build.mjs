import {cpSync,copyFileSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const dist=resolve(root,'dist');
if(!existsSync(dist))mkdirSync(dist,{recursive:true});
cpSync(resolve(root,'site'),dist,{recursive:true});
// These values are public browser configuration, not privileged credentials.
// Build-time environment variables can override them when rotating the publishable key.
const url=(process.env.PUBLIC_SUPABASE_URL||'https://vfxazecrdxrtoqzdhclh.supabase.co').trim();
const key=(process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY||"sb_publishable_yOC2_6nCxFeB8hnGdwXqLA_Y0FZafiK").trim();
if(url&&!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))throw Error('PUBLIC_SUPABASE_URL must be a Supabase HTTPS project URL');
if(key && !(key.startsWith('sb_publishable_') || key.startsWith('eyJ')))throw Error('Only Supabase publishable / legacy anon key is permitted in frontend.');
if(/^sb_secret_|service_role/i.test(key))throw Error('A secret key cannot be embedded in a static build.');
writeFileSync(resolve(dist,'config.js'), 'window.FANTASY_CONFIG='+JSON.stringify({url,key})+';\n');
copyFileSync(resolve(root,'site/index.html'),resolve(dist,'index.html'));
console.log('Built Fantasy CB Redeiras in dist/. Config:',url?'project configured':'awaiting public project key');
