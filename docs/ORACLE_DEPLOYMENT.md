# Oracle 发布与数据维护

2026-11-01 Owner 授权免费 E2 部署与后续修复发布。源码及已验证结果见 [阶段验证](TEST_REPORT.md) 当前条目。Render 服务保持原状，未迁移其历史账户或数据库。

<a id="pr13-2026-11-01"></a>

## 当前发布：教学提示与手机候场（2026-11-01）

Owner在本次本地对话明确授权合并[PR #13](https://github.com/yup005/note_wolf/pull/13)并发布到现有Oracle。正常合并后的运行源码为[8765da006f6e79565aa9921bdad7b5c8e6d2b37c](https://github.com/yup005/note_wolf/commit/8765da006f6e79565aa9921bdad7b5c8e6d2b37c)，文件树与已验证的`ac6b1b00a0ee59f90c9ab1fedf4d5a09d8ec519d`完全一致。服务于2026-11-01 **11:54:48 PST / 19:54:48 UTC**进入active；已核对RELEASE_SHA、status/storage均ok、NRestarts=0及每日备份定时器enabled。[线上入口](https://note-wolf.192-18-134-130.sslip.io/)。

本次新鲜验证：本地`npm test` **690 pass /0 fail /0 skip（35.36秒）**、`npm run typecheck`和`npm run build`通过；教学/引导/首夜/重开手机专项**12/12（27.0秒）**，生产PWA**7/7（10.4秒）**。Oracle按锁文件安装，完整单元**690/690（346.32秒）**及含类型检查的生产构建通过；主资源`index-eH_hWhFF.js`与本地构建一致（560.26KB/gzip171.72KB），保留既有Zod注释及500KB提示。开发阶段完整160/160为同一文件树的既有证据，本次未重复整套开发E2E。

发布流程在构建结束、备份/切换前追加本次临时只读检查，非候场房数为0后才继续；未安装永久对局中发布保护。发布前一致性备份成功，快照724992字节、schemaVersion14、权限0600；数据仍在`/var/lib/note_wolf/lobby.db`，没有还原或迁移线上库。公网手机检查**3/3（3.9秒）**：教学收起/回看、存储受限、单人候场和320/390/430宽度、刷新保留座位；320px合成截图已查看。发布前创建的同一合成房和两个游客座位在发布重启后均保留，两个独立HTTPS会话及各自WebSocket订阅/断线重连通过。

本地首次沙箱单元594通过/96失败，均为监听EPERM，浏览器服务也因EPERM未启动；取得环境权限后按原测试完整复跑通过，未修改断言。Render、管理员凭据及生产测试开关均未改动。部署流程未额外修改产品代码或数据库结构；收尾只补发布记录，不再部署文档提交。真实iPhone Safari/声音/VoiceOver、后台弱网和现场多人仍未验收；备份仍在同机，异地数据库备份待配置。

## 更新

通过已有 SSH 密钥登录目标服务器，在没有正式对局时运行：

```sh
sudo note-wolf-deploy main
```

GitHub push 不会自动部署。也可传入 main 中已存在的完整 40 位 SHA。已安装的脚本拉取公开仓库、固定提交、安装依赖、测试和构建、创建一致性备份，再原子切换代码目录并重启服务。E2 免费实例较慢，须等待 `Deployed <SHA>`。重启/健康检查失败会尝试恢复上一版代码，不自动回退数据库；涉及数据库迁移时需先核对代码兼容性。

```sh
sudo systemctl is-active note_wolf
sudo cat /opt/note_wolf/current/RELEASE_SHA
curl -fsS http://127.0.0.1:3000/api/health
sudo systemctl list-timers note_wolf-backup.timer
```

健康响应必须同时为 status=ok、storage=ok。之后使用合成测试房验证刷新、重连和座位恢复，真实设备另验。

## 持久化与备份

SQLite 使用 `/var/lib/note_wolf/lobby.db`，与 `/opt/note_wolf/releases/` 分离。更新仅切换 `/opt/note_wolf/current`，不得删除数据目录。数据库目录 0700、文件 0600，应用使用独立系统用户。

每次更新前备份至 `/var/backups/note_wolf/`；每日备份定时器使用 America/Los_Angeles 的 04:00，随机延迟最多 10 分钟，支持错过后补跑。每日一致性快照附 SHA-256 元数据。手动追加备份：

```sh
sudo systemctl start note_wolf-backup.service
sudo journalctl -u note_wolf-backup.service -n 10 --no-pager
```

本次已用数据库 CLI 将备份还原至隔离目录并检查完整性与合成房间座位，未覆盖在线库。本机快照无法覆盖整机或磁盘删除风险，尚未配置异地数据库备份；SSH 密钥备份不等于数据库备份。日志、快照及密钥不得提交到仓库。
