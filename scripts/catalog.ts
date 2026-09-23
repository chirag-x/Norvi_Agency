import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {seed,type Store} from '../packages/shared/model';
export async function writeCatalog(data:Store){
  // Only approved public fields enter the frontend snapshot. Never copy users, orders, or keys.
  const snapshot=JSON.stringify({products:data.products.filter(p=>p.status==='published'),settings:data.settings},null,2)+'\n';
  const file='packages/shared/catalog.json';
  let previous='';try{previous=await readFile(file,'utf8');}catch{}
  if(previous!==snapshot)await writeFile(file,snapshot);
}
export async function syncCatalog(){let data:Store;try{data=JSON.parse(await readFile('.local/preview.json','utf8'));}catch(e:any){if(e.code!=='ENOENT')throw e;data=seed();}await writeCatalog(data);}
