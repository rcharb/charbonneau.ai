import { useEffect, useRef } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { X } from 'lucide-react';
import { Button } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { useGetStartupConfig } from '~/data-provider';
import { cn } from '~/utils';

interface StripePricingTableProps {
  open: boolean;
  onClose: () => void;
}

export default function StripePricingTable({ open, onClose }: StripePricingTableProps) {
  const localize = useLocalize();
  const scriptLoadedRef = useRef(false);
  const { data: startupConfig } = useGetStartupConfig();

  // Get Stripe config from API
  const stripePublishableKey = startupConfig?.stripePublishableKey || '';
  const stripePricingTableIdLight = startupConfig?.stripePricingTableIdLight || '';
  const stripePricingTableIdDark = startupConfig?.stripePricingTableIdDark || '';

  // Load Stripe pricing table script
  useEffect(() => {
    if (!open || scriptLoadedRef.current) {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/pricing-table.js';
    script.async = true;
    script.onload = () => {
      scriptLoadedRef.current = true;
    };
    document.body.appendChild(script);

    return () => {
      // Don't remove script on unmount as it may be needed elsewhere
    };
  }, [open]);

  // Determine which pricing table to use based on theme
  const isDarkMode = document.documentElement.classList.contains('dark');
  const pricingTableId = isDarkMode ? stripePricingTableIdDark : stripePricingTableIdLight;

  if (!stripePublishableKey || !pricingTableId) {
    return (
      <Transition appear show={open}>
        <Dialog as="div" className="relative z-50" onClose={onClose}>
          <TransitionChild
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black opacity-50 dark:opacity-80" aria-hidden="true" />
          </TransitionChild>

          <TransitionChild
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
              <DialogPanel className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
                <h2 className="mb-2 text-lg font-semibold text-red-900 dark:text-red-200">
                  {localize('com_subscription_stripe_config_error')}
                </h2>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {localize('com_subscription_stripe_pricing_table_missing')}
                </p>
              </DialogPanel>
            </div>
          </TransitionChild>
        </Dialog>
      </Transition>
    );
  }

  return (
    <Transition appear show={open}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black opacity-50 dark:opacity-80" aria-hidden="true" />
        </TransitionChild>

        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <div className={cn('fixed inset-0 flex w-screen items-center justify-center p-4')}>
            <DialogPanel
              className={cn(
                'max-h-[90vh] w-full max-w-[90vw] overflow-hidden rounded-xl bg-background shadow-2xl backdrop-blur-2xl animate-in sm:rounded-2xl md:max-w-[900px]',
              )}
            >
              <DialogTitle
                className="sticky top-0 z-10 mb-1 flex items-center justify-between bg-background p-6 pb-4 text-left"
                as="div"
              >
                <h2 className="text-2xl font-semibold text-text-primary">
                  {localize('com_subscription_choose_plan')}
                </h2>
                <Button
                  type="button"
                  onClick={onClose}
                  variant="ghost"
                  size="icon"
                  className="opacity-70 hover:opacity-100"
                >
                  <X className="h-6 w-6 text-text-primary" />
                  <span className="sr-only">{localize('com_ui_close')}</span>
                </Button>
              </DialogTitle>

              <div className="max-h-[calc(90vh-100px)] overflow-y-auto p-6">
                <stripe-pricing-table
                  pricing-table-id={pricingTableId}
                  publishable-key={stripePublishableKey}
                />
              </div>
            </DialogPanel>
          </div>
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}
