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
