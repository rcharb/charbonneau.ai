import { Document, Types } from 'mongoose';

export type BalanceType = 'trial' | 'subscription';

export interface IBalance extends Document {
  user: Types.ObjectId;
  tokenCredits: number;
  // Balance type tracking (trial vs subscription)
  balanceType: BalanceType;
  // Separate tracking for analytics
  trialCredits: number;
  subscriptionCredits: number;
  // Subscription info
  subscriptionPlan?: 'standard' | 'plus' | null;
  subscriptionPeriodStart?: Date | null;
  subscriptionPeriodEnd?: Date | null;
  // Automatic refill settings
  autoRefillEnabled: boolean;
  refillIntervalValue: number;
  refillIntervalUnit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  lastRefill: Date;
  refillAmount: number;
}
