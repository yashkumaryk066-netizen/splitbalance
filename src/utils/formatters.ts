export const formatCurrency = (amount: number, currencySymbol: string = '₹') => {
  return `${currencySymbol}${amount.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;
};

export const parsePhoneNumber = (phone: string) => {
  return phone.replace(/[^\d]/g, '').slice(-10);
};

export const evaluateAmountString = (str: string): number => {
  if (!str) return 0;
  try {
    // Only allow numbers and basic math operators + - * / . ( )
    if (!/^[0-9+\-*/().\s]*$/.test(str)) return NaN;
    
    // Replace any unusual characters if needed, and trim
    const sanitized = str.trim().replace(/,/g, '.');
    if (!sanitized) return 0;
    
    // Safely evaluate simple math expression
    // We use Function constructor which is slightly safer than eval in some environments
    // because it doesn't have access to local scope.
    // Given our strict regex check above, this is safe for numbers and basic math.
    const result = new Function(`return ${sanitized}`)();
    return typeof result === 'number' && isFinite(result) ? result : NaN;
  } catch (err) {
    return NaN;
  }
};
