import sys

sys.stdout.reconfigure(encoding='utf-8')
with open('apps/web/src/ui/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

app_start = content.find("export default function App")
app_end = content.find("export function ProductIcon")
print(content[app_start:app_end])
