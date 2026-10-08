import sys

sys.stdout.reconfigure(encoding='utf-8')
with open('apps/web/src/ui/Accounts.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find("export function AccountAuth")
end = content.find("export function AccountSecurity")
if start != -1:
    print(content[start:end])
else:
    print("Not found")
