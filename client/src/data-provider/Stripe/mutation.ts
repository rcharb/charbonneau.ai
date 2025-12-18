import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import type { UseMutationResult } from '@tanstack/react-query';

export interface SessionStatusResponse {
  status: string;
  payment_status: string;
  payment_intent_id: string | null;
  payment_intent_status: string | null;
}

export interface CreatePortalSessionResponse {
  url: string;
}

/**
 * Create a Stripe Customer Portal session
 * Returns URL to redirect user to manage billing, payment methods, and subscriptions
 */
export const useCreatePortalSessionMutation = (): UseMutationResult<
  CreatePortalSessionResponse,
  Error,
  void
> => {
  return useMutation({
    mutationFn: async () => {
      const response = await axios.post<CreatePortalSessionResponse>(
        '/api/stripe/create-portal-session',
      );
      return response.data;
    },
  });
};
