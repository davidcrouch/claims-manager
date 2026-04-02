import React from 'react';

interface LogoutPageProps {
  form: string;
}

export function LogoutPage({ form }: LogoutPageProps) {
  const logoutScript = `
    setTimeout(function() {
      var form = document.getElementById('op.logoutForm');
      if (form) {
        var logoutInput = document.createElement('input');
        logoutInput.type = 'hidden';
        logoutInput.name = 'logout';
        logoutInput.value = 'yes';
        form.appendChild(logoutInput);
        form.submit();
      }
    }, 1500);
  `;

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Logging out - More0</title>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="stylesheet" href="/styles.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-white min-h-screen flex items-center justify-center p-5 font-sans">
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-[500px] overflow-hidden">
          <div className="p-20 text-center">
            <div className="mb-8">
              <img src="/large_logo.png" alt="More0 Logo" className="w-60 h-30 object-contain mx-auto mb-5" />
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Logging out...</h1>
              <p className="text-base text-gray-500 mb-8">Please wait while we sign you out</p>
            </div>

            <div className="inline-block w-8 h-8 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin mb-5" />
            <p className="text-base text-gray-500 font-medium">Ending your session</p>

            <div dangerouslySetInnerHTML={{ __html: form }} />
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: logoutScript }} />
      </body>
    </html>
  );
}
