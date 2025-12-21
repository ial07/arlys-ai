import { signOut } from "next-auth/react";
import { SessionList } from "@/components/sidebar/session-list";
import { useUserTokens } from "@/hooks/use-user-tokens";
import Image from "next/image";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  onSelectSession: (sessionId: string) => void;
  onNewProject: () => void;
  onHomeClick: () => void;
  activeSessionId?: string | null;
  currentView: "home" | "session";
  userName?: string | null;
  className?: string;
}

function SidebarContent({
  onSelectSession,
  onNewProject,
  onHomeClick,
  activeSessionId,
  currentView,
  userName,
  className,
}: AppSidebarProps) {
  const { data: tokenData } = useUserTokens();
  const tokenBalance = tokenData?.tokens ?? null;

  return (
    <div
      className={cn(
        "h-full flex flex-col bg-[#080808] border-r border-[#1e1e1e] text-gray-400 text-sm",
        className
      )}
    >
      {/* Header / Workspace Switcher */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 hover:bg-white/5 p-2 rounded-lg cursor-pointer transition-colors flex-1 overflow-hidden">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold">I</span>
          </div>
          <span className="font-medium text-gray-200 truncate">
            {userName ? `${userName}'s` : "My"} Workspace
          </span>
        </div>
        <button
          onClick={onHomeClick}
          className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors"
          title="Go Home"
        >
          <Image
            src="/assets/icon/logo-ai.png"
            alt="Logo"
            width={18}
            height={18}
          />
        </button>
      </div>

      {/* Main Nav */}
      <div className="px-3 pb-4">
        <button
          onClick={onHomeClick}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentView === "home" ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-gray-200"}`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Home</span>
        </button>
      </div>

      {/* Projects Section */}
      <div className="flex-1 overflow-y-auto px-3">
        <div className="mb-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Projects
        </div>

        <button
          onClick={onNewProject}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 hover:text-gray-200 transition-colors mb-2 text-blue-400 group"
        >
          <div className="w-5 h-5 rounded border border-dashed border-blue-500/50 flex items-center justify-center group-hover:border-blue-400 group-hover:bg-blue-500/10">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="group-hover:scale-110 transition-transform"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <span>New Project</span>
        </button>

        <SessionList
          onSelectSession={(id) => {
            onSelectSession(id);
          }}
          activeSessionId={activeSessionId || ""}
        />
      </div>

      {/* Bottom Profile */}
      <div className="p-3 border-t border-[#1e1e1e] mt-auto">
        <div className="bg-[#121212] rounded-xl p-1">
          <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-left group">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-gray-700 to-gray-600 flex items-center justify-center text-white text-xs font-bold">
              {userName ? userName.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-200 truncate">
                {userName || "User"}
              </div>
              <div className="text-xs text-gray-500 truncate flex items-center gap-2">
                <span
                  className={
                    tokenBalance !== null && tokenBalance < 100
                      ? "text-red-400"
                      : "text-green-400"
                  }
                >
                  🪙 {tokenBalance !== null ? tokenBalance : "..."} tokens
                </span>
              </div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Logout Trigger */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  signOut({ callbackUrl: "/" });
                }}
                className="p-1 hover:bg-red-500/10 hover:text-red-400 rounded cursor-pointer"
                title="Sign Out"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>
            </div>
          </button>

          <a
            href="/pricing"
            className="w-full mt-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-yellow-500/50 animate-pulse"></span>
            Buy Tokens
          </a>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar(props: AppSidebarProps) {
  return <SidebarContent {...props} className="hidden md:flex w-[280px]" />;
}

export function MobileSidebar(props: AppSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden fixed top-3 left-3 z-50 text-white"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="p-0 border-r-[#1e1e1e] w-[280px] bg-[#080808]"
      >
        <SidebarContent
          {...props}
          onSelectSession={(id) => {
            props.onSelectSession(id);
            setOpen(false);
          }}
          onNewProject={() => {
            props.onNewProject();
            setOpen(false); // Close on selection
          }}
          onHomeClick={() => {
            props.onHomeClick();
            setOpen(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
