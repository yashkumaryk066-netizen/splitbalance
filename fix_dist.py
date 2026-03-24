import os

for root, _, files in os.walk('./dist'):
    for file in files:
        if file.endswith('.html') or file.endswith('.js') or file.endswith('.json'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content.replace('_expo', 'expo_assets').replace('_sitemap', 'sitemap')
            
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)

if os.path.exists('./dist/_sitemap.html'):
    os.rename('./dist/_sitemap.html', './dist/sitemap.html')

if os.path.exists('./dist/_expo'):
    os.rename('./dist/_expo', './dist/expo_assets')
