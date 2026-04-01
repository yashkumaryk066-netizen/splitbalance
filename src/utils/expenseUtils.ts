/**
 * Advanced debt engine to calculate balances within a group
 * Returns net balance for each member
 */
export const calculateGroupMetrics = (expenses: any[], members: any[]) => {
  const memberBalances: { [key: string]: number } = {};
  members.forEach(m => memberBalances[m.id] = 0);

  expenses.forEach(e => {
    const amount = Number(e.amount);
    
    if (e.type === 'payment') {
      const from = e.paidBy;
      const to = e.paidTo;
      if (memberBalances[from] !== undefined) memberBalances[from] += amount;
      if (memberBalances[to] !== undefined) memberBalances[to] -= amount;
    } else {
      const paidBy = e.paidBy;
      const splits = e.splitDetails || {};

      // Plus the whole amount to the payer
      if (memberBalances[paidBy] !== undefined) {
        memberBalances[paidBy] += amount;
      }

      // Subtract the portion each person owes
      Object.keys(splits).forEach(mId => {
        if (memberBalances[mId] !== undefined) {
          memberBalances[mId] -= Number(splits[mId]);
        }
      });
    }
  });

  return memberBalances;
};
