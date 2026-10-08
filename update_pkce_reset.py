import sys
import re

with open('apps/api/live.ts', 'r', encoding='utf-8') as f:
    live = f.read()

live = re.sub(
    r"app\.post\('/api/auth/reset',\s*async\s+c\s*=>\s*\{[\s\S]*?resetPasswordForEmail\(input\.email\);[\s\S]*?\}\);",
    "app.post('/api/auth/reset', async c => {\n      const input = email.parse(await c.req.json()); await c.get('db').auth.resetPasswordForEmail(input.email, { redirectTo: `${c.env.APP_ORIGIN || 'https://nor-vi.in'}/update-password` });\n      return c.json({ message: 'If this account exists, a password reset email will arrive shortly.' });\n    });",
    live,
    count=1
)

recover_old_pattern = r"app\.post\('/api/auth/recover',\s*async\s+c\s*=>\s*\{[\s\S]*?token_hash[\s\S]*?\}\);"
recover_new = """app.post('/api/auth/recover', async c => {
      const input = z.object({ token_hash: z.string().optional(), code: z.string().optional(), password }).parse(await c.req.json()); const db = c.get('db');
      if (input.code) {
        const { error } = await db.auth.exchangeCodeForSession(input.code);
        if (error) return c.json({ error: 'This recovery link is invalid or expired. Request another reset email.' }, 400);
      } else if (input.token_hash) {
        const { error } = await db.auth.verifyOtp({ token_hash: input.token_hash, type: 'recovery' });
        if (error) return c.json({ error: 'This recovery link is invalid or expired. Request another reset email.' }, 400);
      } else {
        return c.json({ error: 'Missing recovery token.' }, 400);
      }
      const result = await db.auth.updateUser({ password: input.password }); await db.auth.signOut({ scope: 'global' });
      return result.error ? c.json({ error: 'Password could not be changed. Request a new reset link or contact support if MFA recovery is required.' }, 400) : c.json({ ok: true });
    });"""

live = re.sub(recover_old_pattern, recover_new, live, count=1)

with open('apps/api/live.ts', 'w', encoding='utf-8') as f:
    f.write(live)
print("Updated live.ts successfully.")

with open('apps/web/src/ui/App.tsx', 'r', encoding='utf-8') as f:
    app = f.read()

app = re.sub(
    r"if \(\(location\.hash\.includes\('type=signup'\) && location\.hash\.includes\('access_token='\)\) \|\| location\.search\.includes\('code='\)\) \{",
    r"if (location.pathname !== '/update-password' && ((location.hash.includes('type=signup') && location.hash.includes('access_token=')) || location.search.includes('code='))) {",
    app,
    count=1
)

with open('apps/web/src/ui/App.tsx', 'w', encoding='utf-8') as f:
    f.write(app)
print("Updated App.tsx successfully.")

with open('apps/web/src/ui/Accounts.tsx', 'r', encoding='utf-8') as f:
    accounts = f.read()

accounts = re.sub(
    r"const params = new URLSearchParams\(location\.hash\.slice\(1\)\);\s*setToken\(params\.get\('token_hash'\) \|\| ''\);",
    "const hashParams = new URLSearchParams(location.hash.slice(1));\n      const queryParams = new URLSearchParams(location.search);\n      setToken(queryParams.get('code') || hashParams.get('token_hash') || '');",
    accounts,
    count=1
)

accounts = re.sub(
    r"setRecovery\(path === '/update-password' \|\| params\.get\('type'\) === 'recovery'\);",
    "setRecovery(path === '/update-password' || hashParams.get('type') === 'recovery');",
    accounts,
    count=1
)

accounts = accounts.replace(
    "{ token_hash: token, password }",
    "{ code: token, token_hash: token, password }"
)

with open('apps/web/src/ui/Accounts.tsx', 'w', encoding='utf-8') as f:
    f.write(accounts)
print("Updated Accounts.tsx successfully.")

