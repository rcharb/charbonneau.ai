const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-11-17.clover',
});
const { requireJwtAuth } = require('~/server/middleware');
const { logger } = require('~/config');

const router = express.Router();

// Price IDs should be set in environment variables
// Format: STRIPE_PRICE_STANDARD_MONTHLY, STRIPE_PRICE_STANDARD_YEARLY, etc.
const getPriceId = (plan, period) => {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${period.toUpperCase()}`;
  return process.env[key];
};

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

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: priceId,
        },
      ],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        userId: req.user?.id?.toString() || '',
        plan,
        period,
      },
    });

    await stripe.subscriptions.update(subscription.id, {
      default_payment_method: paymentMethodId,
    });

    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    let clientSecret = null;
    let finalSubscriptionStatus = subscription.status;
    const invoiceId =
      typeof subscription.latest_invoice === 'string'
        ? subscription.latest_invoice
        : subscription.latest_invoice?.id;

    if (invoiceId) {
      let invoice = await stripe.invoices.retrieve(invoiceId, {
        expand: ['payment_intent'],
      });

      if (invoice.status === 'draft') {
        invoice = await stripe.invoices.finalizeInvoice(invoiceId, {
          expand: ['payment_intent'],
        });
      }

      if (invoice.payment_intent) {
        const paymentIntentId =
          typeof invoice.payment_intent === 'string'
            ? invoice.payment_intent
            : invoice.payment_intent.id;

        if (paymentIntentId) {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          clientSecret = paymentIntent.client_secret;
        }
      } else if (invoice.amount_due > 0 && invoice.status === 'open') {
        try {
          const paidInvoice = await stripe.invoices.pay(invoiceId, {
            payment_method: paymentMethodId,
            off_session: false,
          });

          if (paidInvoice.status === 'paid') {
            const updatedSubscription = await stripe.subscriptions.retrieve(subscription.id);
            finalSubscriptionStatus = updatedSubscription.status;

            if (updatedSubscription.status !== 'active') {
              const paymentIntent = await stripe.paymentIntents.create({
                amount: invoice.amount_due,
                currency: invoice.currency || 'usd',
                customer: customerId,
                payment_method: paymentMethodId,
                confirmation_method: 'manual',
                confirm: false,
                metadata: {
                  invoice_id: invoiceId,
                  subscription_id: subscription.id,
                  userId: req.user?.id?.toString() || '',
                  plan,
                  period,
                },
              });
              clientSecret = paymentIntent.client_secret;
            }
          }
        } catch (payError) {
          if (payError.payment_intent) {
            const paymentIntent =
              typeof payError.payment_intent === 'string'
                ? await stripe.paymentIntents.retrieve(payError.payment_intent)
                : payError.payment_intent;
            clientSecret = paymentIntent.client_secret;
          } else if (payError.code === 'invoice_payment_intent_requires_action') {
            const paymentIntentId = payError.payment_intent?.id || payError.payment_intent;
            if (paymentIntentId) {
              const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
              clientSecret = paymentIntent.client_secret;
            }
          } else {
            const paymentIntent = await stripe.paymentIntents.create({
              amount: invoice.amount_due,
              currency: invoice.currency || 'usd',
              customer: customerId,
              payment_method: paymentMethodId,
              confirmation_method: 'manual',
              confirm: false,
              metadata: {
                invoice_id: invoiceId,
                subscription_id: subscription.id,
                userId: req.user?.id?.toString() || '',
                plan,
                period,
              },
            });
            clientSecret = paymentIntent.client_secret;
          }
        }
      }
    }

    res.json({
      subscriptionId: subscription.id,
      clientSecret: clientSecret,
      status: finalSubscriptionStatus,
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

module.exports = router;
