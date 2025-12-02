import React from 'react';
import { RefreshCw, Calendar, Clock, Coins } from 'lucide-react';
import { Label, InfoHoverCard, ESide } from '@librechat/client';
import { TranslationKeys, useLocalize } from '~/hooks';

interface AutoRefillSettingsProps {
  lastRefill: Date;
  refillAmount: number;
  refillIntervalUnit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  refillIntervalValue: number;
  subscriptionPeriodEnd?: Date | string | null;
}

/**
 * Adds a time interval to a given date.
 * @param {Date} date - The starting date.
 * @param {number} value - The numeric value of the interval.
 * @param {'seconds'|'minutes'|'hours'|'days'|'weeks'|'months'} unit - The unit of time.
 * @returns {Date} A new Date representing the starting date plus the interval.
 */
const addIntervalToDate = (
  date: Date,
  value: number,
  unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months',
): Date => {
  const result = new Date(date);
  switch (unit) {
    case 'seconds':
      result.setSeconds(result.getSeconds() + value);
      break;
    case 'minutes':
      result.setMinutes(result.getMinutes() + value);
      break;
    case 'hours':
      result.setHours(result.getHours() + value);
      break;
    case 'days':
      result.setDate(result.getDate() + value);
      break;
    case 'weeks':
      result.setDate(result.getDate() + value * 7);
      break;
    case 'months':
      result.setMonth(result.getMonth() + value);
      break;
    default:
      break;
  }
  return result;
};

/**
 * Calculates the next future refill date.
 * This function determines how many intervals have passed since the base date
 * and advances to the next eligible date. It correctly handles both fixed-duration
 * intervals (e.g., days, weeks) and variable-duration intervals (e.g., months).
 *
 * @param {Date} baseDate - The starting date for the calculation (e.g., the last refill date).
 * @param {number} value - The numeric value of the interval (e.g., 7 for 7 days).
 * @param {'seconds'|'minutes'|'hours'|'days'|'weeks'|'months'} unit - The unit of time for the interval.
 * @returns {Date} The next calculated future refill date.
 */
function getNextFutureInterval(
  baseDate: Date,
  value: number,
  unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months',
): Date {
  const now = new Date();

  if (baseDate > now) {
    return addIntervalToDate(baseDate, value, unit);
  }

  if (unit === 'months') {
    let nextRefillDate = new Date(baseDate);
    while (nextRefillDate <= now) {
      nextRefillDate = addIntervalToDate(nextRefillDate, value, unit);
    }
    return nextRefillDate;
  }

  const intervalInMs = {
    seconds: value * 1000,
    minutes: value * 1000 * 60,
    hours: value * 1000 * 60 * 60,
    days: value * 1000 * 60 * 60 * 24,
    weeks: value * 1000 * 60 * 60 * 24 * 7,
  }[unit];

  if (intervalInMs <= 0) {
    return addIntervalToDate(baseDate, value, unit);
  }

  const timeSinceBase = now.getTime() - baseDate.getTime();
  const intervalsPassed = Math.floor(timeSinceBase / intervalInMs);
  const intervalsToNext = intervalsPassed + 1;
  const nextRefillTime = baseDate.getTime() + intervalsToNext * intervalInMs;

  return new Date(nextRefillTime);
}

/**
 * Format number with K/M suffix for large values
 */
const formatTokenAmount = (amount: number): string => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}K`;
  }
  return amount.toString();
};

const AutoRefillSettings: React.FC<AutoRefillSettingsProps> = ({
  lastRefill,
  refillAmount,
  refillIntervalUnit,
  refillIntervalValue,
  subscriptionPeriodEnd,
}) => {
  const localize = useLocalize();

  const lastRefillDate = lastRefill ? new Date(lastRefill) : null;

  // Parse subscription period end date
  let periodEndDate: Date | null = null;
  if (subscriptionPeriodEnd) {
    periodEndDate =
      typeof subscriptionPeriodEnd === 'string'
        ? new Date(subscriptionPeriodEnd)
        : subscriptionPeriodEnd;
  }

  // For subscription-based refills, the next refill aligns with subscription period
  const nextRefill =
    periodEndDate ||
    (lastRefillDate
      ? getNextFutureInterval(lastRefillDate, refillIntervalValue, refillIntervalUnit)
      : null);

  // Return the localized unit based on singular/plural values
  const getLocalizedIntervalUnit = (
    value: number,
    unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months',
  ): string => {
    let key: TranslationKeys;
    switch (unit) {
      case 'seconds':
        key = value === 1 ? 'com_nav_balance_second' : 'com_nav_balance_seconds';
        break;
      case 'minutes':
        key = value === 1 ? 'com_nav_balance_minute' : 'com_nav_balance_minutes';
        break;
      case 'hours':
        key = value === 1 ? 'com_nav_balance_hour' : 'com_nav_balance_hours';
        break;
      case 'days':
        key = value === 1 ? 'com_nav_balance_day' : 'com_nav_balance_days';
        break;
      case 'weeks':
        key = value === 1 ? 'com_nav_balance_week' : 'com_nav_balance_weeks';
        break;
      case 'months':
        key = value === 1 ? 'com_nav_balance_month' : 'com_nav_balance_months';
        break;
      default:
        key = 'com_nav_balance_seconds';
    }
    return localize(key);
  };

  // Format date for display
  const formatDate = (date: Date | null): string => {
    if (!date) return '-';
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Calculate days until next refill
  const getDaysUntilRefill = (): number | null => {
    if (!nextRefill) return null;
    const now = new Date();
    const diffTime = nextRefill.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysUntilRefill = getDaysUntilRefill();

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/50">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <RefreshCw className="h-5 w-5 text-green-500" />
        <h3 className="font-medium text-gray-900 dark:text-white">
          {localize('com_nav_balance_auto_refill_settings')}
        </h3>
      </div>

      {/* Settings Grid */}
      <div className="space-y-3">
        {/* Last Refill */}
        <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Clock className="h-4 w-4" />
            <span className="text-sm">{localize('com_nav_balance_last_refill')}</span>
          </div>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {formatDate(lastRefillDate)}
          </span>
        </div>

        {/* Refill Amount */}
        <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Coins className="h-4 w-4" />
            <span className="text-sm">{localize('com_nav_balance_refill_amount')}</span>
          </div>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
            +{formatTokenAmount(refillAmount)}
          </span>
        </div>

        {/* Refill Interval */}
        <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">{localize('com_nav_balance_interval')}</span>
          </div>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {localize('com_nav_balance_every')} {refillIntervalValue}{' '}
            {getLocalizedIntervalUnit(refillIntervalValue, refillIntervalUnit)}
          </span>
        </div>

        {/* Next Refill - Highlighted */}
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
              <RefreshCw className="h-4 w-4" />
              <Label className="text-sm font-medium">
                {localize('com_nav_balance_next_refill')}
              </Label>
            </div>
            <InfoHoverCard
              side={ESide.Bottom}
              text={localize('com_nav_balance_next_refill_info')}
            />
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-green-700 dark:text-green-400">
              {formatDate(nextRefill)}
            </span>
            {daysUntilRefill !== null && daysUntilRefill > 0 && (
              <span className="ml-2 text-xs text-green-600 dark:text-green-500">
                ({daysUntilRefill}{' '}
                {daysUntilRefill === 1
                  ? localize('com_nav_balance_day')
                  : localize('com_nav_balance_days')}
                )
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoRefillSettings;
