import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CHANGELOG,
  type ChangelogVersion,
  type ChangelogType,
} from "@/constants/changelog";

/** Badge variant mapping for each changelog entry type. */
const TYPE_VARIANT: Record<
  ChangelogType,
  "default" | "destructive" | "secondary" | "outline"
> = {
  feat: "default",
  fix: "destructive",
  refactor: "secondary",
  docs: "outline",
  chore: "outline",
};

/** Changelog page — server component that renders version history as cards. */
export default function ChangelogPage() {
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Changelog</h1>
        <p className="text-muted-foreground">版本变更记录</p>
      </div>

      {CHANGELOG.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          暂无版本记录
        </p>
      ) : (
        <div className="space-y-4">
          {CHANGELOG.map((version: ChangelogVersion, index) => (
            <Card
              key={`${version.date}-${version.type}-${index}`}
              className="transition-all hover:shadow-md hover:border-primary/30"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">
                    {version.version}
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {version.date}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {version.entries.map(
                    (entry, index) => (
                      <Badge
                        key={`${version.version}-${entry.type}-${index}`}
                        variant={TYPE_VARIANT[entry.type]}
                      >
                        {entry.type}
                      </Badge>
                    ),
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {version.entries.map((entry, index) => (
                    <div
                      key={`${version.version}-content-${index}`}
                    >
                      <p className="text-sm text-foreground break-words">
                        {entry.summary}
                      </p>
                      {entry.scope && (
                        <p className="text-xs text-muted-foreground mt-1">
                          影响范围：{entry.scope}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
