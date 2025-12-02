import { Button } from '@librechat/client';
import type { ReactNode } from 'react';
import { useLocalize } from '~/hooks';

export interface PlanCardProps {
  id: string;
  title: string;
  price: string;
  priceDescription?: string;
  description: string;
  features: Array<{ text: string; icon: ReactNode }>;
  buttonText: string;
  buttonColor: string;
  badge?: string;
  isCurrent?: boolean;
  footnote?: string;
  onSelect: (planId: string) => void;
}

export default function PlanCard({
  id,
  title,
  price,
  priceDescription,
  description,
  features,
  buttonText,
  buttonColor,
  badge,
  isCurrent,
  footnote,
  onSelect,
}: PlanCardProps) {
  const localize = useLocalize();

  return (
    <div className="relative flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      {/* Badge */}
      {badge && (
        <div className="absolute right-4 top-4">
          <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200">
            {badge}
          </span>
        </div>
      )}

      {/* Card Content */}
      <div className="flex flex-1 flex-col gap-4 p-6">
        {/* Title */}
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">{title}</h3>

        {/* Price */}
        <div className="flex items-baseline">
          <span className="text-4xl font-bold text-gray-900 dark:text-white">{price}</span>
          {priceDescription && (
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              {priceDescription}
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-sm font-bold text-gray-600 dark:text-gray-400">{description}</p>

        {/* Button */}
        {isCurrent ? (
          <Button disabled variant="secondary" className="w-full rounded-full">
            {localize('com_subscription_current_plan')}
          </Button>
        ) : (
          <Button
            onClick={() => onSelect(id)}
            variant="default"
            className={`w-full rounded-full ${buttonColor}`}
          >
            {buttonText}
          </Button>
        )}

        {/* Features */}
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3">
              <span className="mt-0.5 flex-shrink-0 text-gray-600 dark:text-gray-400">
                {feature.icon}
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300">{feature.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      {footnote && (
        <div className="p-6 pt-0 dark:border-gray-700">
          <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">{footnote}</p>
        </div>
      )}
    </div>
  );
}
