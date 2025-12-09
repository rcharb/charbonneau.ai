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
  // For yearly subscriptions: day of month when subscription started (1-31)
  billingCycleDay?: number | null;
  // Track if this is a yearly subscription that needs monthly refills
  isYearlySubscription?: boolean;
  // Store original subscription start date for timezone-aware calculations
  subscriptionStartDate?: Date | null;
  // Track last refill month (1-12) to prevent duplicate refills
  lastRefillMonth?: number | null;
  // Track last refill year to prevent duplicate refills
  lastRefillYear?: number | null;
}
