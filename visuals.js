/* Cloudmint Works — original procedural art. No gameplay state is changed here. */
(() => {
  'use strict';
  const T = window.THREE;
  const palette = { ink:0x263e60, teal:0x29afab, mint:0x87dfc6, coral:0xf36981, gold:0xffc85e, cream:0xfff1ce, sky:0x86cfe1, violet:0x9680cb };
  const materials = new Map(), geometries = new Map();
  const animations = [];
  let env, scene, renderer, camera, sun, clock=0, low=false, intro=0, goFlash=0, perfSeconds=0, perfFrames=0;
  let effectRoot, sparkles, ambientLamp, puffTexture, glowTexture;
  const sparks = [], maxSparks=200;

  function material(color, kind='plastic') {
    const hex=color instanceof T.Color?color.getHex():color;
    const key=`${hex}-${kind}`;
    if(materials.has(key)) return materials.get(key);
    const props={color:new T.Color(hex).convertSRGBToLinear(),roughness:.48,metalness:.02,envMapIntensity:.4};
    if(kind==='rubber') Object.assign(props,{roughness:.78,metalness:0});
    if(kind==='metal') Object.assign(props,{roughness:.28,metalness:.5});
    if(kind==='glow') Object.assign(props,{emissive:new T.Color(hex).convertSRGBToLinear(),emissiveIntensity:.32,roughness:.32});
    if(kind==='jelly') Object.assign(props,{roughness:.21,clearcoat:.85,clearcoatRoughness:.2,transparent:true,opacity:.88,depthWrite:false});
    if(kind==='cloth') Object.assign(props,{roughness:.85,side:T.DoubleSide});
    const m=new T.MeshPhysicalMaterial({...props,clearcoat:kind==='plastic'?.32:props.clearcoat||0,clearcoatRoughness:.38});
    materials.set(key,m);return m;
  }
  function boxGeo(w,h,d,r=.15) {
    r=Math.min(r,w/3,h/3,d/3);
    const key=`b${w},${h},${d},${r}`;
    if(geometries.has(key)) return geometries.get(key);
    const s=new T.Shape(),x=-w/2+r,y=-h/2+r,ww=w-2*r,hh=h-2*r;
    s.moveTo(x,y);s.lineTo(x+ww,y);s.lineTo(x+ww,y+hh);s.lineTo(x,y+hh);s.closePath();
    const g=new T.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:r,bevelThickness:r,curveSegments:6});
    g.translate(0,0,-d/2+r);g.computeVertexNormals();geometries.set(key,g);return g;
  }
  const sphereGeo=new T.SphereGeometry(1,28,20), smallSphere=new T.SphereGeometry(1,16,12);
  function mesh(parent,geo,mat,x=0,y=0,z=0) {
    const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  function box(parent,w,h,d,col,x=0,y=0,z=0,r=.15,kind='plastic') {return mesh(parent,boxGeo(w,h,d,r),material(col,kind),x,y,z);}
  function orb(parent,sx,sy,sz,col,x=0,y=0,z=0,kind='plastic',small=false) {
    const m=mesh(parent,small?smallSphere:sphereGeo,material(col,kind),x,y,z);m.scale.set(sx,sy,sz);return m;
  }
  function cylinder(parent,r1,r2,height,col,x=0,y=0,z=0,kind='plastic',segments=24) {
    const key=`c${r1},${r2},${height},${segments}`;
    if(!geometries.has(key))geometries.set(key,new T.CylinderGeometry(r1,r2,height,segments));
    return mesh(parent,geometries.get(key),material(col,kind),x,y,z);
  }
  function torus(parent,r,t,col,x=0,y=0,z=0,kind='plastic',arc=Math.PI*2) {
    const key=`t${r},${t},${arc}`;
    if(!geometries.has(key)) geometries.set(key,new T.TorusGeometry(r,t,8,40,arc));
    return mesh(parent,geometries.get(key),material(col,kind),x,y,z);
  }
  function tube(parent,points,r,col,kind='plastic') {return mesh(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points),32,r,7,false),material(col,kind));}
  function spriteTexture(type) {
    const c=document.createElement('canvas');c.width=c.height=64;const q=c.getContext('2d');
    const g=q.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#ffffff');g.addColorStop(type==='shadow'?.24:.1,'#ffffffbb');g.addColorStop(1,'#ffffff00');q.fillStyle=g;q.fillRect(0,0,64,64);return new T.CanvasTexture(c);
  }
  function label(parent,text,w,h,x,y,z,bg=palette.ink,fg='#fff5d9') {
    const c=document.createElement('canvas');c.width=512;c.height=Math.round(512*h/w);const q=c.getContext('2d');
    q.fillStyle='#'+bg.toString(16).padStart(6,'0');q.fillRect(0,0,c.width,c.height);
    q.fillStyle=fg;q.font=`900 ${Math.min(c.height*.57,74)}px 'Segoe UI',sans-serif`;q.textAlign='center';q.textBaseline='middle';q.fillText(text,c.width/2,c.height/2,c.width*.92);
    const tex=new T.CanvasTexture(c);tex.encoding=T.sRGBEncoding;
    const sign=mesh(parent,new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}),x,y,z);
    sign.rotation.y=Math.PI;sign.castShadow=false;return sign;
  }
  function stamp(parent,text,w,h,x,y,z,col=palette.cream) {
    const s=label(parent,text,w,h,x,y,z,palette.teal);s.rotation.set(-Math.PI/2,0,Math.PI);return s;
  }
  function seeded(seed){let n=seed;return()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};}

  function character(color) {
    const root=new T.Group(),rig=new T.Group();root.add(rig);
    const tone=new T.Color(color), darker=tone.clone().offsetHSL(-.02,.04,-.14);
    const body=orb(rig,.84,.94,.76,color,0,.03,0,'rubber');
    // Soft cream mask with expressive oval eyes and a tiny smile.
    orb(rig,.63,.57,.22,palette.cream,0,.18,.64,'rubber');
    const eyes=[];
    for(const side of [-1,1]){
      const eye=orb(rig,.105,.17,.055,palette.ink,side*.24,.29,.853);eyes.push(eye);
      orb(rig,.035,.044,.016,0xffffff,side*.24-.022,.35,.909);
      orb(rig,.105,.046,.024,0xf3a098,side*.41,.035,.826,'rubber');
      const ear=orb(rig,.16,.32,.2,color,side*.29,.99,-.07,'rubber');ear.rotation.z=side*-.38;
      orb(rig,.077,.14,.055,palette.cream,side*.29,1.06,.1,'rubber');
    }
    const mouth=torus(rig,.105,.027,palette.ink,0,-.015,.884,'rubber',Math.PI);mouth.rotation.z=Math.PI;
    // Workwear, boots, mitten arms and a readable backpack silhouette from behind.
    const belt=torus(rig,.71,.045,darker,0,-.5,0,'rubber');belt.rotation.x=Math.PI/2;
    const feet=[],arms=[];
    for(const side of [-1,1]){
      const boot=new T.Group();boot.position.set(side*.34,-.85,.06);rig.add(boot);feet.push(boot);
      orb(boot,.27,.19,.34,darker,0,0,0,'rubber');box(boot,.48,.09,.53,palette.cream,0,-.14,.05,.035);
      const arm=orb(rig,.18,.32,.21,color,side*.81,-.18,.03,'rubber');arm.rotation.z=side*.24;arms.push(arm);
      orb(rig,.05,.05,.045,palette.gold,side*.24,-.3,.72,'metal');
    }
    box(rig,.73,.77,.25,darker,0,-.03,-.71,.11,'rubber');
    box(rig,.59,.58,.11,palette.cream,0,-.035,-.876,.065);
    box(rig,.43,.26,.07,color,0,-.14,-.952,.03);
    const emblem=torus(rig,.13,.025,palette.teal,0,.075,-.944);emblem.scale.y=.86;
    orb(rig,.07,.07,.025,palette.gold,0,.075,-.97,'metal');
    // Contact AO is separate from the animated body; it stays on the landing surface.
    puffTexture ||= spriteTexture('shadow');
    const contact=mesh(root,new T.PlaneGeometry(2.3,2),new T.MeshBasicMaterial({map:puffTexture,color:0x273656,transparent:true,opacity:.24,depthWrite:false}),0,-1.265,0);
    contact.rotation.x=-Math.PI/2;contact.castShadow=false;contact.receiveShadow=false;
    root.userData.visual={rig,feet,arms,eyes,mouth,contact,lastY:0,lastX:0,lastZ:0,land:0,phase:Math.random()*6,trail:0,hit:0};
    return root;
  }
  function animateCharacter(e,dt,state) {
    const v=e.group.userData.visual;if(!v)return;
    const speed=state==='race'?Math.min(15,Math.hypot(e.x-v.lastX,e.z-v.lastZ)/Math.max(.001,dt)):0;
    v.lastX=e.x;v.lastZ=e.z;
    if(v.lastY>.08&&e.y<=.02){v.land=.22;if(!e.eliminated)emit('land',e.group.position,e.color,7);}
    if(v.lastY<=.02&&e.y>.03)emit('jump',e.group.position,palette.cream,6);
    v.lastY=e.y;v.land=Math.max(0,v.land-dt);
    const air=e.y>.08&&!e.finished,fall=e.y<-.18&&!e.finished,hit=e.stun>0&&!e.finished,run=speed>.25&&!air&&!fall&&!e.finished;
    const phase=clock*11+v.phase;
    const takeoff=air&&e.vy>8&&e.y<.45;
    let sy=takeoff?.86:air?1.13:1, sx=takeoff?1.07:air?.93:1;
    if(v.land>0){sy=1-v.land*.92;sx=1+v.land*.46;}
    if(hit){sy=.9;sx=1.12;}
    v.rig.scale.lerp(new T.Vector3(sx,sy,sx),1-Math.exp(-dt*18));
    v.rig.position.y=-.24+(e.finished?Math.abs(Math.sin(clock*5))*.2:run?Math.abs(Math.sin(phase))*.08:Math.sin(clock*2+v.phase)*.02);
    v.rig.rotation.z=hit?Math.sin(clock*38)*.18:run?Math.sin(phase)*.055:0;
    v.rig.rotation.x=fall?-.18:run?.10:0;
    v.feet.forEach((foot,i)=>{foot.rotation.x=run?Math.sin(phase+i*Math.PI)*.64:air?-.4:0;foot.position.y=-.85+(run?Math.max(0,Math.sin(phase+i*Math.PI))*.15:0);});
    v.arms.forEach((arm,i)=>arm.rotation.x=e.finished?-2+Math.sin(clock*7+i)*.2:fall?-1.3:air?-.8:run?Math.sin(phase+i*Math.PI)*.55:Math.sin(clock*2)*.08);
    const blink=Math.sin(clock*.8+v.phase)> .998;
    v.eyes.forEach(eye=>eye.scale.y=(blink?.035:(hit?.1:.17)));
    v.mouth.scale.setScalar(fall?1.65:hit?.7:1);
    v.contact.position.y=-1.265-(e.finished?0:e.y);v.contact.material.opacity=e.y<-.2?0:.24/(1+Math.max(0,e.y)*.4);
    v.trail-=dt;if(run&&v.trail<=0){emit(speed>10?'dash':'dust',e.group.position,e.color,speed>10?4:1);v.trail=speed>10?.06:.18;}
    if(hit&&v.hit<=0)emit('hit',e.group.position,palette.gold,12);v.hit=hit?.3:Math.max(0,v.hit-dt);
  }

  function platform(z,w,color,length) {
    const g=new T.Group();g.position.z=z+length/2;
    box(g,w,.64,length,color,0,-.445,0,.2);
    box(g,w-.38,.48,length-.26,palette.ink,0,-.98,0,.19);
    box(g,w-.75,.28,length-.5,palette.coral,0,-1.27,0,.12);
    for(const side of [-1,1]) {
      box(g,.22,.07,Math.max(.5,length-1),palette.cream,side*(w/2-.42),-.086,0,.025);
      for(let zz=-length/2+2;zz<length/2;zz+=4)box(g,.44,.02,.13,palette.cream,side*(w/2-1.1),-.105,zz,.01);
      cylinder(g,.34,.22,1,palette.gold,side*(w/2-.7),-1.6,-length/2+1,'metal',12);
    }
    if(length>=10){
      for(let zz=-length/2+5;zz<length/2;zz+=7) {
        const chevron=new T.Group();chevron.position.set(0,-.093,zz);g.add(chevron);
        for(const side of [-1,1]){const line=box(chevron,.12,.02,.65,palette.cream,side*.2,0,0,.009);line.rotation.y=side*-.67;}
      }
      // Layered floating foundation, outside the playable surface.
      orb(g,w*.46,1.0,length*.46,palette.teal,0,-1.65,0,'rubber',true);
    }
    return g;
  }
  function spinner(color,arms,radius) {
    const root=new T.Group();
    orb(root,.77,.65,.77,palette.cream);
    const ring=torus(root,.72,.1,palette.ink);ring.rotation.x=Math.PI/2;
    cylinder(root,.28,.36,1.3,palette.gold,0,.2,0,'metal');
    for(let i=0;i<arms;i++){
      const arm=new T.Group();root.add(arm);arm.rotation.y=i*Math.PI/arms;
      box(arm,radius*2,.44,.53,color,0,.28,0,.18);
      for(const side of [-1,1]){
        orb(arm,.38,.38,.38,palette.cream,side*(radius-.12),.28,0);
        for(let k=1;k<radius;k+=1.1)box(arm,.16,.455,.54,palette.cream,side*k,.28,0,.07);
      }
    }
    return root;
  }
  function movingPlatform(color) {
    const g=new T.Group();box(g,4,.55,8,color,0,0,0,.18);
    for(const side of [-1,1])box(g,.16,.06,7.5,palette.cream,side*1.7,.3,0,.022);
    box(g,3.5,.3,7.5,palette.ink,0,-.43,0,.12);
    stamp(g,'HOP',1.5,.7,0,.284,0);
    g.children.forEach(part=>part.position.y-=.5);
    return g;
  }
  function bounce() {
    const g=new T.Group();cylinder(g,2.2,2.1,.32,palette.ink);
    for(let i=0;i<3;i++){const ring=torus(g,1.6,.085,palette.gold,0,.12+i*.15,0,'metal');ring.rotation.x=Math.PI/2;}
    const jelly=cylinder(g,2.05,2.15,.35,0xf58db3,0,.47,0,'jelly');g.userData.jelly=jelly;
    const rim=torus(jelly,1.85,.07,palette.cream);rim.rotation.x=Math.PI/2;rim.position.y=.2;
    stamp(jelly,'↑',1.5,1.5,0,.21,0);return g;
  }
  function hammer(){
    const g=new T.Group();
    cylinder(g,.15,.22,6,palette.gold,0,-3.2,0,'metal');
    orb(g,.46,.46,.46,palette.ink);
    for(let i=0;i<4;i++)cylinder(g,.24,.24,.27,palette.cream,0,-1.2-i*1.15,0);
    const ball=new T.Group();ball.position.y=-7;g.add(ball);
    orb(ball,1.55,1.4,1.55,palette.violet,0,0,0,'rubber');
    const band=torus(ball,1.54,.11,palette.cream);band.rotation.x=Math.PI/2;
    for(const side of [-1,1]){
      const cap=cylinder(ball,1.03,1.03,.35,palette.coral,side*1.32,0,0);cap.rotation.z=Math.PI/2;
      orb(ball,.19,.43,.43,palette.gold,side*1.56,0,0,'rubber');
    }
    const badge=torus(ball,.47,.085,palette.cream,0,0,-1.48);badge.scale.y=.85;
    orb(ball,.13,.13,.06,palette.gold,0,0,-1.56,'metal');
    g.userData.ball=ball;return g;
  }
  function vanishPlatform(){
    const g=new T.Group();box(g,5,.55,6,palette.teal,0,0,0,.18);
    box(g,4.55,.24,5.55,palette.ink,0,-.37,0,.10);
    for(const side of [-1,1]){
      box(g,.13,.045,5.45,palette.gold,side*2.23,.295,0,.015);
      for(let z=-2;z<=2;z+=1)orb(g,.075,.045,.075,palette.gold,side*1.96,.3,z,'glow',true);
    }
    stamp(g,'BLINK',3,1,0,.292,0);g.children.forEach(part=>part.position.y-=.5);return g;
  }
  function gate(z,text,isFinish=false) {
    const g=new T.Group();g.position.z=z;
    for(const side of [-1,1]){
      box(g,.68,5.8,.72,palette.coral,side*5.5,2.55,0,.25);
      box(g,1.55,.56,1.9,palette.ink,side*5.5,.08,0,.15);
      cylinder(g,.23,.23,4.5,palette.cream,side*5.5,2.5,-.43);
      orb(g,.42,.42,.42,palette.gold,side*5.5,5.7,0,'glow');
    }
    box(g,11.8,1.25,.9,palette.cream,0,5.1,0,.28);
    box(g,9.9,.96,1,palette.ink,0,5.16,0,.19);
    label(g,text,8.9,.69,0,5.17,-.515);
    for(let i=-5;i<=5;i++)orb(g,.1,.1,.08,palette.gold,i,4.45,-.52,'glow');
    for(let row=0;row<2;row++)for(let col=0;col<16;col++)box(g,.65,.02,.55,(row+col)%2?palette.cream:palette.ink,(col-7.5)*.65,-.095,row*.55,.008);
    if(isFinish){label(g,'CLOUDMINT CUP',5,.45,0,6,-.12,palette.coral);}
    return g;
  }
  function checkpoint(z,n) {
    const g=new T.Group();g.position.z=z;
    for(const side of [-1,1]){
      cylinder(g,.12,.16,3.1,palette.ink,side*5.35,1.4,0,'metal');
      orb(g,.25,.3,.25,palette.gold,side*5.35,3,0,'glow');
      box(g,.5,.8,.1,palette.teal,side*5.35,2.05,-.12,.07);
    }
    for(let x=-5;x<=5;x+=.7)box(g,.38,.02,.24,palette.gold,x,-.097,0,.009);
    label(g,`CHECKPOINT 0${n}`,3.5,.42,-7.8,2.1,0,palette.teal);return g;
  }
  function pole(){const g=new T.Group();cylinder(g,.09,.13,1.4,palette.cream,0,.3,0);orb(g,.18,.18,.18,palette.teal,0,1,0,'glow',true);return g;}

  function cloud(parent,rand,x,y,z,s=1){
    const g=new T.Group();parent.add(g);g.position.set(x,y,z);g.scale.setScalar(s);
    for(let k=0;k<6;k++)orb(g,1.7,1.1+rand()*.7,1.35,0xe5eff1,(k-2.5)*1.3,Math.sin(k)*.5,rand(), 'rubber',true).castShadow=false;
    animations.push({type:'cloud',g,base:g.position.clone(),phase:rand()*6,speed:.15+rand()*.1});return g;
  }
  function candyTree(parent,x,y,z,rand){
    const g=new T.Group();parent.add(g);g.position.set(x,y,z);
    cylinder(g,.13,.2,2.4,palette.cream,0,1.1,0);
    const col=[palette.coral,palette.teal,palette.gold][Math.floor(rand()*3)];
    orb(g,1.1,1.3,.95,col,0,2.65,0,'rubber',true);
    torus(g,.8,.11,palette.cream,0,2.65,-.62);
  }
  function island(parent,x,y,z,s,rand,building=true){
    const g=new T.Group();parent.add(g);g.position.set(x,y,z);g.scale.setScalar(s);
    orb(g,6,1.2,4.5,palette.teal,0,0,0,'rubber',true);
    orb(g,5.4,1.6,3.8,0x456582,0,-1.2,0,'rubber',true);
    cylinder(g,3.6,.1,4,0x52758e,0,-3,0,'rubber',9);
    box(g,9,.3,6.2,palette.mint,0,.45,0,.1);
    if(building){
      box(g,4.5,3,3.5,palette.cream,0,2,0,.3);
      box(g,5.3,.8,4.3,palette.coral,0,3.7,0,.3);
      box(g,3.1,1.4,2.5,palette.teal,0,4.65,0,.25);
      for(let i=-1;i<=1;i++)box(g,.6,.8,.11,palette.ink,i*1.1,2.1,-1.79,.14);
      cylinder(g,.38,.48,3.4,palette.gold,1.7,5,-.2,'metal');
      cylinder(g,.52,.52,.28,palette.ink,1.7,6.7,-.2);
      label(g,'SUGAR LAB',3.1,.47,0,3.2,-1.91,palette.ink);
      tube(g,[new T.Vector3(-2,2,0),new T.Vector3(-3.2,2.2,-.2),new T.Vector3(-3.6,.6,-1)],.17,palette.gold,'metal');
      for(let k=0;k<3;k++)orb(g,.4+k*.16,.38+k*.13,.4+k*.16,0xe5eff1,1.7+k*.4,7.25+k*.65,-.2,'rubber',true).castShadow=false;
    }
    candyTree(g,-3.7,.5,0,rand);candyTree(g,3.8,.5,1.5,rand);
    animations.push({type:'float',g,base:g.position.clone(),phase:rand()*6,speed:.45});return g;
  }
  function balloon(parent,x,y,z,rand){
    const g=new T.Group();g.position.set(x,y,z);parent.add(g);
    const col=[palette.gold,palette.coral,palette.teal][Math.floor(rand()*3)];
    orb(g,.72,.95,.72,col);orb(g,.43,.92,.69,palette.cream,.2,0,.08);
    cylinder(g,.12,.02,.25,col,0,-1,0);
    cylinder(g,.012,.012,2,palette.cream,0,-2,0,'rubber',6);
    box(g,.53,.38,.53,palette.ink,0,-3.1,0,.1);
    animations.push({type:'float',g,base:g.position.clone(),phase:rand()*6,speed:.7});
  }
  function pennants(parent,z){
    const g=new T.Group();g.position.z=z;parent.add(g);
    for(const side of [-1,1])cylinder(g,.06,.1,4.6,palette.ink,side*6.4,2.1,0,'metal',10);
    tube(g,[new T.Vector3(-6.4,4.4,0),new T.Vector3(0,3.65,0),new T.Vector3(6.4,4.4,0)],.017,palette.cream);
    for(let i=0;i<11;i++){
      const x=-5.7+i*1.14,y=3.65+Math.pow(x/6.4,2)*.75;
      const shape=new T.Shape();shape.moveTo(-.36,0);shape.lineTo(.36,0);shape.lineTo(0,-.65);shape.closePath();
      const flag=mesh(g,new T.ShapeGeometry(shape),material([palette.coral,palette.gold,palette.teal][i%3],'cloth'),x,y,0);
      flag.castShadow=false;animations.push({type:'flag',g:flag,phase:i,speed:1});
    }
  }
  function environment(parent){
    env=parent;animations.length=0;const rand=seeded(31415);
    for(let i=0;i<20;i++)cloud(parent,rand,(i%2?1:-1)*(18+rand()*55),-7+rand()*15,-12+i*16,1.2+rand()*1.6);
    for(let i=0;i<10;i++)island(parent,(i%2?1:-1)*(20+rand()*10),-6+rand()*12,10+i*27,.65+rand()*.4,rand,true);
    for(let i=0;i<16;i++)balloon(parent,(i%2?1:-1)*(9+rand()*12),6+rand()*8,8+i*16,rand);
    for(let z=15;z<270;z+=26){
      for(const side of [-1,1]){
        const g=new T.Group();g.position.set(side*9,-1.4,z);parent.add(g);
        cylinder(g,1.5,.3,2,palette.ink,0,-1,0,'rubber',12);cylinder(g,1.65,1.5,.24,palette.teal);
        candyTree(g,0,0,0,rand);
      }
    }
    [12,56,118,205,251].forEach(z=>pennants(parent,z));
    const names=['01  SUGAR SPIN','02  HOP HOP','03  JELLY WORKS','04  SKY SPRINT'];
    [22,58,115,213].forEach((z,i)=>{
      const g=new T.Group();parent.add(g);g.position.set(7.1,0,z);cylinder(g,.08,.12,2.6,palette.ink,0,1,0,'metal');
      box(g,3.5,.92,.24,palette.cream,0,2.3,0,.15);label(g,names[i],3.26,.58,0,2.3,-.14,palette.teal);
    });
    // Decorative raised conveyor branches: no gameplay colliders.
    for(let z=30;z<240;z+=70){
      const g=new T.Group();parent.add(g);g.position.set(-18,3,z);g.rotation.y=.38;
      box(g,4,.6,18,palette.coral,0,0,0,.2);box(g,3.6,.1,17.8,palette.ink,0,.35,0,.03);
      for(let k=-7;k<=7;k+=2)box(g,3.2,.12,.28,palette.cream,0,.47,k,.045);
    }
    // Ambient motes are bounded and independent from gameplay emitters.
    const a=new Float32Array(80*3);for(let i=0;i<80;i++){a[i*3]=(rand()-.5)*24;a[i*3+1]=rand()*8;a[i*3+2]=rand()*270;}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(a,3));
    glowTexture ||= spriteTexture('glow');
    sparkles=new T.Points(geo,new T.PointsMaterial({map:glowTexture,color:palette.cream,size:.11,transparent:true,opacity:.65,depthWrite:false}));sparkles.visible=!low;parent.add(sparkles);
    animations.filter(a=>a.type==='cloud'||a.type==='float').forEach(a=>batchStatic(a.g));
    batchStatic(parent);
  }
  // Collapse static decorations into instanced draws, retain animated branches.
  function batchStatic(root,excluded=[]){
    root.updateMatrixWorld(true);const buckets=new Map(),animated=new Set([...animations.map(a=>a.g),...excluded]);
    root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||o.material.transparent||o.material.map)return;let p=o;while(p&&p!==root){if(animated.has(p))return;p=p.parent;}
      const key=o.geometry.uuid+o.material.uuid+o.castShadow+o.receiveShadow;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o);
    });
    const inv=new T.Matrix4().copy(root.matrixWorld).invert();
    buckets.forEach(items=>{if(items.length<3)return;const inst=new T.InstancedMesh(items[0].geometry,items[0].material,items.length);inst.castShadow=items[0].castShadow;inst.receiveShadow=items[0].receiveShadow;
      items.forEach((m,i)=>{inst.setMatrixAt(i,new T.Matrix4().multiplyMatrices(inv,m.matrixWorld));m.parent.remove(m);});inst.frustumCulled=false;root.add(inst);
    });
  }
  function init(s,r,c,keyLight){
    scene=s;renderer=r;camera=c;sun=keyLight;
    effectRoot=new T.Group();scene.add(effectRoot);glowTexture ||= spriteTexture('glow');
    ambientLamp=new T.PointLight(palette.gold,0,9,2);scene.add(ambientLamp);
    scene.add(sun.target);
    sun.shadow.camera.left=-22;sun.shadow.camera.right=22;sun.shadow.camera.top=35;sun.shadow.camera.bottom=-20;sun.shadow.camera.far=100;sun.shadow.camera.updateProjectionMatrix();
    const sky=new T.Mesh(new T.SphereGeometry(400,32,20),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{zenith:{value:new T.Color(0x428fc7)},horizon:{value:new T.Color(0xb8e4e7)},lower:{value:new T.Color(0xfbc9ce)}},
      vertexShader:'varying vec3 d;void main(){d=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec3 d;uniform vec3 zenith,horizon,lower;void main(){float h=normalize(d).y;vec3 c=h>0.?mix(horizon,zenith,pow(h,.6)):mix(horizon,lower,clamp(-h*2.,0.,1.));gl_FragColor=vec4(c,1.);}'
    }));sky.frustumCulled=false;sky.renderOrder=-100;scene.add(sky);scene.userData.sky=sky;
    const cenv=new T.Scene();cenv.background=new T.Color(0x9cbac7);
    const panel=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshBasicMaterial({color:0xffffff}));panel.position.set(-8,15,2);panel.lookAt(0,0,0);cenv.add(panel);
    const pmrem=new T.PMREMGenerator(renderer);const target=pmrem.fromScene(cenv,.05);scene.environment=target.texture;pmrem.dispose();panel.geometry.dispose();panel.material.dispose();
  }
  function emit(type,pos,color,count=8){
    if(!effectRoot)return;const confetti=type==='finish'||type==='go';
    for(let i=0;i<count&&sparks.length<(low?70:maxSparks);i++){
      const col=confetti?[palette.coral,palette.teal,palette.gold,palette.cream][i%4]:color;
      const mat=confetti?new T.MeshBasicMaterial({color:col,side:T.DoubleSide}):new T.SpriteMaterial({map:glowTexture,color:col,transparent:true,opacity:.7,depthWrite:false});
      const item=confetti?new T.Mesh(new T.PlaneGeometry(.12,.23),mat):new T.Sprite(mat);
      item.position.copy(pos);if(!confetti)item.position.y-=.9;else item.position.y+=2;
      const size=type==='dash'?.35:type==='hit'?.15:.22;if(!confetti)item.scale.setScalar(size);
      effectRoot.add(item);sparks.push({item,type,life:confetti?2.3:.5,max:confetti?2.3:.5,v:new T.Vector3((Math.random()-.5)*(confetti?8:2),confetti?4+Math.random()*5:Math.random()*1.6,(Math.random()-.5)*(confetti?8:2))});
    }
    if(type==='hit'||type==='finish'){ambientLamp.position.copy(pos);ambientLamp.intensity=type==='finish'?16:8;}
  }
  function update(dt,player,state,obstacles){
    clock+=dt;scene.userData.sky.position.copy(camera.position);
    animations.forEach(a=>{if(a.type==='cloud')a.g.position.x=a.base.x+Math.sin(clock*a.speed+a.phase)*2;
      if(a.type==='float')a.g.position.y=a.base.y+Math.sin(clock*a.speed+a.phase)*.24;
      if(a.type==='flag')a.g.rotation.y=Math.sin(clock*2+a.phase)*.21;
    });
    if(sparkles)sparkles.position.y=Math.sin(clock*.4)*.2;
    for(let i=sparks.length-1;i>=0;i--){const p=sparks[i];p.life-=dt;p.item.position.addScaledVector(p.v,dt);p.v.y-=dt*(p.type==='finish'||p.type==='go'?3:1);p.item.material.opacity=Math.max(0,p.life/p.max);p.item.material.transparent=true;if(p.item.isMesh){p.item.rotation.x+=dt*5;p.item.rotation.z+=dt*3;}if(p.life<=0){effectRoot.remove(p.item);p.item.material.dispose();if(p.item.isMesh)p.item.geometry.dispose();sparks.splice(i,1);}}
    if(player){
      sun.position.set(player.x-16,28,player.z-18);sun.target.position.set(player.x,0,player.z+12);
      if(state==='menu'){const v=player.group.userData.visual;if(v)v.rig.rotation.y=Math.PI+.24;}
      else if(player.group.userData.visual)player.group.userData.visual.rig.rotation.y=0;
    }
    ambientLamp.intensity*=Math.exp(-dt*7);
    obstacles.forEach(o=>{if(o.type==='bounce'&&o.g.userData.jelly){const near=player&&Math.abs(player.z-o.z)<2&&Math.abs(player.x-o.g.position.x)<2&&player.y<.4;const jelly=o.g.userData.jelly;jelly.scale.y=T.MathUtils.lerp(jelly.scale.y,near?.48:1,1-Math.exp(-dt*18));}});
    if(intro>0)intro=Math.max(0,intro-dt);goFlash=Math.max(0,goFlash-dt);
  }
  // Measure uncapped frame time; background-tab pauses must not lower quality.
  function frameTime(dt,state){
    if(state!=='race'||document.hidden||dt<=0||dt>.25){perfSeconds=0;perfFrames=0;return;}
    perfSeconds+=dt;perfFrames++;
    if(perfFrames>=240){const slow=perfSeconds>5.76;perfFrames=0;perfSeconds=0;if(slow&&!low)quality('Low');}
  }
  function quality(value){low=value==='Low';renderer.setPixelRatio(low?1:Math.min(devicePixelRatio,1.5));const size=low?1024:2048;if(sun.shadow.mapSize.x!==size){sun.shadow.mapSize.set(size,size);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}if(sparkles)sparkles.visible=!low;document.documentElement.dataset.quality=low?'low':'high';const select=document.getElementById('quality');if(select)select.value=low?'Low':'High';perfSeconds=0;perfFrames=0;}
  function clearSparks(){sparks.splice(0).forEach(p=>{effectRoot.remove(p.item);p.item.material.dispose();if(p.item.isMesh)p.item.geometry.dispose();});}
  function start(){intro=3.3;clearSparks();}
  function go(pos){emit('go',pos,palette.gold,36);goFlash=.4;}
  function cameraOffset(){return {distance:6.8+Math.max(0,intro)*1.4,height:3.9+Math.max(0,intro)*.6,kick:goFlash};}
  function reset(){animations.length=0;perfSeconds=0;perfFrames=0;intro=0;goFlash=0;clearSparks();if(ambientLamp)ambientLamp.intensity=0;}
  function release(root){
    const cachedGeo=new Set([sphereGeo,smallSphere,...geometries.values()]),cachedMat=new Set(materials.values()),seenGeo=new Set(),seenMat=new Set(),seenTex=new Set();
    root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry&&!cachedGeo.has(o.geometry)&&!seenGeo.has(o.geometry)){seenGeo.add(o.geometry);o.geometry.dispose();}
      const mats=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];
      mats.forEach(m=>{if(cachedMat.has(m)||seenMat.has(m))return;seenMat.add(m);if(m.map&&m.map!==puffTexture&&m.map!==glowTexture&&!seenTex.has(m.map)){seenTex.add(m.map);m.map.dispose();}m.dispose();});
    });
  }
  window.PartyVisuals={palette,material,character,animateCharacter,platform,spinner,movingPlatform,bounce,hammer,vanishPlatform,gate,checkpoint,pole,environment,init,update,emit,quality,frameTime,batchStatic,start,go,cameraOffset,reset,release,box,orb,cylinder,torus,label};
})();
