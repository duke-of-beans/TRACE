import re, sys

path = r"D:\Projects\TRACE\pwa\public\guide.html"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Count em dashes and en dashes
em_count = content.count("\u2014")  # —
en_count = content.count("\u2013")  # –
print(f"Em dashes found: {em_count}")
print(f"En dashes found: {en_count}")

# Show context for each
for i, line in enumerate(content.split("\n"), 1):
    if "\u2014" in line or "\u2013" in line:
        snippet = line.strip()[:120]
        print(f"  Line {i}: {snippet}")
