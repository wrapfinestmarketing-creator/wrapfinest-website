import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read('/home/user/wrapfinest-assets/models/hunyuan.glb');
const root = doc.getRoot();
for (const t of root.listTextures()) { const n=(t.getName()||'tex')+'_'+root.listTextures().indexOf(t); fs.writeFileSync(`/home/user/wrapfinest-assets/models/hy_${n}.${t.getMimeType().split('/')[1]}`, t.getImage()); console.log(n, t.getMimeType(), t.getSize(), t.getImage().length); }
const mat = root.listMaterials()[0];
console.log('base',mat.getBaseColorFactor(),'rough',mat.getRoughnessFactor(),'metal',mat.getMetallicFactor());
for (const node of root.listNodes()) console.log('node',node.getName(),node.getTranslation(),node.getRotation(),node.getScale());
const prim = root.listMeshes()[0].listPrimitives()[0];
const pos = prim.getAttribute('POSITION').getArray();
let min=[1e9,1e9,1e9],max=[-1e9,-1e9,-1e9];
for(let i=0;i<pos.length;i+=3) for(let k=0;k<3;k++){min[k]=Math.min(min[k],pos[i+k]);max[k]=Math.max(max[k],pos[i+k]);}
console.log('min',min,'max',max);
// low-vertex histogram along z for |x| near sides
const H=max[1]-min[1], bins=60, hist=new Array(bins).fill(0), lowY=new Array(bins).fill(1e9);
for(let i=0;i<pos.length;i+=3){ const b=Math.min(bins-1,Math.floor((pos[i+2]-min[2])/(max[2]-min[2])*bins)); lowY[b]=Math.min(lowY[b],pos[i+1]); if(pos[i+1]<min[1]+0.03*H) hist[b]++; }
console.log('ground-contact hist', hist.join(','));
console.log('lowY', lowY.map(v=>v.toFixed(3)).join(','));
// width profile by height
for (const f of [0.1,0.3,0.5,0.6,0.7,0.8,0.9]) { let mx=0; for(let i=0;i<pos.length;i+=3){ if(Math.abs(pos[i+1]-(min[1]+f*H))<0.01*H) mx=Math.max(mx,Math.abs(pos[i])); } console.log('halfwidth@',f,mx.toFixed(3)); }
