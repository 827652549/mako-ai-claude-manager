import { getDirectoryTree, type DirectoryNode } from "@/lib/claude-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderTree, Folder, File } from "lucide-react";

function TreeNode({ node, depth = 0 }: { node: DirectoryNode; depth?: number }) {
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

export default async function DirectoryPage() {
  const tree = await getDirectoryTree();

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <FolderTree className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Directory</h1>
        </div>
        <p className="text-muted-foreground">
          ~/.claude/ configuration directory structure
        </p>
      </div>

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
  );
}
