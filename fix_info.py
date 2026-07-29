import re

file_path = r'c:\Users\lrodr\Documents\GitHub\Digital-Footprint\info.html'

with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Replace corrupted characters in specific words using regex
patterns = {
    r'Informaci.n': 'Información',
    r'autom.ticamente': 'automáticamente',
    r'recibir.s': 'recibirás',
    r'Invitaci.n': 'Invitación',
    r'T.rminos': 'Términos',
    r'dep.sitos': 'depósitos',
    r'instant.nea': 'instantánea',
    r'd.gitos': 'dígitos',
    r'M.todos': 'Métodos',
    r'instant.neo': 'instantáneo',
    r'administraci.n': 'administración',
    r'Podr.s': 'Podrás',
    r'pesta.a': 'pestaña',
    r'espec.ficas': 'específicas',
    r'electr.nicos': 'electrónicos',
    r'..nico y': 'único y',
    r'env.os': 'envíos',
    r'tipogr.ficos': 'tipográficos',
    r'.nicamente': 'únicamente',
    r'soluci.n': 'solución',
    r'\.Tienes': '¿Tienes',
    r'sesi.n': 'sesión',
    r'Navegaci.n': 'Navegación',
}

for pat, rep in patterns.items():
    content = re.sub(pat, rep, content)

# Remove the duplicated blue share button
blue_btn_pattern = r'<button class="btn-primary" id="btn-share-referral-mobile" style="width: 100%; border-radius: 30px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px;">\s*Compartir Link <i class="fa-solid fa-share-nodes"></i>\s*</button>'
content = re.sub(blue_btn_pattern, '', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("info.html fixed successfully.")
