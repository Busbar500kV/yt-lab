/* global Cesium */
const state = { viewer: null, spec: null, errors: [], tileSamples: [], record: null };

function hex(value, alpha = 1) { return Cesium.Color.fromCssColorString(value).withAlpha(alpha); }
function radians(value) { return Cesium.Math.toRadians(value); }
function setView(view) {
  const target = Cesium.Cartesian3.fromDegrees(view.lon, view.lat, 0);
  state.viewer.camera.lookAt(target, new Cesium.HeadingPitchRange(radians(view.heading_deg), radians(view.pitch_deg), view.range_m));
  state.viewer.scene.requestRender();
}
function shortest(from, to) { let d = ((to - from + 540) % 360) - 180; if (d === 180) d = -180; return d; }
function eased(kind, value) { const t=Math.max(0,Math.min(1,value)); return kind==='linear'?t:(t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2); }
function sample(from,to,p,kind){const t=eased(kind,p);return{lat:from.lat+(to.lat-from.lat)*t,lon:from.lon+shortest(from.lon,to.lon)*t,range_m:Math.exp(Math.log(from.range_m)+(Math.log(to.range_m)-Math.log(from.range_m))*t),heading_deg:from.heading_deg+shortest(from.heading_deg,to.heading_deg)*t,pitch_deg:from.pitch_deg+(to.pitch_deg-from.pitch_deg)*t};}
function timeline(sec){const s=state.spec,{start_hold_sec:a,move_sec:b,hold_sec:c,return_sec:d}=s.camera.timing;if(sec<a)return s.camera.start;if(sec<a+b)return sample(s.camera.start,s.camera.destination,(sec-a)/b,s.camera.easing);if(sec<a+b+c||!d)return s.camera.destination;return sample(s.camera.destination,s.camera.start,(sec-a-b-c)/d,s.camera.easing);}

function addOverlays() {
  const locations = new Map(state.spec.geography.locations.map((item) => [item.id,item]));
  for (const overlay of state.spec.overlays) {
    if (overlay.type === 'marker') {
      const loc=locations.get(overlay.location_id);
      const entity=state.viewer.entities.add({position:Cesium.Cartesian3.fromDegrees(loc.lon,loc.lat,0),point:{pixelSize:15,color:hex(overlay.color),outlineColor:Cesium.Color.BLACK,outlineWidth:3,disableDepthTestDistance:Number.POSITIVE_INFINITY},label:{text:overlay.label,font:'600 24px system-ui',fillColor:Cesium.Color.WHITE,outlineColor:Cesium.Color.BLACK,outlineWidth:5,style:Cesium.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new Cesium.Cartesian2(0,-34),verticalOrigin:Cesium.VerticalOrigin.BOTTOM,disableDepthTestDistance:Number.POSITIVE_INFINITY,showBackground:true,backgroundColor:Cesium.Color.BLACK.withAlpha(.62),backgroundPadding:new Cesium.Cartesian2(9,6)}});
      overlay._entity=entity;
    } else {
      const coords=overlay.points.flatMap((p)=>p);
      overlay._entity=state.viewer.entities.add({polyline:{positions:Cesium.Cartesian3.fromDegreesArray(coords),width:overlay.type==='boundary'?4:6,material:new Cesium.PolylineGlowMaterialProperty({color:hex(overlay.color),glowPower:.18}),clampToGround:true}});
    }
    overlay._entity.show = overlay.reveal_at_sec === 0;
  }
}

function updateOverlays(sec) { for (const item of state.spec.overlays) if (item._entity) item._entity.show=sec>=item.reveal_at_sec; }
async function waitTiles(timeout=25000) { const start=performance.now(); let stable=0; while(performance.now()-start<timeout){state.viewer.scene.requestRender();await new Promise(r=>setTimeout(r,100));const loaded=state.viewer.scene.globe.tilesLoaded;state.tileSamples.push({t:performance.now(),loaded});stable=loaded?stable+1:0;if(stable>=5)return true;}throw new Error('scene tiles did not become ready before timeout'); }
async function warm() { const steps=20;for(let i=0;i<=steps;i++){setView(sample(state.spec.camera.start,state.spec.camera.destination,i/steps,state.spec.camera.easing));await waitTiles();}state.viewer.scene.globe.preloadAncestors=false;state.viewer.scene.globe.preloadSiblings=false;setView(state.spec.camera.start);await waitTiles();await new Promise(r=>setTimeout(r,3000));await waitTiles();state.tileSamples=[]; }

async function setup(spec) {
  state.spec=spec; Cesium.Ion.defaultAccessToken='';
  let imageryProvider;
  if(spec.providers.imagery.id==='test-grid'){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;const x=canvas.getContext('2d');x.fillStyle='#17324a';x.fillRect(0,0,1024,512);x.strokeStyle='#5e8eaa';x.lineWidth=2;for(let i=0;i<=1024;i+=64){x.beginPath();x.moveTo(i,0);x.lineTo(i,512);x.stroke()}for(let i=0;i<=512;i+=64){x.beginPath();x.moveTo(0,i);x.lineTo(1024,i);x.stroke()}x.fillStyle='#d5e7ef';x.font='bold 80px sans-serif';x.fillText('TEST GRID',290,285);imageryProvider=await Cesium.SingleTileImageryProvider.fromUrl(canvas.toDataURL('image/png'));
  } else {
    imageryProvider=await Cesium.ArcGisMapServerImageryProvider.fromUrl(spec.providers.imagery.url,{credit:spec.providers.imagery.attribution,enablePickFeatures:false});
  }
  let terrainProvider=new Cesium.EllipsoidTerrainProvider();
  if(spec.providers.terrain.id==='reearth-terrain') terrainProvider=await Cesium.CesiumTerrainProvider.fromUrl(spec.providers.terrain.url,{requestVertexNormals:true,requestWaterMask:false});
  state.viewer=new Cesium.Viewer('cesium',{animation:false,baseLayerPicker:false,fullscreenButton:false,geocoder:false,homeButton:false,infoBox:false,navigationHelpButton:false,sceneModePicker:false,selectionIndicator:false,timeline:false,baseLayer:false,terrainProvider,requestRenderMode:false});
  state.viewer.imageryLayers.removeAll(); state.viewer.imageryLayers.addImageryProvider(imageryProvider);
  state.viewer.scene.globe.tileCacheSize=2000;state.viewer.scene.globe.preloadAncestors=true;state.viewer.scene.globe.preloadSiblings=true;
  state.viewer.scene.globe.enableLighting=true; state.viewer.scene.globe.dynamicAtmosphereLighting=false; state.viewer.scene.globe.showGroundAtmosphere=true; state.viewer.scene.highDynamicRange=true; state.viewer.scene.fog.enabled=true;
  state.viewer.clock.currentTime=Cesium.JulianDate.fromIso8601('2026-06-21T19:00:00Z');
  document.getElementById('attribution').textContent=`${spec.providers.imagery.attribution} · ${spec.providers.terrain.attribution}`;
  document.getElementById('context-note').textContent=spec.editorial.context_note;
  addOverlays(); setView(spec.camera.start); await warm();
  return {ready:true,webgl:state.viewer.scene.context.webgl2?'WebGL 2':'WebGL 1',renderer:state.viewer.scene.context._gl.getParameter(state.viewer.scene.context._gl.RENDERER)};
}

async function startRecord() {
  const canvas=document.createElement('canvas');canvas.width=state.spec.output.width;canvas.height=state.spec.output.height;
  const context=canvas.getContext('2d',{alpha:false});
  const stream=canvas.captureStream(0);const track=stream.getVideoTracks()[0];
  const type=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm;codecs=vp8';
  const chunks=[];const recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:Math.max(2_000_000,state.spec.output.width*state.spec.output.height*3)});
  recorder.ondataavailable=(event)=>{if(event.data.size)chunks.push(event.data)};
  const stopped=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=(e)=>reject(e.error||new Error('MediaRecorder failed'))});
  recorder.start();
  state.record={recorder,chunks,stopped,stream,type,canvas,context,track,frameTimes:[],captureFrame(sceneSec){
    context.drawImage(state.viewer.canvas,0,0,canvas.width,canvas.height);
    const scale=Math.max(1,canvas.width/1280);context.font=`${Math.round(11*scale)}px system-ui`;context.textBaseline='bottom';
    const attribution=document.getElementById('attribution').textContent;const contextNote=document.getElementById('context-note').textContent;
    const pad=Math.round(9*scale),line=Math.round(22*scale);context.fillStyle='rgba(0,0,0,.72)';
    const attrWidth=Math.min(canvas.width-pad*2,context.measureText(attribution).width+pad*2);context.fillRect(canvas.width-attrWidth-pad,canvas.height-line-pad,attrWidth,line);context.fillStyle='#f5f7fa';context.textAlign='right';context.fillText(attribution,canvas.width-pad*2,canvas.height-pad*1.5);
    context.font=`${Math.round(10*scale)}px system-ui`;const noteWidth=context.measureText(contextNote).width+pad*2;context.fillStyle='rgba(0,0,0,.62)';context.fillRect(pad,canvas.height-line-pad,noteWidth,line);context.fillStyle='#d6dce4';context.textAlign='left';context.fillText(contextNote,pad*2,canvas.height-pad*1.5);
    track.requestFrame();state.record.frameTimes.push({now:performance.now(),sceneSec});
  }};return type;
}
async function animate() { const slowdown=state.spec.output.capture_slowdown;const duration=state.spec.output.duration_sec*1000*slowdown;const interval=1000/state.spec.output.fps;const start=performance.now();let next=start;return new Promise((resolve)=>{function tick(now){if(now+.25<next){requestAnimationFrame(tick);return;}const sec=Math.min(state.spec.output.duration_sec,(now-start)/1000/slowdown);setView(timeline(sec));updateOverlays(sec);state.record?.captureFrame(sec);state.tileSamples.push({t:now,loaded:state.viewer.scene.globe.tilesLoaded});next+=interval;if(now-start<duration)requestAnimationFrame(tick);else{setView(timeline(state.spec.output.duration_sec));updateOverlays(state.spec.output.duration_sec);resolve();}}requestAnimationFrame(tick);}); }
async function stopRecord(){await new Promise(r=>setTimeout(r,100));state.record.recorder.stop();await state.record.stopped;for(const track of state.record.stream.getTracks())track.stop();const blob=new Blob(state.record.chunks,{type:state.record.type});const buffer=await blob.arrayBuffer();let binary='';const bytes=new Uint8Array(buffer);for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));const pairs=state.record.frameTimes.slice(1).map((v,i)=>({gap:v.now-state.record.frameTimes[i].now,priorSec:state.record.frameTimes[i].sceneSec}));const moveStart=state.spec.camera.timing.start_hold_sec,moveEnd=moveStart+state.spec.camera.timing.move_sec;const motion=pairs.filter(v=>v.priorSec>=moveStart-.1&&v.priorSec<=moveEnd+.1);return{base64:btoa(binary),bytes:bytes.length,type:state.record.type,tile_samples:state.tileSamples,captured_frames:state.record.frameTimes.length,max_frame_gap_ms:pairs.length?Math.max(...pairs.map(v=>v.gap)):null,max_motion_gap_ms:motion.length?Math.max(...motion.map(v=>v.gap)):null};}
function projectDestination(){const loc=state.spec.geography.locations.find((v)=>v.id===state.spec.geography.destination_id);setView(state.spec.camera.destination);const windowPoint=Cesium.SceneTransforms.worldToWindowCoordinates(state.viewer.scene,Cesium.Cartesian3.fromDegrees(loc.lon,loc.lat,0));return windowPoint?{x:windowPoint.x,y:windowPoint.y}:null;}

window.geoScene={setup,startRecord,animate,stopRecord,waitTiles,projectDestination,tileSamples:()=>state.tileSamples};
