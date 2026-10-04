import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { render } from '../src/render.mjs';

const repoRoot=path.resolve(import.meta.dirname,'../../..');
const fixture=path.join(import.meta.dirname,'fixtures','valid-spec.json');

test('end-to-end fixture renders H.264/yuv420p fast-start output', {timeout:120000}, async () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'geo-render-'));
  try {
    const result=await render(fixture,path.join(root,'out'),{repoRoot});
    assert.equal(result.output.codec,'h264');
    assert.equal(result.output.pixel_format,'yuv420p');
    assert.equal(result.output.width,640);assert.equal(result.output.height,360);
    assert.equal(result.output.fast_start,true);
    assert.ok(Math.abs(result.output.duration_sec-3)<.15);
    assert.ok(Math.abs(result.output.frame_count-45)<=2);
    assert.equal(result.render.quality.black_frame_scan,'passed');
    assert.ok(fs.existsSync(path.join(root,'out','contact-sheet.jpg')));
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('location transition renders and records both verified endpoint labels', {timeout:120000}, async () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'geo-transition-render-'));
  const raw=JSON.parse(fs.readFileSync(fixture,'utf8'));
  raw.mode='location-to-location';raw.editorial.anchor.intended_placement='meaningful-location-change';
  raw.geography.locations.push({
    id:'start',display_label:'Start Place',place_name:'Start Place',country:'Test Fixture',administrative_region:'Synthetic Grid',feature_type:'synthetic point',
    full_description:'A fixed synthetic starting point for endpoint-label render testing.',lat:45.5,lon:-121.5,
    extent:{west:-121.7,south:45.3,east:-121.3,north:45.7},
    sources:[{title:'Tool fixture',url:'https://example.invalid/start',role:'deterministic coordinate fixture'}],
    verification:{status:'verified',verified_on:'2026-10-04',method:'Fixed test value.',ambiguity_status:'not-ambiguous',ambiguity_note:'Synthetic fixture has one identity.'},
  });
  raw.geography.start_location_id='start';
  raw.camera.keyframes=[
    {at_sec:0,view:{lat:45.5,lon:-121.5,range_m:100000,heading_deg:0,pitch_deg:-60}},
    {at_sec:.75,view:{lat:45.8,lon:-121.8,range_m:700000,heading_deg:0,pitch_deg:-75}},
    {at_sec:1.5,view:{lat:46.2,lon:-122.18,range_m:500000,heading_deg:5,pitch_deg:-65}},
  ];
  raw.start_label={text:'Start Place',reveal_at_sec:0,fade_in_sec:0,hide_at_sec:.85,fade_out_sec:.15,color:'#72d6ff'};
  const spec=path.join(root,'transition.json');fs.writeFileSync(spec,`${JSON.stringify(raw,null,2)}\n`);
  try {
    const result=await render(spec,path.join(root,'out'),{repoRoot});
    assert.equal(result.narrative_placement.start_label,'Start Place');
    assert.equal(result.narrative_placement.start_label_clear_at_sec,1);
    assert.equal(result.narrative_placement.destination_label,'Fixture Point');
    assert.ok(fs.existsSync(path.join(root,'out','scene.mp4')));
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('failed provider request rejects without leaving an active marker', {timeout:120000}, async () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'geo-provider-failure-'));
  const raw=JSON.parse(fs.readFileSync(fixture,'utf8'));
  raw.providers.imagery='failed-test';
  const spec=path.join(root,'failed.json');
  fs.writeFileSync(spec,`${JSON.stringify(raw,null,2)}\n`);
  const output=path.join(root,'out');
  try {
    await assert.rejects(render(spec,output,{repoRoot}),/provider|tiles|ready|502|failed/i);
    assert.equal(fs.existsSync(path.join(output,'.active.json')),false);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
