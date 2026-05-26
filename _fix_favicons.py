svg_pwa = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#0F172A"/>
  <rect x="7" y="8" width="18" height="1.8" rx="0.9" fill="#818CF8"/>
  <rect x="14.5" y="8" width="3" height="16" rx="1.5" fill="#818CF8"/>
  <rect x="10" y="26.5" width="12" height="1" rx="0.5" fill="#818CF8" opacity="0.35"/>
</svg>'''

svg_op = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#0F172A"/>
  <rect x="7" y="8" width="18" height="1.5" rx="0.75" fill="#818CF8"/>
  <rect x="15" y="8" width="2" height="16" rx="1" fill="#818CF8"/>
  <rect x="11" y="26" width="10" height="0.8" rx="0.4" fill="#818CF8" opacity="0.4"/>
</svg>'''

import os

for path, content in [
    (r"D:\Projects\TRACE\pwa\public\favicon.svg", svg_pwa),
    (r"D:\Projects\TRACE\operator\public\favicon.svg", svg_op),
]:
    # Delete the corrupted file first
    if os.path.exists(path):
        os.remove(path)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    size = os.path.getsize(path)
    print(f"{os.path.basename(path)}: {size} bytes written")
    # Verify
    with open(path, "r", encoding="utf-8") as f:
        verify = f.read()
    print(f"  Verified: starts with <svg: {'<svg' in verify}")
