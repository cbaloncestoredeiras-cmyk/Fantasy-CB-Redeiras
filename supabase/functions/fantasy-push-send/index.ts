// Private cron worker. No user JWT can invoke this endpoint: a distinct secret
// is required, and the database functions below only allow service_role EXECUTE.
import {createClient} from 'npm:@supabase/supabase-js@2.75.1';
import webpush from 'npm:web-push@3.6.7';

const equals=(a:string,b:string)=>{
 const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);
 let result=x.length^y.length;
 for(let i=0;i<Math.max(x.length,y.length);i++)result|=(x[i]||0)^(y[i]||0);
 return result===0;
};
const json=(code:number,body:unknown)=>new Response(JSON.stringify(body),{status:code,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
Deno.serve(async request=>{
 if(request.method!=='POST')return json(405,{error:'Method not allowed'});
 const secret=Deno.env.get('FANTASY_PUSH_CRON_SECRET')||'';
 const vapidPublic=Deno.env.get('VAPID_PUBLIC_KEY')||'';
 const vapidPrivate=Deno.env.get('VAPID_PRIVATE_KEY')||'';
 const subject=Deno.env.get('VAPID_SUBJECT')||'';
 const url=Deno.env.get('SUPABASE_URL')||'';
 const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 if(!secret||secret.length<32||!vapidPublic||!vapidPrivate||!subject||!serviceKey||!url)
  return json(503,{error:'Push delivery is not configured'});
 if(!equals(secret,request.headers.get('x-fantasy-cron-secret')||''))
  return json(403,{error:'Forbidden'});
 webpush.setVapidDetails(subject,vapidPublic,vapidPrivate);
 const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const claim=await admin.rpc('fantasy_push_claim',{p_limit:30});
 if(claim.error){
  console.error('Error claiming push reminder batch',claim.error.code);
  return json(500,{error:'Dispatch unavailable'});
 }
 let success=0,failed=0,invalid=0;
 for(const row of (claim.data||[])){
  const round=Number(row.round_number);
  // Never put identities, rosters or scores in a notification.
  const data=JSON.stringify({kind:'market-reminder',round:Number.isFinite(round)?round:0});
  let sent=false,dead=false;
  try{
   await webpush.sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth_key}},data,{
    TTL:3600,urgency:'normal',timeout:7500
   });
   sent=true;success++;
  }catch(error){
   failed++;const code=Number((error as {statusCode?:number}|null)?.statusCode||0);
   if(code===404||code===410){dead=true;invalid++;}
   // Do not log endpoint, auth keys or response bodies.
   console.warn('Push service rejected a notification',code||'unknown');
  }
  const done=await admin.rpc('fantasy_push_complete',{p_dispatch:row.dispatch_id,p_success:sent,p_invalid:dead});
  if(done.error)console.error('Error committing push dispatch',done.error.code);
 }
 return json(200,{processed:(claim.data||[]).length,delivered:success,failed,invalid});
});
