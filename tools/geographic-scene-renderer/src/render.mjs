import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { loadSpec, TOOL_ID, TOOL_VERSION, UPSTREAM_COMMIT } from './spec.mjs';
import { gitCommit, probeVideo, sha256File, writeJson } from './util.mjs';
import { startViewerServer } from './server.mjs';

function run(command, args, options = {}) { return execFileSync(command, args, { stdio: 'pipe', ...options }); }
function exists(file, label) { if (!fs.existsSync(file)) throw new Error(`${label} not found: ${file}`); }
function processPeakRssKb() { return Number(run('ps', ['-o', 'rss=', '-p', String(process.pid)], { encoding: 'utf8' }).trim() || 0); }
function existingAncestor(candidate) {
  let current=path.resolve(candidate);
  while(!fs.existsSync(current)){
    const parent=path.dirname(current);
    if(parent===current)throw new Error(`cannot find an existing parent for ${candidate}`);
    current=parent;
  }
  return current;
}

async function launch(upstream, cacheDir) {
  const require = createRequire(path.join(upstream, 'package.json'));
  const puppeteer = require('puppeteer');
  process.env.PUPPETEER_CACHE_DIR = cacheDir;
  const chrome=await puppeteer.executablePath();
  const gpuGroup=process.env.GEOGRAPHIC_RENDER_GPU_GROUP;
  let executablePath=chrome;let userDataDir;let graphicsMode='software-swiftshader';
  let args=['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu-sandbox','--hide-scrollbars','--autoplay-policy=no-user-gesture-required'];
  if(gpuGroup){
    if(!/^[a-z_][a-z0-9_-]*$/i.test(gpuGroup))throw new Error('GEOGRAPHIC_RENDER_GPU_GROUP is invalid');
    const currentUser=os.userInfo().username;
    const launcher=path.join(cacheDir,'gpu-browser-launcher.sh');
    fs.mkdirSync(cacheDir,{recursive:true});
    fs.writeFileSync(launcher,`#!/bin/sh\nexec /usr/bin/sudo -n -u ${currentUser} -g ${gpuGroup} '${chrome.replaceAll("'","'\\''")}' \"$@\"\n`,{mode:0o700});
    userDataDir=path.join(cacheDir,'gpu-profile');fs.mkdirSync(userDataDir,{recursive:true});
    executablePath=launcher;graphicsMode=`hardware-via-group-${gpuGroup}`;
    args=['--no-sandbox','--disable-setuid-sandbox','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl-egl','--hide-scrollbars','--autoplay-policy=no-user-gesture-required'];
  }
  const browser=await puppeteer.launch({executablePath,headless:true,userDataDir,args});
  browser.__graphicsMode=graphicsMode;return browser;
}

function previews(mp4, outputDir, duration) {
  const moments = [Math.max(.2,duration*.08), duration*.58, duration*.82];
  const files = moments.map((at, index) => path.join(outputDir, `preview-${index+1}.jpg`));
  for(let i=0;i<files.length;i++) run('ffmpeg',['-y','-loglevel','error','-ss',String(moments[i]),'-i',mp4,'-frames:v','1','-q:v','2',files[i]]);
  const contact=path.join(outputDir,'contact-sheet.jpg');
  run('ffmpeg',['-y','-loglevel','error','-i',mp4,'-vf',`fps=5/${duration},scale=640:-2:flags=lanczos,tile=5x1:padding=6:margin=6:color=0x111111`,'-frames:v','1','-q:v','2',contact]);
  return {files,contact,moments};
}

function qualityChecks(mp4, properties, spec, tileSamples) {
  if(properties.codec!=='h264'||properties.pixel_format!=='yuv420p') throw new Error('encoded output is not H.264/yuv420p');
  if(properties.width!==spec.output.width||properties.height!==spec.output.height) throw new Error('encoded dimensions differ from specification');
  if(Math.abs(properties.duration_sec-spec.output.duration_sec)>.15) throw new Error('encoded duration differs from specification');
  if(Math.abs(properties.frame_count-spec.output.fps*spec.output.duration_sec)>2) throw new Error('encoded frame count differs from specification');
  if(!properties.fast_start) throw new Error('MP4 moov atom is not before media data');
  const scan=spawnSync('ffmpeg',['-hide_banner','-i',mp4,'-vf','blackdetect=d=0.08:pix_th=0.05','-an','-f','null','-'],{encoding:'utf8'});
  if(scan.status!==0)throw new Error(`black-frame scan failed: ${scan.stderr.slice(-500)}`);
  const black=scan.stderr;
  if(/black_start/.test(black)) throw new Error('blank/black frames detected');
  const during = tileSamples.filter((sample)=>sample.t>0);
  const loadedRatio = during.length ? during.filter((sample)=>sample.loaded).length/during.length : 0;
  if(loadedRatio<.8 && !spec.testing) throw new Error(`scene data readiness fell below threshold (${(loadedRatio*100).toFixed(1)}%)`);
  return {black_frame_scan:'passed',tile_ready_sample_ratio:Number(loadedRatio.toFixed(4))};
}

export async function render(specFile, outputDir, options = {}) {
  const started=performance.now(); const diskRoot=existingAncestor(path.dirname(path.resolve(outputDir)));const diskStats=fs.statfsSync(diskRoot);const diskBefore=diskStats.bavail*diskStats.bsize;
  if(diskBefore<2*1024**3) throw new Error('less than 2 GiB free; refusing to begin render');
  const {spec,path:specPath}=loadSpec(specFile); outputDir=path.resolve(outputDir);
  if(fs.existsSync(outputDir)&&fs.readdirSync(outputDir).length) throw new Error(`output directory is not empty: ${outputDir}`);
  fs.mkdirSync(outputDir,{recursive:true});
  const activeMarker=path.join(outputDir,'.active.json');
  fs.writeFileSync(activeMarker,`${JSON.stringify({tool_id:TOOL_ID,pid:process.pid,started_at:new Date().toISOString()})}\n`);
  try {
  const repoRoot=path.resolve(options.repoRoot??path.join(import.meta.dirname,'../../..'));
  const runtimeRoot=path.join(repoRoot,'runtime',TOOL_ID);
  const upstream=path.resolve(options.upstream??path.join(runtimeRoot,'upstream','gods-eye-view'));
  const upstreamHead=run('git',['rev-parse','HEAD'],{cwd:upstream,encoding:'utf8'}).trim();
  if(upstreamHead!==UPSTREAM_COMMIT) throw new Error(`upstream commit mismatch: expected ${UPSTREAM_COMMIT}, got ${upstreamHead}`);
  const cesiumDir=path.join(upstream,'node_modules','cesium','Build','Cesium'); exists(path.join(cesiumDir,'Cesium.js'),'Cesium browser build');
  const server=await startViewerServer({viewerDir:path.join(import.meta.dirname,'..','viewer'),cesiumDir,proxyCacheDir:path.join(runtimeRoot,'tile-cache'),imageryUrl:spec.providers.imagery.url,terrainUrl:spec.providers.terrain.url});
  let browser; const mp4=path.join(outputDir,'scene.mp4'); let setup; let capture;
  const stderr=[]; const consoleMessages=[]; let peakRss=processPeakRssKb();
  try {
    browser=await launch(upstream,path.join(runtimeRoot,'browser-cache'));
    const page=await browser.newPage(); await page.setViewport({width:spec.output.width,height:spec.output.height,deviceScaleFactor:1});
    page.on('console',(message)=>consoleMessages.push(`${message.type()}: ${message.text()}`)); page.on('pageerror',(error)=>stderr.push(error.message));
    await page.goto(server.url,{waitUntil:'networkidle0',timeout:60000});
    const pageSpec=structuredClone(spec);
    if(pageSpec.providers.imagery.url)pageSpec.providers.imagery.url=server.imageryProxy;
    if(pageSpec.providers.terrain.url)pageSpec.providers.terrain.url=server.terrainProxy;
    try {
      setup=await page.evaluate((value)=>window.geoScene.setup(value),pageSpec);
    } catch(error) {
      throw new Error(`provider scene setup failed: ${error.message}`);
    }
    setup.launch_mode=browser.__graphicsMode;setup.browser_version=await browser.version();
    const point=await page.evaluate(()=>window.geoScene.projectDestination());
    if(!point||point.x<0||point.y<0||point.x>spec.output.width||point.y>spec.output.height) throw new Error('destination evidence point is not visible in final composition');
    for(const zone of spec.caption_safe_zones){const x=point.x/spec.output.width,y=point.y/spec.output.height;if(x>=zone.x&&x<=zone.x+zone.width&&y>=zone.y&&y<=zone.y+zone.height)throw new Error(`destination evidence collides with caption safe zone ${zone.id}`);}
    await page.evaluate(()=>window.geoScene.startRecord());
    await page.evaluate(()=>window.geoScene.animate());
    capture=await page.evaluate(()=>window.geoScene.stopRecord());
    if(!capture.bytes)throw new Error('browser recording canvas produced no encoded data');
    const expectedCaptureFrames=spec.output.fps*spec.output.duration_sec;
    if(capture.captured_frames<expectedCaptureFrames*.9)throw new Error(`browser captured only ${capture.captured_frames}/${expectedCaptureFrames} requested frames`);
    const cadenceLimit=Math.max(100,2500/spec.output.fps);
    const effectiveGap=capture.max_motion_gap_ms/spec.output.capture_slowdown;
    if(effectiveGap>cadenceLimit)throw new Error(`browser recording canvas missed smooth movement cadence (${effectiveGap.toFixed(1)} ms output-equivalent maximum gap; limit ${cadenceLimit.toFixed(1)} ms)`);
    const webm=path.join(outputDir,'capture.webm');fs.writeFileSync(webm,Buffer.from(capture.base64,'base64'));
    const outputFrames=Math.round(spec.output.fps*spec.output.duration_sec);
    run('ffmpeg',['-y','-loglevel','error','-i',webm,'-vf',`setpts=PTS/${spec.output.capture_slowdown},fps=${spec.output.fps},tpad=stop_mode=clone:stop_duration=0.2,scale=${spec.output.width}:${spec.output.height}:flags=lanczos`,'-frames:v',String(outputFrames),'-an','-c:v','libx264','-preset','medium','-crf',String(spec.output.crf),'-pix_fmt','yuv420p','-movflags','+faststart',mp4]);fs.rmSync(webm);
    peakRss=Math.max(peakRss,processPeakRssKb());
  } finally { if(browser)await browser.close(); await server.close(); }
  if(stderr.length) throw new Error(`browser errors: ${stderr.join('; ')}`);
  const properties=probeVideo(mp4); const checks=qualityChecks(mp4,properties,spec,capture.tile_samples);
  const preview=previews(mp4,outputDir,spec.output.duration_sec);
  const outputFiles=[mp4,...preview.files,preview.contact];
  const finished=performance.now(); const diskAfter=fs.statfsSync(outputDir).bavail*fs.statfsSync(outputDir).bsize;
  const manifest={schema_version:1,tool:{id:TOOL_ID,version:TOOL_VERSION,commit:gitCommit(repoRoot)},upstream:{repository:'https://github.com/bilawalsidhu/gods-eye-view',commit:UPSTREAM_COMMIT,version:'0.2.1',usage:'Pinned CesiumJS dependency, keyless terrain/provider patterns, and camera semantics; full dashboard and bundled datasets excluded.'},input:{spec_path:path.relative(repoRoot,specPath),spec_sha256:sha256File(specPath),effective_spec:spec},source_integrity:{live_remote_tiles:!spec.testing,byte_identical_reproduction:spec.testing,imagery_date:spec.providers.imagery_date,modern_context_only:true,tile_cache:server.stats()},render:{started_at:new Date(Date.now()-(finished-started)).toISOString(),finished_at:new Date().toISOString(),elapsed_sec:Number(((finished-started)/1000).toFixed(2)),peak_orchestrator_rss_kib:peakRss,graphics:{browser:setup,headless:true},capture:{compressed_stream_bytes:capture.bytes,captured_frames:capture.captured_frames,max_frame_gap_ms:capture.max_frame_gap_ms,max_motion_gap_ms:capture.max_motion_gap_ms,method:'WebGL frames copied into a browser-owned 2D canvas and recorded as a continuous compressed MediaStream; no screenshot or uncompressed frame sequence',uncompressed_frame_sequence:false},quality:checks,console_messages:consoleMessages.filter((line)=>!/favicon/.test(line)).slice(-20),disk_free_before:diskBefore,disk_free_after:diskAfter},output:{...properties,previews:preview.files.map((f,i)=>({filename:path.basename(f),at_sec:preview.moments[i],sha256:sha256File(f)})),contact_sheet:{filename:path.basename(preview.contact),sha256:sha256File(preview.contact)},files:Object.fromEntries(outputFiles.map((f)=>[path.basename(f),sha256File(f)]))}};
  writeJson(path.join(outputDir,'manifest.json'),manifest); return manifest;
  } finally {
    fs.rmSync(activeMarker,{force:true});
  }
}
