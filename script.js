'use strict';

(async () => {
	const fileBlob = await new Promise(resolve => {
		const input = document.querySelector('#file-input');
		input.addEventListener('input', e => {
			resolve(input.files[0]);
		});
	});

	const file = new DataView(await new Promise(resolve => {
		const reader = new FileReader();
		reader.addEventListener('load', () => {
			resolve(reader.result);
		});
		reader.readAsArrayBuffer(fileBlob);
	}));

	document.querySelector('#file-input').remove();

	const settings = JSON.parse(localStorage.getItem('settings') || '{}');

	const uniqueId = (() => {
		let counter = 0;
		return () => `uniqueid-${counter++}`;
	})();

	//////////////////// Section creation //////////////////////////////////////////////////////////////////////

	const sections = [];
	const createSection = title => {
		const section = document.createElement('section');
		const reveal = document.createElement('div');
		reveal.className = 'reveal';
		reveal.innerHTML = `<span style="font-family: 'Red Hat Mono'">[-]</span> ${title}`;
		section.appendChild(reveal);

		const content = document.createElement('div');
		content.className = 'content';
		section.appendChild(content);

		let visible = true;
		const toggleVisible = newVisible => {
			if (newVisible === visible) return;
			visible = newVisible;
			settings[`section.${title}.visible`] = visible;
			localStorage.setItem('settings', JSON.stringify(settings));

			content.style.display = visible ? '' : 'none';
			reveal.innerHTML = `<span style="font-family: 'Red Hat Mono'">${visible ? '[-]' : '[+]'}</span> ${title}`;

			section.style.height = visible ? '' : '32px';
		};
		reveal.addEventListener('mousedown', e => {
			if (e.button === 0) toggleVisible(!visible);
		});

		sections.push({ section, content });
		document.body.appendChild(section);

		toggleVisible(settings[`section.${title}.visible`] ?? true);
		return content;
	};

	const createSectionWrapped = async (name, cb) => {
		const section = createSection(name);
		try {
			return await cb(section);
		} catch (err) {
			console.error(err);
			section.innerHTML = `<span style="color: #f99;">${sanitize(err.name)}: ${sanitize(err.message)}<br>
				${sanitize(err.stack).replace('\n', '<br>')}</span>`;
		}
	};

	//////////////////// Quick data display functions ////////////////////////////////////////////////////////////

	const readString = (o, l, buf = file) => {
		let end;
		if (l) {
			end = o + l;
		} else {
			end = o;
			while (file.getUint8(end++) !== 0);
		}

		const str = [];
		for (let i = 0; i < end - o; i += 16384) {
			str.push(String.fromCharCode(...new Uint8Array(buf.buffer.slice(o + i, Math.min(end, o + i + 16384))).map(x => x < 0x20 ? 46 : x)));
		}

		return str.join('');
	};

	const bytes = (o, l, buf = file) => {
		return Array.from(new Uint8Array(buf.buffer.slice(o, o + l))).map(x => x.toString(16).padStart(2, '0')).join(' ');
	};

	const bits = (o, l) => {
		return Array.from(new Uint8Array(file.buffer.slice(o, o + l))).map(x => x.toString(2).padStart(8, '0')).join(' ');
	};

	const sanitize = s => s.replaceAll('<', '&lt;').replaceAll('>', '&gt;');

	const addHTML = (el, html) => {
		const container = document.createElement('div');
		container.innerHTML = html;
		for (const child of container.childNodes) el.appendChild(child);
	};

	const str8 = x => x.toString(16).padStart(2, '0');
	const str16 = x => x.toString(16).padStart(4, '0');
	const str32 = x => x.toString(16).padStart(8, '0');

	Object.assign(window, { file, readString, bytes });

	//////////////////// Decompression //////////////////////////////////////////////////////////////////////

	const lzssBackwards = (end, indat, inputLen) => {
		const composite = indat.getUint32(end - 8, true);
		const offset = composite >> 24;
		const length1 = composite & 0xffffff; // the length of the input file
		const length2 = indat.getUint32(end - 4, true); // the extra length from decompression
	
		if ((inputLen && inputLen !== length1) || length1 >= end || offset < 8) {
			console.log(`offset: ${offset}, length1: ${length1}, length2: ${length2}`);
			return;
		}

		const outbuf = new Uint8Array(length1 + length2);
		let inoff = end - offset;
		let outoff = length1 + length2;
		while (outoff > 0) {
			const flags = indat.getUint8(--inoff);
			for (let bit = 0x80; bit > 0 && outoff > 0; bit >>= 1) {
				if (flags & bit) { // back-reference
					const composite = indat.getUint16(inoff -= 2, true);
					const offset = (composite & 0xfff) + 2;
					const length = (composite >> 12) + 3;
					for (let i = 0; i < length && outoff > 0; ++i) {
						if (outoff + offset < length1 + length2) {
							outbuf[outoff - 1] = outbuf[outoff + offset];
							--outoff;
						} else {
							outbuf[--outoff] = 0;
						}
					}
				} else { // literal
					outbuf[--outoff] = indat.getUint8(--inoff);
				}
			}
		}

		return outbuf;
	};

	const lz77ish = (inoff, indat) => {
		const readFunnyU24 = () => {
			const composite = indat.getUint8(inoff++);
			const blen = composite >> 6;
			let out = composite & 0x3f;

			for (let i = 0, shift = 6; i < blen; ++i, shift += 6) out |= indat.getUint8(inoff++) << shift;
			return out;
		};

		const outsize = readFunnyU24();
		const blocks = readFunnyU24() + 1;

		const outbuf = new Uint8Array(outsize);
		let outoff = 0;
		for (let i = 0; i < blocks; ++i) {
			const blockLength = indat.getUint16(inoff, true);
			inoff += 2;
			block: for (let target = inoff + blockLength; inoff < target;) {
				let byte = file.getUint8(inoff++);
				for (let j = 0; j < 4; ++j, byte >>= 2) {
					switch (byte & 3) {
					case 0:
						break block;
					case 1:
						outbuf[outoff++] = indat.getUint8(inoff++);
						break;
					case 2: {
						const composite1 = indat.getUint8(inoff++);
						const composite2 = indat.getUint8(inoff++);
						const offset = composite1 | ((composite2 & 0xf0) << 4);
						const length = (composite2 & 0xf) + 2;
						for (let k = 0; k < length; ++k) {
							outbuf[outoff] = outbuf[outoff - offset];
							++outoff;
						}
						break;
					}
					case 3: {
						const length = indat.getUint8(inoff++) + 2;
						const byte = indat.getUint8(inoff++);
						for (let k = 0; k < length; ++k) outbuf[outoff++] = byte;
					}
					}
				}
			}
		}

		return outbuf;
	};

	//////////////////// Sections ////////////////////////////////////////////////////////////////////////////////

	// #1 : read off basic rom headers
	const headers = window.headers = await createSectionWrapped('ROM Headers', async section => {
		const fields = [];
		const headers = {};

		headers.title = sanitize(readString(0, 12));
		headers.gamecode = sanitize(readString(12, 4));
		fields.push(['Title', `${headers.title} (${headers.gamecode})`]);
		document.title = `(${headers.gamecode}) MLBIS Dumper`;

		headers.fntOffset = file.getUint32(0x40, true);
		headers.fntLength = file.getUint32(0x44, true);
		fields.push(['FNT', `0x${str32(headers.fntOffset)}, len 0x${headers.fntLength.toString(16)}`]);

		headers.fatOffset = file.getUint32(0x48, true);
		headers.fatLength = file.getUint32(0x4c, true);
		fields.push(['FAT', `0x${str32(headers.fatOffset)}, len 0x${headers.fatLength.toString(16)}`]);

		headers.arm9offset = file.getUint32(0x20, true);
		headers.arm9entry = file.getUint32(0x24, true);
		headers.arm9ram = file.getUint32(0x28, true);
		headers.arm9size = file.getUint32(0x2c, true);
		fields.push(['ARM9', `0x${str32(headers.arm9offset)}, len 0x${headers.arm9size.toString(16)}`]);

		headers.arm7offset = file.getUint32(0x30, true);
		headers.arm7entry = file.getUint32(0x34, true);
		headers.arm7ram = file.getUint32(0x38, true);
		headers.arm7size = file.getUint32(0x3c, true);
		fields.push(['ARM7', `0x${str32(headers.arm7offset)}, len 0x${headers.arm7size.toString(16)}`]);

		for (const [name, value] of fields) {
			addHTML(section, `<div style="font-family: 'Red Hat Mono';">${name}: ${value}</div>`);
		}

		return headers;
	});

	// #2 : parse file structure
	const fs = window.fs = await createSectionWrapped('File System', async section => {
		const parseSubtable = (o, fileId) => {
			const entries = [];
			while (true) {
				const composite = file.getUint8(headers.fntOffset + o);
				const directory = !!(composite & 0x80);
				const length = composite & 0x7f;
				if (length === 0) return entries;
				++o;

				const name = readString(headers.fntOffset + o, length);
				o += length;

				let subdirectoryId;
				if (directory) {
					subdirectoryId = file.getUint16(headers.fntOffset + o, true);
					o += 2;
				}

				entries.push({ name, directory, id: directory ? subdirectoryId : fileId++ });
			}
		};

		const subtables = new Map();
		// root subtable is stored slightly differently
		subtables.set(0xf000, parseSubtable(file.getUint32(headers.fntOffset, true), file.getUint16(headers.fntOffset + 4, true)));
		const numDirectories = file.getUint16(headers.fntOffset + 6, true);
		for (let i = 1; i < numDirectories; ++i) {
			const start = file.getUint32(headers.fntOffset + i*8, true);
			const startingFileId = file.getUint16(headers.fntOffset + i*8 + 4, true);
			subtables.set(0xf000 + i, parseSubtable(start, startingFileId));
		}

		const fs = new Map();
		for (let i = 0; i < headers.fatLength / 8; ++i) {
			const start = file.getUint32(headers.fatOffset + i*8, true);
			const end = file.getUint32(headers.fatOffset + i*8 + 4, true);
			fs.set(i, { path: '<overlay?>', name: `overlay${str8(i)}.bin`, start, end });
		}

		const recurseDirectory = (subtable, prefix) => {
			for (const entry of subtable) {
				if (entry.directory) {
					recurseDirectory(subtables.get(entry.id), `${prefix}${entry.name}/`);
				} else {
					const start = file.getUint32(headers.fatOffset + entry.id*8, true);
					const end = file.getUint32(headers.fatOffset + entry.id*8 + 4, true);
					const fsentry = fs.get(entry.id);
					fsentry.path = prefix + entry.name;
					fsentry.name = entry.name;
					fs.set(prefix + entry.name, fsentry);
				}
			}
		};
		recurseDirectory(subtables.get(0xf000), '/');

		for (let i = 0; i < headers.fatLength / 8; ++i) {
			const fsentry = fs.get(i);
			addHTML(section, `<div><code>${str8(i)}. 0x${str32(fsentry.start)} - 0x${str32(fsentry.end)}
				(len 0x${(fsentry.end - fsentry.start).toString(16)})</code> ${sanitize(fsentry.path)}</div>`);
		}

		const fileSelect = document.createElement('select');
		for (let i = 0; i < headers.fatLength / 8; ++i) {
			const fsentry = fs.get(i);
			addHTML(fileSelect, `<option value="${i}">${str8(i)}. (len 0x${(fsentry.end - fsentry.start).toString(16)}) ${sanitize(fsentry.path)}</option>`);
		}
		section.appendChild(fileSelect);

		const decompression = document.createElement('select');
		addHTML(decompression, '<option value="none">No decompression</option>');
		addHTML(decompression, '<option value="lzssBackwards">Backwards LZSS</option>');
		section.appendChild(decompression);

		const download = document.createElement('button');
		download.textContent = 'Dump';
		section.appendChild(download);

		const downloadOutput = document.createElement('div');
		section.appendChild(downloadOutput);

		download.addEventListener('click', () => {
			const fsentry = fs.get(parseInt(fileSelect.value));
			const decompressionType = decompression.value;

			let output;
			if (decompressionType === 'none') output = file.buffer.slice(fsentry.start, fsentry.end);
			else if (decompressionType === 'lzssBackwards') output = lzssBackwards(fsentry.end, file, fsentry.end - fsentry.start);

			if (!output) {
				downloadOutput.textContent = 'Failed to load/decompress';
				return;
			}

			downloadOutput.textContent = '';

			const blob = new Blob([output], { type: 'application/octet-stream' });
			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = fsentry.name;
			document.body.appendChild(link);
			link.click();
			link.remove();
			setTimeout(() => URL.revokeObjectURL(link.href), 1000); // idk if a timeout is really necessary
		});

		return fs;
	});

	// #3 : dump font data
	const font = window.font = await createSectionWrapped('Font Data', async section => {
		const fontFile = fs.get('/Font/StatFontSet.dat');

		const locations = [];
		for (let i = 0; i < 12; ++i) locations.push(file.getUint32(fontFile.start + i*4, true));
		addHTML(section, `<li>Locations: ${locations.map(x => `0x${x.toString(16)}`).join(' ')}`);

		const select = document.createElement('select');
		const locationsSet = new Set(locations);
		for (const loc of locationsSet) {
			const option = document.createElement('option');
			option.textContent = `0x${loc.toString(16)}`;
			option.value = loc;
			select.appendChild(option);
		}
		section.appendChild(select);

		const preview = document.createElement('div');
		const render = () => {
			preview.innerHTML = '';

			const o = parseInt(select.value);
			const firstLength = file.getUint32(fontFile.start + o, true);
			const secondLength = file.getUint32(fontFile.start + o + 4, true);
			const headerLength = file.getUint32(fontFile.start + o + 8, true); // usually 12, but can be more
			const numChars = file.getUint8(fontFile.start + o + headerLength + 3);
			addHTML(preview, `<li>Lengths: 0x${firstLength.toString(16)} 0x${secondLength.toString(16)}`);
			addHTML(preview, `<li>Header: <code>${bytes(fontFile.start + o, headerLength || 20)}</code>`);
			addHTML(preview, `<li>Magic: <code>${bytes(fontFile.start + o + headerLength, 3)}</code>`);
			addHTML(preview, `<li># of chars: ${numChars}`);

			if (numChars === 0) return;

			const charWidths = [];
			for (let i = 0; i < numChars; ++i) {
				const width = file.getUint32(fontFile.start + o + headerLength + 4 + i*4, true);
				charWidths.push(width.toString(16).padStart(8, '0'));
			}
			addHTML(preview, `<ul><li><code>${charWidths.join(' - ')}</code></ul>`);

			const colors = [];
			for (let i = 0; i < numChars * 4;) {
				const ab = file.getUint16(fontFile.start + o + headerLength + 4 + i, true);
				i += 2;

				const color = '#' + [(ab & 0x1f) << 3, ((ab >> 5) & 0x1f) << 3, ((ab >> 10) & 0x1f) << 3, 255].map(x => x.toString(16).padStart(2, '0')).join('');
				const str = ab.toString(16).padStart(4, '0');
				colors.push(`<span style="color: ${color}">${str}</span>`);
			}
			addHTML(preview, `<ul><li><code>${colors.join(' ')}</code></ul>`);

			const startOfRest = headerLength + 4 + 4*numChars;
			addHTML(preview, `<li>Rest of first part: <br><code>${bytes(fontFile.start + o + startOfRest, firstLength - startOfRest)}</code>`);
			addHTML(preview, `<li>Second part: <br><code>${bytes(fontFile.start + o + firstLength, secondLength)}</code>`);
		};
		render();
		select.addEventListener('change', render);
		section.appendChild(preview);
	});

	// #4 : field maps
	const field = window.field = await createSectionWrapped('Field Maps', async section => {
		const field = {};

		const fieldFile = fs.get('/FMap/FMapData.dat');
		const layoutFile = fs.get(3);

		const layoutPreview = document.createElement('div');
		section.appendChild(layoutPreview);

		// JP and DEMO versions don't need decompression, but other versions do
		const layoutData = new DataView(lzssBackwards(layoutFile.end, file, layoutFile.end - layoutFile.start)?.buffer || file.buffer.slice(layoutFile.start, layoutFile.end));

		console.log(layoutData);
		// i'm not sure how this file structure works, but this should cover all versions of MLBIS
		// you can find these offsets yourself by going through unnamed file 0x03, which has lists of increasing
		// pointers into each file. these pointers stop right before the end of the file length, so it's easy to tell
		// which pointer list belongs to which file
		// (for example, in US /FMap/FMapData.dat has length 0x1a84600 and the last pointer is 0x1a84530)
		let feventOffsets, fmapdataOffsets, fobjOffsets, fobjmapOffsets, fobjmonOffsets, fobjpcOffsets, fpafOffsets;
		let roomIndices, unknownIndices;
		const indices = at => {
			const chunkLength = layoutData.getUint32(at, true);
			const indices = [];
			for (let o = 4; o < chunkLength; o += 4) indices.push(layoutData.getUint32(at + o, true));
			return indices;
		};
		const fixedIndices = (at, until) => {
			const indices = [];
			for (let i = 0, o = at + 4; o < until; ++i, o += 4) indices.push(layoutData.getInt32(o, true));
			return indices;
		};

		if (headers.gamecode === 'CLJE') { // US/AU
			feventOffsets = indices(0xc8ac);
			fmapdataOffsets = indices(0x11310);
			fobjOffsets = indices(0xe8a0);
			fobjmonOffsets = indices(0xba3c);
			fobjpcOffsets = indices(0xbdb0);
			fpafOffsets = indices(0xb8a0);
			roomIndices = fixedIndices(0x19fd0, 0x1d504);
			unknownIndices = fixedIndices(0x18e84, 0x19fd0);
		} else if (headers.gamecode === 'CLJK') { // KO
			fmapdataOffsets = indices(0x11310);
			roomIndices = fixedIndices(0x19fd0, 0x1d504);
			unknownIndices = fixedIndices(0x18e84, 0x19fd0);
		} else if (headers.gamecode === 'CLJJ') { // JP
			fmapdataOffsets = indices(0x11544);
			roomIndices = fixedIndices(0x1a85c, 0x1dd90);
			unknownIndices = fixedIndices(0x19710, 0x1a85c);
		} else if (headers.gamecode === 'CLJP') { // EU
			fmapdataOffsets = indices(0x11310);
			roomIndices = fixedIndices(0x19fd0, 0x1d504);
			unknownIndices = fixedIndices(0x18e84, 0x19fd0);
		} else if (headers.gamecode === 'Y6PP') { // Demo
			fmapdataOffsets = indices(0x9a3c);
			fobjOffsets = indices(0x9cb0);
			roomIndices = fixedIndices(0xe498, 0xe72c);
			unknownIndices = fixedIndices(0xe220, 0xe318);
		} else {
			throw new Error(`unknown gamecode ${headers.gamecode}`);
		}

		for (let i = 0, j = 0; i < roomIndices.length; i += 5, ++j) {
			roomIndices[j] = { l1: roomIndices[i], l2: roomIndices[i + 1], l3: roomIndices[i + 2], props: roomIndices[i + 3], unknown: roomIndices[i + 4] };
		}

		roomIndices = roomIndices.slice(0, roomIndices.length / 5);

		Object.assign(field, { feventOffsets, fmapdataOffsets, fobjOffsets, fobjmonOffsets, fobjpcOffsets, fpafOffsets });

		// room tile + properties indices is stored at the end of layoutData
		let o = layoutData.byteLength - 5;
		while (true) {
			if (readString(o, 5, layoutData) === 'Z-Tbl') break;
			--o;
		}

		field.roomOffsets = []; // read in reverse order, corrected later
		let lastHadZero = false;
		let maxIndex = -1;
		let numRooms = 0;
		while (o > 0) {
			o -= 0x14;
			const l1 = layoutData.getInt32(o, true);
			const l2 = layoutData.getInt32(o + 4, true);
			const l3 = layoutData.getInt32(o + 8, true);
			const props = layoutData.getInt32(o + 12, true);
			const unknown = layoutData.getInt32(o + 16, true);

			// keep going down room offsets until we find a layer that references index 0; then, the next pass
			// will probably be of the unknown data (which uses the rest of the indices)
			if (lastHadZero && Math.min(l1, l2, l3, props, unknown) > maxIndex) break; // passed room offsets
			lastHadZero = l1 === 0 || l2 === 0 || l3 === 0;
			maxIndex = Math.max(maxIndex, l1, l2, l3, props, unknown);
			field.roomOffsets.push({ l1, l2, l3, props, unknown });
			++numRooms;
		}
		field.roomOffsets.reverse();

		let updatePalettes = true;
		let updateTiles = true;
		let updateMaps = true;
		let updateOverlay = true;
		let updateOverlayTriangles = true;

		const options = document.createElement('div');

		const roomPicker = document.createElement('select');
		for (let i = 0; i < numRooms; ++i) {
			addHTML(roomPicker, `<option value="${i}">Room 0x${i.toString(16)}</option>`);
		}
		options.appendChild(roomPicker);

		const optionCheckbox = (label, checked, onchange) => {
			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.id = uniqueId();
			checkbox.checked = checked;

			checkbox.addEventListener('change', onchange);

			options.appendChild(checkbox);
			addHTML(options, `<label for="${checkbox.id}">${label}</label>`);
			return checkbox;
		};

		const layerCheckboxes = ['BG1', 'BG2', 'BG3'].map(name => optionCheckbox(name, true, () => { updateMaps = true; }));
		const showPalettes = optionCheckbox('Palettes', true, () => {});
		const showTiles = optionCheckbox('Tiles', true, () => {});
		const showExtensions = optionCheckbox('Room Extensions', true, () => { updateMaps = true; });
		const showCollision = optionCheckbox('Collision', true, () => { updateOverlayTriangles = true; });
		const showLoadingZones = optionCheckbox('Loading Zones', true, () => { updateOverlayTriangles = true; });
		const showMystery = optionCheckbox('Mystery', true, () => { updateMaps = true; });

		section.appendChild(options);
		const mapContainer = document.createElement('div');
		mapContainer.style.cssText = 'max-width: 70vw; max-height: 80vh; overflow: auto; position: relative;';
		section.appendChild(mapContainer);

		const mapCanvas = document.createElement('canvas');
		mapContainer.appendChild(mapCanvas);

		const map3dCanvas = document.createElement('canvas');
		map3dCanvas.style.cssText = 'position: absolute; top: 0; left: 0;';
		mapContainer.appendChild(map3dCanvas);

		const map3d = (() => { // setup basic 3d renderer
			const gl = map3dCanvas.getContext('webgl2', { alpha: true, depth: true, preserveDrawingBuffer: true });

			const vs = gl.createShader(gl.VERTEX_SHADER);
			gl.shaderSource(vs, `
				#version 300 es
				precision highp float;
				layout(location = 0) in vec3 a_pos;
				layout(location = 1) in vec4 a_color;
				out vec4 v_color;

				uniform mat3 rotation1;
				uniform mat3 rotation2;
				uniform vec2 size;
				uniform vec3 translation;

				void main() {
					v_color = a_color;
					vec3 pos = rotation2 * rotation1 * (a_pos - vec3(size / 2.0, 0)) + vec3(size / 2.0, 0) + translation;
					pos = vec3(pos.xy / size * 2.0 - 1.0, pos.z);
					gl_Position = vec4(pos.x, -pos.y, 1.0 / (pos.z + 1000.0), 1);
				}
			`.trim());
			gl.compileShader(vs);
			if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) throw `map3d vertex compilation fail:\n${gl.getShaderInfoLog(vs)}`;

			const fs = gl.createShader(gl.FRAGMENT_SHADER);
			gl.shaderSource(fs, `
				#version 300 es
				precision highp float;
				in vec4 v_color;
				out vec4 out_color;

				void main() {
					out_color = v_color;
				}
			`.trim());
			gl.compileShader(fs);
			if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) throw `map3d fragment compilation fail:\n${gl.getShaderInfoLog(fs)}`;

			const program = gl.createProgram();
			gl.attachShader(program, vs);
			gl.attachShader(program, fs);
			gl.linkProgram(program);
			if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw `map3d program link fail:\n${gl.getProgramInfoLog(program)}`;

			gl.useProgram(program);

			const vao = gl.createVertexArray();
			gl.bindVertexArray(vao);

			const buffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.enableVertexAttribArray(0);
			gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 4 * 7, 0);
			gl.enableVertexAttribArray(1);
			gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 4 * 7, 4 * 3);

			const floats = new Float32Array(7 * 1000);
			const rotation1 = gl.getUniformLocation(program, 'rotation1');
			const rotation2 = gl.getUniformLocation(program, 'rotation2');
			const size = gl.getUniformLocation(program, 'size');
			const translation = gl.getUniformLocation(program, 'translation');

			let lastClientX;
			let lastClientY;
			let rotX = 0;
			let rotY = Math.PI / 4;
			let dragging = false;
			map3dCanvas.addEventListener('mousedown', () => void (dragging = true));
			addEventListener('mouseup', () => void (dragging = false, lastClientX = lastClientY = undefined));
			addEventListener('blur', () => void (dragging = false, lastClientX = lastClientY = undefined));

			map3dCanvas.addEventListener('mousemove', e => {
				if (!dragging) return;
				if (lastClientX !== undefined && lastClientY !== undefined) {
					rotX = (rotX - (e.clientX - lastClientX) * 0.01) % (2 * Math.PI);
					rotY = Math.min(Math.max(rotY - (e.clientY - lastClientY) * 0.01, 0), Math.PI / 2);
					updateOverlay = true;
				}
				lastClientX = e.clientX;
				lastClientY = e.clientY;
			});

			return { buffer, floats, rotation1, rotation2, rotX: () => rotX, rotY: () => rotY, size, translation, vertices: 0 };
		})();

		const sideProperties = document.createElement('div');
		sideProperties.style.cssText = 'width: calc(30vw - 104px); max-height: 80vh; position: absolute; top: calc(3.5em + 20px); right: 32px;';
		section.appendChild(sideProperties);

		const componentContainer = document.createElement('div');
		componentContainer.style.cssText = 'position: relative; height: 256px;';

		const paletteCanvases = [];
		const paletteStyles = ['top: 0px; left: 0px;', 'top: 0px; left: 128px;', 'top: 128px; left: 0px;'];
		for (let i = 0; i < 3; ++i) {
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = 16;
			canvas.style.cssText = `position: absolute; ${paletteStyles[i]} width: 128px; height: 128px;`;
			componentContainer.appendChild(canvas);
			paletteCanvases.push(canvas);
		}

		const tileCanvases = [];
		const tileStyles = ['top: 0px; left: 256px;', 'top: 0px; left: 512px;', 'top: 0px; left: 768px;'];
		for (let i = 0; i < 3; ++i) {
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = 256;
			canvas.style.cssText = `position: absolute; ${tileStyles[i]} width: 256px; height: 256px;`;
			componentContainer.appendChild(canvas);
			tileCanvases.push(canvas);
		}

		section.appendChild(componentContainer);

		showPalettes.addEventListener('change', () => {
			if (showPalettes.checked) {
				paletteCanvases[0].style.display = paletteCanvases[1].style.display = paletteCanvases[2].style.display = '';
				tileCanvases[0].style.left = '256px';
				tileCanvases[1].style.left = '512px';
				tileCanvases[2].style.left = '768px';
				componentContainer.style.height = showTiles.checked ? '256px' : '128px';
			} else {
				paletteCanvases[0].style.display = paletteCanvases[1].style.display = paletteCanvases[2].style.display = 'none';
				tileCanvases[0].style.left = '0px';
				tileCanvases[1].style.left = '256px';
				tileCanvases[2].style.left = '512px';
				componentContainer.style.height = showTiles.checked ? '256px' : '0px';
			}
		});

		showTiles.addEventListener('change', () => {
			if (showTiles.checked) {
				tileCanvases[0].style.display = tileCanvases[1].style.display = tileCanvases[2].style.display = '';
				paletteCanvases[2].style.left = '0px';
				paletteCanvases[2].style.top = '128px';
				componentContainer.style.height = '256px';
			} else {
				tileCanvases[0].style.display = tileCanvases[1].style.display = tileCanvases[2].style.display = 'none';
				paletteCanvases[2].style.left = '256px';
				paletteCanvases[2].style.top = '0px';
				componentContainer.style.height = showPalettes.checked ? '128px' : '0px';
			}
		});

		const bottomProperties = document.createElement('div');
		section.appendChild(bottomProperties);

		// bitmap generation
		const setPixel = (bitmap, pixel, rgb16) => {
			bitmap[pixel*4] = (rgb16 & 0x1f) << 3;
			bitmap[pixel*4 + 1] = (rgb16 >> 5 & 0x1f) << 3;
			bitmap[pixel*4 + 2] = (rgb16 >> 10 & 0x1f) << 3;
			bitmap[pixel*4 + 3] = 255;
		};

		field.genPalette = (props, layerId) => {
			const bitmap = new Uint8ClampedArray(256 * 4);
			const paletteOffset = props.getUint32(0x0c + layerId*4, true);
			for (let i = 0; i < 256; ++i) {
				const rgb16 = props.getUint16(paletteOffset + i*2, true);
				setPixel(bitmap, i, props.getUint16(paletteOffset + i*2, true));
			}

			return new ImageData(bitmap, 16);
		};

		field.genTiles = (props, layer, layerId, paletteShift) => {
			const paletteOffset = props.getUint32(0x0c + layerId*4, true);

			const mapPropertiesOffset = props.getUint32(0x18, true);
			const mapFlags = props.getUint8(mapPropertiesOffset + 5);

			let o = 0;
			const bitmap = new Uint8ClampedArray(256 * 256 * 4);
			if (mapFlags & (1 << layerId)) { // 256 color
				for (let i = 0; o < layer.byteLength; ++i) {
					const basePos = (i >> 5) << 11 | (i & 0x1f) << 3; // y = i >> 5, x = i & 0x1f
					for (let j = 0; j < 64 && o < layer.byteLength; ++j) { // 8x8
						const pos = basePos | (j >> 3) << 8 | (j & 0x7);
						const paletteIndex = layer.getUint8(o++);
						const rgb16 = props.getUint16(paletteOffset + paletteIndex*2, true);
						setPixel(bitmap, pos, rgb16);
					}
				}
			} else { // 16 color
				for (let i = 0; o < layer.byteLength; ++i) {
					const basePos = (i >> 5) << 11 | (i & 0x1f) << 3; // y = i >> 5, x = i & 0x1f
					for (let j = 0; j < 64 && o < layer.byteLength; j += 2) { // 8x8 still
						const pos = basePos | (j >> 3) << 8 | (j & 0x7);
						const composite = layer.getUint8(o++);
						const rgb16Left = props.getUint16(paletteOffset + (paletteShift << 4 | (composite & 0xf))*2, true);
						const rgb16Right = props.getUint16(paletteOffset + (paletteShift << 4 | composite >> 4)*2, true);
						setPixel(bitmap, pos, rgb16Left);
						setPixel(bitmap, pos | 1, rgb16Right);
					}
				}
			}

			return new ImageData(bitmap, 256);
		};

		field.genMap = (props, layers) => {
			const mapPropertiesOffset = props.getUint32(0x18, true);
			const mapWidth = props.getUint16(mapPropertiesOffset, true);
			const mapHeight = props.getUint16(mapPropertiesOffset + 2, true);
			const mapFlags = props.getUint8(mapPropertiesOffset + 5);

			const bitmaps = [];
			for (let i = 2; i >= 0; --i) {
				if (!layers[i]) {
					bitmaps[i] = undefined;
					continue;
				}

				bitmaps[i] = new Uint8ClampedArray(mapWidth * mapHeight * 64 * 4);
				let o = props.getUint32(i * 4, true);
				const paletteOffset = props.getUint32(0xc + i*4, true);
				for (let j = 0; j < mapHeight * mapWidth; ++j) {
					const x = j % mapWidth;
					const y = (j / mapWidth) | 0;
					const tile = props.getUint16(o, true);
					o += 2;
					if (mapFlags & (1 << i)) { // 256 color
						for (let k = 0; k < 64; ++k) {
							const xx = (tile & 0x400) ? 7 - (k & 7) : k & 7;
							const yy = (tile & 0x800) ? 7 - (k >> 3) : k >> 3;
							const loc = (tile & 0x3ff) << 6 | k;
							if (loc >= layers[i].byteLength) continue;
							const paletteIndex = layers[i].getUint8(loc);
							if (!paletteIndex) continue;
							const rgb16 = props.getUint16(paletteOffset + paletteIndex*2, true);
							setPixel(bitmaps[i], (y*8 + yy)*mapWidth*8 + x*8 + xx, rgb16);
						}
					} else { // 16 color
						for (let k = 0; k < 64; k += 2) {
							const xx = (tile & 0x400) ? 7 - (k & 7) : k & 7;
							const yy = (tile & 0x800) ? 7 - (k >> 3) : k >> 3;
							const loc = ((tile & 0x3ff) << 6 | k) >> 1;
							if (loc >= layers[i].byteLength) continue;
							const paletteComposite = layers[i].getUint8(loc);
							const paletteRow = tile >> 12;
							if (paletteComposite & 0xf) {
								const rgb16 = props.getUint16(paletteOffset + (paletteRow << 4 | (paletteComposite & 0xf))*2, true);
								setPixel(bitmaps[i], (y*8 + yy)*mapWidth*8 + x*8 + xx, rgb16);
							}
							if (paletteComposite >> 4) {
								const rgb16 = props.getUint16(paletteOffset + (paletteRow << 4 | paletteComposite >> 4)*2, true);
								setPixel(bitmaps[i], (y*8 + yy)*mapWidth*8 + x*8 + xx + ((tile & 0x400) ? -1 : 1), rgb16);
							}
						}
					}
				}
			}

			return bitmaps.map(x => x && new ImageData(x, mapWidth * 8, mapHeight * 8));
		};

		let collisionSelect, loadingZonesSelect, layers, props, room, unknown;
		const update = () => {
			room = field.roomOffsets[parseInt(roomPicker.value)];

			const layer = index => lz77ish(fieldFile.start + fmapdataOffsets[index], file);
			layers = [room.l1, room.l2, room.l3].map(l => l !== -1 && new DataView(layer(l).buffer));
			props = new DataView(layer(room.props).buffer);

			bottomProperties.innerHTML = sideProperties.innerHTML = '';

			addHTML(bottomProperties, `<div>Layer offsets: <code>BG1 ${room.l1}; BG2 ${room.l2}; BG3 ${room.l3};
				Props ${room.props}; Unknown ${room.unknown}</code></div>`);

			const tileLayoutOffsets = [0, 1, 2].map(x => props.getInt32(x * 4, true));
			const paletteOffsets = [0, 1, 2].map(x => props.getInt32(0x0c + x*4, true));
			console.log(tileLayoutOffsets, paletteOffsets);
			const mapPropertiesOffset = props.getUint32(0x18, true);
			const afterOffsets = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(x => props.getUint32(0x1c + x*4, true));

			const mapWidth = props.getUint16(mapPropertiesOffset, true);
			const mapHeight = props.getUint16(mapPropertiesOffset + 2, true);
			const mapFlags = props.getUint16(mapPropertiesOffset + 4, true);
			addHTML(sideProperties, `<div>Properties: <code>${mapWidth}x${mapHeight},
				(${mapWidth * 8}x${mapHeight * 8}), ${(mapFlags & 0x1000) ? 'field' : 'map'}
			</code></div>`);

			{
				const loadingZonesOffset = props.getUint32(0x1c, true);
				const endLoadingZones = props.getUint32(0x20, true);

				loadingZonesSelect = document.createElement('select');
				loadingZonesSelect.style.display = 'block';
				addHTML(loadingZonesSelect, `<option value="">${(endLoadingZones - loadingZonesOffset) / 24} loading zones</option><hr>`);
				sideProperties.appendChild(loadingZonesSelect);

				const loadingZoneData = document.createElement('div');
				sideProperties.appendChild(loadingZoneData);

				loadingZonesSelect.addEventListener('change', () => {
					updateOverlayTriangles = true;

					if (loadingZonesSelect.value === '') {
						loadingZoneData.innerHTML = '';
						return;
					}

					const o = loadingZonesOffset + parseInt(loadingZonesSelect.value) * 24;
					loadingZoneData.innerHTML = `<ul>
						<li>Flags: <code>${props.getUint8(o).toString(2).padStart(8, '0')} ${props.getUint8(o + 1).toString(2).padStart(8, '0')}</code></li>
						<li>Other data: <code>${bytes(o + 16, 8, props)}</code></li>
					</ul>`;
				});

				for (let i = 0, o = loadingZonesOffset; o < endLoadingZones; ++i, o += 24) {
					const flags = props.getUint16(o, true);
					const room = props.getUint16(o + 2, true);
					const direction = ('↑→↓←')[flags >> 2 & 3];
					addHTML(loadingZonesSelect, `<option value="${i}">[${i}] ${direction} ${room.toString(16)}`);
				}
			}

			{
				const collisionOffset = props.getUint32(0x38, true);
				const endCollision = props.getUint32(0x3c, true);
				const numBoxes = collisionOffset !== endCollision ? props.getUint32(collisionOffset, true) : 0;
				const numOtherBoxes = collisionOffset !== endCollision ? props.getUint32(collisionOffset + 4, true) : 0;

				const container = document.createElement('div');

				const left = document.createElement('button');
				left.textContent = '←';
				container.appendChild(left);

				collisionSelect = document.createElement('select');
				addHTML(collisionSelect, `<option value="">${numBoxes} prisms, ${numOtherBoxes} specials</option> <hr>`);
				container.appendChild(collisionSelect);

				const right = document.createElement('button');
				right.textContent = '→';
				container.appendChild(right);

				sideProperties.appendChild(container);

				const collisionData = document.createElement('div');
				sideProperties.appendChild(collisionData);

				const changed = () => {
					updateOverlayTriangles = true;

					console.log('changed', collisionSelect.value);

					if (collisionSelect.value === '') {
						collisionData.innerHTML = '';
						return;
					}

					const index = parseInt(collisionSelect.value);
					let o = collisionOffset + 8;
					o += Math.min(index, numBoxes) * 40; // first chunk of prisms
					o += Math.max(index - numBoxes, 0) * 24; // second chunk of... things

					if (index < numBoxes) { // prism
						const passFlags = props.getUint16(o + 4, true);
						const passFlags2 = props.getUint16(o + 6, true);
						const solidForDrill = passFlags & 2;
						const solidForMiniMario = passFlags & 4;

						const unisolid = passFlags2 & 0x40;

						collisionData.innerHTML = `<ul>
							<li>Flags: <code>${[0,1,2,3,4,5,6,7].map(i => props.getUint8(o + i).toString(2).padStart(8, '0')).join(' ')}</code></li>
							<li style="color: ${solidForDrill ? '#f99' : '#9f9'};">Drill ${solidForDrill ? 'can\'t' : 'can'} pass</li>
							<li style="color: ${solidForMiniMario ? '#f99' : '#9f9'};">Mini ${solidForMiniMario ? 'can\'t' : 'can'} pass</li>
							<li style="color: ${unisolid ? '#9f9' : '#f99'};">${unisolid ? 'Unisolid' : 'Not unisolid'}</li>
						</ul>`;
					} else { // special
						collisionData.innerHTML = bytes(o, 24, props);
					}
				};

				left.addEventListener('mousedown', () => {
					if (collisionSelect.selectedIndex <= 0) return;
					--collisionSelect.selectedIndex;
					updateOverlayTriangles = true;
					changed();
				});
				right.addEventListener('mousedown', () => {
					if (collisionSelect.selectedIndex >= collisionSelect.children.length - 3) return;
					++collisionSelect.selectedIndex;
					updateOverlayTriangles = true;
					changed();
				});
				collisionSelect.addEventListener('input', changed);

				let o = collisionOffset + 8;
				for (let i = 0; i < numBoxes; ++i, o += 40) {
					addHTML(collisionSelect, `<option value="${i}">[${i}] Prism</option>`);
				}

				addHTML(collisionSelect, '<hr>');

				for (let i = 0; i < numOtherBoxes; ++i, o += 24) {
					addHTML(collisionSelect, `<option value="${i + numBoxes}">[${i}] Special</option>`);
				}
			}

			addHTML(bottomProperties, `<div>Map properties: <code>${bytes(mapPropertiesOffset, afterOffsets[0] - mapPropertiesOffset, props)}</code></div>`);
			const names = [
				'Loading zones', // 0
				'?', // 1
				'Animations', // 2
				'?', // 3
				'?', // 4
				'?', // 5
				'?', // 6
				'Collision', // 7
				'?', // 8
				'?', // 9
				'?', // 10
			];
			for (let i = 0; i < 10; ++i) {
				addHTML(bottomProperties, `<div>afterOffsets[${i}] (${names[i]}): <code>${bytes(afterOffsets[i], afterOffsets[i+1] - afterOffsets[i], props)}</code></div>`);
			}
			addHTML(bottomProperties, `<div>afterOffsets[10] (${names[10]}): <code>${bytes(afterOffsets[10], props.byteLength - afterOffsets[10], props)}</code></div>`);
			addHTML(bottomProperties, `<div>Unknown: <code>?</code></div>`);

			updatePalettes = true;
		};

		roomPicker.addEventListener('input', update);
		update();

		// rendering
		const shades = [];
		const genShade = index => shades[index] || (shades[index] = Math.random() * 0.5 + 0.5);

		const render = () => {
			const now = performance.now();
			if (updatePalettes) { // palettes
				console.log('updatePalettes');
				for (let i = 0; i < 3; ++i) {
					const ctx = paletteCanvases[i].getContext('2d');
					if (layers[i]) ctx.putImageData(field.genPalette(props, i), 0, 0);
					else ctx.clearRect(0, 0, 16, 16);
				}
			}

			const mapPropertiesOffset = props.getUint32(0x18, true);
			const mapFlags = props.getUint8(mapPropertiesOffset + 5);
			if (updateTiles || updatePalettes) { // tiles
				console.log('updateTiles');
				for (let i = 0; i < 3; ++i) {
					const ctx = tileCanvases[i].getContext('2d');
					if (layers[i]) ctx.putImageData(field.genTiles(props, layers[i], i, 0), 0, 0);
					else ctx.clearRect(0, 0, 256, 256);
				}
			}

			const mapWidth = props.getUint16(mapPropertiesOffset, true);
			const mapHeight = props.getUint16(mapPropertiesOffset + 2, true);
			if (updateMaps || updateTiles || updatePalettes) {
				console.log('updateMaps');
				const ctx = mapCanvas.getContext('2d');
				const bitmaps = field.genMap(props, layers.map((x, i) => layerCheckboxes[i].checked && x));
				Promise.all(bitmaps.map(x => x && createImageBitmap(x))).then(images => {
					mapCanvas.width = mapWidth * 8 - (showExtensions.checked ? 0 : 32); // setting .width or .height clears the canvas
					mapCanvas.height = mapHeight * 8 - (showExtensions.checked ? 0 : 32);
					const args = showExtensions.checked
						? [0, 0]
						: [16, 16, mapWidth * 8 - 32, mapHeight * 8 - 32, 0, 0, mapWidth * 8 - 32, mapHeight * 8 - 32];
					if (images[2]) ctx.drawImage(images[2], ...args);
					if (images[1]) ctx.drawImage(images[1], ...args);
					if (images[0]) ctx.drawImage(images[0], ...args);

					ctx.save();

					ctx.globalAlpha = 0.5;

					const entityOffset = props.getUint32(0x1c + 8*4, true);
					if (showMystery.checked && entityOffset !== props.getUint32(0x1c + 9*4, true)) {
						const numEntities = props.getUint32(entityOffset, true);
						for (let o = entityOffset + 4, i = 0; i < numEntities; ++i, o += 12) {
							const x1 = props.getInt16(o + 4, true);
							const x2 = props.getInt16(o + 6, true);
							const y1 = props.getInt16(o + 8, true);
							const y2 = props.getInt16(o + 10, true);
							ctx.fillStyle = '#fff';
							ctx.strokeStyle = '#000';
							ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
							ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

							ctx.fillText(str16(props.getUint16(o, true)) + ' ' + str16(props.getUint16(o + 2, true)), x1, y1 + 20);
							ctx.strokeText(str16(props.getUint16(o, true)) + ' ' + str16(props.getUint16(o + 2, true)), x1, y1 + 20);
						}
					}

					ctx.restore();
				});
			}

			if (updateOverlayTriangles || updateOverlay || updateMaps || updateTiles || updatePalettes) {
				const gl = map3dCanvas.getContext('webgl2');
				map3dCanvas.width = mapWidth * 8 - (showExtensions.checked ? 0 : 32); // setting .width or .height clears the canvas
				map3dCanvas.height = mapHeight * 8 - (showExtensions.checked ? 0 : 32);
				gl.viewport(0, 0, map3dCanvas.width, map3dCanvas.height);

				gl.enable(gl.DEPTH_TEST);
				gl.depthFunc(gl.LESS);

				gl.clearColor(0, 0, 0, 0);
				gl.clearDepth(1);
				gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

				if (updateOverlayTriangles || updateMaps || updateTiles || updatePalettes) {
					map3d.vertices = 0;
					const pushVertex = (x, y, z, r, g, b) => {
						if (map3d.vertices * 7 + 6 >= map3d.floats.length) { // resize float array as necessary
							const old = map3d.floats;
							map3d.floats = new Float32Array(old.length * 2);
							for (let i = 0; i < map3d.vertices * 7; ++i) map3d.floats[i] = old[i];
						}

						map3d.floats[map3d.vertices * 7] = x;
						map3d.floats[map3d.vertices * 7 + 1] = y;
						map3d.floats[map3d.vertices * 7 + 2] = z;
						map3d.floats[map3d.vertices * 7 + 3] = r;
						map3d.floats[map3d.vertices * 7 + 4] = g;
						map3d.floats[map3d.vertices * 7 + 5] = b;
						map3d.floats[map3d.vertices * 7 + 6] = 1; // fully opaque
						++map3d.vertices;
					};

					const pushFace = (v1, v2, v3, v4, r, g, b) => {
						pushVertex(...v1, r, g, b);
						pushVertex(...v2, r, g, b);
						pushVertex(...v3, r, g, b);
						pushVertex(...v2, r, g, b);
						pushVertex(...v3, r, g, b);
						pushVertex(...v4, r, g, b);
					};

					const pushCube = (b1, b2, b3, b4, t1, t2, t3, t4, c1, c2, c3, c4, c5, c6) => {
						pushFace(b1, b2, b3, b4, ...c1);
						pushFace(b1, b2, t1, t2, ...c2);
						pushFace(b1, b3, t1, t3, ...c3);
						pushFace(b2, b4, t2, t4, ...c4);
						pushFace(b3, b4, t3, t4, ...c5);
						pushFace(t1, t2, t3, t4, ...c6);
					};

					const pushPrism = (b1, b2, b3, t1, t2, t3, c1, c2, c3, c4, c5) => {
						pushVertex(...b1, ...c1);
						pushVertex(...b2, ...c1);
						pushVertex(...b3, ...c1);
						pushFace(b1, b2, t1, t2, ...c2);
						pushFace(b2, b3, t2, t3, ...c3);
						pushFace(b1, b3, t1, t3, ...c4);
						pushVertex(...t1, ...c5);
						pushVertex(...t2, ...c5);
						pushVertex(...t3, ...c5);
					};

					if (showLoadingZones.checked) {
						const selectedIndex = parseInt(loadingZonesSelect.value);

						const loadingZonesOffset = props.getUint32(0x1c, true);
						const endOffset = props.getUint32(0x20, true);
						for (let i = 0, o = loadingZonesOffset; o < endOffset; ++i, o += 24) {
							const x1 = props.getInt16(o + 4, true);
							const y1 = props.getInt16(o + 6, true);
							const z1 = props.getInt16(o + 8, true);
							const x2 = props.getInt16(o + 10, true);
							const y2 = props.getInt16(o + 12, true);
							const z2 = props.getInt16(o + 14, true);

							const selected = i === selectedIndex;

							const flags = props.getUint16(o, true);
							const colors = selected
								? [[.9,.9,.9], [.9,.9,.9], [.9,.9,.9], [.9,.9,.9], [.9,.9,.9], [.9,.9,.9]]
								: [[1,0,1], [1,0,1], [1,0,1], [1,0,1], [1,0,1], [1,0,1]];
							switch (flags >> 2 & 3) {
							case 0: colors[4] = selected ? [1,1,1] : [1,0.5,1]; break; // upwards exit
							case 1: colors[2] = selected ? [1,1,1] : [1,0.5,1]; break; // rightwards exit
							case 2: colors[1] = selected ? [1,1,1] : [1,0.5,1]; break; // downwards exit
							case 3: colors[3] = selected ? [1,1,1] : [1,0.5,1]; break; // leftwards exit
							}

							pushCube(
								[x1, y1, z1], [x1 + x2, y1, z1], [x1, y1 + y2, z1], [x1 + x2, y1 + y2, z1],
								[x1, y1, z1 + z2], [x1 + x2, y1, z1 + z2], [x1, y1 + y2, z1 + z2], [x1 + x2, y1 + y2, z1 + z2],
								...colors,
							);
						}
					}

					const collisionOffset = props.getUint32(0x38, true);
					const collisionEndOffset = props.getUint32(0x3c, true);
					if (showCollision.checked && collisionOffset !== collisionEndOffset) {
						const numBoxes = props.getUint32(collisionOffset, true);
						const numOtherBoxes = props.getUint32(collisionOffset + 4, true);
						const selectedIndex = parseInt(collisionSelect.value);
						for (let o = collisionOffset + 8, i = 0; i < numBoxes; ++i, o += 40) {
							const flags = props.getInt16(o + 4, true);
							// if (flags !== -1) continue;
							const p = [];
							for (let j = 0; j < 4; ++j) {
								const x = props.getInt16(o + 8 + j*8, true);
								const y = props.getInt16(o + 8 + j*8 + 2, true);
								const z = props.getInt16(o + 8 + j*8 + 4, true);
								const w = props.getInt16(o + 8 + j*8 + 6, true);
								p.push([x,y,z,w]);
							}

							const flat = p[0][2] === p[0][3] && p[1][2] === p[1][3] && p[2][2] === p[2][3] && p[3][2] === p[3][3];
							const fourPointed = p[3][0] || p[3][1] || p[3][2] || p[3][3];
							const shade = genShade(i);

							let colors = [[0,0,shade], [0,shade,0], [0,shade,0], [0,shade,0], [0,shade,0], [shade,0,0]];
							if (flags !== -1) colors = colors.map(([r,g,b]) => [0.5 + r/2, 0.5 + g/2, 0.5 + b/2]);
							if (i === selectedIndex) colors = [[1,1,1], [.9,.9,.9], [.9,.9,.9], [.9,.9,.9], [.9,.9,.9], [.5,.5,.5]];

							if (fourPointed) {
								if (flat) {
									pushFace([p[0][0], p[0][1], p[0][2]], [p[1][0], p[1][1], p[1][2]], [p[3][0], p[3][1], p[3][2]], [p[2][0], p[2][1], p[2][2]], ...colors[0]);
								} else {
									pushCube(
										[p[0][0], p[0][1], p[0][2]], [p[1][0], p[1][1], p[1][2]], [p[3][0], p[3][1], p[3][2]], [p[2][0], p[2][1], p[2][2]],
										[p[0][0], p[0][1], p[0][3]], [p[1][0], p[1][1], p[1][3]], [p[3][0], p[3][1], p[3][3]], [p[2][0], p[2][1], p[2][3]],
										...colors,
									);
								}
							} else {
								if (flat) {
									pushVertex(p[0][0], p[0][1], p[0][2], ...colors[0]);
									pushVertex(p[1][0], p[1][1], p[1][2], ...colors[0]);
									pushVertex(p[2][0], p[2][1], p[2][2], ...colors[0]);
								} else {
									pushPrism(
										[p[0][0], p[0][1], p[0][2]], [p[1][0], p[1][1], p[1][2]], [p[2][0], p[2][1], p[2][2]],
										[p[0][0], p[0][1], p[0][3]], [p[1][0], p[1][1], p[1][3]], [p[2][0], p[2][1], p[2][3]],
										colors[0], colors[1], colors[2], colors[3], colors[5],
									);
								}
							}
						}

						for (let o = collisionOffset + 8 + numBoxes*40, i = 0; i < numOtherBoxes; ++i, o += 24) {
							const x1 = props.getInt16(o + 4, true);
							const y1 = props.getInt16(o + 6, true);
							const z1 = props.getInt16(o + 8, true);

							let colors = [[1,1,0], [.7,.7,0], [.5,.5,0]];
							if (i + numBoxes === selectedIndex) colors = [[1,1,1], [.7,.7,.7], [.5,.5,.5]];

							pushCube(
								[x1-5, y1-5, z1-5], [x1+5, y1-5, z1-5], [x1-5, y1+5, z1-5], [x1+5, y1+5, z1-5],
								[x1-5, y1-5, z1+5], [x1+5, y1-5, z1+5], [x1-5, y1+5, z1+5], [x1+5, y1+5, z1+5],
								colors[0], colors[1], colors[1], colors[1], colors[1], colors[2],
							);
						}
					}

					gl.bindBuffer(gl.ARRAY_BUFFER, map3d.buffer);
					gl.bufferData(gl.ARRAY_BUFFER, map3d.floats, gl.STATIC_DRAW);
				}

				const sin1 = Math.sin(map3d.rotX());
				const cos1 = Math.cos(map3d.rotX());
				const sin2 = Math.sin(map3d.rotY());
				const cos2 = Math.cos(map3d.rotY());
				gl.uniformMatrix3fv(map3d.rotation1, false, new Float32Array([ cos1, sin1, 0, -sin1, cos1, 0, 0, 0, 1 ]));
				gl.uniformMatrix3fv(map3d.rotation2, false, new Float32Array([ 1, 0, 0, 0, cos2, sin2, 0, -sin2, cos2]));
				gl.uniform3f(map3d.translation, ...(showExtensions.checked ? [16, 16] : [0, 0]), 0);
				gl.uniform2f(map3d.size, map3dCanvas.width, map3dCanvas.height);

				if (map3d.vertices > 0) gl.drawArrays(gl.TRIANGLES, 0, map3d.vertices);
			}

			updatePalettes = updateTiles = updateMaps = updateOverlay = updateOverlayTriangles = false;

			requestAnimationFrame(render);
		};
		requestAnimationFrame(render); // RQA > interval?

		field.properties = roomId => {
			return lz77ish(fieldFile.start + fmapdataOffsets[field.roomOffsets[roomId].props], file);
		}

		field.data = roomId => {
			const room = field.roomOffsets[parseInt(roomId)];
			const layer = index => lz77ish(fieldFile.start + fmapdataOffsets[index], file);
			layers = [room.l1, room.l2, room.l3].map(l => l !== -1 && new DataView(layer(l).buffer));
			props = new DataView(layer(room.props).buffer);
			unknown = new DataView(layer(room.unknown).buffer);
			return { layers, props, unknown };
		};

		return field;
	});
})();
