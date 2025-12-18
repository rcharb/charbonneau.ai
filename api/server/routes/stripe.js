const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-11-17.clover',
});
const { requireJwtAuth } = require('~/server/middleware');
const { Balance } = require('~/db/models');
const { findUser, updateUser } = require('~/models');
const { logger } = require('~/config');

const router = express.Router();
// Token amounts per plan (configurable via environment variables)
const getTokensForPlan = (plan) => {
  const tokenAmounts = {
    standard: parseInt(process.env.SUBSCRIPTION_STANDARD_TOKENS || '300000', 10),
    plus: parseInt(process.env.SUBSCRIPTION_PLUS_TOKENS || '750000', 10),
  };
  return tokenAmounts[plan] || 0;
};

// Helper to get plan from price ID
// Checks both CAD and USD price IDs, with fallback to Stripe API for pricing tables
const getPlanFromPriceId = async (priceId) => {
  if (!priceId) {
    return null;
  }

  const standardMonthlyCAD = process.env.STRIPE_PRICE_STANDARD_MONTHLY_CAD;
  const standardYearlyCAD = process.env.STRIPE_PRICE_STANDARD_YEARLY_CAD;
  const plusMonthlyCAD = process.env.STRIPE_PRICE_PLUS_MONTHLY_CAD;
  const plusYearlyCAD = process.env.STRIPE_PRICE_PLUS_YEARLY_CAD;
  const standardMonthlyUSD = process.env.STRIPE_PRICE_STANDARD_MONTHLY_USD;
  const standardYearlyUSD = process.env.STRIPE_PRICE_STANDARD_YEARLY_USD;
  const plusMonthlyUSD = process.env.STRIPE_PRICE_PLUS_MONTHLY_USD;
  const plusYearlyUSD = process.env.STRIPE_PRICE_PLUS_YEARLY_USD;

  // Check against configured price IDs first
  if (
    priceId === standardMonthlyCAD ||
    priceId === standardYearlyCAD ||
    priceId === standardMonthlyUSD ||
    priceId === standardYearlyUSD
  ) {
    return 'standard';
  }
  if (
    priceId === plusMonthlyCAD ||
    priceId === plusYearlyCAD ||
    priceId === plusMonthlyUSD ||
    priceId === plusYearlyUSD
  ) {
    return 'plus';
  }

  // Fallback: Fetch price from Stripe API for pricing table price IDs
  // This handles cases where pricing tables use price IDs not in env vars
  try {
    const price = await stripe.prices.retrieve(priceId);
    const amount = price.unit_amount; // Amount in cents
    const isRecurring = price.recurring !== null;
    const interval = isRecurring ? price.recurring.interval : null;

    // Determine plan based on price amount
    // Standard monthly: typically $25-30 USD (2500-3000 cents) or $30 CAD (3000 cents)
    // Plus monthly: typically $42-50 USD (4200-5000 cents) or $50 CAD (5000 cents)
    // Standard yearly: typically $250-300 USD (25000-30000 cents) or $300 CAD (30000 cents)
    // Plus yearly: typically $420-500 USD (42000-50000 cents) or $500 CAD (50000 cents)

    // Plus plan thresholds (higher amounts)
    if (interval === 'month' && amount >= 4200) {
      return 'plus';
    } else if (interval === 'year' && amount >= 42000) {
      return 'plus';
    } else if (amount >= 4200) {
      // Fallback: if amount is high enough, assume plus
      return 'plus';
    }

    // Standard plan thresholds (lower amounts)
    if (interval === 'month' && amount >= 2500 && amount < 4200) {
      return 'standard';
    } else if (interval === 'year' && amount >= 25000 && amount < 42000) {
      return 'standard';
    } else if (amount >= 2500 && amount < 4200) {
      // Fallback: if amount is in standard range, assume standard
      return 'standard';
    }

    logger.warn(`Could not determine plan from price amount: ${amount} cents for price ${priceId}`);
    return null;
  } catch (error) {
    logger.error(`Error retrieving price ${priceId} from Stripe:`, error);
    return null;
  }
};

// Helper to check if price ID is for a yearly subscription
const isYearlySubscription = async (priceId) => {
  if (!priceId) {
    return false;
  }

  const standardYearlyCAD = process.env.STRIPE_PRICE_STANDARD_YEARLY_CAD;
  const plusYearlyCAD = process.env.STRIPE_PRICE_PLUS_YEARLY_CAD;
  const standardYearlyUSD = process.env.STRIPE_PRICE_STANDARD_YEARLY_USD;
  const plusYearlyUSD = process.env.STRIPE_PRICE_PLUS_YEARLY_USD;

  // Check against configured price IDs first
  if (
    priceId === standardYearlyCAD ||
    priceId === plusYearlyCAD ||
    priceId === standardYearlyUSD ||
    priceId === plusYearlyUSD
  ) {
    return true;
  }

  // Fallback: Check via Stripe API for pricing table price IDs
  try {
    const price = await stripe.prices.retrieve(priceId);
    return price.recurring?.interval === 'year';
  } catch (error) {
    logger.error(`Error retrieving price ${priceId} to check interval:`, error);
    return false;
  }
};

/**
 * Helper function to update user balance when subscription payment succeeds
 * This is used both synchronously (after immediate payment) and via webhooks
 */
async function updateBalanceForSubscription(userId, subscription) {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const plan = (await getPlanFromPriceId(priceId)) || subscription.metadata?.plan;
  const isYearly = await isYearlySubscription(priceId);

  if (!plan) {
    logger.warn(`Could not determine plan for subscription: ${subscription.id}`);
    return;
  }

  const tokenAmount = getTokensForPlan(plan);
  const now = new Date();

  // Build complete balance update with all fields populated
  const balanceUpdate = {
    $set: {
      balanceType: 'subscription',
      subscriptionPlan: plan,
      autoRefillEnabled: true,
      refillIntervalValue: 1,
      refillIntervalUnit: 'months',
      refillAmount: tokenAmount,
      lastRefill: now,
      isYearlySubscription: isYearly,
      tokenCredits: tokenAmount,
      subscriptionCredits: tokenAmount,
    },
  };

  // Populate all date fields from the subscription
  if (subscription.current_period_start) {
    const startDate = new Date(subscription.current_period_start * 1000);
    balanceUpdate.$set.subscriptionPeriodStart = startDate;
    balanceUpdate.$set.subscriptionStartDate = startDate;
    balanceUpdate.$set.billingCycleDay = startDate.getUTCDate();
  }

  if (subscription.current_period_end) {
    balanceUpdate.$set.subscriptionPeriodEnd = new Date(subscription.current_period_end * 1000);
  }

  // For yearly subscriptions, track monthly refills
  if (isYearly && subscription.current_period_start) {
    const startDate = new Date(subscription.current_period_start * 1000);
    // For new subscriptions, update the refill tracking
    // This marks that they've received tokens for this month
    balanceUpdate.$set.lastRefillMonth = startDate.getUTCMonth() + 1; // 1-12
    balanceUpdate.$set.lastRefillYear = startDate.getUTCFullYear();
  }

  await Balance.findOneAndUpdate({ user: userId }, balanceUpdate, { upsert: true });

  logger.info(
    `Updated balance for user ${userId}: ${tokenAmount} tokens (${plan} ${isYearly ? 'yearly' : 'monthly'} plan)`,
  );
}

/**
 * Get Stripe Checkout Session status
 * Used after redirect from Stripe Checkout to verify payment status
 */
router.get('/session-status', requireJwtAuth, async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['payment_intent'],
    });

    res.json({
      status: session.status,
      payment_status: session.payment_status,
      payment_intent_id: session.payment_intent?.id || null,
      payment_intent_status: session.payment_intent?.status || null,
    });
  } catch (error) {
    logger.error('Stripe session status error:', error);
    res.status(500).json({
      error: error.message || 'Failed to retrieve session status',
    });
  }
});

/**
 * Create Stripe Customer Portal session
 * Allows users to manage billing, update payment methods, and cancel subscriptions
 */
router.post('/create-portal-session', requireJwtAuth, async (req, res) => {
  try {
    const user = await findUser({ _id: req.user.id });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.stripeCustomerId) {
      return res.status(400).json({ error: 'No Stripe customer found for this account' });
    }

    // Create a portal session for the customer
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.DOMAIN_CLIENT || req.headers.origin}/c/new`,
    });

    res.json({
      url: portalSession.url,
    });
  } catch (error) {
    logger.error('Error creating portal session:', error);
    res.status(500).json({ error: 'Failed to create customer portal session' });
  }
});

/**
 * Stripe Webhook Handler
 * Handles subscription lifecycle events for automatic balance refills
 * Note: express.raw() middleware is applied in server/index.js for this route
 */
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET is not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    logger.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  logger.info(`Stripe webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        await handleSubscriptionUpdate(event.data.object);
        break;
      }

      case 'customer.subscription.deleted': {
        await handleSubscriptionDeleted(event.data.object);
        break;
      }

      case 'invoice.payment_succeeded':
      case 'invoice.paid': {
        // Both events indicate successful payment, handle them the same way
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      }

      case 'invoice.payment_failed': {
        await handleInvoicePaymentFailed(event.data.object);
        break;
      }

      case 'invoice_payment.paid': {
        // Legacy event name, handle same as invoice.payment_succeeded
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      }

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle checkout session completed
 * Links Stripe customer to user account when checkout completes via pricing table
 */
async function handleCheckoutSessionCompleted(session) {
  const customerId = session.customer;
  const customerEmail = session.customer_details?.email || session.customer_email;

  if (!customerId || !customerEmail) {
    logger.warn('Checkout session completed but missing customer ID or email', {
      sessionId: session.id,
    });
    return;
  }

  // Find user by email
  const user = await findUser({ email: customerEmail });
  if (!user) {
    logger.warn(`No user found for checkout session email: ${customerEmail}`);
    return;
  }

  // Link Stripe customer to user account if not already linked
  if (!user.stripeCustomerId) {
    await updateUser(user._id.toString(), {
      stripeCustomerId: customerId,
    });
    logger.info(`Linked Stripe customer ${customerId} to user ${user._id} from checkout session`);
  } else if (user.stripeCustomerId !== customerId) {
    logger.warn(
      `User ${user._id} already has different Stripe customer ID: ${user.stripeCustomerId} vs ${customerId}`,
    );
  }

  // If subscription was created, it will be handled by customer.subscription.created webhook
  // This handler just ensures the customer is linked to the user account
}

/**
 * Handle subscription created/updated events
 */
async function handleSubscriptionUpdate(subscription) {
  const customerId = subscription.customer;

  // Find user by Stripe customer ID
  let user = await findUser({ stripeCustomerId: customerId });

  if (!user) {
    // Try to find by metadata
    try {
      const customer = await stripe.customers.retrieve(customerId);
      const userId = customer.metadata?.userId;
      if (userId) {
        const userById = await findUser({ _id: userId });
        if (userById) {
          // Update user with stripeCustomerId for future lookups
          await updateUser(userId, { stripeCustomerId: customerId });
          await processSubscriptionUpdate(userById._id.toString(), subscription);
          return;
        }
      }

      // Fallback: try to find by email (for pricing table checkouts)
      if (customer.email) {
        user = await findUser({ email: customer.email });
        if (user) {
          // Link the customer ID for future lookups
          await updateUser(user._id.toString(), { stripeCustomerId: customerId });
          logger.info(`Linked Stripe customer ${customerId} to user ${user._id} via email lookup`);
        }
      }
    } catch (error) {
      logger.error(`Error retrieving customer ${customerId}:`, error);
    }
  }

  if (!user) {
    logger.warn(`No user found for Stripe customer: ${customerId}`);
    return;
  }

  await processSubscriptionUpdate(user._id.toString(), subscription);
}

/**
 * Process subscription update for a user
 * Handles subscription changes including cancellation/reactivation via Customer Portal
 */
async function processSubscriptionUpdate(userId, subscription) {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const plan = (await getPlanFromPriceId(priceId)) || subscription.metadata?.plan;
  const isYearly = await isYearlySubscription(priceId);

  // Get current user to check previous subscription state
  const user = await findUser({ _id: userId });
  if (!user) {
    logger.warn(`User not found for subscription update: ${userId}`);
    return;
  }

  // Check if this is a cancellation/reactivation via Customer Portal
  const cancelAtPeriodEnd = subscription.cancel_at_period_end;
  const wasScheduledForCancellation =
    user.subscriptionStatus === 'cancel_at_period_end' || user.subscriptionStatus === 'canceled';

  const updateData = {
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    subscriptionPlan: plan,
  };

  // Handle cancellation scheduled via Customer Portal
  // When user cancels via portal, cancel_at_period_end becomes true but status stays 'active'
  if (cancelAtPeriodEnd && subscription.status === 'active') {
    // User just canceled via Customer Portal - subscription is still active until period end
    updateData.subscriptionStatus = 'cancel_at_period_end';
    logger.info(`Subscription scheduled for cancellation at period end for user ${userId}`);
    // Keep auto-refill enabled until period end so they can use remaining time
    // The subscription.deleted webhook will disable it when it actually cancels
  }

  // Handle reactivation via Customer Portal
  // When user reactivates, cancel_at_period_end becomes false and status is 'active'
  if (!cancelAtPeriodEnd && subscription.status === 'active' && wasScheduledForCancellation) {
    // User reactivated a previously canceled subscription
    updateData.subscriptionStatus = 'active';
    logger.info(`Subscription reactivated for user ${userId}`);

    // Re-enable auto-refill
    await Balance.findOneAndUpdate(
      { user: userId },
      {
        $set: {
          autoRefillEnabled: true,
        },
      },
    );
  }

  // Only set period end if it exists (subscription must be active or trialing)
  if (subscription.current_period_end) {
    updateData.subscriptionPeriodEnd = new Date(subscription.current_period_end * 1000);
  }

  await updateUser(userId, updateData);

  // Don't update balance here - wait for invoice.payment_succeeded webhook
  // This ensures tokens are only granted after actual payment
  logger.info(
    `Updated subscription for user ${userId}: ${subscription.status}, plan: ${plan}, yearly: ${isYearly}, cancel_at_period_end: ${cancelAtPeriodEnd}. Balance will be updated upon payment confirmation.`,
  );
}

/**
 * Handle subscription deleted/canceled
 */
async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;

  const user = await findUser({ stripeCustomerId: customerId });
  if (!user) {
    logger.warn(`No user found for deleted subscription customer: ${customerId}`);
    return;
  }

  // Update user subscription status
  const updateData = {
    subscriptionStatus: 'canceled',
  };

  // Only set period end if it exists
  if (subscription.current_period_end) {
    updateData.subscriptionPeriodEnd = new Date(subscription.current_period_end * 1000);
  }

  await updateUser(user._id.toString(), updateData);

  // Stop auto-refill but keep current balance
  await Balance.findOneAndUpdate(
    { user: user._id },
    {
      $set: {
        autoRefillEnabled: false,
        // Keep balanceType as 'subscription' so they can use remaining credits
      },
    },
  );

  logger.info(`Subscription canceled for user ${user._id}`);
}

/**
 * Handle successful invoice payment (subscription renewal)
 * This is where we actually grant tokens after payment is confirmed
 */
async function handleInvoicePaymentSucceeded(invoice) {
  // Get subscription ID from either direct field or parent object (newer API)
  const subscriptionId = invoice.subscription || invoice.parent?.subscription_details?.subscription;

  // Only process subscription invoices
  if (!subscriptionId) {
    return;
  }

  const customerId = invoice.customer;

  // Try to find user by Stripe customer ID first
  let user = await findUser({ stripeCustomerId: customerId });

  // If not found, try to find by customer email (fallback for race conditions)
  if (!user) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      const customerEmail = customer.email;
      if (customerEmail) {
        user = await findUser({ email: customerEmail });
        if (user) {
          // Link the customer ID for future lookups
          await updateUser(user._id.toString(), {
            stripeCustomerId: customerId,
          });
          logger.info(
            `Linked Stripe customer ${customerId} to user ${user._id} via email lookup in invoice handler`,
          );
        }
      }
    } catch (error) {
      logger.error(`Error retrieving customer ${customerId} for email lookup:`, error);
    }
  }

  if (!user) {
    logger.warn(`No user found for invoice payment customer: ${customerId}`);
    return;
  }

  // Fetch subscription to get plan details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Check if this is the first invoice (new subscription) or a renewal
  const isRenewal = invoice.billing_reason === 'subscription_cycle';
  const isNewSubscription = invoice.billing_reason === 'subscription_create';

  logger.info(
    `Processing invoice payment for user ${user._id}, subscription: ${subscriptionId}, billing_reason: ${invoice.billing_reason}, isNewSubscription: ${isNewSubscription}, isRenewal: ${isRenewal}`,
  );

  if (isRenewal || isNewSubscription) {
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const plan = (await getPlanFromPriceId(priceId)) || subscription.metadata?.plan;
    const isYearly = await isYearlySubscription(priceId);

    if (!plan) {
      logger.warn(
        `Could not determine plan for subscription: ${subscriptionId}, priceId: ${priceId}`,
      );
      return;
    }

    // For yearly subscriptions:
    // - On creation: give initial tokens
    // - On renewal (yearly): give full year's worth of tokens
    // - Monthly refills are handled by the cron job
    const shouldAddTokens = isNewSubscription || (isRenewal && isYearly);

    logger.info(
      `Invoice payment details - plan: ${plan}, isYearly: ${isYearly}, shouldAddTokens: ${shouldAddTokens}`,
    );

    if (shouldAddTokens) {
      // Use the helper function to update balance
      logger.info(`Updating balance for user ${user._id} with subscription ${subscriptionId}`);
      await updateBalanceForSubscription(user._id.toString(), subscription);
      logger.info(`Balance updated successfully for user ${user._id}`);
    } else {
      logger.info(`Skipping balance update - tokens will be added via monthly refill cron job`);
    }

    // Update user subscription status to active
    await updateUser(user._id.toString(), {
      subscriptionStatus: 'active',
    });

    logger.info(
      `${isRenewal ? 'Renewed' : 'Created'} subscription for user ${user._id} (${plan} ${isYearly ? 'yearly' : 'monthly'} plan) - balance updated via webhook`,
    );
  } else {
    logger.info(
      `Skipping balance update - billing_reason ${invoice.billing_reason} is not subscription_create or subscription_cycle`,
    );
  }
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice) {
  if (!invoice.subscription) {
    return;
  }

  const customerId = invoice.customer;
  const user = await findUser({ stripeCustomerId: customerId });

  if (!user) {
    logger.warn(`No user found for failed invoice payment customer: ${customerId}`);
    return;
  }

  // Update subscription status to past_due
  await updateUser(user._id.toString(), {
    subscriptionStatus: 'past_due',
  });

  logger.warn(`Payment failed for user ${user._id}, subscription marked as past_due`);
}

module.exports = router;
