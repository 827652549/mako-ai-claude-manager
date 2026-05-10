import { readClaudeMd } from "@/lib/claude-config";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Card, CardContent } from "@/components/ui/card";
import { FileCode } from "lucide-react";

/** CLAUDE.md reading page - displays the global memory file content */
export default async function ClaudeMdPage() {
  const content = await readClaudeMd();

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <FileCode className="h-6 w-6" />
            <h1 className="text-3xl font-bold">CLAUDE.md</h1>
          </div>
          <p className="text-muted-foreground">
            Global memory and instructions file (~/.claude/CLAUDE.md)
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {content ? (
              <MarkdownRenderer content={content} />
            ) : (
              <p className="text-muted-foreground text-center py-8">
                CLAUDE.md file is empty or not found.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
