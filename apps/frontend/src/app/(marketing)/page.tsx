import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Shield,
  Lock,
  FileText,
  Workflow,
  BarChart3,
  Users,
  CheckCircle2,
  PlayCircle,
} from 'lucide-react';

/**
 * Marketing landing page — visual system mirrors legal.more0.io:
 * Inter typography, alternating navy / soft-white / slate sections,
 * grid-pattern hero, uppercase eyebrow + bold heading + muted body,
 * small blue-dot bullets, clean shadows (no glows, no gradients).
 *
 * Palette (scoped to this page):
 *   navy         #02122d (single dark tone used for all dark sections; matches logo background, auth-server left panel & app sidebar)
 *   soft-white   hsl(210 33% 97%)   #f5f7fa
 *   light-grey   hsl(214 24% 87%)   #d6dde4
 *   blue-accent  hsl(214 65% 55%)   #3e86d4
 *   muted-fg     hsl(213 27% 35%)   #42526a
 */

const NAVY = '#02122d';
const SOFT_WHITE = '#f5f7fa';
const LIGHT_GREY = '#d6dde4';
const BLUE = '#3e86d4';
const MUTED_FG = '#42526a';
const INK = '#030712';
const INK_MUTED = '#1e293b';

export default function LandingPage() {
  return (
    <div
      className="flex min-h-screen flex-col antialiased"
      style={{ backgroundColor: '#ffffff', color: INK }}
    >
      {/* Page-level keyframes for subtle floating/glow animations */}
      <style>{`
        @keyframes cm-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes cm-pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(1.35); }
        }
        .cm-float { animation: cm-float 5s ease-in-out infinite; }
        .cm-pulse-dot { animation: cm-pulse-dot 2.2s ease-in-out infinite; }
      `}</style>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <ProblemSection />
        <UnifiedRecordsSection />
        <WorkflowSectionBlock />
        <IntelligenceSection />
        <ProfessionalSection />
        <EarlyAccessCta />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function SiteHeader() {
  const navLinks = [
    { label: 'Platform', href: '#platform' },
    { label: 'Workflow', href: '#workflow' },
    { label: 'Reporting', href: '#reporting' },
    { label: 'Security', href: '#security' },
  ];

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(2,18,45,0.92)',
        boxShadow: '0 4px 20px -4px rgba(2,18,45,0.35)',
      }}
    >
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link
          href="/"
          className="group flex items-center gap-3 text-xl tracking-tight transition-opacity duration-200 hover:opacity-90"
          style={{ color: '#ffffff' }}
        >
          <LogoMark />
          <span className="font-semibold tracking-tight">EnsureOS</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm font-medium text-white transition-opacity duration-200 hover:opacity-80"
            >
              {l.label}
            </a>
          ))}
          <a
            href="/api/auth/login"
            className="text-sm font-medium text-white transition-opacity duration-200 hover:opacity-80"
          >
            Sign in
          </a>
          <a
            href="/api/auth/register"
            className="rounded px-5 py-2 text-sm font-medium shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            style={{ backgroundColor: BLUE, color: SOFT_WHITE }}
          >
            Get started
          </a>
        </nav>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-transparent p-1 transition-transform duration-300 group-hover:scale-105">
      <Image
        src="/ensure_logo_dark.png"
        alt=""
        width={56}
        height={56}
        className="size-full object-contain"
      />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <>
      <section
        className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28"
        style={{ backgroundColor: '#ffffff' }}
      >
        {/* Grid pattern (navy lines on white bg) */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, ${NAVY} 1px, transparent 1px),
              linear-gradient(to bottom, ${NAVY} 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
            opacity: 0.13,
            maskImage:
              'radial-gradient(ellipse 100% 90% at 50% 40%, black 55%, transparent 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 100% 90% at 50% 40%, black 55%, transparent 100%)',
          }}
        />

        <div className="container relative z-10 mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
            {/* Left: content */}
            <div className="lg:col-span-7 animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
              {/* Accent bar + eyebrow */}
              <div className="mb-6 flex items-center gap-4">
                <span
                  className="h-px w-10"
                  style={{ backgroundColor: BLUE }}
                />
                <span
                  className="text-xs font-semibold uppercase tracking-[0.2em]"
                  style={{ color: BLUE }}
                >
                  Built for insurance contractors
                </span>
              </div>

              <h1
                className="mb-6 text-4xl font-bold leading-[1.05] tracking-tight md:text-5xl lg:text-[3.5rem] xl:text-6xl"
                style={{ color: INK }}
              >
                The claims workspace your{' '}
                <span
                  className="relative whitespace-nowrap"
                  style={{ color: BLUE }}
                >
                  adjusters
                  <svg
                    aria-hidden="true"
                    className="absolute -bottom-2 left-0 w-full"
                    height="8"
                    viewBox="0 0 200 8"
                    preserveAspectRatio="none"
                    fill="none"
                  >
                    <path
                      d="M2 5.5 Q 50 1, 100 4 T 198 3"
                      stroke={BLUE}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>{' '}
                will actually want to use.
              </h1>

              <p
                className="mb-10 max-w-xl text-lg leading-relaxed md:text-xl"
                style={{ color: INK_MUTED }}
              >
                Jobs, claims, quotes, vendors, invoices and reporting —
                unified in a single, purpose-built workspace for contractors
                performing insurance claim work on behalf of carriers.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <a
                  href="/api/auth/register"
                  className="group inline-flex items-center rounded px-7 py-3.5 text-sm font-medium shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
                  style={{ backgroundColor: BLUE, color: SOFT_WHITE }}
                >
                  Get Started
                  <ArrowRight className="ml-2 size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </a>

              </div>
            </div>

            {/* Right: portrait hero image */}
            <div className="relative lg:col-span-5 animate-in fade-in-0 slide-in-from-bottom-6 duration-1000">
              {/* Small blue accent square behind the image */}
              <div
                aria-hidden="true"
                className="absolute -bottom-6 -right-6 hidden h-2/3 w-2/3 rounded-xl lg:block"
                style={{
                  backgroundColor: BLUE,
                  opacity: 0.1,
                }}
              />
              {/* Thin navy accent square behind the image (offset) */}
              <div
                aria-hidden="true"
                className="absolute -left-4 -top-4 hidden h-16 w-16 rounded-md border-2 lg:block"
                style={{ borderColor: NAVY, opacity: 0.2 }}
              />

              <div
                className="relative overflow-hidden rounded-xl transition-transform duration-500 hover:-translate-y-1"
                style={{
                  aspectRatio: '4 / 5',
                  backgroundColor: NAVY,
                  boxShadow:
                    '0 40px 80px -20px rgba(2,18,45,0.45), 0 0 0 1px rgba(2,18,45,0.08)',
                }}
              >
                <Image
                  src="/claims-hero.png"
                  alt="EnsureOS — unified workspace showing claims, analytics and workflow"
                  width={1024}
                  height={585}
                  priority
                  className="h-full w-full object-cover"
                  style={{ objectPosition: 'center' }}
                />
              </div>

              {/* Floating metric chip over the image */}
              <div
                className="cm-float absolute -left-4 bottom-10 hidden items-center gap-3 rounded-lg border bg-white p-3 pr-5 shadow-xl lg:flex"
                style={{ borderColor: LIGHT_GREY }}
              >
                <div
                  className="flex size-9 items-center justify-center rounded-md"
                  style={{ backgroundColor: `${BLUE}1a` }}
                >
                  <BarChart3 className="size-4" style={{ color: BLUE }} />
                </div>
                <div>
                  <div
                    className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: INK_MUTED }}
                  >
                    Job view
                  </div>
                  <div
                    className="text-sm font-bold"
                    style={{ color: INK }}
                  >
                    Unified across crews
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stat strip bridging hero to the next section (dark for alternation) */}
      <div
        className="relative"
        style={{
          backgroundColor: NAVY,
          boxShadow:
            '0 -10px 30px -15px rgba(2,18,45,0.4), 0 10px 30px -15px rgba(2,18,45,0.4)',
        }}
      >
        <div className="container mx-auto max-w-7xl px-6">
          <div
            className="grid grid-cols-2 divide-x md:grid-cols-4"
            style={{ color: SOFT_WHITE }}
          >
            <StatCell value="End-to-end" label="Scope to settlement" />
            <StatCell value="Real-time" label="Carrier & job updates" />
            <StatCell value="Built-in" label="Quotes, invoices, reports" />
            <StatCell value="Field-ready" label="Works anywhere crews work" />
          </div>
        </div>
      </div>
    </>
  );
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <div
      className="group flex flex-col items-center justify-center py-8 transition-colors duration-300"
      style={{ borderColor: 'rgba(214,221,228,0.12)' }}
    >
      <div
        className="text-3xl font-bold tracking-tight transition-transform duration-300 group-hover:scale-105 md:text-4xl"
        style={{ color: SOFT_WHITE }}
      >
        {value}
      </div>
      <div
        className="mt-1 text-xs font-medium uppercase tracking-widest"
        style={{ color: 'rgba(245,247,250,0.65)' }}
      >
        {label}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reusable: eyebrow + heading + body                                  */
/* ------------------------------------------------------------------ */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-4 text-sm font-medium uppercase tracking-widest"
      style={{ color: BLUE }}
    >
      {children}
    </p>
  );
}

function Heading({
  children,
  light = false,
}: {
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <h2
      className="mb-8 text-3xl font-bold tracking-tight md:text-4xl"
      style={{ color: light ? SOFT_WHITE : NAVY }}
    >
      {children}
    </h2>
  );
}

function BulletList({
  items,
  light = false,
}: {
  items: string[];
  light?: boolean;
}) {
  return (
    <ul className="mb-8 space-y-3">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-3"
          style={{ color: light ? SOFT_WHITE : NAVY }}
        >
          <span
            className="mt-1.5 size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: BLUE }}
          />
          <span className="text-base">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Section 1: Problem (light)                                          */
/* ------------------------------------------------------------------ */

function ProblemSection() {
  const items = [
    'Re-keying job details across carrier portals and internal systems',
    'Chasing subcontractor quotes, invoices and site documentation',
    'Manually building progress reports and evidence packs for carriers',
    'Tracking job assignments and carrier SLAs across spreadsheets and email',
  ];

  return (
    <section
      id="challenge"
      className="py-24 md:py-32"
      style={{ backgroundColor: '#ffffff' }}
    >
      <div className="container mx-auto max-w-7xl px-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-12 xl:gap-16">
          <div className="order-2 mt-12 shrink-0 lg:order-1 lg:mt-0 lg:w-[45%] xl:max-w-lg">
            <ProblemMock />
          </div>
          <div className="order-1 max-w-3xl flex-1 lg:order-2">
            <Eyebrow>The Problem</Eyebrow>
            <Heading>
              Fragmented tools slow down every insurance job.
            </Heading>
            <p
              className="mb-8 text-lg leading-relaxed"
              style={{ color: MUTED_FG }}
            >
              Contractors working on insurance claims juggle carrier portals,
              spreadsheets, shared drives and inboxes — with critical job
              information scattered across all of them.
            </p>
            <p
              className="mb-6 text-base leading-relaxed"
              style={{ color: MUTED_FG }}
            >
              Teams often spend substantial time on:
            </p>
            <BulletList items={items} />
            <p className="text-base leading-relaxed" style={{ color: MUTED_FG }}>
              This administrative overhead delays completion, squeezes margins
              and stretches the turnaround carriers expect from you.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Section 2: Unified records (dark/navy)                              */
/* ------------------------------------------------------------------ */

function UnifiedRecordsSection() {
  const items = [
    'Single record for every job, claim, quote, purchase order and invoice',
    'Site photos, scopes and attachments with version history',
    'Full audit trail across every action, approval and status change',
    'Native integrations with carrier and assessing platforms',
    'Powerful search and filtering across every active and closed job',
  ];

  return (
    <section
      id="platform"
      className="py-24 md:py-32"
      style={{ backgroundColor: NAVY, color: SOFT_WHITE }}
    >
      <div className="container mx-auto max-w-7xl px-6">
        <div className="grid items-start gap-16 md:grid-cols-2">
          <div>
            <Eyebrow>Unified Records</Eyebrow>
            <Heading light>
              From job assignment to final invoice — in one workspace.
            </Heading>
            <p
              className="mb-6 text-base leading-relaxed"
              style={{ color: 'rgba(245,247,250,0.6)' }}
            >
              EnsureOS brings every part of an insurance job together — scope,
              site photos, quotes, purchase orders, subcontractors, invoices and
              carrier communications — into a single, navigable record.
            </p>
            <p
              className="text-base leading-relaxed"
              style={{ color: 'rgba(245,247,250,0.6)' }}
            >
              The platform is designed to reduce manual coordination and give
              every estimator, coordinator and crew member a consistent,
              up-to-date view.
            </p>

            <div className="mt-10">
              <p
                className="mb-4 text-sm font-medium uppercase tracking-widest"
                style={{ color: BLUE }}
              >
                Core Capabilities
              </p>
              <BulletList items={items} light />
            </div>
          </div>

          <div className="relative">
            <ClaimsMock />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Section 3: Workflow (light)                                         */
/* ------------------------------------------------------------------ */

function WorkflowSectionBlock() {
  const items = [
    'Auto-assign jobs to crews and estimators by trade, region or carrier',
    'Carrier SLA tracking with proactive escalation',
    'Subcontractor dispatch, purchase orders and quote reconciliation',
    'Approval chains for variations, purchase orders and invoices',
  ];

  return (
    <section
      id="workflow"
      className="py-24 md:py-32"
      style={{ backgroundColor: '#ffffff' }}
    >
      <div className="container mx-auto max-w-7xl px-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-12 xl:gap-16">
          <div className="max-w-3xl flex-1">
            <Eyebrow>Automated Workflow</Eyebrow>
            <Heading>
              Orchestrate every job, from assignment to invoice.
            </Heading>
            <p
              className="mb-6 text-base leading-relaxed"
              style={{ color: MUTED_FG }}
            >
              Configure intake rules, crew assignments, carrier SLAs,
              approvals and notifications to match how your business actually
              operates — without writing code.
            </p>
            <p
              className="mb-8 text-base leading-relaxed"
              style={{ color: MUTED_FG }}
            >
              Workflows put the right work in front of the right person at the
              right time, so jobs keep moving.
            </p>
            <BulletList items={items} />
          </div>
          <div className="mt-12 shrink-0 lg:mt-0 lg:w-[45%] xl:max-w-lg">
            <WorkflowMock />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Section 4: Intelligence (slate — medium navy)                       */
/* ------------------------------------------------------------------ */

function IntelligenceSection() {
  const examples = [
    '"Show jobs exceeding the approved scope by more than 15% this quarter."',
    '"List open jobs with carrier SLAs breaching in the next 48 hours."',
    '"Summarise subcontractor performance by region, for the last 90 days."',
  ];

  return (
    <section
      id="reporting"
      className="py-24 md:py-32"
      style={{ backgroundColor: NAVY, color: SOFT_WHITE }}
    >
      <div className="container mx-auto max-w-7xl px-6">
        <div className="max-w-3xl">
          <Eyebrow>Operational Intelligence</Eyebrow>
          <Heading light>
            Real-time reporting across every job, crew and carrier.
          </Heading>
          <p
            className="mb-4 text-lg leading-relaxed"
            style={{ color: 'rgba(245,247,250,0.75)' }}
          >
            Structured, queryable data replaces stale spreadsheets and
            after-the-fact exports.
          </p>
          <p
            className="mb-10 text-base leading-relaxed"
            style={{ color: 'rgba(245,247,250,0.6)' }}
          >
            Ask operational questions and get immediate, verifiable answers
            — with every result linked back to the underlying jobs, quotes
            and documents.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {examples.map((q) => (
            <div
              key={q}
              className="rounded border p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/30 hover:shadow-xl hover:shadow-black/30"
              style={{
                borderColor: 'rgba(214,221,228,0.15)',
                backgroundColor: 'rgba(2,18,45,0.35)',
              }}
            >
              <p
                className="text-sm leading-relaxed"
                style={{ color: SOFT_WHITE }}
              >
                <span className="mr-2" style={{ color: BLUE }}>
                  →
                </span>
                {q}
              </p>
            </div>
          ))}
        </div>

        <p
          className="mt-10 max-w-3xl text-base leading-relaxed"
          style={{ color: 'rgba(245,247,250,0.6)' }}
        >
          All results retain links to the underlying jobs, documents and
          events — so every number is traceable and every insight is auditable.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Section 5: Professional standards (light, 2x2)                      */
/* ------------------------------------------------------------------ */

function ProfessionalSection() {
  const features: { icon: typeof Shield; title: string; desc: string }[] = [
    {
      icon: Lock,
      title: 'Enterprise-grade security',
      desc: 'SSO, role-based access, encryption at rest and in transit, and immutable audit logs — ready for carrier security reviews.',
    },
    {
      icon: FileText,
      title: 'Traceable job records',
      desc: 'Every document, photo, variation, approval and communication is linked to its job and timestamped for review.',
    },
    {
      icon: Users,
      title: 'Controlled collaboration',
      desc: 'Job-level permissions and granular role definitions keep the right people in, and the wrong people out.',
    },
    {
      icon: Shield,
      title: 'Built for carrier-grade operations',
      desc: 'Designed to meet the documentation, auditability and turnaround requirements carriers expect from their contractors.',
    },
  ];

  return (
    <section
      id="security"
      className="py-24 md:py-32"
      style={{ backgroundColor: '#ffffff' }}
    >
      <div className="container mx-auto max-w-7xl px-6">
        <div className="max-w-3xl">
          <Eyebrow>Professional Standards</Eyebrow>
          <Heading>Designed for regulated, high-trust environments.</Heading>
          <p
            className="mb-16 text-lg leading-relaxed"
            style={{ color: MUTED_FG }}
          >
            EnsureOS is built to support the confidentiality, auditability
            and operational rigour that carriers expect from every contractor
            working on their claims.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded border bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-xl"
              style={{ borderColor: LIGHT_GREY }}
            >
              <div
                className="mb-5 flex size-10 items-center justify-center rounded shadow-md transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
                style={{ backgroundColor: BLUE }}
              >
                <f.icon className="size-5 text-white" strokeWidth={2} />
              </div>
              <h3
                className="mb-3 text-xl font-bold tracking-tight"
                style={{ color: NAVY }}
              >
                {f.title}
              </h3>
              <p
                className="text-base leading-relaxed"
                style={{ color: MUTED_FG }}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Section 6: Early access CTA (navy)                                  */
/* ------------------------------------------------------------------ */

function EarlyAccessCta() {
  return (
    <section
      id="early-access"
      className="py-24 md:py-32"
      style={{ backgroundColor: NAVY, color: SOFT_WHITE }}
    >
      <div className="container mx-auto max-w-7xl px-6">
        <div className="max-w-3xl">
          <Eyebrow>Get Started</Eyebrow>
          <Heading light>
            Bring every insurance job into a single, modern workspace.
          </Heading>
          <p
            className="mb-10 text-lg leading-relaxed"
            style={{ color: 'rgba(245,247,250,0.7)' }}
          >
            EnsureOS is now available to restoration, repair and assessing
            contractors. Create an account in minutes, or sign in to pick up
            where you left off.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="/api/auth/register"
              className="group inline-flex items-center rounded px-7 py-3.5 text-sm font-medium shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl"
              style={{ backgroundColor: BLUE, color: SOFT_WHITE }}
            >
              Get Started
              <ArrowRight className="ml-2 size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </a>
            <a
              href="/api/auth/login"
              className="inline-flex items-center rounded border px-7 py-3.5 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/5"
              style={{
                borderColor: 'rgba(214,221,228,0.2)',
                color: 'rgba(245,247,250,0.9)',
              }}
            >
              Sign In
            </a>
          </div>

          <div
            className="mt-12 flex flex-wrap gap-x-10 gap-y-3 text-sm"
            style={{ color: 'rgba(245,247,250,0.6)' }}
          >
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-4" style={{ color: BLUE }} />
              Set up in minutes
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-4" style={{ color: BLUE }} />
              No credit card required
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-4" style={{ color: BLUE }} />
              Purpose-built for contractors
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

function SiteFooter() {
  return (
    <footer
      className="py-8"
      style={{
        backgroundColor: NAVY,
        borderTop: `1px solid rgba(214,221,228,0.1)`,
      }}
    >
      <div className="container mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-6 sm:flex-row sm:items-center">
        <div
          className="flex items-center gap-2.5 text-sm"
          style={{ color: SOFT_WHITE }}
        >
          <LogoMark />
          <span className="font-semibold tracking-tight">EnsureOS</span>
        </div>
        <p className="text-xs" style={{ color: 'rgba(245,247,250,0.5)' }}>
          © {new Date().getFullYear()} EnsureOS. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Product mocks (clean, no glows)                                     */
/* ------------------------------------------------------------------ */

function ProblemMock() {
  const rows = [
    { label: 'Email inbox', count: '1,284 unread' },
    { label: 'Claims spreadsheet', count: 'v12_final.xlsx' },
    { label: 'Vendor portal', count: '18 pending quotes' },
    { label: 'Payments system', count: '42 reconciling' },
    { label: 'Document share', count: '9 folders synced' },
  ];
  return (
    <div
      className="rounded-lg border bg-white p-6 shadow-lg transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl"
      style={{ borderColor: LIGHT_GREY }}
    >
      <p
        className="mb-4 text-xs font-semibold uppercase tracking-widest"
        style={{ color: MUTED_FG }}
      >
        Today's backlog
      </p>
      <div className="space-y-3">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between rounded border px-4 py-3"
            style={{ borderColor: LIGHT_GREY, backgroundColor: '#ffffff' }}
          >
            <span className="text-sm font-medium" style={{ color: NAVY }}>
              {r.label}
            </span>
            <span className="text-xs" style={{ color: MUTED_FG }}>
              {r.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClaimsMock() {
  const rows = [
    {
      id: 'CLM-24817',
      name: 'Harper & Vale LLC',
      status: 'In review',
      amount: '$24,320',
    },
    {
      id: 'CLM-24814',
      name: 'Northbridge Holdings',
      status: 'Approved',
      amount: '$112,500',
    },
    {
      id: 'CLM-24809',
      name: 'Ridgefield Mfg.',
      status: 'Awaiting docs',
      amount: '$8,940',
    },
    {
      id: 'CLM-24803',
      name: 'Blue Harbor Rest.',
      status: 'Escalated',
      amount: '$63,200',
    },
  ];

  const statusColor: Record<string, { bg: string; fg: string }> = {
    'In review': { bg: '#fef3c7', fg: '#92400e' },
    Approved: { bg: '#d1fae5', fg: '#065f46' },
    'Awaiting docs': { bg: '#dbeafe', fg: '#1e40af' },
    Escalated: { bg: '#fee2e2', fg: '#991b1b' },
  };

  return (
    <div
      className="overflow-hidden rounded-lg bg-white shadow-2xl transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-15px_rgba(2,18,45,0.5)]"
      style={{ border: `1px solid ${LIGHT_GREY}` }}
    >
      <div
        className="flex items-center justify-between border-b px-5 py-4"
        style={{ borderColor: LIGHT_GREY, backgroundColor: '#ffffff' }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: NAVY }}>
            Active claims
          </p>
          <p className="text-xs" style={{ color: MUTED_FG }}>
            284 open · 12 requiring action
          </p>
        </div>
        <span
          className="rounded px-3 py-1.5 text-xs font-medium"
          style={{ backgroundColor: BLUE, color: SOFT_WHITE }}
        >
          New claim
        </span>
      </div>
      <div
        className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
        style={{ borderColor: LIGHT_GREY, color: MUTED_FG }}
      >
        <span>Claim</span>
        <span>Insured</span>
        <span>Status</span>
        <span className="text-right">Amount</span>
      </div>
      {rows.map((r, i) => (
        <div
          key={r.id}
          className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-5 py-3 text-sm"
          style={{
            borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${LIGHT_GREY}`,
          }}
        >
          <span
            className="font-mono text-xs"
            style={{ color: BLUE }}
          >
            {r.id}
          </span>
          <span style={{ color: NAVY }}>{r.name}</span>
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            style={{
              backgroundColor: statusColor[r.status]?.bg,
              color: statusColor[r.status]?.fg,
            }}
          >
            {r.status}
          </span>
          <span
            className="text-right font-semibold"
            style={{ color: NAVY }}
          >
            {r.amount}
          </span>
        </div>
      ))}
    </div>
  );
}

function WorkflowMock() {
  const steps = [
    { title: 'Intake received', meta: 'Webhook · 2m ago', done: true },
    { title: 'Assigned to A. Chen', meta: 'Rule: High-value', done: true },
    { title: 'Vendor dispatched', meta: 'RidgeFix · awaiting', done: true },
    { title: 'Quote received', meta: 'Review in progress', done: false },
    { title: 'Approve & pay', meta: 'Requires manager', done: false },
  ];

  return (
    <div
      className="rounded-lg border bg-white p-6 shadow-lg transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl"
      style={{ borderColor: LIGHT_GREY }}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: NAVY }}>
            CLM-24817 · Workflow
          </p>
          <p className="text-xs" style={{ color: MUTED_FG }}>
            Auto-property · High value · Step 3 of 5
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Workflow className="size-4" style={{ color: BLUE }} />
          <span className="text-xs font-medium" style={{ color: BLUE }}>
            ON TRACK
          </span>
        </div>
      </div>

      <ol className="relative space-y-5 pl-8">
        <span
          className="absolute left-[11px] top-2 bottom-2 w-px"
          style={{ backgroundColor: LIGHT_GREY }}
        />
        {steps.map((s, i) => (
          <li key={i} className="relative">
            <span
              className="absolute -left-7 top-0.5 flex size-6 items-center justify-center rounded-full border-2 bg-white"
              style={{
                borderColor: s.done ? BLUE : LIGHT_GREY,
                backgroundColor: s.done ? BLUE : '#ffffff',
              }}
            >
              {s.done ? (
                <CheckCircle2
                  className="size-3.5"
                  style={{ color: SOFT_WHITE }}
                  strokeWidth={3}
                />
              ) : (
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: LIGHT_GREY }}
                />
              )}
            </span>
            <p
              className="text-sm font-medium"
              style={{
                color: s.done ? NAVY : MUTED_FG,
              }}
            >
              {s.title}
            </p>
            <p className="text-xs" style={{ color: MUTED_FG }}>
              {s.meta}
            </p>
          </li>
        ))}
      </ol>

      <div
        className="mt-6 flex items-center justify-between border-t pt-4 text-xs"
        style={{ borderColor: LIGHT_GREY, color: MUTED_FG }}
      >
        <span className="inline-flex items-center gap-2">
          <BarChart3 className="size-3.5" style={{ color: BLUE }} />
          SLA: 48h remaining
        </span>
        <span>Last updated · 2 min ago</span>
      </div>
    </div>
  );
}
