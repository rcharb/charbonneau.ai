const { Balance } = require('~/db/models');
const { findUser } = require('~/models');

async function balanceController(req, res) {
  const balanceData = await Balance.findOne(
    { user: req.user.id },
    '-_id tokenCredits balanceType trialCredits subscriptionCredits subscriptionPlan subscriptionPeriodStart subscriptionPeriodEnd autoRefillEnabled refillIntervalValue refillIntervalUnit lastRefill refillAmount',
  ).lean();

  if (!balanceData) {
    return res.status(404).json({ error: 'Balance not found' });
  }

  // Get user subscription info as well (in case balance wasn't updated but user was)
  const user = await findUser(
    { _id: req.user.id },
    'subscriptionStatus subscriptionPlan stripeSubscriptionId',
  );

  // If auto-refill is not enabled, remove auto-refill related fields from the response
  if (!balanceData.autoRefillEnabled) {
    delete balanceData.refillIntervalValue;
    delete balanceData.refillIntervalUnit;
    delete balanceData.lastRefill;
    delete balanceData.refillAmount;
  }

  const hasSubscriptionInBalance =
    balanceData.balanceType === 'subscription' && balanceData.subscriptionPlan;
  const hasSubscriptionInUser = user?.subscriptionStatus === 'active' && user?.subscriptionPlan;
  const hasSubscriptionByAutoRefill = balanceData.autoRefillEnabled && balanceData.refillAmount > 0;

  const hasActiveSubscription = !!(
    hasSubscriptionInBalance ||
    hasSubscriptionInUser ||
    hasSubscriptionByAutoRefill
  );

  // Determine the subscription plan (prefer balance, fallback to user)
  const subscriptionPlan = balanceData.subscriptionPlan || user?.subscriptionPlan || null;

  // A user is a trial user if they don't have an active subscription
  const isTrialUser = !hasActiveSubscription;
  const isTrialDepleted = isTrialUser && balanceData.tokenCredits <= 0;

  res.status(200).json({
    ...balanceData,
    subscriptionPlan,
    isTrialUser,
    isTrialDepleted,
    hasActiveSubscription,
  });
}

module.exports = balanceController;
