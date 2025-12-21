"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { AppSidebar, MobileSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHome } from "@/components/dashboard/dashboard-home";
import { LandingHero } from "@/components/landing/landing-hero";
import { SessionHeader } from "@/components/chat/session-header";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { FileExplorer } from "@/components/chat/file-explorer";
import { useSessionData, useCreateProject } from "@/hooks/use-session";
import { useChat } from "@/hooks/use-chat";

export default function HomePage() {
  const { data: authSession, status: authStatus } = useSession();

  // Local State
  const [currentView, setCurrentView] = useState<"home" | "session">("home");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "files">("chat");
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

  const session = sessionData?.session;

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
      if (error.message === "Insufficient tokens") {
        // Handle token error (redirect logic could go here or in hook)
        // For now, let's just alert or let the user see the notification
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
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans">
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

      <div className="flex-1 flex flex-col min-w-0 bg-[#0c0c0c] sm:rounded-tl-2xl sm:border-t sm:border-l sm:border-white/5 sm:my-2 sm:mr-2 overflow-hidden relative shadow-2xl">
        {currentView === "home" || !activeSessionId ? (
          <DashboardHome
            userEmail={authSession?.user?.email}
            userName={authSession?.user?.name}
            onCreateProject={handleCreateProject}
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
            ) : (
              <FileExplorer
                files={session?.generatedFiles}
                selectedFile={selectedFile}
                onSelectFile={setSelectedFile}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
