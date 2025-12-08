import { Button } from '@librechat/client';
import type { ReactNode } from 'react';
import PriceBreakdown from './PriceBreakdown';
import { useLocalize } from '~/hooks';

interface PlanFeature {
  text: string;
  icon: ReactNode;
}

interface PlanSummaryProps {
  planName: string;
  features: PlanFeature[];
  period: 'monthly' | 'yearly';
  price: number;
  tax?: number;
  promotion?: {
    label: string;
    amount: number;
    description?: string;
  };
  dueToday?: number;
  onSubmit: () => void;
  isProcessing?: boolean;
  isDisabled?: boolean;
}

export default function PlanSummary({
  planName,
  features,
  period,
  price,
  tax,
  promotion,
  dueToday,
  onSubmit,
  isProcessing = false,
  isDisabled = false,
}: PlanSummaryProps) {
  const localize = useLocalize();

  return (
    <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-6 text-lg font-semibold text-gray-900 dark:text-white">{planName}</h2>

      {/* Features */}
      <ul className="mb-6 space-y-3">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <span className="mt-0.5 flex-shrink-0 text-gray-600 dark:text-gray-400">
              {feature.icon}
            </span>
            <span className="text-sm text-gray-700 dark:text-gray-300">{feature.text}</span>
          </li>
        ))}
      </ul>

      {/* Price Breakdown */}
      <PriceBreakdown
        period={period}
        price={price}
        tax={tax}
        promotion={promotion}
        dueToday={dueToday}
      />

      {/* Subscribe Button */}
      <Button
        onClick={onSubmit}
        disabled={isDisabled || isProcessing}
        variant="default"
        size="lg"
        className="mb-4 w-full bg-[#0d0d0d] hover:bg-[#212121] dark:bg-[#FFFFFF] dark:hover:bg-[#E3E3E3] dark:text-gray-900"
      >
        {isProcessing
          ? localize('com_subscription_processing')
          : localize('com_subscription_subscribe')}
      </Button>

      {/* Terms */}
      <p className="text-center text-xs leading-relaxed text-gray-500 dark:text-gray-400">
        {localize('com_subscription_terms_text')}{' '}
        <a href="/terms" className="underline hover:text-gray-700 dark:hover:text-gray-300">
          {localize('com_subscription_terms_of_service')}
        </a>{' '}
        {localize('com_subscription_and')}{' '}
        <a href="/privacy" className="underline hover:text-gray-700 dark:hover:text-gray-300">
          {localize('com_subscription_privacy_policy')}
        </a>
      </p>
    </div>
  );
}
