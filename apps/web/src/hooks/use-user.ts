import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface UserData {
  id: string;
  email: string;
  name: string | null;
  tokens: number;
  tosAcceptedAt: string | null;
  buildSuccessCount?: number;
  buildFailureCount?: number;
}

async function fetchUser() {
  const res = await fetch("/api/user");
  if (!res.ok) throw new Error("Failed to fetch user");
  const data = await res.json();
  return data.user as UserData;
}

async function acceptToS() {
  const res = await fetch("/api/user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "acceptToS" }),
  });
  if (!res.ok) throw new Error("Failed to accept ToS");
  return res.json();
}

export function useUser() {
  const queryClient = useQueryClient();

  const userQuery = useQuery({
    queryKey: ["user"],
    queryFn: fetchUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const acceptTosMutation = useMutation({
    mutationFn: acceptToS,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });

  return {
    user: userQuery.data,
    isLoading: userQuery.isLoading,
    isError: userQuery.isError,
    acceptTos: acceptTosMutation.mutate,
    isAccepting: acceptTosMutation.isPending,
  };
}
