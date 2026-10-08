import sys

sys.stdout.reconfigure(encoding='utf-8')
with open('apps/web/src/ui/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find("function ChatWidget")
if start != -1:
    end = content.find("function", start + 20)
    if end == -1:
        end = len(content)
    print(content[start:end])
else:
    print("Not found")
