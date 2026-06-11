#!/usr/bin/env node

import fs from "node:fs";

const file = process.argv[2];
if (!file) throw new Error("Usage: node scripts/validate-daily-brief.mjs brief-data/YYYY-MM-DD.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const expected = ["AI 工作台", "AI 信息美学", "AI 流水线", "AI 大模型", "国内外剧场资讯"];

if (data.sections?.length !== 5) throw new Error("Brief must contain five sections");
if (data.sections.map((section) => section.name).join("|") !== expected.join("|")) {
  throw new Error("Brief sections are missing or out of order");
}
const items = data.sections.flatMap((section) => section.items || []);
if (items.length !== 15) throw new Error("Brief must contain fifteen items");
const urls = items.map((item) => item.sourceUrl);
if (new Set(urls).size !== urls.length) throw new Error("Today's brief contains duplicate source URLs");
for (const url of urls) new URL(url);

console.log(`Validated ${file}: five sections, fifteen unique sources`);
