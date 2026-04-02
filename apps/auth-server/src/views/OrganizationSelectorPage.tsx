import React from 'react';
import { AuthLayout } from './AuthLayout.js';

interface Organization {
  organizationId: string;
  organizationName: string;
  role?: string;
}

interface OrganizationSelectorPageProps {
  uid: string;
  organizations: Organization[];
  email?: string;
  name?: string;
  error?: string | null;
  mode: 'login' | 'registration';
  actionUrl: string;
  showCreateNew?: boolean;
}

export function OrganizationSelectorPage({
  uid,
  organizations,
  email,
  name,
  error,
  mode,
  actionUrl,
  showCreateNew = false,
}: OrganizationSelectorPageProps) {
  const subtitle = mode === 'login'
    ? `${name ? `Welcome, ${name}! ` : ''}You belong to multiple organizations. Please select the one you want to sign in to.`
    : `${name ? `Welcome, ${name}! ` : ''}You belong to multiple organizations. Please select which one you want to create an account for, or create a new organization.`;

  const bottomLabel = mode === 'login'
    ? 'Signing in as'
    : 'Registering as';

  return (
    <AuthLayout>
      <section className="relative z-20 flex items-start min-h-screen">
        <div className="ml-[30%] min-w8xl max-w8xl px-4 sm:px-6">
          <div className="py-12 md:py-20">
            <div className="pb-12 text-center">
              <h1 className="animate-[gradient_6s_linear_infinite] bg-[linear-gradient(to_right,var(--color-gray-200),var(--color-indigo-200),var(--color-gray-50),var(--color-indigo-300),var(--color-gray-200))] bg-[length:200%_auto] bg-clip-text font-nacelle text-3xl font-semibold text-transparent md:text-4xl">
                Select Organization
              </h1>
              <p className="mt-4 text-indigo-200/65">
                {subtitle}
              </p>
              {error && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>

            <form action={actionUrl} method="POST" className="mx-auto w-[400px]">
              <div className="space-y-3">
                {organizations.map((org, index) => (
                  <label
                    key={org.organizationId}
                    className="flex items-center p-4 rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-800/80 hover:border-indigo-500/50 cursor-pointer transition-all duration-200 group"
                  >
                    <input
                      type="radio"
                      name="organizationId"
                      value={org.organizationId}
                      defaultChecked={index === 0}
                      className="h-4 w-4 text-indigo-600 border-gray-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
                    />
                    <div className="ml-4 flex-1">
                      <div className="text-sm font-medium text-white group-hover:text-indigo-200">
                        {org.organizationName}
                      </div>
                      {org.role && (
                        <div className="text-xs text-gray-400">
                          Role: {org.role}
                        </div>
                      )}
                    </div>
                    <div className="text-gray-500 group-hover:text-indigo-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </label>
                ))}

                {showCreateNew && (
                  <label className="flex items-center p-4 rounded-lg border border-dashed border-gray-600 bg-gray-800/30 hover:bg-gray-800/50 hover:border-indigo-500/50 cursor-pointer transition-all duration-200 group">
                    <input
                      type="radio"
                      name="createNew"
                      value="true"
                      className="h-4 w-4 text-indigo-600 border-gray-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
                    />
                    <div className="ml-4 flex-1">
                      <div className="text-sm font-medium text-white group-hover:text-indigo-200">
                        Create New Organization
                      </div>
                      <div className="text-xs text-gray-400">
                        Start fresh with a new organization account
                      </div>
                    </div>
                    <div className="text-gray-500 group-hover:text-indigo-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </label>
                )}
              </div>

              <div className="mt-8">
                <button
                  type="submit"
                  className="btn w-full bg-linear-to-t from-indigo-600 to-indigo-500 bg-[length:100%_100%] bg-[bottom] text-white shadow-[inset_0px_1px_0px_0px_--theme(--color-white/.16)] hover:bg-[length:100%_150%]"
                >
                  Continue
                </button>
              </div>
            </form>

            {email && (
              <div className="mt-6 text-center text-sm text-indigo-200/65">
                {bottomLabel} <span className="text-indigo-400">{email}</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </AuthLayout>
  );
}
