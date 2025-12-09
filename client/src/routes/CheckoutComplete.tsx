import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStripeSessionStatusQuery } from '~/data-provider/Stripe';
import useAuthRedirect from './useAuthRedirect';
import { Spinner } from '@librechat/client';
import { useLocalize } from '~/hooks';

export default function CheckoutComplete() {
  const { isAuthenticated } = useAuthRedirect();
  const navigate = useNavigate();
  const localize = useLocalize();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const { data: sessionStatus, isLoading } = useStripeSessionStatusQuery(sessionId, !!sessionId);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (!sessionId) {
      navigate('/?subscription=error', { replace: true });
      return;
    }

    if (sessionStatus) {
      const { status, payment_status } = sessionStatus;
      if (status === 'complete' && payment_status === 'paid') {
        navigate('/?subscription=success', { replace: true });
      } else {
        navigate('/?subscription=error', { replace: true });
      }
    }
  }, [isAuthenticated, navigate, sessionId, sessionStatus]);

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <div aria-live="polite" role="status" className="flex h-screen items-center justify-center">
        <Spinner className="m-auto text-black dark:text-white" />
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-lg">{localize('com_subscription_processing_subscription')}</p>
      </div>
    </div>
  );
}
