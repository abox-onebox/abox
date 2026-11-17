# ABox 一盒 ·「后台 AI 接执行」部署执行卡 v1

> 口径：2026-11-17 祝总纠正「还没正式运作、不存在截单」⇒ 取消 24:00 时间窗口，随时可投。祝总红线：**小程序用户侧零感知、零报错、零数据变化**。
> 范围：一次投递同时上 G/M/H/N/P（本地 6 commit），只动 api + admin；h5 容器不重启、小程序端不碰。
> 本卡已执行：2026-11-17 22:36 投递成功（tag `manual-20261117223132`，回滚目标 `manual-20261111-194112`）。失败时 `./scripts/rollback.sh`。

## 0. 为什么这个窗口可行（回源结论）

- `deploy.sh` 第 4 步只 `build api admin`，**h5（8081，小程序 API 反代所在）不重建不重启** ⇒ 小程序静态包、登录、下单链路全程无感。
- 唯一不可避免的窗口 = api 容器 `--force-recreate` 的秒级重启；真正的风险是**新 api 启动崩**（历史 `ac81aae` DI 漏登记整站不可用，tsc/单测抓不到）⇒ 守护闸 = 本地 `nest build` + `node dist/main.js` 真实启动自检，过了才投。

## 1. 阶段一 · 静态闸（现在就能跑，不碰服务器）

| 序 | 命令（在 `abox-onebox/` 下） | 通过判据 |
|---|---|---|
| 1 | `node scripts/gate.mjs all` | 35/35 全绿 |
| 2 | `node scripts/check-di-forfeature.mjs` | `OK —— 未发现注入了但没登记的仓储` |
| 3 | `node node_modules/typescript/bin/tsc -p apps/api-server/tsconfig.json --noEmit` | exit 0（防 HEAD 引用未跟踪文件打包炸） |
| 4 | op 目录解码核对 13 条新端点 roles（generate/preview=3 角色可读 / confirm=2 角色） | 全 OK、总数 159（实测） |
| 5 | `git status --short \| grep -v '^??'` | 空（历史 `??` 文件一律不 add） |

## 2. 阶段二 · 真实启动自检（红线守护闸，投前必过）

```
# 沙箱会拦 nest 清 dist（>50 文件），先移走旧产物
mv apps/api-server/dist /tmp/abox-dist-pre-$(date +%s)
cd apps/api-server && ../../node_modules/.bin/nest build && node dist/main.js
```
- 判据：日志出现 **全部模块初始化 + Nest application successfully started**，进程不崩不退出；Ctrl-C 收尾。
- 崩在这里（如 DI 缺登记）⇒ **停止投递**，修完重跑阶段一+二。
- ✅ **已于 2026-11-17 22:29 用当前 HEAD 重跑通过**（20:04 旧记录早于 4 个新提交、已过期，禁止引用）：本地 `.env` 为 `DB_DRIVER=sqlite` + `PROVIDER_MODE=mock` + `QUEUE_DRIVER=memory`（连本地 dev sqlite，零生产影响）；`nest build` exit 0、`node dist/main.js` 真实启动 → `Nest application successfully started`、`Mapped` 路由 **226** 条、错误 **0**、定时任务 9/9；**13 条新端点全部真实映射**（G/M/H/N/P 各 generate+confirm=10 + ai-report 的 generate/preflight/weekly-digest=3）。服务已停、3000 端口已释放。
- ⚠️ 启动日志里 `WecomCryptoService 自检跳过（凭据未配置，属预期）` 是本地 mock 预期告警，非缺陷。

## 3. 阶段三 · 双备份（服务器上，动代码前）

```
cd /opt/abox-onebox
./scripts/backup-db.sh --out /opt/abox-onebox/backups        # 必须绝对路径
tar czf backups/code-pre-<shortsha>-<ts>.tgz apps packages scripts docker-compose*.yml package.json pnpm-workspace.yaml
```
- 记下 DB 备份文件名与恢复命令（脚本会打印）。

## 4. 阶段四 · 投递 + dry-run（不动服务）

```
# 本机
cd <repo>/abox-onebox
git archive --format=tar.gz -o _tmp/abox-deploy-<sha>.tgz HEAD
scp _tmp/abox-deploy-<sha>.tgz abox-srv:/tmp/

# 服务器（root，不用 sudo）
mkdir -p /tmp/abox-stage && tar xzf /tmp/abox-deploy-<sha>.tgz -C /tmp/abox-stage
cp -a /tmp/abox-stage/. /opt/abox-onebox/          # 覆盖，不删宿主机独有脚本
cd /opt/abox-onebox
./scripts/deploy.sh --tag manual-<YYYYMMDDHHMMSS> --dry-run   # 看 PREV_TAG 回滚目标
```

## 5. 阶段五 · 报备 → 真部署

- 向祝总报备：窗口已到、静态闸+启动自检+双备份+dry-run 全过、`PREV_TAG` 是什么 ⇒ **等确认**。
- 真跑（长构建别挂前台 SSH，避免 SIGTERM 误判）：
```
nohup ./scripts/deploy.sh --tag manual-<YYYYMMDDHHMMSS> > /tmp/deploy-<ts>.log 2>&1 &
```
- 轮询日志 + `.deploy-state`（`TAG`/`DEPLOYED_AT`）+ `docker ps` Healthy；**别用 SSH 断连判失败**（历史实测断连其实已跑完）。
- `.env.prod` 若钉 `TAG=latest`：脚本会 warn 并**额外补打 manual tag** 供回滚（第 163-165 行已内建防护），确认 warn 出现即可，不慌。

## 6. 阶段六 · 部署后三段验证（T1–T3）

| 段 | 检查 | 判据 |
|---|---|---|
| T1 健康 | `docker ps` + `GET /api/v1/health/ready`（8080/8081） | 容器 Healthy、ready |
| T2 小程序零感 | 8081 反代下单/登录链路无 5xx；h5 容器**未重建**（`docker ps` CreatedSince 仍是旧的） | 零报错 |
| T3 新端点已上线 | 无 token `POST /api/v1/admin/{recruit-taskcard,coupon-taskcard,leader-taskcard,community-taskcard}/generate` 与 `/admin/recall-campaign/preview` | **401+10002**（路由存在；对比不存在的路由返回 200+10004）⇒ 10 条端点全在 |

- 全部只读，不写库、不发券、不发消息。

## 7. 阶段七 · 失败回滚

```
cd /opt/abox-onebox && ./scripts/rollback.sh          # 回 .deploy-state 的 PREV_TAG
```
- 若 `.deploy-state` 无 PREV_TAG 或目标与当前相同 ⇒ 显式 `./scripts/rollback.sh --tag <旧TAG>`（旧 TAG 从阶段三之前 `.deploy-state` 记录取）。
- 回滚后重跑 T1–T3 确认恢复。

## 8. 本轮明确不做

- 不建定时自动部署（祝总反对自动任务）。
- 不单独 build h5（本批无 h5 改动）。
- 不跑 seed（生产库不 seed）。
- 不在生产触发任何 confirm（generate/preview 只读探测即可证端点上线）。
