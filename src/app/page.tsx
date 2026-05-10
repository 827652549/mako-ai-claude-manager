import Link from "next/link";
import {
  Settings,
  Bot,
  Puzzle,
  FileText,
  FileCode,
  FolderTree,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  readClaudeSettings,
  readAgents,
  readSkills,
  readProjectRules,
  readClaudeMd,
  getDirectoryTree,
  type DirectoryNode,
} from "@/lib/claude-config";

/** Force SSR — real-time reads from ~/.claude/, never prerendered */
export const dynamic = "force-dynamic";

/** Recursively count all nodes in a directory tree */
function countNodes(nodes: DirectoryNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count++;
    if (node.children) {
      count += countNodes(node.children);
    }
  }
  return count;
}

/** Module card definition */
interface ModuleCard {
  title: string;
  icon: React.ElementType;
  description: string;
  href: string;
  count: number | null;
  isError: boolean;
}

/** Static landing page when ~/.claude/ is not available (e.g. Vercel) */
function LandingPage() {
  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="max-w-xl text-center space-y-4 p-6">
        <h1 className="text-3xl font-bold">Claude Code Manager</h1>
        <p className="text-muted-foreground leading-relaxed">
          Claude Code Manager 是一个本地运行的可视化管理工具，用于浏览和查看
          <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-sm">
            ~/.claude/
          </code>
          目录下的配置，包括 Agent、Skill、权限规则、全局记忆等。支持深色/浅色主题切换和移动端适配。
        </p>
        <p className="text-sm text-muted-foreground">
          本地启动:{" "}
          <code className="px-1.5 py-0.5 rounded bg-muted">bun run dev</code>
          {" → "}
          <code className="px-1.5 py-0.5 rounded bg-muted">localhost:3000</code>
        </p>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  // Try to fetch all data — if ~/.claude/ doesn't exist (e.g. Vercel), show landing page
  const [
    settingsResult,
    agentsResult,
    skillsResult,
    rulesResult,
    claudeMdResult,
    directoryResult,
  ] = await Promise.allSettled([
    readClaudeSettings(),
    readAgents(),
    readSkills(),
    readProjectRules(),
    readClaudeMd(),
    getDirectoryTree(),
  ]);

  // Extract values or mark as error
  const settings =
    settingsResult.status === "fulfilled" ? settingsResult.value : null;
  const agents =
    agentsResult.status === "fulfilled" ? agentsResult.value : null;
  const skills =
    skillsResult.status === "fulfilled" ? skillsResult.value : null;
  const rules =
    rulesResult.status === "fulfilled" ? rulesResult.value : null;
  const claudeMd =
    claudeMdResult.status === "fulfilled" ? claudeMdResult.value : null;
  const directoryTree =
    directoryResult.status === "fulfilled" ? directoryResult.value : null;

  // Detect if ~/.claude/ is unavailable:
  // - All reads rejected (error), OR
  // - All reads returned empty data (no agents, no skills, no rules, no CLAUDE.md content, no directory)
  const allRejected = [
    settingsResult,
    agentsResult,
    skillsResult,
    rulesResult,
    claudeMdResult,
    directoryResult,
  ].every((r) => r.status === "rejected");

  const allEmpty =
    (agents === null || agents.length === 0) &&
    (skills === null || skills.length === 0) &&
    (rules === null || rules.length === 0) &&
    (claudeMd === null || claudeMd === "") &&
    (directoryTree === null || directoryTree.length === 0);

  if (allRejected || allEmpty) {
    return <LandingPage />;
  }

  const modules: ModuleCard[] = [
    {
      title: "Settings",
      icon: Settings,
      description: "Global settings, permissions, plugins",
      href: "/settings",
      count: settings ? Object.keys(settings).length : null,
      isError: settings === null,
    },
    {
      title: "Agents",
      icon: Bot,
      description: "Agent definitions and configurations",
      href: "/agents",
      count: agents ? agents.length : null,
      isError: agents === null,
    },
    {
      title: "Skills",
      icon: Puzzle,
      description: "Available skills and workflows",
      href: "/skills",
      count: skills ? skills.length : null,
      isError: skills === null,
    },
    {
      title: "Rules",
      icon: FileText,
      description: "Project coding rules and guidelines",
      href: "/rules",
      count: rules ? rules.length : null,
      isError: rules === null,
    },
    {
      title: "CLAUDE.md",
      icon: FileCode,
      description: "Global memory and instructions",
      href: "/claude-md",
      count: claudeMd !== null ? 1 : null,
      isError: claudeMd === null,
    },
    {
      title: "Directory",
      icon: FolderTree,
      description: "Configuration directory structure",
      href: "/directory",
      count: directoryTree ? countNodes(directoryTree) : null,
      isError: directoryTree === null,
    },
  ];

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Claude Code Manager</h1>
        <p className="mt-1 text-muted-foreground">
          Manage and visualize your .claude config
        </p>
      </div>

      {/* Module Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link key={mod.title} href={mod.href} className="group block">
              <Card
                className={cn(
                  "transition-all hover:shadow-lg hover:border-primary/50 cursor-pointer",
                )}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {mod.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {mod.description}
                  </p>
                  <div className="mt-2">
                    {mod.isError ? (
                      <Badge variant="destructive">Load failed</Badge>
                    ) : (
                      <Badge variant="secondary">
                        {mod.count} {mod.count === 1 ? "item" : "items"}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
