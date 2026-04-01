import { calculateGroupMetrics } from '../src/utils/expenseUtils';

describe('calculateGroupMetrics', () => {
  it('should return 0 balances if there are no expenses', () => {
    const members = [{ id: 'user1' }, { id: 'user2' }];
    const balances = calculateGroupMetrics([], members);
    expect(balances['user1']).toBe(0);
    expect(balances['user2']).toBe(0);
  });

  it('should correctly calculate split metrics', () => {
    const members = [{ id: 'u1' }, { id: 'u2' }];
    const expenses = [
      {
        type: 'expense',
        amount: 100,
        paidBy: 'u1',
        splitDetails: {
          'u1': 50,
          'u2': 50
        }
      }
    ];
    
    // u1 paid 100, owes 50 -> should be owed 50 (+50)
    // u2 paid 0, owes 50 -> should owe 50 (-50)
    
    const balances = calculateGroupMetrics(expenses, members);
    expect(balances['u1']).toBe(50);
    expect(balances['u2']).toBe(-50);
  });
});
