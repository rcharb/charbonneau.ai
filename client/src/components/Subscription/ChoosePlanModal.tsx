import { useRecoilState } from 'recoil';
import {
  Sparkles,
  MessageSquare,
  Image,
  Cpu,
  Settings,
  Blocks,
  Video,
  Code,
  X,
} from 'lucide-react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { PlanCard } from '~/components/Subscription';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import store from '~/store';

interface PlanFeature {
  text: string;
  icon: React.ReactNode;
}

interface SubscriptionPlan {
  id: string;
  title: string;
  price: string;
  priceDescription?: string;
  description: string;
  features: PlanFeature[];
  buttonText: string;
  buttonColor: string;
  badge?: string;
  isCurrent?: boolean;
  footnote?: string;
}

const plans: SubscriptionPlan[] = [
  {
    id: 'standard-monthly',
    title: 'Standard',
    price: '$30',
    priceDescription: 'USD / month',
    description: 'Perfect for everyday AI assistance',
    features: [
      { text: 'Access to advanced AI models', icon: <Sparkles className="h-5 w-5" /> },
      { text: 'Extended conversation context', icon: <MessageSquare className="h-5 w-5" /> },
      { text: 'Image generation capabilities', icon: <Image className="h-5 w-5" /> },
      { text: 'Enhanced memory and context', icon: <Cpu className="h-5 w-5" /> },
    ],
    buttonText: 'Get Standard',
    buttonColor: 'bg-gray-900 hover:bg-gray-800',
  },
  {
    id: 'standard-yearly',
    title: 'Standard',
    price: '$300',
    priceDescription: 'USD / year',
    description: 'Best value for consistent users',
    badge: 'SAVE $60',
    features: [
      { text: 'All Standard Monthly features', icon: <Sparkles className="h-5 w-5" /> },
      { text: 'Priority support', icon: <MessageSquare className="h-5 w-5" /> },
      { text: 'Save $60 per year', icon: <Image className="h-5 w-5" /> },
      { text: 'Annual commitment discount', icon: <Cpu className="h-5 w-5" /> },
    ],
    buttonText: 'Get Standard',
    buttonColor: 'bg-gray-900 hover:bg-gray-800',
    footnote: 'Billed annually. Cancel anytime.',
  },
  {
    id: 'plus-monthly',
    title: 'Plus',
    price: '$50',
    priceDescription: 'USD / month',
    description: 'More access to advanced intelligence',
    badge: 'POPULAR',
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
    footnote: 'Cancel anytime. Limits apply.',
  },
  {
    id: 'plus-yearly',
    title: 'Plus',
    price: '$500',
    priceDescription: 'USD / year',
    description: 'Maximum productivity and savings',
    badge: 'BEST VALUE',
    features: [
      { text: 'All Plus Monthly features', icon: <Sparkles className="h-5 w-5" /> },
      { text: 'Unlimited conversations', icon: <MessageSquare className="h-5 w-5" /> },
      { text: 'High-quality images at scale', icon: <Image className="h-5 w-5" /> },
      { text: 'Maximum memory and context', icon: <Cpu className="h-5 w-5" /> },
      { text: 'Advanced agent capabilities', icon: <Settings className="h-5 w-5" /> },
      { text: 'Video creation with Sora', icon: <Video className="h-5 w-5" /> },
      { text: 'Code generation with Codex', icon: <Code className="h-5 w-5" /> },
      { text: 'Save $100 per year', icon: <Blocks className="h-5 w-5" /> },
    ],
    buttonText: 'Get Plus',
    buttonColor: 'bg-purple-600 hover:bg-purple-700',
    footnote: 'Billed annually. Save $100 per year. Cancel anytime.',
  },
];

export default function ChoosePlanModal() {
  const localize = useLocalize();
  const [showChoosePlan, setShowChoosePlan] = useRecoilState(store.showChoosePlan);
  const [, setShowCheckout] = useRecoilState(store.showCheckout);
  const [, setCheckoutPlanId] = useRecoilState(store.checkoutPlanId);

  const handleSelectPlan = (planId: string) => {
    setCheckoutPlanId(planId);
    setShowChoosePlan(false);
    setShowCheckout(true);
  };

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
                'max-h-[90vh] w-full max-w-[90vw] overflow-hidden rounded-xl bg-background shadow-2xl backdrop-blur-2xl animate-in sm:rounded-2xl md:max-w-[1200px]',
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
                {/* Plans Grid */}
                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {plans.map((plan) => (
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
                      isCurrent={plan.isCurrent}
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
