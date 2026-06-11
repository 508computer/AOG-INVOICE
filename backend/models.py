"""Pydantic models for the Invoice Management System."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Literal

import uuid
from pydantic import BaseModel, Field, EmailStr, ConfigDict


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


# -------- Users --------
class UserBase(BaseModel):
    full_name: str
    username: str
    email: EmailStr
    phone: Optional[str] = ""
    role: Literal["admin", "staff"] = "staff"
    is_active: bool = True


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    role: Optional[Literal["admin", "staff"]] = None
    is_active: Optional[bool] = None


class UserPasswordReset(BaseModel):
    password: str


class UserOut(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: str


class UserInDB(UserOut):
    password_hash: str


class LoginRequest(BaseModel):
    username: str
    password: str
    remember_me: Optional[bool] = False


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# -------- Clients --------
class ClientBase(BaseModel):
    company_name: str
    contact_person: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    country: Optional[str] = ""
    # Initial used for invoice number (e.g., KFS). If empty, will derive from company name.
    initial: Optional[str] = ""


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    initial: Optional[str] = None


class ClientOut(ClientBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: str


# -------- Exchange Rates --------
class ExchangeRateBase(BaseModel):
    """1 unit of `from_currency` = `rate` units of `to_currency`."""
    from_currency: str
    to_currency: str
    rate: float


class ExchangeRateCreate(ExchangeRateBase):
    pass


class ExchangeRateOut(ExchangeRateBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    updated_at: str


# -------- Invoice --------
class InvoiceItem(BaseModel):
    description: str
    rank: Optional[str] = ""
    date: Optional[str] = ""  # service date string
    quantity: float = 1
    unit: Optional[str] = ""
    currency: str = "USD"
    price: float = 0
    # Amount = qty * price (in item's currency)


class InvoiceBase(BaseModel):
    invoice_number: Optional[str] = None  # auto-generated
    invoice_date: str  # ISO date string
    due_date: Optional[str] = ""
    client_id: str
    attention: Optional[str] = ""
    vessel: Optional[str] = ""
    voyage: Optional[str] = ""
    port: Optional[str] = ""
    remarks: Optional[str] = ""
    items: List[InvoiceItem] = []
    # Exchange rates snapshot used for this invoice: { "USD": 1, "IDR": 16500, ... } (rates to total_currency)
    exchange_rates: dict = Field(default_factory=dict)
    total_currency: str = "USD"
    tax_percent: float = 0
    discount_amount: float = 0
    status: Literal["draft", "pending", "paid", "overdue", "cancelled"] = "pending"


class InvoiceCreate(InvoiceBase):
    pass


class InvoiceUpdate(BaseModel):
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    client_id: Optional[str] = None
    attention: Optional[str] = None
    vessel: Optional[str] = None
    voyage: Optional[str] = None
    port: Optional[str] = None
    remarks: Optional[str] = None
    items: Optional[List[InvoiceItem]] = None
    exchange_rates: Optional[dict] = None
    total_currency: Optional[str] = None
    tax_percent: Optional[float] = None
    discount_amount: Optional[float] = None
    status: Optional[Literal["draft", "pending", "paid", "overdue", "cancelled"]] = None


class InvoiceOut(InvoiceBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    invoice_number: str
    subtotal: float = 0  # in total_currency
    tax_amount: float = 0
    grand_total: float = 0
    created_by: str  # user_id
    created_by_name: str = ""
    client_name: str = ""
    created_at: str
    updated_at: str


# -------- Company Settings --------
class BankInfo(BaseModel):
    beneficiary: str = "PT. ARRAZZAQ OCEAN GLOBAL"
    bank_name: str = "BANK RAKYAT INDONESIA (BRI)"
    account_number: str = "044102000096506"
    swift_code: str = "BRINIDJAXXX"
    address: str = "KC JAKARTA SUNTER"
    country: str = "INDONESIA"


class CompanySettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    company_name: str = "PT. ARRAZZAQ OCEAN GLOBAL"
    address: str = "Jakarta, Indonesia"
    phone: str = ""
    email: str = ""
    website: str = ""
    logo_url: str = ""
    stamp_url: str = ""
    signature_name: str = "Mrs. Yuni Alimuddin"
    signature_title: str = "General Manager"
    bank: BankInfo = Field(default_factory=BankInfo)
    default_currency: str = "USD"


class CompanySettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None
    stamp_url: Optional[str] = None
    signature_name: Optional[str] = None
    signature_title: Optional[str] = None
    bank: Optional[BankInfo] = None
    default_currency: Optional[str] = None
