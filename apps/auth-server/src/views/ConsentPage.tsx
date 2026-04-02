import React from 'react';

interface Scope {
  value: string;
  name: string;
  description: string;
  required?: boolean;
  checked?: boolean;
}

interface ConsentPageProps {
  uid: string;
  clientName: string;
  resource?: string;
  oidcScopes?: Scope[];
  resourceScopes?: Record<string, Scope[]>;
  error?: string | null;
}

export function ConsentPage({
  uid,
  clientName,
  resource,
  oidcScopes = [],
  resourceScopes = {},
  error,
}: ConsentPageProps) {
  const consentScript = `
    (function() {
      var form = document.getElementById('consentForm');
      var authorizeButton = document.getElementById('authorizeButton');

      if (form) {
        form.addEventListener('submit', function() {
          if (authorizeButton) {
            authorizeButton.disabled = true;
            authorizeButton.textContent = 'Authorizing...';
          }
        });
      }

      document.addEventListener('DOMContentLoaded', function() {
        var checkboxes = form ? form.querySelectorAll('input[type="checkbox"]') : [];
        function updateSubmitButton() {
          var checkedCount = Array.from(checkboxes).filter(function(cb) { return cb.checked; }).length;
          if (authorizeButton) {
            if (checkedCount === 0) {
              authorizeButton.disabled = true;
              authorizeButton.textContent = 'Select at least one permission';
            } else {
              authorizeButton.disabled = false;
              authorizeButton.textContent = 'Authorize';
            }
          }
        }
        checkboxes.forEach(function(checkbox) {
          checkbox.addEventListener('change', updateSubmitButton);
        });
        updateSubmitButton();
      });
    })();
  `;

  const resourceScopeKeys = Object.keys(resourceScopes);

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Authorize Application - More0</title>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="stylesheet" href="/styles.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-white min-h-screen flex items-center justify-center p-5 font-sans">
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-[600px] p-10">
          <div className="text-center mb-8">
            <img src="/large_logo.png" alt="More0 Logo" className="w-[200px] h-[100px] object-contain mx-auto mb-5" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Authorize Application</h1>
            <p className="text-base text-gray-500">Review and approve the requested permissions</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm mb-5">
              {error}
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-8">
            <div className="text-lg font-semibold text-gray-900 mb-2">{clientName || 'Application'}</div>
            {resource ? (
              <>
                <div className="text-sm text-gray-500">wants to access the following MCP server with the permissions below:</div>
                <div className="text-sm text-gray-700 font-medium mt-2">{resource}</div>
              </>
            ) : (
              <div className="text-sm text-gray-500">wants to access your account with the following permissions:</div>
            )}
          </div>

          <form id="consentForm" method="POST" action={`/interaction/${uid}/consent`}>
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Requested Permissions</h2>

              {oidcScopes.length > 0 && (
                <div className="mb-5">
                  <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Standard Permissions</div>
                  {oidcScopes.map((scope) => (
                    <div key={scope.value} className="flex items-start p-3 border border-gray-200 rounded-lg mb-2 bg-white hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        id={`scope_${scope.value}`}
                        name="scopes"
                        value={scope.value}
                        className="mr-3 mt-0.5 w-[18px] h-[18px] cursor-pointer accent-blue-500"
                        defaultChecked
                        disabled={scope.required}
                      />
                      <label htmlFor={`scope_${scope.value}`} className="flex-1 cursor-pointer">
                        <div className="text-sm font-medium text-gray-900 mb-1">{scope.name}</div>
                        <div className="text-xs text-gray-500 leading-relaxed">{scope.description}</div>
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {resourceScopeKeys.length > 0 && resourceScopeKeys.map((resourceKey) => (
                <div key={resourceKey} className="mb-5">
                  <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">MCP Server Permissions</div>
                  {resourceScopes[resourceKey].map((scope) => (
                    <div key={scope.value} className="flex items-start p-3 border border-gray-200 rounded-lg mb-2 bg-white hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        id={`resource_${resourceKey}_${scope.value}`}
                        name={`resourceScopes[${resourceKey}]`}
                        value={scope.value}
                        className="mr-3 mt-0.5 w-[18px] h-[18px] cursor-pointer accent-blue-500"
                        defaultChecked={scope.checked !== false}
                        disabled={scope.required}
                      />
                      <label htmlFor={`resource_${resourceKey}_${scope.value}`} className="flex-1 cursor-pointer">
                        <div className="text-sm font-medium text-gray-900 mb-1">{scope.name}</div>
                        <div className="text-xs text-gray-500 leading-relaxed">{scope.description}</div>
                      </label>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                id="authorizeButton"
                type="submit"
                className="flex-1 py-3.5 px-5 rounded-lg text-base font-semibold cursor-pointer transition-all bg-blue-500 text-white hover:-translate-y-px hover:shadow-lg"
              >
                Authorize
              </button>
              <a
                href={`/interaction/${uid}/abort`}
                className="flex-1 py-3.5 px-5 rounded-lg text-base font-semibold cursor-pointer transition-all bg-white text-gray-600 border-2 border-gray-200 hover:border-gray-300 hover:shadow-md text-center"
              >
                Cancel
              </a>
            </div>
          </form>
        </div>
        <script dangerouslySetInnerHTML={{ __html: consentScript }} />
      </body>
    </html>
  );
}
