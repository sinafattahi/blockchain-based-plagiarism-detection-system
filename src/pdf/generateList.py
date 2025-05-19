import os
import json

# Define the directory containing the article files
articles_dir = os.path.join('/Users/sina/Documents/Projects/blockchain/base-blockchain-hardhat-and-react/public', 'articles')

# Output file path for the list.json
output_path = os.path.join(articles_dir, 'list.json')

# Read the files in the directory
try:
    files = os.listdir(articles_dir)
    txt_files = [file for file in files if file.endswith(".txt")]
    txt_files.sort()  # Sort alphabetically if desired
    
    # Write the list of txt files to list.json
    with open(output_path, 'w') as f:
        json.dump(txt_files, f, indent=2)
    
    print(f"✅ list.json created with {len(txt_files)} articles")
except Exception as e:
    print(f"Error: {e}")
