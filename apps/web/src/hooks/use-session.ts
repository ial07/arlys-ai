import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Session {
  id: string;
  goal: string;
  projectName?: string;
  status: string;
  totalTasks: number;
  completedTasks: number;
  generatedFiles?: any[];
  messages?: any[];
}

const fetchSession = async (sessionId: string) => {
  const res = await fetch(`/api/sessions/${sessionId}`);
  if (!res.ok) throw new Error("Failed to fetch session");
  return res.json();
};

const createSession = async (goal: string) => {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal }),
  });

  const data = await res.json();
  if (!res.ok) {
    // Check status code
    throw new Error(data.error || "Failed to create session");
  }
  return data.session;
};

export function useSessionData(sessionId: string | null) {
  return useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => fetchSession(sessionId!),
    enabled: !!sessionId,
    // Poll every 2 seconds if active, otherwise standard stale time
    refetchInterval: (query) => {
      const data = query.state.data as any; // Type assertion for now
      const status = data?.session?.status;
      if (
        status === "executing" ||
        status === "planning" ||
        status === "fixing"
      ) {
        return 2000;
      }
      return false;
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSession,
    onSuccess: (newSession) => {
      // Prefetch or set query data
      queryClient.setQueryData(["session", newSession.id], {
        session: newSession,
      });
    },
  });
}

// Fix session hook - triggers re-validation with self-healing
const fixSession = async (sessionId: string) => {
  const res = await fetch(`/api/sessions/${sessionId}/fix`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Fix failed");
  return res.json();
};

export function useFixSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fixSession,
    onMutate: async (sessionId) => {
      // Optimistic update: immediately set status to 'fixing'
      await queryClient.cancelQueries({ queryKey: ["session", sessionId] });

      const previousData = queryClient.getQueryData(["session", sessionId]);
      queryClient.setQueryData(["session", sessionId], (old: any) => ({
        ...old,
        session: { ...old?.session, status: "fixing" },
      }));

      return { previousData };
    },
    onError: (err, sessionId, context) => {
      // Rollback on error
      queryClient.setQueryData(["session", sessionId], context?.previousData);
    },
    onSettled: (data, error, sessionId) => {
      // Refetch after completion
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    },
  });
}
