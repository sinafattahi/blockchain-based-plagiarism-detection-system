import requests
import os
import time

# --------------------------
# CONFIG
# --------------------------
BASE_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
QUERY = "OPEN_ACCESS:Y"
PAGE_SIZE = 1000       # max allowed
SAVE_DIR = "articles_html"

# Create folder for HTMLs
os.makedirs(SAVE_DIR, exist_ok=True)

# Browser-like headers
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/58.0.3029.110 Safari/537.36"
}

# --------------------------
# Step 1: Collect PMCIDs with cursorMark
# --------------------------
pmcids = []
cursor = "*"
batch = 0
max_batches = 10   # adjust as needed (200*1000 = 200k articles max)

while True:
    batch += 1
    print(f"📥 Fetching batch {batch} (cursor={cursor}) ...")
    params = {
        "query": QUERY,
        "format": "json",
        "pageSize": PAGE_SIZE,
        "cursorMark": cursor
    }
    response = requests.get(BASE_URL, params=params)
    if response.status_code != 200:
        print(f"⚠️ Failed batch {batch}: {response.status_code}")
        break
    
    data = response.json()
    results = data.get("resultList", {}).get("result", [])
    if not results:
        print("✅ No more results, stopping.")
        break
    
    new_ids = [r["pmcid"] for r in results if "pmcid" in r]
    pmcids.extend(new_ids)
    print(f"   Found {len(new_ids)} PMCIDs (total so far: {len(pmcids)})")
    
    next_cursor = data.get("nextCursorMark")
    if not next_cursor or next_cursor == cursor:
        print("✅ Reached end of dataset.")
        break
    
    cursor = next_cursor
    if batch >= max_batches:
        print("⏹️ Reached max_batches limit, stopping.")
        break
    
    time.sleep(0.5)

print(f"\n✅ Total PMCIDs collected: {len(pmcids)}\n")

# --------------------------
# Step 2: Download articles (skip existing files)
# --------------------------
for pmcid in pmcids:
    file_path = os.path.join(SAVE_DIR, f"{pmcid}.html")
    
    # ✅ Skip if already exists
    if os.path.exists(file_path):
        print(f"⏭️ Skipped {pmcid} (already downloaded)")
        continue
    
    html_url = f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmcid}/?report=classic"
    html_response = requests.get(html_url, headers=HEADERS)
    
    if html_response.status_code == 200:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(html_response.text)
        print(f"✅ Saved {pmcid}")
    elif html_response.status_code == 403:
        print(f"❌ Forbidden (403): {pmcid}")
    elif html_response.status_code == 404:
        print(f"❌ Not found (404): {pmcid}")
    else:
        print(f"❌ Error {html_response.status_code}: {pmcid}")
    
    time.sleep(0.5)  # polite delay
