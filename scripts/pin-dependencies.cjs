const fs=require('fs');
const p=JSON.parse(fs.readFileSync('package.json','utf8'));
const l=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
for(const g of ['dependencies','devDependencies']){
  for(const n of Object.keys(p[g]||{})){
    const hit=l.packages?.['node_modules/'+n];
    if(!hit?.version) throw new Error('Version introuvable: '+n);
    p[g][n]=hit.version;
  }
}
fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');
