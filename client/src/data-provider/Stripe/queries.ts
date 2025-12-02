import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type { UseQueryResult } from '@tanstack/react-query';
import type { SessionStatusResponse } from './mutation';

/**
 * Get Stripe session status
 */
export const useStripeSessionStatusQuery = (
  sessionId: string | null,
  enabled = true,
): UseQueryResult<SessionStatusResponse, Error> => {
  return useQuery({
    queryKey: ['stripe', 'session-status', sessionId],
    queryFn: async () => {
      const response = await axios.get<SessionStatusResponse>('/api/stripe/session-status', {
        params: { session_id: sessionId },
      });
      return response.data;
    },
    enabled: enabled && !!sessionId,
    retry: false,
  });
};
