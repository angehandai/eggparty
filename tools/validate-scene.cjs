// Runs actual Three.js meshes, transforms, game loop and UI state without a GPU.
// This is a runtime regression check, not a browser screenshot or GPU benchmark.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
process.on('uncaughtException',error=>{console.error(error.stack);process.exit(1);});
const THREE=require('../vendor/three.min.js');
const uiSource=['index.html','game.js','visuals.js','styles.css'].map(file=>fs.readFileSync(file,'utf8')).join('\n');
assert.doesNotMatch(uiSource,/[\p{Script=Han}]/u,'game-facing source contains Chinese text');
const elements=new Map(),listeners=new Map(),errors=[],intervals=new Map();let intervalId=0;
const ctx2d=new Proxy({createRadialGradient:()=>({addColorStop(){}}),measureText:()=>({width:100})},{get:(o,k)=>k in o?o[k]:()=>{}});
function element(id=''){const classes=new Set(['hidden']);return{id,style:{},dataset:{},width:800,height:600,textContent:'',innerHTML:'',offsetWidth:100,classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},getContext:()=>ctx2d,querySelector:()=>element(),addEventListener(){},appendChild(){},remove(){},focus(){}};}
for(const id of fs.readFileSync('index.html','utf8').matchAll(/id="([^"]+)"/g))elements.set(id[1],element(id[1]));
class Renderer{constructor(){this.shadowMap={};this.info={render:{calls:0,triangles:0}};}setPixelRatio(){}setSize(){}render(s,c){s.updateMatrixWorld();c.updateMatrixWorld();}}
class PMREM{fromScene(){return{texture:new THREE.Texture()};}dispose(){}}
const sandbox={THREE:{...THREE,WebGLRenderer:Renderer,PMREMGenerator:PMREM},document:{getElementById:id=>elements.get(id),createElement:()=>element(),querySelectorAll:()=>[],documentElement:{dataset:{}},body:element()},console:{...console,error:(...v)=>errors.push(v.join(' ')),warn:(...v)=>errors.push(v.join(' '))},devicePixelRatio:1,innerWidth:1280,innerHeight:720,performance:{now:()=>0},requestAnimationFrame(){},setTimeout:()=>1,clearTimeout(){},setInterval:f=>{intervals.set(++intervalId,f);return intervalId;},clearInterval:i=>intervals.delete(i),addEventListener:(k,f)=>{if(!listeners.has(k))listeners.set(k,[]);listeners.get(k).push(f);}};
sandbox.window=sandbox;vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('visuals.js','utf8'),sandbox,{filename:'visuals.js'});
let source=fs.readFileSync('game.js','utf8');source=source.replace('  resetRace();\n  let last',`  globalThis.__test={get player(){return player},get state(){return state},get elapsed(){return elapsed},racers,obstacles,scene,camera,renderer,keys,resetRace,startRace,update,movePlayer,updateCamera,applyGroundAndBounds,collisionAndCourse,syncRacer,finishRace,setYaw:v=>yaw=v};
  resetRace();
  let last`);
vm.runInContext(source,sandbox,{filename:'game.js'});
const g=sandbox.__test;assert.ok(g,'test entry');
function tick(seconds){for(let n=0;n<seconds*60;n++)g.update(1/60);}
function key(code,value){for(const f of listeners.get(value?'keydown':'keyup')||[])f({code,preventDefault(){}});}
function checkMeshes(){g.scene.updateMatrixWorld(true);let meshes=0,vertices=0;
g.scene.traverse(o=>{for(const v of [...o.position.toArray(),...o.scale.toArray()])assert.ok(Number.isFinite(v),o.type+' transform');
if(o.isInstancedMesh)for(const v of o.instanceMatrix.array)assert.ok(Number.isFinite(v),'instance matrix NaN');
if(o.isMesh){meshes++;const a=o.geometry.attributes.position;vertices+=a.count;for(const v of a.array)assert.ok(Number.isFinite(v),'geometry NaN');}});return{meshes,vertices};}
assert.equal(g.racers.length,12);assert.ok(g.racers.every(r=>r.group.visible));assert.ok(g.player.group.isObject3D);assert.equal(g.player.group.userData.visual.eyes.length,2);
assert.equal(g.obstacles.length,8);const initial=checkMeshes();
g.startRace();for(let i=0;i<4;i++)for(const fn of [...intervals.values()])fn();assert.equal(g.state,'race');
// Run controllers at a safe point; validate screen right/left and model synchronisation.
g.player.x=0;g.player.z=15;g.player.invincible=4;
const z=g.player.z;key('KeyW',true);for(let i=0;i<120;i++)g.movePlayer(1/60);key('KeyW',false);g.syncRacer(g.player,1/60);
assert.ok(g.player.z>z+15);assert.equal(g.player.group.position.z,g.player.z);
key('KeyS',true);for(let i=0;i<120;i++)g.movePlayer(1/60);key('KeyS',false);assert.ok(Math.abs(g.player.z-z)<1e-6);
key('KeyA',true);g.movePlayer(.2);key('KeyA',false);assert.ok(g.player.x>0);
key('KeyD',true);g.movePlayer(.2);key('KeyD',false);assert.ok(Math.abs(g.player.x)<1e-6);
g.setYaw(Math.PI/2);key('KeyW',true);g.movePlayer(.2);key('KeyW',false);assert.ok(g.player.x<0);g.setYaw(0);g.player.x=0;
key('Space',true);g.movePlayer(1/60);key('Space',false);assert.ok(g.player.vy>0);g.applyGroundAndBounds(g.player,.1);assert.ok(g.player.y>0);
key('ShiftLeft',true);key('KeyW',true);g.movePlayer(.1);assert.equal(g.player.velocity.length(),15);key('ShiftLeft',false);key('KeyW',false);
g.resetRace();tick(1);g.camera.updateMatrixWorld();const projection=g.player.group.position.clone().project(g.camera);assert.ok(Math.abs(projection.x)<1&&Math.abs(projection.y)<1,'player outside view');
for(const aspect of [16/9,16/10,4/3]){g.camera.aspect=aspect;g.camera.updateProjectionMatrix();const p=g.player.group.position.clone().project(g.camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1,'player outside resized camera');}
// Windmills use two perpendicular bars; diagonal gaps stay open and speed increases down-course.
g.resetRace();const spinners=g.obstacles.filter(o=>o.type==='spinner');assert.equal(spinners.length,3);assert.ok(spinners.every(o=>o.arms===2));assert.ok(spinners[0].speed<spinners[1].speed&&spinners[1].speed<spinners[2].speed);
const spinner=spinners[0];g.player.x=3;g.player.z=spinner.z+3;g.player.y=0;g.player.invincible=0;g.player.hitCooldown=0;g.player.velocity.set(0,0);g.collisionAndCourse(g.player,1/60);assert.equal(g.player.z,spinner.z+3,'spinner diagonal gap caused a collision');
g.player.x=3;g.player.z=spinner.z;g.player.invincible=0;g.player.hitCooldown=0;g.player.velocity.set(0,0);g.collisionAndCourse(g.player,1/60);assert.ok(g.player.z>spinner.z+1.4,'spinner hit did not eject from blade');const releasedZ=g.player.z;g.collisionAndCourse(g.player,1/60);assert.equal(g.player.z,releasedZ,'spinner immediately re-hit the released racer');
g.startRace();for(let i=0;i<4;i++)for(const fn of [...intervals.values()])fn();tick(103);assert.equal(g.state,'result');assert.equal(elements.get('result').classList.contains('hidden'),false);
g.startRace();for(let i=0;i<4;i++)for(const fn of [...intervals.values()])fn();tick(2);assert.equal(g.state,'race');assert.equal(g.racers.length,12);
sandbox.PartyVisuals.quality('Low');tick(1);assert.equal(sandbox.document.documentElement.dataset.quality,'low');
// Real-frame adaptation is independent from the capped gameplay timestep.
sandbox.PartyVisuals.quality('High');for(let n=0;n<240;n++)sandbox.PartyVisuals.frameTime(1/60,'race');assert.equal(sandbox.document.documentElement.dataset.quality,'high');
for(let n=0;n<240;n++)sandbox.PartyVisuals.frameTime(1/30,'race');assert.equal(sandbox.document.documentElement.dataset.quality,'low');
sandbox.PartyVisuals.quality('High');sandbox.document.hidden=true;for(let n=0;n<240;n++)sandbox.PartyVisuals.frameTime(1/20,'race');assert.equal(sandbox.document.documentElement.dataset.quality,'high');sandbox.document.hidden=false;
g.player.x=0;g.player.z=258;g.player.invincible=0;g.collisionAndCourse(g.player,1/60);g.syncRacer(g.player,1/60);assert.equal(g.player.finished,true);assert.equal(g.player.cp,4);assert.equal(g.player.group.visible,true);assert.equal(elements.get('celebration').classList.contains('active'),true);
// Reset disposes instanced GPU buffers instead of orphaning them every race.
let disposed=0;g.scene.traverse(o=>{if(o.isInstancedMesh)o.addEventListener('dispose',()=>disposed++);});g.resetRace();assert.ok(disposed>0);tick(.2);
const final=checkMeshes();assert.deepEqual(errors,[]);
const report={scope:'CPU scene/controller integration. WebGL renderer and Canvas2D drawing stubbed; no visual/GPU certification.',checks:['English-only game-facing source','12 visible mesh-bound racers','8 original obstacles','finite model and instance geometry','W/S for 2 seconds','A/D screen direction','camera-relative W at 90 degrees','Space gravity/jump','Shift speed','player inside 16:9, 16:10 and 4:3 camera frustums','two-bar cross windmills with diagonal gap, hit-release behavior, and increasing speeds','103-second race and results','restart','Low quality','automatic quality reduction with 30 FPS input; 60 FPS and hidden tabs retained','checkpoint and finish celebration integration; finished model remains visible','instanced buffer disposal on restart'],initialScene:initial,finalScene:final,errors};
fs.writeFileSync('validation/scene-regression.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
