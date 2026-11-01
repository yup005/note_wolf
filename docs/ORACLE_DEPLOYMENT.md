# Oracle 发布与数据维护

2026-11-01 Owner 授权免费 E2 部署与后续修复发布。源码及已验证结果见 [阶段验证](TEST_REPORT.md) 当前条目。Render 服务保持原状，未迁移其历史账户或数据库。

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
