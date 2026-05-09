/**
 * Linear GraphQL API Client
 *
 * Orchestrator 用这个模块直接操作 Linear（不经过 MCP）。
 * 子 Agent（claude -p）通过 --allowedTools 用 MCP。
 *
 * 环境变量：LINEAR_API_KEY
 */

const LINEAR_API = "https://api.linear.app/graphql";

interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function graphql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    throw new Error("缺少环境变量 LINEAR_API_KEY");
  }

  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors?.length) {
    throw new Error(`Linear API 错误: ${json.errors.map((e) => e.message).join(", ")}`);
  }
  if (!json.data) {
    throw new Error("Linear API 返回空数据");
  }
  return json.data;
}

// ── Issue 查询 ──────────────────────────────────────────────

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  state: { id: string; name: string; type: string };
  labels: { nodes: Array<{ name: string }> };
  comments: { nodes: Array<{ id: string; body: string; createdAt: string }> };
  children: { nodes: Array<{ id: string; identifier: string; title: string; state: { name: string } }> };
  parent?: { id: string; identifier: string };
  project?: { id: string; name: string };
}

export async function getIssue(issueId: string): Promise<LinearIssue> {
  const data = await graphql<{ issue: LinearIssue }>(`
    query GetIssue($id: String!) {
      issue(id: $id) {
        id
        identifier
        title
        description
        state { id name type }
        labels { nodes { name } }
        comments(first: 50) { nodes { id body createdAt } }
        children(first: 50) { nodes { id identifier title state { name } } }
        parent { id identifier }
        project { id name }
      }
    }
  `, { id: issueId });
  return data.issue;
}

export async function getIssuesByProject(projectId: string): Promise<LinearIssue[]> {
  const data = await graphql<{ issues: { nodes: LinearIssue[] } }>(`
    query GetIssues($projectId: String!) {
      issues(filter: { project: { id: { eq: $projectId } } }, first: 100) {
        nodes {
          id identifier title
          state { id name type }
          parent { id identifier }
        }
      }
    }
  `, { projectId });
  return data.issues.nodes;
}

// ── Issue 状态更新 ──────────────────────────────────────────

export async function updateIssueStatus(
  issueId: string,
  stateId: string
): Promise<void> {
  await graphql(`
    mutation UpdateIssue($id: String!, $stateId: String!) {
      issueUpdate(id: $id, input: { stateId: $stateId }) {
        success
      }
    }
  `, { id: issueId, stateId });
}

// ── 创建子任务 ──────────────────────────────────────────────

export async function createSubIssue(
  parentId: string,
  title: string,
  description?: string,
  teamId?: string
): Promise<{ id: string; identifier: string }> {
  const data = await graphql<{ issueCreate: { issue: { id: string; identifier: string } } }>(`
    mutation CreateSubIssue($parentId: String!, $title: String!, $description: String, $teamId: String!) {
      issueCreate(input: {
        title: $title,
        description: $description,
        parentId: $parentId,
        teamId: $teamId
      }) {
        issue { id identifier }
      }
    }
  `, { parentId, title, description: description ?? "", teamId: teamId ?? "" });
  return data.issueCreate.issue;
}

// ── 发评论 ──────────────────────────────────────────────────

export async function addComment(
  issueId: string,
  body: string
): Promise<{ id: string }> {
  const data = await graphql<{ commentCreate: { comment: { id: string } } }>(`
    mutation AddComment($issueId: String!, $body: String!) {
      commentCreate(input: { issueId: $issueId, body: $body }) {
        comment { id }
      }
    }
  `, { issueId, body });
  return data.commentCreate.comment;
}

// ── 查询团队的状态列表 ──────────────────────────────────────

export interface WorkflowState {
  id: string;
  name: string;
  type: string;
}

export async function getWorkflowStates(teamId: string): Promise<WorkflowState[]> {
  const data = await graphql<{ workflowStates: { nodes: WorkflowState[] } }>(`
    query GetStates($teamId: String!) {
      workflowStates(filter: { team: { id: { eq: $teamId } } }, first: 50) {
        nodes { id name type }
      }
    }
  `, { teamId });
  return data.workflowStates.nodes;
}
