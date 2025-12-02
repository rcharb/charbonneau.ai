import { useNavigate } from 'react-router-dom';
import { Sparkles, MessageSquare, Image, Cpu, Settings, Blocks, Video, Code } from 'lucide-react';
import { PlanCard } from '~/components/Subscription';
import useAuthRedirect from './useAuthRedirect';
import { useLocalize } from '~/hooks';

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

export default function ChoosePlan() {
  const { isAuthenticated } = useAuthRedirect();
  const navigate = useNavigate();
  const localize = useLocalize();

  const handleSelectPlan = (planId: string) => {
    navigate(`/checkout?planId=${planId}`);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen overflow-scroll bg-white px-4 py-12 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900 dark:text-white">
            {localize('com_subscription_choose_plan')}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {localize('com_subscription_select_subscription')}
          </p>
        </div>

        {/* Plans Grid */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
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
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>{localize('com_subscription_all_plans_include')}</p>
        </div>
      </div>
    </div>
  );
}
