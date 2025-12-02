import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, useStripe, useElements } from '@stripe/react-stripe-js';
import { Zap, Paperclip, Image as ImageIcon, FileText } from 'lucide-react';
import { PaymentForm, PlanSummary } from '~/components/Subscription';
import { Spinner } from '@librechat/client';
import useAuthRedirect from './useAuthRedirect';
import { useLocalize } from '~/hooks';
import {
  useCreateSetupIntentMutation,
  useCreateSubscriptionMutation,
} from '~/data-provider/Stripe';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

interface PlanDetails {
  plan: 'standard' | 'plus';
  period: 'monthly' | 'yearly';
  price: number;
}

interface CheckoutFormProps {
  planDetails: PlanDetails;
  clientSecret: string;
  setupIntentId: string;
}

function CheckoutForm({ planDetails, clientSecret, setupIntentId }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const localize = useLocalize();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const createSubscriptionMutation = useCreateSubscriptionMutation();

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
                    navigate('/?subscription=success');
                  }
                });
            } else {
              navigate('/?subscription=success');
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
    <div className="min-h-screen overflow-scroll bg-white p-4 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-2xl font-semibold text-gray-900 dark:text-white">
          {localize('com_subscription_configure_plan')}
        </h1>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
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
    </div>
  );
}

export default function Checkout() {
  const { isAuthenticated } = useAuthRedirect();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('planId');

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (!planId) {
      navigate('/choose-plan', { replace: true });
      return;
    }

    // If returning from Stripe, redirect to complete page
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      navigate(`/checkout/complete?session_id=${sessionId}`, { replace: true });
    }
  }, [isAuthenticated, navigate, searchParams, planId]);

  if (!isAuthenticated || !planId) {
    return null;
  }

  return <CheckoutWrapper planId={planId} />;
}

function CheckoutWrapper({ planId }: { planId: string }) {
  const localize = useLocalize();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [setupIntentId, setSetupIntentId] = useState<string | null>(null);
  const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null);
  const createSetupIntentMutation = useCreateSetupIntentMutation();

  useEffect(() => {
    // Parse planId to get plan details
    const [plan, period] = planId.split('-');
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

    const price = priceMap[planId] || 0;
    setPlanDetails({
      plan: plan as 'standard' | 'plus',
      period: period as 'monthly' | 'yearly',
      price,
    });

    // Create setup intent
    createSetupIntentMutation.mutate(
      { planId },
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
  }, [planId]);

  if (!stripePromise) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
          <h2 className="mb-2 text-lg font-semibold text-red-900 dark:text-red-200">
            {localize('com_subscription_stripe_config_error')}
          </h2>
          <p className="text-sm text-red-700 dark:text-red-300">
            {localize('com_subscription_stripe_key_missing')}
          </p>
        </div>
      </div>
    );
  }

  if (createSetupIntentMutation.isLoading || !clientSecret || !setupIntentId || !planDetails) {
    return (
      <div aria-live="polite" role="status" className="flex h-screen items-center justify-center">
        <Spinner className="m-auto text-black dark:text-white" />
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: clientSecret as string,
        appearance: {
          theme: 'stripe',
        },
      }}
    >
      <CheckoutForm
        planDetails={planDetails}
        clientSecret={clientSecret as string}
        setupIntentId={setupIntentId}
      />
    </Elements>
  );
}
