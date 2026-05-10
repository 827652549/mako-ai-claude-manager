"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  LayoutDashboard,
  Settings,
  Bot,
  Puzzle,
  FileText,
  FileCode,
  Menu,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Settings", icon: Settings, href: "/settings" },
  { label: "Agents", icon: Bot, href: "/agents" },
  { label: "Skills", icon: Puzzle, href: "/skills" },
  { label: "Rules", icon: FileText, href: "/rules" },
  { label: "CLAUDE.md", icon: FileCode, href: "/claude-md" },
  { label: "Changelog", icon: History, href: "/changelog" },
];

/** SidebarContent - shared navigation list for desktop and mobile */
function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="p-4">
        <h2 className="text-lg font-semibold">Claude Code</h2>
        <p className="text-sm text-muted-foreground">Manager</p>
      </div>
      <Separator />
      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavClick}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
      <Separator />
      <div className="p-4">
        <ThemeToggle />
      </div>
    </div>
  );
}

/** AppSidebar - fixed sidebar on desktop, Sheet drawer on mobile */
export function AppSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 border-r h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile hamburger menu */}
      <div className="md:hidden fixed top-0 left-0 z-40 p-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={(props) => (
              <Button {...props} variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            )}
          />
          <SheetContent side="left" className="w-60 p-0">
            <SidebarContent onNavClick={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
