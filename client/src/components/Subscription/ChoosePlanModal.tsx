import { useState } from 'react';
import { useRecoilState } from 'recoil';
import * as Tabs from '@radix-ui/react-tabs';
import { Sparkles, MessageSquare, Image, Cpu, Settings, Blocks, X } from 'lucide-react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { PlanCard } from '~/components/Subscription';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import store from '~/store';

interface PlanFeature {
  text: string;
  icon: React.ReactNode;
}

interface BasePlan {
  id: string;
  title: string;
  description: string;
  features: PlanFeature[];
  buttonText: string;
  buttonColor: string;
  pricing: {
    monthly: {
      price: string;
      badge?: string;
    };
    yearly: {
      price: string;
      badge?: string;
    };
  };
  badge?: string;
}

const basePlans: BasePlan[] = [
  {
    id: 'standard',
    title: 'Standard',
    description: 'Perfect for everyday AI assistance',
    features: [
      { text: 'Access to advanced AI models', icon: <Sparkles className="h-5 w-5" /> },
      { text: 'Extended conversation context', icon: <MessageSquare className="h-5 w-5" /> },
      { text: 'Image generation capabilities', icon: <Image className="h-5 w-5" /> },
      { text: 'Enhanced memory and context', icon: <Cpu className="h-5 w-5" /> },
    ],
    buttonText: 'Get Standard',
    buttonColor: 'bg-gray-900 hover:bg-gray-800',
    pricing: {
      monthly: {
        price: '$30',
      },
      yearly: {
        price: '$300',
        badge: 'SAVE $60',
      },
    },
  },
  {
    id: 'plus',
    title: 'Plus',
    description: 'More access to advanced intelligence',
    features: [
      { text: 'Solve complex problems', icon: <Sparkles className="h-5 w-5" /> },
      { text: 'Long chats over multiple sessions', icon: <MessageSquare className="h-5 w-5" /> },
      { text: 'Create more images, faster', icon: <Image className="h-5 w-5" /> },
      { text: 'Remember goals and conversations', icon: <Cpu className="h-5 w-5" /> },
      { text: 'Plan tasks with agent mode', icon: <Settings className="h-5 w-5" /> },
      { text: 'Organize projects and customize', icon: <Blocks className="h-5 w-5" /> },
    ],
    buttonText: 'Get Plus',
    buttonColor: 'bg-purple-600 hover:bg-purple-700',
    badge: 'POPULAR',
    pricing: {
      monthly: {
        price: '$50',
      },
      yearly: {
        price: '$500',
        badge: 'SAVE $100',
      },
    },
  },
];

export default function ChoosePlanModal() {
  const localize = useLocalize();
  const [showChoosePlan, setShowChoosePlan] = useRecoilState(store.showChoosePlan);
  const [, setShowCheckout] = useRecoilState(store.showCheckout);
  const [, setCheckoutPlanId] = useRecoilState(store.checkoutPlanId);
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const handleSelectPlan = (planId: string) => {
    setCheckoutPlanId(planId);
    setShowChoosePlan(false);
    setShowCheckout(true);
  };

  // Get plans with current period pricing
  const plansWithPricing = basePlans.map((plan) => {
    const pricing = plan.pricing[period];
    const priceDescription = period === 'monthly' ? 'USD / month' : 'USD / year';
    const footnote =
      period === 'yearly' ? 'Billed annually. Cancel anytime.' : 'Cancel anytime. Limits apply.';

    return {
      id: `${plan.id}-${period}`,
      title: plan.title,
      price: pricing.price,
      priceDescription,
      description: plan.description,
      features: plan.features,
      buttonText: plan.buttonText,
      buttonColor: plan.buttonColor,
      badge: pricing.badge || plan.badge,
      footnote,
    };
  });

  return (
    <Transition appear show={showChoosePlan}>
      <Dialog as="div" className="relative z-50" onClose={() => setShowChoosePlan(false)}>
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
                'max-h-[90vh] w-[800px] overflow-hidden rounded-xl bg-background shadow-2xl backdrop-blur-2xl animate-in sm:rounded-2xl',
              )}
            >
              <DialogTitle
                className="sticky top-0 z-10 mb-1 flex items-center justify-between bg-background p-6 pb-4 text-left"
                as="div"
              >
                <div>
                  <h2 className="text-2xl font-bold text-text-primary">
                    {localize('com_subscription_choose_plan')}
                  </h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    {localize('com_subscription_select_subscription')}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-border-xheavy focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-surface-primary dark:focus:ring-offset-surface-primary"
                  onClick={() => setShowChoosePlan(false)}
                >
                  <X className="h-6 w-6 text-text-primary" />
                  <span className="sr-only">{localize('com_ui_close')}</span>
                </button>
              </DialogTitle>

              <div className="max-h-[calc(90vh-120px)] overflow-y-auto px-6 pb-6">
                {/* Period Toggle */}
                <Tabs.Root
                  value={period}
                  onValueChange={(value) => setPeriod(value as 'monthly' | 'yearly')}
                  className="mb-6"
                >
                  <div className="flex justify-center">
                    <Tabs.List className="inline-flex rounded-xl bg-surface-secondary p-1">
                      <Tabs.Trigger
                        value="monthly"
                        className={cn(
                          'rounded-lg px-6 py-2.5 text-sm font-medium transition-all duration-200',
                          'text-text-secondary hover:text-text-primary',
                          'radix-state-active:bg-background radix-state-active:text-text-primary radix-state-active:shadow-sm',
                        )}
                      >
                        {localize('com_subscription_monthly_short')}
                      </Tabs.Trigger>
                      <Tabs.Trigger
                        value="yearly"
                        className={cn(
                          'rounded-lg px-6 py-2.5 text-sm font-medium transition-all duration-200',
                          'text-text-secondary hover:text-text-primary',
                          'radix-state-active:bg-background radix-state-active:text-text-primary radix-state-active:shadow-sm',
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {localize('com_subscription_yearly')}
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            {localize('com_subscription_save')}
                          </span>
                        </span>
                      </Tabs.Trigger>
                    </Tabs.List>
                  </div>
                </Tabs.Root>

                {/* Plans Grid */}
                <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                  {plansWithPricing.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      id={plan.id}
                      title={plan.title}
                      price={plan.price}
                      priceDescription={plan.priceDescription}
                      description={plan.description}
                      features={plan.features}
                      buttonText={plan.buttonText}
                      buttonColor={plan.buttonColor}
                      badge={plan.badge}
                      footnote={plan.footnote}
                      onSelect={handleSelectPlan}
                    />
                  ))}
                </div>

                {/* Footer Note */}
                <div className="text-center text-sm text-text-secondary">
                  <p>{localize('com_subscription_all_plans_include')}</p>
                </div>
              </div>
            </DialogPanel>
          </div>
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}
