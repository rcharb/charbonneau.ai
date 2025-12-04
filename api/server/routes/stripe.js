const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-11-17.clover',
});
const { requireJwtAuth } = require('~/server/middleware');
const { Balance } = require('~/db/models');
const { findUser, updateUser } = require('~/models');
const { logger } = require('~/config');

const router = express.Router();

// Price IDs should be set in environment variables
// Format: STRIPE_PRICE_STANDARD_MONTHLY, STRIPE_PRICE_STANDARD_YEARLY, etc.
const getPriceId = (plan, period) => {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${period.toUpperCase()}`;
  return process.env[key];
};

// Token amounts per plan (configurable via environment variables)
const getTokensForPlan = (plan) => {
  const tokenAmounts = {
    standard: parseInt(process.env.SUBSCRIPTION_STANDARD_TOKENS || '300000', 10),
    plus: parseInt(process.env.SUBSCRIPTION_PLUS_TOKENS || '750000', 10),
  };
  return tokenAmounts[plan] || 0;
};

// Helper to get plan from price ID
const getPlanFromPriceId = (priceId) => {
  const standardMonthly = process.env.STRIPE_PRICE_STANDARD_MONTHLY;
  const standardYearly = process.env.STRIPE_PRICE_STANDARD_YEARLY;
  const plusMonthly = process.env.STRIPE_PRICE_PLUS_MONTHLY;
  const plusYearly = process.env.STRIPE_PRICE_PLUS_YEARLY;

  if (priceId === standardMonthly || priceId === standardYearly) {
    return 'standard';
  }
  if (priceId === plusMonthly || priceId === plusYearly) {
    return 'plus';
  }
  return null;
};

// Helper to check if price ID is for a yearly subscription
const isYearlySubscription = (priceId) => {
  const standardYearly = process.env.STRIPE_PRICE_STANDARD_YEARLY;
  const plusYearly = process.env.STRIPE_PRICE_PLUS_YEARLY;

  return priceId === standardYearly || priceId === plusYearly;
};

/**
 * Helper function to update user balance when subscription payment succeeds
 * This is used both synchronously (after immediate payment) and via webhooks
 */
async function updateBalanceForSubscription(userId, subscription) {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const plan = getPlanFromPriceId(priceId) || subscription.metadata?.plan;
  const isYearly = isYearlySubscription(priceId);

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

router.post('/create-setup-intent', requireJwtAuth, async (req, res) => {
  try {
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'planId is required' });
    }

    // Parse planId to extract plan and period
    const [plan, period] = planId.split('-');

    if (!plan || !period) {
      return res.status(400).json({
        error: 'Invalid planId format. Expected format: "plan-period" (e.g., "standard-monthly")',
      });
    }

    const priceId = getPriceId(plan, period);
    if (!priceId) {
      logger.error(`Price ID not found for ${plan} ${period}`);
      return res.status(400).json({ error: 'Invalid subscription plan' });
    }

    // Create or retrieve customer
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: req.user?.email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: req.user?.email,
        metadata: {
          userId: req.user?.id?.toString() || '',
        },
      });
    }

    // Create Setup Intent for subscription
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
      metadata: {
        userId: req.user?.id?.toString() || '',
        plan,
        period,
        priceId,
      },
    });

    res.json({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
    });
  } catch (error) {
    logger.error('Stripe setup intent creation error:', error);
    res.status(500).json({ error: error.message || 'Failed to create setup intent' });
  }
});

router.post('/create-subscription', requireJwtAuth, async (req, res) => {
  try {
    const { setupIntentId, planId } = req.body;

    if (!setupIntentId || !planId) {
      return res.status(400).json({ error: 'setupIntentId and planId are required' });
    }

    // Retrieve the setup intent to get payment method
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

    if (setupIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Setup Intent not succeeded' });
    }

    const paymentMethodId = setupIntent.payment_method;
    if (!paymentMethodId || typeof paymentMethodId !== 'string') {
      return res.status(400).json({ error: 'Payment method not found' });
    }

    // Parse planId
    const [plan, period] = planId.split('-');
    const priceId = getPriceId(plan, period);

    if (!priceId) {
      return res.status(400).json({ error: 'Invalid subscription plan' });
    }

    // Get customer from setup intent
    const customerId = setupIntent.customer;
    if (!customerId || typeof customerId !== 'string') {
      return res.status(400).json({ error: 'Customer not found' });
    }

    // Attach payment method to customer (if not already attached)
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
    } catch (error) {
      // Payment method might already be attached, which is fine
      if (error.code !== 'resource_already_exists') {
        throw error;
      }
    }

    // Set the payment method as default for the customer
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Create subscription with the already-authorized payment method
    // Since the payment method was authorized via SetupIntent, Stripe will charge it immediately
    // Using 'error_if_incomplete' ensures the payment succeeds or fails immediately (no pending state)
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      payment_behavior: 'error_if_incomplete', // Charge immediately, fail if payment can't complete
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        userId: req.user?.id?.toString() || '',
        plan,
        period,
      },
    });

    // No client_secret needed - payment method was already authorized via SetupIntent
    // Subscription should be active or will have failed with error_if_incomplete

    // Update user with Stripe customer and subscription info
    const userUpdate = {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionPlan: plan,
      subscriptionStatus: subscription.status,
    };

    // Only set period end if it exists
    if (subscription.current_period_end) {
      userUpdate.subscriptionPeriodEnd = new Date(subscription.current_period_end * 1000);
    }

    await updateUser(req.user.id, userUpdate);

    // Check if payment succeeded immediately and update balance synchronously
    // This handles the case where payment completes before webhook arrives
    const invoiceId =
      typeof subscription.latest_invoice === 'string'
        ? subscription.latest_invoice
        : subscription.latest_invoice?.id;

    if (subscription.status === 'active' && invoiceId) {
      try {
        const invoice = await stripe.invoices.retrieve(invoiceId);

        // If invoice is paid, update balance immediately (synchronously)
        if (invoice.status === 'paid' && invoice.billing_reason === 'subscription_create') {
          await updateBalanceForSubscription(req.user.id, subscription);

          logger.info(
            `Subscription created and payment confirmed for user ${req.user.id}: balance updated (${plan} plan)`,
          );
        }
      } catch (invoiceError) {
        // If we can't retrieve invoice, that's okay - webhook will handle it
        logger.warn(
          `Could not retrieve invoice ${invoiceId} to update balance: ${invoiceError.message}`,
        );
      }
    }

    logger.info(
      `Subscription created for user ${req.user.id} with status: ${subscription.status} (${plan} plan). Payment charged automatically using pre-authorized payment method.`,
    );

    res.json({
      subscriptionId: subscription.id,
      status: subscription.status,
    });
  } catch (error) {
    logger.error('Stripe subscription creation error:', error);
    res.status(500).json({ error: error.message || 'Failed to create subscription' });
  }
});

router.get('/subscription-status', requireJwtAuth, async (req, res) => {
  try {
    const { subscription_id } = req.query;

    if (!subscription_id) {
      return res.status(400).json({ error: 'Subscription ID is required' });
    }

    const subscription = await stripe.subscriptions.retrieve(subscription_id);

    res.json({
      status: subscription.status,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
    });
  } catch (error) {
    logger.error('Stripe subscription status error:', error);
    res.status(500).json({
      error: error.message || 'Failed to retrieve subscription status',
    });
  }
});

// Get current user's subscription info
router.get('/my-subscription', requireJwtAuth, async (req, res) => {
  try {
    const user = await findUser({ _id: req.user.id });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user has a Stripe subscription ID, fetch current status
    if (user.stripeSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        return res.json({
          hasSubscription: true,
          subscriptionPlan: user.subscriptionPlan,
          subscriptionStatus: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });
      } catch (stripeError) {
        // Subscription may have been deleted in Stripe
        logger.warn('Could not retrieve subscription from Stripe:', stripeError.message);
      }
    }

    res.json({
      hasSubscription: false,
      subscriptionPlan: null,
      subscriptionStatus: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
  } catch (error) {
    logger.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription info' });
  }
});

// Cancel subscription at period end
router.post('/cancel-subscription', requireJwtAuth, async (req, res) => {
  try {
    const user = await findUser({ _id: req.user.id });

    if (!user || !user.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    res.json({
      success: true,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    });
  } catch (error) {
    logger.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Reactivate subscription (if canceled but not yet expired)
router.post('/reactivate-subscription', requireJwtAuth, async (req, res) => {
  try {
    const user = await findUser({ _id: req.user.id });

    if (!user || !user.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    res.json({
      success: true,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      status: subscription.status,
    });
  } catch (error) {
    logger.error('Error reactivating subscription:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
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
    console.log('user', user);
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
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        await handleSubscriptionUpdate(event.data.object);
        break;
      }

      case 'customer.subscription.deleted': {
        await handleSubscriptionDeleted(event.data.object);
        break;
      }

      case 'invoice.payment_succeeded': {
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      }

      case 'invoice.payment_failed': {
        await handleInvoicePaymentFailed(event.data.object);
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
 * Handle subscription created/updated events
 */
async function handleSubscriptionUpdate(subscription) {
  const customerId = subscription.customer;

  // Find user by Stripe customer ID
  const user = await findUser({ stripeCustomerId: customerId });
  if (!user) {
    // Try to find by metadata
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
    logger.warn(`No user found for Stripe customer: ${customerId}`);
    return;
  }

  await processSubscriptionUpdate(user._id.toString(), subscription);
}

/**
 * Process subscription update for a user
 */
async function processSubscriptionUpdate(userId, subscription) {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const plan = getPlanFromPriceId(priceId) || subscription.metadata?.plan;
  const isYearly = isYearlySubscription(priceId);

  const updateData = {
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    subscriptionPlan: plan,
  };

  // Only set period end if it exists (subscription must be active or trialing)
  if (subscription.current_period_end) {
    updateData.subscriptionPeriodEnd = new Date(subscription.current_period_end * 1000);
  }

  await updateUser(userId, updateData);

  // Don't update balance here - wait for invoice.payment_succeeded webhook
  // This ensures tokens are only granted after actual payment
  logger.info(
    `Updated subscription for user ${userId}: ${subscription.status}, plan: ${plan}, yearly: ${isYearly}. Balance will be updated upon payment confirmation.`,
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
  const user = await findUser({ stripeCustomerId: customerId });

  if (!user) {
    logger.warn(`No user found for invoice payment customer: ${customerId}`);
    return;
  }

  // Fetch subscription to get plan details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Check if this is the first invoice (new subscription) or a renewal
  const isRenewal = invoice.billing_reason === 'subscription_cycle';
  const isNewSubscription = invoice.billing_reason === 'subscription_create';

  if (isRenewal || isNewSubscription) {
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const plan = getPlanFromPriceId(priceId) || subscription.metadata?.plan;
    const isYearly = isYearlySubscription(priceId);

    if (!plan) {
      logger.warn(`Could not determine plan for subscription: ${subscriptionId}`);
      return;
    }

    // For yearly subscriptions:
    // - On creation: give initial tokens
    // - On renewal (yearly): give full year's worth of tokens
    // - Monthly refills are handled by the cron job
    const shouldAddTokens = isNewSubscription || (isRenewal && isYearly);

    if (shouldAddTokens) {
      // Use the helper function to update balance
      await updateBalanceForSubscription(user._id.toString(), subscription);
    }

    // Update user subscription status to active
    await updateUser(user._id.toString(), {
      subscriptionStatus: 'active',
    });

    logger.info(
      `${isRenewal ? 'Renewed' : 'Created'} subscription for user ${user._id} (${plan} ${isYearly ? 'yearly' : 'monthly'} plan) - balance updated via webhook`,
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
