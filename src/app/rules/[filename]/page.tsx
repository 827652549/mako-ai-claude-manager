import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { readProjectRules } from "@/lib/claude-config";

/** Generate static paths for all rule files */
export async function generateStaticParams() {
  const rules = await readProjectRules();
  return rules.map((rule) => ({ filename: rule.filename }));
}

/** Rule detail page — renders full Markdown content of a single rule */
export default async function RuleDetailPage({
  params,
}: {
  params: Promise<{ filename: string }>;
}) {
  const { filename } = await params;
  const rules = await readProjectRules();
  const rule = rules.find((r) => r.filename === filename);

  if (!rule) {
    notFound();
  }

  return (
    <div className="p-6 md:p-8">
      {/* Back link and title */}
      <div className="mb-6">
        <Link
          href="/rules"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Rules
        </Link>
        <h1 className="text-2xl font-bold mt-2">{rule.filename}</h1>
      </div>

      {/* Markdown content */}
      <Card>
        <CardContent className="pt-6">
          <MarkdownRenderer content={rule.content} />
        </CardContent>
      </Card>
    </div>
  );
}
