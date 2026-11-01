const path=require('path');
const { chromium } = require('playwright-core');
(async()=>{
  const b=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
  const p=await b.newPage({viewport:{width:900,height:340},deviceScaleFactor:2});
  const html=`<body style="margin:0;background:#F6F0E5;display:flex;flex-direction:column;gap:6px;padding:18px">
  <div style="font-family:KaiTi,楷体,STKaiti;font-size:96px;color:#6E5435;line-height:1.05">盒 一 合</div>
  <div style="font-family:'SimHei',sans-serif;font-size:34px;color:#6E5435">对照黑体：盒 一 合</div>
  </body>`;
  await p.setContent(html,{waitUntil:'load'}); await p.waitForTimeout(300);
  await p.screenshot({path:'_fonttest.png'});
  console.log('ok', require('fs').statSync('_fonttest.png').size);
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
