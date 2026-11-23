from pathlib import Path

app_file = Path(__file__).with_name('App.tsx')

with open(app_file, 'rb') as f:
    content = f.read()

content = content.replace(
    b"defaultValue={lastReport?.readingTilawa?.fromSurah || SURAHS[0]}",
    b"value={lastReport?.readingTilawa?.fromSurah || SURAHS[0]}"
)
content = content.replace(
    b"defaultValue={lastReport?.readingTilawa?.toSurah || SURAHS[0]}",
    b"value={lastReport?.readingTilawa?.toSurah || SURAHS[0]}"
)

with open(app_file, 'wb') as f:
    f.write(content)

print("Done!")
