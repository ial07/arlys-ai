import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
  if (!res.ok) throw new Error('Failed to fetch session');
  return res.json();
};

const createSession = async (goal: string) => {
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal }),
  });
  
  const data = await res.json();
  if (!res.ok) { // Check status code
    throw new Error(data.error || 'Failed to create session'); 
  }
  return data.session;
};

export function useSessionData(sessionId: string | null) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => fetchSession(sessionId!),
    enabled: !!sessionId,
    // Poll every 2 seconds if active, otherwise standard stale time
    refetchInterval: (query) => {
      const data = query.state.data as any; // Type assertion for now
      if (data?.session?.status === 'executing' || data?.session?.status === 'planning') {
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
      queryClient.setQueryData(['session', newSession.id], { session: newSession });
    },
  });
}
