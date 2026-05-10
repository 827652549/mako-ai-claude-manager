import Link from "next/link";
import { Bot } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { readAgents } from "@/lib/claude-config";

/** Agents list page - displays all agent definitions as a card grid */
export default async function AgentsPage() {
  const agents = await readAgents();

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Agents</h1>
        <p className="text-muted-foreground">
          Agent definitions and configurations
        </p>
      </div>

      {agents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No agents found in ~/.claude/agents/
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((agent) => (
            <Link key={agent.name} href={`/agents/${agent.name}`}>
              <Card className="transition-all hover:shadow-lg hover:border-primary/50 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{agent.name}</CardTitle>
                    <Bot className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {agent.content.slice(0, 200)}
                  </p>
                  <div className="mt-2">
                    <Badge variant="secondary">{agent.filename}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
