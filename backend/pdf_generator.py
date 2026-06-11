"""Professional PDF generator for invoices using ReportLab.

Layout matches PT. ARRAZZAQ OCEAN GLOBAL Excel template:
- Top: Logo (left) + "INVOICE" title (right)
- Meta row: "TO" client info (left) + Invoice Number/Date (right)
- Remarks line
- Item table: NO | DESCRIPTION | RANK | DATE | QTY | PRICE | AMOUNT
- Bottom: Bank info (left) + TOTAL & Total Amount in (currency) (right)
- Signature area: name / title
"""
from __future__ import annotations

import io
import os
from pathlib import Path
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image as RLImage,
    KeepTogether,
)
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
import requests

CURRENCY_SYMBOLS = {
    "USD": "$",
    "IDR": "Rp",
    "SGD": "S$",
    "EUR": "€",
    "MYR": "RM",
    "JPY": "¥",
    "CNY": "¥",
}


def _fmt_money(amount: float, currency: str) -> str:
    sym = CURRENCY_SYMBOLS.get(currency, currency + " ")
    if currency == "IDR":
        return f"{sym} {amount:,.0f}"
    return f"{sym} {amount:,.2f}"


def _fetch_logo(logo_url: str) -> Optional[io.BytesIO]:
    if not logo_url:
        return None
    try:
        r = requests.get(logo_url, timeout=10)
        if r.status_code == 200:
            return io.BytesIO(r.content)
    except Exception:
        return None
    return None


NAVY = colors.HexColor("#0B1E36")
SLATE_900 = colors.HexColor("#0F172A")
SLATE_500 = colors.HexColor("#64748B")
SLATE_50 = colors.HexColor("#F8FAFC")
SLATE_200 = colors.HexColor("#E2E8F0")
AMBER = colors.HexColor("#F59E0B")


def generate_invoice_pdf(
    invoice: dict,
    client: dict,
    company: dict,
    created_by_name: str = "",
    output_path: Optional[str] = None,
) -> bytes:
    """Generate invoice PDF. Returns bytes; optionally writes to output_path."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        title=invoice.get("invoice_number", "Invoice"),
        author=company.get("company_name", ""),
    )

    elements = []

    # ---- HEADER ----
    logo_stream = _fetch_logo(company.get("logo_url", ""))
    if logo_stream:
        try:
            logo_img = RLImage(logo_stream, width=32 * mm, height=32 * mm, kind="proportional")
        except Exception:
            logo_img = Paragraph(
                f"<b>{company.get('company_name', '')}</b>",
                ParagraphStyle("co", fontSize=11, textColor=NAVY),
            )
    else:
        logo_img = Paragraph(
            f"<b>{company.get('company_name', '')}</b>",
            ParagraphStyle("co", fontSize=11, textColor=NAVY),
        )

    company_info_text = (
        f"<b><font size=12 color='#0B1E36'>{company.get('company_name', '')}</font></b><br/>"
        f"<font size=8 color='#64748B'>{company.get('address', '')}</font>"
    )
    if company.get("phone"):
        company_info_text += f"<br/><font size=8 color='#64748B'>Phone: {company['phone']}</font>"
    if company.get("email"):
        company_info_text += f"<br/><font size=8 color='#64748B'>Email: {company['email']}</font>"

    company_block = Paragraph(company_info_text, ParagraphStyle("cinfo", fontSize=8, leading=11))

    invoice_title = Paragraph(
        "<b>INVOICE</b>",
        ParagraphStyle(
            "title",
            fontName="Helvetica-Bold",
            fontSize=28,
            textColor=NAVY,
            alignment=TA_RIGHT,
        ),
    )

    header_table = Table(
        [[logo_img, company_block, invoice_title]],
        colWidths=[36 * mm, 80 * mm, 58 * mm],
    )
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (2, 0), (2, 0), "RIGHT"),
                ("LINEBELOW", (0, 0), (-1, -1), 1.5, NAVY),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    elements.append(header_table)
    elements.append(Spacer(1, 6 * mm))

    # ---- META: client (left) + invoice info (right) ----
    label_style = ParagraphStyle(
        "label",
        fontSize=8,
        textColor=SLATE_500,
        fontName="Helvetica-Bold",
        spaceAfter=2,
    )
    value_style = ParagraphStyle(
        "val",
        fontSize=10,
        textColor=SLATE_900,
        fontName="Helvetica",
    )
    value_bold = ParagraphStyle(
        "valb",
        fontSize=10,
        textColor=SLATE_900,
        fontName="Helvetica-Bold",
    )

    client_block_text = f"<b>{client.get('company_name', '')}</b>"
    if invoice.get("attention"):
        client_block_text += f"<br/>Attn: {invoice['attention']}"
    elif client.get("contact_person"):
        client_block_text += f"<br/>Attn: {client['contact_person']}"
    if client.get("address"):
        client_block_text += f"<br/>{client['address']}"
    if client.get("country"):
        client_block_text += f"<br/>{client['country']}"
    if client.get("phone"):
        client_block_text += f"<br/>Phone: {client['phone']}"
    if client.get("email"):
        client_block_text += f"<br/>Email: {client['email']}"

    client_block = [
        Paragraph("TO", label_style),
        Paragraph(client_block_text, value_style),
    ]

    inv_meta_rows = [
        ["INVOICE NUMBER", invoice.get("invoice_number", "")],
        ["DATE", invoice.get("invoice_date", "")],
    ]
    if invoice.get("due_date"):
        inv_meta_rows.append(["DUE DATE", invoice["due_date"]])
    if invoice.get("vessel"):
        inv_meta_rows.append(["VESSEL", invoice["vessel"]])
    if invoice.get("voyage"):
        inv_meta_rows.append(["VOYAGE", invoice["voyage"]])
    if invoice.get("port"):
        inv_meta_rows.append(["PORT", invoice["port"]])

    inv_meta_table = Table(
        [[Paragraph(k, label_style), Paragraph(str(v), value_bold)] for k, v in inv_meta_rows],
        colWidths=[34 * mm, 50 * mm],
    )
    inv_meta_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )

    meta_row = Table(
        [[client_block, inv_meta_table]],
        colWidths=[90 * mm, 84 * mm],
    )
    meta_row.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    elements.append(meta_row)
    elements.append(Spacer(1, 4 * mm))

    if invoice.get("remarks"):
        rem_table = Table(
            [[Paragraph("REMARKS", label_style), Paragraph(invoice["remarks"], value_style)]],
            colWidths=[34 * mm, 140 * mm],
        )
        rem_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        elements.append(rem_table)
        elements.append(Spacer(1, 4 * mm))

    # ---- ITEM TABLE ----
    item_header = ["NO", "DESCRIPTION", "RANK", "DATE", "QTY", "PRICE", "AMOUNT"]
    item_data = [item_header]

    items = invoice.get("items", [])
    desc_style = ParagraphStyle("d", fontSize=9, textColor=SLATE_900, leading=11)

    for idx, it in enumerate(items, start=1):
        qty = float(it.get("quantity") or 0)
        price = float(it.get("price") or 0)
        amount = qty * price
        cur = it.get("currency", "USD")
        item_data.append(
            [
                str(idx),
                Paragraph(it.get("description", ""), desc_style),
                it.get("rank", "") or "",
                it.get("date", "") or "",
                f"{qty:g}",
                _fmt_money(price, cur),
                _fmt_money(amount, cur),
            ]
        )

    # pad to at least 8 rows for visual consistency
    while len(item_data) < 9:
        item_data.append(["", "", "", "", "", "", ""])

    item_table = Table(
        item_data,
        colWidths=[10 * mm, 60 * mm, 22 * mm, 22 * mm, 14 * mm, 22 * mm, 24 * mm],
        repeatRows=1,
    )
    item_table.setStyle(
        TableStyle(
            [
                # Header
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 9),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 7),
                ("TOPPADDING", (0, 0), (-1, 0), 7),
                # Body
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 1), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 1), (0, -1), "CENTER"),
                ("ALIGN", (2, 1), (4, -1), "CENTER"),
                ("ALIGN", (5, 1), (6, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.5, SLATE_200),
                ("BOX", (0, 0), (-1, -1), 1.0, NAVY),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SLATE_50]),
                ("TOPPADDING", (0, 1), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
            ]
        )
    )
    elements.append(item_table)
    elements.append(Spacer(1, 4 * mm))

    # ---- TOTALS ----
    total_cur = invoice.get("total_currency", "USD")
    subtotal = float(invoice.get("subtotal") or 0)
    tax_amount = float(invoice.get("tax_amount") or 0)
    discount = float(invoice.get("discount_amount") or 0)
    grand_total = float(invoice.get("grand_total") or 0)
    tax_pct = float(invoice.get("tax_percent") or 0)
    by_cur = invoice.get("subtotal_by_currency") or {}

    totals_rows = []
    # Subtotal — show per-currency breakdown
    if by_cur:
        first = True
        for cur, amt in by_cur.items():
            label = "SUBTOTAL" if first else ""
            totals_rows.append([label, _fmt_money(float(amt), cur)])
            first = False
        totals_rows.append([f"CONVERTED ({total_cur})", _fmt_money(subtotal, total_cur)])
    else:
        totals_rows.append(["SUBTOTAL", _fmt_money(subtotal, total_cur)])

    if tax_pct or tax_amount:
        totals_rows.append([f"TAX ({tax_pct:g}%)", _fmt_money(tax_amount, total_cur)])
    if discount:
        totals_rows.append(["DISCOUNT", "- " + _fmt_money(discount, total_cur)])
    totals_rows.append([f"GRAND TOTAL ({total_cur})", _fmt_money(grand_total, total_cur)])

    totals_table = Table(totals_rows, colWidths=[42 * mm, 32 * mm])
    totals_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -2), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, -1), (-1, -1), 11),
                ("TEXTCOLOR", (0, -1), (-1, -1), NAVY),
                ("BACKGROUND", (0, -1), (-1, -1), SLATE_50),
                ("LINEABOVE", (0, -1), (-1, -1), 1.2, NAVY),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("ALIGN", (0, 0), (0, -1), "LEFT"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )

    # ---- BANK INFO + TOTALS side by side ----
    bank = company.get("bank") or {}
    bank_text = (
        f"<b><font color='#0B1E36'>PAYMENT INFORMATION</font></b><br/><br/>"
        f"<b>Beneficiary:</b> {bank.get('beneficiary', '')}<br/>"
        f"<b>Bank Name:</b> {bank.get('bank_name', '')}<br/>"
        f"<b>Acc. Number:</b> {bank.get('account_number', '')}<br/>"
        f"<b>Swift Code:</b> {bank.get('swift_code', '')}<br/>"
        f"<b>Address:</b> {bank.get('address', '')}<br/>"
        f"<b>Country:</b> {bank.get('country', '')}"
    )
    bank_block = Paragraph(bank_text, ParagraphStyle("bank", fontSize=9, leading=13))

    pay_row = Table(
        [[bank_block, totals_table]],
        colWidths=[100 * mm, 74 * mm],
    )
    pay_row.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    elements.append(pay_row)
    elements.append(Spacer(1, 14 * mm))

    # ---- SIGNATURE ----
    sig_name = company.get("signature_name", "Mrs. Yuni Alimuddin")
    sig_title = company.get("signature_title", "General Manager")
    sig_block = Paragraph(
        f"<br/><br/><br/><br/><b>{sig_name}</b><br/>{sig_title}",
        ParagraphStyle("sig", fontSize=9, alignment=TA_CENTER, leading=12),
    )
    sig_table = Table(
        [[Paragraph("Authorized Signature", ParagraphStyle("a", fontSize=8, alignment=TA_CENTER, textColor=SLATE_500))],
         [sig_block]],
        colWidths=[60 * mm],
    )
    sig_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("LINEABOVE", (0, 1), (-1, 1), 0.7, SLATE_900),
                ("TOPPADDING", (0, 1), (-1, 1), 4),
            ]
        )
    )

    sig_row = Table(
        [[Paragraph(f"<font color='#64748B' size=8>Created by: {created_by_name}</font>", value_style), sig_table]],
        colWidths=[114 * mm, 60 * mm],
    )
    sig_row.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ]
        )
    )
    elements.append(sig_row)

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    if output_path:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(pdf_bytes)

    return pdf_bytes
