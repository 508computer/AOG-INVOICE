# PRD — PT. ARRAZZAQ OCEAN GLOBAL · Invoice Management System

## Original Problem Statement
Build a professional, production-ready Invoice Management System for PT. ARRAZZAQ OCEAN GLOBAL (Indonesian shipping/logistics). Features required: Login page, Dashboard with KPIs, multi-currency invoices (USD, IDR, SGD, EUR, MYR, JPY, CNY) with manual exchange rates, auto invoice numbering `INV/{CLIENT_INITIAL}/{YYYY}/{MM}/{XXX}`, Client Management, User Management with Admin/Staff roles, Company Settings (bank info, logo), PDF export saved to `INVOICE DATA/YYYY/MM/`. Item table follows the company Excel template (NO, DESCRIPTION, RANK, DATE, QTY, PRICE, AMOUNT). Brand colors: deep navy + amber.

## Architecture
- **Frontend**: React 19 + React Router 7 + Tailwind + Shadcn-style components + sonner (toasts) + axios + lucide-react icons
- **Backend**: FastAPI + Motor (async MongoDB) + bcrypt + python-jose (JWT) + ReportLab (PDF)
- **Database**: MongoDB (collections: users, clients, invoices, exchange_rates, company_settings)
- **PDF storage**: `/app/INVOICE DATA/{YYYY}/{MM}/INV-<initial>-<YYYY>-<MM>-<NNN>.pdf`
- **Auth**: JWT (HS256, 8h normal, 7d with remember_me), bcrypt password hashing
- **RBAC**: Admin (full access) / Staff (create invoice + view + clients only)

## User Personas
- **Admin** (Finance/Manager): Manages users, clients, currency settings, company info, edits/deletes invoices, signs off via signature block (Mrs. Yuni Alimuddin / General Manager).
- **Staff** (Operations): Creates invoices for known clients, views & prints PDFs.

## Core Requirements (Static)
1. Multi-currency line items with user-defined manual exchange rates (no external API).
2. Auto invoice number generation per client + month with collision-safe sequence.
3. Server-side PDF generation matching the company Excel template (with company logo, bank block, signature, item grid).
4. Persisted PDF on disk + downloadable on demand.
5. RBAC enforced on backend (require_admin) AND frontend (AdminOnly route wrapper).

## What's Been Implemented (2026-06-11)
- [x] **Backend**: All CRUD endpoints — auth (login + me), users, clients, exchange-rates, invoices, company-settings, uploads/logo, dashboard/summary, invoices/{id}/pdf.
- [x] Default admin auto-seeded: `admin` / `admin123`.
- [x] Default company settings + default exchange rates seeded on first boot.
- [x] Invoice number generator with regex-safe sequence per `INV/{INITIAL}/{YYYY}/{MM}/`.
- [x] Multi-currency subtotal computation using per-invoice rate snapshot.
- [x] ReportLab PDF generator (A4) matching Excel template layout.
- [x] PDF saved to `/app/INVOICE DATA/YYYY/MM/`.
- [x] **Frontend**: Login + Dashboard + Invoices list + Invoice form + Invoice view + Clients + Users + Exchange Rates + Settings, all with data-testids and the navy/amber design system (Chivo + IBM Plex Sans).
- [x] Sidebar (admin items conditionally rendered), Topbar, toast system, file upload for logo, print-friendly invoice preview.
- [x] **Testing**: 24/24 backend pytests passing. Frontend smoke (login → dashboard → KPIs → all 6 nav links → client creation → invoice list → invoice view → logout) ✅. Staff RBAC redirects verified.

## Backlog (P1 — next iterations)
- Replace native HTML date inputs with shadcn `Calendar` + Popover for visual consistency.
- Pagination + server-side filters for `/api/invoices` once volume grows.
- Optional: email PDF to client via Resend/SendGrid.
- Optional: dashboard charts (revenue by month/currency) — `recharts` already installed.
- Optional: invoice templates / saved presets for repeat shipping services.

## Backlog (P2)
- Background scheduler to auto-mark overdue invoices.
- Multi-language PDF (English/Bahasa Indonesia).
- Bulk operations (mark paid / export CSV).
- Audit log for who edited what (Admin trace).

## Next Tasks
1. Polish: shadcn DatePicker for `invoice_date`, `due_date`, item dates.
2. Add revenue-by-month bar chart on dashboard (recharts).
3. Email invoice as PDF attachment via Resend.
4. Add CSV export of invoice list.
