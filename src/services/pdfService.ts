import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export const generateGroupReport = async (groupName: string, members: any[], expenses: any[]) => {
  const html = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #6366f1; padding-bottom: 10px; }
          h1 { color: #6366f1; margin: 0; }
          .summary { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f8fafc; padding: 15px; borderRadius: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #6366f1; color: white; text-align: left; padding: 12px; }
          td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
          .amount { font-weight: bold; text-align: right; }
          .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>SplitNest Report</h1>
          <p>${groupName} | ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="summary">
          <div>
            <strong>Total Expenses:</strong> ₹${expenses.reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}
          </div>
          <div>
            <strong>Members:</strong> ${members.length}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Paid By</th>
              <th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${expenses.map(exp => `
              <tr>
                <td>${new Date(exp.date.toDate()).toLocaleDateString()}</td>
                <td>${exp.description}</td>
                <td>${members.find(m => m.id === exp.paidBy)?.displayName || 'Unknown'}</td>
                <td class="amount">₹${exp.amount.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          Generated via SplitNest - Smart Expense Sharing
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
