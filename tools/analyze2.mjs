import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read('/home/user/wrapfinest-assets/models/hunyuan.glb');
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const p = prim.getAttribute('POSITION').getArray();
const n = p.length/3; const X=new Float32Array(n),Y=new Float32Array(n),Z=new Float32Array(n);
for(let i=0;i<n;i++){X[i]=p[3*i];Y[i]=-p[3*i+2];Z[i]=p[3*i+1];}
const mm=a=>[Math.min(...a.subarray(0,1)),0]; let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
for(let i=0;i<n;i++){mn[0]=Math.min(mn[0],X[i]);mx[0]=Math.max(mx[0],X[i]);mn[1]=Math.min(mn[1],Y[i]);mx[1]=Math.max(mx[1],Y[i]);mn[2]=Math.min(mn[2],Z[i]);mx[2]=Math.max(mx[2],Z[i]);}
console.log('world min',mn.map(v=>v.toFixed(3)),'max',mx.map(v=>v.toFixed(3)));
const H=mx[1]-mn[1], bins=56, L=mx[2]-mn[2];
const hist=new Array(bins).fill(0), low=new Array(bins).fill(1e9), top=new Array(bins).fill(-1e9), wid=new Array(bins).fill(0);
for(let i=0;i<n;i++){const b=Math.min(bins-1,Math.floor((Z[i]-mn[2])/L*bins)); low[b]=Math.min(low[b],Y[i]); top[b]=Math.max(top[b],Y[i]); wid[b]=Math.max(wid[b],Math.abs(X[i])); if(Y[i]<mn[1]+0.02*H) hist[b]++;}
console.log('z bin width',(L/bins).toFixed(4));
console.log('ground',hist.join(','));
console.log('low',low.map(v=>(v-mn[1]).toFixed(2)).join(','));
console.log('top',top.map(v=>(v-mn[1]).toFixed(2)).join(','));
console.log('wid',wid.map(v=>v.toFixed(2)).join(','));
