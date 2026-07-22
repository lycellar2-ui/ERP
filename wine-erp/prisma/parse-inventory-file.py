import pandas as pd
import openpyxl
import os
import json
import psycopg2
import dotenv

dotenv.load_dotenv(os.path.join(r"d:\Lyruou\wine-erp", ".env.local"))

db_url = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL")
if "?sslmode=require" in db_url:
    db_url = db_url.replace("?sslmode=require", "")

file_path = r"D:\Lyscellar\Kế toán\Kiểm kê\Kiểm kê TA 15.7.xlsx"
print(f"Reading file: {file_path}")

wb = openpyxl.load_workbook(file_path, data_only=True)
sheet_names = wb.sheetnames
print(f"Sheet names: {sheet_names}")

# Read first sheet
df = pd.read_excel(file_path, sheet_name=0)
print("\nFirst 10 rows preview:")
print(df.head(10))

print("\nColumns:", df.columns.tolist())

# Connect DB to get Master Data products
conn = psycopg2.connect(db_url)
cur = conn.cursor()
cur.execute("SELECT id, sku, name, status FROM products")
db_products = cur.fetchall()
conn.close()

db_sku_set = {p[1].strip().upper(): p for p in db_products if p[1]}
db_name_set = {p[2].strip().lower(): p for p in db_products if p[2]}

print(f"\nTotal master products in DB: {len(db_products)}")
