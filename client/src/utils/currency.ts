/**
 * Currency formatting utilities for CAD (Canadian Dollar)
 */

export const CURRENCY = 'CAD' as const;
export const CURRENCY_SYMBOL = 'C$' as const;

/**
 * Formats a number as CAD currency
 * @param amount - The amount to format
 * @param options - Formatting options
 * @returns Formatted currency string (e.g., "C$30.00")
 */
export function formatCurrency(
  amount: number,
  options: {
    showSymbol?: boolean;
    decimals?: number;
    symbol?: string;
  } = {},
): string {
  const { showSymbol = true, decimals = 2, symbol = CURRENCY_SYMBOL } = options;
  const formatted = amount.toFixed(decimals);
  return showSymbol ? `${symbol}${formatted}` : formatted;
}

/**
 * Formats a number as CAD currency with symbol prefix
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g., "C$30.00")
 */
export function formatCAD(amount: number): string {
  return formatCurrency(amount);
}
