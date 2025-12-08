import { Separator } from '@librechat/client';
import { useRecoilValue } from 'recoil';
import { useLocalize } from '~/hooks';
import { formatCurrency, getPriceInCurrency, type Currency } from '~/utils';
import store from '~/store';

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
  dueToday,
}: PriceBreakdownProps) {
  const localize = useLocalize();
  const selectedCurrency = useRecoilValue(store.selectedCurrency) as Currency;

  // Calculate dueToday as price - tax (and subtract promotion if present)
  // Only use provided dueToday if it's explicitly set and greater than 0
  const calculatedDueToday: number =
    dueToday !== undefined && dueToday > 0 ? dueToday : price - tax - (promotion?.amount || 0);

  // Convert prices from CAD to selected currency
  const displayPrice = getPriceInCurrency(price, selectedCurrency);
  const displayTax = getPriceInCurrency(tax, selectedCurrency);
  const displayDueToday = getPriceInCurrency(calculatedDueToday, selectedCurrency);
  const displayPromotionAmount = promotion
    ? getPriceInCurrency(promotion.amount, selectedCurrency)
    : 0;

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
          <span className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(displayPrice, selectedCurrency)}
          </span>
        </div>

        {promotion && (
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">{promotion.label}</span>
              <span className="font-medium text-gray-900 dark:text-white">
                -{formatCurrency(displayPromotionAmount, selectedCurrency)}
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
          <span className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(displayTax, selectedCurrency)}
          </span>
        </div>

        <Separator className="my-3" />

        <div className="flex justify-between text-lg font-semibold">
          <span className="text-gray-900 dark:text-white">
            {localize('com_subscription_due_today')}
          </span>
          <span className="text-gray-900 dark:text-white">
            {formatCurrency(displayDueToday, selectedCurrency)}
          </span>
        </div>
      </div>
    </div>
  );
}
