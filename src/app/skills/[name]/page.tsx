import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { readSkills } from "@/lib/claude-config";
import { MarkdownRenderer } from "@/components/markdown-renderer";

/** Generate static paths for all skills so the detail pages are pre-rendered at build time. */
export async function generateStaticParams() {
  const skills = await readSkills();
  return skills.map((skill) => ({ name: skill.name }));
}

/** Skill detail page — server component that renders full Markdown content of a single skill. */
export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const skills = await readSkills();
  const skill = skills.find((s) => s.name === name);

  if (!skill) {
    notFound();
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <Link
          href="/skills"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Skills
        </Link>
        <h1 className="text-2xl font-bold mt-2">{skill.name}</h1>
        <div className="flex gap-2 mt-1">
          {skill.isSymlink && <Badge variant="outline">symlink</Badge>}
          {skill.targetPath && (
            <Badge variant="secondary" className="truncate max-w-md">
              {skill.targetPath}
            </Badge>
          )}
        </div>
      </div>
      <Card>
        <CardContent className="pt-6">
          <MarkdownRenderer content={skill.content} />
        </CardContent>
      </Card>
    </div>
  );
}
