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
  const debts: { from: string, to: string, amount: number, vpa?: string }[] = [];
  const sortedBalances = Object.entries(balances)
    .map(([id, balance]) => ({ id, balance }))
    .sort((a, b) => a.balance - b.balance);

  let i = 0;
  let j = sortedBalances.length - 1;
  const tempBalances = sortedBalances.map(b => ({ ...b }));

  while (i < j) {
    const amount = Math.min(-tempBalances[i].balance, tempBalances[j].balance);
    if (amount > 0.1) {
        const receiver = members.find(m => m.id === tempBalances[j].id);
        debts.push({
            from: members.find(m => m.id === tempBalances[i].id)?.displayName || 'Unknown',
            to: receiver?.displayName || 'Unknown',
            amount: amount,
            vpa: receiver?.vpa || ''
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
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap');
          body { font-family: 'Outfit', sans-serif; padding: 20px; color: #1e293b; background-color: #f1f5f9; }
          .container { max-width: 850px; margin: 0 auto; background: white; padding: 40px; border-radius: 24px; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1); }
          .header { text-align: left; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 4px solid #4f46e5; padding-bottom: 20px; }
          .header-left h1 { color: #4f46e5; margin: 0; font-size: 36px; font-weight: 800; }
          .header-left p { color: #64748b; margin: 5px 0 0; font-weight: 500; font-size: 16px; }
          .header-right { text-align: right; color: #94a3b8; font-size: 12px; }
          
          .section-title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 40px 0 20px; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; }
          .section-title::after { content: ""; flex: 1; height: 2px; background: #e2e8f0; margin-left: 15px; }
          
          .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
          .card { background: #f8fafc; padding: 24px; border-radius: 16px; border: 1px solid #e2e8f0; position: relative; overflow: hidden; }
          .card-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; margin-bottom: 8px; }
          .card-value { font-size: 24px; font-weight: 800; color: #1e293b; }
          .card-accent { position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: #4f46e5; }
          
          .settlement-card { background: #ffffff; border: 1.5px dashed #cbd5e1; padding: 20px; border-radius: 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
          .settlement-badge { background: #e0e7ff; color: #4338ca; font-weight: 800; padding: 4px 12px; border-radius: 999px; font-size: 12px; }
 
          table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 20px; }
          th { background-color: #f8fafc; color: #64748b; text-align: left; padding: 16px; font-size: 12px; font-weight: 800; border-bottom: 2px solid #e2e8f0; }
          td { padding: 18px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
          .description-cell { display: flex; flex-direction: column; gap: 4px; }
          .description-title { font-weight: 700; color: #0f172a; font-size: 15px; }
          .description-meta { font-size: 12px; color: #64748b; }
          
          .amount-cell { text-align: right; font-weight: 800; color: #1e293b; font-size: 16px; }
          .member-tag { display: inline-block; padding: 3px 8px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 10px; color: #64748b; margin-right: 4px; margin-top: 4px; }
          
          .footer { margin-top: 80px; padding-top: 30px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: start; }
          .footer-logo { font-weight: 800; color: #4f46e5; font-size: 18px; }
          .footer-text { font-size: 11px; color: #94a3b8; max-width: 300px; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="header-left">
              <p>GROUP LEDGER</p>
              <h1>${groupName}</h1>
            </div>
            <div class="header-right">
              Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}<br/>
              Ref: STS-${Math.random().toString(36).substr(2, 9).toUpperCase()}
            </div>
          </div>
          
          <div class="summary-grid">
            <div class="card">
              <div class="card-accent" style="background: #4f46e5;"></div>
              <div class="card-label">Total Spend</div>
              <div class="card-value">₹${expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0).toLocaleString('en-IN')}</div>
            </div>
            <div class="card">
              <div class="card-accent" style="background: #10b981;"></div>
              <div class="card-label">Active Members</div>
              <div class="card-value">${members.length} Users</div>
            </div>
            <div class="card">
              <div class="card-accent" style="background: #f59e0b;"></div>
              <div class="card-label">Total Transactions</div>
              <div class="card-value">${expenses.length} Entries</div>
            </div>
          </div>
 
          <div class="section-title">Settlement Guide</div>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px;">
            ${members.map(m => `
              <div class="card" style="padding: 16px;">
                <div style="font-size: 13px; font-weight: 700; color: #475569; margin-bottom: 4px;">${m.displayName}</div>
                <div style="font-size: 18px; font-weight: 800; color: ${balances[m.id] >= 0 ? '#10b981' : '#ef4444'}">
                  ₹${Math.abs(balances[m.id]).toFixed(0)}
                  <span style="font-size: 10px; font-weight: 600; opacity: 0.7;">${balances[m.id] >= 0 ? 'RECIEVABLE' : 'PAYABLE'}</span>
                </div>
              </div>
            `).join('')}
          </div>
 
          ${debts.length > 0 ? `
            <div style="background: #eff6ff; padding: 25px; border-radius: 20px; border: 1px solid #dbeafe;">
              <h3 style="margin-top: 0; color: #1e40af; font-size: 16px;">Suggested Transfers</h3>
              ${debts.map(d => `
                <div class="settlement-card">
                  <div>
                    <span style="font-weight: 700;">${d.from}</span>
                    <span style="color: #64748b; margin: 0 10px;">→</span>
                    <span style="font-weight: 700;">${d.to}</span>
                  </div>
                  <div class="settlement-badge">₹${d.amount.toFixed(0)}</div>
                </div>
              `).join('')}
              <p style="font-size: 11px; color: #3b82f6; margin-bottom: 0;">* These transfers minimize the number of payments required to settle all debts.</p>
            </div>
          ` : '<p style="color: #64748b; background: #f8fafc; padding: 20px; border-radius: 12px; text-align: center;"><b>Perfectly Balanced:</b> All accounts are settled!</p>'}
 
          <div class="section-title">Audit Log</div>
          <table>
            <thead>
              <tr>
                <th style="width: 50%;">PAYMENT DETAIL</th>
                <th style="width: 25%;">PAID BY</th>
                <th style="width: 25%; text-align: right;">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              ${expenses.map(exp => {
                const payer = members.find(m => m.id === exp.paidBy);
                const dateStr = new Date(exp.date.toDate ? exp.date.toDate() : exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                return `
                <tr>
                  <td>
                    <div class="description-cell">
                      <span class="description-title">${exp.description}</span>
                      <span class="description-meta">${dateStr} • Split: ${exp.splitType || 'Equal'}</span>
                      <div style="display: flex; flex-wrap: wrap;">
                        ${Object.entries(exp.splitDetails || {}).map(([mId, amt]) => {
                          const m = members.find(member => member.id === mId);
                          if (!m || Number(amt) <= 0) return '';
                          return `<span class="member-tag"><b>${m.displayName}:</b> ₹${Number(amt).toFixed(0)}</span>`;
                        }).join('')}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style="font-weight: 700;">${payer?.displayName || 'Ex-User'}</div>
                    <div style="font-size: 10px; color: #94a3b8;">${payer?.email || ''}</div>
                  </td>
                  <td class="amount-cell">₹${Number(exp.amount).toLocaleString('en-IN')}</td>
                </tr>
              `}).join('')}
            </tbody>
          </table>
 
          <div class="footer">
            <div class="footer-logo">SplitBalance</div>
            <div class="footer-text">
              Confidential report generated securely. Calculations follow the Max-Flow Settlement Engine logic.
              Stay balanced, stay connected.
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  await renderPdf(html, `${groupName}_Ledger`);
};

export const generatePersonalMonthlyReport = async (userName: string, month: string, expenses: any[]) => {
    const totalSpent = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const categorySummary: { [key: string]: number } = {};
    expenses.forEach(e => {
        const cat = e.category || 'General';
        categorySummary[cat] = (categorySummary[cat] || 0) + Number(e.amount);
    });

    const html = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap');
          body { font-family: 'Outfit', sans-serif; padding: 20px; color: #1e293b; background-color: #f1f5f9; }
          .container { max-width: 850px; margin: 0 auto; background: white; padding: 40px; border-radius: 24px; }
          .header { text-align: center; margin-bottom: 50px; }
          .header h1 { font-size: 42px; font-weight: 800; color: #4f46e5; margin: 0; }
          .header p { color: #64748b; font-size: 18px; margin-top: 5px; }

          .stats-hero { background: linear-gradient(135deg, #4f46e5, #818cf8); padding: 40px; border-radius: 24px; color: white; display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
          .stat-main { flex: 1; }
          .stat-main p { font-size: 14px; opacity: 0.9; text-transform: uppercase; letter-spacing: 2px; font-weight: 600; margin: 0; }
          .stat-main h2 { font-size: 52px; margin: 10px 0 0; font-weight: 800; }
          
          .category-list { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
          .cat-card { background: #f8fafc; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
          .cat-name { font-weight: 700; color: #475569; }
          .cat-val { font-weight: 800; color: #4f46e5; font-size: 18px; }

          .section-title { font-size: 20px; font-weight: 800; margin: 40px 0 20px; display: flex; align-items: center; }
          .section-title::after { content: ""; flex: 1; height: 2px; background: #e2e8f0; margin-left: 15px; }
          
          table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
          th { background: #f8fafc; color: #64748b; padding: 16px; text-align: left; font-size: 12px; font-weight: 800; }
          td { padding: 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
          .amount-col { font-weight: 800; text-align: right; color: #0f172a; }
          
          .footer { margin-top: 60px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Spending Analysis</h1>
            <p>${userName}'s Report for ${month}</p>
          </div>

          <div class="stats-hero">
            <div class="stat-main">
              <p>Total Monthly Expenditure</p>
              <h2>₹${totalSpent.toLocaleString('en-IN')}</h2>
            </div>
            <div style="font-size: 14px; text-align: right; opacity: 0.9;">
              ${expenses.length} Shared Transactions<br/>
              Average ₹${(totalSpent / (expenses.length || 1)).toFixed(0)} / expense
            </div>
          </div>

          <div class="section-title">Category Breakdown</div>
          <div class="category-list">
            ${Object.entries(categorySummary).map(([cat, val]) => `
              <div class="cat-card">
                <span class="cat-name">${cat}</span>
                <span class="cat-val">₹${val.toLocaleString('en-IN')}</span>
              </div>
            `).join('')}
          </div>

          <div class="section-title">Transaction History</div>
          <table>
            <thead>
              <tr>
                <th>DATE</th>
                <th>EXPENSE</th>
                <th>CATEGORY</th>
                <th style="text-align: right;">MY SHARE</th>
              </tr>
            </thead>
            <tbody>
              ${expenses.map(e => `
                <tr>
                  <td style="color: #64748b;">${new Date(e.date?.toDate ? e.date.toDate() : e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                  <td><div style="font-weight: 700;">${e.description}</div></td>
                  <td><span style="background: #e0e7ff; color: #4338ca; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 6px;">${(e.category || 'GENERAL').toUpperCase()}</span></td>
                  <td class="amount-col">₹${(e.splitDetails?.[e.theUserId] || e.amount || 0).toLocaleString('en-IN')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            Generated via SplitBalance Premium Report Engine<br/>
            &copy; ${new Date().getFullYear()} SettleStack. All rights reserved.
          </div>
        </div>
      </body>
    </html>
    `;
    await renderPdf(html, `${userName}_${month}_Report`);
}

const renderPdf = async (html: string, fileName: string) => {
    try {
        const { uri } = await Print.printToFileAsync({ html });
        if (Platform.OS === 'web') {
          await Print.printAsync({ html });
        } else {
          const isSharingAvailable = await Sharing.isAvailableAsync();
          if (isSharingAvailable) {
            await Sharing.shareAsync(uri, {
              mimeType: 'application/pdf',
              dialogTitle: fileName,
              UTI: 'com.adobe.pdf',
            });
          } else {
            await Print.printAsync({ html });
          }
        }
      } catch (err: any) {
        console.error('Error generating PDF:', err);
        throw new Error(err?.message || 'Failed to generate PDF');
      }
};
