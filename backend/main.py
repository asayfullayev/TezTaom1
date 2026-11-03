from contextlib import asynccontextmanager

from pathlib import Path

from datetime import datetime, timedelta, timezone

import json
import hashlib
import hmac
import secrets
import time
from urllib.parse import parse_qsl

import os

import sqlite3

import uuid

import httpx

import jwt

from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File

from fastapi.middleware.cors import CORSMiddleware

from fastapi.staticfiles import StaticFiles

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from pydantic import BaseModel, Field

from pwdlib import PasswordHash

# ==================================================

# SOZLAMALAR

# ==================================================

BASE_DIR = Path(__file__).resolve().parent

DB_PATH = BASE_DIR / "teztaom.db"

UPLOAD_DIR = BASE_DIR / "uploads"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB

load_dotenv(BASE_DIR / ".env")

BOT_TOKEN = os.getenv("BOT_TOKEN")

ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID")

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME")

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

JWT_SECRET = os.getenv("JWT_SECRET")

JWT_ALGORITHM = "HS256"

TOKEN_EXPIRE_HOURS = 12

password_hasher = PasswordHash.recommended()

security = HTTPBearer()

# ==================================================

# BOSHLANG'ICH MAHSULOTLAR

# ==================================================

PRODUCTS = [

    {

        "id": 1,

        "name": "Classic Burger",

        "category": "Burger",

        "price": 25000,

        "image": "🍔",

        "description": "Mazali mol go‘shtli burger",

    },

    {

        "id": 2,

        "name": "Chicken Lavash",

        "category": "Lavash",

        "price": 30000,

        "image": "🌯",

        "description": "Tovuqli lavash",

    },

    {

        "id": 3,

        "name": "Hot Dog",

        "category": "Hot-dog",

        "price": 18000,

        "image": "🌭",

        "description": "Klassik hot-dog",

    },

    {

        "id": 4,

        "name": "French Fries",

        "category": "Snacks",

        "price": 15000,

        "image": "🍟",

        "description": "Qarsildoq kartoshka fri",

    },

    {

        "id": 5,

        "name": "Coca-Cola",

        "category": "Drinks",

        "price": 10000,

        "image": "🥤",

        "description": "Sovuq ichimlik",

    },

    {

        "id": 6,

        "name": "Cheese Burger",

        "category": "Burger",

        "price": 32000,

        "image": "🍔",

        "description": "Pishloqli burger",

    },

]

# ==================================================

# DATABASE

# ==================================================

def get_db():

    connection = sqlite3.connect(DB_PATH, timeout=10)

    connection.row_factory = sqlite3.Row

    connection.execute("PRAGMA foreign_keys = ON")

    return connection

def init_database():

    with get_db() as db:

        db.execute("""

            CREATE TABLE IF NOT EXISTS orders (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                customer_name TEXT NOT NULL,

                phone TEXT NOT NULL,

                order_type TEXT NOT NULL,

                address TEXT,

                items_json TEXT NOT NULL,

                total_price INTEGER NOT NULL,

                status TEXT NOT NULL DEFAULT 'Yangi',

                created_at TEXT NOT NULL DEFAULT

                    (datetime('now', 'localtime'))

            )

        """)

        db.execute("""

            CREATE TABLE IF NOT EXISTS products (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                name TEXT NOT NULL,

                category TEXT NOT NULL,

                price INTEGER NOT NULL CHECK(price >= 0),

                image TEXT NOT NULL DEFAULT '',

                description TEXT NOT NULL DEFAULT '',

                is_active INTEGER NOT NULL DEFAULT 1,

                created_at TEXT NOT NULL DEFAULT

                    (datetime('now', 'localtime'))

            )

        """)

        db.execute("""

            CREATE TABLE IF NOT EXISTS categories (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                name TEXT NOT NULL COLLATE NOCASE UNIQUE,

                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))

            )

        """)

        # Kategoriyalar bo‘limini joriy qilish: mavjud mahsulot kategoriyalarini saqlab qolamiz.

        existing_categories = {

            row["name"].strip().lower()

            for row in db.execute("SELECT name FROM categories").fetchall()

        }

        product_categories = db.execute(

            "SELECT DISTINCT category FROM products WHERE TRIM(category) != ''"

        ).fetchall()

        for category_row in product_categories:

            category_name = category_row["category"].strip()

            if category_name and category_name.lower() not in existing_categories:

                db.execute("INSERT OR IGNORE INTO categories (name) VALUES (?)", (category_name,))

                existing_categories.add(category_name.lower())

        db.execute("""

            CREATE TABLE IF NOT EXISTS users (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                username TEXT NOT NULL UNIQUE,

                password_hash TEXT NOT NULL,

                role TEXT NOT NULL CHECK(role IN ('admin', 'courier')),

                is_active INTEGER NOT NULL DEFAULT 1,

                created_at TEXT NOT NULL DEFAULT

                    (datetime('now', 'localtime'))

            )

        """)

        # Buyurtmalarni kuryerga biriktirish uchun eski bazani yangilash.

        order_columns = {

            row["name"]

            for row in db.execute("PRAGMA table_info(orders)").fetchall()

        }

        if "courier_id" not in order_columns:

            db.execute(

                "ALTER TABLE orders ADD COLUMN courier_id INTEGER REFERENCES users(id)"

            )

        # Buyurtma kuzatuvi uchun migratsiya: eski buyurtmalar saqlanadi.
        order_columns = {
            row["name"]
            for row in db.execute("PRAGMA table_info(orders)").fetchall()
        }
        if "tracking_token" not in order_columns:
            db.execute("ALTER TABLE orders ADD COLUMN tracking_token TEXT")
        if "telegram_user_id" not in order_columns:
            db.execute("ALTER TABLE orders ADD COLUMN telegram_user_id TEXT")

        # Eski qattiq kodlangan mahsulotlarni bazaga bir marta ko'chirish.

        # Mavjud mahsulotlar va buyurtmalar o'chirilmaydi.

        product_count = db.execute(

            "SELECT COUNT(*) AS total FROM products"

        ).fetchone()["total"]

        if product_count == 0:

            db.executemany("""

                INSERT INTO products

                    (id, name, category, price, image, description)

                VALUES

                    (:id, :name, :category, :price, :image, :description)

            """, PRODUCTS)

        # Seed qilingan boshlang‘ich mahsulotlar kategoriyalarini ham ro‘yxatga qo‘shamiz.

        for category_row in db.execute(

            "SELECT DISTINCT category FROM products WHERE TRIM(category) != ''"

        ).fetchall():

            category_name = category_row["category"].strip()

            if category_name:

                db.execute("INSERT OR IGNORE INTO categories (name) VALUES (?)", (category_name,))

        # Admin sozlamalari mavjudligini tekshirish.

        if not ADMIN_USERNAME or not ADMIN_PASSWORD or not JWT_SECRET:

            raise RuntimeError(

                ".env faylida ADMIN_USERNAME, ADMIN_PASSWORD va "

                "JWT_SECRET qiymatlarini tekshiring."

            )

        admin = db.execute(

            "SELECT id FROM users WHERE username = ?",

            (ADMIN_USERNAME,),

        ).fetchone()

        if admin is None:

            db.execute("""

                INSERT INTO users (username, password_hash, role)

                VALUES (?, ?, 'admin')

            """, (

                ADMIN_USERNAME,

                password_hasher.hash(ADMIN_PASSWORD),

            ))

@asynccontextmanager

async def lifespan(app: FastAPI):

    init_database()

    yield

# ==================================================

# FASTAPI

# ==================================================

app = FastAPI(

    title="TezTaom API",

    description="TezTaom buyurtma va boshqaruv tizimi",

    version="2.0.0",

    lifespan=lifespan,

)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(

    CORSMiddleware,

    allow_origins=[

        "http://localhost:5173",

        "http://127.0.0.1:5173",

    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],

)

# ==================================================

# PYDANTIC MODELLAR

# ==================================================

class LoginRequest(BaseModel):

    username: str = Field(min_length=1, max_length=100)

    password: str = Field(min_length=1, max_length=200)

class CourierCreate(BaseModel):

    username: str = Field(min_length=3, max_length=50)

    password: str = Field(min_length=8, max_length=128)

class ProductCreate(BaseModel):

    name: str = Field(min_length=2, max_length=150)

    category: str = Field(min_length=1, max_length=100)

    price: int = Field(ge=0, le=1000000000)

    image: str = Field(default="", max_length=1000)

    description: str = Field(default="", max_length=2000)

    is_active: bool = True

class CategoryCreate(BaseModel):

    name: str = Field(min_length=2, max_length=100)

class OrderItem(BaseModel):

    product_id: int

    quantity: int = Field(ge=1, le=50)

class OrderRequest(BaseModel):

    customer_name: str = Field(min_length=2, max_length=100)

    phone: str = Field(min_length=7, max_length=25)

    order_type: str

    address: str | None = Field(default=None, max_length=500)

    items: list[OrderItem] = Field(min_length=1, max_length=50)

    telegram_init_data: str | None = Field(default=None, max_length=4096)

class AssignCourierRequest(BaseModel):

    courier_id: int

class CourierOrderStatusRequest(BaseModel):

    status: str

# ==================================================

# AUTHENTICATION VA ROLLAR

# ==================================================

def get_current_user(

    credentials: HTTPAuthorizationCredentials = Depends(security),

):

    token = credentials.credentials

    try:

        payload = jwt.decode(

            token,

            JWT_SECRET,

            algorithms=[JWT_ALGORITHM],

        )

        user_id = payload.get("sub")

        if user_id is None:

            raise HTTPException(

                status_code=401,

                detail="Token noto'g'ri.",

            )

        user_id = int(user_id)

    except (jwt.InvalidTokenError, ValueError, TypeError):

        raise HTTPException(

            status_code=401,

            detail="Token noto'g'ri yoki muddati tugagan.",

        )

    with get_db() as db:

        user = db.execute(

            """

            SELECT id, username, role, is_active

            FROM users

            WHERE id = ?

            """,

            (user_id,),

        ).fetchone()

    if user is None or not user["is_active"]:

        raise HTTPException(

            status_code=401,

            detail="Hisob faol emas.",

        )

    return dict(user)

def require_admin(user=Depends(get_current_user)):

    if user["role"] != "admin":

        raise HTTPException(

            status_code=403,

            detail="Bu amal faqat administrator uchun.",

        )

    return user

# ==================================================

# TELEGRAM

# ==================================================

async def send_telegram_notification(message: str) -> bool:

    if not BOT_TOKEN or not ADMIN_CHAT_ID:

        print("Telegram sozlamalari .env faylida topilmadi.")

        return False

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"

    try:

        async with httpx.AsyncClient(timeout=10) as client:

            response = await client.post(

                url,

                json={

                    "chat_id": ADMIN_CHAT_ID,

                    "text": message,

                },

            )

            response.raise_for_status()

            if not response.json().get("ok"):

                print("Telegram xabarni qabul qilmadi.")

                return False

            return True

    except Exception as error:

        print("Telegram xatosi:", error)

        return False

# ==================================================

def verify_telegram_init_data(init_data: str) -> dict | None:
    """Telegram Mini App initData imzosini tekshiradi."""
    if not init_data or not BOT_TOKEN:
        return None
    try:
        parsed = dict(parse_qsl(init_data, keep_blank_values=True))
        received_hash = parsed.pop("hash", None)
        if not received_hash:
            return None
        data_check_string = "\\n".join(
            f"{key}={value}" for key, value in sorted(parsed.items())
        )
        secret_key = hmac.new(
            b"WebAppData", BOT_TOKEN.encode("utf-8"), hashlib.sha256
        ).digest()
        calculated_hash = hmac.new(
            secret_key, data_check_string.encode("utf-8"), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(calculated_hash, received_hash):
            return None
        auth_date = int(parsed.get("auth_date", "0"))
        if abs(time.time() - auth_date) > 86400:
            return None
        user_json = parsed.get("user")
        if not user_json:
            return None
        user_data = json.loads(user_json)
        return user_data if user_data.get("id") else None
    except (ValueError, TypeError, json.JSONDecodeError):
        return None



async def send_customer_telegram_message(
    telegram_user_id: str | None,
    message: str,
) -> bool:
    """Mijozga Telegram xabari yuboradi va xatolarni terminalda ko'rsatadi."""

    if not BOT_TOKEN:
        print("TELEGRAM XATOSI: BOT_TOKEN sozlanmagan.")
        return False

    if not telegram_user_id:
        print("TELEGRAM XATOSI: telegram_user_id bo'sh.")
        return False

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                url,
                json={
                    "chat_id": str(telegram_user_id),
                    "text": message,
                },
            )

            if response.status_code != 200:
                print(
                    "TELEGRAM HTTP XATOSI:",
                    response.status_code,
                    response.text,
                )
                return False

            result = response.json()

            if not result.get("ok"):
                print("TELEGRAM API XATOSI:", result)
                return False

            print(
                "TELEGRAM XABARI YUBORILDI:",
                "buyurtma mijoziga xabar yetkazish so'rovi qabul qilindi",
            )
            return True

    except Exception as error:
        print(
            "TELEGRAM XABAR YUBORISHDA XATO:",
            type(error).__name__,
            str(error),
        )
        return False



# UMUMIY API

# ==================================================

@app.get("/")

def home():

    return {

        "success": True,

        "message": "TezTaom API ishlayapti!",

    }

@app.get("/api/categories")

def get_categories():

    with get_db() as db:

        rows = db.execute("SELECT id, name FROM categories ORDER BY name COLLATE NOCASE").fetchall()

    return {"success": True, "categories": [dict(row) for row in rows]}

@app.get("/api/products")

def get_products():

    with get_db() as db:

        rows = db.execute("""

            SELECT id, name, category, price, image, description

            FROM products

            WHERE is_active = 1

            ORDER BY id DESC

        """).fetchall()

    return {

        "success": True,

        "products": [dict(row) for row in rows],

    }

# ==================================================

# ADMIN LOGIN

# ==================================================

@app.post("/api/auth/login")

def login(data: LoginRequest):

    with get_db() as db:

        user = db.execute("""

            SELECT id, username, password_hash, role, is_active

            FROM users

            WHERE username = ?

        """, (data.username.strip(),)).fetchone()

    if (

        user is None

        or not user["is_active"]

        or not password_hasher.verify(

            data.password,

            user["password_hash"],

        )

    ):

        raise HTTPException(

            status_code=401,

            detail="Login yoki parol noto'g'ri.",

        )

    expires_at = datetime.now(timezone.utc) + timedelta(

        hours=TOKEN_EXPIRE_HOURS

    )

    token = jwt.encode(

        {

            "sub": str(user["id"]),

            "role": user["role"],

            "exp": expires_at,

        },

        JWT_SECRET,

        algorithm=JWT_ALGORITHM,

    )

    return {

        "success": True,

        "access_token": token,

        "token_type": "bearer",

        "role": user["role"],

        "username": user["username"],

        "expires_in_hours": TOKEN_EXPIRE_HOURS,

    }

@app.get("/api/auth/me")

def current_user(user=Depends(get_current_user)):

    return {

        "success": True,

        "user": user,

    }

# ==================================================

# ADMIN: DASHBOARD

# ==================================================

@app.get("/api/admin/dashboard")

def admin_dashboard(admin=Depends(require_admin)):

    with get_db() as db:

        product_count = db.execute(

            "SELECT COUNT(*) FROM products WHERE is_active = 1"

        ).fetchone()[0]

        order_count = db.execute(

            "SELECT COUNT(*) FROM orders"

        ).fetchone()[0]

        new_orders = db.execute(

            "SELECT COUNT(*) FROM orders WHERE status = 'Yangi'"

        ).fetchone()[0]

        revenue = db.execute(

            "SELECT COALESCE(SUM(total_price), 0) FROM orders"

        ).fetchone()[0]

        courier_count = db.execute(

            "SELECT COUNT(*) FROM users "

            "WHERE role = 'courier' AND is_active = 1"

        ).fetchone()[0]

        recent_orders = db.execute("""

            SELECT id, customer_name, phone, order_type,

                   total_price, status, created_at

            FROM orders

            ORDER BY id DESC

            LIMIT 10

        """).fetchall()

    return {

        "success": True,

        "stats": {

            "products": product_count,

            "orders": order_count,

            "new_orders": new_orders,

            "revenue": revenue,

            "couriers": courier_count,

        },

        "recent_orders": [dict(row) for row in recent_orders],

    }

# ==================================================

# ADMIN: MAHSULOTLAR CRUD

# ==================================================

@app.post("/api/admin/upload-image")

async def upload_product_image(

    file: UploadFile = File(...),

    admin=Depends(require_admin),

):

    """Admin uchun mahsulot rasmini uploads papkasiga saqlaydi."""

    allowed_types = {

        "image/jpeg": ".jpg",

        "image/png": ".png",

        "image/webp": ".webp",

    }

    content_type = (file.content_type or "").lower()

    if content_type not in allowed_types:

        raise HTTPException(status_code=415, detail="Faqat JPG, PNG yoki WEBP formatidagi rasm yuklang.")

    content = await file.read(MAX_IMAGE_SIZE + 1)

    if not content:

        raise HTTPException(status_code=400, detail="Rasm fayli bo‘sh.")

    if len(content) > MAX_IMAGE_SIZE:

        raise HTTPException(status_code=413, detail="Rasm hajmi 5 MB dan oshmasin.")

    filename = f"{uuid.uuid4().hex}{allowed_types[content_type]}"

    (UPLOAD_DIR / filename).write_bytes(content)

    return {"success": True, "image_url": f"/uploads/{filename}", "filename": filename}

@app.get("/api/admin/categories")

def admin_get_categories(admin=Depends(require_admin)):

    with get_db() as db:

        rows = db.execute("""

            SELECT c.id, c.name, c.created_at, COUNT(p.id) AS product_count

            FROM categories c LEFT JOIN products p ON p.category = c.name

            GROUP BY c.id, c.name, c.created_at

            ORDER BY c.name COLLATE NOCASE

        """).fetchall()

    return {"success": True, "categories": [dict(row) for row in rows]}

@app.post("/api/admin/categories", status_code=201)

def create_category(category: CategoryCreate, admin=Depends(require_admin)):

    name = category.name.strip()

    if len(name) < 2:

        raise HTTPException(status_code=400, detail="Kategoriya nomi kamida 2 ta belgidan iborat bo‘lsin.")

    with get_db() as db:

        try:

            cursor = db.execute("INSERT INTO categories (name) VALUES (?)", (name,))

        except sqlite3.IntegrityError:

            raise HTTPException(status_code=409, detail="Bu kategoriya allaqachon mavjud.")

        row = db.execute("SELECT id, name, created_at FROM categories WHERE id = ?", (cursor.lastrowid,)).fetchone()

    return {"success": True, "message": "Kategoriya qo‘shildi.", "category": dict(row)}

@app.put("/api/admin/categories/{category_id}")

def update_category(category_id: int, category: CategoryCreate, admin=Depends(require_admin)):

    name = category.name.strip()

    if len(name) < 2:

        raise HTTPException(status_code=400, detail="Kategoriya nomi kamida 2 ta belgidan iborat bo‘lsin.")

    with get_db() as db:

        existing = db.execute("SELECT id, name FROM categories WHERE id = ?", (category_id,)).fetchone()

        if existing is None:

            raise HTTPException(status_code=404, detail="Kategoriya topilmadi.")

        try:

            db.execute("UPDATE categories SET name = ? WHERE id = ?", (name, category_id))

        except sqlite3.IntegrityError:

            raise HTTPException(status_code=409, detail="Bu nomdagi kategoriya allaqachon mavjud.")

        # Kategoriya nomi o‘zgarsa, unga biriktirilgan mahsulotlar ham yangilanadi.

        db.execute("UPDATE products SET category = ? WHERE category = ?", (name, existing["name"]))

        row = db.execute("SELECT id, name, created_at FROM categories WHERE id = ?", (category_id,)).fetchone()

    return {"success": True, "message": "Kategoriya yangilandi.", "category": dict(row)}

@app.delete("/api/admin/categories/{category_id}")

def delete_category(category_id: int, admin=Depends(require_admin)):

    with get_db() as db:

        category = db.execute("SELECT id, name FROM categories WHERE id = ?", (category_id,)).fetchone()

        if category is None:

            raise HTTPException(status_code=404, detail="Kategoriya topilmadi.")

        count = db.execute("SELECT COUNT(*) FROM products WHERE category = ?", (category["name"],)).fetchone()[0]

        if count:

            raise HTTPException(status_code=409, detail=f"Bu kategoriyada {count} ta mahsulot bor. Avval mahsulotlarni boshqa kategoriyaga o‘tkazing.")

        db.execute("DELETE FROM categories WHERE id = ?", (category_id,))

    return {"success": True, "message": "Kategoriya o‘chirildi."}

@app.get("/api/admin/products")

def admin_get_products(admin=Depends(require_admin)):

    with get_db() as db:

        rows = db.execute("""

            SELECT * FROM products ORDER BY id DESC

        """).fetchall()

    return {

        "success": True,

        "products": [dict(row) for row in rows],

    }

@app.post("/api/admin/products", status_code=201)

def create_product(

    product: ProductCreate,

    admin=Depends(require_admin),

):

    name = product.name.strip()

    category = product.category.strip()

    if not name or not category:

        raise HTTPException(

            status_code=400,

            detail="Mahsulot nomi va kategoriyasi kerak.",

        )

    with get_db() as db:

        cursor = db.execute("""

            INSERT INTO products

                (name, category, price, image, description, is_active)

            VALUES (?, ?, ?, ?, ?, ?)

        """, (

            name,

            category,

            product.price,

            product.image.strip(),

            product.description.strip(),

            int(product.is_active),

        ))

        product_id = cursor.lastrowid

        row = db.execute(

            "SELECT * FROM products WHERE id = ?",

            (product_id,),

        ).fetchone()

    return {

        "success": True,

        "message": "Mahsulot qo'shildi.",

        "product": dict(row),

    }

@app.put("/api/admin/products/{product_id}")

def update_product(

    product_id: int,

    product: ProductCreate,

    admin=Depends(require_admin),

):

    with get_db() as db:

        existing = db.execute(

            "SELECT id FROM products WHERE id = ?",

            (product_id,),

        ).fetchone()

        if existing is None:

            raise HTTPException(

                status_code=404,

                detail="Mahsulot topilmadi.",

            )

        db.execute("""

            UPDATE products

            SET name = ?, category = ?, price = ?,

                image = ?, description = ?, is_active = ?

            WHERE id = ?

        """, (

            product.name.strip(),

            product.category.strip(),

            product.price,

            product.image.strip(),

            product.description.strip(),

            int(product.is_active),

            product_id,

        ))

        row = db.execute(

            "SELECT * FROM products WHERE id = ?",

            (product_id,),

        ).fetchone()

    return {

        "success": True,

        "message": "Mahsulot yangilandi.",

        "product": dict(row),

    }

@app.delete("/api/admin/products/{product_id}")

def delete_product(

    product_id: int,

    admin=Depends(require_admin),

):

    # Buyurtmalardagi tarixiy mahsulot ma'lumotlarini saqlash uchun

    # mahsulotni jismonan o'chirmaymiz, katalogdan yashiramiz.

    with get_db() as db:

        cursor = db.execute("""

            UPDATE products

            SET is_active = 0

            WHERE id = ? AND is_active = 1

        """, (product_id,))

        if cursor.rowcount == 0:

            raise HTTPException(

                status_code=404,

                detail="Faol mahsulot topilmadi.",

            )

    return {

        "success": True,

        "message": "Mahsulot katalogdan olib tashlandi.",

    }

# ==================================================

# ADMIN: KURYERLAR

# ==================================================

@app.get("/api/admin/couriers")

def get_couriers(admin=Depends(require_admin)):

    with get_db() as db:

        rows = db.execute("""

            SELECT id, username, role, is_active, created_at

            FROM users

            WHERE role = 'courier'

            ORDER BY id DESC

        """).fetchall()

    return {

        "success": True,

        "couriers": [dict(row) for row in rows],

    }

@app.post("/api/admin/couriers", status_code=201)

def create_courier(

    courier: CourierCreate,

    admin=Depends(require_admin),

):

    username = courier.username.strip()

    if not username:

        raise HTTPException(

            status_code=400,

            detail="Kuryer loginini kiriting.",

        )

    with get_db() as db:

        existing = db.execute(

            "SELECT id FROM users WHERE username = ?",

            (username,),

        ).fetchone()

        if existing:

            raise HTTPException(

                status_code=409,

                detail="Bu login band. Boshqa login tanlang.",

            )

        cursor = db.execute("""

            INSERT INTO users (username, password_hash, role)

            VALUES (?, ?, 'courier')

        """, (

            username,

            password_hasher.hash(courier.password),

        ))

        courier_id = cursor.lastrowid

    return {

        "success": True,

        "message": "Kuryer akkaunti yaratildi.",

        "courier": {

            "id": courier_id,

            "username": username,

            "role": "courier",

        },

    }

@app.patch("/api/admin/couriers/{courier_id}/active")

def set_courier_active(

    courier_id: int,

    is_active: bool,

    admin=Depends(require_admin),

):

    with get_db() as db:

        cursor = db.execute("""

            UPDATE users

            SET is_active = ?

            WHERE id = ? AND role = 'courier'

        """, (int(is_active), courier_id))

        if cursor.rowcount == 0:

            raise HTTPException(

                status_code=404,

                detail="Kuryer topilmadi.",

            )

    return {

        "success": True,

        "message": "Kuryer holati yangilandi.",

        "is_active": is_active,

    }

# ==================================================

# BUYURTMA QABUL QILISH

# ==================================================

@app.post("/api/orders", status_code=201)

async def create_order(order: OrderRequest):

    if order.order_type not in ("delivery", "pickup"):

        raise HTTPException(

            status_code=400,

            detail="Buyurtma turini to'g'ri tanlang.",

        )

    if order.order_type == "delivery" and not (

        order.address and order.address.strip()

    ):

        raise HTTPException(

            status_code=400,

            detail="Yetkazib berish manzili kerak.",

        )

    if not order.customer_name.strip() or not order.phone.strip():

        raise HTTPException(

            status_code=400,

            detail="Ism va telefon raqamini kiriting.",

        )

    tracking_token = secrets.token_urlsafe(32)
    telegram_user = verify_telegram_init_data(order.telegram_init_data or "")
    telegram_user_id = (
        str(telegram_user["id"])
        if telegram_user and telegram_user.get("id")
        else None
    )
    print("[TEST] telegram_init_data mavjud:", bool(order.telegram_init_data))
    print("[TEST] Telegram foydalanuvchisi tekshiruvdan o'tdi:", bool(telegram_user))
    print("[TEST] Telegram ID:", telegram_user_id)

    saved_items = []

    total = 0

    with get_db() as db:

        for item in order.items:

            product = db.execute("""

                SELECT id, name, price

                FROM products

                WHERE id = ? AND is_active = 1

            """, (item.product_id,)).fetchone()

            if product is None:

                raise HTTPException(

                    status_code=400,

                    detail=f"Faol mahsulot topilmadi: {item.product_id}",

                )

            line_total = product["price"] * item.quantity

            total += line_total

            saved_items.append({

                "product_id": product["id"],

                "name": product["name"],

                "price": product["price"],

                "quantity": item.quantity,

                "subtotal": line_total,

            })

        cursor = db.execute("""

            INSERT INTO orders (
                customer_name, phone, order_type, address,
                items_json, total_price, tracking_token, telegram_user_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)

        """, (

            order.customer_name.strip(),

            order.phone.strip(),

            order.order_type,

            order.address.strip() if order.address else None,

            json.dumps(saved_items, ensure_ascii=False),

            total,
            tracking_token,
            telegram_user_id,

        ))

        order_id = cursor.lastrowid

    items_text = "\n".join(

        f"• {item['name']} x {item['quantity']} "

        f"= {item['subtotal']:,} so'm"

        for item in saved_items

    )

    order_type_text = (

        "Yetkazib berish 🚚"

        if order.order_type == "delivery"

        else "Olib ketish 🛍"

    )

    message = (

        f"🆕 YANGI BUYURTMA #{order_id}\n\n"

        f"👤 Mijoz: {order.customer_name.strip()}\n"

        f"📞 Telefon: {order.phone.strip()}\n"

        f"📦 Buyurtma turi: {order_type_text}\n"

    )

    if order.order_type == "delivery":

        message += f"📍 Manzil: {order.address.strip()}\n"

    message += (

        f"\n🍔 MAHSULOTLAR:\n{items_text}\n\n"

        f"💰 JAMI: {total:,} so'm\n"

        f"📌 Holati: Yangi"

    )

    await send_telegram_notification(message)

    return {

        "success": True,

        "message": "Buyurtmangiz qabul qilindi!",

        "order_id": order_id,

        "total_price": total,

        "status": "Yangi",
        "tracking_token": tracking_token,

    }

# ==================================================

# ADMIN: BUYURTMALAR

# ==================================================

@app.get("/api/admin/orders")

def admin_get_orders(admin=Depends(require_admin)):

    with get_db() as db:

        rows = db.execute("""

            SELECT * FROM orders

            ORDER BY id DESC

        """).fetchall()

    orders = []

    for row in rows:

        item = dict(row)

        item["items"] = json.loads(item.pop("items_json"))

        orders.append(item)

    return {

        "success": True,

        "orders": orders,

    }

# ==================================================

# ADMIN: BUYURTMANI KURYERGA BIRIKTIRISH

# ==================================================

@app.patch("/api/admin/orders/{order_id}/assign")

def assign_order_to_courier(

    order_id: int,

    data: AssignCourierRequest,

    admin=Depends(require_admin),

):

    with get_db() as db:

        order = db.execute(

            "SELECT id FROM orders WHERE id = ?",

            (order_id,),

        ).fetchone()

        if order is None:

            raise HTTPException(status_code=404, detail="Buyurtma topilmadi.")

        courier = db.execute(

            """

            SELECT id, username, is_active

            FROM users

            WHERE id = ? AND role = 'courier'

            """,

            (data.courier_id,),

        ).fetchone()

        if courier is None or not courier["is_active"]:

            raise HTTPException(

                status_code=400,

                detail="Faol kuryer topilmadi.",

            )

        db.execute(

            "UPDATE orders SET courier_id = ? WHERE id = ?",

            (data.courier_id, order_id),

        )

    return {

        "success": True,

        "message": "Buyurtma kuryerga biriktirildi.",

        "order_id": order_id,

        "courier": {"id": courier["id"], "username": courier["username"]},

    }

# ==================================================

# KURYER: FAQAT O'Z BUYURTMALARI

# ==================================================

@app.get("/api/courier/orders")

def get_courier_orders(user=Depends(get_current_user)):

    if user["role"] != "courier":

        raise HTTPException(

            status_code=403,

            detail="Bu bo'lim faqat kuryerlar uchun.",

        )

    with get_db() as db:

        rows = db.execute(

            """

            SELECT id, customer_name, phone, order_type, address,

                   items_json, total_price, status, created_at

            FROM orders

            WHERE courier_id = ?

            ORDER BY id DESC

            """,

            (user["id"],),

        ).fetchall()

    orders = []

    for row in rows:

        item = dict(row)

        item["items"] = json.loads(item.pop("items_json"))

        orders.append(item)

    return {"success": True, "orders": orders}

# ==================================================

# KURYER: BUYURTMA HOLATINI YANGILASH

# ==================================================

@app.patch("/api/courier/orders/{order_id}/status")

async def update_courier_order_status(

    order_id: int,

    data: CourierOrderStatusRequest,

    user=Depends(get_current_user),

):

    if user["role"] != "courier":

        raise HTTPException(

            status_code=403,

            detail="Bu amal faqat kuryerlar uchun.",

        )

    allowed_statuses = {"Qabul qilindi", "Yo'lda", "Yetkazildi"}

    if data.status not in allowed_statuses:

        raise HTTPException(

            status_code=400,

            detail="Buyurtma holati noto'g'ri.",

        )

    with get_db() as db:

        order = db.execute(

            """

            SELECT id, status, telegram_user_id

            FROM orders

            WHERE id = ? AND courier_id = ?

            """,

            (order_id, user["id"]),

        ).fetchone()

        if order is None:

            raise HTTPException(

                status_code=404,

                detail="Biriktirilgan buyurtma topilmadi.",

            )

        if order["status"] == "Yetkazildi":

            raise HTTPException(

                status_code=400,

                detail="Yetkazilgan buyurtmani qayta o'zgartirib bo'lmaydi.",

            )

        db.execute(

            """

            UPDATE orders

            SET status = ?

            WHERE id = ? AND courier_id = ?

            """,

            (data.status, order_id, user["id"]),

        )

    
    print(f"[TEST] Buyurtma #{order_id}, yangi holat: {data.status}")
    print(
        "[TEST] Mijoz Telegram ID mavjud:",
        bool(order["telegram_user_id"]),
    )

    sent = await send_customer_telegram_message(
        order["telegram_user_id"],
        (
            f"🍔 TezTaom — buyurtma #{order_id}\n\n"
            f"📌 Yangi holat: {data.status}\n"
            "Buyurtmangiz holatini Mini App ichida kuzatishingiz mumkin."
        ),
    )

    print(f"[TEST] Telegram xabari yuborildi: {sent}")

    return {
        "success": True,
        "message": "Buyurtma holati yangilandi.",
        "order_id": order_id,
        "status": data.status,
        "telegram_notification_sent": sent,
    }

    return {

        "success": True,

        "message": "Buyurtma holati yangilandi.",

        "order_id": order_id,

        "status": data.status,

    }

# ==================================================

# BITTA BUYURTMANI KO'RISH

# ==================================================

@app.get("/api/orders/track/{tracking_token}")
def track_order(tracking_token: str):
    """Maxfiy token bilan holatni ko'rsatadi; telefon/manzil qaytarmaydi."""
    with get_db() as db:
        row = db.execute(
            """
            SELECT id, customer_name, order_type, items_json,
                   total_price, status, created_at
            FROM orders
            WHERE tracking_token = ?
            """,
            (tracking_token,),
        ).fetchone()
    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Buyurtma topilmadi yoki kuzatish havolasi noto'g'ri.",
        )
    result = dict(row)
    result["items"] = json.loads(result.pop("items_json"))
    return {"success": True, "order": result}


@app.get("/api/orders/{order_id}")

def get_order(order_id: int):

    with get_db() as db:

        row = db.execute(

            """
            SELECT id, customer_name, order_type, items_json,
                   total_price, status, created_at
            FROM orders WHERE id = ?
            """,

            (order_id,),

        ).fetchone()

    if row is None:

        raise HTTPException(

            status_code=404,

            detail="Buyurtma topilmadi.",

        )

    result = dict(row)

    result["items"] = json.loads(result.pop("items_json"))

    return result
