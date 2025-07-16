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
	document.querySelector('#title').remove();

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
		reveal.innerHTML = `<code>[-]</code> ${title}`;
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
			reveal.innerHTML = `<code>${visible ? '[-]' : '[+]'}</code> ${title}`;

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

	//////////////////// Components ////////////////////////////////////////////////////////////////////

	const dropdown = (values, initialIndex, onchange, hideArrows) => {
		const container = document.getElementById('dropdown').content.cloneNode(true);
		const dropdown = container.querySelector('.dropdown');
		const left = dropdown.querySelector('.left');
		const selection = dropdown.querySelector('.selection');
		const vee = dropdown.querySelector('.vee');
		const right = dropdown.querySelector('.right');
		const options = dropdown.querySelector('.options');
		const optionBase = dropdown.querySelector('.option');

		const optionElements = [];
		let docListener;
		let open = false;
		let selected = initialIndex;
		const hide = () => {
			if (!open) return;
			if (docListener) removeEventListener('mousedown', docListener);
			options.style.visibility = 'hidden';
			open = false;
			docListener = undefined;
		};
		const select = (i, silent) => {
			optionElements[selected].style.color = '';
			optionElements[i].style.color = '#76f';
			selected = i;
			dropdown.value = String(i);
			selection.innerHTML = values[i];
			if (!silent) onchange();
		};

		for (let i = 0; i < values.length; ++i) {
			const value = values[i];
			const option = optionBase.cloneNode();
			option.innerHTML = value;
			options.appendChild(option);
			optionElements.push(option);

			option.addEventListener('mouseup', () => {
				hide();
				select(i);
			});
		}
		optionBase.remove();

		select(initialIndex, true);

		left.addEventListener('mousedown', () => {
			if (selected <= 0) return;
			select(selected - 1);
		});

		right.addEventListener('mousedown', () => {
			if (selected >= values.length - 1) return;
			select(selected + 1);
		});

		// not really a better way to do this
		let interval;
		interval = setInterval(() => {
			const box = options.getBoundingClientRect();
			if (box.width <= 0) return;
			clearInterval(interval);

			selection.style.width = `calc(${options.getBoundingClientRect().width - 2}px - ${hideArrows ? '0em' : '3em'})`;
		});

		if (hideArrows) {
			left.style.display = right.style.display = 'none';
			options.style.padding = '0 2em 0 0.5em';
			vee.style.display = 'inline-block';
		}

		selection.addEventListener('mousedown', e => {
			if (open) {
				hide();
				return;
			}

			const box = selection.getBoundingClientRect();
			let height;
			if (box.y > innerHeight / 2) { // top side has more space
				options.style.top = '';
				options.style.bottom = 'calc(1.4em - 1px)';
				height = box.y - 32;
				options.style.maxHeight = `${height}px`;
			} else { // bottom side has more space
				options.style.top = 'calc(1.4em - 1px)';
				options.style.bottom = '';
				height = innerHeight - box.y - 32;
				options.style.maxHeight = `calc(${height}px - 1.4em)`;
			}
			options.style.visibility = '';
			open = true;

			options.scroll(0, optionElements[selected].offsetTop + optionElements[selected].offsetHeight / 2 - height / 2);

			if (docListener) return;
			docListener = e => {
				if (options.contains(e.target)) return;
				hide();
			};
			setTimeout(() => addEventListener('mousedown', docListener));
		});

		return dropdown;
	};

	const checkbox = (name, checked, onchange) => {
		const container = document.getElementById('checkbox').content.cloneNode(true);
		const checkbox = container.querySelector('.checkbox');
		const check = checkbox.querySelector('.check');
		const label = checkbox.querySelector('.label');

		label.innerHTML = name;
		if (name === '') {
			checkbox.style.padding = '0';
			label.remove();
		}

		const set = (newChecked, silent) => {
			checked = newChecked;
			checkbox.checked = checked;
			if (checked) checkbox.classList.add('checked');
			else checkbox.classList.remove('checked');
			if (!silent) onchange();
		};

		set(checked, true);
		checkbox.addEventListener('mousedown', () => set(!checked));

		return checkbox;
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
			const slice = buf.buffer.slice(buf.byteOffset + o + i, buf.byteOffset + Math.min(end, o + i + 16384));
			str.push(String.fromCharCode(...new Uint8Array(slice).map(x => x < 0x20 ? 46 : x)));
		}

		return str.join('');
	};

	const bytes = (o, l, buf = file) => {
		const slice = buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + l);
		return Array.from(new Uint8Array(slice)).map(x => x.toString(16).padStart(2, '0')).join(' ');
	};

	const bits = (o, l, buf = file) => {
		const slice = buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + l);
		return Array.from(new Uint8Array(slice)).map(x => x.toString(2).padStart(8, '0')).join(' ');
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

	const writeRgba16 = (bitmap, pixel, rgb16) => {
		bitmap[pixel*4] = (rgb16 & 0x1f) << 3;
		bitmap[pixel*4 + 1] = (rgb16 >> 5 & 0x1f) << 3;
		bitmap[pixel*4 + 2] = (rgb16 >> 10 & 0x1f) << 3;
		bitmap[pixel*4 + 3] = 255;
	};

	Object.assign(window, { file, readString, bytes });

	//////////////////// Decompression/Unpacking ////////////////////////////////////////////////////////////////////

	const lzssBackwards = (end, indat, inputLen) => {
		const composite = indat.getUint32(end - 8, true);
		const offset = composite >> 24;
		const length1 = composite & 0xffffff; // the length of the input file
		const length2 = indat.getUint32(end - 4, true); // the extra length from decompression
	
		if (length1 + length2 >= inputLen * 10 || offset < 8) {
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

		return new DataView(outbuf.buffer);
	};

	const lz77ish = indat => {
		let inoff = 0;
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
				let byte = indat.getUint8(inoff++);
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

		return new DataView(outbuf.buffer);
	};

	const unpackSegmented = dat => {
		if (dat.byteLength < 4) return { offsets: [], segments: [] };
		const offsets = [dat.getUint32(0, true)];
		const segments = [];
		for (let o = 4; o < offsets[0]; o += 4) {
			const lastSplit = offsets[offsets.length - 1];
			const split = dat.getUint32(o, true);
			offsets.push(split);
			segments.push(sliceDataView(dat, lastSplit, split));
		}

		segments.push(sliceDataView(dat, offsets[offsets.length - 1], dat.byteLength));

		return { offsets, segments };
	};

	const sliceDataView = (dat, start, end) => new DataView(dat.buffer, dat.byteOffset + start, end - start);

	Object.assign(window, { lzssBackwards, lz77ish, sliceDataView, unpackSegmented });

	//////////////////// Misc ////////////////////////////////////////////////////////////////////////////////

	const download = (name, mime, data) => {
		const blob = new Blob([data], { type: mime });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = name;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000); // idk if a timeout is really necessary
	};

	//////////////////// Sections ////////////////////////////////////////////////////////////////////////////////

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
			addHTML(section, `<div><code>${name}: ${value}</code></div>`);
		}

		return headers;
	});

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
			fs.set(i, { index: i, path: '<overlay?>', name: `overlay${str8(i)}.bin`, start, end });
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

		for (const [key, fsentry] of fs) {
			const dat = new DataView(file.buffer, fsentry.start, fsentry.end - fsentry.start);
			Object.assign(dat, fsentry);
			fs.set(key, dat);
		}

		const fileSelectEntries = [];
		for (let i = 0; i < headers.fatLength / 8; ++i) {
			const fsentry = fs.get(i);
			fileSelectEntries.push(`${str8(i)}. (len 0x${(fsentry.end - fsentry.start).toString(16)}) ${sanitize(fsentry.path)}`);
		}
		const fileSelect = dropdown(fileSelectEntries, 0, () => {});
		section.appendChild(fileSelect);

		const decompression = dropdown(['No decompression', 'Backwards LZSS'], 0, () => {}, true);
		section.appendChild(decompression);

		const dump = document.createElement('button');
		dump.textContent = 'Dump';
		section.appendChild(dump);

		const downloadOutput = document.createElement('div');
		section.appendChild(downloadOutput);

		dump.addEventListener('mousedown', () => {
			const fsentry = fs.get(parseInt(fileSelect.value));
			const decompressionType = parseInt(decompression.value);

			let output;
			if (decompressionType === 0) output = file.buffer.slice(fsentry.start, fsentry.end);
			else if (decompressionType === 1) output = lzssBackwards(fsentry.end, file, fsentry.end - fsentry.start);

			if (!output) {
				downloadOutput.textContent = 'Failed to load/decompress';
				return;
			}

			downloadOutput.textContent = '';
			download(fsentry.name, 'application/octet-stream', output);
		});

		const fsList = [];
		for (let i = 0; i < headers.fatLength / 8; ++i) fsList.push(fs.get(i));

		const sorting = dropdown(['Sort by index', 'Sort by length'], 0, () => resort(), true);
		section.appendChild(sorting);
		const sorted = document.createElement('div');
		section.appendChild(sorted);
		const resort = () => {
			if (sorting.value === '0') fsList.sort((a, b) => a.index - b.index); // sort by index
			else if (sorting.value === '1') fsList.sort((a, b) => (a.end - a.start) - (b.end - b.start)); // sort by length

			sorted.innerHTML = '';
			for (const fsentry of fsList) {
				addHTML(sorted, `<div><code>${str8(fsentry.index)}. 0x${str32(fsentry.start)} - 0x${str32(fsentry.end)}
					(len 0x${(fsentry.end - fsentry.start).toString(16)})</code> ${sanitize(fsentry.path)}</div>`);
			}
		}
		resort();

		return fs;
	});

	const fsext = window.fsext = await createSectionWrapped('File System (Extended)', async section => {
		const fsext = {};

		// JP and demo versions don't compress their overlays, but the other versions do
		const decompressOverlay = dat => lzssBackwards(dat.byteLength, dat, dat.byteLength) || dat;

		const varLengthSegments = (start, dat, segmentsDat) => {
			const chunkLength = dat.getUint32(start, true);
			const offsets = [];
			const segments = [];
			for (let o = 4; o < chunkLength; o += 4) {
				offsets.push(dat.getInt32(start + o, true));
				if (!segmentsDat || offsets.length < 2) continue;
				segments.push(sliceDataView(segmentsDat, offsets[offsets.length - 2], offsets[offsets.length - 1]));
			}

			return { offsets, segments };
		};

		const fixedIndices = (o, end, dat) => {
			const indices = [];
			for (; o < end; o += 4) indices.push(dat.getInt32(o, true));
			return indices;
		};

		const overlay03 = decompressOverlay(fs.get(0x03)); // mostly field map references
		const overlay0e = decompressOverlay(fs.get(0x0e)); // mostly battle map references
		const fmapdata = fs.get('/FMap/FMapData.dat');

		// i'm not sure how these file structures work, but this should cover all versions of MLBIS
		// you can find these offsets yourself by going through overlay 0x03, which has lists of increasing
		// pointers into each file. these pointers stop right before the end of the file length, so it's easy to tell
		// which pointer list belongs to which file
		// (for example, in US /FMap/FMapData.dat has length 0x1a84600 and the last pointer is 0x1a84530)
		if (headers.gamecode === 'CLJE') { // US/AU
			// two more tables of chunk length 0xc, that i can't be bothered to try and guess
			fsext.bofxtex = varLengthSegments(0x7c90, overlay0e); // tile data is probably right next to it, again
			fsext.bofxpal = varLengthSegments(0x7ca8, overlay0e); // seems like palette data
			fsext.bmapg = varLengthSegments(0x7cc0, overlay0e, fs.get('/BMapG/BMapG.dat')); // might be BMes_cf.dat or BDataMap.dat
			fsext.bdfxtex = varLengthSegments(0x7cd8, overlay0e); // might be BDfxGAll.dat instead
			fsext.bdfxpal = varLengthSegments(0x7d0c, overlay0e); // all segments seem to be 514 in length, so probably palettes
			fsext.bai_atk_yy = varLengthSegments(0x7d40, overlay0e); // *might* be /BAI/BMes_ji.dat
			fsext.bai_mon_cf = varLengthSegments(0x7d7c, overlay0e);
			fsext.bai_mon_yo = varLengthSegments(0x8210, overlay0e);
			fsext.bai_scn_ji = varLengthSegments(0x82a4, overlay0e);
			fsext.bai_atk_nh = varLengthSegments(0x834c, overlay0e);
			fsext.bai_mon_ji = varLengthSegments(0x8480, overlay0e);
			fsext.bobjmap = varLengthSegments(0x859c, overlay0e);
			fsext.bai_atk_hk = varLengthSegments(0x875c, overlay0e);
			fsext.bai_scn_yo = varLengthSegments(0x8998, overlay0e);
			fsext.bobjpc = varLengthSegments(0x8c1c, overlay0e);
			fsext.bobjui = varLengthSegments(0x91c0, overlay0e);
			fsext.bobjmon = varLengthSegments(0x9c18, overlay0e);

			fsext.fevent = varLengthSegments(0xc8ac, overlay03);
			fsext.fmapdata = varLengthSegments(0x11310, overlay03, fmapdata);
			fsext.fobj = varLengthSegments(0xe8a0, overlay03);
			fsext.fobjmon = varLengthSegments(0xba3c, overlay03);
			fsext.fobjpc = varLengthSegments(0xbdb0, overlay03);
			fsext.fpaf = varLengthSegments(0xb8a0, overlay03);
			fsext.fieldAnimeIndices = fixedIndices(0x18e84, 0x19fd0, overlay03);
			fsext.fieldRoomIndices = fixedIndices(0x19fd0, 0x1d504, overlay03);
		} else if (headers.gamecode === 'CLJK') { // KO
			fsext.fmapdata = varLengthSegments(0x11310, overlay03, fmapdata);
			fsext.fieldAnimeIndices = fixedIndices(0x18e84, 0x19fd0, overlay03);
			fsext.fieldRoomIndices = fixedIndices(0x19fd0, 0x1d504, overlay03);
		} else if (headers.gamecode === 'CLJJ') { // JP
			fsext.fmapdata = varLengthSegments(0x11544, overlay03, fmapdata);
			fsext.fieldAnimeIndices = fixedIndices(0x19710, 0x1a85c, overlay03);
			fsext.fieldRoomIndices = fixedIndices(0x1a85c, 0x1dd90, overlay03);
		} else if (headers.gamecode === 'CLJP') { // EU
			fsext.fmapdata = varLengthSegments(0x11310, overlay03, fmapdata);
			fsext.fieldAnimeIndices = fixedIndices(0x18e84, 0x19fd0, overlay03);
			fsext.fieldRoomIndices = fixedIndices(0x19fd0, 0x1d504, overlay03);
		} else if (headers.gamecode === 'Y6PP') { // EU Demo
			fsext.fmapdata = varLengthSegments(0x9a3c, overlay03, fmapdata);
			fsext.fobj = varLengthSegments(0x9cb0, overlay03);
			fsext.fieldAnimeIndices = fixedIndices(0xe220, 0xe318, overlay03);
			fsext.fieldRoomIndices = fixedIndices(0xe498, 0xe72c, overlay03);
		} else if (headers.gamecode === 'Y6PE') { // US Demo
			fsext.fmapdata = varLengthSegments(0x9a3c, overlay03, fmapdata);
			fsext.fobj = varLengthSegments(0x9cb0, overlay03);
			fsext.fieldAnimeIndices = fixedIndices(0xe164, 0xe25c, overlay03);
			fsext.fieldRoomIndices = fixedIndices(0xe3dc, 0xe670, overlay03);
		} else {
			addHTML(section, `<b style="color: #f99">Unknown gamecode ${headers.gamecode}</b>`);
		}

		return fsext;
	});

	const font = window.font = await createSectionWrapped('Font Data', async section => {
		const fontFile = fs.get('/Font/StatFontSet.dat');

		const locations = [];
		for (let i = 0; i < 12; ++i) locations.push(file.getUint32(fontFile.start + i*4, true));
		addHTML(section, `<li>Locations: ${locations.map(x => `0x${x.toString(16)}`).join(' ')}`);
		const uniqueLocations = Array.from(new Set(locations));

		const options = [];
		for (const loc of uniqueLocations) options.push(`0x${loc.toString(16)}`);
		const select = dropdown(options, 0, () => render());
		section.appendChild(select);

		const preview = document.createElement('div');
		const render = () => {
			preview.innerHTML = '';

			const o = uniqueLocations[parseInt(select.value)];
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
		section.appendChild(preview);
	});

	const field = window.field = await createSectionWrapped('Field Maps', async section => {
		const field = {};

		const layoutPreview = document.createElement('div');
		section.appendChild(layoutPreview);

		field.rooms = [];
		for (let i = 0, j = 0; i < fsext.fieldRoomIndices.length; i += 5, ++j) {
			field.rooms[j] = {
				l1: fsext.fieldRoomIndices[i],
				l2: fsext.fieldRoomIndices[i + 1],
				l3: fsext.fieldRoomIndices[i + 2],
				props: fsext.fieldRoomIndices[i + 3],
				unknown: fsext.fieldRoomIndices[i + 4],
			};
		}

		let updatePalettes = true;
		let updateTiles = true;
		let updateMaps = true;
		let updateOverlay = true;
		let updateOverlayTriangles = true;

		// define UI
		const options = document.createElement('div');

		const roomPicker = dropdown(field.rooms.map((_, i) => `Room 0x${i.toString(16)}`), 0, () => roomPicked());
		options.appendChild(roomPicker);

		const layerCheckboxes = ['BG1', 'BG2', 'BG3'].map(name => {
			const check = checkbox(name, true, () => { updateMaps = true; });
			options.appendChild(check);
			return check;
		});
		const showPalettes = checkbox('Palettes', false, () => showPalettesChanged());
		options.appendChild(showPalettes);
		const showTiles = checkbox('Tiles', false, () => showTilesChanged());
		options.appendChild(showTiles);
		const showExtensions = checkbox('Room Extensions', true, () => { updateMaps = true; });
		options.appendChild(showExtensions);
		const showCollision = checkbox('Collision', false, () => { updateOverlayTriangles = true; });
		options.appendChild(showCollision);
		const showLoadingZones = checkbox('Loading Zones', false, () => { updateOverlayTriangles = true; });
		options.appendChild(showLoadingZones);
		const showDepth = checkbox('Depth', false, () => { updateMaps = true; });
		options.appendChild(showDepth);
		const showAnimations = checkbox('Animations', false, () => { updateMaps = true; });
		options.appendChild(showAnimations);

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
		componentContainer.style.cssText = 'position: relative; height: 0;';

		const paletteCanvases = [];
		const paletteStyles = ['top: 0px; left: 0px;', 'top: 0px; left: 128px;', 'top: 0px; left: 256px;'];
		for (let i = 0; i < 3; ++i) {
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = 16;
			canvas.style.cssText = `display: none; position: absolute; ${paletteStyles[i]} width: 128px; height: 128px;`;
			componentContainer.appendChild(canvas);
			paletteCanvases.push(canvas);
		}

		const tileCanvases = [];
		const tileStyles = ['top: 0px; left: 0px;', 'top: 0px; left: 256px;', 'top: 0px; left: 512px;'];
		for (let i = 0; i < 3; ++i) {
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = 256;
			canvas.style.cssText = `display: none; position: absolute; ${tileStyles[i]} width: 256px; height: 256px;`;
			componentContainer.appendChild(canvas);
			tileCanvases.push(canvas);
		}

		section.appendChild(componentContainer);

		const showPalettesChanged = () => {
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
		};

		const showTilesChanged = () => {
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
		};

		const bottomProperties = document.createElement('div');
		section.appendChild(bottomProperties);

		let collisionSelect, loadingZonesSelect, mapAnimations;
		let layers, props, room;
		const roomPicked = () => {
			room = field.rooms[parseInt(roomPicker.value)];

			const layer = index => lz77ish(fsext.fmapdata.segments[index]);
			layers = [room.l1, room.l2, room.l3].map(l => l !== -1 && layer(l));
			console.log(room.props, layer(room.props));
			window.EXP = layer(room.props);
			props = unpackSegmented(layer(room.props));
			Object.assign(props, {
				tiles: [props.segments[0], props.segments[1], props.segments[2]],
				palettes: [props.segments[3], props.segments[4], props.segments[5]],
				map: props.segments[6],
				loadingZones: props.segments[7],
				unknown8: props.segments[8],
				animations: props.segments[9],
				passiveAnimations: props.segments[10],
				unknown11: props.segments[11],
				unknown12: props.segments[12],
				unknown13: props.segments[13],
				collision: props.segments[14],
				depth: props.segments[15],
				unknown16: props.segments[16],
				unknown17: props.segments[17],
			});

			bottomProperties.innerHTML = sideProperties.innerHTML = '';

			addHTML(bottomProperties, `<div>Layers: <code>BG1 ${room.l1.toString(16)}, BG2 ${room.l2.toString(16)}, BG3 ${room.l3.toString(16)}, Props ${room.props.toString(16)}, ??? ${room.unknown.toString(16)}</code></div>`);

			const mapWidth = props.map.getUint16(0, true);
			const mapHeight = props.map.getUint16(2, true);
			const mapActualHeight = Math.max(props.tiles[0].byteLength, props.tiles[1].byteLength, props.tiles[2].byteLength) / 2 / mapWidth;
			const mapFlags = props.map.getUint16(4, true);
			addHTML(sideProperties, `<div><code>${mapWidth}x${mapHeight} tiles (${mapWidth}x${mapActualHeight} actual),
				(${mapWidth * 8}x${mapHeight * 8} px)
			</code></div>`);
			addHTML(sideProperties, `<div>Other props: <code>${bytes(4, 8, props.map)}</code></div>`);

			{
				const { loadingZones } = props;
				const loadingZonesPlaceholder = document.createElement('div');
				sideProperties.appendChild(loadingZonesPlaceholder);

				const loadingZoneData = document.createElement('div');
				sideProperties.appendChild(loadingZoneData);

				const options = [`${loadingZones.byteLength / 24} loading zones`];
				for (let i = 0, o = 0; o < loadingZones.byteLength; ++i, o += 24) {
					const flags = loadingZones.getUint16(o, true);
					const room = loadingZones.getUint16(o + 2, true);
					const direction = ('↑→↓←')[flags >> 2 & 3];
					options.push(`[${i}] ${direction} ${room.toString(16)}`);
				}

				loadingZonesSelect = dropdown(options, 0, () => {
					updateOverlayTriangles = true;

					if (loadingZonesSelect.value === '0') {
						loadingZoneData.innerHTML = '';
						return;
					}

					const o = (parseInt(loadingZonesSelect.value) - 1) * 24;
					loadingZoneData.innerHTML = `<ul>
						<li>Flags: <code>${loadingZones.getUint8(o).toString(2).padStart(8, '0')}
							${loadingZones.getUint8(o + 1).toString(2).padStart(8, '0')}</code></li>
						<li>Other data: <code>${bytes(o + 16, 8, loadingZones)}</code></li>
					</ul>`;
				});
				loadingZonesPlaceholder.replaceWith(loadingZonesSelect);
			}

			{
				const { collision } = props;
				const numBoxes = collision.byteLength > 0 ? collision.getUint32(0, true) : 0;
				const numOtherBoxes = collision.byteLength > 0 ? collision.getUint32(4, true) : 0;

				const container = document.createElement('div');

				const collisionSelectPlaceholder = document.createElement('div');
				container.appendChild(collisionSelectPlaceholder);

				sideProperties.appendChild(container);

				const collisionData = document.createElement('div');
				sideProperties.appendChild(collisionData);

				const changed = () => {
					updateOverlayTriangles = true;

					if (collisionSelect.value === '0') {
						collisionData.innerHTML = '';
						return;
					}

					const index = parseInt(collisionSelect.value) - 1;
					let o = 8;
					o += Math.min(index, numBoxes) * 40; // first chunk of prisms
					o += Math.max(index - numBoxes, 0) * 24; // second chunk of... things

					if (index < numBoxes) { // prism
						const passables = collision.getUint16(o + 4, true);
						const attributes = collision.getUint16(o + 6, true);
						const solidForDrill = passables & 2;
						const solidForMiniMario = passables & 4;

						const unisolid = attributes & 0x40;
						const spikeballGrip = attributes & 4;

						collisionData.innerHTML = `<ul>
							<li>Flags: <code>${[0,1,2,3,4,5,6,7].map(i => collision.getUint8(o + i).toString(2).padStart(8, '0')).join(' ')}</code></li>
							<li style="color: ${solidForDrill ? '#f99' : '#9f9'};">Drill ${solidForDrill ? 'can\'t' : 'can'} pass</li>
							<li style="color: ${solidForMiniMario ? '#f99' : '#9f9'};">Mini ${solidForMiniMario ? 'can\'t' : 'can'} pass</li>
							<li style="color: ${unisolid ? '#9f9' : '#f99'};">${unisolid ? 'Unisolid' : 'Not unisolid'}</li>
							<li style="color: ${spikeballGrip ? '#9f9' : '#f99'};">${spikeballGrip ? 'Spike ball grippable' : 'Not spike ball grippable'}</li>
						</ul>`;
					} else { // special
						collisionData.innerHTML = bytes(o, 24, collision);
					}
				};

				const options = [`${numBoxes} prisms, ${numOtherBoxes} specials`];
				for (let i = 0; i < numBoxes; ++i) options.push(`[${i}] Prism`);
				for (let i = 0; i < numOtherBoxes; ++i) options.push(`[${i}] Special`);

				collisionSelect = dropdown(options, 0, changed);
				collisionSelectPlaceholder.replaceWith(collisionSelect);
			}

			{
				const { animations } = props;
				const { segments } = unpackSegmented(animations);
				mapAnimations = new Set();

				const div = document.createElement('div');
				div.textContent = 'Animations:';

				let j = 0;
				for (let i = 1; i < segments.length; i += 3) {
					if (segments[i].byteLength < 8) continue;

					const tileIndex = segments[0].getInt16(j*4, true);
					const flags = segments[0].getUint16(j*4 + 2, true);

					const check = checkbox('', false, () => {
						if (check.checked) mapAnimations.add(segments[i]);
						else mapAnimations.delete(segments[i]);
						updateMaps = true;
					});
					div.appendChild(check);

					++j;
				}

				sideProperties.appendChild(div);
			}

			addHTML(bottomProperties, `<div>unknown8: <code>${bytes(0, props.unknown8.byteLength, props.unknown8)}</code></div>`);

			addHTML(bottomProperties, `<div>Animations:</div>`);
			const animationList = document.createElement('ul');
			const { segments: animationSegments } = unpackSegmented(props.animations);
			for (let i = 0; i < animationSegments.length; ++i) {
				addHTML(animationList, `<li>${i}: <code>${bytes(0, animationSegments[i].byteLength, animationSegments[i])}</code></li>`);
			}
			bottomProperties.appendChild(animationList);

			addHTML(bottomProperties, `<div>Passive Animations:</div>`);
			const passiveAnimationList = document.createElement('ul');
			const { segments: passiveAnimationSegments } = unpackSegmented(props.passiveAnimations);
			for (let i = 0; i < passiveAnimationSegments.length; ++i) {
				addHTML(passiveAnimationList, `<li>${i}: <code>${bytes(0, passiveAnimationSegments[i].byteLength, passiveAnimationSegments[i])}</code></li>`);
			}
			bottomProperties.appendChild(passiveAnimationList);

			addHTML(bottomProperties, `<div>unknown11: <code>${bytes(0, props.unknown11.byteLength, props.unknown11)}</code></div>`);
			addHTML(bottomProperties, `<div>unknown12: <code>${bytes(0, props.unknown12.byteLength, props.unknown12)}</code></div>`);
			addHTML(bottomProperties, `<div>unknown13: <code>${bytes(0, props.unknown13.byteLength, props.unknown13)}</code></div>`);
			addHTML(bottomProperties, `<div>unknown16: <code>${bytes(0, props.unknown16.byteLength, props.unknown16)}</code></div>`);
			addHTML(bottomProperties, `<div>unknown17: <code>${bytes(0, props.unknown17.byteLength, props.unknown17)}</code></div>`);

			updatePalettes = true;
		};
		roomPicked();

		// bitmap generation
		const setPixel = (bitmap, pixel, rgb16) => {
			if (rgb16 & 0x8000) rgb16 = 0xffff;
			bitmap[pixel*4] = (rgb16 & 0x1f) << 3;
			bitmap[pixel*4 + 1] = (rgb16 >> 5 & 0x1f) << 3;
			bitmap[pixel*4 + 2] = (rgb16 >> 10 & 0x1f) << 3;
			bitmap[pixel*4 + 3] = 255;
		};

		field.genPalette = paletteSegment => {
			const bitmap = new Uint8ClampedArray(256 * 4);
			for (let i = 0; i < 256; ++i) setPixel(bitmap, i, paletteSegment.getUint16(i*2, true));
			return new ImageData(bitmap, 16);
		};

		field.genTiles = (paletteSegment, mapSegment, layer, layerId, paletteShift) => {
			const mapFlags = mapSegment.getUint8(5);

			let o = 0;
			const bitmap = new Uint8ClampedArray(256 * 256 * 4);
			if (mapFlags & (1 << layerId)) { // 256 color
				for (let i = 0; o < layer.byteLength; ++i) {
					const basePos = (i >> 5) << 11 | (i & 0x1f) << 3; // y = i >> 5, x = i & 0x1f
					for (let j = 0; j < 64 && o < layer.byteLength; ++j) { // 8x8
						const pos = basePos | (j >> 3) << 8 | (j & 0x7);
						const paletteIndex = layer.getUint8(o++);
						const rgb16 = paletteSegment.getUint16(paletteIndex*2, true);
						setPixel(bitmap, pos, rgb16);
					}
				}
			} else { // 16 color
				for (let i = 0; o < layer.byteLength; ++i) {
					const basePos = (i >> 5) << 11 | (i & 0x1f) << 3; // y = i >> 5, x = i & 0x1f
					for (let j = 0; j < 64 && o < layer.byteLength; j += 2) { // 8x8 still
						const pos = basePos | (j >> 3) << 8 | (j & 0x7);
						const composite = layer.getUint8(o++);
						setPixel(bitmap, pos, paletteSegment.getUint16((paletteShift << 4 | (composite & 0xf))*2, true));
						setPixel(bitmap, pos | 1, paletteSegment.getUint16((paletteShift << 4 | composite >> 4)*2, true));
					}
				}
			}

			return new ImageData(bitmap, 256);
		};

		field.genMap = (props, layers, animations) => {
			const mapWidth = props.map.getUint16(0, true);
			const mapHeight = props.map.getUint16(2, true);
			const mapFlags = props.map.getUint8(5);

			const bitmaps = [];
			for (let i = 2; i >= 0; --i) {
				if (!layers[i]) {
					bitmaps[i] = undefined;
					continue;
				}

				bitmaps[i] = new Uint8ClampedArray(mapWidth * mapHeight * 64 * 4);
				let o = 0;
				for (let j = 0; j < mapHeight * mapWidth && o + 1 < props.tiles[i].byteLength; ++j) {
					const x = j % mapWidth;
					const y = (j / mapWidth) | 0;
					let tile = props.tiles[i].getUint16(o, true);
					o += 2;

					for (const override of animations) {
						const ox = override.getInt16(0, true);
						const oy = override.getInt16(2, true);
						const ow = override.getInt16(4, true);
						const oh = override.getInt16(6, true);
						if (ox <= x && x < ox + ow && oy <= y && y < oy + oh) {
							const overrideIndex = (y - oy) * ow + (x - ox);
							const overrideTile = override.getUint16(8 + (ow*oh*i + overrideIndex)*2, true);
							if (overrideTile === 0x3ff) continue;
							tile = overrideTile;
						}
					}

					if (mapFlags & (1 << i)) { // 256 color
						for (let k = 0; k < 64; ++k) {
							const xx = (tile & 0x400) ? 7 - (k & 7) : k & 7;
							const yy = (tile & 0x800) ? 7 - (k >> 3) : k >> 3;
							const loc = (tile & 0x3ff) << 6 | k;
							if (loc >= layers[i].byteLength) continue;

							const paletteIndex = layers[i].getUint8(loc);
							if (!paletteIndex) continue;

							const rgb16 = props.palettes[i].getUint16(paletteIndex*2, true);
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
								const rgb16 = props.palettes[i].getUint16((paletteRow << 4 | (paletteComposite & 0xf))*2, true);
								setPixel(bitmaps[i], (y*8 + yy)*mapWidth*8 + x*8 + xx, rgb16);
							}
							if (paletteComposite >> 4) {
								const rgb16 = props.palettes[i].getUint16((paletteRow << 4 | paletteComposite >> 4)*2, true);
								setPixel(bitmaps[i], (y*8 + yy)*mapWidth*8 + x*8 + xx + ((tile & 0x400) ? -1 : 1), rgb16);
							}
						}
					}
				}
			}

			return bitmaps.map(x => x && new ImageData(x, mapWidth * 8, mapHeight * 8));
		};

		// rendering
		const shades = [];
		const genShade = index => shades[index] || (shades[index] = Math.random() * 0.5 + 0.5);

		const render = () => {
			const now = performance.now();
			if (updatePalettes) { // palettes
				console.log('updatePalettes');
				for (let i = 0; i < 3; ++i) {
					const ctx = paletteCanvases[i].getContext('2d');
					if (layers[i]) ctx.putImageData(field.genPalette(props.palettes[i], i), 0, 0);
					else ctx.clearRect(0, 0, 16, 16);
				}
			}

			if (updateTiles || updatePalettes) { // tiles
				console.log('updateTiles');
				for (let i = 0; i < 3; ++i) {
					const ctx = tileCanvases[i].getContext('2d');
					if (layers[i]) ctx.putImageData(field.genTiles(props.palettes[i], props.map, layers[i], i, 0), 0, 0);
					else ctx.clearRect(0, 0, 256, 256);
				}
			}

			const mapWidth = props.map.getUint16(0, true);
			const mapHeight = props.map.getUint16(2, true);
			if (updateMaps || updateTiles || updatePalettes) {
				console.log('updateMaps');
				const ctx = mapCanvas.getContext('2d');
				const bitmaps = field.genMap(props, layers.map((x, i) => layerCheckboxes[i].checked && x), mapAnimations);
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

					if (showDepth.checked && props.depth.byteLength > 0) {
						const { depth } = props;
						const numDepths = depth.getUint32(0, true);
						for (let o = 4, i = 0; i < numDepths; ++i, o += 12) {
							const data = depth.getUint16(o, true);
							const flags = depth.getInt16(o + 2, true);
							const x1 = depth.getInt16(o + 4, true);
							const x2 = depth.getInt16(o + 6, true);
							const y1 = depth.getInt16(o + 8, true);
							const y2 = depth.getInt16(o + 10, true);
							ctx.fillStyle = `#${[flags & 1, flags & 2, flags & 4].map(x => x ? 'f' : '9').join('')}`;
							ctx.strokeStyle = '#000';
							ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
							ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

							ctx.fillText(str16(data), x1 + 10, y1 + 20);
							ctx.strokeText(str16(data), x1 + 10, y1 + 20);
						}
					}

					if (showAnimations.checked && props.animations.byteLength > 0) {
						const { segments } = unpackSegmented(props.animations);

						for (let i = 1; i < segments.length; ++i) {
							if (segments[i].byteLength < 8) continue;
							const x = segments[i].getInt16(0, true);
							const y = segments[i].getInt16(2, true);
							const w = segments[i].getInt16(4, true);
							const h = segments[i].getInt16(6, true);
							ctx.fillStyle = '#fff';
							ctx.fillRect(x * 8, y * 8, w * 8, h * 8);
							ctx.strokeRect(x * 8, y * 8, w * 8, h * 8);
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
						const { loadingZones } = props;
						const selectedIndex = parseInt(loadingZonesSelect.value) - 1;

						for (let i = 0, o = 0; o < loadingZones.byteLength; ++i, o += 24) {
							const x1 = loadingZones.getInt16(o + 4, true);
							const y1 = loadingZones.getInt16(o + 6, true);
							const z1 = loadingZones.getInt16(o + 8, true);
							const x2 = loadingZones.getInt16(o + 10, true);
							const y2 = loadingZones.getInt16(o + 12, true);
							const z2 = loadingZones.getInt16(o + 14, true);

							const selected = i === selectedIndex;

							const flags = loadingZones.getUint16(o, true);
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

					if (showCollision.checked && props.collision.byteLength > 0) {
						const { collision } = props;
						const numBoxes = collision.getUint32(0, true);
						const numOtherBoxes = collision.getUint32(4, true);
						const selectedIndex = parseInt(collisionSelect.value) - 1;

						for (let o = 8, i = 0; i < numBoxes; ++i, o += 40) {
							const flags = collision.getInt16(o + 4, true);
							const flags4 = collision.getInt16(o + 6, true);
							// if (flags !== -1) continue;
							const p = [];
							for (let j = 0; j < 4; ++j) {
								const x = collision.getInt16(o + 8 + j*8, true);
								const y = collision.getInt16(o + 8 + j*8 + 2, true);
								const z1 = collision.getInt16(o + 8 + j*8 + 4, true);
								const z2 = collision.getInt16(o + 8 + j*8 + 6, true);
								p.push([ x, y, z1, z2 ]);
							}

							const flat = p[0][2] === p[0][3] && p[1][2] === p[1][3] && p[2][2] === p[2][3] && p[3][2] === p[3][3];
							const fourPointed = p[3][0] || p[3][1] || p[3][2] || p[3][3];
							const shade = genShade(i);

							let colors = [[0,0,shade], [0,shade,0], [0,shade,0], [0,shade,0], [0,shade,0], [shade,0,0]];
							if (flags4 & 1) colors[0] = [shade,0,0];
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

		return field;
	});

	const fmapdataTileViewer = window.fmapdataTileViewer = await createSectionWrapped('FMapData Tile Viewer', async section => {
		const fieldFile = fs.get('/FMap/FMapData.dat');

		const options = [];
		for (let i = 0; i < fsext.fieldAnimeIndices[0]; ++i) options.push(`FMapData ${i.toString(16)}`);
		for (let i = 0; i < fsext.fieldAnimeIndices.length; ++i) options.push(`FMapData ${fsext.fieldAnimeIndices[i].toString(16)} (${i.toString(16)})`);
		const select = dropdown(options, 0, () => render());

		section.appendChild(select);

		const dump = document.createElement('button');
		dump.textContent = 'Dump';
		dump.addEventListener('click', () => {
			const index = parseInt(select.value);
			const data = lz77ish(fsext.fmapdata.segments[index]);
			download(`FMapData-${index.toString(16)}.bin`, 'application/octet-stream', data.buffer);
		});
		section.appendChild(dump);

		const tileCanvas256 = document.createElement('canvas');
		tileCanvas256.width = tileCanvas256.height = 256;
		tileCanvas256.style.width = tileCanvas256.style.height = '256px';
		section.appendChild(tileCanvas256);

		const tileCanvas16 = document.createElement('canvas');
		tileCanvas16.width = tileCanvas16.height = 256;
		tileCanvas16.style.width = tileCanvas16.style.height = '256px';
		section.appendChild(tileCanvas16);

		// make a rainbow palette
		const globalPalette256 = [[0,0,0]];
		for (let i = 0; i < 32; ++i) globalPalette256.push([31 << 3, i << 3, 0]);
		for (let i = 0; i < 32; ++i) globalPalette256.push([(31 - i) << 3, 31 << 3, 0]);
		for (let i = 0; i < 32; ++i) globalPalette256.push([0, 31 << 3, i << 3]);
		for (let i = 0; i < 32; ++i) globalPalette256.push([0, (31 - i) << 3, 31 << 3]);
		for (let i = 0; i < 32; ++i) globalPalette256.push([31 << 1, i << 1, 0]);
		for (let i = 0; i < 32; ++i) globalPalette256.push([(31 - i) << 1, 31 << 1, 0]);
		for (let i = 0; i < 32; ++i) globalPalette256.push([0, 31 << 1, i << 1]);
		for (let i = 0; i < 32; ++i) globalPalette256.push([0, (31 - i) << 1, 31 << 1]);

		const globalPalette16 = [
			[0,0,0], [255,0,0], [255,64,0], [255,128,0], [255,192,0], [255,255,0], [192,255,0], [128,255,0], [64,255,0], [0,255,0],
			[0,255,64], [0,255,128], [0,255,192], [0,255,255], [0,192,255], [0,128,255],
		];

		const render = () => {
			const index = parseInt(select.value);
			const data = lz77ish(fsext.fmapdata.segments[index]);

			const bitmap256 = new Uint8ClampedArray(256 * 256 * 4);
			let o = 0;
			for (let i = 0; o < data.byteLength; ++i) {
				const basePos = (i >> 5) << 11 | (i & 0x1f) << 3; // y = i >> 5, x = i & 0x1f
				for (let j = 0; j < 64 && o < data.byteLength; ++j) {
					const pos = basePos | (j >> 3) << 8 | (j & 0x7);
					const paletteIndex = data.getUint8(o++);
					([bitmap256[pos*4], bitmap256[pos*4 + 1], bitmap256[pos*4 + 2]] = globalPalette256[paletteIndex]);
					bitmap256[pos*4 + 3] = 255;
				}
			}

			const bitmap16 = new Uint8ClampedArray(256 * 256 * 4);
			o = 0;
			for (let i = 0; o < data.byteLength; ++i) {
				const basePos = (i >> 5) << 11 | (i & 0x1f) << 3; // y = i >> 5, x = i & 0x1f
				for (let j = 0; j < 64 && o < data.byteLength; j += 2) {
					const pos1 = basePos | (j >> 3) << 8 | (j & 0x7);
					const pos2 = pos1 | 1;
					const composite = data.getUint8(o++);
					([bitmap16[pos1*4], bitmap16[pos1*4 + 1], bitmap16[pos1*4 + 2]] = globalPalette16[composite & 0xf]);
					([bitmap16[pos2*4], bitmap16[pos2*4 + 1], bitmap16[pos2*4 + 2]] = globalPalette16[composite >> 4]);
					bitmap16[pos1*4 + 3] = bitmap16[pos2*4 + 3] = 255;
				}
			}

			tileCanvas256.getContext('2d').putImageData(new ImageData(bitmap256, 256, 256), 0, 0);
			tileCanvas16.getContext('2d').putImageData(new ImageData(bitmap16, 256, 256), 0, 0);
		};
		select.addEventListener('change', render);
		render();
	});

	const battle = window.battle = await createSectionWrapped('Battle Maps', section => {
		const battle = {};

		const bmapFile = fs.get('/BMap/BMap.dat');
		const bmap = battle.bmap = unpackSegmented(bmapFile);

		const bmaps = battle.bmaps = [];
		for (let i = 0; i < bmap.segments.length; i += 8) {
			bmaps.push({
				unknown0: bmap.segments[i],
				tileset: bmap.segments[i + 1],
				palette: bmap.segments[i + 2],
				layer1: bmap.segments[i + 3],
				layer2: bmap.segments[i + 4],
				layer3: bmap.segments[i + 5],
				unknown6: bmap.segments[i + 6],
				unknown7: bmap.segments[i + 7],
			});
		}

		const bmapSelect = dropdown(bmaps.map((_, i) => `BMap 0x${i.toString(16)}`), 0, () => render());
		section.appendChild(bmapSelect);

		const bg1Check = checkbox('BG1', true, () => render());
		section.appendChild(bg1Check);
		const bg2Check = checkbox('BG2', true, () => render());
		section.appendChild(bg2Check);
		const bg3Check = checkbox('BG3', true, () => render());
		section.appendChild(bg3Check);
		const reverseLayers = checkbox('Reverse Layers', false, () => render());
		section.appendChild(reverseLayers);

		const mapCanvas = document.createElement('canvas');
		mapCanvas.style.cssText = 'width: 512px; height: 256px;';
		mapCanvas.width = 512;
		mapCanvas.height = 256;
		section.appendChild(mapCanvas);

		const rawPreview = document.createElement('div');
		rawPreview.style.cssText = 'height: 256px; position: relative;';
		section.appendChild(rawPreview);

		const tilesetCanvas = document.createElement('canvas');
		tilesetCanvas.style.cssText = 'height: 256px; width: 256px; position: absolute; top: 0px; left: 0px;';
		tilesetCanvas.width = tilesetCanvas.height = 256;
		rawPreview.appendChild(tilesetCanvas);

		const unknown0Canvas = document.createElement('canvas');
		unknown0Canvas.style.cssText = 'height: 256px; width: 256px; position: absolute; top: 0; left: 256px;';
		unknown0Canvas.width = unknown0Canvas.height = 256;
		rawPreview.appendChild(unknown0Canvas);

		const paletteCanvas = document.createElement('canvas');
		paletteCanvas.style.cssText = 'height: 128px; width: 128px; position: absolute; top: 0px; left: 512px;';
		paletteCanvas.width = paletteCanvas.height = 16;
		rawPreview.appendChild(paletteCanvas);

		const metaPreview = document.createElement('div');
		section.appendChild(metaPreview);

		const render = () => {
			const room = bmaps[parseInt(bmapSelect.value)];

			// palette
			const palette = room.palette?.byteLength && room.palette;
			const paletteCtx = paletteCanvas.getContext('2d');
			if (palette) {
				const paletteBitmap = new Uint8ClampedArray(256 * 4);
				for (let i = 0; i < 256; ++i) {
					const rgb16 = palette.getUint16(i * 2, true);
					writeRgba16(paletteBitmap, i, palette.getUint16(i * 2, true));
				}
				paletteCtx.putImageData(new ImageData(paletteBitmap, 16, 16), 0, 0);
			} else {
				paletteCtx.clearRect(0, 0, 16, 16);
			}

			// tileset
			const tileset = room.tileset?.byteLength && lz77ish(room.tileset);
			const tilesetCtx = tilesetCanvas.getContext('2d');
			if (tileset) {
				const tilesetBitmap = new Uint8ClampedArray(256 * 256 * 4);
				let o = 0;
				for (let i = 0; o < tileset.byteLength; ++i) {
					const basePos = (i >> 5) << 11 | (i & 0x1f) << 3; // y = i >> 5, x = i & 0x1f
					// 16-color
					for (let j = 0; j < 64 && o < tileset.byteLength; j += 2) {
						const pos = basePos | (j >> 3) << 8 | (j & 0x7);
						const composite = tileset.getUint8(o++);
						writeRgba16(tilesetBitmap, pos, palette.getUint16((composite & 0xf) * 2, true));
						writeRgba16(tilesetBitmap, pos | 1, palette.getUint16((composite >> 4) * 2, true));
					}
				}
				tilesetCtx.putImageData(new ImageData(tilesetBitmap, 256, 256), 0, 0);
			} else {
				tilesetCtx.clearRect(0, 0, 256, 256);
			}

			// unknown0
			const unknown0 = room.unknown0?.byteLength && lz77ish(room.unknown0);
			const unknown0Ctx = unknown0Canvas.getContext('2d');
			if (unknown0) {
				const unknown0Bitmap = new Uint8ClampedArray(256 * 256 * 4);
				let o = 0;
				for (let i = 0; o < unknown0.byteLength; ++i) {
					const basePos = (i >> 5) << 11 | (i & 0x1f) << 3; // y = i >> 5, x = i & 0x1f
					// 16-color
					for (let j = 0; j < 64 && o < unknown0.byteLength; j += 2) {
						const pos = basePos | (j >> 3) << 8 | (j & 0x7);
						const composite = unknown0.getUint8(o++);
						writeRgba16(unknown0Bitmap, pos, palette.getUint16((composite & 0xf) * 2, true));
						writeRgba16(unknown0Bitmap, pos | 1, palette.getUint16((composite >> 4) * 2, true));
					}
				}
				unknown0Ctx.putImageData(new ImageData(unknown0Bitmap, 256, 256), 0, 0);
			} else {
				unknown0Ctx.clearRect(0, 0, 256, 256);
			}

			// map
			const mapCtx = mapCanvas.getContext('2d');
			if (palette && tileset) {
				const mapBitmap = new Uint8ClampedArray(512 * 256 * 4);
				for (const layerIndex of (reversedOrder.checked ? [0, 1, 2] : [2, 1, 0])) {
					if (![bg1Check, bg2Check, bg3Check][layerIndex].checked) continue;
					const layer = [room.layer1, room.layer2, room.layer3][layerIndex];
					for (let i = 0; i*2 + 1 < (layer?.byteLength ?? 0); ++i) {
						const tile = layer.getUint16(i * 2, true);
						const paletteRow = tile >> 12;
						const tileOffset = (tile & 0x3ff) * 32;
						const basePos = (i >> 6) << 12 | (i & 0x3f) << 3; // y = i >> 6, x = i & 0x3f
						for (let j = 0; j < 32 && tileOffset + j < tileset.byteLength; ++j) {
							let pos = basePos | (j >> 2) << 9 | (j & 0x3) << 1;
							if (tile & 0x400) pos ^= 0x7; // horizontal flip
							if (tile & 0x800) pos ^= 0x7 << 9; // vertical flip
							const composite = tileset.getUint8(tileOffset + j);
							if (composite & 0xf) writeRgba16(mapBitmap, pos, palette.getUint16((paletteRow << 4 | (composite & 0xf)) * 2, true));
							if (composite >> 4) writeRgba16(mapBitmap, pos ^ 1, palette.getUint16((paletteRow << 4 | composite >> 4) * 2, true));
						}
					}
				}
				mapCtx.putImageData(new ImageData(mapBitmap, 512, 256), 0, 0);
			} else {
				mapCtx.clearRect(0, 0, 512, 256);
			}

			// metadata below
			metaPreview.innerHTML = '';
			try {
				const decompressed = lz77ish(room.unknown0);
				addHTML(metaPreview, `<div>unknown0 decompressed: <code>${bytes(0, decompressed.byteLength, decompressed)}</code></div>`);
			} catch (err) {
				addHTML(metaPreview, `<div>unknown0: <code>${bytes(0, room.unknown0.byteLength, room.unknown0)}</code></div>`);
			}
			addHTML(metaPreview, `<div>layer sizes: ${room.layer1?.byteLength}, ${room.layer2?.byteLength}, ${room.layer3?.byteLength}</div>`);
			if (room.unknown6) addHTML(metaPreview, `<div>unknown6: <code>${bytes(0, room.unknown6.byteLength, room.unknown6)}</code></div>`);
			if (room.unknown7) addHTML(metaPreview, `<div>unknown7: <code>${bytes(0, room.unknown7.byteLength, room.unknown7)}</code></div>`);
		};
		render();

		return battle;
	});

	// add spacing to the bottom of the page, for better scrolling
	const spacer = document.createElement('div');
	spacer.style.height = '100vh';
	document.body.appendChild(spacer);
})();
