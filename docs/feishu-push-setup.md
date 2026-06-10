# 飞书每日简报推送接入

本项目已内置 Cloudflare Worker：`workers/feishu-brief-push`。它会每天访问公网简报页面，截图成 PNG，并通过飞书自建应用机器人发到群里。

## 前置条件

1. 简报必须先发布到公网，例如 GitHub Pages。
2. 飞书开放平台创建自建应用，开启应用机器人，并把机器人加入目标群。
3. Cloudflare 账号可部署 Worker，并可使用 Browser Rendering API。

## 飞书应用配置

在飞书开放平台准备：

- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_CHAT_ID`

应用权限至少开通并发布：

- `im:message`
- `im:resource`

如果需要读取群信息，再加：

- `im:chat:read`
- `im:chat.members:read`

## Cloudflare 配置

进入 Worker 目录：

```bash
cd workers/feishu-brief-push
npm install
```

创建 KV：

```bash
npx wrangler kv namespace create BRIEF_PUSH_STATE
```

把返回的 `id` 写入 `wrangler.jsonc`：

```jsonc
"kv_namespaces": [
  {
    "binding": "BRIEF_PUSH_STATE",
    "id": "你的 KV namespace id"
  }
]
```

同时把 `wrangler.jsonc` 里的 `SITE_BASE_URL` 改成你的 GitHub Pages 地址，例如：

```jsonc
"SITE_BASE_URL": "https://yourname.github.io/your-repo"
```

## 写入 Secrets

不要把密钥写进仓库，用 Wrangler 写入：

```bash
npx wrangler secret put FEISHU_APP_ID
npx wrangler secret put FEISHU_APP_SECRET
npx wrangler secret put FEISHU_CHAT_ID
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID
npx wrangler secret put CLOUDFLARE_API_TOKEN
npx wrangler secret put MANUAL_TRIGGER_TOKEN
```

## 部署

```bash
npm run check
npm run deploy
```

默认定时：

- `40 22 * * *`：北京时间每天 06:40 主推送
- `10,40 23,0,1 * * *`：北京时间 07:10-09:40 巡逻补发

## 手动测试

部署后，先访问健康检查：

```bash
curl https://你的-worker.workers.dev/healthz
```

推送某天简报：

```bash
curl -H "Authorization: Bearer <MANUAL_TRIGGER_TOKEN>" \
  "https://你的-worker.workers.dev/send?date=2026-06-09&force=1"
```

如果截图链路失败，也可以发链接卡：

```bash
curl -H "Authorization: Bearer <MANUAL_TRIGGER_TOKEN>" \
  "https://你的-worker.workers.dev/send-link?date=2026-06-09&force=1"
```
