#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const readline = require("readline");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--output" || a === "-o") out.output = argv[++i];
    else if (a.startsWith("--output=")) out.output = a.slice("--output=".length);
    else if (a === "--name" || a === "-n") out.name = argv[++i];
    else if (a.startsWith("--name=")) out.name = a.slice("--name=".length);
    else if (a === "--force" || a === "-f") out.force = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => {
    rl.close();
    resolve(ans.trim());
  }));
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (entry === ".git" || entry === "node_modules") continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  fs.copyFileSync(src, dest);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log("Usage: node scripts/clone-stack.js --output <dir> --name <service-name> [--force]");
    process.exit(0);
  }

  const sourceRepo = process.cwd();
  let outputDir = args.output;
  let serviceName = args.name;

  if (!outputDir) outputDir = await ask("Nhập đường dẫn output (vd: /opt/stacks): ");
  if (!serviceName) serviceName = await ask("Nhập tên dịch vụ mới (vd: my-service): ");

  if (!outputDir || !serviceName) {
    console.error("❌ Thiếu output hoặc service name.");
    process.exit(1);
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(serviceName)) {
    console.error("❌ service name chỉ được chứa chữ/số/._-");
    process.exit(1);
  }

  const targetRoot = path.resolve(outputDir);
  const targetDir = path.join(targetRoot, serviceName);

  fs.mkdirSync(targetRoot, { recursive: true });

  if (fs.existsSync(targetDir)) {
    if (!args.force) {
      console.error(`❌ Thư mục đích đã tồn tại: ${targetDir}`);
      console.error("   Dùng --force để ghi đè.");
      process.exit(1);
    }
    fs.rmSync(targetDir, { recursive: true, force: true });
  }

  copyRecursive(sourceRepo, targetDir);

  const readmePath = path.join(targetDir, "README.md");
  if (fs.existsSync(readmePath)) {
    const stamp = `\n\n> Cloned from ${sourceRepo} at ${new Date().toISOString()}\n`;
    fs.appendFileSync(readmePath, stamp, "utf8");
  }

  console.log("✅ Clone thành công.");
  console.log(`   Source : ${sourceRepo}`);
  console.log(`   Target : ${targetDir}`);
  console.log("   Gợi ý bước tiếp theo:");
  console.log(`   - cd ${targetDir}`);
  console.log("   - cp .env.example .env (nếu có)");
  console.log("   - npm run dockerapp-validate:env");
}

main().catch((err) => {
  console.error("❌ Lỗi clone:", err.message);
  process.exit(1);
});
