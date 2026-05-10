import {
  Cpu,
  Shield,
  Puzzle,
  Key,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  readClaudeSettings,
  readClaudeLocalSettings,
} from "@/lib/claude-config";

/** Keys in env that represent model configuration */
const MODEL_ENV_PATTERNS = [
  "ANTHROPIC_MODEL",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL",
  "ANTHROPIC_DEFAULT_OPUS_MODEL",
  "ANTHROPIC_DEFAULT_SONNET_MODEL",
  "ANTHROPIC_DEFAULT_EXTENDED_THINKING_MODEL",
  "CLAUDE_MODEL",
  "CLAUDE_CODE_MAX_MODEL",
];

export default async function SettingsPage() {
  const [settings, localSettings] = await Promise.all([
    readClaudeSettings(),
    readClaudeLocalSettings(),
  ]);

  // Extract model-related env vars
  const modelEnvEntries = MODEL_ENV_PATTERNS
    .filter((key) => key in settings.env)
    .map((key) => ({ key, value: settings.env[key] }));

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Global Claude Code configuration
        </p>
      </div>

      <div className="grid gap-6">
        {/* ---- Model Card ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              Model
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current model */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Current Model</span>
              {settings.model ? (
                <Badge variant="default">{settings.model}</Badge>
              ) : (
                <Badge variant="outline">Not set</Badge>
              )}
            </div>

            {modelEnvEntries.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Model Environment Variables
                  </p>
                  <div className="grid gap-2">
                    {modelEnvEntries.map(({ key, value }) => (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-4"
                      >
                        <span className="text-sm font-mono truncate">
                          {key}
                        </span>
                        <Badge variant="secondary" className="shrink-0">
                          {value}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ---- Permissions Card ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Default mode */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Default Mode</span>
              {settings.permissions.defaultMode ? (
                <Badge variant="default">
                  {settings.permissions.defaultMode}
                </Badge>
              ) : (
                <Badge variant="outline">Not set</Badge>
              )}
            </div>

            {/* Allow list */}
            {localSettings.permissions.allow.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Allowed Permissions ({localSettings.permissions.allow.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {localSettings.permissions.allow.map((rule, index) => (
                      <Badge key={index} variant="secondary">
                        {rule}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ---- Plugins Card ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Puzzle className="h-5 w-5" />
              Plugins
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(settings.enabledPlugins).length > 0 ? (
              <div className="grid gap-2">
                {Object.entries(settings.enabledPlugins).map(
                  ([name, enabled]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm truncate">{name}</span>
                      <Badge
                        variant={enabled ? "default" : "outline"}
                        className="shrink-0"
                      >
                        {enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No plugins configured
              </p>
            )}
          </CardContent>
        </Card>

        {/* ---- Environment Card ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Environment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(settings.env).length > 0 ? (
              <div className="grid gap-1">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_1fr] gap-4 text-sm font-medium text-muted-foreground pb-2 border-b">
                  <span>Key</span>
                  <span>Value</span>
                </div>
                {/* Table rows */}
                {Object.entries(settings.env).map(([key, value]) => (
                  <div
                    key={key}
                    className={cn(
                      "grid grid-cols-[1fr_1fr] gap-4 text-sm py-2 border-b border-border/50 last:border-b-0",
                    )}
                  >
                    <span className="font-mono truncate">{key}</span>
                    <span
                      className={cn(
                        "truncate",
                        value === "****" && "text-muted-foreground italic",
                      )}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No environment variables configured
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
