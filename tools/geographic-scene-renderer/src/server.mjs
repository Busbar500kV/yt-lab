import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };

export async function startViewerServer({ viewerDir, cesiumDir, proxyCacheDir, imageryUrl, imageryTemplate, terrainUrl, cacheLimitBytes = 100 * 1024 * 1024 }) {
  const roots = { '/cesium/': cesiumDir, '/': viewerDir };
  fs.mkdirSync(proxyCacheDir,{recursive:true});
  let cacheBytes=fs.readdirSync(proxyCacheDir).reduce((sum,name)=>sum+fs.statSync(path.join(proxyCacheDir,name)).size,0);
  const contentTypes=new Map();const stats={requests:0,hits:0,remote_requests:0,remote_bytes:0,remote_failures:0,last_failed_url:null,cache_bytes_at_start:cacheBytes};
  async function proxy(request,response,prefix,base){
    stats.requests++;if(!base){response.writeHead(404).end('provider unavailable');return;}
    const incoming=new URL(request.url,'http://127.0.0.1');
    const suffix=incoming.pathname.slice(prefix.length);
    const target=new URL(suffix,base.endsWith('/')?base:`${base}/`);target.search=incoming.search;
    const key=crypto.createHash('sha256').update(target.href).digest('hex');const file=path.join(proxyCacheDir,key);
    if(fs.existsSync(file)){stats.hits++;response.setHeader('Content-Type',contentTypes.get(key)??'application/octet-stream');response.setHeader('Cache-Control','public,max-age=3600');response.writeHead(200).end(fs.readFileSync(file));return;}
    const upstream=await fetch(target,{headers:{'user-agent':'yt-lab geographic-scene-renderer/0.2.0'}});
    if(!upstream.ok){stats.remote_failures++;stats.last_failed_url=target;response.writeHead(upstream.status).end(`provider answered ${upstream.status}`);return;}
    const data=Buffer.from(await upstream.arrayBuffer());
    if(cacheBytes+data.length>cacheLimitBytes){response.writeHead(507).end('bounded tile cache limit reached');return;}
    fs.writeFileSync(file,data);cacheBytes+=data.length;stats.remote_requests++;stats.remote_bytes+=data.length;
    const type=upstream.headers.get('content-type')??'application/octet-stream';contentTypes.set(key,type);response.setHeader('Content-Type',type);response.setHeader('Cache-Control','public,max-age=3600');response.writeHead(200).end(data);
  }
  async function proxyTemplate(request,response){
    const match=/^\/proxy\/imagery-template\/(\d+)\/(\d+)\/(\d+)\.jpeg$/.exec(new URL(request.url,'http://127.0.0.1').pathname);
    if(!match||!imageryTemplate){response.writeHead(404).end('template imagery unavailable');return;}
    const [,z,y,x]=match;const target=imageryTemplate.replace('{z}',z).replace('{y}',y).replace('{x}',x);
    const key=crypto.createHash('sha256').update(target).digest('hex');const file=path.join(proxyCacheDir,key);stats.requests++;
    if(fs.existsSync(file)){stats.hits++;response.setHeader('Content-Type','image/jpeg');response.setHeader('Cache-Control','public,max-age=3600');response.writeHead(200).end(fs.readFileSync(file));return;}
    const upstream=await fetch(target,{headers:{'user-agent':'yt-lab geographic-scene-renderer/0.2.0'}});
    if(!upstream.ok){stats.remote_failures++;stats.last_failed_url=target;response.writeHead(upstream.status).end(`provider answered ${upstream.status}`);return;}
    const data=Buffer.from(await upstream.arrayBuffer());
    if(cacheBytes+data.length>cacheLimitBytes){response.writeHead(507).end('bounded tile cache limit reached');return;}
    fs.writeFileSync(file,data);cacheBytes+=data.length;stats.remote_requests++;stats.remote_bytes+=data.length;
    response.setHeader('Content-Type',upstream.headers.get('content-type')??'image/jpeg');response.setHeader('Cache-Control','public,max-age=3600');response.writeHead(200).end(data);
  }
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if(url.pathname.startsWith('/proxy/imagery-template/')){proxyTemplate(request,response).catch((error)=>response.writeHead(502).end(error.message));return;}
    if(url.pathname.startsWith('/proxy/imagery/')){proxy(request,response,'/proxy/imagery/',imageryUrl).catch((error)=>response.writeHead(502).end(error.message));return;}
    if(url.pathname.startsWith('/proxy/terrain/')){proxy(request,response,'/proxy/terrain/',terrainUrl).catch((error)=>response.writeHead(502).end(error.message));return;}
    const prefix = url.pathname.startsWith('/cesium/') ? '/cesium/' : '/';
    const relative = prefix === '/' && url.pathname === '/' ? 'index.html' : url.pathname.slice(prefix.length);
    const root = path.resolve(roots[prefix]);
    const file = path.resolve(root, relative);
    if (file !== root && !file.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end('forbidden'); return; }
    fs.readFile(file, (error, data) => {
      if (error) { response.writeHead(404).end('not found'); return; }
      response.setHeader('Content-Type', MIME[path.extname(file)] ?? 'application/octet-stream');
      response.setHeader('Cache-Control', 'no-store');
      response.writeHead(200).end(data);
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  const url=`http://127.0.0.1:${address.port}/`;
  return { url, imageryProxy:`${url}proxy/imagery/`, imageryTemplateProxy:`${url}proxy/imagery-template/{z}/{y}/{x}.jpeg`, terrainProxy:`${url}proxy/terrain/`, stats:()=>({...stats,cache_bytes_final:cacheBytes}), close: () => new Promise((resolve) => server.close(resolve)) };
}
