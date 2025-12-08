import requests
import json

url = "http://127.0.0.1:8000/api/extract-concept"
headers = {"Content-Type": "application/json"}
data = {
    "messages": [
        {"senderId": "user", "text": "Hello world"},
        {"senderId": "agent", "text": "Hi there"}
    ]
}

try:
    print(f"Sending POST to {url}...")
    response = requests.post(url, headers=headers, json=data)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Failed: {e}")
