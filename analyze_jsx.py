import re

with open('/app/frontend/src/pages/CustomersPage.js', 'r') as f:
    lines = f.readlines()

# Focus on lines 267-454 (the else branch)
start = 267 - 1  # 0-indexed
end = 454

print("Line-by-line JSX structure analysis (lines 267-454):\n")
print("Line 267: ) : (  <- Start of else branch")
print("Line 268: <div>  <- Opening div for else content")
print()

# Track key structural elements
for i in range(268, end):
    line = lines[i].rstrip()
    line_num = i + 1
    
    # Check for key structural markers
    if '<div' in line and not line.strip().startswith('//'):
        indent = len(line) - len(line.lstrip())
        print(f"Line {line_num}: {' ' * (indent//2)}OPEN <div>")
    elif '</div>' in line and not line.strip().startswith('//'):
        indent = len(line) - len(line.lstrip())
        print(f"Line {line_num}: {' ' * (indent//2)}CLOSE </div>")
    elif line.strip() == ')}':
        indent = len(line) - len(line.lstrip())
        print(f"Line {line_num}: {' ' * (indent//2)}CLOSE conditional")
    elif line.strip().startswith('{/*') or '/* Paginación */' in line:
        print(f"Line {line_num}: COMMENT: {line.strip()}")

