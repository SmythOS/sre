import requests

URL = "http://localhost:3000/health"

try:
    r = requests.get(URL)
    print("Health Check:", r.json())
except Exception as e:
    print("❌ Error:", e)
