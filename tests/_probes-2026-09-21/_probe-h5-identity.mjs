#!/usr/bin/env node
/**
 * `_probe-h5-identity.mjs` —— H5「`?devCode=` 换人」核验（**接口层替代 + 产物级核验**）
 *
 * ## 为什么不是「真浏览器」
 * 本机**没有**装任何 headless 浏览器（`playwright` / `puppeteer` 均 `missing`，
 * `ms-playwright` 缓存为空）⇒ 无法真实渲染页面点按。team-lead 已授权：
 * 「若浏览器自动化不可用，就退回**接口层等价验证**并**注明是接口层替代、非真页面验证**」。
 *
 * ## 本探针做三件事（合起来覆盖换人的两端）
 *   ① **接口层**：`?devCode=1001` / `?devCode=1002` 落到服务端就是
 *      `code=dev:1001` / `dev:1002` 两次登录 —— 分别取到**不同 user**，
 *      且各自 token 打 `/auth/me` 只回自己的资料（**不串号**、停职/无楼栋如实为空）。
 *      这正是 `pages/mine/mine.vue` 的数据源（注释指明 A2 `GET /auth/me`）。
 *   ② **产物级**：起一个**只绑 127.0.0.1** 的静态服务托管既有 `dist-h5`，
 *      证明 `?devCode=1002` 真的能取到应用外壳、且**被服务的 bundle 里含**
 *      `devCode` 解析 + `abox_dev_identity` 键 + `clearAuthStorage` 分支
 *      （即「换人会清旧登录态」那段代码确实随产物发布）。
 *   ③ **同源代理**：经静态服务 `:5280/api/v1/health` 打通，验证「页面→同源代理→后端」这一段。
 *
 * ## 明确没覆盖（如实登记）
 *   · 真浏览器里「切到 mine 页当面看到昵称变了」——**未验**（无浏览器）。
 *   · `localStorage` 里 `abox_token` 是否真被 `clearAuthStorage()` 抹掉 ——
 *     属端上 `localStorage` 行为，需浏览器；此处只证明该调用在 bundle 内存在。
 *
 * ## 运行
 *   node scripts/_probe-h5-identity.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BASE,
  PORT,
  assertPortFree,
  installCleanupHooks,
  makeCall,
  sleep,
  startApiServer,
  stopApiServer,
  waitHealthy,
  ROOT,
} from './lib/e2e-server.mjs';
import { startStaticApp } from './lib/local-server.mjs';

const H5_DIST = join(ROOT, 'apps', 'miniprogram', 'dist-h5');
const H5_PORT = 5280;
const H5_URL = `http://127.0.0.1:${H5_PORT}`;

const assertions = [];
const rec = (id, title, verdict, actual, evidence) => {
  assertions.push({ id, title, verdict, actual, evidence });
  console.log(`[${verdict}] ${id} ${title}\n        actual: ${actual}`);
};

const IDENTITIES = [
  { code: 'dev:1001', label: '李明（在职团长 · 楼栋1）' },
  { code: 'dev:1002', label: '王芳（在职团长 · 楼栋4）' },
  { code: 'dev:newbie', label: '全新用户（无楼栋 / 非团长）' },
];

async function main() {
  installCleanupHooks();
  await assertPortFree(PORT);
  const child = startApiServer(PORT);
  const call = makeCall(BASE);

  let staticApp = null;
  try {
    if (!(await waitHealthy(BASE, { child, timeoutMs: 90_000 }))) {
      throw new Error('API 未就绪（90s 超时）');
    }

    // ---------------------------------------------------------- ① 接口层换人
    const sessions = [];
    for (const id of IDENTITIES) {
      const lg = await call('POST', '/auth/login', { body: { code: id.code } });
      const token = lg.body?.data?.token ?? null;
      const me = token ? await call('GET', '/auth/me', { token }) : null;
      sessions.push({
        code: id.code,
        label: id.label,
        loginCode: lg.body?.code,
        userId: lg.body?.data?.user?.id ?? null,
        isLeaderLogin: lg.body?.data?.isLeader ?? null,
        meCode: me?.body?.code ?? null,
        me: me?.body?.data ?? null,
      });
      console.log(
        `[login] ${id.code} → userId=${lg.body?.data?.user?.id} isLeader=${lg.body?.data?.isLeader} ` +
          `me.nickname=${me?.body?.data?.nickname} me.leaderName=${me?.body?.data?.leaderName} ` +
          `me.buildingName=${me?.body?.data?.buildingName} me.isLeader=${me?.body?.data?.isLeader}`,
      );
    }

    const [a, b, c] = sessions;
    rec(
      'H5-1',
      '两次不同 devCode 登录落到不同 user（1001 ≠ 1002 ≠ newbie）',
      a.userId && b.userId && c.userId && new Set([a.userId, b.userId, c.userId]).size === 3
        ? 'PASS'
        : 'FAIL',
      `ids=${sessions.map((s) => `${s.code}:${s.userId}`).join(' , ')}`,
      JSON.stringify(sessions.map((s) => ({ code: s.code, userId: s.userId }))),
    );

    // 「我的」页数据源是各 token 自己的 /auth/me —— 二者必须互不串号
    const meA = a.me ?? {};
    const meB = b.me ?? {};
    const noBleed =
      Number(meA.id) === Number(a.userId) &&
      Number(meB.id) === Number(b.userId) &&
      meA.buildingId !== meB.buildingId;
    rec(
      'H5-2',
      '各自 token 的 /auth/me 只回自己（id 归属正确、楼栋不同）',
      noBleed ? 'PASS' : 'FAIL',
      `meA(id=${meA.id},building=${meA.buildingId},leader=${meA.leaderName}) vs meB(id=${meB.id},building=${meB.buildingId},leader=${meB.leaderName})`,
      JSON.stringify({ A: meA, B: meB }),
    );

    // 全新用户：非团长、无楼栋 —— 换人后不该残留上一个团长的身份
    const meC = c.me ?? {};
    rec(
      'H5-3',
      '换到全新用户：isLeader=false / leaderName=null / buildingName=null（无残留）',
      meC.isLeader === false && !meC.leaderName && !meC.buildingName ? 'PASS' : 'FAIL',
      `meC.isLeader=${meC.isLeader} leaderName=${meC.leaderName} buildingName=${meC.buildingName} (userId=${c.userId})`,
      JSON.stringify(meC),
    );

    // 伪造 / 缺失 token 一律 401 —— 身份完全由 token 决定，服务端不做任何兜底识别
    const bogus = await call('GET', '/auth/me', { token: 'garbage.token.value' });
    const noTok = await call('GET', '/auth/me', {});
    rec(
      'H5-4',
      '伪造 / 缺失 token 访问 /auth/me 一律被拒（401）—— 身份只认 token',
      bogus.status === 401 && noTok.status === 401 ? 'PASS' : 'FAIL',
      `bogus status=${bogus.status} code=${bogus.body?.code} ; no-token status=${noTok.status} code=${noTok.body?.code}`,
      JSON.stringify({ bogus: bogus.body, noTok: noTok.body }),
    );

    // ---------------------------------------------------------- ② 产物级核验
    staticApp = await startStaticApp({
      root: H5_DIST,
      port: H5_PORT,
      host: '127.0.0.1', // ⚠️ 显式只绑回环（沙箱对 0.0.0.0 更严）
      proxyTarget: `http://127.0.0.1:${PORT}`,
      spa: false,
      label: 'h5-probe',
    });

    const idx = await fetch(`${H5_URL}/?devCode=1002`);
    const idxHtml = await idx.text();
    rec(
      'H5-5',
      '`?devCode=1002` 能取到应用外壳（index.html 200）',
      idx.status === 200 && idxHtml.includes('id="app"') ? 'PASS' : 'FAIL',
      `GET /?devCode=1002 → status=${idx.status} hasAppDiv=${idxHtml.includes('id="app"')}`,
      idxHtml.slice(0, 300),
    );

    const m = /src="([^"]+index-[^"]+\.js)"/.exec(idxHtml);
    const bundlePath = m ? m[1] : '/assets/index-BsTPm6vR.js';
    const js = await fetch(`${H5_URL}${bundlePath}`);
    const jsText = await js.text();
    const hasDevCode = /devCode/.test(jsText);
    const hasIdentityKey = jsText.includes('abox_dev_identity');
    const hasClearFn = /clearAuthStorage|abox_token/.test(jsText);
    rec(
      'H5-6',
      '被服务的前端 bundle 含「换人」机制（devCode 解析 / abox_dev_identity / 清态）',
      hasDevCode && hasIdentityKey && hasClearFn ? 'PASS' : 'FAIL',
      `bundle=${bundlePath} size=${jsText.length} devCode=${hasDevCode} abox_dev_identity=${hasIdentityKey} clearState=${hasClearFn}`,
      null,
    );

    // 换人后清态那段逻辑（App.vue onLaunch）在 bundle 中的证据片段
    const m2 = /.{60}devCode=\(\[\^&#\]\+\)[\s\S]{0,220}/.exec(jsText);
    rec(
      'H5-7',
      'bundle 内含 App.vue onLaunch 的 devCode 读取 + 清态分支（取证片段）',
      m2 ? 'PASS' : 'NOTE',
      m2 ? 'found' : 'not found (minify 变体)',
      m2 ? m2[0].replace(/\s+/g, ' ').slice(0, 320) : null,
    );

    // ---------------------------------------------------------- ③ 同源代理
    const viaProxy = await fetch(`${H5_URL}/api/v1/health`);
    const proxyJson = await viaProxy.json().catch(() => null);
    rec(
      'H5-8',
      '页面同源代理 `:5280/api/v1/*` 打通后端',
      viaProxy.status === 200 && proxyJson?.code === 0 ? 'PASS' : 'FAIL',
      `GET :${H5_PORT}/api/v1/health → status=${viaProxy.status} code=${proxyJson?.code}`,
      JSON.stringify(proxyJson),
    );

    // 顺带：把「换人后 /auth/me」这条真的经过代理走一遍（页面实际走的路）
    const lgProxy = await fetch(`${H5_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'dev:1002' }),
    });
    const lgProxyJson = await lgProxy.json().catch(() => null);
    rec(
      'H5-9',
      '经代理的 `dev:1002` 登录成功（页面真实请求路径）',
      lgProxyJson?.code === 0 && lgProxyJson?.data?.user?.id === b.userId ? 'PASS' : 'FAIL',
      `via proxy login code=${lgProxyJson?.code} userId=${lgProxyJson?.data?.user?.id}（应=${b.userId}）`,
      JSON.stringify({ code: lgProxyJson?.code, userId: lgProxyJson?.data?.user?.id }),
    );

    // 附：bundle 存在的本地事实（供报告核对）
    const bundleStat = readFileSync(join(H5_DIST, 'index.html'), 'utf8').length;
    assertions.push({
      id: 'INFO',
      title: 'dist-h5/index.html 可读',
      verdict: 'INFO',
      actual: `index.html size=${bundleStat}`,
      evidence: null,
    });
  } catch (err) {
    console.error('!! 探针异常：', err?.stack ?? err);
    assertions.push({
      id: 'ERR',
      title: '探针异常',
      verdict: 'FAIL',
      actual: String(err?.message ?? err),
      evidence: null,
    });
  } finally {
    if (staticApp) {
      try {
        await staticApp.close();
      } catch {
        /* ignore */
      }
    }
    await stopApiServer(child, PORT);
    await sleep(200);

    const counts = assertions.reduce((m, a) => ((m[a.verdict] = (m[a.verdict] ?? 0) + 1), m), {});
    console.log('\n== 断言汇总 ==\n' + JSON.stringify(counts));
    console.log('===JSON===');
    console.log(JSON.stringify({ assertions, counts }, null, 1));
    console.log('===ENDJSON===');
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
