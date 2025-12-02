import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import type { UseMutationResult } from '@tanstack/react-query';

export interface CreateSetupIntentRequest {
  planId: string;
}

export interface CreateSetupIntentResponse {
  clientSecret: string;
  setupIntentId: string;
}

export interface CreateSubscriptionRequest {
  setupIntentId: string;
  planId: string;
}

export interface CreateSubscriptionResponse {
  subscriptionId: string;
  clientSecret: string | null;
  status: string;
}

export interface SessionStatusResponse {
  status: string;
  payment_status: string;
  payment_intent_id: string | null;
  payment_intent_status: string | null;
}

/**
 * Create a Stripe Setup Intent
 */
export const useCreateSetupIntentMutation = (): UseMutationResult<
  CreateSetupIntentResponse,
  Error,
  CreateSetupIntentRequest
> => {
  return useMutation({
    mutationFn: async (data: CreateSetupIntentRequest) => {
      const response = await axios.post<CreateSetupIntentResponse>(
        '/api/stripe/create-setup-intent',
        data,
      );
      return response.data;
    },
  });
};

/**
 * Create a Stripe Subscription
 */
export const useCreateSubscriptionMutation = (): UseMutationResult<
  CreateSubscriptionResponse,
  Error,
  CreateSubscriptionRequest
> => {
  return useMutation({
    mutationFn: async (data: CreateSubscriptionRequest) => {
      const response = await axios.post<CreateSubscriptionResponse>(
        '/api/stripe/create-subscription',
        data,
      );
      return response.data;
    },
  });
};
