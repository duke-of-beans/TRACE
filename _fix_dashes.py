import os

files = [
    r"D:\Projects\TRACE\README.md",
    r"D:\Projects\TRACE\CONTRIBUTING.md",
    r"D:\Projects\TRACE\docs\CHAPTER_SETUP.md",
    r"D:\Projects\TRACE\setup.sql",
]

for path in files:
    if not os.path.exists(path):
        continue
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    em = content.count("\u2014")
    en = content.count("\u2013")
    if em > 0 or en > 0:
        print(f"{os.path.basename(path)}: {em} em, {en} en dashes")
        # Fix them
        content = content.replace(" \u2014 ", ". ")
        content = content.replace("\u2014", " -")
        content = content.replace(" \u2013 ", ". ")
        content = content.replace("\u2013", " -")
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  Fixed.")
    else:
        print(f"{os.path.basename(path)}: clean")
