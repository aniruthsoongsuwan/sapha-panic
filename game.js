(() => {
  'use strict';
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const W = 1000, H = 620;
  const memberSlider = $('members');
  let dpr = 1, members = [], player = { x: 500, y: 525, speed: 245 }, keys = new Set();
  let running = false, phase = 'ready', round = 1, score = 0, time = 0, phaseTime = 0;
  let pointerTarget = null, pointerTargetActive = false, pointerFollow = false;
  let lastTouchTap = null, touchStart = null, touchDragged = false, doubleTapHandled = false;
  let alertLength = 13, breakLength = 29, spawnClock = 0, bonkCooldown = 0, toastTime = 0, hitFlash = 0;
  let soundOn = true, audio = null, musicTimer = null, lastFrame = 0;
  const particles = [], popups = [];
  const moveVectors = {up:[0,-1],down:[0,1],left:[-1,0],right:[1,0],'up-left':[-1,-1],'up-right':[1,-1],'down-left':[-1,1],'down-right':[1,1],w:[0,-1],arrowup:[0,-1],s:[0,1],arrowdown:[0,1],a:[-1,0],arrowleft:[-1,0],d:[1,0],arrowright:[1,0]};
  const zones = [
    {x:82,y:270,label:'🚻 ห้องน้ำ 1',type:'bathroom',number:1,color:'#54c4dc'},
    {x:92,y:390,label:'🚻 ห้องน้ำ 2',type:'bathroom',number:2,color:'#54c4dc'},
    {x:205,y:535,label:'🚻 ห้องน้ำ 3',type:'bathroom',number:3,color:'#54c4dc'},
    {x:365,y:555,label:'🚻 ห้องน้ำ 4',type:'bathroom',number:4,color:'#54c4dc'},
    {x:635,y:555,label:'🚻 ห้องน้ำ 5',type:'bathroom',number:5,color:'#54c4dc'},
    {x:795,y:535,label:'🚻 ห้องน้ำ 6',type:'bathroom',number:6,color:'#54c4dc'},
    {x:908,y:390,label:'🚻 ห้องน้ำ 7',type:'bathroom',number:7,color:'#54c4dc'},
    {x:918,y:270,label:'🚻 ห้องน้ำ 8',type:'bathroom',number:8,color:'#54c4dc'},
    {x:755,y:130,label:'🚻 ห้องน้ำ 9',type:'bathroom',number:9,color:'#54c4dc'},
    {x:245,y:130,label:'🚻 ห้องน้ำ 10',type:'bathroom',number:10,color:'#54c4dc'},
    {x:500,y:540,label:'☕ มุมกาแฟ',type:'hangout',color:'#e7a65b'},
    {x:870,y:115,label:'📸 มุมเซลฟี่',type:'hangout',color:'#c391ef'},
    {x:130,y:115,label:'🛋️ มุมงีบ',type:'hangout',color:'#f0809d'}
  ];
  const clothes = ['#ef7182','#61b7ed','#f4c65b','#8ed58f','#b18aef','#f29c65','#64d3c1','#df8dc3'];
  const quips = ['กาแฟหมดหรือครับ?!','กลับไปนั่งก่อนน้า!','ถ่ายรูปเสร็จแล้วครับ!','ห้องน้ำอยู่ทางโน้น!','ประชุมแล้วจ้า!','ป๊อก! รับทราบครับ!'];

  function resize(){
    const rect = canvas.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width*dpr); canvas.height = Math.round(rect.width*(H/W)*dpr);
    ctx.setTransform(canvas.width/W,0,0,canvas.width/W,0,0);
    draw();
  }
  function seatPosition(i, total){
    const cols = 25, row = Math.floor(i/cols), col = i%cols;
    const rows = Math.ceil(total/cols), count = Math.min(cols,total-row*cols);
    const arcWidth = Math.min(780, count*27);
    const x = W/2 - arcWidth/2 + (count===1?0:col*arcWidth/(count-1));
    const y = 125 + row * Math.min(17, 330/Math.max(1,rows-1));
    return {x, y: y + Math.pow((x-W/2)/390,2)*30};
  }
  function makeMembers(n){
    members = Array.from({length:n}, (_,i)=>{
      const seat = seatPosition(i,n), hue = clothes[Math.floor(Math.random()*clothes.length)];
      return {id:i, seat, x:seat.x, y:seat.y, tx:seat.x, ty:seat.y, color:hue, state:'seat', mood:Math.random()*10, wobble:Math.random()*6, speed:38+Math.random()*30, cooldown:0};
    });
    $('memberTotal').textContent=n; $('present').textContent=n;
    $('quorum').textContent=Math.ceil(n/2);
  }
  function setupAudio(){ if(!audio) audio = new (window.AudioContext||window.webkitAudioContext)(); if(audio.state==='suspended') audio.resume(); }
  function tone(freq, duration=.12, type='sine', volume=.07, endFreq=null){
    if(!soundOn)return; setupAudio();
    const o=audio.createOscillator(), g=audio.createGain(), now=audio.currentTime;
    o.type=type; o.frequency.setValueAtTime(freq,now); if(endFreq)o.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),now+duration);
    g.gain.setValueAtTime(volume,now); g.gain.exponentialRampToValueAtTime(.001,now+duration);
    o.connect(g); g.connect(audio.destination); o.start(now); o.stop(now+duration);
  }
  function startMusic(){
    if(musicTimer)clearInterval(musicTimer);
    let i=0; const notes=[262,330,392,330,294,349,440,349];
    musicTimer=setInterval(()=>{ if(!running||!soundOn)return; tone(notes[i++%notes.length],.17,'triangle',phase==='alert'?.035:.018); },phase==='alert'?190:300);
  }
  function setToast(text){const el=$('toast');el.textContent=text;el.classList.add('show');toastTime=1.05;}
  function pop(text,x,y,color='#fff092'){popups.push({text,x,y,life:.9,color});}
  function burst(x,y,color){for(let i=0;i<7;i++){const a=Math.random()*Math.PI*2,s=45+Math.random()*100;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-25,life:.42+Math.random()*.35,color,size:2+Math.random()*3});}}
  function begin(){
    setupAudio(); running=true; phase='break'; round=1; score=0; time=0; phaseTime=0; spawnClock=0; player={x:500,y:525,speed:245};
    breakLength=Math.max(18,29-Math.min(9,round*.55)); alertLength=Math.max(9,13-round*.25);
    makeMembers(Number(memberSlider.value)); $('round').textContent=round; $('score').textContent='0';
    $('startBtn').textContent='↻ เริ่มใหม่'; $('stageHint').textContent='ยังไม่เรียกประชุม! เก็บคะแนนความป่วน แล้วเตรียมตัววิ่ง';
    setToast('พักเบรก! ปล่อยป่วนได้ 😎'); updatePhase(); startMusic();
  }
  function updatePhase(){
    const badge=$('phaseBadge');
    badge.className='phase-badge'+(phase==='alert'?' alert':'')+(phase==='over'?' bad':'');
    if(phase==='break')badge.textContent=`พักเบรก • เรียกประชุมใน ${Math.ceil(breakLength-phaseTime)} วิ`;
    else if(phase==='alert')badge.textContent=`🚨 วิปเรียกประชุม! เหลือ ${Math.ceil(alertLength-phaseTime)} วิ`;
    else if(phase==='over')badge.textContent='เกมจบ • องค์ประชุมไม่ครบ';
    else if(phase==='ready')badge.textContent='กดเริ่ม แล้วเริ่มป่วนได้!';
    else badge.textContent='✅ องค์ประชุมครบ!';
  }
  function beginAlert(){
    phase='alert'; phaseTime=0; $('stageHint').textContent='🚨 เสียงเรียกประชุมดังแล้ว! พาสมาชิกกลับที่นั่งให้ทัน';
    setToast('กริ๊งงง! กลับเข้าห้องประชุม!'); tone(740,.45,'square',.06,260); updatePhase();
  }
  function finishRound(){
    const seated=members.reduce((n,m)=>n+(m.state==='seat'?1:0),0), quorum=Math.ceil(members.length/2);
    $('present').textContent=seated;
    if(seated>=quorum){
      phase='won'; score+=300+round*80; $('score').textContent=score; setToast(`ครบองค์ประชุม! +${300+round*80} คะแนน 🎉`); tone(523,.18,'triangle',.06); setTimeout(()=>tone(659,.2,'triangle',.06),140); setTimeout(()=>tone(784,.35,'triangle',.06),290);
      updatePhase(); setTimeout(()=>{if(running&&phase==='won'){round++;$('round').textContent=round;phase='break';phaseTime=0;breakLength=Math.max(17,29-Math.min(11,round*.65));alertLength=Math.max(8,13-round*.3);$('stageHint').textContent='พักเบรก! ปล่อยป่วนได้ แล้วคอยฟังเสียงเรียกประชุม';updatePhase();}},2100);
    } else {
      phase='over'; running=false; setToast('องค์ประชุมไม่ครบ! ประธานมองแรง 😵'); tone(230,.6,'sawtooth',.06,80); updatePhase();
      $('stageHint').textContent=`นั่ง ${seated} คน แต่ต้องมี ${quorum} คน ลองใหม่แล้วช่วยวิปเรียกกลับให้ไวขึ้น!`;
    }
  }
  function wander(m){
    if(m.state!=='seat')return;
    const z=zones[Math.floor(Math.random()*zones.length)]; m.state='away';m.zone=z;m.tx=z.x+(Math.random()-.5)*35;m.ty=z.y+(Math.random()-.5)*24;
    m.cooldown=36+Math.random()*18;
    $('present').textContent=members.reduce((n,v)=>n+(v.state==='seat'?1:0),0);
  }
  function nudgeClosest(){
    if(!running||bonkCooldown>0)return;
    bonkCooldown=.36;
    let target=null,best=82;
    for(const m of members){if(m.state==='seat')continue;const d=Math.hypot(m.x-player.x,m.y-player.y);if(d<best){best=d;target=m;}}
    if(!target){pop('วืด! ใกล้ๆ ไม่มีใคร 😅',player.x,player.y-25,'#fff');tone(180,.08,'triangle',.025);return;}
    target.state='return';target.tx=target.seat.x;target.ty=target.seat.y;target.cooldown=0;
    burst(target.x,target.y,'#ffe36a');pop('ป๊อก! '+quips[Math.floor(Math.random()*quips.length)],target.x,target.y-9);
    setToast('ป๊อก! กลับที่นั่งครับ!');tone(440,.09,'triangle',.08,720);tone(760,.15,'sine',.045,350);
  }
  function movePlayer(dt){
    let dx=0,dy=0;for(const k of keys){const v=moveVectors[k];if(v){dx+=v[0];dy+=v[1];}}
    if(pointerTargetActive){const tx=pointerTarget.x-player.x,ty=pointerTarget.y-player.y,d=Math.hypot(tx,ty);if(d>12){dx+=tx/d;dy+=ty/d;}else if(!pointerFollow)pointerTargetActive=false;}
    if(dx||dy){const len=Math.hypot(dx,dy);player.x+=dx/len*player.speed*dt;player.y+=dy/len*player.speed*dt;}
    player.x=Math.max(28,Math.min(W-28,player.x));player.y=Math.max(105,Math.min(H-32,player.y));
    if(running&&phase==='alert'){
      for(const m of members){if(m.state==='away'&&Math.hypot(m.x-player.x,m.y-player.y)<22){m.state='return';m.tx=m.seat.x;m.ty=m.seat.y;m.cooldown=0;pop('เจอแล้ว! วิ่งกลับเลย!',m.x,m.y-5,'#aaffcb');}}
    }
  }
  function update(dt){
    time+=dt;bonkCooldown=Math.max(0,bonkCooldown-dt);hitFlash=Math.max(0,hitFlash-dt);
    if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('show');}
    if(running){
      phaseTime+=dt; movePlayer(dt);
      if(phase==='break'){
        spawnClock-=dt;
        const maxAway=Math.floor(members.length*.55);
        const away=members.reduce((n,m)=>n+(m.state==='away'?1:0),0);
        if(spawnClock<=0&&away<maxAway){const seated=members.filter(m=>m.state==='seat');const batch=Math.max(1,Math.ceil(members.length*.01));for(let i=0;i<batch&&seated.length&&away+i<maxAway;i++){const pick=Math.floor(Math.random()*seated.length);wander(seated.splice(pick,1)[0]);}spawnClock=Math.max(.38,.52-round*.012);}
        score+=away*dt*.32; $('score').textContent=Math.floor(score);
        if(phaseTime>=breakLength)beginAlert();
      }else if(phase==='alert'&&phaseTime>=alertLength)finishRound();
    }
    for(const m of members){
      m.mood+=dt*2; if(m.state==='away'){
        m.cooldown-=dt;
        if(m.cooldown<=0&&phase==='break'){m.state='return';m.tx=m.seat.x;m.ty=m.seat.y;}
        else if(phase==='break'&&Math.random()<dt*.15){m.tx=m.zone.x+(Math.random()-.5)*50;m.ty=m.zone.y+(Math.random()-.5)*40;}
      }
      if(m.state==='return'||m.state==='away'){
        const dx=m.tx-m.x,dy=m.ty-m.y,d=Math.hypot(dx,dy),speed=m.state==='return'?m.speed*1.55:m.speed*.72;
        if(d<speed*dt+1){m.x=m.tx;m.y=m.ty;if(m.state==='return'){m.state='seat';$('present').textContent=members.reduce((n,v)=>n+(v.state==='seat'?1:0),0);}}
        else{m.x+=dx/d*speed*dt;m.y+=dy/d*speed*dt;}
      }
    }
    for(let i=particles.length-1;i>=0;i--){let p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=130*dt;p.life-=dt;if(p.life<=0)particles.splice(i,1);}
    for(let i=popups.length-1;i>=0;i--){const p=popups[i];p.y-=25*dt;p.life-=dt;if(p.life<=0)popups.splice(i,1);}
    updatePhase();
  }
  function rounded(x,y,w,h,r,color,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
  function drawRoom(){
    const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#233c5a');bg.addColorStop(1,'#152238');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#314761';ctx.beginPath();ctx.ellipse(500,310,440,255,0,Math.PI,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#52677d';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(500,310,440,255,0,Math.PI,Math.PI*2);ctx.stroke();
    // Front speaker's dais and playful civic chamber decor.
    rounded(365,60,270,55,15,'#533d64','#a27db6');ctx.fillStyle='#fff0bd';ctx.font='bold 18px Prompt, sans-serif';ctx.textAlign='center';ctx.fillText('🏛️ ห้องประชุมใหญ่',500,94);
    rounded(405,337,190,54,12,'#ab8147','#e7c28b');ctx.fillStyle='#362b24';ctx.font='bold 15px Prompt, sans-serif';ctx.fillText('เก้าอี้ประธาน',500,370);
    for(const z of zones){
      if(z.type==='bathroom'){rounded(z.x-20,z.y-12,40,24,8,'#15364b',z.color);ctx.font='10px Prompt, sans-serif';ctx.fillStyle='#e9f8ff';ctx.fillText(`🚻${z.number}`,z.x,z.y+4);}
      else{rounded(z.x-49,z.y-14,98,28,9,z.color+'33',z.color);ctx.font='10px Prompt, sans-serif';ctx.fillStyle='#e9f2ff';ctx.fillText(z.label,z.x,z.y+4);}
    }
    // Stage lights and floor tile lines.
    ctx.strokeStyle='#29405d';ctx.lineWidth=1;for(let y=420;y<H;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  }
  function drawMember(m){
    const seated=m.state==='seat';const s=seated?1:.92;
    ctx.save();ctx.translate(m.x,m.y+Math.sin(m.mood)*.8);ctx.scale(s,s);
    // Tiny cartoon MPs are distinct by jacket color, skin tone, hair and glasses.
    ctx.fillStyle='#0006';ctx.beginPath();ctx.ellipse(0,5,5.8,2,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=m.color;ctx.beginPath();ctx.roundRect(-4,-.5,8,7,2);ctx.fill();
    ctx.fillStyle=['#f2c69d','#d99d74','#f4d3b1','#bd805e'][m.id%4];ctx.beginPath();ctx.arc(0,-4.5,4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=['#3d2d2a','#2e3540','#765140','#161c27'][m.id%4];ctx.beginPath();ctx.arc(0,-6,3.7,Math.PI,Math.PI*2);ctx.fill();
    if(m.id%9===0){ctx.strokeStyle='#253042';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(-1.4,-4.5,1.5,0,Math.PI*2);ctx.arc(1.4,-4.5,1.5,0,Math.PI*2);ctx.stroke();}
    if(m.state==='away'){ctx.font='9px sans-serif';ctx.fillText(m.zone.label.split(' ')[0],5,-8);}
    if(m.state==='return'){ctx.fillStyle='#aaffcb';ctx.font='bold 9px sans-serif';ctx.fillText('↩',5,-7);}
    ctx.restore();
  }
  function drawPlayer(){
    ctx.save();ctx.translate(player.x,player.y);
    ctx.fillStyle='#0007';ctx.beginPath();ctx.ellipse(0,14,16,5,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ffd36b';ctx.beginPath();ctx.roundRect(-11,-7,22,21,7);ctx.fill();
    ctx.fillStyle='#f0c6a1';ctx.beginPath();ctx.arc(0,-12,10,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#36415a';ctx.beginPath();ctx.arc(0,-15,10,Math.PI,Math.PI*2);ctx.fill();
    ctx.fillStyle='#15243b';ctx.beginPath();ctx.arc(-3,-12,1.2,0,Math.PI*2);ctx.arc(3,-12,1.2,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#c6944b';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(7,-3);ctx.lineTo(18,-18);ctx.stroke();ctx.fillStyle='#ffe7a4';ctx.beginPath();ctx.arc(18,-18,4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff';ctx.font='bold 11px Prompt, sans-serif';ctx.textAlign='center';ctx.fillText('หัวหน้าวิป',0,30);
    ctx.restore();
  }
  function draw(){
    if(!canvas.width)return;ctx.setTransform(canvas.width/W,0,0,canvas.width/W,0,0);drawRoom();
    for(const m of members)drawMember(m);
    for(const p of particles){ctx.globalAlpha=Math.max(0,p.life*2);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
    for(const p of popups){ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillStyle=p.color;ctx.font='bold 12px Prompt, sans-serif';ctx.textAlign='center';ctx.fillText(p.text,p.x,p.y);}ctx.globalAlpha=1;
    drawPlayer();
    if(phase==='ready'){
      ctx.fillStyle='#09122299';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='bold 30px Prompt, sans-serif';ctx.fillText('สภาวุ่น ลุ้นองค์ประชุม!',500,280);ctx.font='16px Prompt, sans-serif';ctx.fillStyle='#d8e5f7';ctx.fillText('กด “เริ่มเกม” แล้วช่วยวิปคุมความป่วน',500,315);
    }
  }
  function loop(now){const dt=Math.min(.04,(now-lastFrame)/1000||0);lastFrame=now;update(dt);draw();requestAnimationFrame(loop);}
  $('startBtn').addEventListener('click',begin);
  memberSlider.addEventListener('input',()=>{$('memberValue').textContent=memberSlider.value;if(!running){makeMembers(Number(memberSlider.value));}});
  $('soundBtn').addEventListener('click',()=>{soundOn=!soundOn;$('soundBtn').textContent=soundOn?'🔊 เสียงเปิด':'🔇 ปิดเสียง';$('soundBtn').setAttribute('aria-pressed',String(soundOn));if(soundOn){setupAudio();tone(660,.12,'triangle');}});
  canvas.addEventListener('pointerdown',e=>{
    e.preventDefault();canvas.setPointerCapture(e.pointerId);pointerFollow=e.pointerType==='touch';moveToPointer(e);
    touchStart={x:e.clientX,y:e.clientY};touchDragged=false;doubleTapHandled=false;
    if(e.pointerType==='touch'&&lastTouchTap&&performance.now()-lastTouchTap.time<380&&Math.hypot(e.clientX-lastTouchTap.x,e.clientY-lastTouchTap.y)<48){nudgeClosest();lastTouchTap=null;doubleTapHandled=true;}
  });
  canvas.addEventListener('pointermove',e=>{
    if(pointerFollow||(e.pointerType==='mouse'&&e.buttons))moveToPointer(e);
    if(pointerFollow&&touchStart&&Math.hypot(e.clientX-touchStart.x,e.clientY-touchStart.y)>18)touchDragged=true;
  });
  canvas.addEventListener('pointerup',e=>{
    if(e.pointerType==='touch'){
      if(!touchDragged&&!doubleTapHandled)lastTouchTap={x:e.clientX,y:e.clientY,time:performance.now()};
      pointerTargetActive=false;
    }
    pointerFollow=false;
  });
  canvas.addEventListener('pointercancel',()=>{pointerTargetActive=false;pointerFollow=false;lastTouchTap=null;});
  canvas.addEventListener('dblclick',e=>{e.preventDefault();nudgeClosest();});
  function moveToPointer(e){const r=canvas.getBoundingClientRect();pointerTarget={x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H};pointerTarget.x=Math.max(28,Math.min(W-28,pointerTarget.x));pointerTarget.y=Math.max(105,Math.min(H-32,pointerTarget.y));pointerTargetActive=true;}
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();keys.add(k);if(k===' ')nudgeClosest();});
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  $('fullscreenBtn').addEventListener('click',async()=>{
    const shell=document.querySelector('.game-shell');
    if(document.fullscreenElement){await document.exitFullscreen();$('fullscreenBtn').textContent='⛶ เต็มจอ';return;}
    if(shell.requestFullscreen){try{await shell.requestFullscreen();$('fullscreenBtn').textContent='⛶ ออกจากเต็มจอ';}catch{shell.classList.toggle('pseudo-fullscreen');$('fullscreenBtn').textContent=shell.classList.contains('pseudo-fullscreen')?'⛶ ออกจากเต็มจอ':'⛶ เต็มจอ';}}
    else{shell.classList.toggle('pseudo-fullscreen');$('fullscreenBtn').textContent=shell.classList.contains('pseudo-fullscreen')?'⛶ ออกจากเต็มจอ':'⛶ เต็มจอ';}
  });
  document.addEventListener('fullscreenchange',()=>{resize();$('fullscreenBtn').textContent=document.fullscreenElement?'⛶ ออกจากเต็มจอ':'⛶ เต็มจอ';});
  makeMembers(500);resize();window.addEventListener('resize',resize);updatePhase();requestAnimationFrame(loop);
})();
