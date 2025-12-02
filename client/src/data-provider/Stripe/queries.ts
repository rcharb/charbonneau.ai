import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type { UseQueryResult } from '@tanstack/react-query';
import type { SessionStatusResponse } from './mutation';

export interface MySubscriptionResponse {
  hasSubscription: boolean;
  subscriptionPlan: 'standard' | 'plus' | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

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

/**
 * Get current user's subscription info
 */
export const useMySubscriptionQuery = (
  enabled = true,
): UseQueryResult<MySubscriptionResponse, Error> => {
  return useQuery({
    queryKey: ['stripe', 'my-subscription'],
    queryFn: async () => {
      const response = await axios.get<MySubscriptionResponse>('/api/stripe/my-subscription');
      return response.data;
    },
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
