# Placeholder icons

Both `images/extension-icon.png` (128×128) and `ReviewTask/icon.png`
(32×32) are placeholders that need to be created before the
extension can be sideloaded or published. The Azure DevOps
Marketplace rejects .vsix packages that lack valid icons at the
expected sizes.

## How to generate the placeholders

Until real icons are designed, you can generate valid-sized placeholders
with ImageMagick or any raster editor. The marketplace accepts PNG,
BMP, GIF, EXIF, JPG, and TIFF.

```bash
# 128×128 placeholder for the extension (using ImageMagick)
magick -size 128x128 xc:'#2563eb' \
  -fill white -gravity center -pointsize 24 -annotate +0+0 'U' \
  images/extension-icon.png

# 32×32 placeholder for the task
magick -size 32x32 xc:'#2563eb' \
  -fill white -gravity center -pointsize 14 -annotate +0+0 'U' \
  ReviewTask/icon.png
```

The placeholder above is a 128×128 blue square with a white "U"
centered. Replace with the real UmActually brand mark before
publishing.

## Real icon requirements

- **Extension icon** (`images/extension-icon.png`): 128×128 pixels,
  PNG/BMP/GIF/EXIF/JPG/TIFF, sRGB color profile, transparent
  background optional. The marketplace displays this at multiple
  sizes (the largest is the details-page hero).
- **Task icon** (`ReviewTask/icon.png`): 32×32 pixels, same format
  constraints. The task picker uses this at 16×16 in lists and
  32×32 on the task-edit form.

If you'd like a real icon, ask a designer (or use an SVG-to-PNG
tool to convert from the UmActually logo at any size). The
marketplace does not enforce a specific brand, but the icon must
look intentional — a default-shaped placeholder gets flagged
during the marketplace automated review.
