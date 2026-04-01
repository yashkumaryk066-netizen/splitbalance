export const formatCurrency = (amount: number, currencySymbol: string = '₹') => {
  return `${currencySymbol}${amount.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;
};

export const parsePhoneNumber = (phone: string) => {
  return phone.replace(/[^\d]/g, '').slice(-10);
};
