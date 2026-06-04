with open(r'c:\My App\Quran Classes Tracker\App.tsx', 'rb') as f:
    content = f.read()

content = content.replace(
    b"defaultValue={lastReport?.readingTilawa?.fromSurah || SURAHS[0]}",
    b"value={lastReport?.readingTilawa?.fromSurah || SURAHS[0]}"
)
content = content.replace(
    b"defaultValue={lastReport?.readingTilawa?.toSurah || SURAHS[0]}",
    b"value={lastReport?.readingTilawa?.toSurah || SURAHS[0]}"
)

with open(r'c:\My App\Quran Classes Tracker\App.tsx', 'wb') as f:
    f.write(content)

print("Done!")
