import requests
import json

url = "http://127.0.0.1:8000/api/extract-concept"

payload = {
    "messages": [
        {"senderId": "user", "text": "I want to make a movie about a space cat."},
        {"senderId": "agent", "text": "Tell me more about the genre."},
        {"senderId": "user", "text": "It is a sci-fi comedy."}
    ]
}

try:
    print(f"Sending request to {url}...")
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Request failed: {e}")
