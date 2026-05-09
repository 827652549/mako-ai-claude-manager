import { spawn } from "node:child_process";
import type { AgentConfig, AgentResult } from "./types.js";

/**
 * Claude Code Headless Runner
 *
 * 通过 `claude -p` 拉起无状态子进程，执行单个角色任务。
 * 每个子进程 = 一个角色 .md 文件的实例化。
 *
 * 关键参数：
 *   --system-prompt   角色 .md 的 body 部分
 *   --allowedTools    角色 frontmatter 中的 tools 列表
 *   --max-turns       角色 frontmatter 中的 max_turns
 *   --output-format   stream-json（便于解析）
 */

export interface RunOptions {
  prompt: string;           // 注入的上下文（Task 卡片 / PRD / 仓库快照等）
  cwd?: string;             // 工作目录
  timeoutMs?: number;       // 超时（默认 10 分钟）
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

export async function runAgent(
  config: AgentConfig,
  options: RunOptions
): Promise<AgentResult> {
  const { prompt, cwd, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  // 读取角色 .md 文件（body 作为 system-prompt）
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");

  const mdPath = resolve(cwd ?? process.cwd(), config.mdFile);
  let systemPrompt: string;
  try {
    const raw = readFileSync(mdPath, "utf-8");
    // 去掉 YAML frontmatter，取 body
    systemPrompt = raw.replace(/^---[\s\S]*?---\s*/, "").trim();
  } catch {
    return {
      success: false,
      output: "",
      error: `角色文件不存在: ${mdPath}`,
    };
  }

  const args = [
    "-p", prompt,
    "--system-prompt", systemPrompt,
    "--allowedTools", ...config.tools,
    "--max-turns", String(config.maxTurns),
    "--output-format", "stream-json",
  ];

  return new Promise((resolve) => {
    const proc = spawn("claude", args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      resolve({
        success: false,
        output: stdout,
        error: `执行超时 (${timeoutMs}ms)`,
      });
    }, timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timer);

      if (code === 0) {
        // 从 stream-json 输出中提取最终 assistant message
        const result = parseStreamJsonOutput(stdout);
        resolve({
          success: true,
          output: result.text,
          commits: result.commits,
          changedFiles: result.changedFiles,
        });
      } else {
        resolve({
          success: false,
          output: stdout,
          error: stderr || `进程退出码: ${code}`,
        });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        success: false,
        output: "",
        error: `启动失败: ${err.message}`,
      });
    });
  });
}

/**
 * 从 claude --output-format stream-json 输出中解析结果。
 * TODO: 根据实际 stream-json 格式细化解析逻辑。
 */
function parseStreamJsonOutput(raw: string): {
  text: string;
  commits?: string[];
  changedFiles?: string[];
} {
  const lines = raw.trim().split("\n").filter(Boolean);
  let text = "";
  const commits: string[] = [];
  const changedFiles: string[] = [];

  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      if (event.type === "assistant" && event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === "text") {
            text += block.text;
          }
        }
      }
      // TODO: 提取 tool_use 中的 git commit / file change 信息
    } catch {
      // 跳过非 JSON 行
    }
  }

  return { text, commits: commits.length ? commits : undefined, changedFiles: changedFiles.length ? changedFiles : undefined };
}
