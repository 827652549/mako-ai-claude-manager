import Link from "next/link";
import {
  FolderTree,
  Folder,
  File,
  Settings,
  History,
  Database,
  FolderKanban,
  Puzzle,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getDirectoryTree,
  type DirectoryNode,
} from "@/lib/claude-config";
import {
  DIRECTORY_CATEGORIES,
  DIRECTORY_METADATA,
  type CategoryId,
  type DirectoryEntryMeta,
} from "@/constants/directory-metadata";

// Force SSR — reads disk state on every request
export const dynamic = "force-dynamic";

/** Map category icon names to lucide-react components */
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Settings,
  History,
  Database,
  FolderKanban,
  Puzzle,
};

/**
 * Recursively collect all entry names from a directory tree.
 *
 * @param nodes - Tree nodes to traverse
 * @returns Flat set of entry names
 */
function collectNames(nodes: DirectoryNode[]): Set<string> {
  const names = new Set<string>();
  for (const node of nodes) {
    names.add(node.name);
    if (node.children) {
      for (const name of collectNames(node.children)) {
        names.add(name);
      }
    }
  }
  return names;
}

/**
 * Group filtered metadata entries by category.
 *
 * @param entries - Metadata entries to group
 * @returns Map from category id to entries
 */
function groupByCategory(
  entries: DirectoryEntryMeta[],
): Map<CategoryId, DirectoryEntryMeta[]> {
  const groups = new Map<CategoryId, DirectoryEntryMeta[]>();
  for (const entry of entries) {
    const list = groups.get(entry.category) ?? [];
    list.push(entry);
    groups.set(entry.category, list);
  }
  return groups;
}

/** Directory overview page — shows all ~/.claude/ entries categorized and explained. */
export default async function DirectoryOverviewPage() {
  const tree = await getDirectoryTree();
  const existingNames = collectNames(tree);

  // Filter metadata to only entries present on disk
  const visibleEntries = DIRECTORY_METADATA.filter(
    (meta) => existingNames.has(meta.name),
  );
  const grouped = groupByCategory(visibleEntries);

  // Empty state
  if (tree.length === 0) {
    return (
      <div className="p-6 md:p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FolderTree className="h-8 w-8" />
            目录全景
          </h1>
          <p className="text-muted-foreground">
            ~/.claude/ 配置目录完整结构说明
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Directory is empty or could not be read.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FolderTree className="h-8 w-8" />
          目录全景
        </h1>
        <p className="text-muted-foreground">
          ~/.claude/ 配置目录完整结构说明
        </p>
      </div>

      {/* Category sections */}
      <div className="space-y-6">
        {DIRECTORY_CATEGORIES.map((category) => {
          const entries = grouped.get(category.id);
          if (!entries || entries.length === 0) {
            return null;
          }

          const IconComponent =
            CATEGORY_ICONS[category.icon] ?? Folder;

          return (
            <Card key={category.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <IconComponent className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">
                    {category.label}
                  </CardTitle>
                  <Badge variant="secondary">{entries.length}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {entries.map((entry) => (
                    <div
                      key={entry.name}
                      className="flex items-start gap-3 rounded-md border p-3 transition-all hover:shadow-md hover:border-primary/30"
                    >
                      {/* Type icon */}
                      {entry.type === "directory" ? (
                        <Folder className="h-4 w-4 mt-0.5 shrink-0 text-yellow-500" />
                      ) : (
                        <File className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      )}

                      {/* Content area */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <span className="font-mono text-sm font-medium">
                          {entry.name}
                        </span>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {entry.description}
                        </p>
                      </div>

                      {/* Linked page badge and link */}
                      {entry.linkedPage && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="default">已有页面</Badge>
                          <Link
                            href={entry.linkedPage}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            查看 <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
