"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { AppSidebar, MobileSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHome } from "@/components/dashboard/dashboard-home";
import { LandingHero } from "@/components/landing/landing-hero";
import { SessionHeader } from "@/components/chat/session-header";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { FileExplorer } from "@/components/chat/file-explorer";
import {
  useSessionData,
  useCreateProject,
  useFixSession,
} from "@/hooks/use-session";
import { useChat } from "@/hooks/use-chat";
import { useUser } from "@/hooks/use-user";
import { TosModal } from "@/components/modals/tos-modal";
import { AlertModal } from "@/components/modals/alert-modal";

export default function HomePage() {
  const { data: authSession, status: authStatus } = useSession();

  // Local State
  const [currentView, setCurrentView] = useState<"home" | "session">("home");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "files" | "preview">(
    "chat"
  );
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
  });
  const [selectedFile, setSelectedFile] = useState<{
    id: string;
    path: string;
    content: string;
  } | null>(null);
  const [initialMessages, setInitialMessages] = useState<any[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Welcome to AI Agent Builder! 🚀\n\nDescribe the application you want to build, and I'll generate it for you step by step.",
    },
  ]);

  // Hooks
  const { data: sessionData, isLoading: isSessionLoading } =
    useSessionData(activeSessionId);
  const createProjectMutation = useCreateProject();
  const chatMutation = useChat();
  const { user, acceptTos, isAccepting } = useUser();

  const session = sessionData?.session;

  // Show ToS modal if user loaded and not accepted
  const showTosModal = !!user && !user.tosAcceptedAt;

  // Handlers
  const handleHomeClick = () => {
    setCurrentView("home");
    setActiveSessionId(null);
  };

  const handleNewProject = () => {
    setCurrentView("home");
    setActiveSessionId(null);
    setInitialMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Welcome to AI Agent Builder! 🚀\n\nDescribe the application you want to build, and I'll generate it for you step by step.",
      },
    ]);
  };

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setCurrentView("session");
    setActiveTab("chat");
  };

  const handleCreateProject = async (goal: string) => {
    // Optimistic UI update
    setInitialMessages((prev) => [
      ...prev,
      { id: "user-goal", role: "user", content: goal },
    ]);

    try {
      const newSession = await createProjectMutation.mutateAsync(goal);
      setActiveSessionId(newSession.id);
      setCurrentView("session");
    } catch (error: any) {
      // Handle known errors
      if (error?.response?.status === 429) {
        // Pending session or rate limit error
        const errorMessage =
          error?.response?.data?.error ||
          "You already have a pending project running. Please wait.";

        setAlertState({
          isOpen: true,
          title: "Action Blocked",
          message: errorMessage,
        });

        // Rollback optimistic update
        setInitialMessages((prev) => prev.filter((m) => m.id !== "user-goal"));
        return;
      }

      if (error.message === "Insufficient tokens") {
        window.location.href = "/pricing";
      }
      console.error(error);
    }
  };

  const handleSendMessage = (content: string) => {
    if (!activeSessionId) {
      // If no session, create one
      handleCreateProject(content);
      return;
    }

    chatMutation.mutate({ sessionId: activeSessionId, content });
  };

  const handleDownload = () => {
    if (!activeSessionId) return;
    window.open(`/api/sessions/${activeSessionId}/download`, "_blank");
  };

  const fixMutation = useFixSession();

  const handleFixError = () => {
    if (!activeSessionId) return;
    fixMutation.mutate(activeSessionId);
    setActiveTab("chat");
  };

  useEffect(() => {
    if (authStatus === "authenticated") {
      const pendingPrompt = localStorage.getItem("pendingPrompt");
      if (pendingPrompt) {
        localStorage.removeItem("pendingPrompt");
        handleCreateProject(pendingPrompt);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus]);

  // Render Logic
  if (authStatus === "loading")
    return (
      <div className="h-screen bg-black flex items-center justify-center text-white">
        Loading...
      </div>
    );
  if (authStatus === "unauthenticated") return <LandingHero />;

  // Messages: combine initial welcome with session messages
  const displayMessages =
    activeSessionId && session?.messages ? session.messages : initialMessages;

  return (
    <div className="flex h-screen w-full bg-[#09090b] text-white overflow-hidden">
      <MobileSidebar
        onSelectSession={handleSelectSession}
        onNewProject={handleNewProject}
        onHomeClick={handleHomeClick}
        activeSessionId={activeSessionId}
        currentView={currentView}
        userName={authSession?.user?.name}
      />
      <AppSidebar
        onSelectSession={handleSelectSession}
        onNewProject={handleNewProject}
        onHomeClick={handleHomeClick}
        activeSessionId={activeSessionId}
        currentView={currentView}
        userName={authSession?.user?.name}
      />

      <AlertModal
        isOpen={alertState.isOpen}
        onClose={() => setAlertState((prev) => ({ ...prev, isOpen: false }))}
        title={alertState.title}
        message={alertState.message}
      />
      <TosModal
        isOpen={showTosModal}
        onAccept={() => acceptTos()}
        isAccepting={isAccepting}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-[#0c0c0c] sm:rounded-tl-2xl sm:border-t sm:border-l sm:border-white/5 sm:my-2 sm:mr-2 overflow-hidden relative shadow-2xl">
        {currentView === "home" || !activeSessionId ? (
          <DashboardHome
            userEmail={authSession?.user?.email}
            userName={authSession?.user?.name}
            onCreateProject={handleCreateProject}
            isLoading={createProjectMutation.isPending}
          />
        ) : (
          <>
            <SessionHeader
              projectName={session?.projectName}
              goal={session?.goal || "New Project"}
              status={session?.status || "initializing"}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onDownload={handleDownload}
              previewUrl={session?.previewUrl}
              totalTasks={session?.totalTasks || 0}
              completedTasks={session?.completedTasks || 0}
              onFixError={handleFixError}
            />

            {activeTab === "chat" ? (
              <>
                <MessageList
                  messages={displayMessages}
                  userEmail={authSession?.user?.email}
                  sessionStatus={session?.status}
                  sessionTasks={{
                    completed: session?.completedTasks || 0,
                    total: session?.totalTasks || 0,
                  }}
                  isLoading={
                    createProjectMutation.isPending || chatMutation.isPending
                  }
                />
                <ChatInput
                  onSend={handleSendMessage}
                  disabled={
                    createProjectMutation.isPending ||
                    session?.status === "executing"
                  }
                />
              </>
            ) : activeTab === "files" ? (
              <FileExplorer
                files={session?.generatedFiles}
                selectedFile={selectedFile}
                onSelectFile={setSelectedFile}
              />
            ) : (
              // Live Preview Tab
              <div className="flex-1 w-full bg-white relative">
                {session?.previewUrl ? (
                  <iframe
                    src={session.previewUrl}
                    className="w-full h-full border-none"
                    title="Live Preview"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Preview not available
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
