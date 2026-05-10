import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { readAgents } from "@/lib/claude-config";

/** Generate static paths for all agents at build time */
export async function generateStaticParams() {
  const agents = await readAgents();
  return agents.map((agent) => ({ name: agent.name }));
}

/** Agent detail page - renders full markdown content for a single agent */
export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const agents = await readAgents();
  const agent = agents.find((a) => a.name === name);

  if (!agent) {
    notFound();
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <Link
          href="/agents"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Agents
        </Link>
        <h1 className="text-2xl font-bold mt-2">{agent.name}</h1>
        <Badge variant="secondary" className="mt-1">
          {agent.filename}
        </Badge>
      </div>
      <Card>
        <CardContent className="pt-6">
          <MarkdownRenderer content={agent.content} />
        </CardContent>
      </Card>
    </div>
  );
}
