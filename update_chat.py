import sys

sys.stdout.reconfigure(encoding='utf-8')
with open('apps/web/src/ui/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Snippet 1: Main Container
s1_old = "width: 350, height: 500, background: 'var(--background)', border: '1px solid var(--border)',"
s1_new = "width: 350, height: 500, background: 'rgba(13, 17, 12, 0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid var(--border)',"
content = content.replace(s1_old, s1_new)

# Snippet 2: Header
s2_old = "<div style={{background: 'var(--surface)', padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)'}}>"
s2_new = "<div style={{background: 'rgba(255, 255, 255, 0.03)', padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)'}}>"
content = content.replace(s2_old, s2_new)

# Snippet 3: AI Message Bubbles
s3_old = "background: m.role === 'user' ? 'var(--accent)' : 'var(--surface)',"
s3_new = "background: m.role === 'user' ? 'var(--accent)' : 'var(--panel)',"
content = content.replace(s3_old, s3_new)

# Snippet 4: Typing Indicator
s4_old = "<div style={{alignSelf: 'flex-start', background: 'var(--surface)', padding: '10px 14px', borderRadius: 12}}><span className=\"dot-typing\">...</span></div>"
s4_new = "<div style={{alignSelf: 'flex-start', background: 'var(--panel)', padding: '10px 14px', borderRadius: 12}}><span className=\"dot-typing\">...</span></div>"
content = content.replace(s4_old, s4_new)

# Snippet 5: Form Input
s5_old = "<form onSubmit={send} style={{display: 'flex', padding: 12, borderTop: '1px solid var(--border)', background: 'var(--surface)'}}>"
s5_new = "<form onSubmit={send} style={{display: 'flex', padding: 12, borderTop: '1px solid var(--border)', background: 'rgba(0, 0, 0, 0.2)'}}>"
content = content.replace(s5_old, s5_new)

with open('apps/web/src/ui/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("ChatWidget updated with Frosted Glass styling.")
