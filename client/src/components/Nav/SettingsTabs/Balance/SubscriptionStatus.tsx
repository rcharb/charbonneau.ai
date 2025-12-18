import React, { useState } from 'react';
import { useRecoilState } from 'recoil';
import { Crown, Sparkles, AlertCircle, Calendar, CheckCircle2, ExternalLink } from 'lucide-react';
import { Button, Label, Spinner } from '@librechat/client';
import { useCreatePortalSessionMutation } from '~/data-provider/Stripe';
import { useLocalize } from '~/hooks';
import { StripePricingTable } from '~/components/Subscription';
import store from '~/store';

interface SubscriptionStatusProps {
  isTrialUser: boolean;
  isTrialDepleted: boolean;
  hasActiveSubscription: boolean;
  subscriptionPlan: 'standard' | 'plus' | null;
  subscriptionPeriodEnd?: Date | string | null;
  subscriptionStatus?: string | null;
  onClose?: () => void;
}

const SubscriptionStatus: React.FC<SubscriptionStatusProps> = ({
  isTrialUser,
  isTrialDepleted,
  hasActiveSubscription,
  subscriptionPlan,
  subscriptionPeriodEnd,
  subscriptionStatus,
  onClose,
}) => {
  const localize = useLocalize();
  const [showPricingTable, setShowPricingTable] = useRecoilState(store.showChoosePlan);
  const [portalError, setPortalError] = useState<string | null>(null);
  const createPortalSessionMutation = useCreatePortalSessionMutation();

  const handleSubscribe = () => {
    onClose?.();
    setShowPricingTable(true);
  };

  const handleManageSubscription = () => {
    setPortalError(null);
    createPortalSessionMutation.mutate(undefined, {
      onSuccess: (data) => {
        // Open Stripe Customer Portal in a new window
        window.open(data.url, '_blank');
      },
      onError: (error: any) => {
        setPortalError(
          error.response?.data?.error || error.message || localize('com_nav_balance_portal_error'),
        );
      },
    });
  };

  // Format the period end date
  const formatPeriodEnd = (date: Date | string | null | undefined): string => {
    if (!date) return '-';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Get plan display name
  const getPlanDisplayName = (plan: 'standard' | 'plus' | null): string => {
    if (!plan) return localize('com_nav_trial');
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  // Get status badge color
  const getStatusColor = (status: string | null | undefined): string => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'trialing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'past_due':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      case 'canceled':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  // Trial user view
  if (isTrialUser) {
    return (
      <>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900/30">
              <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">{localize('com_nav_trial')}</span>
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  {localize('com_nav_balance_free_tier')}
                </span>
              </div>
              {isTrialDepleted ? (
                <div className="mt-2 flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                  <span>{localize('com_nav_trial_depleted')}</span>
                </div>
              ) : (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {localize('com_nav_balance_trial_description')}
                </p>
              )}
              <Button
                onClick={handleSubscribe}
                variant="default"
                size="sm"
                className="mt-3 bg-purple-600 text-white hover:bg-purple-700"
              >
                {localize('com_nav_subscribe_button')}
              </Button>
            </div>
          </div>
        </div>
        <StripePricingTable open={showPricingTable} onClose={() => setShowPricingTable(false)} />
      </>
    );
  }

  // Subscriber view
  if (hasActiveSubscription && subscriptionPlan) {
    const isPlusUser = subscriptionPlan === 'plus';
    const isCanceled = subscriptionStatus === 'canceled';
    const isPastDue = subscriptionStatus === 'past_due';

    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
        <div className="flex items-start gap-3">
          <div
            className={`rounded-full p-2 ${isPlusUser ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}
          >
            <Crown
              className={`h-5 w-5 ${isPlusUser ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}`}
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="font-medium">{getPlanDisplayName(subscriptionPlan)}</Label>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(subscriptionStatus)}`}
                >
                  {subscriptionStatus === 'active' && (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {localize('com_nav_balance_active')}
                    </span>
                  )}
                  {subscriptionStatus === 'past_due' && localize('com_nav_balance_past_due')}
                  {subscriptionStatus === 'canceled' && localize('com_nav_balance_canceled')}
                  {subscriptionStatus === 'trialing' && localize('com_nav_balance_trialing')}
                </span>
              </div>
            </div>

            {/* Subscription details */}
            <div className="mt-3 space-y-2">
              {subscriptionPeriodEnd && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                    <Calendar className="h-4 w-4" />
                    {isCanceled
                      ? localize('com_nav_balance_access_until')
                      : localize('com_nav_balance_renews_on')}
                  </span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {formatPeriodEnd(subscriptionPeriodEnd)}
                  </span>
                </div>
              )}

              {isPastDue && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 p-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{localize('com_nav_balance_payment_issue')}</span>
                </div>
              )}

              {isCanceled && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-gray-100 p-2 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{localize('com_nav_balance_subscription_ending')}</span>
                </div>
              )}

              {portalError && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-50 p-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{portalError}</span>
                </div>
              )}
            </div>

            <Button
              onClick={handleManageSubscription}
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={createPortalSessionMutation.isLoading}
            >
              {createPortalSessionMutation.isLoading ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <>
                  {localize('com_nav_balance_manage_subscription')}
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback - no subscription data
  return null;
};

export default SubscriptionStatus;
