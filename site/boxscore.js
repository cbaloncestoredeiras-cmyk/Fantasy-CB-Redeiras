// Boxscore source columns; every metric here is informative, never Fantasy scoring.
export const BOX_FIELDS=[
 {key:'fg_made',label:'FGM',aliases:['fgm','tiroscampoanotados']},
 {key:'fg_attempted',label:'FGA',aliases:['fga','tiroscampointentados']},
 {key:'two_made',label:'2PM',aliases:['2pm','t2anotados']},
 {key:'two_attempted',label:'2PA',aliases:['2pa','t2intentados']},
 {key:'three_made',label:'3PM',aliases:['3pm','triplesanotados']},
 {key:'three_attempted',label:'3PA',aliases:['3pa','triplesintentados']},
 {key:'ft_made',label:'FTM',aliases:['ftm','tlm','tiroslibresanotados']},
 {key:'ft_attempted',label:'FTA',aliases:['fta','tla','tiroslibresintentados']},
 {key:'off_reb',label:'OREB',aliases:['oreb','rebotesofensivos']},
 {key:'def_reb',label:'DREB',aliases:['dreb','rebotesdefensivos']},
 {key:'steals',label:'STL',aliases:['stl','robos','recuperacions','recuperaciones','steals']},
 {key:'turnovers',label:'TOV',aliases:['tov','perdas','perdidas','turnovers']},
 {key:'blocks',label:'BLK',aliases:['blk','tapons','tapones','blocks']},
 {key:'shots_rejected',label:'SR',aliases:['sr','taponesrecibidos','shotsrejected']},
 {key:'fouls',label:'PF',aliases:['pf','faltascometidas','faltaspersonales']},
 {key:'fouls_drawn',label:'PFD',aliases:['pfd','faltasrecibidas']},
 {key:'eff',label:'EFF',aliases:['eff','efficiency']},
 {key:'plus_minus',label:'+/-',aliases:['+/-','plusminus','masmenos']}
];
export const BOX_PCT=[
 {key:'fg_pct',label:'FG%',made:'fg_made',attempted:'fg_attempted'},
 {key:'two_pct',label:'2P%',made:'two_made',attempted:'two_attempted'},
 {key:'three_pct',label:'3P%',made:'three_made',attempted:'three_attempted'},
 {key:'ft_pct',label:'FT%',made:'ft_made',attempted:'ft_attempted'}
];
export const BOX_KEYS=new Set([...BOX_FIELDS.map(f=>f.key),'rebounds','assists']);
export const recorded=(row,key)=>key==='rebounds'||key==='assists'||['steals','blocks','turnovers'].includes(key)
 ?row[key+'_recorded']===true:row[key]!==null&&row[key]!==undefined;
export function boxPercentage(made,attempted){
 if(made===null||made===undefined||attempted===null||attempted===undefined)return null;
 const n=Number(attempted);return n>0?Math.round(Number(made)*10000/n)/100:(n===0&&Number(made)===0?0:null);
}
