import { Separator } from '@librechat/client';
import { useLocalize } from '~/hooks';

interface PriceBreakdownProps {
  period: 'monthly' | 'yearly';
  price: number;
  tax?: number;
  promotion?: {
    label: string;
    amount: number;
    description?: string;
  };
  dueToday?: number;
}

export default function PriceBreakdown({
  period,
  price,
  tax = 0,
  promotion,
  dueToday = 0,
}: PriceBreakdownProps) {
  const localize = useLocalize();

  return (
    <div className="mb-6 pt-6">
      <Separator className="mb-6" />
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            {period === 'monthly'
              ? localize('com_subscription_monthly')
              : localize('com_subscription_annual')}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">${price.toFixed(2)}</span>
        </div>

        {promotion && (
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">{promotion.label}</span>
              <span className="font-medium text-gray-900 dark:text-white">
                -${promotion.amount.toFixed(2)}
              </span>
            </div>
            {promotion.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{promotion.description}</p>
            )}
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            {localize('com_subscription_tax')}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">${tax.toFixed(2)}</span>
        </div>

        <Separator className="my-3" />

        <div className="flex justify-between text-lg font-semibold">
          <span className="text-gray-900 dark:text-white">
            {localize('com_subscription_due_today')}
          </span>
          <span className="text-gray-900 dark:text-white">${dueToday.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
