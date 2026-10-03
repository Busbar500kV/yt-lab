#!/usr/bin/env node
import path from 'node:path';
import { render } from './render.mjs';
import { loadSpec, providerCatalogue } from './spec.mjs';

async function main() {
  const [command,...args]=process.argv.slice(2);
  if(command==='validate'&&args.length===1){const {spec}=loadSpec(args[0]);console.log(JSON.stringify(spec,null,2));return;}
  if(command==='providers'){console.log(JSON.stringify(providerCatalogue(),null,2));return;}
  if(command==='render'&&args.length===2){const result=await render(args[0],args[1]);console.log(JSON.stringify({output:path.resolve(args[1]),manifest:result.output},null,2));return;}
  throw new Error('usage: geographic-scene-renderer validate SPEC | providers | render SPEC OUTPUT_DIR');
}
main().catch((error)=>{console.error(`geographic-scene-renderer: ${error.message}`);process.exitCode=1;});
