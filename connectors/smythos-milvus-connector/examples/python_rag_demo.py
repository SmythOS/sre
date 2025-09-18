import requests

URL = "http://localhost:3000/vectors/insert"

data = {
    "id": 1,
    "vector": [0.12, 0.55, 0.33, 0.91]
}

response = requests.post(URL, json=data)
print("Insert Response:", response.json())
