import React from 'react';
import { useGetStartupConfig, useGetUserBalance } from '~/data-provider';
import { useAuthContext, useLocalize } from '~/hooks';
import SubscriptionStatus from './SubscriptionStatus';
import TokenCreditsItem from './TokenCreditsItem';
import AutoRefillSettings from './AutoRefillSettings';

interface BalanceProps {
  onClose?: () => void;
}

function Balance({ onClose }: BalanceProps) {
  const localize = useLocalize();
  const { isAuthenticated } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();

  const balanceQuery = useGetUserBalance({
    enabled: !!isAuthenticated && !!startupConfig?.balance?.enabled,
  });
  const balanceData = balanceQuery.data;

  // Pull out all the fields from balance response
  const tokenCredits = balanceData?.tokenCredits ?? 0;
  const autoRefillEnabled = balanceData?.autoRefillEnabled ?? false;
  const lastRefill = balanceData?.lastRefill;
  const refillAmount = balanceData?.refillAmount;
  const refillIntervalUnit = balanceData?.refillIntervalUnit;
  const refillIntervalValue = balanceData?.refillIntervalValue;

  // Subscription-related fields from balance controller
  const isTrialUser = balanceData?.isTrialUser ?? true;
  const isTrialDepleted = balanceData?.isTrialDepleted ?? false;
  const hasActiveSubscription = balanceData?.hasActiveSubscription ?? false;
  const subscriptionPlan = balanceData?.subscriptionPlan ?? null;
  const subscriptionPeriodEnd = balanceData?.subscriptionPeriodEnd ?? null;

  // Infer balanceType from hasActiveSubscription if not provided
  const balanceType =
    balanceData?.balanceType ?? (hasActiveSubscription ? 'subscription' : 'trial');

  // Infer subscription plan from refillAmount if not set but subscription is active
  const getInferredPlan = (): 'standard' | 'plus' | null => {
    if (subscriptionPlan) return subscriptionPlan;
    if (hasActiveSubscription && refillAmount) {
      return refillAmount >= 750000 ? 'plus' : 'standard';
    }
    return null;
  };
  const inferredPlan = getInferredPlan();

  // Get subscription status from user data (if available via balance response)
  const subscriptionStatus = hasActiveSubscription ? 'active' : null;

  // Check that all auto-refill props are present
  const hasValidRefillSettings =
    lastRefill !== undefined &&
    refillAmount !== undefined &&
    refillIntervalUnit !== undefined &&
    refillIntervalValue !== undefined;

  return (
    <div className="flex flex-col gap-4 p-4 text-sm text-text-primary">
      {/* Subscription Status Section */}
      <SubscriptionStatus
        isTrialUser={isTrialUser}
        isTrialDepleted={isTrialDepleted}
        hasActiveSubscription={hasActiveSubscription}
        subscriptionPlan={inferredPlan}
        subscriptionPeriodEnd={subscriptionPeriodEnd}
        subscriptionStatus={subscriptionStatus}
        onClose={onClose}
      />

      {/* Divider */}
      <div className="border-t border-gray-200 dark:border-gray-700" />

      {/* Token credits display */}
      <TokenCreditsItem
        tokenCredits={tokenCredits}
        balanceType={balanceType}
        subscriptionPlan={inferredPlan}
      />

      {/* Auto-refill display - only show for subscribers */}
      {hasActiveSubscription && autoRefillEnabled && hasValidRefillSettings && (
        <AutoRefillSettings
          lastRefill={lastRefill}
          refillAmount={refillAmount}
          refillIntervalUnit={refillIntervalUnit}
          refillIntervalValue={refillIntervalValue}
          subscriptionPeriodEnd={subscriptionPeriodEnd}
        />
      )}
      {hasActiveSubscription && autoRefillEnabled && !hasValidRefillSettings && (
        <div className="text-sm text-red-600">{localize('com_nav_balance_auto_refill_error')}</div>
      )}
      {hasActiveSubscription && !autoRefillEnabled && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {localize('com_nav_balance_auto_refill_disabled')}
        </div>
      )}

      {/* Trial users - show message about auto-refill */}
      {isTrialUser && (
        <div className="rounded-lg bg-gray-100 p-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          {localize('com_nav_balance_auto_refill_disabled')}
        </div>
      )}
    </div>
  );
}

export default React.memo(Balance);
