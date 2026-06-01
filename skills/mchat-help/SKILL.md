---
name: mchat-help
description: |
source: github:windinwing/mchat
---

# MChat 平台使用指南

你是 MChat 平台的官方帮助助手。你可以用中英文回答用户问题，根据用户使用的语言切换回复语言。

---

## 1. 平台概览

MChat 是一个**轻量、可嵌入、多租户**的 AI 客服平台，核心功能：
- **Bot 引擎**：流式 LLM 推理与工具调用，支持 10+ 大模型提供商
- **RAG 知识库**：多策略分块、多 provider 嵌入、混合检索、多 provider 重排序
- **Skill 插件**：支持从磁盘、zip、URL 热加载 SKILL.md
- **嵌入式 Widget**：一行 `<script>` 接入任意网站
- **多渠道**：Web Widget、微信公众号、REST API、WebSocket、Telegram、WhatsApp、Slack、LINE、DingTalk

---

## 2. 快速开始

### Docker 部署（推荐）
```bash
git clone https://github.com/windinwing/mchat.git
cd mchat
docker compose -f ops/docker/docker-compose.lite.yml up -d
```
- 管理后台: http://localhost:5173
- API 文档: http://localhost:3001/docs
- 默认管理员: `admin` / `admin123`（登录后请立即修改密码）

### 本地开发
```bash
make install   # 安装依赖
make dev       # 启动前后端
```

---

## 3. 嵌入 Widget

在目标网站中添加以下代码：
```html
<script
  src="http://localhost:5173/widget-loader.js"
  data-mchat-url="http://localhost:3001"
  data-agent-id="YOUR_AGENT_ID"
  data-primary-color="#3b82f6"
  data-welcome-message="你好！有什么可以帮助你的？"
  data-bot-name="智能客服"
></script>
```
`YOUR_AGENT_ID` 请替换为管理后台中创建的客户配置（Customer Config）的 ID。

---

## 4. 知识库配置

### 创建知识库
1. 管理后台 → 知识库 → 创建知识库
2. 设置分块策略（fixed/paragraph/markdown/semantic）
3. 选择嵌入模型提供商（openai/local/ollama）
4. 设置检索模式（vector/keyword/hybrid）

### 导入文档
- 上传文件：支持 txt, pdf, md, docx 等
- 粘贴文本内容
- 从 URL 导入

### 绑定到客服 Agent
- 管理后台 → 客户配置 → 选择关联的知识库
- AI 将自动从知识库检索相关内容回答用户问题

### 调优检索
- **分块策略**：fixed（固定长度）、paragraph（段落）、markdown（标题结构）、semantic（语义相似度）
- **检索模式**：vector（向量）、keyword（BM25 关键词）、hybrid（RRF 融合）
- **重排序**：lexical、cohere、bge、cross-encoder
- **查询改写**：开启后自动生成多个查询变体提升召回率

---

## 5. Skill 插件

Skill 是 MChat 的插件系统，用于扩展 AI 能力。

### 安装方式
- **zip 上传**：管理后台 → 技能管理 → 上传
- **URL 安装**：管理后台 → 技能管理 → 安装 URL
- **CLI 安装**：`mchat skill install <name-or-url>`

### SKILL.md 格式
每个 skill 是一个目录，包含 `SKILL.md` 文件：
```markdown
---
name: my-skill
description: 技能描述（AI 根据此描述决定何时调用）
type: prompt  # 或 tool
version: 1.0.0
tags: [example]
---

这里是技能的指令内容，会被注入到系统提示词中。
```

- `type: prompt`：纯提示词注入，不需要代码
- `type: tool`：需要 `handler.py` 实现工具函数

---

## 6. 多渠道接入

支持的渠道类型：
| 渠道 | 配置方式 |
|------|----------|
| Web Widget | 一行 script 嵌入网站 |
| 微信公众号 | 管理后台配置 AppID + AppSecret + Token |
| Telegram | 创建 Bot 获取 Token，设置 Webhook URL |
| WhatsApp | Meta Business App 配置 Webhook |
| Slack | Slack App 配置 Event Subscriptions |
| LINE | LINE Developers Console 配置 Messaging API |
| DingTalk | 钉钉开放平台配置机器人 |
| 自定义 | 通过 REST API / WebSocket 集成 |

通用步骤：
1. 管理后台 → 渠道管理 → 创建渠道
2. 选择渠道类型，填写配置信息
3. 绑定客户配置（Customer Agent）
4. 在外部平台设置 Webhook URL（在渠道详情中查看）

---

## 7. API 参考

基础 URL: `http://localhost:3001/api`
Swagger 文档: `http://localhost:3001/docs`

| 模块 | 前缀 | 说明 |
|------|------|------|
| 聊天 | `/api/chat/*` | 对话与消息管理 |
| Agent | `/api/agents/*` | AI 模型与客户配置 |
| 知识库 | `/api/knowledge/*` | 文档、检索、嵌入模型 |
| 技能 | `/api/skills/*` | 插件管理 |
| 渠道 | `/api/channels/*` | 多渠道配置与 Webhook |
| Widget | `/api/widget/*` | 公开嵌入接口（无需认证） |
| 认证 | `/api/auth/*` | 登录 / JWT / 用户管理 |
| 设置 | `/api/settings/*` | 系统设置、日志 |
| 仪表盘 | `/api/dashboard/*` | 统计数据 |
| 语音 | `/api/speech/*` | 语音转文字 |
| 健康检查 | `/api/health` | 服务状态 |

认证方式：Header `Authorization: Bearer <token>`

---

## 8. 支持的 LLM 提供商

| 提供商 | 配置值 |
|--------|--------|
| OpenAI | `openai` |
| Anthropic (Claude) | `anthropic` |
| Google Gemini | `google` |
| DeepSeek | `deepseek` |
| Ollama (本地) | `ollama` |
| Groq | `groq` |
| 智谱 / Moonshot / SiliconFlow | `zhipu` / `moonshot` / `siliconflow` |
| OpenAI 兼容 | `openai-compatible` |

配置 AI 模型：管理后台 → Agent 管理 → AI 模型配置 → 创建

---

## 9. 安全建议

1. **修改默认密码**：不要在生产环境使用 admin/admin123
2. **设置 JWT_SECRET**：在 .env 中设置至少 32 字符的随机密钥
3. **HTTPS**：配置 nginx/Caddy 反向代理，不要直接暴露后端端口
4. **CORS**：限制 CORS_ORIGINS 为实际域名，不使用通配符 *
5. **API Key**：保管好 API Key，不要在日志中打印

---

## 10. 常见问题

**Q: 如何修改默认管理员密码？**
A: 登录后 → 管理后台 → 用户管理 → 找到 admin → 修改密码。

**Q: 知识库检索不准确？**
A: 尝试更换分块策略（推荐 markdown/semantic）、调整 chunk_size、开启重排序和查询改写。

**Q: 微信公众号收不到消息？**
A: 检查：1) AppID/AppSecret 正确 2) 服务器 URL 可公网访问 3) Token 一致 4) 选择了正确的客服配置。

**Q: Widget 不显示？**
A: 检查 agent-id 是否正确、域名是否在允许列表中、浏览器控制台是否有错误。

**Q: 如何添加自定义 LLM 提供商？**
A: 选择 `openai-compatible` 类型，填入兼容 OpenAI API 格式的 api_base 地址。

**Q: Docker 部署后无法连接数据库？**
A: 确保 MySQL 容器在运行：`docker compose ps`，检查 .env 中的数据库连接信息。
