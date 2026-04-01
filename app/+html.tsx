import { ScrollViewStyleReset } from 'expo-router/html';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* Primary SEO Meta Tags */}
        <title>SettleStack | Split Expenses & Balances by Yashankush Mishra</title>
        <meta name="title" content="SettleStack | Split Expenses & Balances by Yashankush Mishra" />
        <meta name="description" content="SettleStack (also known as SplitBalance) is the ultimate free expense splitting app developed by Yashankush Mishra. Easily track group bills, share trip costs, manage IOUs, and settle up without the stress." />
        <meta name="keywords" content="settlestack, yashankush mishra, splitbalance, expense splitting app, split expenses, bill splitter, settle up, group expenses, track balances, friends and family finances" />
        <meta name="author" content="Yash ankush Mishra" />
        <meta name="robots" content="index, follow" />
        <meta name="language" content="English" />
        <meta name="revisit-after" content="7 days" />

        {/* Open Graph / Facebook / LinkedIn */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SettleStack" />
        <meta property="og:title" content="SettleStack | Split Expenses by Yashankush Mishra" />
        <meta property="og:description" content="Stop stressing about who owes who. Organize group bills for households, trips, and more with SettleStack (SplitBalance)." />
        <meta property="og:image" content="/assets/images/splash.png" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SettleStack | Split Expenses by Yashankush Mishra" />
        <meta name="twitter:description" content="Stop stressing about who owes who. Organize group bills for households, trips, and more with SettleStack (SplitBalance)." />
        <meta name="twitter:image" content="/assets/images/splash.png" />

        {/* Apple Mobile Web App Meta */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SettleStack" />

        {/* Structured Data (JSON-LD) for Rich Snippets */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "SettleStack (SplitBalance)",
              "operatingSystem": "Web, iOS, Android",
              "applicationCategory": "FinanceApplication",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "author": {
                "@type": "Person",
                "name": "Yash ankush Mishra"
              },
              "description": "SettleStack (SplitBalance) is the easiest way to share expenses with friends and family. A project developed point-to-point by Yashankush Mishra.",
              "keywords": "settlestack, yashankush mishra, splitbalance, expense splitting app"
            })
          }}
        />

        {/* 
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native. 
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
body {
  background-color: #fff;
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: #000;
  }
}`;
