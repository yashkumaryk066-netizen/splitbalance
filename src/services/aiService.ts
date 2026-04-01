/**
 * AI Service for completely free, Client-side generation using Google Gemini.
 * Saves costs because it doesn't need Firebase Cloud Functions.
 */

export const generateSavageAdvice = async (expenses: any[], settings: any) => {
  const apiKey: string = "AIzaSyDeoJA7f6WqtIamhi0C9nph_zxdTl_3GU0";
  if (!apiKey) {
    console.warn("Gemini API Key missing. Skipping AI advice.");
    return null;
  }

  // Optimize for Tokens to stay well within the FREE limit
  const recentExpenses = expenses.slice(0, 15).map(e => ({
    amount: e.amount,
    desc: e.description,
    type: e.type || 'expense'
  }));

  if (recentExpenses.length === 0) return null;

  const prompt = `Act as a humorous, slightly savage Indian financial advisor/friend. 
Here are my recent shared expenses: ${JSON.stringify(recentExpenses)}. 
My currency is ${settings.currency || '₹'}.
Analyze these and give me a sharp, 1-2 sentence reality check in Hinglish. 
Tell me if I'm wasting money and where I can save. 
Limit your response to max 100-150 characters. Keep it short, punchy, and sound like a text message notification (no pleasantries, just straight roasted advice).`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 50, // Keep responses short and free
        }
      })
    });
    
    if (!response.ok) throw new Error("API Error or Invalid Key");
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("AI Generation Error", error);
    return null;
  }
};
