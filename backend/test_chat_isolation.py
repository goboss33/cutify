import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000/api"

def create_project(title):
    print(f"Creating project '{title}'...")
    payload = {
        "messages": [
            {"senderId": "user", "text": f"I want to make a movie called {title}."}
        ]
    }
    res = requests.post(f"{BASE_URL}/extract-concept", json=payload)
    if res.status_code != 200:
        print(f"Failed to create project: {res.text}")
        return None
    data = res.json()
    print(f"Project Created: ID={data['id']} Title={data['title']}")
    return data['id']

def chat(project_id, message):
    print(f"Chatting on Project {project_id}: '{message}'")
    payload = {"content": message}
    res = requests.post(f"{BASE_URL}/projects/{project_id}/chat", json=payload)
    if res.status_code != 200:
        print(f"Chat failed: {res.text}")
        return None
    data = res.json()
    print(f"Agent Replied: {data['content'][:50]}...")
    return data['content']

def test_isolation():
    # 1. Create two projects
    p1 = create_project("Project Alpha")
    p2 = create_project("Project Beta")
    
    if not p1 or not p2:
        return

    # 2. Chat on P1
    chat(p1, "My name is Commander Shepard.")
    
    # 3. Chat on P2
    chat(p2, "What is my name?") 
    # Expect: Agent doesn't know, or guesses randomly, but shouldn't know Shepard if it's strictly isolated.
    
    # 4. Chat on P1 again
    chat(p1, "What was my name again?")
    # Expect: Agent knows Shepard.

if __name__ == "__main__":
    time.sleep(2) # Wait for server
    test_isolation()
