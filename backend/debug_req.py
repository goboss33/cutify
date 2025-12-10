import requests
import jwt
import datetime

# Create a dummy JWT
token = jwt.encode(
    {"sub": "debug_user", "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)},
    "secret",
    algorithm="HS256"
)

url = "http://127.0.0.1:8000/api/projects"
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}
data = {
    "title": "Debug Project",
    "genre": "Test",
    "language": "French",
    "target_duration": "60s",
    "aspect_ratio": "16:9",
    "pitch": "",
    "visual_style": "",
    "target_audience": ""
}

try:
    print(f"Sending request to {url}...")
    resp = requests.post(url, json=data, headers=headers)
    print(f"Status Code: {resp.status_code}")
    print(f"Response: {resp.text}")
except Exception as e:
    print(f"Request failed: {e}")
