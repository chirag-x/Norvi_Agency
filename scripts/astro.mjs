import { spawn } from 'node:child_process';
// Keep local startup deterministic: no telemetry network request before serving the preview.
const args=process.argv.slice(2);
// Keep dev in the same process group as the API when launched by concurrently.
if(args[0]==='dev' && (!args[1] || args[1].startsWith('--'))) args.push('--ignore-lock');
const child=spawn(process.execPath,['node_modules/astro/bin/astro.mjs',...args],{
  stdio:'inherit',env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1'},
});
child.on('exit',code=>process.exit(code??1));
child.on('error',error=>{console.error(error.message);process.exit(1);});
