import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

export function sha256File(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

export function gitCommit(repoRoot) {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(); }
  catch { return 'uncommitted'; }
}

export function probeVideo(file) {
  const data = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries',
    'stream=codec_name,width,height,pix_fmt,r_frame_rate,nb_read_frames:format=duration,size',
    '-of', 'json', file,
  ], { encoding: 'utf8' }));
  const stream = data.streams[0];
  return {
    codec: stream.codec_name,
    width: Number(stream.width),
    height: Number(stream.height),
    pixel_format: stream.pix_fmt,
    frame_rate: stream.r_frame_rate,
    frame_count: Number(stream.nb_read_frames),
    duration_sec: Number(data.format.duration),
    bytes: Number(data.format.size),
    fast_start: atomOffset(file, 'moov') < atomOffset(file, 'mdat'),
  };
}

function atomOffset(file, atom) {
  return fs.readFileSync(file).indexOf(Buffer.from(atom));
}

export function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
