import React from 'react';
import { Coins, Gift, Crown } from 'lucide-react';
import { Label, InfoHoverCard, ESide } from '@librechat/client';
import { useLocalize } from '~/hooks';

interface TokenCreditsItemProps {
  tokenCredits?: number;
  balanceType?: 'trial' | 'subscription';
  subscriptionPlan?: 'standard' | 'plus' | null;
}

const TokenCreditsItem: React.FC<TokenCreditsItemProps> = ({
  tokenCredits,
  balanceType = 'trial',
  subscriptionPlan,
}) => {
  const localize = useLocalize();

  // Format token credits for display
  const formatCredits = (credits: number | undefined): string => {
    if (credits === undefined) return '0';
    // Show in thousands if large enough
    if (credits >= 1000000) {
      return `${(credits / 1000000).toFixed(2)}M`;
    }
    if (credits >= 1000) {
      return `${(credits / 1000).toFixed(1)}K`;
    }
    return credits.toFixed(0);
  };

  // Get icon based on balance type
  const getBalanceIcon = () => {
    if (balanceType === 'subscription' && subscriptionPlan) {
      return (
        <Crown
          className={`h-4 w-4 ${subscriptionPlan === 'plus' ? 'text-purple-500' : 'text-blue-500'}`}
        />
      );
    }
    if (balanceType === 'trial') {
      return <Gift className="h-4 w-4 text-amber-500" />;
    }
    return <Coins className="h-4 w-4 text-gray-500" />;
  };

  // Get balance type label
  const getBalanceTypeLabel = (): string => {
    if (balanceType === 'subscription' && subscriptionPlan) {
      return localize('com_nav_balance_subscription_credits');
    }
    return localize('com_nav_balance_trial_credits');
  };

  // Get progress bar color based on plan
  const getProgressBarColor = (): string => {
    if (balanceType === 'subscription') {
      return subscriptionPlan === 'plus' ? 'bg-purple-500' : 'bg-blue-500';
    }
    return 'bg-amber-500';
  };

  // Get max credits for progress calculation
  const getMaxCredits = (): number => {
    if (balanceType === 'subscription') {
      return subscriptionPlan === 'plus' ? 750000 : 300000;
    }
    return 100000;
  };

  // Calculate wasted (used) tokens
  const totalCredits = getMaxCredits();
  const wastedCredits = totalCredits - (tokenCredits ?? 0);
  const wastedPercentage = (wastedCredits / totalCredits) * 100;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="flex items-center justify-between">
        {/* Left Section: Label with icon */}
        <div className="flex items-center gap-2">
          {getBalanceIcon()}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <Label className="font-medium">{localize('com_nav_balance')}</Label>
              <InfoHoverCard side={ESide.Bottom} text={localize('com_nav_info_balance')} />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {getBalanceTypeLabel()}
            </span>
          </div>
        </div>

        {/* Right Section: Wasted/Total Token Display */}
        <div className="text-right">
          <div className="flex items-baseline gap-1">
            <span
              className="text-2xl font-bold text-gray-900 dark:text-white"
              role="note"
              aria-label={`${wastedCredits} tokens used out of ${totalCredits}`}
            >
              {formatCredits(wastedCredits)}
            </span>
            <span className="text-lg text-gray-400 dark:text-gray-500">/</span>
            <span className="text-lg font-medium text-gray-600 dark:text-gray-300">
              {formatCredits(totalCredits)}
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {localize('com_nav_balance_tokens')}
          </span>
        </div>
      </div>

      {/* Progress indicator for visual representation */}
      {tokenCredits !== undefined && (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className={`h-full rounded-full transition-all duration-300 ${getProgressBarColor()}`}
              style={{
                width: `${Math.min(100, wastedPercentage)}%`,
              }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              {localize('com_ui_used')}: {formatCredits(wastedCredits)}
            </span>
            <span>
              {localize('com_ui_remaining')}: {formatCredits(tokenCredits ?? 0)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenCreditsItem;
