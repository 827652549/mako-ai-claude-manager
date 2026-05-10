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
import { Separator } from "@/components/ui/separator";
import { getDirectoryTree, type DirectoryNode } from "@/lib/claude-config";
import {
  DIRECTORY_CATEGORIES,
  DIRECTORY_METADATA,
  type CategoryId,
  type DirectoryEntryMeta,
} from "@/constants/directory-metadata";

/** Force SSR — real-time reads from ~/.claude/ */
export const dynamic = "force-dynamic";

/** Icon map for category headers */
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Settings,
  History,
  Database,
  FolderKanban,
  Puzzle,
};

/** Get actual entries present on disk by scanning the directory tree */
function getExistingEntries(tree: DirectoryNode[]): Set<string> {
  const names = new Set<string>();
  for (const node of tree) {
    names.add(node.name);
  }
  return names;
}

// ─── Category Section Component ───────────────────────────────────────────────

function CategorySection({
  category,
  entries,
}: {
  category: (typeof DIRECTORY_CATEGORIES)[number];
  entries: DirectoryEntryMeta[];
}) {
  const Icon = CATEGORY_ICONS[category.icon] ?? Folder;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {category.label}
          <Badge variant="secondary" className="ml-auto text-xs">
            {entries.length}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{category.description}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-2">
          {entries.map((entry) => (
            <EntryRow key={entry.name} entry={entry} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Entry Row Component ──────────────────────────────────────────────────────

function EntryRow({ entry }: { entry: DirectoryEntryMeta }) {
  const isLinked = !!entry.linkedPage;

  return (
    <div className="flex items-start gap-3 rounded-md border p-3 transition-all hover:shadow-md hover:border-primary/30">
      {/* Icon */}
      <div className="mt-0.5 shrink-0">
        {entry.type === "directory" ? (
          <Folder className="h-4 w-4 text-yellow-500" />
        ) : (
          <File className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-medium truncate">
            {entry.name}
          </span>
          {isLinked && (
            <Badge variant="default" className="text-xs shrink-0">
              已有页面
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {entry.description}
        </p>
      </div>

      {/* Link */}
      {isLinked && entry.linkedPage && (
        <Link
          href={entry.linkedPage}
          className="shrink-0 flex items-center gap-1 text-xs text-primary hover:underline"
        >
          查看
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

// ─── Tree View Component (existing, kept for raw structure reference) ─────────

function TreeNode({
  node,
  depth = 0,
}: {
  node: DirectoryNode;
  depth?: number;
}) {
  const isDir = node.type === "directory";

  return (
    <div style={{ paddingLeft: `${depth * 20}px` }}>
      <div className="flex items-center gap-2 py-1 text-sm">
        {isDir ? (
          <Folder className="h-4 w-4 text-yellow-500 shrink-0" />
        ) : (
          <File className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className={isDir ? "font-medium" : "text-muted-foreground"}>
          {node.name}
        </span>
      </div>
      {isDir && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.name} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default async function DirectoryPage() {
  const tree = await getDirectoryTree();

  // Determine which entries actually exist on disk
  const existingNames = getExistingEntries(tree);

  // Filter metadata to only show entries that exist on disk
  const existingMeta = DIRECTORY_METADATA.filter((m) =>
    existingNames.has(m.name),
  );

  // Group by category
  const grouped = new Map<CategoryId, DirectoryEntryMeta[]>();
  for (const cat of DIRECTORY_CATEGORIES) {
    grouped.set(cat.id, []);
  }
  for (const entry of existingMeta) {
    const list = grouped.get(entry.category);
    if (list) {
      list.push(entry);
    }
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <FolderTree className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Directory</h1>
        </div>
        <p className="text-muted-foreground">
          ~/.claude/ 配置目录全景 — 每个目录的用途和分类说明
        </p>
      </div>

      {/* ── Categorized Overview ─────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">目录概览</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {DIRECTORY_CATEGORIES.map((cat) => {
            const entries = grouped.get(cat.id) ?? [];
            if (entries.length === 0) return null;
            return (
              <CategorySection key={cat.id} category={cat} entries={entries} />
            );
          })}
        </div>
      </div>

      <Separator />

      {/* ── Raw Directory Tree (preserved) ───────────────── */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">原始目录树</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Folder className="h-4 w-4 text-yellow-500" />
              ~/.claude/
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tree.length > 0 ? (
              <div className="space-y-0">
                {tree.map((node) => (
                  <TreeNode key={node.name} node={node} depth={0} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Directory is empty or could not be read.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
