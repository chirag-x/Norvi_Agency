import sys

# 1. Update PublicPages.tsx
with open('apps/web/src/ui/PublicPages.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('+91-8305525932', '+91-9893534314')
content = content.replace('Mon-Fri, 9am-6pm IST', 'Mon-Sat, 10am-6pm IST')
content = content.replace('Mon-Fri, 9am - 6pm IST', 'Mon-Sat, 10am-6pm IST')
content = content.replace('chiragsharmawork95@gmail.com', 'norviagency@gmail.com')

with open('apps/web/src/ui/PublicPages.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

# 2. Update Voro/profiles.json
with open('Voro/profiles.json', 'r', encoding='utf-8') as f:
    voro = f.read()

voro = voro.replace('8305525932', '9893534314')
voro = voro.replace('chiragsharmawork95@gmail.com', 'norviagency@gmail.com')

with open('Voro/profiles.json', 'w', encoding='utf-8') as f:
    f.write(voro)

print("Updates completed successfully.")
