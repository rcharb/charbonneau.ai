import { useNavigate } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import { Button, OGDialog, OGDialogContent } from '@librechat/client';
import { useLocalize } from '~/hooks';

interface SubscribePromptProps {
  open?: boolean;
  onClose?: () => void;
  variant?: 'modal' | 'banner' | 'inline';
}

export default function SubscribePrompt({
  open = true,
  onClose,
  variant = 'inline',
}: SubscribePromptProps) {
  const navigate = useNavigate();
  const localize = useLocalize();

  const handleSubscribe = () => {
    navigate('/choose-plan');
    onClose?.();
  };

  if (variant === 'banner') {
    return (
      <div className="relative flex items-center justify-between gap-4 bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">{localize('com_nav_trial_depleted')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSubscribe}
            variant="outline"
            className="rounded-lg bg-white px-4 py-1.5 text-sm font-semibold text-purple-600 hover:bg-gray-100"
          >
            {localize('com_nav_subscribe_button')}
          </Button>
          {onClose && (
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="rounded-lg p-1 text-white hover:bg-white/20"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'modal') {
    return (
      <OGDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose?.()}>
        <OGDialogContent className="w-full max-w-md rounded-2xl p-6">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-purple-100 p-3 dark:bg-purple-900/30">
              <Sparkles className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <h2 className="mb-2 text-center text-xl font-semibold text-gray-900 dark:text-white">
            {localize('com_nav_subscribe_prompt_title')}
          </h2>
          <p className="mb-6 text-center text-gray-600 dark:text-gray-300">
            {localize('com_nav_subscribe_prompt_description')}
          </p>
          <Button
            onClick={handleSubscribe}
            className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 font-semibold text-white hover:from-purple-700 hover:to-indigo-700"
          >
            {localize('com_nav_subscribe_button')}
          </Button>
        </OGDialogContent>
      </OGDialog>
    );
  }

  // Default: inline variant
  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900/50">
          <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 dark:text-white">
            {localize('com_nav_subscribe_prompt_title')}
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {localize('com_nav_subscribe_prompt_description')}
          </p>
          <Button
            onClick={handleSubscribe}
            className="mt-3 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            {localize('com_nav_subscribe_button')}
          </Button>
        </div>
      </div>
    </div>
  );
}
