import { useState, useEffect } from 'react';
import { useRecoilState } from 'recoil';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, useStripe, useElements } from '@stripe/react-stripe-js';
import { Zap, Paperclip, Image as ImageIcon, FileText, ChevronLeft, X } from 'lucide-react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { PaymentForm, PlanSummary } from '~/components/Subscription';
import { Spinner, Button } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { useNavigate } from 'react-router-dom';
import {
  useCreateSetupIntentMutation,
  useCreateSubscriptionMutation,
} from '~/data-provider/Stripe';
import { cn } from '~/utils';
import store from '~/store';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

interface PlanDetails {
  plan: 'standard' | 'plus';
  period: 'monthly' | 'yearly';
  price: number;
}

interface CheckoutFormProps {
  planDetails: PlanDetails;
  setupIntentId: string;
}

function CheckoutForm({ planDetails, setupIntentId }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const createSubscriptionMutation = useCreateSubscriptionMutation();
  const [, setShowCheckout] = useRecoilState(store.showCheckout);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Submit the payment element
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || 'An error occurred');
        setIsProcessing(false);
        return;
      }

      // Confirm the Setup Intent
      const { error: confirmError } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/complete`,
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        setError(confirmError.message || 'Payment method setup failed');
        setIsProcessing(false);
        return;
      }

      // Setup Intent succeeded, now create the subscription
      const planId = `${planDetails.plan}-${planDetails.period}`;
      createSubscriptionMutation.mutate(
        { setupIntentId, planId },
        {
          onSuccess: (data) => {
            if (data.clientSecret) {
              // If there's a payment intent client secret, confirm it
              stripe
                .confirmPayment({
                  clientSecret: data.clientSecret,
                  redirect: 'if_required',
                })
                .then(({ error: paymentError }) => {
                  if (paymentError) {
                    setError(paymentError.message || 'Payment failed');
                    setIsProcessing(false);
                  } else {
                    setShowCheckout(false);
                    navigate('/c/new?subscription=success');
                  }
                });
            } else {
              setShowCheckout(false);
              navigate('/c/new?subscription=success');
            }
          },
          onError: (err: any) => {
            setError(err.response?.data?.error || err.message || 'An error occurred');
            setIsProcessing(false);
          },
        },
      );
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setIsProcessing(false);
    }
  };

  // Get plan features based on plan type
  const getPlanFeatures = () => {
    if (planDetails.plan === 'plus') {
      return [
        {
          text: 'Smarter, faster responses with advanced AI',
          icon: <Zap className="h-5 w-5" color="#9333ea" />,
        },
        {
          text: 'More messages & uploads',
          icon: <Paperclip className="h-5 w-5" color="#9333ea" />,
        },
        {
          text: 'Faster, higher-quality image creation',
          icon: <ImageIcon className="h-5 w-5" color="#9333ea" />,
        },
        { text: 'Extra memory & context', icon: <FileText className="h-5 w-5" color="#9333ea" /> },
      ];
    }
    return [
      { text: 'Access to advanced AI models', icon: <Zap className="h-5 w-5" color="#9333ea" /> },
      {
        text: 'Extended conversation context',
        icon: <Paperclip className="h-5 w-5" color="#9333ea" />,
      },
      {
        text: 'Image generation capabilities',
        icon: <ImageIcon className="h-5 w-5" color="#9333ea" />,
      },
      {
        text: 'Enhanced memory and context',
        icon: <FileText className="h-5 w-5" color="#9333ea" />,
      },
    ];
  };

  const features = getPlanFeatures();
  const dueToday = 0; // Can be adjusted for promotions

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-1 gap-8 p-6 lg:grid-cols-2">
        {/* Left Column: Payment Method & Billing Address */}
        <div>
          <PaymentForm error={error} />
        </div>

        {/* Right Column: Plan Details */}
        <div>
          <PlanSummary
            planName={`${
              planDetails.plan.charAt(0).toUpperCase() + planDetails.plan.slice(1)
            } plan`}
            features={features}
            period={planDetails.period}
            price={planDetails.price}
            tax={0}
            dueToday={dueToday}
            onSubmit={handleSubmit}
            isProcessing={isProcessing || createSubscriptionMutation.isLoading}
            isDisabled={!stripe}
          />
        </div>
      </div>
    </div>
  );
}

export default function CheckoutModal() {
  const localize = useLocalize();
  const [showCheckout, setShowCheckout] = useRecoilState(store.showCheckout);
  const [checkoutPlanId, setCheckoutPlanId] = useRecoilState(store.checkoutPlanId);
  const [, setShowChoosePlan] = useRecoilState(store.showChoosePlan);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [setupIntentId, setSetupIntentId] = useState<string | null>(null);
  const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null);
  const createSetupIntentMutation = useCreateSetupIntentMutation();

  useEffect(() => {
    if (!showCheckout || !checkoutPlanId) {
      return;
    }

    // Parse planId to get plan details
    const [plan, period] = checkoutPlanId.split('-');
    if (!plan || !period) {
      console.error('Invalid planId format');
      return;
    }

    // Get price from plan details
    const priceMap: Record<string, number> = {
      'standard-monthly': 30.0,
      'standard-yearly': 300.0,
      'plus-monthly': 50.0,
      'plus-yearly': 500.0,
    };

    const price = priceMap[checkoutPlanId] || 0;
    setPlanDetails({
      plan: plan as 'standard' | 'plus',
      period: period as 'monthly' | 'yearly',
      price,
    });

    // Create setup intent
    createSetupIntentMutation.mutate(
      { planId: checkoutPlanId },
      {
        onSuccess: (data) => {
          setClientSecret(data.clientSecret);
          setSetupIntentId(data.setupIntentId);
        },
        onError: (error) => {
          console.error('Failed to create setup intent:', error);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCheckout, checkoutPlanId]);

  const handleClose = () => {
    setShowCheckout(false);
    setClientSecret(null);
    setSetupIntentId(null);
    setPlanDetails(null);
    setCheckoutPlanId(null);
  };

  const handleBack = () => {
    setShowCheckout(false);
    setClientSecret(null);
    setSetupIntentId(null);
    setPlanDetails(null);
    setCheckoutPlanId(null);
    setShowChoosePlan(true);
  };

  if (!stripePromise) {
    return (
      <Transition appear show={showCheckout}>
        <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
                  {localize('com_subscription_stripe_key_missing')}
                </p>
              </DialogPanel>
            </div>
          </TransitionChild>
        </Dialog>
      </Transition>
    );
  }

  return (
    <Transition appear show={showCheckout}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    onClick={handleBack}
                    variant="ghost"
                    size="icon"
                    className="opacity-70 hover:opacity-100"
                  >
                    <ChevronLeft className="h-6 w-6" />
                    <span className="sr-only">{localize('com_ui_back')}</span>
                  </Button>
                  <h2 className="text-2xl font-semibold text-text-primary">
                    {localize('com_subscription_configure_plan')}
                  </h2>
                </div>
                <Button
                  type="button"
                  onClick={handleClose}
                  variant="ghost"
                  size="icon"
                  className="opacity-70 hover:opacity-100"
                >
                  <X className="h-6 w-6 text-text-primary" />
                  <span className="sr-only">{localize('com_ui_close')}</span>
                </Button>
              </DialogTitle>

              <div className="max-h-[calc(90vh-100px)] overflow-y-auto">
                {createSetupIntentMutation.isLoading ||
                !clientSecret ||
                !setupIntentId ||
                !planDetails ? (
                  <div className="flex items-center justify-center p-12">
                    <Spinner className="m-auto text-black dark:text-white" />
                  </div>
                ) : (
                  <Elements
                    stripe={stripePromise}
                    options={{
                      clientSecret: clientSecret as string,
                      appearance: {
                        theme: 'stripe',
                      },
                    }}
                  >
                    <CheckoutForm planDetails={planDetails} setupIntentId={setupIntentId} />
                  </Elements>
                )}
              </div>
            </DialogPanel>
          </div>
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}
