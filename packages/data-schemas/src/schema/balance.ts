import { Schema } from 'mongoose';
import type * as t from '~/types';

const balanceSchema = new Schema<t.IBalance>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: true,
  },
  // 1000 tokenCredits = 1 mill ($0.001 USD)
  tokenCredits: {
    type: Number,
    default: 0,
  },
  // Balance type: 'trial' for new users, 'subscription' for paying users
  balanceType: {
    type: String,
    enum: ['trial', 'subscription'],
    default: 'trial',
  },
  // Separate tracking for analytics
  trialCredits: {
    type: Number,
    default: 0,
  },
  subscriptionCredits: {
    type: Number,
    default: 0,
  },
  // Subscription plan info
  subscriptionPlan: {
    type: String,
    enum: ['standard', 'plus', null],
    default: null,
  },
  subscriptionPeriodStart: {
    type: Date,
    default: null,
  },
  subscriptionPeriodEnd: {
    type: Date,
    default: null,
  },
  // Automatic refill settings
  autoRefillEnabled: {
    type: Boolean,
    default: false,
  },
  refillIntervalValue: {
    type: Number,
    default: 30,
  },
  refillIntervalUnit: {
    type: String,
    enum: ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months'],
    default: 'days',
  },
  lastRefill: {
    type: Date,
    default: Date.now,
  },
  // amount to add on each refill
  refillAmount: {
    type: Number,
    default: 0,
  },
  // For yearly subscriptions: day of month when subscription started (1-31)
  // Used to determine when to refill tokens monthly for yearly subscribers
  billingCycleDay: {
    type: Number,
    min: 1,
    max: 31,
    default: null,
  },
  // Track if this is a yearly subscription that needs monthly refills
  isYearlySubscription: {
    type: Boolean,
    default: false,
  },
  // Store original subscription start date for timezone-aware calculations
  subscriptionStartDate: {
    type: Date,
    default: null,
  },
  // Track last refill month to prevent duplicate refills
  lastRefillMonth: {
    type: Number, // 1-12
    min: 1,
    max: 12,
    default: null,
  },
  // Track last refill year to prevent duplicate refills
  lastRefillYear: {
    type: Number,
    default: null,
  },
});

export default balanceSchema;
