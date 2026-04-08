This work-in-progress tool displays data from Mario & Luigi: Bowser's Inside
Story. It runs completely offline in the browser. Try it out at
https://8y8x.github.io/mlbis-dumper/!

<div align="center">
<img src="https://raw.githubusercontent.com/8y8x/mlbis-dumper/refs/heads/main/assets/gallery-field-maps-or8.png" width="45%"></img>
<img src="https://raw.githubusercontent.com/8y8x/mlbis-dumper/refs/heads/main/assets/gallery-fonts-or8.png" width="45%"></img>
<img src="https://raw.githubusercontent.com/8y8x/mlbis-dumper/refs/heads/main/assets/gallery-battle-maps-or8.png" width="45%"></img>
<img src="https://raw.githubusercontent.com/8y8x/mlbis-dumper/refs/heads/main/assets/gallery-battle-scripts-or8.png" width="45%"></img>
</div>

The primary motivation for this project is to find as much unused content as
possible. It works on all known versions of the game (JP/ROC/NA/EU/KO releases
and the NA/EU kiosk demos) and it should work on any mod that hasn't
significantly altered the game's code.

Join us on the M&L Modding Server: https://discord.gg/VQAGjEVEvr

# Sections
These sections are useful for everyone:
- **Field Maps:** near-complete field map config support, including: tilemaps,
  layer blending, tile and palette animations, a 3d collision viewer, loading
  zones, depth faces, toggles, treasures, and layer config, as well as an Export
  PNG button
- **Battle Maps:** near-complete battle map backgrounds support, including tile
  and palette animations, debug linker info on some maps, and an Export PNG
  button
- **Fonts:** displays the game's recognized fonts (ARM9 font is used everywhere,
  StatFontSet does not seem to be used), unfortunately no way to export them yet
- **Messages:** nearly all text in the game as raw unformatted text or as
  formatted textboxes (display is slightly inaccurate though)
- **Battle Scripts:** decompiles attack, monster, and scene scripts into a
  readable, colorful pseudocode format; works well for simpler enemies but not
  for the complicated ones yet

These sections are useful for reverse engineers:
- **ROM Headers:** just some offsets for the tool to function
- **File System:** Lists ROM files and overlays, extract individual files or
  decompressed overlays, or everything as a .zip
- **Overlay Table:** Shows the NDS memory regions each overlay occupies,
  highlghts overlapping/incompatible overlays, shows overlay initializers, finds
  strings (class and file names specifically)
- **Monsters:** shows all enemies' name, sprite, and script id, also some basic
  stats; use [Dataglobin](https://github.com/MnL-Modding/Dataglobin) for more
  in-depth enemy info
- **FX Alls:** WIP
- **FX Sprites:** displays the \*fxTex.dat and \*fxPal.dat files, which are
  spritesheets used by the elusive FX system

These sections aren't too useful:
- **Field Palette Animations:** list of field maps palette animations that are
  controlled by FEvent scripts
- **FMapData Tile Viewer:** was used to reverse engineer tile animations, but
  now it's useless
- **Giant Battle Maps:** WIP, just the backgrounds so far, no Export PNG button
  yet, and no unused data to be seen so it's not useful
- **Menu Maps:** would be useful (several of these are unused), but you have to
  figure out the correct palette + tileset + tilemap + size + color depth yourself
- **Disassembler:** maps each uint32_t/uint16_t in an overlay to its ARMv5TE or
  ARMv4T instruction (ARM or Thumb mode), also highlights "unpredictable"
  instructions
- **Sound:** shows some music names but that's about it
- **Object Palette Animations:** not really useful

# Developing
1. Download the repository
2. Edit any .js file
3. Open index.html in your browser

No build step, no dependencies, no additional software. There is a .prettierrc
file for code cleanup but you don't need it.

While this tool isn't made for modding, you can do basic patches from your
browser's console (Ctrl+Shift+J or Cmd+Option+I). For example:
```js
propsDatComp = fsext.fmapdata.segments[field.rooms[0x239].props];
propsDat = lzBis(propsDatComp);
props = unpackSegmented(propsDat);
loadingZones = bufToU16(props[7]);
loadingZones[24 + 1] = 0x15b; // right zone, room id
loadingZones[24 + 7] = 30; // right zone, enter x
loadingZones[24 + 8] = 144; // right zone, enter y
loadingZones[24 + 9] = 0; // right zone, enter z
propsDatRecomp = lzBisCompress(propsDat);
if (propsDatRecomp.byteLength > propsDatComp.byteLength) {
    // use slightly larger block size so the compressed version stays smaller
    propsDatRecomp = lzBisCompress(propsDat, 768);
    console.log('using block size 768');
}
bufToU8(propsDatComp).set(bufToU8(propsDatRecomp), 0);
download('mlbis_patched.nds', file);
```
will change the right loading zone in the final save room to bring you to the
Tunnel.

# Thank Yous
- [GBATEK](https://problemkaputt.de/gbatek.htm)
- [Yoshi Magic](https://www.tapatalk.com/groups/lighthouse_of_yoshi/)
- ThePurpleAnon
- DimiDimit

No AI used 💜
