(() => {
  'use strict';
  const canvas = document.getElementById('game');
  function showFatal(message) {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:20px;z-index:99;display:grid;place-items:center;text-align:center;padding:30px;border-radius:24px;background:#fff6e7;color:#24304a;font:800 20px/1.6 sans-serif;box-shadow:0 15px 50px #24304a44';
    box.innerHTML = '<div><h2 style="color:#ef5688">3D SCENE ERROR</h2><p></p><p style="font-size:14px;font-weight:600">Please keep this message when reporting the issue.</p></div>';
    box.querySelector('p').textContent=message;
    document.body.appendChild(box);
  }
  if (!window.THREE) { showFatal('Local vendor/three.min.js failed to load. Check that the project files are complete.'); return; }
  if (!window.PartyVisuals) { showFatal('Local visuals.js failed to load. Refresh and check that the project files are complete.'); return; }

  const $ = id => document.getElementById(id);
  const menu = $('menu'), hud = $('hud'), result = $('result'), settings = $('settings');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false }); }
  catch (error) { showFatal('Could not create a WebGL context: ' + error.message); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.physicallyCorrectLights = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x77c9ec);
  scene.fog = new THREE.Fog(0x9bdbef, 112, 360);
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, .1, 500);
  scene.add(new THREE.HemisphereLight(0xbfeeff, 0x77949f, .72));
  const sun = new THREE.DirectionalLight(0xfff0cc, 2.35);
  sun.position.set(-22, 32, -18); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45; sun.shadow.camera.right = 45; sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -10;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.025;
  scene.add(sun);
  const rim = new THREE.PointLight(0xff73b8, 28, 35); rim.position.set(-7, 8, -9); scene.add(rim);
  const coolFill = new THREE.PointLight(0x72d9ff, 16, 26); coolFill.position.set(10, 5, 32); scene.add(coolFill);
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

  const V = window.PartyVisuals;
  V.init(scene,renderer,camera,sun);
  const colors = [0xff668f,0x55c8ed,0xffc85a,0x9b87f5,0x61d69f,0xff965c,0xf07ad1,0x68a8ff,0xc2dc5c,0xef7e62,0x50d4c3,0xc18aff];
  const botNames = ['Mochi','Sprinkle','Bubbles','Pip','Jelly','Noodle','Taffy','Peach','Waffle','Fizz','Pudding'];
  const keys = {};
  addEventListener('keydown', e => { if (['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight'].includes(e.code)) { e.preventDefault(); keys[e.code] = true; } }, { passive:false });
  addEventListener('keyup', e => { keys[e.code] = false; });

  let state = 'menu', yaw = 0, pitch = .18, dragging = false, lastX = 0, lastY = 0;
  let elapsed = 0, shake = 0, fovTarget = 60, countdownTimer = null, toastTimer = null;
  const audio = { ctx:null, enabled:true, ensure(){ if(!this.enabled) return null; if(!this.ctx) { const C=window.AudioContext||window.webkitAudioContext; if(C) this.ctx=new C(); } if(this.ctx?.state==='suspended') this.ctx.resume(); return this.ctx; }, beep(freq,duration=.08,type='sine',gain=.035){ const c=this.ensure(); if(!c) return; const o=c.createOscillator(), g=c.createGain(); o.type=type; o.frequency.value=freq; g.gain.setValueAtTime(gain,c.currentTime); g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration); o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime+duration); } };
  canvas.tabIndex = 0;
  canvas.addEventListener('pointerdown', e => { canvas.focus(); dragging = true; lastX = e.clientX; lastY = e.clientY; });
  addEventListener('pointerup', () => dragging = false);
  addEventListener('pointermove', e => {
    if (!dragging || state !== 'race') return;
    yaw -= (e.clientX - lastX) * .006;
    pitch = THREE.MathUtils.clamp(pitch + (e.clientY - lastY) * .004, -.08, .65);
    lastX = e.clientX; lastY = e.clientY;
  });

  const world = new THREE.Group(); const decor = new THREE.Group(); scene.add(world,decor);
  const racers = [], obstacles = [], checkpoints = [], particles = [];
  let player;
  const COURSE_END = 258, COURSE_WIDTH = 12;


  function addLabel(text, color, y, scale=1) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96;
    const ctx = c.getContext('2d'); ctx.font = '900 52px Arial'; ctx.textAlign = 'center'; ctx.lineWidth = 12; ctx.strokeStyle = '#ffffff'; ctx.strokeText(text, 256, 65); ctx.fillStyle = typeof color === 'number' ? '#' + color.toString(16).padStart(6,'0') : color; ctx.fillText(text, 256, 65);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(c), transparent:true, depthTest:false }));
    sprite.position.y = y; sprite.scale.set(3.7 * scale, .7 * scale, 1); return sprite;
  }
  function roundedBody(color) { return V.character(color); }

  function makeRacer(name, color, x, z, isPlayer, rank) {
    const group = roundedBody(color);
    if (isPlayer) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3,.07,12,40), new THREE.MeshBasicMaterial({color:0xfff06a,transparent:true,opacity:.95})); ring.rotation.x=Math.PI/2; ring.position.y=-1.05; group.add(ring); group.add(addLabel('YOU',0xef4f87,2.45,.58));
    }
    group.position.set(x,1.15,z); world.add(group);
    return { name, color, group, x, z, y:0, vy:0, cp:0, finished:false, eliminated:false, finishTime:0, falls:0, stun:0, invincible:0, hitCooldown:0, skill:isPlayer ? 1 : (.48 + rank * .035), velocity:new THREE.Vector2(), heading:0, botOffset:(Math.random()-.5)*1.7, wait:0, fallCooldown:0 };
  }
  function coursePlatform(z,width=12,color=0xffd36b,length=30) { world.add(V.platform(z,width,color,length)); }

  function createCheckpoint(z,number) { const gate=V.checkpoint(z,number);world.add(gate);checkpoints.push({z,number,gate}); }

  function addSpinner(z,color,arms=2,radius=5,speed=1.4) { const g=V.spinner(color,arms,radius);g.position.set(0,1.2,z);world.add(g);obstacles.push({type:'spinner',g,z,radius,speed,arms}); }

  function addMovingPlatforms() {
    [-3.4,3.4].forEach((x,i)=>{const g=V.movingPlatform(i?0x54bdcf:0xef799d);g.position.set(x,.1,69+i*10);world.add(g);obstacles.push({type:'moving',g,baseX:x,range:2.3,phase:i*Math.PI,z:69+i*10,width:2.2,depth:4});});
  }

  function addPendulum() {
    const pivot=V.hammer();pivot.position.set(0,7,99);world.add(pivot);
    obstacles.push({type:'pendulum',g:pivot,ball:pivot.userData.ball,z:99,radius:1.75,speed:2.1});
    const frame=new THREE.Group();frame.position.z=99;world.add(frame);
    for(const side of [-1,1]){V.box(frame,.48,7.4,.55,V.palette.teal,side*6.6,3.5,0,.14);V.box(frame,1.1,.45,1.3,V.palette.ink,side*6.6,-.1,0,.1);}
    V.box(frame,13.6,.5,.62,V.palette.ink,0,7.1,0,.16);
  }
  function addBouncePad(){const g=V.bounce();g.position.set(-2.4,.2,128);world.add(g);obstacles.push({type:'bounce',g,z:128,radius:2.2});}

  function addDisappearPad() { const m=V.vanishPlatform();m.position.set(0,.1,188);world.add(m);obstacles.push({type:'vanish',g:m,z:188,width:2.5,depth:3,active:true,timer:0}); }
  function createFinish(){world.add(V.gate(COURSE_END,'FINISH!',true));}

  function buildWorld() {
    const palette=[0x3bb8b2,0xf08096,0x61bfd0,0x739ac7,0xe8b457,0xa68ccc,0x68bd99,0xeb92aa,0xe9ba63];
    [0,30,90,120,150,210,240].forEach(z=>coursePlatform(z,COURSE_WIDTH,palette[(z/30)|0]));
    coursePlatform(60,COURSE_WIDTH,palette[2],6); coursePlatform(84,COURSE_WIDTH,palette[2],6);
    coursePlatform(180,COURSE_WIDTH,palette[6],5); coursePlatform(191,COURSE_WIDTH,palette[6],19);
    for(let z=0;z<270;z+=15) [-6,6].forEach(x => { const pole=V.pole();pole.position.set(x,0,z);world.add(pole); });
    createCheckpoint(30,1); createCheckpoint(90,2); createCheckpoint(150,3); createCheckpoint(210,4);
    // Two perpendicular bars form a readable cross-shaped windmill. Later gates spin faster.
    addSpinner(43,0xff6a96,2,5,.72); addMovingPlatforms(); addPendulum(); addBouncePad(); addSpinner(157,0x55c8e8,2,4.4,1.06); addDisappearPad(); addSpinner(222,0x72d6a0,2,4.1,1.42); createFinish();
  }
  function decorateSky(){V.environment(decor);world.add(V.gate(-.6,'RACE START'));}

  function clearWorld() {
    V.release(world);V.release(decor);
    while(world.children.length)world.remove(world.children[0]);while(decor.children.length)decor.remove(decor.children[0]);
    obstacles.length=0;checkpoints.length=0;racers.length=0;V.reset();
    particles.splice(0).forEach(p=>{scene.remove(p);p.geometry.dispose();p.material.dispose();});
  }
  function resetRace() {
    clearWorld(); buildWorld(); decorateSky();V.batchStatic(world,obstacles.map(o=>o.g)); elapsed=0; yaw=0; pitch=.18; shake=0;fovTarget=60;$('celebration').classList.remove('active');
    player=makeRacer('You',colors[0],0,2,true,0); racers.push(player);
    botNames.forEach((name,i) => racers.push(makeRacer(name,colors[i+1],(i%4-1.5)*1.8,2+Math.floor(i/4)*1.5,false,11-i)));
    camera.position.set(0,6.5,-11); camera.lookAt(0,1,20);
    updateHUD();
  }
  function startRace() {
    if(countdownTimer) clearInterval(countdownTimer);
    resetRace(); V.start(); state='countdown'; menu.classList.add('hidden'); result.classList.add('hidden'); hud.classList.remove('hidden');
    const cd=$('countdown'); cd.classList.remove('hidden'); let n=3; cd.textContent='3';
    audio.beep(440,.12,'triangle');
    countdownTimer=setInterval(()=>{ n--; if(n>0) { cd.textContent=String(n);cd.style.animation='none';void cd.offsetWidth;cd.style.animation=''; audio.beep(440+n*80,.1,'triangle'); } else if(n===0) { cd.textContent='GO!'; cd.dataset.beat=String(n);V.go(player.group.position); state='race'; toast('RACE ON!'); audio.beep(880,.18,'square'); } else { clearInterval(countdownTimer); countdownTimer=null; cd.classList.add('hidden'); } },1000);
  }
  $('playBtn').onclick=startRace; $('againBtn').onclick=startRace;
  $('menuBtn').onclick=()=>{ if(countdownTimer) { clearInterval(countdownTimer); countdownTimer=null; } state='menu'; result.classList.add('hidden'); menu.classList.remove('hidden'); hud.classList.add('hidden'); };
  $('settingsBtn').onclick=()=>settings.classList.remove('hidden'); $('closeSettings').onclick=()=>settings.classList.add('hidden');
  $('quality').onchange=e=>V.quality(e.target.value);
  $('sound').onchange=e=>{ audio.enabled=e.target.checked; if(audio.enabled) audio.beep(660,.08); };
  document.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>audio.beep(520,.055,'square')));

  function burst(position,color,count=16) {
    const geo=new THREE.BufferGeometry(), a=new Float32Array(count*3);
    for(let i=0;i<count;i++) { a[i*3]=position.x; a[i*3+1]=position.y; a[i*3+2]=position.z; }
    geo.setAttribute('position',new THREE.BufferAttribute(a,3));
    const points=new THREE.Points(geo,new THREE.PointsMaterial({color,size:.22,transparent:true,opacity:.9,depthWrite:false}));
    points.userData={life:.55,vel:Array.from({length:count},()=>new THREE.Vector3((Math.random()-.5)*5,Math.random()*6,(Math.random()-.5)*5))}; scene.add(points); particles.push(points);
  }
  function toast(text) { const t=$('toast'); t.textContent=text; t.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.add('hidden'),1800); }
  function celebrate(name){
    const panel=$('celebration');panel.querySelector('strong').textContent=name==='You'?'You crossed the finish first!':name+' crossed the finish first!';
    panel.classList.remove('active');void panel.offsetWidth;panel.classList.add('active');
  }
  function currentCheckpoint(e) { return e.cp ? checkpoints[e.cp-1].z + 2 : 2; }
  function eliminate(e) { if(e.eliminated || e.finished) return; e.eliminated=true; e.group.visible=false; burst(new THREE.Vector3(e.x,1.5,e.z),0xff578b,25); if(e===player) { toast('ELIMINATED · Spectating leaders'); shake=.7; } }
  function respawn(e) {
    e.falls++; e.fallCooldown=.8;
    if(e.falls>=3) { eliminate(e); audio.beep(120,.2,'sawtooth',.05); return; }
    e.x=(Math.random()-.5)*1.5; e.z=currentCheckpoint(e); e.y=1.2; e.vy=0; e.invincible=1; e.stun=0;
    if(e===player) { shake=.5; toast('RESPAWNED · Checkpoint '+e.cp+'/4'); audio.beep(240,.12,'sine'); }
  }
  function movePlayer(dt) {
    if(player.finished || player.eliminated) return;
    const sprint=keys.ShiftLeft||keys.ShiftRight, speed=sprint?15:8;
    const h=(keys.KeyD?1:0)-(keys.KeyA?1:0), v=(keys.KeyW?1:0)-(keys.KeyS?1:0);
    const forward=new THREE.Vector3(-Math.sin(yaw),0,Math.cos(yaw)), right=new THREE.Vector3(-Math.cos(yaw),0,-Math.sin(yaw));
    const move=forward.multiplyScalar(v).add(right.multiplyScalar(h)); if(move.lengthSq()>0) move.normalize();
    player.velocity.set(move.x*speed,move.z*speed);
    if(player.stun<=0) { player.x+=player.velocity.x*dt; player.z+=player.velocity.y*dt; if(move.lengthSq()>0) player.heading=Math.atan2(move.x,move.z); }
    if(keys.Space && player.y<=.02) { player.vy=10; player.y=.03; burst(player.group.position,0xfff1a1,8); audio.beep(620,.1,'triangle'); }
    if(sprint && move.lengthSq()>0 && Math.random()<dt*7) audio.beep(180,.025,'sawtooth',.012);
    fovTarget=sprint?70:60;
  }
  function moveBot(bot,dt) {
    if(bot.finished || bot.eliminated) return;
    const ahead=bot.z+8;
    let targetX=Math.sin(ahead*.11+bot.botOffset)*1.5;
    const hasSpinner=obstacles.find(o=>o.type==='spinner' && Math.abs(o.z-bot.z)<4);
    if(hasSpinner && Math.random()<.006*(1.25-bot.skill)) targetX=(Math.random()-.5)*7.5;
    const side=(targetX-bot.x); bot.x+=THREE.MathUtils.clamp(side,-1,1)*dt*3.4;
    const base=6.1+bot.skill*5; bot.z+=base*dt;
    bot.heading=Math.atan2(THREE.MathUtils.clamp(side,-1,1),1);
    if((Math.sin(elapsed*1.7+bot.botOffset)> .985 || (bot.z>126&&bot.z<130&&bot.x<-1)) && bot.y<=.02 && Math.random()<.06) bot.vy=8.8+bot.skill;
    if(Math.random()<dt*.012*(1.15-bot.skill)) bot.x+=(Math.random()-.5)*4.5;
    if(Math.abs(bot.x)>6.2 && Math.random()<dt*.35) bot.y=-7;
  }
  function applyGroundAndBounds(e,dt) {
    if(e.eliminated || e.finished) return;
    e.stun=Math.max(0,e.stun-dt); e.invincible=Math.max(0,e.invincible-dt); e.hitCooldown=Math.max(0,e.hitCooldown-dt);
    e.vy-=25*dt; e.y+=e.vy*dt;
    const staticGround = Math.abs(e.x)<=5.5 && !((e.z>66&&e.z<84)||(e.z>185&&e.z<191));
    const movingGround = obstacles.some(o=>o.type==='moving'&&Math.abs(e.z-o.g.position.z)<o.depth/2+.45&&Math.abs(e.x-o.g.position.x)<o.width+.45);
    const vanish = obstacles.find(o=>o.type==='vanish');
    const vanishGround = vanish&&vanish.active&&Math.abs(e.z-vanish.z)<vanish.depth&&Math.abs(e.x-vanish.g.position.x)<vanish.width;
    if(e.y<0 && (staticGround||movingGround||vanishGround)) { if(e.vy<-7 && e===player) burst(e.group.position,0xfff5b4,6); e.y=0; e.vy=0; }
    if(Math.abs(e.x)>5.8) e.y-=11*dt;
    if(e.y<-6 || e.z<-3) respawn(e);
  }
  function updateObstacles(dt) {
    obstacles.forEach(o=> {
      if(o.type==='spinner') o.g.rotation.y+=o.speed*dt;
      if(o.type==='moving') o.g.position.x=o.baseX+Math.sin(elapsed*1.1+o.phase)*o.range;
      if(o.type==='pendulum') o.g.rotation.z=Math.sin(elapsed*o.speed)*.62;
      if(o.type==='vanish') {
        const occupant=racers.some(e=>!e.eliminated&&!e.finished&&Math.abs(e.z-o.z)<o.depth&&Math.abs(e.x-o.g.position.x)<o.width&&e.y<.2);
        if(occupant && o.active) o.timer+=dt;
        else if(o.active) { o.timer=0; o.g.visible=true; }
        else if(!o.active) o.timer+=dt;
        if(o.active && o.timer>1) { o.active=false; o.timer=0; o.g.visible=false; }
        if(!o.active && o.timer>2) { o.active=true; o.timer=0; o.g.visible=true; }
        if(o.active && o.timer>.55) o.g.visible=Math.floor(o.timer*12)%2===0;
      }
    });
  }
  function collisionAndCourse(e,dt) {
    if(e.eliminated || e.finished) return;
    const hazardImmune=e.invincible>0||e.hitCooldown>0;
    if(!hazardImmune) obstacles.forEach(o=> {
      if(o.type==='spinner') {
        // Test the rotating core and the actual bar capsule, rather than a large static circle.
        // This leaves a fair gap beside the bar and lets a jump clear it.
        if(e.y>.65) return;
        o.g.updateMatrixWorld(true);
        const local=o.g.worldToLocal(new THREE.Vector3(e.x,1.15+e.y,e.z));
        const coreHit=Math.hypot(local.x,local.z)<1.35;
        let bladeHit=false, escape=new THREE.Vector2();
        for(let i=0;i<o.arms;i++) {
          const a=i*Math.PI/o.arms, c=Math.cos(a), s=Math.sin(a);
          const along=local.x*c-local.z*s, across=local.x*s+local.z*c;
          if(Math.abs(along)<=o.radius+.2 && Math.abs(across)<=.58) {
            bladeHit=true;
            const side=Math.sign(across)||Math.sign(along)||1;
            escape.set(s*side,c*side); break;
          }
        }
        if(!coreHit&&!bladeHit) return;
        if(coreHit&&e.velocity.lengthSq()>.01) escape.set(-e.velocity.x,-e.velocity.y).normalize();
        else if(escape.lengthSq()===0) escape.set(local.x,local.z).normalize();
        if(escape.lengthSq()===0) escape.set(0,-1);
        e.x+=escape.x*1.55; e.z+=escape.y*1.55; e.vy=Math.max(e.vy,4.8);
        e.stun=.12; e.invincible=.55; e.hitCooldown=.55;
        if(e===player){shake=.22;burst(e.group.position,0xffffff,7);audio.beep(170,.07,'sawtooth');}
        return;
      }
      if(Math.abs(e.z-o.z)>3.5) return;
      let ox=o.g.position.x, oz=o.z, rad=o.radius||2.2;
      if(o.type==='pendulum') { const ballPosition=o.ball.getWorldPosition(new THREE.Vector3()); ox=ballPosition.x; oz=ballPosition.z; }
      if(o.type==='moving') { ox=o.g.position.x; rad=o.width; }
      const d=Math.hypot(e.x-ox,e.z-oz);
      if(d>rad) return;
      if(o.type==='bounce') { e.vy=14; burst(e.group.position,0xfff1b7,10); if(e===player) audio.beep(760,.1,'triangle'); return; }
      if(o.type==='moving') return;
      const dx=e.x-ox,dz=e.z-oz,len=Math.hypot(dx,dz),force=1.15+Math.random()*.35;
      const push=len>.001?new THREE.Vector2(dx/len,dz/len):new THREE.Vector2(0,-1);
      e.x+=push.x*force;e.z+=push.y*force;e.vy=Math.max(e.vy,5.5);e.stun=.15;e.invincible=.45;e.hitCooldown=.45;
      if(e===player) { shake=.28; burst(e.group.position,0xffffff,8); audio.beep(160,.08,'sawtooth'); }
    });
    racers.forEach(other=> {
      if(other===e || other.eliminated || other.finished) return;
      const dx=e.x-other.x, dz=e.z-other.z, d=Math.hypot(dx,dz);
      if(d>.001 && d<1.55) { const force=(1.55-d)*.6; e.x+=dx/d*force; e.z+=dz/d*force*.55; if(e===player) shake=Math.max(shake,.08); }
    });
    checkpoints.forEach(cp=> { if(e.z>=cp.z && e.cp<cp.number) { e.cp=cp.number; if(e===player) { toast('CHECKPOINT '+e.cp+'/4'); burst(e.group.position,0xffdf68,18); audio.beep(900,.12,'triangle'); } } });
    if(e.z>=COURSE_END) { const first=!racers.some(r=>r.finished);e.finished=true; e.finishTime=elapsed; e.group.visible=true; burst(new THREE.Vector3(e.x,2,e.z),0xffdb57,35);V.emit('finish',new THREE.Vector3(e.x,2,e.z),0xffdb57,65);if(first)celebrate(e.name);audio.beep(e===player?1040:760,.2,'square'); if(e===player) toast('YOU FINISHED!'); }
  }
  function syncRacer(e,dt) {
    if(!e.group || !e.group.visible)return;
    e.group.position.set(e.x,1.15+(e.finished?0:e.y),e.z);
    const delta=Math.atan2(Math.sin(e.heading-e.group.rotation.y),Math.cos(e.heading-e.group.rotation.y));
    e.group.rotation.y+=delta*(1-Math.exp(-dt*14));
    V.animateCharacter(e,dt,state);
  }

  function updateHUD() {
    if(!player) return;
    $('playersLeft').textContent=racers.filter(e=>!e.finished&&!e.eliminated).length;
    $('cpText').textContent=player.cp+'/4'; $('progressFill').style.width=Math.min(100,Math.max(0,player.z/COURSE_END*100))+'%';
    $('progressLabel').textContent=player.finished?'FINISH':(player.eliminated?'SPECTATING':player.cp?'CHECKPOINT '+player.cp:'START');
  }
  function updateParticles(dt) {
    for(let i=particles.length-1;i>=0;i--) { const p=particles[i]; p.userData.life-=dt; const a=p.geometry.attributes.position.array;
      p.userData.vel.forEach((v,j)=>{a[j*3]+=v.x*dt;a[j*3+1]+=v.y*dt;a[j*3+2]+=v.z*dt;v.y-=12*dt;}); p.geometry.attributes.position.needsUpdate=true; p.material.opacity=Math.max(0,p.userData.life*2);
      if(p.userData.life<=0) { scene.remove(p);p.geometry.dispose();p.material.dispose(); particles.splice(i,1); }
    }
  }
  const cameraRay=new THREE.Raycaster();
  function updateCamera(dt) {
    if(!player)return;
    let focus=player;if(player.eliminated)focus=racers.find(e=>!e.eliminated&&!e.finished)||player;
    const offset=V.cameraOffset(),forward=new THREE.Vector3(-Math.sin(yaw),0,Math.cos(yaw));
    const target=new THREE.Vector3(focus.x,1.2+focus.y*.7,focus.z).addScaledVector(forward,2.6);
    const behind=new THREE.Vector3(focus.x,offset.height+focus.y*.65+pitch*2.8,focus.z).addScaledVector(forward,-offset.distance);
    if(state==='menu'){behind.set(-3.8,3.3,-5.8);target.set(3.1,1.35,4);}
    const anchor=new THREE.Vector3(focus.x,1.6+focus.y,focus.z),direction=behind.clone().sub(anchor),distance=direction.length();
    cameraRay.set(anchor,direction.normalize());cameraRay.far=distance;
    const cameraBlockers=[];
    obstacles.forEach(o=>{if(!o.g.visible)return;o.g.updateMatrixWorld(true);o.g.traverse(part=>{if(part.isMesh&&part.visible&&!part.material.transparent)cameraBlockers.push(part);});});
    const hits=cameraRay.intersectObjects(cameraBlockers,false);
    if(hits.length&&hits[0].distance<distance)behind.copy(anchor).addScaledVector(direction,Math.max(1.1,hits[0].distance-.35));
    camera.position.lerp(behind,1-Math.exp(-dt*9));camera.lookAt(target);
    if(shake>0){camera.position.x+=(Math.random()-.5)*shake*.6;camera.position.y+=(Math.random()-.5)*shake*.4;shake=Math.max(0,shake-dt);}
    const fov=state==='menu'?52:fovTarget-offset.kick*3;
    camera.fov+=(fov-camera.fov)*Math.min(1,dt*8);camera.updateProjectionMatrix();
  }

  function finishRace() {
    if(state==='result') return; state='result'; hud.classList.add('hidden');
    const order=[...racers].sort((a,b)=> {
      const av=a.finished?a.finishTime:(a.eliminated?9999:1000-a.z), bv=b.finished?b.finishTime:(b.eliminated?9999:1000-b.z); return av-bv;
    });
    const place=order.indexOf(player)+1; const suffix=place%100>=11&&place%100<=13?'th':(['th','st','nd','rd'][place%10]||'th'); $('resultTitle').textContent=player.finished ? 'YOU FINISHED · '+place+suffix.toUpperCase()+' PLACE!' : 'RACE COMPLETE!';
    const list=$('resultsList'); list.innerHTML=''; order.forEach((e,i)=> { const placeText=i<3?['🥇','🥈','🥉'][i]:String(i+1); const time=e.finished?(Math.floor(e.finishTime)+'.'+String(Math.floor(e.finishTime*10)%10)+'s'):(e.eliminated?'OUT':'DNF'); list.innerHTML+=`<div class="row ${e===player?'you':''}"><span class="rank">${placeText}</span><span class="avatar" style="background:#${e.color.toString(16).padStart(6,'0')}"></span><span class="name">${e.name}</span><span class="time">${time}</span></div>`; });
    result.classList.remove('hidden');
  }
  function update(dt) {
    elapsed+=dt; updateObstacles(dt);
    if(state==='race') { movePlayer(dt); racers.slice(1).forEach(b=>moveBot(b,dt)); racers.forEach(e=>applyGroundAndBounds(e,dt)); racers.forEach(e=>collisionAndCourse(e,dt)); racers.forEach(e=>syncRacer(e,dt));
      if(racers.filter(e=>e.finished||e.eliminated).length>=racers.length || elapsed>100) finishRace();
    }
    if(state!=='race')racers.forEach(e=>syncRacer(e,dt));
    rim.position.set(player.x-7,8,player.z-9);coolFill.position.set(player.x+10,5,player.z+10);
    V.update(dt,player,state,obstacles);updateHUD(); updateCamera(dt); updateParticles(dt);
  }
  resetRace();
  let last=performance.now(), runtimeErrorShown=false;
  function loop(now) { const frameDt=(now-last)/1000,dt=Math.min(.035,frameDt); last=now; try { V.frameTime(frameDt,state);update(dt); renderer.render(scene,camera); } catch(error) { console.error(error); if(!runtimeErrorShown) { runtimeErrorShown=true; showFatal('Race loop error: '+error.message); } } requestAnimationFrame(loop); }
  window.partyDiagnostics=()=>({state,player:{x:player.x,y:player.y,z:player.z,visible:player.group.visible},drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,quality:document.documentElement.dataset.quality||'high',runtimeError:runtimeErrorShown});
  requestAnimationFrame(loop);
})();
