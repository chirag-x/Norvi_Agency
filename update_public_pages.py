import sys

with open('apps/web/src/ui/PublicPages.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_button = """<button className="button secondary full" onClick={() => setTrialModal(true)}>Start free trial</button>"""
new_button = """{product.trialActive !== false && <button className="button secondary full" onClick={() => setTrialModal(true)}>Start free trial</button>}"""

if old_button in content:
    content = content.replace(old_button, new_button)
    with open('apps/web/src/ui/PublicPages.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Updated PublicPages.tsx")
else:
    print("old_button not found!")
    sys.exit(1)
