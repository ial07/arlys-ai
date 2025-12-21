import { useMutation, useQueryClient } from '@tanstack/react-query';

interface SendMessageVariables {
  sessionId: string;
  content: string;
}

const sendMessage = async ({ sessionId, content }: SendMessageVariables) => {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message: content }),
  });
  
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
};

export function useChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendMessage,
    onMutate: async ({ sessionId, content }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['session', sessionId] });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(['session', sessionId]);

      // Optimistic update
      queryClient.setQueryData(['session', sessionId], (old: any) => {
        if (!old?.session) return old;
        return {
          ...old,
          session: {
            ...old.session,
            messages: [
              ...(old.session.messages || []),
              {
                id: 'temp-' + Date.now(),
                role: 'user',
                content,
                timestamp: new Date().toISOString(),
              },
            ],
          },
        };
      });

      return { previousData };
    },
    onError: (err, newTodo, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['session', newTodo.sessionId], context.previousData);
      }
    },
    onSuccess: (data, variables) => {
        // Invalidate to get the assistant's response and real ID
        queryClient.invalidateQueries({ queryKey: ['session', variables.sessionId] });
    },
  });
}
