"""Backend integration tests for ARRAZZAQ Invoice Management System.

Tests core flows: auth, users, clients, exchange rates, invoices (create + PDF),
company settings, dashboard summary, and RBAC.
"""
from __future__ import annotations

import os
import uuid

import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

ADMIN_USER = "admin"
ADMIN_PASS = "admin123"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def staff_user(admin_headers):
    """Create a staff user (or fetch existing) and return its info + token."""
    suffix = uuid.uuid4().hex[:6]
    payload = {
        "full_name": f"TEST Staff {suffix}",
        "username": f"teststaff_{suffix}",
        "email": f"teststaff_{suffix}@example.com",
        "phone": "",
        "role": "staff",
        "is_active": True,
        "password": "StaffPass123!",
    }
    r = requests.post(f"{API}/users", json=payload, headers=admin_headers)
    assert r.status_code == 201, f"create staff failed: {r.status_code} {r.text}"
    user = r.json()
    # Login as staff
    lr = requests.post(f"{API}/auth/login", json={"username": payload["username"], "password": payload["password"]})
    assert lr.status_code == 200
    token = lr.json()["access_token"]
    return {"user": user, "token": token, "username": payload["username"], "password": payload["password"]}


# ---------- Auth ----------
class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["user"]["username"] == "admin"
        assert data["user"]["role"] == "admin"

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "wrong"})
        assert r.status_code == 401

    def test_auth_me(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["username"] == "admin"

    def test_auth_me_unauth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)


# ---------- Clients ----------
class TestClients:
    client_id = None

    def test_list_clients(self, admin_headers):
        r = requests.get(f"{API}/clients", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_client_auto_initial(self, admin_headers):
        payload = {"company_name": f"TEST Client {uuid.uuid4().hex[:5]}", "country": "Indonesia"}
        r = requests.post(f"{API}/clients", json=payload, headers=admin_headers)
        assert r.status_code == 201
        data = r.json()
        assert data["initial"]
        assert "id" in data
        assert "_id" not in data
        TestClients.client_id = data["id"]

    def test_update_client(self, admin_headers):
        assert TestClients.client_id
        r = requests.put(
            f"{API}/clients/{TestClients.client_id}",
            json={"initial": "tcz", "contact_person": "John Doe"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["initial"] == "TCZ"
        assert r.json()["contact_person"] == "John Doe"


# ---------- Exchange Rates ----------
class TestRates:
    def test_list_rates(self, admin_headers):
        r = requests.get(f"{API}/exchange-rates", headers=admin_headers)
        assert r.status_code == 200
        assert len(r.json()) > 0

    def test_upsert_rate(self, admin_headers):
        r = requests.post(
            f"{API}/exchange-rates",
            json={"from_currency": "USD", "to_currency": "IDR", "rate": 16700.0},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["rate"] == 16700.0


# ---------- Invoices ----------
class TestInvoices:
    invoice_id = None
    invoice_number = None
    client_id = None
    second_invoice_id = None

    def _ensure_client(self, admin_headers):
        if TestInvoices.client_id:
            return TestInvoices.client_id
        r = requests.get(f"{API}/clients", headers=admin_headers)
        kfs = next((c for c in r.json() if c.get("initial") == "KFS"), None)
        if kfs:
            TestInvoices.client_id = kfs["id"]
        else:
            payload = {"company_name": "TEST Khalid Faraj Shipping", "initial": "KFS"}
            r = requests.post(f"{API}/clients", json=payload, headers=admin_headers)
            TestInvoices.client_id = r.json()["id"]
        return TestInvoices.client_id

    def test_create_invoice(self, admin_headers):
        client_id = self._ensure_client(admin_headers)
        payload = {
            "invoice_date": "2026-06-15",
            "due_date": "2026-07-15",
            "client_id": client_id,
            "attention": "Mr. Khalid",
            "vessel": "MV TEST",
            "voyage": "V01",
            "port": "Jakarta",
            "items": [
                {"description": "Service A", "rank": "Capt", "date": "2026-06-10",
                 "quantity": 2, "currency": "USD", "price": 100},
                {"description": "Service B", "rank": "C/O", "date": "2026-06-11",
                 "quantity": 1, "currency": "IDR", "price": 1650000},
                {"description": "Service C", "rank": "C/E", "date": "2026-06-12",
                 "quantity": 3, "currency": "SGD", "price": 50},
            ],
            "exchange_rates": {"USD": 1, "IDR": 1.0 / 16500, "SGD": 0.74},
            "total_currency": "USD",
            "tax_percent": 11,
            "discount_amount": 0,
            "status": "pending",
        }
        r = requests.post(f"{API}/invoices", json=payload, headers=admin_headers)
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["invoice_number"].startswith("INV/KFS/2026/06/")
        # Subtotal: 200 USD + 100 USD (1650000*1/16500) + 111 USD (150*0.74) = 411 USD
        assert abs(data["subtotal"] - 411.0) < 0.5, f"unexpected subtotal {data['subtotal']}"
        assert abs(data["tax_amount"] - round(data["subtotal"] * 0.11, 2)) < 0.01
        assert abs(data["grand_total"] - round(data["subtotal"] * 1.11, 2)) < 0.01
        assert data["client_name"]
        assert "_id" not in data
        TestInvoices.invoice_id = data["id"]
        TestInvoices.invoice_number = data["invoice_number"]

    def test_create_invoice_increments_sequence(self, admin_headers):
        client_id = self._ensure_client(admin_headers)
        payload = {
            "invoice_date": "2026-06-20",
            "client_id": client_id,
            "items": [{"description": "Item", "quantity": 1, "currency": "USD", "price": 10}],
            "exchange_rates": {"USD": 1},
            "total_currency": "USD",
            "tax_percent": 0,
            "status": "pending",
        }
        r = requests.post(f"{API}/invoices", json=payload, headers=admin_headers)
        assert r.status_code == 201, r.text
        n1 = TestInvoices.invoice_number
        n2 = r.json()["invoice_number"]
        seq1 = int(n1.split("/")[-1])
        seq2 = int(n2.split("/")[-1])
        assert seq2 == seq1 + 1, f"expected {seq1+1}, got {seq2}"
        TestInvoices.second_invoice_id = r.json()["id"]

    def test_get_invoice(self, admin_headers):
        r = requests.get(f"{API}/invoices/{TestInvoices.invoice_id}", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["id"] == TestInvoices.invoice_id

    def test_list_invoices(self, admin_headers):
        r = requests.get(f"{API}/invoices", headers=admin_headers)
        assert r.status_code == 200
        assert any(i["id"] == TestInvoices.invoice_id for i in r.json())

    def test_pdf_download(self, admin_headers):
        r = requests.get(f"{API}/invoices/{TestInvoices.invoice_id}/pdf", headers=admin_headers)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert len(r.content) > 1000
        assert r.content[:4] == b"%PDF"

    def test_update_invoice(self, admin_headers):
        r = requests.put(
            f"{API}/invoices/{TestInvoices.invoice_id}",
            json={"status": "paid"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "paid"


# ---------- Company Settings ----------
class TestSettings:
    def test_get_settings(self, admin_headers):
        r = requests.get(f"{API}/company-settings", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["company_name"]
        assert "bank" in data
        assert data["bank"]["account_number"]

    def test_update_settings(self, admin_headers):
        r = requests.put(
            f"{API}/company-settings",
            json={"phone": "+62-21-TEST", "bank": {
                "beneficiary": "PT. ARRAZZAQ OCEAN GLOBAL",
                "bank_name": "BANK RAKYAT INDONESIA (BRI)",
                "account_number": "044102000096506",
                "swift_code": "BRINIDJAXXX",
                "address": "KC JAKARTA SUNTER",
                "country": "INDONESIA",
            }},
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text
        assert r.json()["phone"] == "+62-21-TEST"
        assert r.json()["bank"]["account_number"] == "044102000096506"


# ---------- Dashboard ----------
class TestDashboard:
    def test_summary(self, admin_headers):
        r = requests.get(f"{API}/dashboard/summary", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        for key in ("total_invoices", "total_clients", "pending_invoices", "total_revenue_usd"):
            assert key in data


# ---------- Users / RBAC ----------
class TestRBAC:
    def test_staff_cannot_list_users(self, staff_user):
        h = {"Authorization": f"Bearer {staff_user['token']}"}
        r = requests.get(f"{API}/users", headers=h)
        assert r.status_code == 403

    def test_staff_cannot_update_settings(self, staff_user):
        h = {"Authorization": f"Bearer {staff_user['token']}"}
        r = requests.put(f"{API}/company-settings", json={"phone": "x"}, headers=h)
        assert r.status_code == 403

    def test_staff_cannot_upsert_rate(self, staff_user):
        h = {"Authorization": f"Bearer {staff_user['token']}"}
        r = requests.post(f"{API}/exchange-rates", json={"from_currency": "USD", "to_currency": "IDR", "rate": 1}, headers=h)
        assert r.status_code == 403

    def test_staff_can_list_clients_and_invoices(self, staff_user):
        h = {"Authorization": f"Bearer {staff_user['token']}"}
        assert requests.get(f"{API}/clients", headers=h).status_code == 200
        assert requests.get(f"{API}/invoices", headers=h).status_code == 200

    def test_staff_cannot_delete_client(self, staff_user, admin_headers):
        # create a throwaway client
        r = requests.post(f"{API}/clients", json={"company_name": f"TEST Del {uuid.uuid4().hex[:5]}"}, headers=admin_headers)
        cid = r.json()["id"]
        h = {"Authorization": f"Bearer {staff_user['token']}"}
        r = requests.delete(f"{API}/clients/{cid}", headers=h)
        assert r.status_code == 403
        # cleanup
        requests.delete(f"{API}/clients/{cid}", headers=admin_headers)

    def test_admin_reset_staff_password(self, admin_headers, staff_user):
        r = requests.post(
            f"{API}/users/{staff_user['user']['id']}/reset-password",
            json={"password": "NewPass123!"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        lr = requests.post(f"{API}/auth/login", json={"username": staff_user["username"], "password": "NewPass123!"})
        assert lr.status_code == 200
