import requests
import os

# Step 1: Query Europe PMC for 100 open-access articles
api_url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=OPEN_ACCESS:Y&format=json&pageSize=100"
response = requests.get(api_url)
data = response.json()

# Step 2: Extract PMCIDs
pmcids = [result['pmcid'] for result in data['resultList']['result'] if 'pmcid' in result]

# Step 3: Create output folder
os.makedirs('articles_html', exist_ok=True)

# Set headers to simulate a browser
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36"
}

# Step 4: Download and save each article's full HTML
for pmcid in pmcids:
    html_url = f'https://www.ncbi.nlm.nih.gov/pmc/articles/{pmcid}/'  # Updated URL
    html_response = requests.get(html_url, headers=headers)

    if html_response.status_code == 200:
        file_path = f'articles_html/{pmcid}.html'
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(html_response.text)
        print(f"✅ Saved {pmcid}")
    elif html_response.status_code == 403:
        print(f"❌ Failed to fetch {pmcid}: Access Forbidden (403)")
    else:
        print(f"❌ Failed to fetch {pmcid}: {html_response.status_code}")
