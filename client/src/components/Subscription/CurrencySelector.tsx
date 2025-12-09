import { useRecoilState } from 'recoil';
import { Button } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import store from '~/store';
import type { Currency } from '~/utils';

export default function CurrencySelector() {
  const localize = useLocalize();
  const [selectedCurrency, setSelectedCurrency] = useRecoilState(store.selectedCurrency);

  const currencies: { code: Currency; label: string }[] = [
    { code: 'CAD', label: 'CAD' },
    { code: 'USD', label: 'USD' },
  ];

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {localize('com_subscription_currency') || 'Currency'}:
      </span>
      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
        {currencies.map((currency) => (
          <Button
            key={currency.code}
            type="button"
            onClick={() => setSelectedCurrency(currency.code)}
            variant="ghost"
            size="sm"
            className={cn(
              'px-3 py-1 text-sm font-medium transition-colors',
              selectedCurrency === currency.code
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700',
            )}
          >
            {currency.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
