# 00 — Authentication & Application Shell

**Source:** Crunchwork Pulse vendor portal — staging-iag (observed 2026-06-07)
**URL:** `https://staging-iag.crunchwork.com`

---

## 1. Authentication Flow

### 1.1 Login Selection Page

- **URL:** `https://staging-iag.crunchwork.com/login`
- **Background:** Dark grey/charcoal gradient (#3f4447 → #555859)
- **Layout:** Centred white modal card (~350–400px wide, rounded corners, subtle shadow)

| Element | Description |
|---------|-------------|
| Logo | Crunchwork colourful logo — turquoise, orange, yellow bars forming stylised "C" (~60–80px) |
| Heading | "Select your option" — centred below logo |
| Button 1 | "IAG" — full width, light grey background, dark text |
| Button 2 | "IAG SSO" — identical style, below first button |

### 1.2 Login Form (IAG credentials)

- **URL:** `https://staging-iag.crunchwork.com/login/iag`
- **Auth widget:** Auth0 Lock (`auth0-lock-*` CSS classes)

| Element | Type | Details |
|---------|------|---------|
| Close button | × icon | Top-right corner |
| Email input | `email` | Placeholder: "email", envelope icon left |
| Password input | `password` | Placeholder: "password", padlock icon left |
| Forgot link | Text link | "Don't remember your password?" — turquoise |
| Sign In button | Submit | "SIGN IN >" — full width, turquoise bg (#00C9A7), white text |

### 1.3 Colour Scheme (Auth pages)

| Token | Colour | Usage |
|-------|--------|-------|
| Brand primary | #00C9A7 (turquoise/teal) | Buttons, links, focus states |
| Page background | #3f4447 → #555859 | Dark gradient |
| Modal background | #FFFFFF | Card surface |
| Input border | #DDDDDD | Default state |
| Input focus | Brand primary | Border highlight |

---

## 2. Application Shell (Authenticated)

### 2.1 Top Navigation Bar (Green)

```
┌──────────────────────────────────────────────────────────────┐
│ [☰ Hamburger] [Projects] [Jobs]        [Dave Adams - Vendor] │
└──────────────────────────────────────────────────────────────┘
```

- **Background colour:** Green (#2E7D32 approx)
- **Left side:** Hamburger menu (☰), "Projects" tab, "Jobs" tab
- **Right side:** User menu showing "{name} - Vendor" with settings/logout

### 2.2 Hamburger Menu (☰) — Sidebar Navigation

Opened by clicking the hamburger icon. Contains:

| Item | Description |
|------|-------------|
| Calendar | Calendar/schedule view |
| Contacts | Contact management |
| Dashboards | Reporting dashboards |
| **Invoices** | Invoice list and management |
| Pulse | Main pulse app (projects/jobs) |
| **Purchase Orders** | PO list and management |
| **Quotes** | Quote list and management |
| Report Writer | Report generation |

### 2.3 Content Area Layout

**List pages:**
```
┌──────────────────────────────────────────────────────────────┐
│ [Top Navigation Bar - Green]                                  │
├────────────┬─────────────────────────────────────────────────┤
│ Left Filter│  Search Results         Total Item Count: XXXX  │
│ Sidebar    │  ┌─────────────────────────────────────────────┐│
│            │  │ Table with sortable columns                  ││
│ Search...  │  │                                              ││
│ [Type  ▼]  │  │ Row 1   ...   [EDIT]                        ││
│ Reference  │  │ Row 2   ...   [EDIT]                        ││
│ Search     │  │ ...                                          ││
│            │  ├─────────────────────────────────────────────┤│
│ Filter By: │  │ Pagination: 1 2 3 4 ... N                   ││
│ • Reference│  └─────────────────────────────────────────────┘│
│ • Account  │                                                  │
│ • Zone     │                                                  │
│ • User     │                                                  │
│ • Status   │                                                  │
│            │                                                  │
│ [CLEAR]    │                                                  │
└────────────┴─────────────────────────────────────────────────┘
```

**Detail pages:**
```
┌──────────────────────────────────────────────────────────────┐
│ [Top Navigation Bar - Green]                                  │
├──────────────────────────────────────────────────────────────┤
│ Header: {Org} | {Type} | {Reference} | {Address}             │
│ [ACCOUNT ▼] [ZONE ▼] [Status Badge] [TEAMS] [CREATE] [Save] │
├──────────────────────────────────────────────────────────────┤
│ [OVERVIEW] [JOBS] [COMMUNICATIONS] [ACTIVITIES] [...] [...]  │
├───────────────────────────────────────────────┬──────────────┤
│ Tab Content Area                              │ Right Sidebar│
│                                               │              │
│ Sections (collapsible):                       │ DETAILS      │
│ - Basic Information                           │ Team Member  │
│ - Incident Information                        │ Address      │
│ - Policy Information                          │ [Google Map] │
│ - Contacts                                    │              │
│                                               │              │
└───────────────────────────────────────────────┴──────────────┘
```

### 2.4 Common UI Elements

| Element | Style |
|---------|-------|
| Action buttons | Dark teal/blue-green background, white text |
| Status badges | Yellow (Allocated), Green (Approved/Completed), Red (Resubmission Required), Blue (Published) |
| Date format | dd/mm/yyyy with calendar picker |
| Rich text | TinyMCE editor with full formatting toolbar |
| Dropdowns | "Please select" placeholder |
| Boolean fields | Yes/No radio button groups |
| Toggle switches | For view options (e.g., "COMPACT VIEW") |
| Sortable columns | ↕ arrow indicator in header |
| Pagination | Page numbers at bottom (1, 2, 3, 4, ..., N) |
| CLEAR/RESET | Link-style buttons to reset filters |
