import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export const generateGroupReport = async (groupName: string, members: any[], expenses: any[]) => {
  // Calculate aggregate balances
  const balances: { [key: string]: number } = {};
  members.forEach(m => balances[m.id] = 0);

  expenses.forEach(e => {
    const paidBy = e.paidBy;
    const amount = Number(e.amount);
    const splits = e.splitDetails || {};

    if (balances[paidBy] !== undefined) balances[paidBy] += amount;
    Object.keys(splits).forEach(mId => {
      if (balances[mId] !== undefined) balances[mId] -= Number(splits[mId]);
    });
  });

  // Calculate settlement summary
  const debts: { from: string, to: string, amount: number }[] = [];
  const sortedBalances = Object.entries(balances)
    .map(([id, balance]) => ({ id, balance }))
    .sort((a, b) => a.balance - b.balance);

  let i = 0;
  let j = sortedBalances.length - 1;
  const tempBalances = sortedBalances.map(b => ({ ...b }));

  while (i < j) {
    const amount = Math.min(-tempBalances[i].balance, tempBalances[j].balance);
    if (amount > 0.1) {
      debts.push({
        from: members.find(m => m.id === tempBalances[i].id)?.displayName || 'Unknown',
        to: members.find(m => m.id === tempBalances[j].id)?.displayName || 'Unknown',
        amount: amount
      });
    }
    tempBalances[i].balance += amount;
    tempBalances[j].balance -= amount;
    if (Math.abs(tempBalances[i].balance) < 0.1) i++;
    if (Math.abs(tempBalances[j].balance) < 0.1) j--;
  }

  const html = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #1e293b; background-color: #f8fafc; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #6366f1; padding-bottom: 20px; }
          .header h1 { color: #6366f1; margin: 0; font-size: 32px; letter-spacing: -1px; }
          .header p { color: #64748b; margin: 5px 0 0; }
          
          .section-title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 30px 0 15px; border-left: 4px solid #6366f1; padding-left: 10px; }
          
          .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .card { background: #f1f5f9; padding: 20px; border-radius: 12px; }
          .card-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
          .card-value { font-size: 24px; font-weight: 700; color: #1e293b; margin-top: 5px; }
          
          .settlement-card { background: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
          .settlement-arrow { color: #3b82f6; font-weight: bold; padding: 0 10px; }

          table { width: 100%; border-collapse: collapse; margin-top: 20px; border-radius: 8px; overflow: hidden; }
          th { background-color: #6366f1; color: white; text-align: left; padding: 14px; font-size: 14px; }
          td { padding: 14px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
          .row-sub { font-size: 11px; color: #64748b; margin-top: 4px; }
          .amount { font-weight: bold; text-align: right; }
          
          .footer { margin-top: 60px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          .split-chip { display: inline-block; padding: 2px 8px; background: #e2e8f0; border-radius: 4px; font-size: 10px; margin-right: 4px; margin-top: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>SplitNest Ledger Report</h1>
            <p>${groupName} • ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          
          <div class="summary-grid">
            <div class="card">
              <div class="card-label">Total Group Spend</div>
              <div class="card-value">₹${expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0).toLocaleString('en-IN')}</div>
            </div>
            <div class="card">
              <div class="card-label">Total Transactions</div>
              <div class="card-value">${expenses.length}</div>
            </div>
          </div>

          <div class="section-title">Settlement Summary</div>
          <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">
            ${members.map(m => `
              <div class="card" style="flex: 1; min-width: 140px; padding: 15px;">
                <div class="card-label">${m.displayName}</div>
                <div class="card-value" style="font-size: 18px; color: ${balances[m.id] >= 0 ? '#10b981' : '#ef4444'}">
                  ₹${Math.abs(balances[m.id]).toFixed(0)}
                  <span style="font-size: 10px; font-weight: 400; color: #64748b;">${balances[m.id] >= 0 ? ' (Owed)' : ' (Owes)'}</span>
                </div>
              </div>
            `).join('')}
          </div>

          ${debts.length > 0 ? `
            <div class="section-title">Final Instructions</div>
            ${debts.map(d => `
              <div class="settlement-card">
                <span><strong>${d.from}</strong></span>
                <span class="settlement-arrow">pays ₹${d.amount.toFixed(0)} to</span>
                <span><strong>${d.to}</strong></span>
              </div>
            `).join('')}
          ` : '<p style="color: #64748b;">No outstanding balances. Everyone is settled up!</p>'}

          <div class="section-title">Detailed Audit Log</div>
          <table>
            <thead>
              <tr>
                <th>Date & Description</th>
                <th>Paid By</th>
                <th class="amount">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${expenses.map(exp => `
                <tr>
                  <td>
                    <strong>${exp.description}</strong>
                    <div class="row-sub">${new Date(exp.date.toDate ? exp.date.toDate() : exp.date).toLocaleDateString()}</div>
                    <div style="margin-top: 8px;">
                      ${Object.entries(exp.splitDetails || {}).map(([mId, amt]) => `
                        <span class="split-chip">${members.find(m => m.id === mId)?.displayName || 'Member'}: ₹${Number(amt).toFixed(0)}</span>
                      `).join('')}
                    </div>
                  </td>
                  <td>${members.find(m => m.id === exp.paidBy)?.displayName || 'Unknown'}</td>
                  <td class="amount">₹${Number(exp.amount).toLocaleString('en-IN')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            Report generated securely for ${groupName} by SplitNest Engine.<br/>
            All calculations are final and based on real-time cloud data.
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    if (!Print?.printToFileAsync) {
      alert('Native printing not available. If you are using the app, please update to the latest version.');
      return;
    }
    const { uri } = await Print.printToFileAsync({ html });
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await Sharing.shareAsync(uri);
    } else {
      // For web, we can't easily use Sharing.shareAsync with a local file URI
      // Print.printAsync is better for web
      await Print.printAsync({ html });
    }
  } catch (err) {
    console.error('Error generating PDF:', err);
    throw err;
  }
};
