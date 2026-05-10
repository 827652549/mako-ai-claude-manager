import Link from "next/link";
import { Puzzle } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { readSkills } from "@/lib/claude-config";

/** Skills list page — server component that renders all available skills as a card grid. */
export default async function SkillsPage() {
  const skills = await readSkills();

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Skills</h1>
        <p className="text-muted-foreground">Available skills and workflows</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {skills.map((skill) => (
          <Link key={skill.name} href={`/skills/${skill.name}`}>
            <Card className="transition-all hover:shadow-lg hover:border-primary/50 cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{skill.name}</CardTitle>
                  <Puzzle className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {skill.content.slice(0, 200)}...
                </p>
                <div className="mt-2 flex gap-2">
                  {skill.isSymlink && <Badge variant="outline">symlink</Badge>}
                  <Badge variant="secondary">{skill.content.length} chars</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
