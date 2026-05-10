import Link from "next/link";
import { FileText } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { readProjectRules } from "@/lib/claude-config";

/** Rules list page — displays all project rule files as cards */
export default async function RulesPage() {
  const rules = await readProjectRules();

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Rules</h1>
        <p className="text-muted-foreground">
          Project coding rules and guidelines
        </p>
      </div>

      {/* Rule Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map((rule) => (
          <Link key={rule.filename} href={`/rules/${rule.filename}`}>
            <Card className="transition-all hover:shadow-lg hover:border-primary/50 cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base truncate">
                    {rule.filename}
                  </CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {rule.content.slice(0, 200)}...
                </p>
                <div className="mt-2">
                  <Badge variant="secondary">{rule.content.length} chars</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {rules.length === 0 && (
        <p className="text-sm text-muted-foreground">No rules found.</p>
      )}
    </div>
  );
}
