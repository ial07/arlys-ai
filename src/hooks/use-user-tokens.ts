import { useQuery } from '@tanstack/react-query';

interface TokenData {
  tokens: number;
  email: string;
  name: string | null;
}

const fetchTokens = async (): Promise<TokenData> => {
  const res = await fetch('/api/user/tokens');
  if (!res.ok) {
    throw new Error('Failed to fetch tokens');
  }
  return res.json();
};

export function useUserTokens() {
  return useQuery({
    queryKey: ['user-tokens'],
    queryFn: fetchTokens,
    // Refresh every 30 seconds
    refetchInterval: 30000,
  });
}
