/**
 * Currency formatting utilities for CAD (Canadian Dollar) and USD (US Dollar)
 */

export type Currency = 'CAD' | 'USD';

export const CURRENCY_CAD = 'CAD' as const;
export const CURRENCY_USD = 'USD' as const;
export const CURRENCY_SYMBOL_CAD = 'C$' as const;
export const CURRENCY_SYMBOL_USD = '$' as const;

// Price mapping for specific plans
// Maps CAD prices to USD prices (exact pricing, not conversion rate)
const PRICE_MAP: Record<number, number> = {
  // Standard plan
  30: 22, // Monthly: CAD $30 -> USD $22
  300: 220, // Yearly: CAD $300 -> USD $220
  // Plus plan
  50: 37, // Monthly: CAD $50 -> USD $37
  500: 370, // Yearly: CAD $500 -> USD $370
};

// Fallback conversion rate for prices not in the map
const CAD_TO_USD_RATE = 0.73;

/**
 * Converts CAD amount to USD using price mapping
 * Falls back to conversion rate if price not in map
 * @param cadAmount - Amount in CAD
 * @returns Amount in USD
 */
export function convertCADToUSD(cadAmount: number): number {
  // Check if we have a specific mapping for this price
  if (PRICE_MAP[cadAmount] !== undefined) {
    return PRICE_MAP[cadAmount];
  }
  // Fallback to approximate conversion rate
  return Math.round(cadAmount * CAD_TO_USD_RATE * 100) / 100;
}

/**
 * Converts USD amount to CAD
 * Reverse lookup in price map, falls back to conversion rate
 * @param usdAmount - Amount in USD
 * @returns Amount in CAD
 */
export function convertUSDToCAD(usdAmount: number): number {
  // Reverse lookup in price map
  const cadPrice = Object.keys(PRICE_MAP).find((key) => PRICE_MAP[Number(key)] === usdAmount);
  if (cadPrice) {
    return Number(cadPrice);
  }
  // Fallback to approximate conversion rate
  return Math.round((usdAmount / CAD_TO_USD_RATE) * 100) / 100;
}

/**
 * Gets currency symbol for a given currency
 * @param currency - Currency code
 * @returns Currency symbol
 */
export function getCurrencySymbol(currency: Currency): string {
  return currency === 'CAD' ? CURRENCY_SYMBOL_CAD : CURRENCY_SYMBOL_USD;
}

/**
 * Formats a number as currency
 * @param amount - The amount to format
 * @param currency - Currency code (CAD or USD)
 * @param options - Formatting options
 * @returns Formatted currency string (e.g., "C$30.00" or "$21.90")
 */
export function formatCurrency(
  amount: number,
  currency: Currency = 'CAD',
  options: {
    showSymbol?: boolean;
    decimals?: number;
  } = {},
): string {
  const { showSymbol = true, decimals = 2 } = options;
  const symbol = getCurrencySymbol(currency);
  const formatted = amount.toFixed(decimals);
  return showSymbol ? `${symbol}${formatted}` : formatted;
}

/**
 * Formats a number as CAD currency with symbol prefix
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g., "C$30.00")
 */
export function formatCAD(amount: number): string {
  return formatCurrency(amount, 'CAD');
}

/**
 * Formats a number as USD currency with symbol prefix
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g., "$21.90")
 */
export function formatUSD(amount: number): string {
  return formatCurrency(amount, 'USD');
}

/**
 * Gets the price in the selected currency
 * Base prices are in CAD, converts to USD if needed
 * @param cadPrice - Price in CAD
 * @param currency - Target currency
 * @returns Price in target currency
 */
export function getPriceInCurrency(cadPrice: number, currency: Currency): number {
  if (currency === 'USD') {
    return convertCADToUSD(cadPrice);
  }
  return cadPrice;
}
