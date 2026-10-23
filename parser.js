(function(root){
const normalize=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\bavane\b|\bavenae\b/g,'avena').replace(/\blehce\b|\blehche\b/g,'leche').replace(/\bcpn\b/g,'con').replace(/\bpanes\b/g,'pan').replace(/\buna media\b/g,'media');
const numbers={un:1,una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,medio:.5,media:.5};
const amount='(?:1/2|\\d+(?:[.,]\\d+)?|un[ao]?|uno|dos|tres|cuatro|cinco|seis|medi[oa])';
const units='(?:gramos?|gr|g|mililitros?|ml|litros?|l|tazas?|vasos?|cucharadas?|cucharaditas?|rebanadas?|tajadas?|porciones?|platos?|unidades?)';
function number(x){return numbers[x]??(x==='1/2'?.5:Number(x.replace(',','.')))}
function parseMeal(input,A=root.Ayuno){let text=normalize(input),warnings=[],items=[],matches=[];if(/\bayer\b|\ba las\b|\d{1,2}:\d{2}/.test(text))warnings.push('La fecha y la hora de la frase no se interpretan automáticamente. Revisa el campo Fecha y hora antes de guardar.');
let aliases=A.foods.flatMap((f,index)=>[f[0],...f[4].split('|')].map(a=>({alias:normalize(a),index}))).sort((a,b)=>b.alias.length-a.alias.length);
let occupied=[];for(let {alias,index}of aliases){let re=new RegExp('\\b'+alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','g');for(let m of text.matchAll(re)){let start=m.index,end=start+m[0].length;if(occupied.some(x=>start<x.end&&end>x.start))continue;occupied.push({start,end});matches.push({start,end,index})}}
matches.sort((a,b)=>a.start-b.start);
for(let i=0;i<matches.length;i++){let m=matches[i],f=A.foods[m.index],before=text.slice(i?matches[i-1].end:0,m.start),after=text.slice(m.end,i+1<matches.length?matches[i+1].start:text.length);
if(/\b(?:sin|no)\s*$/.test(before)&&!f[0].includes('sin azúcar'))continue;
let q=before.match(new RegExp('('+amount+')\\s*('+units+')?\\s*(?:de\\s+)?$'));
let trailing=after.match(new RegExp('^\\s*(?:de\\s+)?('+amount+')\\s*('+units+')\\b'));if(trailing)q=trailing;
let count=q?number(q[1]):1,unit=q?.[2]||'',grams=f[3],note='Porción supuesta';
if(q){if(/^(g|gr|gramo)/.test(unit)){grams=count;note='Cantidad indicada'}else if(/^(ml|mililitro)/.test(unit)){grams=count;note='ml aproximados a g para el cálculo'}else if(/^(l|litro)$|^litros$/.test(unit)){grams=count*1000;note='Volumen indicado'}else if(/^(taza|vaso)/.test(unit)){let cup={'arroz cocido':160,'avena seca':80,'leche':240,'yogur natural':240,'quinua cocida':185,'lentejas cocidas':200,'frijoles cocidos':200,'fideos cocidos':140,'café sin azúcar':240,'té sin azúcar':240};grams=count*(cup[f[0]]||f[3]);note='Medida casera aproximada'}else if(/^cucharadita/.test(unit)){grams=count*(f[0]==='azúcar'?4:f[0]==='aceite'?4.5:5);note='Cucharadita aproximada'}else if(/^cucharada/.test(unit)){grams=count*(f[0]==='avena seca'?10:f[0]==='azúcar'?12:f[0]==='aceite'?14:15);note='Cucharada aproximada'}else{grams=count*f[3];note='Unidad o porción aproximada'}}
// Una taza de avena preparada es distinta de una taza de copos secos.
if(f[0]==='avena seca'&&!/\b(?:seca|secos|cruda|crudos)\b/.test(text)&&(!q||/^(taza|vaso|plato|porcion)/.test(unit))){grams=40*count;note='Avena preparada: supuesto de 40 g de copos secos por porción';}
if(f[0]==='leche'&&!q&&matches.some(x=>A.foods[x.index][0]==='avena seca')){let oat=items.find(x=>x.food==='avena seca');grams=oat?oat.grams/40*200:200;note='Leche entera supuesta: 200 ml por porción de avena';}
if(!Number.isFinite(grams)||grams<=0||grams>10000){warnings.push('Cantidad fuera de rango para '+f[0]+'. Corrige la frase.');continue}
items.push({food:f[0],grams:Math.round(grams*10)/10,note,index:m.index});}
let residual=text;for(let m of matches.slice().reverse())residual=residual.slice(0,m.start)+' '.repeat(m.end-m.start)+residual.slice(m.end);
residual=residual.replace(new RegExp('\\b'+units+'\\b','g'),' ').replace(new RegExp('\\b'+amount+'\\b','g'),' ').replace(/\b(desayune|desayuno|almorce|almuerzo|cene|cena|comi|tome|bebi|merende|merienda|hoy|ayer|de|con|y|e|el|la|los|las|unos|unas|sin|no|al|en|para|del|a|un|una|cocido|cocida|cocidos|cocidas|seco|seca|secos|secas|crudo|cruda|crudos|crudas|entera|natural|integral)\b/g,' ').replace(/[\d\s.,;:!?/()–-]+/g,' ').trim();
if(residual)warnings.push('No pude interpretar: «'+residual+'». Puede faltar una parte de tu comida; añádela manualmente o reformula.');
if(/\b(frit[oa]s?|empanizad[oa]|salsa|mantequilla|miel|chocolate|descremada|vegetal|soya|almendra)\b/.test(text))warnings.push('La preparación o el tipo de producto cambia los valores. Corrige los ingredientes y cantidades o usa el registro manual.');
if(!items.length)warnings.push('No encontré alimentos reconocidos. Prueba nombres simples como avena, leche, pan o huevo.');
let askSugar=items.some(x=>['avena seca','leche','café sin azúcar','té sin azúcar'].includes(x.food))&&!/\bazucar\b/.test(text);
return {items,warnings,askSugar,summary:items.map(x=>({...x,...A.estimate(x.food,x.grams,'g')}))};}
root.MealParser={parseMeal};if(typeof module!=='undefined')module.exports=root.MealParser;
})(typeof window!=='undefined'?window:globalThis);
