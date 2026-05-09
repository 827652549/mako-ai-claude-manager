/**
 * Vercel REST API Client
 *
 * Orchestrator 用这个模块直接操作 Vercel（不经过 MCP）。
 * 子 Agent（claude -p）通过 --allowedTools 用 MCP。
 *
 * 环境变量：VERCEL_TOKEN
 */

const VERCEL_API = "https://api.vercel.com";

async function vercelFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    throw new Error("缺少环境变量 VERCEL_TOKEN");
  }

  const res = await fetch(`${VERCEL_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vercel API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ── 部署 ────────────────────────────────────────────────────

export interface VercelDeployment {
  id: string;
  url: string;
  readyState: "QUEUED" | "BUILDING" | "READY" | "ERROR" | "CANCELED";
  projectId: string;
  gitSource?: {
    ref: string;
    repoId: string;
  };
  createdAt: number;
  ready?: number;
}

export async function getDeployment(deploymentId: string): Promise<VercelDeployment> {
  return vercelFetch<VercelDeployment>(`/v13/deployments/${deploymentId}`);
}

export async function listDeployments(
  projectId: string,
  limit = 20
): Promise<{ deployments: VercelDeployment[] }> {
  return vercelFetch(`/v6/deployments?projectId=${projectId}&limit=${limit}`);
}

// ── 触发部署 ────────────────────────────────────────────────

export async function createDeployment(params: {
  name: string;
  gitSource: { ref: string; repoId: string; type: "github" };
  target?: "production" | "staging";
  meta?: Record<string, string>;
}): Promise<VercelDeployment> {
  return vercelFetch<VercelDeployment>("/v13/deployments", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ── Promote（preview → production）──────────────────────────

export async function promoteDeployment(deploymentId: string): Promise<VercelDeployment> {
  return vercelFetch<VercelDeployment>(
    `/v13/deployments/${deploymentId}/promote`,
    { method: "POST" }
  );
}

// ── 等待部署就绪 ────────────────────────────────────────────

export async function waitForDeployment(
  deploymentId: string,
  timeoutMs = 5 * 60 * 1000,
  pollIntervalMs = 5000
): Promise<VercelDeployment> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const deployment = await getDeployment(deploymentId);

    if (deployment.readyState === "READY") {
      return deployment;
    }
    if (deployment.readyState === "ERROR" || deployment.readyState === "CANCELED") {
      throw new Error(`部署 ${deploymentId} 失败: ${deployment.readyState}`);
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`部署 ${deploymentId} 超时 (${timeoutMs}ms)`);
}

// ── 获取部署构建日志 ────────────────────────────────────────

export async function getBuildLogs(
  deploymentId: string
): Promise<{ ok: boolean; data: Array<{ text: string; timestamp: number }> }> {
  return vercelFetch(`/v2/deployments/${deploymentId}/events?build=1`);
}

// ── 校验环境变量 ────────────────────────────────────────────

export interface EnvVar {
  key: string;
  value: string;
  target: string[];
  type: string;
}

export async function listEnvVars(projectId: string): Promise<EnvVar[]> {
  const data = await vercelFetch<{ envs: EnvVar[] }>(`/v9/projects/${projectId}/env`);
  return data.envs;
}

export async function validateRequiredEnvVars(
  projectId: string,
  requiredKeys: string[]
): Promise<{ missing: string[]; present: string[] }> {
  const envs = await listEnvVars(projectId);
  const existingKeys = new Set(envs.map((e) => e.key));
  const missing = requiredKeys.filter((k) => !existingKeys.has(k));
  const present = requiredKeys.filter((k) => existingKeys.has(k));
  return { missing, present };
}
