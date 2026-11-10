import json

with open(r'e:\Agency\packages\shared\catalog.json', 'r', encoding='utf-8') as f:
    cat = json.load(f)

rolvio_obj = None
for p in cat['products']:
    if p.get('slug') == 'rolvio':
        rolvio_obj = p
        break

with open(r'e:\Agency\packages\shared\model.ts', 'r', encoding='utf-8') as f:
    model_content = f.read()

start_marker = '    id: "agent-3",'
end_marker = 'export function seed(): Store {'

start_idx = model_content.find(start_marker)
end_idx = model_content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    # Find the opening brace before start_idx
    brace_idx = model_content.rfind('{', 0, start_idx)
    # Find the closing brace of this object before end_idx
    close_brace_idx = model_content.rfind('}', 0, end_idx)
    
    rolvio_json_str = json.dumps(rolvio_obj, indent=4, ensure_ascii=False)
    # indent lines by 2 spaces
    rolvio_ts_str = '\n'.join('  ' + line for line in rolvio_json_str.splitlines())
    
    new_model_content = model_content[:brace_idx] + rolvio_ts_str.lstrip() + model_content[close_brace_idx+1:]
    with open(r'e:\Agency\packages\shared\model.ts', 'w', encoding='utf-8') as f:
        f.write(new_model_content)
    print('Updated model.ts successfully!')
else:
    print('Could not find markers:', start_idx, end_idx)
