---
name: mchat-ops
description: 服务端运维巡检（健康检查、日志、Milvus、只读 K8s）。仅管理员且在系统设置中启用后可用。
source: github:windinwing/mchat
---

# MChat 服务端运维

在**管理后台对话**（非 Widget/门户通道）中，由管理员启用的运维工具。

## 子命令

- `health` — 进程内 DB / Milvus / Redis 状态（避免单 worker 自调 HTTP 死锁）
- `logs` — 尾部日志（`source`: app | error，`lines`: 默认 80）
- `milvus` — Milvus 运行时配置与连接状态
- `k8s` — 只读 `kubectl get`（需服务器安装 kubectl 且配置 kubeconfig）
- `redis` — Ping Redis（`REDIS_URL`）
- `disk` — 磁盘用量摘要
- `services` — systemd 服务状态（先 system 再 `--user`）
- `db` — MySQL `SELECT 1` 连通探测
- `run` — 执行**系统设置**里配置的 Shell 白名单（参数 `shell_id`）

白名单在管理后台 **系统设置 → 安全 → 运维 Shell 白名单**，每行：`命令id | 完整命令`（禁止 `;`、`|`、`&&` 等）。

## 安全

禁止删除/应用资源；门户与 Widget 通道不会加载本技能。
