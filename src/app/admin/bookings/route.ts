import { NextRequest } from "next/server";
import { getStore } from "@/lib/store";
import { DEMO_PREFIX, type Booking } from "@/lib/seed";
import type { InvoiceDraft } from "@/lib/bookings";
import { adminPage, esc, requireBasicAuth } from "../_lib/adminPage";

export const dynamic = "force-dynamic";

/**
 * Bookings + CRM table + invoice drafts (spec 01 §5/§7). The CRM is a KV
 * collection presented as a CRM table, per spec.
 */

interface CrmRow {
  id: string;
  contact: string;
  bookingReference: string;
  service: string;
  location: string;
  provider: string;
  window: string;
  stage: string;
  source: string;
  createdAt: string;
}

export async function GET(req: NextRequest) {
  const denied = requireBasicAuth(req);
  if (denied) return denied;

  const store = getStore();
  const [bookings, crm, invoices] = await Promise.all([
    store.listRange<Booking>(`${DEMO_PREFIX}bookings`, 0, -1),
    store.listRange<CrmRow>(`${DEMO_PREFIX}crm`, 0, -1),
    store.listRange<InvoiceDraft>(`${DEMO_PREFIX}invoices`, 0, -1),
  ]);

  const bookingRows = bookings
    .slice(-50)
    .reverse()
    .map(
      (b) => `<tr>
      <th scope="row">${esc(b.reference)}</th>
      <td>${esc(b.service)}</td>
      <td>${esc(b.location)}</td>
      <td>${esc(b.provider)}</td>
      <td>${esc(b.window)}</td>
      <td>${b.seeded ? '<span class="badge neutral">seeded</span>' : '<span class="badge ok">concierge</span>'}</td>
      <td><span class="badge ${b.status === "confirmed" ? "ok" : "warn"}">${esc(b.status)}</span></td>
    </tr>`,
    )
    .join("");

  const crmRows = crm
    .slice(-50)
    .reverse()
    .map(
      (c) => `<tr>
      <th scope="row">${esc(c.bookingReference)}</th>
      <td>${esc(c.contact)}</td>
      <td>${esc(c.stage)}</td>
      <td>${esc(c.service)} · ${esc(c.location)}</td>
      <td>${esc(c.source)}</td>
      <td>${esc(c.createdAt.replace("T", " ").slice(0, 19))} UTC</td>
    </tr>`,
    )
    .join("");

  const invoiceRows = invoices
    .slice(-50)
    .reverse()
    .map(
      (i) => `<tr>
      <th scope="row">${esc(i.id)}</th>
      <td>${esc(i.reference)}</td>
      <td>${i.lineItems.map((l) => esc(`${l.description} — $${l.amountUsd}`)).join("<br>")}</td>
      <td>$${i.totalUsd}</td>
      <td><span class="badge neutral">${esc(i.status)}</span></td>
    </tr>`,
    )
    .join("");

  const body = `
<h1>Bookings &amp; CRM</h1>

<h2>Bookings</h2>
<div class="table-wrap">
<table>
  <thead><tr><th scope="col">Reference</th><th scope="col">Service</th><th scope="col">Location</th><th scope="col">Provider</th><th scope="col">Preferred window</th><th scope="col">Origin</th><th scope="col">Status</th></tr></thead>
  <tbody>${bookingRows || '<tr><td colspan="7" class="muted">No bookings.</td></tr>'}</tbody>
</table>
</div>

<h2>CRM</h2>
<div class="table-wrap">
<table>
  <thead><tr><th scope="col">Booking</th><th scope="col">Contact</th><th scope="col">Stage</th><th scope="col">Details</th><th scope="col">Source</th><th scope="col">Created</th></tr></thead>
  <tbody>${crmRows || '<tr><td colspan="6" class="muted">No CRM rows yet (seeded bookings predate the chain).</td></tr>'}</tbody>
</table>
</div>

<h2>Invoice drafts</h2>
<div class="table-wrap">
<table>
  <thead><tr><th scope="col">Invoice</th><th scope="col">Booking</th><th scope="col">Line items</th><th scope="col">Total</th><th scope="col">Status</th></tr></thead>
  <tbody>${invoiceRows || '<tr><td colspan="5" class="muted">No invoices yet.</td></tr>'}</tbody>
</table>
</div>`;
  return adminPage({
    title: "Bookings & CRM",
    active: "/admin/bookings",
    body,
  });
}
