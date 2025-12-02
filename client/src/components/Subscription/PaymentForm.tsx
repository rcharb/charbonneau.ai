import { PaymentElement, AddressElement } from '@stripe/react-stripe-js';
import { Label } from '@librechat/client';
import { useLocalize } from '~/hooks';

interface PaymentFormProps {
  error?: string | null;
}

export default function PaymentForm({ error }: PaymentFormProps) {
  const localize = useLocalize();

  return (
    <div className="space-y-8">
      {/* Payment Method */}
      <div>
        <Label className="mb-4 text-lg font-semibold">
          {localize('com_subscription_payment_method')}
        </Label>
        <div className="space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <PaymentElement
              options={{
                layout: 'tabs',
              }}
            />
          </div>
        </div>
      </div>

      {/* Billing Address */}
      <div>
        <Label className="mb-4 text-lg font-semibold">
          {localize('com_subscription_billing_address')}
        </Label>
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <AddressElement
            options={{
              mode: 'billing',
              fields: {
                phone: 'never',
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
