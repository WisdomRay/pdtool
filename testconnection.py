# test_connection.py
import os
import psycopg2

# Use your Render PostgreSQL credentials here
conn = psycopg2.connect(
    host="dpg-xxxx.oregon-postgres.render.com",
    database="your_db",
    user="your_user",
    password="your_password",
    port="5432"
)
print("Connection successful!")
conn.close()