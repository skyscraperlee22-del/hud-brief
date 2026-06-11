#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const API_URL = "https://api.openai.com/v1/responses";
const MODEL = process.env.OPENAI_MODEL || "gpt-5.4";
const TIME_ZONE = "Asia/Shanghai";
const SECTION_NAMES = ["AI 工作台", "AI 信息美学", "AI 流水线", "AI 大模型", "国内外剧场资讯"];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function shanghaiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function weekday(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: TIME_ZONE,
    weekday: "long",
  }).format(new Date(`${date}T12:00:00+08:00`));
}

function recentHistory(targetDate) {
  const dir = path.join(ROOT, "brief-data");
  return fs.readdirSync(dir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name) && name !== `${targetDate}.json`)
    .sort().reverse().slice(0, 14)
    .flatMap((name) => {
      const data = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
      return data.sections.flatMap((section) => section.items.map((item) => ({
        title: item.title,
        sourceUrl: item.sourceUrl,
      })));
    });
}

const itemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "sourceName", "sourceUrl", "sourceDateLabel"],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    sourceName: { type: "string" },
    sourceUrl: { type: "string" },
    sourceDateLabel: { type: "string" },
  },
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["date", "weekday", "opening", "insight", "methodNote", "homepage", "sections"],
  properties: {
    date: { type: "string" },
    weekday: { type: "string" },
    opening: { type: "string" },
    insight: { type: "string" },
    methodNote: { type: "string" },
    homepage: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "summary", "mobileSections"],
      properties: {
        headline: { type: "string" },
        summary: { type: "string" },
        mobileSections: {
          type: "array",
          minItems: 5,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "summary"],
            properties: { name: { type: "string" }, summary: { type: "string" } },
          },
        },
      },
    },
    sections: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "subtitle", "items"],
        properties: {
          name: { type: "string" },
          subtitle: { type: "string" },
          items: { type: "array", minItems: 3, maxItems: 3, items: itemSchema },
        },
      },
    },
  },
};

function validate(data, targetDate) {
  if (data.date !== targetDate) fail(`Model returned date ${data.date}, expected ${targetDate}`);
  if (data.weekday !== weekday(targetDate)) fail(`Model returned an incorrect weekday: ${data.weekday}`);
  const names = data.sections.map((section) => section.name);
  if (JSON.stringify(names) !== JSON.stringify(SECTION_NAMES)) fail(`Unexpected section order: ${names.join(", ")}`);
  for (const section of data.sections) {
    if (section.items.length !== 3) fail(`${section.name} must contain exactly three items`);
    for (const item of section.items) {
      let url;
      try { url = new URL(item.sourceUrl); } catch { fail(`Invalid source URL: ${item.sourceUrl}`); }
      if (url.protocol !== "https:") fail(`Source URL must use HTTPS: ${item.sourceUrl}`);
    }
  }
}

function outputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  for (const output of response.output || []) {
    for (const content of output.content || []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  fail("OpenAI response did not contain output text");
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) fail("OPENAI_API_KEY is required");
  const targetDate = process.argv[2] || shanghaiDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) fail("Date must use YYYY-MM-DD");
  const outputPath = path.join(ROOT, "brief-data", `${targetDate}.json`);
  if (fs.existsSync(outputPath) && process.env.FORCE !== "1") {
    console.log(`Brief data already exists for ${targetDate}; nothing to do.`);
    return;
  }

  const prompt = `为 ${targetDate}（${weekday(targetDate)}，北京时间）生成 The AI Industry Brief。\n\n必须使用网页搜索核验每条信息，优先最近 7 天的一手来源；不足时可扩展到 30 天，并在 sourceDateLabel 标注“邻近窗口”。只有无替代资料时才使用更旧来源，并标注“最近官方参考”。不要把未来事件写成已经发生。\n\n固定栏目及顺序：${SECTION_NAMES.join("、")}。每栏恰好 3 条。标题格式为“产品/机构 | 动作短语”。description 用中文写事实和行业影响。sourceUrl 必须是实际查阅的 HTTPS 页面，不得编造。首页 mobileSections 与栏目一一对应。\n\n避免与最近历史重复，尤其不能重复 URL 或同一事件：\n${JSON.stringify(recentHistory(targetDate))}\n\n输出只需符合 JSON schema。`;
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      tools: [{ type: "web_search" }],
      input: prompt,
      text: { format: { type: "json_schema", name: "daily_industry_brief", strict: true, schema } },
    }),
  });
  if (!response.ok) fail(`OpenAI API failed (${response.status}): ${await response.text()}`);
  const data = JSON.parse(outputText(await response.json()));
  validate(data, targetDate);
  fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Generated ${path.relative(ROOT, outputPath)} with ${MODEL}`);
}

await main();
