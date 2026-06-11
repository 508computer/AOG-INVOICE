"""FastAPI server for PT. ARRAZZAQ OCEAN GLOBAL — Invoice Management System."""
from __future__ import annotations

import logging
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles

from models import (
    LoginRequest,
    LoginResponse,
    UserCreate,
    UserOut,
    UserUpdate,
    UserPasswordReset,
    ClientCreate,
    ClientOut,
    ClientUpdate,
    ExchangeRateCreate,
    ExchangeRateOut,
    InvoiceCreate,
    InvoiceUpdate,
    InvoiceOut,
    InvoiceItem,
    CompanySettings,
    CompanySettingsUpdate,
    BankInfo,
)
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_admin,
)
from pdf_generator import generate_invoice_pdf


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---- Mongo ----
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ---- App / Router ----
app = FastAPI(title="ARRAZZAQ Invoice Management System")
api_router = APIRouter(prefix="/api")

# ---- File storage ----
INVOICE_DATA_DIR = Path("/app/INVOICE DATA")
INVOICE_DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR = Path("/app/backend/uploads")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Mount uploads as static
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ============================================================
# STARTUP - seed default admin & settings
# ============================================================
@app.on_event("startup")
async def on_startup():
    # Indexes
    await db.users.create_index("username", unique=True)
    await db.users.create_index("email", unique=True)
    await db.invoices.create_index("invoice_number", unique=True)
    await db.exchange_rates.create_index(
        [("from_currency", 1), ("to_currency", 1)], unique=True
    )

    # Seed default admin
    existing = await db.users.find_one({"username": "admin"})
    if not existing:
        admin = {
            "id": str(uuid.uuid4()),
            "full_name": "System Administrator",
            "username": "admin",
            "email": "admin@arrazzaqocean.com",
            "phone": "",
            "role": "admin",
            "is_active": True,
            "password_hash": hash_password("admin123"),
            "created_at": now_iso(),
        }
        await db.users.insert_one(admin)
        logging.info("Default admin created: admin / admin123")

    # Seed company settings
    settings = await db.company_settings.find_one({"_id": "default"})
    if not settings:
        default = CompanySettings().model_dump()
        default["_id"] = "default"
        default["logo_url"] = (
            "https://customer-assets.emergentagent.com/job_ac753fe0-5828-47a8-9e17-f0b9d7689f39/artifacts/4g43cxl1_logo.png"
        )
        await db.company_settings.insert_one(default)
        logging.info("Default company settings created.")

    # Seed default exchange rates (USD base)
    if await db.exchange_rates.count_documents({}) == 0:
        defaults = [
            ("USD", "IDR", 16500.0),
            ("SGD", "IDR", 12300.0),
            ("EUR", "IDR", 18100.0),
            ("MYR", "IDR", 3500.0),
            ("JPY", "IDR", 110.0),
            ("CNY", "IDR", 2280.0),
            ("USD", "USD", 1.0),
            ("IDR", "IDR", 1.0),
        ]
        for f, t, r in defaults:
            await db.exchange_rates.insert_one(
                {
                    "id": str(uuid.uuid4()),
                    "from_currency": f,
                    "to_currency": t,
                    "rate": r,
                    "updated_at": now_iso(),
                }
            )


# ============================================================
# AUTH
# ============================================================
@api_router.post("/auth/login", response_model=LoginResponse)
async def login(payload: LoginRequest):
    user = await db.users.find_one({"username": payload.username})
    if not user or not user.get("is_active", True):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    token = create_access_token(
        user_id=user["id"],
        username=user["username"],
        role=user["role"],
        remember_me=bool(payload.remember_me),
    )
    user_out = UserOut(
        id=user["id"],
        full_name=user["full_name"],
        username=user["username"],
        email=user["email"],
        phone=user.get("phone", ""),
        role=user["role"],
        is_active=user["is_active"],
        created_at=user["created_at"],
    )
    return LoginResponse(access_token=token, user=user_out)


@api_router.get("/auth/me", response_model=UserOut)
async def auth_me(current=Depends(get_current_user)):
    user = await db.users.find_one({"id": current["sub"]})
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return UserOut(
        id=user["id"],
        full_name=user["full_name"],
        username=user["username"],
        email=user["email"],
        phone=user.get("phone", ""),
        role=user["role"],
        is_active=user["is_active"],
        created_at=user["created_at"],
    )


# ============================================================
# USERS (admin only)
# ============================================================
@api_router.get("/users", response_model=List[UserOut])
async def list_users(_=Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    return users


@api_router.post("/users", response_model=UserOut, status_code=201)
async def create_user(payload: UserCreate, _=Depends(require_admin)):
    if await db.users.find_one({"username": payload.username}):
        raise HTTPException(409, "Username already exists")
    if await db.users.find_one({"email": payload.email}):
        raise HTTPException(409, "Email already exists")
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["password_hash"] = hash_password(payload.password)
    doc.pop("password", None)
    doc["created_at"] = now_iso()
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


@api_router.put("/users/{user_id}", response_model=UserOut)
async def update_user(user_id: str, payload: UserUpdate, _=Depends(require_admin)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields to update")
    result = await db.users.update_one({"id": user_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(404, "User not found")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return user


@api_router.post("/users/{user_id}/reset-password")
async def reset_password(user_id: str, payload: UserPasswordReset, _=Depends(require_admin)):
    result = await db.users.update_one(
        {"id": user_id}, {"$set": {"password_hash": hash_password(payload.password)}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "User not found")
    return {"success": True}


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current=Depends(require_admin)):
    if current["sub"] == user_id:
        raise HTTPException(400, "Cannot delete your own account")
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "User not found")
    return {"success": True}


# ============================================================
# CLIENTS
# ============================================================
def _derive_initial(name: str) -> str:
    words = re.findall(r"[A-Za-z0-9]+", name.upper())
    if not words:
        return "CLT"
    if len(words) == 1:
        return words[0][:3]
    return "".join(w[0] for w in words[:3])


@api_router.get("/clients", response_model=List[ClientOut])
async def list_clients(_=Depends(get_current_user)):
    clients = await db.clients.find({}, {"_id": 0}).sort("company_name", 1).to_list(1000)
    return clients


@api_router.post("/clients", response_model=ClientOut, status_code=201)
async def create_client(payload: ClientCreate, _=Depends(get_current_user)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    if not doc.get("initial"):
        doc["initial"] = _derive_initial(doc["company_name"])
    else:
        doc["initial"] = doc["initial"].upper()
    doc["created_at"] = now_iso()
    await db.clients.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/clients/{client_id}", response_model=ClientOut)
async def update_client(client_id: str, payload: ClientUpdate, _=Depends(get_current_user)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "initial" in update and update["initial"]:
        update["initial"] = update["initial"].upper()
    result = await db.clients.update_one({"id": client_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(404, "Client not found")
    return await db.clients.find_one({"id": client_id}, {"_id": 0})


@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, _=Depends(require_admin)):
    # disallow delete if has invoices
    if await db.invoices.find_one({"client_id": client_id}):
        raise HTTPException(400, "Cannot delete client with existing invoices")
    result = await db.clients.delete_one({"id": client_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Client not found")
    return {"success": True}


# ============================================================
# EXCHANGE RATES
# ============================================================
@api_router.get("/exchange-rates", response_model=List[ExchangeRateOut])
async def list_rates(_=Depends(get_current_user)):
    rates = await db.exchange_rates.find({}, {"_id": 0}).to_list(1000)
    return rates


@api_router.post("/exchange-rates", response_model=ExchangeRateOut)
async def upsert_rate(payload: ExchangeRateCreate, _=Depends(require_admin)):
    f, t = payload.from_currency.upper(), payload.to_currency.upper()
    existing = await db.exchange_rates.find_one({"from_currency": f, "to_currency": t})
    doc = {
        "from_currency": f,
        "to_currency": t,
        "rate": float(payload.rate),
        "updated_at": now_iso(),
    }
    if existing:
        doc["id"] = existing["id"]
        await db.exchange_rates.update_one({"id": existing["id"]}, {"$set": doc})
    else:
        doc["id"] = str(uuid.uuid4())
        await db.exchange_rates.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.delete("/exchange-rates/{rate_id}")
async def delete_rate(rate_id: str, _=Depends(require_admin)):
    result = await db.exchange_rates.delete_one({"id": rate_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Rate not found")
    return {"success": True}


# ============================================================
# INVOICES
# ============================================================
async def _get_rate_to(from_cur: str, to_cur: str, snapshot: dict) -> float:
    from_cur, to_cur = from_cur.upper(), to_cur.upper()
    if from_cur == to_cur:
        return 1.0
    # Use invoice's snapshot rates first (rates relative to total_currency).
    # snapshot format: {"USD": 1, "IDR": 16500, "SGD": 12300} – means 1 IDR = ? base_to_currency
    # We define snapshot as: 1 unit of <currency> = snapshot[<currency>] units of total_currency.
    if snapshot and from_cur in snapshot and to_cur in snapshot:
        # 1 from = snapshot[from] in total; convert from -> to via total
        if snapshot[to_cur] == 0:
            return 0
        return float(snapshot[from_cur]) / float(snapshot[to_cur])
    # Fallback to DB
    rec = await db.exchange_rates.find_one({"from_currency": from_cur, "to_currency": to_cur})
    if rec:
        return float(rec["rate"])
    inv = await db.exchange_rates.find_one({"from_currency": to_cur, "to_currency": from_cur})
    if inv and float(inv["rate"]) != 0:
        return 1.0 / float(inv["rate"])
    return 1.0


def _compute_subtotal_sync(items: list, snapshot: dict, total_currency: str) -> float:
    """Compute subtotal in total_currency using snapshot mapping."""
    sub = 0.0
    for it in items:
        qty = float(it.get("quantity") or 0)
        price = float(it.get("price") or 0)
        cur = (it.get("currency") or "USD").upper()
        amount = qty * price
        if cur == total_currency.upper():
            sub += amount
        else:
            # snapshot: 1 <cur> = snapshot[cur] in total_currency
            if snapshot and cur in snapshot:
                sub += amount * float(snapshot[cur])
            else:
                sub += amount  # fallback (should not happen)
    return round(sub, 2)


async def _generate_invoice_number(client_id: str, when: datetime) -> str:
    cli = await db.clients.find_one({"id": client_id})
    if not cli:
        raise HTTPException(404, "Client not found")
    initial = (cli.get("initial") or _derive_initial(cli["company_name"])).upper()
    year = when.strftime("%Y")
    month = when.strftime("%m")
    prefix = f"INV/{initial}/{year}/{month}/"
    # Find max existing running number for this prefix
    cursor = db.invoices.find(
        {"invoice_number": {"$regex": f"^{re.escape(prefix)}"}}, {"invoice_number": 1, "_id": 0}
    )
    max_num = 0
    async for d in cursor:
        m = re.search(r"/(\d{3})$", d["invoice_number"])
        if m:
            max_num = max(max_num, int(m.group(1)))
    return f"{prefix}{max_num + 1:03d}"


async def _enrich_invoice(inv: dict) -> dict:
    cli = await db.clients.find_one({"id": inv["client_id"]}, {"_id": 0, "company_name": 1})
    inv["client_name"] = cli["company_name"] if cli else ""
    return inv


@api_router.get("/invoices", response_model=List[InvoiceOut])
async def list_invoices(_=Depends(get_current_user)):
    invoices = await db.invoices.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for inv in invoices:
        await _enrich_invoice(inv)
    return invoices


@api_router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(invoice_id: str, _=Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    await _enrich_invoice(inv)
    return inv


@api_router.post("/invoices", response_model=InvoiceOut, status_code=201)
async def create_invoice(payload: InvoiceCreate, current=Depends(get_current_user)):
    if not payload.client_id:
        raise HTTPException(400, "client_id is required")
    if not payload.items:
        raise HTTPException(400, "At least one item is required")
    if not payload.total_currency:
        raise HTTPException(400, "total_currency is required")

    # Determine date
    try:
        when = datetime.fromisoformat(payload.invoice_date)
    except Exception:
        when = datetime.now(timezone.utc)

    invoice_number = payload.invoice_number or await _generate_invoice_number(payload.client_id, when)

    # Ensure unique
    if await db.invoices.find_one({"invoice_number": invoice_number}):
        raise HTTPException(409, f"Invoice number {invoice_number} already exists")

    items = [it.model_dump() if isinstance(it, InvoiceItem) else it for it in payload.items]
    snapshot = payload.exchange_rates or {}

    # Validate snapshot: ensure all currencies in items + total_currency are in snapshot
    needed = {payload.total_currency.upper()} | {(it.get("currency") or "USD").upper() for it in items}
    missing = [c for c in needed if c not in {k.upper() for k in snapshot.keys()}]
    if missing:
        # Try to auto-populate from DB rates relative to total_currency
        total_cur = payload.total_currency.upper()
        snapshot = {k.upper(): float(v) for k, v in snapshot.items()}
        snapshot[total_cur] = 1.0
        for cur in needed:
            if cur not in snapshot:
                snapshot[cur] = await _get_rate_to(cur, total_cur, {})
    else:
        snapshot = {k.upper(): float(v) for k, v in snapshot.items()}

    subtotal = _compute_subtotal_sync(items, snapshot, payload.total_currency)
    tax_amount = round(subtotal * (payload.tax_percent or 0) / 100.0, 2)
    grand_total = round(subtotal + tax_amount - (payload.discount_amount or 0), 2)

    cli = await db.clients.find_one({"id": payload.client_id})
    if not cli:
        raise HTTPException(404, "Client not found")

    doc = payload.model_dump()
    doc["items"] = items
    doc["id"] = str(uuid.uuid4())
    doc["invoice_number"] = invoice_number
    doc["exchange_rates"] = snapshot
    doc["subtotal"] = subtotal
    doc["tax_amount"] = tax_amount
    doc["grand_total"] = grand_total
    doc["created_by"] = current["sub"]
    doc["created_by_name"] = current.get("username", "")
    doc["client_name"] = cli["company_name"]
    doc["created_at"] = now_iso()
    doc["updated_at"] = doc["created_at"]

    await db.invoices.insert_one(doc)

    # Generate PDF & save to INVOICE DATA folder
    try:
        company = await db.company_settings.find_one({"_id": "default"}, {"_id": 0}) or {}
        year, month = when.strftime("%Y"), when.strftime("%m")
        safe_name = invoice_number.replace("/", "-")
        pdf_path = INVOICE_DATA_DIR / year / month / f"{safe_name}.pdf"
        generate_invoice_pdf(
            invoice=doc,
            client=cli,
            company=company,
            created_by_name=current.get("username", ""),
            output_path=str(pdf_path),
        )
        await db.invoices.update_one({"id": doc["id"]}, {"$set": {"pdf_path": str(pdf_path)}})
        doc["pdf_path"] = str(pdf_path)
    except Exception as e:
        logging.exception(f"PDF generation failed: {e}")

    doc.pop("_id", None)
    return doc


@api_router.put("/invoices/{invoice_id}", response_model=InvoiceOut)
async def update_invoice(invoice_id: str, payload: InvoiceUpdate, _=Depends(require_admin)):
    existing = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Invoice not found")

    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "items" in update:
        update["items"] = [it.model_dump() if isinstance(it, InvoiceItem) else it for it in update["items"]]
    merged = {**existing, **update}

    items = merged.get("items", [])
    snapshot = {k.upper(): float(v) for k, v in (merged.get("exchange_rates") or {}).items()}
    total_cur = (merged.get("total_currency") or "USD").upper()
    needed = {total_cur} | {(it.get("currency") or "USD").upper() for it in items}
    snapshot[total_cur] = 1.0
    for cur in needed:
        if cur not in snapshot:
            snapshot[cur] = await _get_rate_to(cur, total_cur, {})

    subtotal = _compute_subtotal_sync(items, snapshot, total_cur)
    tax_amount = round(subtotal * float(merged.get("tax_percent") or 0) / 100.0, 2)
    grand_total = round(subtotal + tax_amount - float(merged.get("discount_amount") or 0), 2)

    update["exchange_rates"] = snapshot
    update["subtotal"] = subtotal
    update["tax_amount"] = tax_amount
    update["grand_total"] = grand_total
    update["updated_at"] = now_iso()

    await db.invoices.update_one({"id": invoice_id}, {"$set": update})

    # Regenerate PDF
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    cli = await db.clients.find_one({"id": inv["client_id"]})
    company = await db.company_settings.find_one({"_id": "default"}, {"_id": 0}) or {}
    try:
        when = datetime.fromisoformat(inv["invoice_date"]) if inv.get("invoice_date") else datetime.now(timezone.utc)
        year, month = when.strftime("%Y"), when.strftime("%m")
        safe_name = inv["invoice_number"].replace("/", "-")
        pdf_path = INVOICE_DATA_DIR / year / month / f"{safe_name}.pdf"
        generate_invoice_pdf(
            invoice=inv, client=cli, company=company,
            created_by_name=inv.get("created_by_name", ""),
            output_path=str(pdf_path),
        )
    except Exception as e:
        logging.exception(f"PDF regen failed: {e}")

    await _enrich_invoice(inv)
    return inv


@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, _=Depends(require_admin)):
    inv = await db.invoices.find_one({"id": invoice_id})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    # Remove PDF file if exists
    if inv.get("pdf_path"):
        try:
            Path(inv["pdf_path"]).unlink(missing_ok=True)
        except Exception:
            pass
    await db.invoices.delete_one({"id": invoice_id})
    return {"success": True}


@api_router.get("/invoices/{invoice_id}/pdf")
async def download_pdf(invoice_id: str, _=Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    cli = await db.clients.find_one({"id": inv["client_id"]})
    company = await db.company_settings.find_one({"_id": "default"}, {"_id": 0}) or {}

    when = datetime.fromisoformat(inv["invoice_date"]) if inv.get("invoice_date") else datetime.now(timezone.utc)
    year, month = when.strftime("%Y"), when.strftime("%m")
    safe_name = inv["invoice_number"].replace("/", "-")
    pdf_path = INVOICE_DATA_DIR / year / month / f"{safe_name}.pdf"

    pdf_bytes = generate_invoice_pdf(
        invoice=inv,
        client=cli or {},
        company=company,
        created_by_name=inv.get("created_by_name", ""),
        output_path=str(pdf_path),
    )
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{safe_name}.pdf"'},
    )


# ============================================================
# COMPANY SETTINGS
# ============================================================
@api_router.get("/company-settings", response_model=CompanySettings)
async def get_settings(_=Depends(get_current_user)):
    settings = await db.company_settings.find_one({"_id": "default"})
    if not settings:
        defaults = CompanySettings().model_dump()
        defaults["_id"] = "default"
        await db.company_settings.insert_one(defaults)
        defaults.pop("_id")
        return defaults
    settings.pop("_id", None)
    return settings


@api_router.put("/company-settings", response_model=CompanySettings)
async def update_settings(payload: CompanySettingsUpdate, _=Depends(require_admin)):
    update = {}
    for k, v in payload.model_dump().items():
        if v is not None:
            update[k] = v
    if "bank" in update and isinstance(update["bank"], dict):
        update["bank"] = BankInfo(**update["bank"]).model_dump()
    await db.company_settings.update_one({"_id": "default"}, {"$set": update}, upsert=True)
    settings = await db.company_settings.find_one({"_id": "default"})
    settings.pop("_id", None)
    return settings


@api_router.post("/uploads/logo")
async def upload_logo(file: UploadFile = File(...), _=Depends(require_admin)):
    ext = (file.filename or "").split(".")[-1].lower() or "png"
    if ext not in {"png", "jpg", "jpeg", "webp", "gif", "svg"}:
        raise HTTPException(400, "Unsupported file type")
    name = f"logo-{uuid.uuid4().hex}.{ext}"
    path = UPLOADS_DIR / name
    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)
    # Return relative path served by /uploads
    url = f"/uploads/{name}"
    return {"url": url, "filename": name}


# ============================================================
# DASHBOARD
# ============================================================
@api_router.get("/dashboard/summary")
async def dashboard_summary(_=Depends(get_current_user)):
    total_invoices = await db.invoices.count_documents({})
    total_clients = await db.clients.count_documents({})
    pending_count = await db.invoices.count_documents({"status": "pending"})

    # Sum grand totals per currency
    pipeline = [
        {"$group": {"_id": "$total_currency", "total": {"$sum": "$grand_total"}, "count": {"$sum": 1}}}
    ]
    revenue_by_currency = {}
    async for d in db.invoices.aggregate(pipeline):
        revenue_by_currency[d["_id"] or "USD"] = {"total": d["total"], "count": d["count"]}

    # Total revenue in USD (using exchange_rates table)
    total_revenue_usd = 0.0
    for cur, data in revenue_by_currency.items():
        if cur == "USD":
            total_revenue_usd += data["total"]
        else:
            rate = await _get_rate_to(cur, "USD", {})
            total_revenue_usd += data["total"] * rate

    return {
        "total_invoices": total_invoices,
        "total_clients": total_clients,
        "pending_invoices": pending_count,
        "total_revenue_usd": round(total_revenue_usd, 2),
        "revenue_by_currency": revenue_by_currency,
    }


# ============================================================
@api_router.get("/")
async def root():
    return {"message": "ARRAZZAQ Invoice Management API", "version": "1.0"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
