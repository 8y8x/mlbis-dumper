'use strict';

(async () => {
	const waitFor = (cb) =>
		new Promise((r) => {
			let interval;
			interval = setInterval(() => {
				if (!cb()) return;
				clearInterval(interval);
				r();
			});
			const rqa = () => {
				if (cb()) r();
				else requestAnimationFrame(rqa);
			};
			rqa();
		});
	const loaded = document.querySelector('#loaded');
	let loadedCount = 1;
	const checks = [() => window.initDisassembler, () => window.initField, () => window.initAlgorithms];
	for (const cb of checks) {
		waitFor(cb).then(() => {
			++loadedCount;
			loaded.textContent = `${loadedCount}/${checks.length + 1} modules loaded`;
		});
	}

	const fileBlob = await new Promise((resolve) => {
		const input = document.querySelector('#file-input');
		input.addEventListener('input', (e) => resolve(input.files[0]));
	});

	const fileLoadingStart = performance.now();

	const file = (window.file = new DataView(
		await new Promise((resolve) => {
			const reader = new FileReader();
			reader.addEventListener('load', () => resolve(reader.result));
			reader.readAsArrayBuffer(fileBlob);
		}),
	));

	const sectionLoadingStart = performance.now();

	document.querySelector('#file-input').remove();
	document.querySelector('#title').remove();

	const settings = JSON.parse(localStorage.getItem('settings') || '{}');

	// +---------------------------------------------------------------------------------------------------------------+
	// | Components                                                                                                    |
	// +---------------------------------------------------------------------------------------------------------------+

	const dropdown = (window.dropdown = (values, initialIndex, onchange, onhover, hideArrows) => {
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
			optionElements[i].style.color = 'var(--dropdown-fg)';
			selection.innerHTML = values[i];

			selected = i;
			dropdown.value = i;
			dropdown.hovered = undefined;
			if (!silent) onchange(i);
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

			option.addEventListener('mouseenter', () => {
				dropdown.hovered = i;
				onhover?.(i);
			});
		}
		optionBase.remove();

		options.addEventListener('mouseleave', () => {
			dropdown.hovered = undefined;
			onhover?.(undefined);
		});

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

		selection.addEventListener('mousedown', (e) => {
			if (open) {
				hide();
				return;
			}

			const box = selection.getBoundingClientRect();
			let height;
			if (box.y > innerHeight / 2) {
				// top side has more space
				options.style.top = '';
				options.style.bottom = 'calc(1.4em - 1px)';
				height = box.y - 32;
				options.style.maxHeight = `${height}px`;
			} else {
				// bottom side has more space
				options.style.top = 'calc(1.4em - 1px)';
				options.style.bottom = '';
				height = innerHeight - box.y - 32;
				options.style.maxHeight = `calc(${height}px - 1.4em)`;
			}
			options.style.visibility = '';
			open = true;

			options.scroll(
				0,
				optionElements[selected].offsetTop + optionElements[selected].offsetHeight / 2 - height / 2,
			);

			if (docListener) return;
			docListener = (e) => {
				if (options.contains(e.target)) return;
				hide();
			};
			setTimeout(() => addEventListener('mousedown', docListener));
		});

		return dropdown;
	});

	const checkbox = (window.checkbox = (name, checked, onchange) => {
		const container = document.getElementById('checkbox').content.cloneNode(true);
		const checkbox = container.querySelector('.checkbox');
		const check = checkbox.querySelector('.check');
		const label = checkbox.querySelector('.label');

		label.innerHTML = name;
		if (name === '') {
			checkbox.style.padding = '0';
			label.remove();
		}

		checkbox.set = (newChecked, silent) => {
			checked = newChecked;
			checkbox.checked = checked;
			if (checked) checkbox.classList.add('checked');
			else checkbox.classList.remove('checked');
			if (!silent) onchange(checked);
		};

		checkbox.set(checked, true);
		checkbox.addEventListener('mousedown', () => checkbox.set(!checked));

		return checkbox;
	});

	const button = (window.button = (name, onchange) => {
		const button = document.createElement('button');
		button.innerHTML = name;
		button.addEventListener('mousedown', () => onchange());
		return button;
	});

	const hovery = (window.hovery = (html, onhover) => {
		const span = document.createElement('span');
		span.style.cssText =
			'background: #333; border: 1px solid #fff; color: #ccc; cursor: default; font-size: 0.9rem; padding: 0 3px;';
		span.innerHTML = html;
		span.addEventListener('mouseenter', () => {
			span.style.background = '#666';
			onhover(true);
		});
		span.addEventListener('mouseleave', () => {
			span.style.background = '#333';
			onhover(false);
		});
		return span;
	});

	// +---------------------------------------------------------------------------------------------------------------+
	// | Quick Data Display                                                                                            |
	// +---------------------------------------------------------------------------------------------------------------+

	const byteToChar = [];
	for (let i = 0; i < 0x20; ++i) byteToChar[i] = '.';
	for (let i = 0x20; i < 0x7f; ++i) byteToChar[i] = String.fromCharCode(i);
	for (let i = 0x7f; i < 0xa0; ++i) byteToChar[i] = '.';
	for (let i = 0xa0; i < 0x100; ++i) byteToChar[i] = String.fromCharCode(i);
	const latin1 = (window.latin1 = (o, l, dat = file) => {
		let end;
		if (l !== undefined) {
			end = o + l;
		} else {
			end = o;
			while (dat.getUint8(end)) ++end;
		}

		const u8 = bufToU8(sliceDataView(dat, o, Math.min(end, dat.byteLength)));
		const arr = new Array(u8.length);
		for (let i = 0; i < u8.length; ++i) arr[i] = byteToChar[u8[i]];
		return arr.join('');
	});

	const byteToHex = [];
	for (let i = 0; i < 256; ++i) byteToHex[i] = i.toString(16).padStart(2, '0');
	const bytes = (window.bytes = (o, l, buf = file) => {
		const slice = new Uint8Array(
			buf.buffer.slice(Math.max(buf.byteOffset + o, 0), buf.byteOffset + Math.min(o + l, buf.byteLength)),
		);
		const arr = new Array(slice.length);
		for (let i = 0; i < slice.length; ++i) arr[i] = byteToHex[slice[i]];
		return arr.join(' ');
	});

	const bits = (window.bits = (o, l, buf = file) => {
		const slice = buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + l);
		return Array.from(new Uint8Array(slice))
			.map((x) => x.toString(2).padStart(8, '0'))
			.join(' ');
	});

	const sanitize = (window.sanitize = (s) => s.replaceAll('<', '&lt;').replaceAll('>', '&gt;'));

	const addHTML = (window.addHTML = (el, html) => {
		const container = document.createElement(el.tagName); // tables do a *lot* of weird stuff without this
		container.innerHTML = html;
		// make a copy of childNodes first; it will end up empty
		for (const child of Array.from(container.childNodes)) el.append(child);
	});

	const writeRgb16 = (window.writeRgb16 = (bitmap, pixel, rgb16) => {
		const r = rgb16 & 0x1f;
		const g = (rgb16 >> 5) & 0x1f;
		const b = (rgb16 >> 10) & 0x1f;
		bitmap[pixel * 4] = (r << 3) | (r >> 2);
		bitmap[pixel * 4 + 1] = (g << 3) | (g >> 2);
		bitmap[pixel * 4 + 2] = (b << 3) | (b >> 2);
		bitmap[pixel * 4 + 3] = 255;
	});

	const str8 = (window.str8 = (x) => x.toString(16).padStart(2, '0'));
	const str16 = (window.str16 = (x) => x.toString(16).padStart(4, '0'));
	const str32 = (window.str32 = (x) => x.toString(16).padStart(8, '0'));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Algorithms                                                                                                    |
	// +---------------------------------------------------------------------------------------------------------------+

	if (!window.initAlgorithms) await waitFor(() => window.initAlgorithms);
	window.initAlgorithms();

	// +---------------------------------------------------------------------------------------------------------------+
	// | Misc                                                                                                          |
	// +---------------------------------------------------------------------------------------------------------------+

	const unpackSegmented = (window.unpackSegmented = (dat) => {
		if (dat.byteLength < 4) return [];
		const offsetsEnd = dat.getUint32(0, true);
		let lastSplit = offsetsEnd;
		const segments = [];
		for (let o = 4; o < offsetsEnd; o += 4) {
			const split = dat.getUint32(o, true);
			if (lastSplit >= dat.byteLength) segments.push(sliceDataView(dat, 0, 0));
			else segments.push(sliceDataView(dat, lastSplit, split));
			lastSplit = split;
		}

		segments.push(sliceDataView(dat, lastSplit, dat.byteLength));
		return segments;
	});

	const unpackSegmented16 = (window.unpackSegmented16 = (dat) => {
		if (dat.byteLength < 2) return [];
		const offsetsEnd = dat.getUint16(0, true);
		let lastSplit = offsetsEnd;
		const segments = [];
		for (let i = 1; i < offsetsEnd; ++i) {
			const split = dat.getUint16(i * 2, true);
			segments.push(sliceDataView(dat, lastSplit * 2, split * 2));
			lastSplit = split;
		}

		segments.push(sliceDataView(dat, lastSplit * 2, dat.byteLength));
		return segments;
	});

	const unpackSegmentedUnsorted = (window.unpackSegmentedUnsorted = (dat, o = 0) => {
		let min = Infinity;
		const offsets = [];
		for (; o < dat.byteLength && o < min; o += 4) {
			const offset = dat.getUint32(o, true);
			offsets.push({ offset });
			if (offset < min) min = offset;
		}

		const offsetsSorted = [...offsets];
		offsetsSorted.sort(({ offset: a }, { offset: b }) => a - b);
		for (let i = 0; i < offsetsSorted.length; ++i) {
			offsetsSorted[i].until = offsetsSorted[i + 1]?.offset ?? dat.byteLength;
		}

		const segments = [];
		for (const { offset, until } of offsets) {
			segments.push(sliceDataView(dat, offset, until));
		}

		return segments;
	});

	const sliceDataView = (dat, start, end) => new DataView(dat.buffer, dat.byteOffset + start, end - start);
	const bufToU8 = (buf, off = buf.byteOffset, len = buf.byteLength) => new Uint8Array(buf.buffer, off, len);
	const bufToU8Clamped = (buf, off = buf.byteOffset, len = buf.byteLength) =>
		new Uint8ClampedArray(buf.buffer, off, len);
	const bufToU16 = (buf, off = buf.byteOffset, len = buf.byteLength >> 1) => new Uint16Array(buf.buffer, off, len);
	const bufToS16 = (buf, off = buf.byteOffset, len = buf.byteLength >> 1) => new Int16Array(buf.buffer, off, len);
	const bufToU32 = (buf, off = buf.byteOffset, len = buf.byteLength >> 2) => new Uint32Array(buf.buffer, off, len);
	const bufToDat = (buf, off = buf.byteOffset, len = buf.byteLength) => new DataView(buf.buffer, off, len);
	Object.assign(window, { sliceDataView, bufToU8, bufToU8Clamped, bufToU16, bufToS16, bufToU32, bufToDat });

	const download = (window.download = (name, dat, mime = 'application/octet-stream') => {
		const blob = new Blob([dat], { type: mime });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = name;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000); // idk if a timeout is really necessary
	});

	const readMessage = (window.readMessage = (o, dat, ignoreSpecials) => {
		const u8 = bufToU8(dat);
		const s = [];
		for (; o < u8.length; ) {
			const byte = u8[o++];
			if (byte === 0xff) {
				const next = u8[o++];
				if (next === 0) s.push('\n');
				else if (ignoreSpecials) s.push(' ');
				else s.push(`<${str8(next)}>`);
			} else if (byte <= 0x1f || byte >= 0xfa || byte === 0x7f) {
				// special symbol
				if (ignoreSpecials) s.push(' ');
				else s.push(`(${str8(byte)})`);
			} else if (byte === 0x85) {
				s.push('…');
			} else {
				// assume latin1
				s.push(String.fromCharCode(byte));
			}
		}

		return s.join('');
	});

	const createSection = (window.createSection = (title, cb) => {
		const section = document.createElement('section');
		const reveal = document.createElement('div');
		reveal.className = 'reveal';
		reveal.innerHTML = `<code>[-]</code> ${title}`;
		section.appendChild(reveal);

		const content = document.createElement('div');
		content.className = 'content';
		section.appendChild(content);

		let visible = true;
		const toggleVisible = (newVisible) => {
			if (newVisible === visible) return;
			visible = newVisible;
			settings[`section.${title}.visible`] = visible;
			localStorage.setItem('settings', JSON.stringify(settings));

			content.style.display = visible ? '' : 'none';
			reveal.innerHTML = `<code>${visible ? '[-]' : '[+]'}</code> ${title}`;

			section.style.height = visible ? '' : '32px';
		};
		reveal.addEventListener('mousedown', (e) => {
			if (e.button === 0) toggleVisible(!visible);
		});
		toggleVisible(settings[`section.${title}.visible`] ?? true);

		let result;
		try {
			result = cb(content);
		} catch (err) {
			console.error(err);
			addHTML(
				content,
				`<span style="color: #f99;">${sanitize(err.name)}: ${sanitize(err.message)}<br>
				${sanitize(err.stack).replaceAll('\n', '<br>')}</span>`,
			);
		}

		if (content.children.length) document.body.appendChild(section);
		return result;
	});

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: ROM Headers                                                                                          |
	// +---------------------------------------------------------------------------------------------------------------+

	const headers = (window.headers = createSection('ROM Headers', (section) => {
		const fields = [];
		const headers = {};

		headers.title = sanitize(latin1(0, 12));
		headers.gamecode = sanitize(latin1(12, 4));
		fields.push(['Title', `${headers.title} (${headers.gamecode})`]);
		document.title = `(${headers.gamecode}) MLBIS Dumper`;

		headers.arm9offset = file.getUint32(0x20, true);
		headers.arm9entry = file.getUint32(0x24, true);
		headers.arm9ram = file.getUint32(0x28, true);
		headers.arm9size = file.getUint32(0x2c, true);
		fields.push([
			'ARM9',
			`0x${str32(headers.arm9offset)}, len 0x${headers.arm9size.toString(16)},
				ram 0x${headers.arm9ram.toString(16)}, entry 0x${headers.arm9entry.toString(16)}`,
		]);

		headers.arm7offset = file.getUint32(0x30, true);
		headers.arm7entry = file.getUint32(0x34, true);
		headers.arm7ram = file.getUint32(0x38, true);
		headers.arm7size = file.getUint32(0x3c, true);
		fields.push([
			'ARM7',
			`0x${str32(headers.arm7offset)}, len 0x${headers.arm7size.toString(16)},
				ram 0x${headers.arm7ram.toString(16)}, entry 0x${headers.arm7entry.toString(16)}`,
		]);

		headers.fntOffset = file.getUint32(0x40, true);
		headers.fntLength = file.getUint32(0x44, true);
		fields.push(['FNT', `0x${str32(headers.fntOffset)}, len 0x${headers.fntLength.toString(16)}`]);

		headers.fatOffset = file.getUint32(0x48, true);
		headers.fatLength = file.getUint32(0x4c, true);
		fields.push(['FAT', `0x${str32(headers.fatOffset)}, len 0x${headers.fatLength.toString(16)}`]);

		headers.ov9Offset = file.getUint32(0x50, true);
		headers.ov9Size = file.getUint32(0x54, true);
		fields.push(['ARM9 Overlays', `0x${str32(headers.ov9Offset)}, len 0x${headers.ov9Size.toString(16)}`]);

		headers.ov7Offset = file.getUint32(0x58, true);
		headers.ov7Size = file.getUint32(0x5c, true);
		fields.push(['ARM7 Overlays', `0x${str32(headers.ov7Offset)}, len 0x${headers.ov7Size.toString(16)}`]);

		for (const [name, value] of fields) {
			addHTML(section, `<div><code>${name}: ${value}</code></div>`);
		}

		return headers;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: File System                                                                                          |
	// +---------------------------------------------------------------------------------------------------------------+

	const fs = (window.fs = createSection('File System', (section) => {
		const fs = new Map();

		fs.arm9 = sliceDataView(file, headers.arm9offset, headers.arm9offset + headers.arm9size);
		fs.arm7 = sliceDataView(file, headers.arm7offset, headers.arm7offset + headers.arm7size);

		// NA, EU, and KO versions compress initial arm9/arm7; no idea what in the header controls that
		let armInitCompressed = headers.gamecode === 'CLJE' || headers.gamecode === 'CLJP' || headers.gamecode === 'CLJK';
		if (armInitCompressed) {
			fs.arm9 = blz(fs.arm9);
			fs.arm7 = blz(fs.arm7);
		}

		const names = new Map();
		names.set(0xf000, ''); // so every fie path starts with '/'
		const parents = new Map();
		const numDirectories = file.getUint16(headers.fntOffset + 6, true);
		for (let i = 0; i < numDirectories; ++i) {
			let o = file.getUint32(headers.fntOffset + i * 8, true);
			let fileId = file.getUint16(headers.fntOffset + i * 8 + 4, true);

			while (true) {
				const composite = file.getUint8(headers.fntOffset + o++);
				if (!composite) break;

				const name = latin1(headers.fntOffset + o, composite & 0x7f);
				o += composite & 0x7f;
				let id;
				if (composite & 0x80) {
					id = file.getUint16(headers.fntOffset + o, true);
					o += 2;
				} else id = fileId++;
				names.set(id, name);
				parents.set(id, 0xf000 + i);
			}
		}

		const fileToOverlayId = (fs.fileToOverlayId = new Map());
		const overlayEntries = (fs.overlayEntries = new Map());
		for (let i = 0, o = headers.ov9Offset; i * 32 < headers.ov9Size; ++i, o += 32) {
			const segment = bufToU32(sliceDataView(file, o, o + 32));
			const [id, ramStart, ramSize, bssSize, staticStart, staticEnd, fileId, compressed] = segment;
			fileToOverlayId.set(fileId, id);
			overlayEntries.set(id, { id, ramStart, ramSize, bssSize, staticStart, staticEnd, fileId, compressed });
		}

		const overlayCache = new Map();
		fs.overlay = (id, noCache) => {
			const cached = overlayCache.get(id);
			if (cached) return cached;

			// no errors!
			const entry = overlayEntries.get(id);
			let dat = fs.get(entry.fileId);
			if (entry?.compressed) dat = blz(dat);
			if (dat && !noCache) overlayCache.set(id, Object.assign(dat, { entry }));
			return dat;
		};

		for (let i = 0, o = headers.fatOffset; i * 8 < headers.fatLength; ++i, o += 8) {
			const start = file.getUint32(o, true);
			const end = file.getUint32(o + 4, true);

			let name, path;
			const overlayId = fileToOverlayId.get(i);
			if (overlayId !== undefined) {
				const entry = overlayEntries.get(overlayId);
				name = `overlay${overlayId.toString().padStart(4, '0')}.bin`;
				path = `(overlay ${overlayId.toString().padStart(4, '0')}${entry.compressed ? ', compressed' : ''})`;
			} else {
				name = names.get(i);
				path = name;
				let parentId = parents.get(i);
				for (let j = 0; j < 100 && parentId !== undefined; ++j) {
					path = names.get(parentId) + '/' + path;
					parentId = parents.get(parentId);
				}
			}

			const obj = Object.assign(sliceDataView(file, start, end), { name, path, start, end });
			fs.set(i, obj);
			if (overlayId === undefined) fs.set(path, obj);
		}

		const singleExport = document.createElement('div');
		singleExport.textContent = 'File: ';
		section.appendChild(singleExport);

		const singleSelectEntries = [
			`ARM9 (len 0x${headers.arm9size.toString(16)}${armInitCompressed ? ', compressed' : ''})`,
			`ARM7 (len 0x${headers.arm7size.toString(16)}${armInitCompressed ? ', compressed' : ''})`,
		];
		for (let i = 0; i * 8 < headers.fatLength; ++i) {
			const { start, end, path } = fs.get(i);
			singleSelectEntries.push(`0x${str8(i)}. (len 0x${(end - start).toString(16)}) ${sanitize(path)}`);
		}
		const singleSelect = dropdown(singleSelectEntries, 0, () => {});
		singleExport.appendChild(singleSelect);

		const singleDecompression = dropdown(
			['No decompression', 'BLZ on compressed overlays only'],
			1,
			() => {},
			undefined,
			true,
		);
		singleExport.appendChild(singleDecompression);

		const singleDump = button('Dump', () => {
			if (singleSelect.value === 0) {
				singleOutput.textContent = '';
				if (singleDecompression.value === 0) {
					download('arm9.bin', sliceDataView(file, headers.arm9offset, headers.arm9offset + headers.arm9size));
				} else download('arm9.bin', fs.arm9);
				return;
			} else if (singleSelect.value === 1) {
				singleOutput.textContent = '';
				if (singleDecompression.value === 0) {
					download('arm7.bin', sliceDataView(file, headers.arm7offset, headers.arm7offset + headers.arm7size));
				} else download('arm7.bin', fs.arm7);
				return;
			}
			const fsentry = fs.get(singleSelect.value - 2);

			let output;
			if (singleDecompression.value === 0) output = fsentry;
			else {
				const overlayId = fileToOverlayId.get(singleSelect.value - 2);
				if (overlayId !== undefined) output = fs.overlay(overlayId, true);
				else output = fsentry;
			}

			if (!output) {
				singleOutput.textContent = '(Failed to decompress; only backwards LZSS is supported)';
				return;
			}

			singleOutput.textContent = '';
			download(fsentry.name, output);
		});
		singleExport.appendChild(singleDump);

		const singleOutput = document.createElement('span');
		singleExport.appendChild(singleOutput);

		const multiExport = document.createElement('div');
		multiExport.textContent = 'Everything: ';
		section.appendChild(multiExport);

		const multiDump = button('Dump Everything', () => {
			const files = [
				{ name: 'arm9.bin', dat: fs.arm9 },
				{ name: 'arm7.bin', dat: fs.arm7 },
			];

			for (let i = 0; i * 8 < headers.fatLength; ++i) {
				const fsentry = fs.get(i);
				const overlayId = fileToOverlayId.get(i);
				if (overlayId !== undefined) {
					const dat = fs.overlay(overlayId, true);
					const suffix = dat === fsentry ? '' : '-decomp';
					files.push({ name: `overlay${String(overlayId).padStart(4, '0')}${suffix}.bin`, dat });
				} else {
					files.push({ name: fsentry.name, dat: fsentry });
				}
			}
			download(`${headers.gamecode}.zip`, zipStore(files));
		});
		multiExport.appendChild(multiDump);

		addHTML(section, '<br>');

		const sorting = dropdown(['Sort by index', 'Sort by length'], 0, () => update(), undefined, true);
		section.appendChild(sorting);

		const listContainer = document.createElement('div');
		section.appendChild(listContainer);
		const update = () => {
			listContainer.innerHTML = '';
			const list = [];
			for (let i = 0; i * 8 < headers.fatLength; ++i) list.push([i, fs.get(i)]);

			if (sorting.value === 1) list.sort(([_, a], [__, b]) => a.end - a.start - (b.end - b.start));

			for (let i = 0; i < list.length; ++i) {
				const [index, { path, start, end }] = list[i];
				const lengthStr = (end - start).toString(16);
				addHTML(
					listContainer,
					`<div><code>0x${str8(index)}. 0x${str32(start)} - 0x${str32(end)} (len 0x${lengthStr})
						${'&nbsp;'.repeat(8 - lengthStr.length)} ${path}</code></div>`,
				);
			}
		};
		update();

		addHTML(section, '<br>');
		addHTML(section, '<div>Overlays in RAM:</div>');

		const overlayContainer = document.createElement('div');
		overlayContainer.style.cssText = 'overflow-x: auto; overflow-y: hidden;';
		section.appendChild(overlayContainer);

		let hovering = undefined;
		let selected = undefined;
		const overlayLines = [];
		const overlayEntry = (start, length, labelHtml) => {
			const line = document.createElement('div');
			line.style.cssText = 'height: 1.25em; position: relative;';
			overlayContainer.appendChild(line);

			const showOverlaps = () => {
				for (let i = 0; i < overlayLines.length; ++i) {
					const other = overlayLines[i];
					if (i === thisIndex) {
						other.block.style.background = '#333';
						other.block.style.borderColor = '#fff';
					} else if (start < other.start + other.length && other.start < start + length) {
						// check if ranges overlap (excluding the case when one starts where the other ends)
						other.block.style.background = '#311';
						other.block.style.borderColor = '#f66';
					} else {
						other.block.style.background = '#131';
						other.block.style.borderColor = '#6f6';
					}
				}
			};

			const hideOverlaps = () => {
				for (const { block } of overlayLines) {
					block.style.background = '#222';
					block.style.borderColor = '#ccc';
				}
			};

			const thisIndex = overlayLines.length;
			line.addEventListener('mouseenter', () => {
				if (selected !== thisIndex) line.style.background = '#fff2';
			});
			line.addEventListener('mouseleave', () => {
				if (selected !== thisIndex) line.style.background = '';
			});
			line.addEventListener('mousedown', () => {
				if (selected === thisIndex) {
					selected = undefined;
					line.style.background = '#fff2';

					if (hovering !== undefined) showOverlaps();
					else hideOverlaps();
				} else {
					if (selected !== undefined) overlayLines[selected].line.style.background = '';
					selected = thisIndex;
					line.style.background = '#fff4';
					showOverlaps();
				}
			});

			const label = document.createElement('div');
			label.style.cssText = 'position: absolute;';
			label.innerHTML = labelHtml;
			line.appendChild(label);

			const block = document.createElement('div');
			block.style.cssText = `background: #222; border: 1px solid #ccc; position: absolute;
				left: calc(20em + ${Math.ceil(((start - 0x2000000) / 0x400000) * 800)}px);
				width: ${Math.ceil((length / 0x400000) * 800)}px; height: 100%;`;
			line.appendChild(block);

			overlayLines.push({ line, block, label, start, length });
			if (overlayLines.length % 4 === 0) {
				addHTML(overlayContainer, `<div style="height: 1px; width: 100%; background: #333;"></div>`);
			}
		};
		overlayEntry(
			headers.arm9ram,
			fs.arm9.byteLength,
			`<code>ARM9. 0x${str32(headers.arm9ram)} - 0x${str32(headers.arm9ram + fs.arm9.byteLength)}</code>`,
		);
		overlayEntry(
			headers.arm7ram,
			fs.arm7.byteLength,
			`<code>ARM7. 0x${str32(headers.arm7ram)} - 0x${str32(headers.arm7ram + fs.arm7.byteLength)}</code>`,
		);
		const ovtEntry = (o) => {
			const id = file.getUint32(o, true);
			const ramStart = file.getUint32(o + 4, true);
			const ramSize = file.getUint32(o + 8, true);
			const bssSize = file.getUint32(o + 12, true);
			const staticStart = file.getUint32(o + 16, true);
			const staticEnd = file.getUint32(o + 20, true);
			const fileId = file.getUint32(o + 24, true);
			const attributes = file.getUint32(o + 28, true);

			overlayEntry(
				ramStart,
				ramSize,
				`<code>${id.toString().padStart(4, '0')}. 0x${str32(ramStart)} - 0x${str32(ramStart + ramSize)}</code>`,
			);
		};
		for (let i = 0, o = headers.ov9Offset; o < headers.ov9Offset + headers.ov9Size; ++i, o += 0x20) ovtEntry(o);
		for (let o = 0; o < headers.ov7Size; o += 0x20) ovtEntry(o);

		return fs;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: File System (Extended)                                                                               |
	// +---------------------------------------------------------------------------------------------------------------+

	const fsext = (window.fsext = createSection('File System (Extended)', (section) => {
		const fsext = {};

		const varLengthSegments = (fsext.varLengthSegments = (start, dat, segmentsDat) => {
			const chunkLength = dat.getUint32(start, true);
			const offsets = [];
			const segments = [];
			for (let o = 4; o < chunkLength; o += 4) {
				offsets.push(dat.getInt32(start + o, true));
				if (!segmentsDat || offsets.length < 2) continue;
				segments.push(sliceDataView(segmentsDat, offsets[offsets.length - 2], offsets[offsets.length - 1]));
			}

			if (segmentsDat)
				segments.push(sliceDataView(segmentsDat, offsets[offsets.length - 1], segmentsDat.byteLength));

			return { offsets, segments };
		});

		const fixedIndices = (fsext.fixedIndices = (o, end, dat) => {
			const indices = [];
			for (; o < end; o += 4) indices.push(dat.getInt32(o, true));
			return indices;
		});

		const fixedSegments = (fsext.fixedSegments = (o, end, size, dat) => {
			const segments = [];
			for (; o < end; o += size) segments.push(sliceDataView(dat, o, o + size));
			return segments;
		});

		// i'm not sure how these file structures work, but this should cover all versions of MLBIS
		// you can find these offsets yourself by going through overlay 0x03, which has lists of increasing
		// pointers into each file. these pointers stop right before the end of the file length, so it's easy to tell
		// which pointer list belongs to which file
		// (for example, in NA /FMap/FMapData.dat has length 0x1a84600 and the last pointer is 0x1a84530)
		if (headers.gamecode === 'CLJE') {
			// NA/AU
			// two more tables of chunk length 0xc, that i can't be bothered to try and guess
			fsext.bofxtex = varLengthSegments(0x7c90, fs.overlay(14), fs.get('/BRfx/BOfxTex.dat')); // tile data is probably right next to it, again
			fsext.bofxpal = varLengthSegments(0x7ca8, fs.overlay(14), fs.get('/BRfx/BOfxPal.dat')); // seems like palette data
			fsext.bmapg = varLengthSegments(0x7cc0, fs.overlay(14), fs.get('/BMapG/BMapG.dat'));
			fsext.bdfxtex = varLengthSegments(0x7cd8, fs.overlay(14), fs.get('/BRfx/BDfxTex.dat')); // might be BDfxGAll.dat instead
			fsext.bdfxpal = varLengthSegments(0x7d0c, fs.overlay(14), fs.get('/BRfx/BDfxPal.dat')); // all segments seem to be 514 in length, so probably palettes
			fsext.bai_atk_yy = varLengthSegments(0x7d40, fs.overlay(14), fs.get('/BAI/BAI_atk_yy.dat'));
			fsext.bai_mon_cf = varLengthSegments(0x7d7c, fs.overlay(14), fs.get('/BAI/BAI_mon_cf.dat'));
			fsext.bai_mon_yo = varLengthSegments(0x8210, fs.overlay(14), fs.get('/BAI/BAI_mon_yo.dat'));
			fsext.bai_scn_ji = varLengthSegments(0x82a4, fs.overlay(14), fs.get('/BAI/BAI_scn_ji.dat'));
			fsext.bai_atk_nh = varLengthSegments(0x834c, fs.overlay(14), fs.get('/BAI/BAI_atk_nh.dat'));
			fsext.bai_mon_ji = varLengthSegments(0x8480, fs.overlay(14), fs.get('/BAI/BAI_mon_ji.dat'));
			fsext.bobjmap = varLengthSegments(0x859c, fs.overlay(14));
			fsext.bai_atk_hk = varLengthSegments(0x875c, fs.overlay(14), fs.get('/BAI/BAI_atk_hk.dat'));
			fsext.bai_scn_yo = varLengthSegments(0x8998, fs.overlay(14), fs.get('/BAI/BAI_scn_yo.dat'));
			fsext.bobjpc = varLengthSegments(0x8c1c, fs.overlay(14));
			fsext.bobjui = varLengthSegments(0x91c0, fs.overlay(14));
			fsext.bobjmon = varLengthSegments(0x9c18, fs.overlay(14));

			fsext.fevent = varLengthSegments(0xc8ac, fs.overlay(3), fs.get('/FEvent/FEvent.dat'));
			fsext.fmapdata = varLengthSegments(0x11310, fs.overlay(3), fs.get('/FMap/FMapData.dat'));
			fsext.fobj = varLengthSegments(0xe8a0, fs.overlay(3), fs.get('/FObj/FObj.dat'));
			fsext.fobjmon = varLengthSegments(0xba3c, fs.overlay(3));
			fsext.fobjpc = varLengthSegments(0xbdb0, fs.overlay(3));
			fsext.fpaf = varLengthSegments(0xb8a0, fs.overlay(3), fs.get('/FPaf/FPaf.dat'));

			fsext.fieldAnimeIndices = fixedIndices(0x18e84, 0x19fd0, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0x19fd0, 0x1d504, fs.overlay(3));
			fsext.fmapmetadata = fixedSegments(0x98a0, 0x98a0 + 12 * 0x2a9, 12, fs.overlay(3));
			fsext.fobjPalettes = fixedSegments(0x150c8, 0x15854, 4, fs.overlay(3));

			fsext.font = sliceDataView(fs.arm9, 0x43d3c, 0x464cc);
		} else if (headers.gamecode === 'CLJK') {
			// KO
			fsext.fevent = varLengthSegments(0xc8ac, fs.overlay(3));
			fsext.fmapdata = varLengthSegments(0x11310, fs.overlay(3), fs.get('/FMap/FMapData.dat'));
			fsext.fobj = varLengthSegments(0xe8a0, fs.overlay(3), fs.get('/FObj/FObj.dat'));
			fsext.fobjmon = varLengthSegments(0xba3c, fs.overlay(3));
			fsext.fobjpc = varLengthSegments(0xbdb0, fs.overlay(3));
			fsext.fpaf = varLengthSegments(0xb8a0, fs.overlay(3), fs.get('/FPaf/FPaf.dat'));
			fsext.fmapmetadata = fixedSegments(0x98a0, 0x98a0 + 12 * 0x2a9, 12, fs.overlay(3));
			fsext.fieldAnimeIndices = fixedIndices(0x18e84, 0x19fd0, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0x19fd0, 0x1d504, fs.overlay(3));

			fsext.font = sliceDataView(fs.arm9, 0x43d90, 0x462d8);
		} else if (headers.gamecode === 'CLJJ') {
			// JP
			fsext.fevent = varLengthSegments(0xcb18, fs.overlay(3));
			fsext.fmapdata = varLengthSegments(0x11544, fs.overlay(3), fs.get('/FMap/FMapData.dat'));
			fsext.fobj = varLengthSegments(0xeb0c, fs.overlay(3), fs.get('/FObj/FObj.dat'));
			fsext.fobjmon = varLengthSegments(0xbca8, fs.overlay(3));
			fsext.fobjpc = varLengthSegments(0xc01c, fs.overlay(3));
			fsext.fpaf = varLengthSegments(0xbb0c, fs.overlay(3), fs.get('/FPaf/FPaf.dat'));
			fsext.fmapmetadata = fixedSegments(0x9b00, 0x9b00 + 12 * 0x2a9, 12, fs.overlay(3));
			fsext.fieldAnimeIndices = fixedIndices(0x19710, 0x1a85c, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0x1a85c, 0x1dd90, fs.overlay(3));
		} else if (headers.gamecode === 'CLJP') {
			// EU
			fsext.fevent = varLengthSegments(0xc8ac, fs.overlay(3));
			fsext.fmapdata = varLengthSegments(0x11310, fs.overlay(3), fs.get('/FMap/FMapData.dat'));
			fsext.fobj = varLengthSegments(0xe8a0, fs.overlay(3), fs.get('/FObj/FObj.dat'));
			fsext.fobjmon = varLengthSegments(0xba3c, fs.overlay(3));
			fsext.fobjpc = varLengthSegments(0xbdb0, fs.overlay(3));
			fsext.fpaf = varLengthSegments(0xb8a0, fs.overlay(3), fs.get('/FPaf/FPaf.dat'));
			fsext.fmapmetadata = fixedSegments(0x98a0, 0x98a0 + 12 * 0x2a9, 12, fs.overlay(3));
			fsext.fieldAnimeIndices = fixedIndices(0x18e84, 0x19fd0, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0x19fd0, 0x1d504, fs.overlay(3));

			fsext.font = sliceDataView(fs.arm9, 0x43d3c, 0x464cc);
		} else if (headers.gamecode === 'Y6PP') {
			// EU Demo
			fsext.fevent = varLengthSegments(0x94c8, fs.overlay(3));
			fsext.fmapdata = varLengthSegments(0x9a3c, fs.overlay(3), fs.get('/FMap/FMapData.dat'));
			fsext.fobj = varLengthSegments(0x9cb0, fs.overlay(3), fs.get('/FObj/FObj.dat'));
			fsext.fobjmon = varLengthSegments(0x945c, fs.overlay(3));
			fsext.fobjpc = varLengthSegments(0x97f8, fs.overlay(3));
			fsext.fpaf = varLengthSegments(0x965c, fs.overlay(3), fs.get('/FPaf/FPaf.dat'));
			fsext.fmapmetadata = fixedSegments(0x92bc, 0x92bc + 12 * 0x21, 12, fs.overlay(3));
			fsext.fieldAnimeIndices = fixedIndices(0xe220, 0xe318, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0xe498, 0xe72c, fs.overlay(3));

			fsext.font = sliceDataView(fs.arm9, 0x406d0, 0x42e60);
		} else if (headers.gamecode === 'Y6PE') {
			// NA Demo
			fsext.fevent = varLengthSegments(0x94c8, fs.overlay(3));
			fsext.fmapdata = varLengthSegments(0x9a3c, fs.overlay(3), fs.get('/FMap/FMapData.dat'));
			fsext.fobj = varLengthSegments(0x9cb0, fs.overlay(3), fs.get('/FObj/FObj.dat'));
			fsext.fobjmon = varLengthSegments(0x945c, fs.overlay(3));
			fsext.fobjpc = varLengthSegments(0x97f8, fs.overlay(3));
			fsext.fpaf = varLengthSegments(0x965c, fs.overlay(3), fs.get('/FPaf/FPaf.dat'));
			fsext.fmapmetadata = fixedSegments(0x92bc, 0x92bc + 12 * 0x21, 12, fs.overlay(3));
			fsext.fieldAnimeIndices = fixedIndices(0xe164, 0xe25c, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0xe3dc, 0xe670, fs.overlay(3));

			fsext.font = sliceDataView(fs.arm9, 0x4071c, 0x42cc8);
		} else {
			addHTML(section, `<b style="color: #f99">Unknown gamecode ${headers.gamecode}</b>`);
		}

		return fsext;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Field Palette Animations                                                                             |
	// +---------------------------------------------------------------------------------------------------------------+

	const fpaf = (window.fpaf = createSection('Field Palette Animations', (section) => {
		const fpaf = {};

		const table = document.createElement('table');
		table.style.cssText = 'border-collapse: collapse;';
		section.appendChild(table);

		fpaf.apply = (palette, segments, tick) => {
			if (!segments.length) return;

			const segment = bufToS16(segments[0]); // other segments appear to be ignored
			let o = 0;
			const totalLength = segment[o++];
			while (o < segment.length) {
				let blendMode,
					paletteStart,
					paletteLength,
					red = 0,
					green = 0,
					blue = 0;
				let keyframe,
					keyframeDistance,
					keyframes = 0,
					percent = 0;

				let relativeTick = tick % totalLength;

				commandLoop: while (o < segment.length) {
					const command = segment[o] & 0xff;
					const params = segment[o++] >> 8;

					// these are listed in the order they come in by default, but you can rearrange things
					if (command === 0x82)
						++o; // unknown, always zero
					else if (command === 0x00)
						paletteStart = segment[o++]; // (source)
					else if (command === 0x01) paletteLength = segment[o++];
					else if (command === 0x02)
						++o; // paletteTo (destination)
					else if (command === 0x83)
						++o; // color keyframe lengths (TODO)
					else if (command === 0x1c)
						red = segment[o++] & 0x1f; // 0x00 - 0x1f
					else if (command === 0x1d)
						green = segment[o++] & 0x1f; // 0x00 - 0x1f
					else if (command === 0x1e)
						blue = segment[o++] & 0x1f; // 0x00 - 0x1f
					else if (4 <= command && command <= 0xa) {
						// TODO: are there more?
						// keyframe lengths
						blendMode = command;
						let startTick = 0;
						keyframes = params / 2 + 1;
						for (let i = 0; i < keyframes; ++i) {
							const length = segment[o++];
							if (relativeTick < length && keyframe === undefined) {
								keyframe = i;
								keyframeDistance = relativeTick / length;
							}
							relativeTick -= length;
						}
					} else if (command === 0x1f) {
						// keyframe values (0 - 100)
						let from = 0,
							to = 0;
						if (keyframe !== undefined) {
							from = keyframe === 0 ? 0 : segment[o + keyframe - 1];
							to = segment[o + keyframe];
							percent = Math.min(100, from + (to - from) * keyframeDistance);
						}
						o += keyframes;
						break commandLoop;
					} else {
						throw `unknown command 0x${str8(command)} params 0x${str8(params)}`;
					}
				}

				// apply to palette
				if (blendMode === 4) {
					// palette rotate
					const old = new Uint32Array(paletteLength);
					old.set(palette.slice(paletteStart, paletteStart + paletteLength), 0);
					for (let j = 0; j < paletteLength; ++j) {
						palette[paletteStart + j] = old[(j + ~~((percent / 100) * paletteLength)) % paletteLength];
					}
				} else if (blendMode === 5) {
					// set
					for (let j = paletteStart; j < paletteStart + paletteLength; ++j) {
						const r = ((palette[j] & 0xf8) * (100 - percent)) / 100 + ((red << 3) * percent) / 100;
						const g = (((palette[j] >> 8) & 0xf8) * (100 - percent)) / 100 + ((green << 3) * percent) / 100;
						const b = (((palette[j] >> 16) & 0xf8) * (100 - percent)) / 100 + ((blue << 3) * percent) / 100;
						palette[j] = (0xff << 24) | (b << 16) | (g << 8) | r;
					}
				} else if (blendMode === 6) {
					// additive
					for (let j = paletteStart; j < paletteStart + paletteLength; ++j) {
						const r = Math.min(0xf8, (palette[j] & 0xf8) + ((red << 3) * percent) / 100);
						const g = Math.min(0xf8, ((palette[j] >> 8) & 0xf8) + ((green << 3) * percent) / 100);
						const b = Math.min(0xf8, ((palette[j] >> 16) & 0xf8) + ((blue << 3) * percent) / 100);
						palette[j] = (0xff << 24) | (b << 16) | (g << 8) | r;
					}
				} else if (blendMode === 7) {
					// subtractive
					for (let j = paletteStart; j < paletteStart + paletteLength; ++j) {
						const r = Math.max(0, (palette[j] & 0xf8) - ((red << 3) * percent) / 100);
						const g = Math.max(0, ((palette[j] >> 8) & 0xf8) - ((green << 3) * percent) / 100);
						const b = Math.max(0, ((palette[j] >> 16) & 0xf8) - ((blue << 3) * percent) / 100);
						palette[j] = (0xff << 24) | (b << 16) | (g << 8) | r;
					}
				} else if (blendMode === 8) {
					// set dimmed (not really sure why this exists)
					for (let j = paletteStart; j < paletteStart + paletteLength; ++j) {
						const r =
							((palette[j] & 0xf8) * (100 - percent)) / 100 +
							((((red / 0x1f) * 0x16) << 3) * percent) / 100;
						const g =
							(((palette[j] >> 8) & 0xf8) * (100 - percent)) / 100 +
							((((green / 0x1f) * 0x16) << 3) * percent) / 100;
						const b =
							(((palette[j] >> 16) & 0xf8) * (100 - percent)) / 100 +
							((((blue / 0x1f) * 0x16) << 3) * percent) / 100;
						palette[j] = (0xff << 24) | (b << 16) | (g << 8) | r;
					}
				} else if (blendMode === 9) {
					// invert
					for (let j = paletteStart; j < paletteStart + paletteLength; ++j) {
						let r = palette[j] & 0xf8;
						let g = (palette[j] >> 8) & 0xf8;
						let b = (palette[j] >> 16) & 0xf8;
						r += ((0xf8 - r * 2) * percent) / 100;
						g += ((0xf8 - g * 2) * percent) / 100;
						b += ((0xf8 - b * 2) * percent) / 100;
						palette[j] = (0xff << 24) | (b << 16) | (g << 8) | r;
					}
				}
			}

			// make RGB15 brighter (so 0x1f in 5-bit corresponds to 0xff in 8-bit)
			for (let i = 0; i < 256; ++i) {
				palette[i] &= 0xfff8f8f8;
				palette[i] |= (palette[i] >> 5) & 0x070707;
			}
		};

		fpaf.stringify = (segments) => {
			if (!segments.length) return [];
			const segment = bufToU16(segments[0]);
			let o = 0;
			const totalLength = segment[o++];
			const strings = [`(totalLength ${totalLength})`];
			while (o < segment.length) {
				let parts = [];

				let colors = 0;
				let keyframes = 0;
				commandLoop: while (o < segment.length) {
					const command = segment[o] & 0xff;
					const params = segment[o++] >> 8;
					const commandStr = params ? str16(command | (params << 8)) : str8(command);

					if (command === 0x82) {
						(parts.push(`(palette 0x${str16(segment[o++])})`), (o += params));
					} else if (command === 0x00) {
						parts.push(`(palFrom 0x${str8(segment[o++])})`);
					} else if (command === 0x01) {
						parts.push(`(palLen 0x${str8(segment[o++])})`);
					} else if (command === 0x02) {
						parts.push(`(palTo 0x${str8(segment[o++])})`);
					} else if (command === 0x83) {
						const unknown = [];
						colors = params / 2 + 1;
						for (let i = 0; i < colors; ++i) unknown.push(segment[o++]);
						parts.push(`(color lengths ${unknown.join(' ')})`);
					} else if (command === 0x1c) {
						const reds = [];
						for (let i = 0; i < colors; ++i) reds.push('0x' + str8(segment[o++]));
						parts.push(`(red${params ? '[' + params + ']' : ''} ${reds.join(' ')})`);
					} else if (command === 0x1d) {
						const greens = [];
						for (let i = 0; i < colors; ++i) greens.push('0x' + str8(segment[o++]));
						parts.push(`(green${params ? '[' + params + ']' : ''} ${greens.join(' ')})`);
					} else if (command === 0x1e) {
						const blues = [];
						for (let i = 0; i < colors; ++i) blues.push('0x' + str8(segment[o++]));
						parts.push(`(blue${params ? '[' + params + ']' : ''} ${blues.join(' ')})`);
					} else if (4 <= command && command <= 0xa) {
						const mode =
							['ROTATE', 'SET', 'ADD', 'SUB', 'SET_DIMMED', 'INVERT'][command - 4] ??
							'0x' + str8(command);
						const lengths = [];
						keyframes = params / 2 + 1;
						for (let i = 0; i < keyframes; ++i) lengths.push(segment[o++]);
						parts.push(`(${mode} lengths ${lengths.join(' ')})`);
					} else if (command === 0x1f || command === 0x1b) {
						const percents = [];
						for (let i = 0; i < keyframes; ++i) percents.push(segment[o++] + '%');
						parts.push(`(values[${params}] ${percents.join(' ')})`);
						break commandLoop;
					} else {
						parts.push(`(0x${commandStr} 0x${str16(segment[o++] ?? 0)})`);
						console.warn(`unknown command 0x${commandStr}`);
					}
				}

				strings.push(
					parts.map((s, i) => `<span style="color: ${i % 2 ? '#777' : '#999'};">${s}</span>`).join(' '),
				);
			}

			return strings;
		};

		for (let i = 0; i < fsext.fpaf.segments.length - 1; ++i) {
			const s = unpackSegmented16(fsext.fpaf.segments[i]);
			addHTML(
				table,
				`<tr style="${i < fsext.fpaf.segments.length - 2 ? 'border-bottom: 1px solid #666;' : ''}">
			<td><code>${i}</code></td>
			<td style="padding: 10px 0;"><ul>${fpaf
				.stringify(s)
				.map((x) => '<li><code>' + x + '</code></li>')
				.join('')}</ul></td>
		</tr>`,
			);
		}

		return fpaf;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Field Maps                                                                                           |
	// +---------------------------------------------------------------------------------------------------------------+

	if (!window.initField) await waitFor(() => window.initField);
	window.initField();

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: FMapData Tile Viewer                                                                                 |
	// +---------------------------------------------------------------------------------------------------------------+

	const fmapdataTiles = (window.fmapdataTiles = createSection('FMapData Tile Viewer', (section) => {
		const fmapdataTiles = {};
		const fieldFile = fs.get('/FMap/FMapData.dat');

		const options = [];
		for (let i = 0; i < fsext.fieldAnimeIndices[0]; ++i) options.push(`FMapData ${i.toString(16)}`);
		for (let i = 0; i < fsext.fieldAnimeIndices.length; ++i)
			options.push(`FMapData ${fsext.fieldAnimeIndices[i].toString(16)} (Anime ${i.toString(16)})`);
		const select = dropdown(options, 0, () => update());

		section.appendChild(select);

		const dump = document.createElement('button');
		dump.textContent = 'Dump';
		dump.addEventListener('click', () => {
			const index = select.value;
			const data = lzBis(fsext.fmapdata.segments[index]);
			download(`FMapData-${index.toString(16)}.bin`, data.buffer);
		});
		section.appendChild(dump);

		// generate a rainbow color palette, with later values using darker colors (0 - 0xf instead of 0 - 0x1f)
		const globalPalette256 = (fmapdataTiles.globalPalette256 = new DataView(new ArrayBuffer(512)));
		for (let i = 0; i < 32; ++i) globalPalette256.setUint16(i * 2, (0x1f << 10) | (i << 5) | 0, true);
		for (let i = 31; i >= 0; --i) globalPalette256.setUint16(0x40 + i * 2, (i << 10) | (0x1f << 5) | 0, true);
		for (let i = 0; i < 32; ++i) globalPalette256.setUint16(0x80 + i * 2, (0 << 10) | (0x1f << 5) | i, true);
		for (let i = 31; i >= 0; --i) globalPalette256.setUint16(0xc0 + i * 2, (0 << 10) | (i << 5) | 0x1f, true);
		for (let i = 0; i < 32; ++i) globalPalette256.setUint16(0x100 + i * 2, (i << 10) | (0 << 5) | 0x1f, true);
		for (let i = 31; i >= 0; --i) globalPalette256.setUint16(0x140 + i * 2, (0x1f << 10) | (0 << 5) | i, true);
		for (let i = 0; i < 16; ++i) globalPalette256.setUint16(0x180 + i * 2, (0xf << 10) | (i << 5) | 0, true);
		for (let i = 15; i >= 0; --i) globalPalette256.setUint16(0x1a0 + i * 2, (i << 10) | (0xf << 5) | 0, true);
		for (let i = 0; i < 16; ++i) globalPalette256.setUint16(0x1c0 + i * 2, 0 | (0xf << 5) | i, true);
		for (let i = 15; i >= 0; --i) globalPalette256.setUint16(0x1e0 + i * 2, 0 | (i << 5) | 0xf, true);

		const globalPalette16 = (fmapdataTiles.globalPalette16 = new DataView(new ArrayBuffer(512)));
		const rgb15s = [
			[31, 0, 0],
			[31, 10, 0],
			[31, 20, 0],
			[31, 31, 0],
			[20, 31, 0],
			[10, 31, 0],
			[0, 31, 0],
			[0, 31, 10],
			[0, 31, 20],
			[0, 31, 31],
			[0, 20, 31],
			[0, 10, 31],
			[0, 0, 31],
			[10, 0, 31],
			[20, 0, 31],
			[31, 0, 31],
		];
		for (let i = 0; i < 16; ++i) {
			const [b, g, r] = rgb15s[i];
			const rgb15 = (r << 10) | (g << 5) | b;
			for (let o = 0; o < 512; o += 32) globalPalette16.setUint16(o + i * 2, rgb15, true);
		}

		let paletteSelectPlaceholder = document.createElement('button');
		paletteSelectPlaceholder.textContent = 'Find Palettes';
		section.appendChild(paletteSelectPlaceholder);

		const canvasContainer = document.createElement('div');
		canvasContainer.style.cssText = 'height: 640px; position: relative;';
		section.appendChild(canvasContainer);

		const tileCanvases256 = [];
		const tileCanvases16 = [];
		const paletteCanvases = [];
		for (let i = 0; i < 3; ++i) {
			const tc256 = document.createElement('canvas');
			tc256.width = tc256.height = 256;
			tc256.style.cssText = `position: absolute; top: 0px; left: ${i * 256}px; width: 256px; height: 256px;`;
			canvasContainer.appendChild(tc256);
			tileCanvases256.push(tc256);

			const tc16 = document.createElement('canvas');
			tc16.width = tc16.height = 256;
			tc16.style.cssText = `position: absolute; top: 256px; left: ${i * 256}px; width: 256px; height: 256px;`;
			canvasContainer.appendChild(tc16);
			tileCanvases16.push(tc16);
		}

		for (let i = 0; i < 6; ++i) {
			const pc = document.createElement('canvas');
			pc.width = pc.height = 16;
			pc.style.cssText = `position: absolute; top: 512px; left: ${i * 128}px; width: 128px; height: 128px;`;
			canvasContainer.appendChild(pc);
			paletteCanvases.push(pc);
		}

		const animeToProps = (fmapdataTiles.animeToProps = new Map());
		paletteSelectPlaceholder.addEventListener('mousedown', () => {
			for (let i = 0; i < field.rooms.length; ++i) {
				const props = unpackSegmented(lzBis(fsext.fmapdata.segments[field.rooms[i].props]));
				const passiveAnimations = unpackSegmented(props[10]);
				for (const passiveAnime of passiveAnimations) {
					const tileset = passiveAnime.getInt16(4, true);
					let arr = animeToProps.get(tileset) || [];
					arr.push(i);
					animeToProps.set(tileset, arr);
				}
			}
			update();
		});

		let paletteOptions = [];
		const update = () => {
			const animeId = select.value - fsext.fieldAnimeIndices[0];
			if (animeToProps.size) {
				if (animeId >= 0) {
					paletteOptions = animeToProps.get(animeId) || [];

					if (paletteOptions.length === 0) {
						const span = document.createElement('span');
						span.textContent = '(unused?)';
						paletteSelectPlaceholder.replaceWith(span);
						paletteSelectPlaceholder = span;
					} else {
						const select = dropdown(
							paletteOptions.map((x) => `Palette for Room 0x${x.toString(16)}`),
							0,
							() => render(),
						);
						paletteSelectPlaceholder.replaceWith(select);
						paletteSelectPlaceholder = select;
					}
				} else {
					paletteOptions = [];
					const placeholder = document.createElement('span');
					placeholder.textContent = '(global palette)';
					paletteSelectPlaceholder.replaceWith(placeholder);
					paletteSelectPlaceholder = placeholder;
				}
			}

			render();
		};

		const render = () => {
			const index = select.value;
			const data = lzBis(fsext.fmapdata.segments[index]);

			let palettes = [
				globalPalette256,
				globalPalette16,
				globalPalette256,
				globalPalette16,
				globalPalette256,
				globalPalette16,
			];
			if (paletteOptions.length) {
				const roomIndex = paletteOptions[paletteSelectPlaceholder.value];
				const room = field.rooms[roomIndex];
				const props = unpackSegmented(lzBis(fsext.fmapdata.segments[room.props]));
				palettes = [props[3], props[3], props[4], props[4], props[5], props[5]];
			}

			// 256-color
			const bitmap256 = new Uint8ClampedArray(256 * 256 * 4);
			for (let i = 0; i < 3; ++i) {
				const ctx = tileCanvases256[i].getContext('2d');
				if (palettes[i * 2].byteLength !== 512) {
					// if the layer doesn't exist in the room
					ctx.clearRect(0, 0, 256, 256);
					continue;
				}

				let o = 0;
				for (let j = 0; o < data.byteLength; ++j) {
					const basePos = ((j >> 5) << 11) | ((j & 0x1f) << 3); // y = i >> 5, x = i & 0x1f
					for (let k = 0; k < 64 && o < data.byteLength; ++k) {
						const pos = basePos | ((k >> 3) << 8) | (k & 0x7);
						const paletteIndex = data.getUint8(o++);
						writeRgb16(bitmap256, pos, palettes[i * 2].getUint16(paletteIndex * 2, true));
					}
				}

				ctx.putImageData(new ImageData(bitmap256, 256, 256), 0, 0);
			}

			// 16-color
			const bitmap16 = new Uint8ClampedArray(256 * 256 * 4);
			for (let i = 0; i < 3; ++i) {
				const ctx = tileCanvases16[i].getContext('2d');
				if (palettes[i * 2 + 1].byteLength !== 512) {
					// if the layer doesn't exist in the room
					ctx.clearRect(0, 0, 256, 256);
					continue;
				}

				let o = 0;
				for (let j = 0; o < data.byteLength; ++j) {
					const basePos = ((j >> 5) << 11) | ((j & 0x1f) << 3); // y = j >> 5, x = j & 0x1f
					for (let k = 0; k < 64 && o < data.byteLength; k += 2) {
						const pos = basePos | ((k >> 3) << 8) | (k & 0x7);
						const composite = data.getUint8(o++);
						writeRgb16(bitmap16, pos, palettes[i * 2 + 1].getUint16((composite & 0xf) * 2, true));
						writeRgb16(bitmap16, pos ^ 1, palettes[i * 2 + 1].getUint16((composite >> 4) * 2, true));
					}
				}

				ctx.putImageData(new ImageData(bitmap16, 256, 256), 0, 0);
			}

			// palettes
			const bitmapPal = new Uint8ClampedArray(256 * 4);
			for (let i = 0; i < 6; ++i) {
				const ctx = paletteCanvases[i].getContext('2d');
				if (palettes[i].byteLength !== 512) {
					ctx.clearRect(0, 0, 16, 16);
					continue;
				}

				for (let j = 0; j < 256; ++j) writeRgb16(bitmapPal, j, palettes[i].getUint16(j * 2, true));
				ctx.putImageData(new ImageData(bitmapPal, 16, 16), 0, 0);
			}
		};
		update();

		return fmapdataTiles;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Battle Maps                                                                                          |
	// +---------------------------------------------------------------------------------------------------------------+

	const battle = (window.battle = createSection('Battle Maps', (section) => {
		const battle = {};

		const bmapFile = fs.get('/BMap/BMap.dat');
		const bmap = (battle.bmap = unpackSegmented(bmapFile));

		const bmaps = (battle.bmaps = []);
		for (let i = 1; i < bmap.length; i += 8) {
			bmaps.push({
				tileset: bmap[i],
				palette: bmap[i + 1],
				tilemaps: [bmap[i + 2], bmap[i + 3], bmap[i + 4]],
				paletteAnimations: bmap[i + 5],
				tileAnimations: bmap[i + 6],
				tilesetAnimated: bmap[i + 7],
			});
		}

		const bmapDropdown = dropdown(
			bmaps.map((_, i) => `BMap 0x${i.toString(16)}`),
			0,
			() => update(),
		);
		section.appendChild(bmapDropdown);

		let updatePalette = false;
		let updateTileset = false;
		let updateTilesetAnimated = false;
		let updateMap = false;

		const options = {};
		options.bgChecks = [];
		section.appendChild(
			(options.bgChecks[0] = checkbox('BG1', true, () => {
				updateMap = true;
			})),
		);
		section.appendChild(
			(options.bgChecks[1] = checkbox('BG2', true, () => {
				updateMap = true;
			})),
		);
		section.appendChild(
			(options.bgChecks[2] = checkbox('BG3', true, () => {
				updateMap = true;
			})),
		);
		section.appendChild(
			(options.reverseLayers = checkbox('Reverse Layers', false, () => {
				updateMap = true;
			})),
		);
		section.appendChild(
			(options.margins = checkbox('Margins', true, () => {
				updateMap = true;
			})),
		);
		section.appendChild(
			button('Export PNG', () => {
				const pngFile = battle.png(
					bmapDropdown.value,
					options.bgChecks[0].checked,
					options.bgChecks[1].checked,
					options.bgChecks[2].checked,
					options.reverseLayers.checked,
					options.margins.checked,
				);
				download(`bmap-${str16(bmapDropdown.value)}.png`, pngFile, 'image/png');
			}),
		);
		section.appendChild(
			(options.paletteAnimations = checkbox('Palette Animations', true, () => {
				updatePalette = updateTileset = updateTilesetAnimated = updateMap = true;
			})),
		);
		section.appendChild(
			(options.tileAnimations = checkbox('Tile Animations', true, () => {
				updateTileset = updateMap = true;
			})),
		);

		const mapCanvas = document.createElement('canvas');
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

		const tilesetAnimatedCanvas = document.createElement('canvas');
		tilesetAnimatedCanvas.style.cssText = 'height: 256px; width: 256px; position: absolute; top: 0; left: 256px;';
		tilesetAnimatedCanvas.width = tilesetAnimatedCanvas.height = 256;
		rawPreview.appendChild(tilesetAnimatedCanvas);

		const paletteCanvas = document.createElement('canvas');
		paletteCanvas.style.cssText = 'height: 128px; width: 128px; position: absolute; top: 0px; left: 512px;';
		paletteCanvas.width = paletteCanvas.height = 16;
		rawPreview.appendChild(paletteCanvas);

		const metaPreview = document.createElement('div');
		section.appendChild(metaPreview);

		let room = (battle.room = undefined);
		const update = () => {
			const rawRoom = bmaps[bmapDropdown.value];
			battle.room = room = {
				tileset: rawRoom.tileset?.byteLength ? bufToU8(lzBis(rawRoom.tileset)) : undefined,
				palette: rawRoom.palette?.byteLength ? rgb15To32(bufToU16(rawRoom.palette)) : undefined,
				tilemaps: rawRoom.tilemaps.map((x) => (x?.byteLength ? bufToU16(x) : undefined)),
				tilesetAnimated: rawRoom.tilesetAnimated?.byteLength
					? bufToU8(lzBis(rawRoom.tilesetAnimated))
					: undefined,
				paletteAnimations: rawRoom.paletteAnimations ? unpackSegmented16(rawRoom.paletteAnimations) : [],
			};

			// parse tile animations
			room.tileAnimations = [];
			const tileSegments = rawRoom.tileAnimations ? unpackSegmented16(rawRoom.tileAnimations) : [];
			for (let i = 0; i < tileSegments.length - 1; ++i) {
				const segment = bufToS16(tileSegments[i]);
				let tilesetStart;
				let tilesetAnimatedStart;
				let replacementLength;
				let keyframeIndices = [];
				let keyframeLengths = [];
				let totalLength = 0;
				const parts = [];

				let o = 1;
				while (o < segment.length) {
					const command = segment[o] & 0xff;
					const params = segment[o] >> 8;
					++o;

					switch (command) {
						case 0x41:
							tilesetStart = segment[o++];
							parts.push(`(tileStart 0x${tilesetStart.toString(16)})`);
							break;
						case 0x19:
							replacementLength = segment[o++];
							parts.push(`(tileLength 0x${replacementLength.toString(16)})`);
							break;
						case 0x1a:
							tilesetAnimatedStart = segment[o++];
							parts.push(`(tileAnimatedStart 0x${tilesetAnimatedStart.toString(16)})`);
							break;
						case 0x00:
							for (let j = 0; j <= params / 2; ++j) keyframeIndices.push(segment[o++]);
							parts.push(`(indices ${keyframeIndices.join(' ')})`);
							break;
						case 0x1b:
							for (let j = 0; j < keyframeIndices.length; ++j) {
								const length = segment[o++];
								totalLength += length;
								keyframeLengths.push(length);
							}
							parts.push(`(lengths ${keyframeLengths.join(' ')})`);
							break;
					}
				}

				room.tileAnimations.push({
					tilesetStart,
					tilesetAnimatedStart,
					replacementLength,
					keyframeIndices,
					keyframeLengths,
					totalLength,
					parts,
				});
			}

			// metadata below
			metaPreview.innerHTML = '';
			if (room.tileset) addHTML(metaPreview, `<div><code>[0]</code> tileset: 0x${Math.ceil(room.tileset.length / 32).toString(16)} tiles</div>`);
			else addHTML(metaPreview, '<div><code>[0]</code> tileset: none</div>');

			addHTML(metaPreview, `<div><code>[1]</code> palette: ${room.palette ? 'exists' : ''}</div>`);

			for (let layer = 0; layer < 3; ++layer) {
				const container = document.createElement('div');
				container.innerHTML = `<code>[${2 + layer}]</code> tilemaps[${layer}] (BG${layer + 1}): `;

				const tilemap = room.tilemaps[layer];
				if (tilemap?.byteLength) {
					const tilemapContainer = document.createElement('div');
					tilemapContainer.style.cssText = 'border: 1px solid #666; padding: 5px; display: none; overflow-x: scroll;';
					container.appendChild(checkbox('Tilemap', false, checked => {
						if (checked) {
							const lines = [];
							for (let y = 0, o = 0; y < 32; ++y) {
								const line = [];
								for (let x = 0; x < 64; ++x, ++o) {
									line.push(tilemap[o] ? str16(tilemap[o]) : '----');
								}
								lines.push(line.join(' '));
							}
							tilemapContainer.style.display = '';
							tilemapContainer.innerHTML = `<code style="white-space: pre;">${lines.join('\n')}</code>`;
						} else {
							tilemapContainer.style.display = 'none';
							tilemapContainer.innerHTML = '';
						}
					}));
					container.appendChild(tilemapContainer);
				}
				metaPreview.appendChild(container);
			}

			const palAnimLines = fpaf.stringify(room.paletteAnimations);
			addHTML(metaPreview, `<div><code>[5]</code> paletteAnimations: <ul>${palAnimLines.map((x) => '<li><code>' + x + '</code></li>').join('')}</ul></div>`);

			addHTML(metaPreview, `<div><code>[6]</code> tileAnimations: <ul>${room.tileAnimations.map((x) => {
				return ('<li><code>' +
					x.parts.map((s, i) => `<span style="color: ${i % 2 ? '#777' : '#999'};">${s}</span>`).join(' ') +
					'</code></li>');
			}).join('')}</ul></div>`);

			if (room.tilesetAnimated) {
				let tilesEnd = 0;
				for (const anim of room.tileAnimations) {
					const end =
						anim.tilesetAnimatedStart + anim.replacementLength * (Math.max(...anim.keyframeIndices) + 1);
					if (tilesEnd < end) tilesEnd = end;
				}
				let html = `<code>[7]</code> tilesetAnimated: 0x${tilesEnd} tiles`;
				if (tilesEnd * 32 < room.tilesetAnimated.byteLength) {
					html += `, debug info or unused tiles: <ul>
						<li style="overflow-wrap: anywhere;"><code>${latin1(tilesEnd * 32, Infinity, room.tilesetAnimated)}</code></li>
						<li><code>${bytes(tilesEnd * 32, Infinity, room.tilesetAnimated)}</code></li>
					</ul>`;
				}
				addHTML(metaPreview, `<div>${html}</div>`);
			} else {
				addHTML(metaPreview, '<div><code>[7]</code> tilesetAnimated:</div>');
			}

			updatePalette = updateTileset = updateTilesetAnimated = updateMap = true;
		};

		const palette = new Uint32Array(256);
		const render = () => {
			if (options.paletteAnimations.checked && room.paletteAnimations.length)
				updatePalette = updateTileset = updateTilesetAnimated = updateMap = true;
			if (options.tileAnimations.checked && room.tileAnimations.length) updateTileset = updateMap = true;
			const tick = Math.floor((performance.now() / 1000) * 60);

			// palette
			if (updatePalette) {
				const paletteCtx = paletteCanvas.getContext('2d');
				if (room.palette) {
					palette.set(room.palette, 0);
					if (options.paletteAnimations.checked) fpaf.apply(palette, room.paletteAnimations, tick);
					paletteCtx.putImageData(new ImageData(bufToU8Clamped(palette), 16, 16), 0, 0);
				} else {
					palette.fill(0, 0, 256);
					paletteCtx.clearRect(0, 0, 16, 16);
				}
			}

			if (updateTileset || updateTilesetAnimated || updateMap) {
				// tileset
				const layout = new Array(1024);
				const tilesetCtx = tilesetCanvas.getContext('2d');
				if (room.tileset) {
					for (let i = 0; i < 1024; ++i) layout[i] = room.tileset.slice(i * 32, i * 32 + 32);

					if (options.tileAnimations.checked) {
						for (let i = 0; i < room.tileAnimations.length; ++i) {
							const tileAnim = room.tileAnimations[i];

							let localTick = tick % tileAnim.totalLength;
							let frame = 0;
							for (let j = 0; j < tileAnim.keyframeLengths.length; ++j) {
								if (localTick < tileAnim.keyframeLengths[j]) {
									frame = tileAnim.keyframeIndices[j];
									break;
								}
								localTick -= tileAnim.keyframeLengths[j];
							}

							for (
								let j = 0,
									o = (tileAnim.tilesetAnimatedStart + frame * tileAnim.replacementLength) * 32;
								j < tileAnim.replacementLength;
								++j, o += 32
							) {
								layout[tileAnim.tilesetStart + j] = room.tilesetAnimated.slice(o, o + 32);
							}
						}
					}

					const tilesetBitmap = new Uint32Array(256 * 256);
					for (let i = 0; i * 32 < room.tileset.length; ++i) {
						const basePos = ((i >> 5) << 11) | ((i & 0x1f) << 3); // y = i >> 5, x = i & 0x1f
						// 16-color
						for (let j = 0; j < 32; ++j) {
							const pos = basePos | ((j >> 2) << 8) | ((j & 0x3) << 1);
							const composite = layout[i][j] ?? 0;
							tilesetBitmap[pos] = palette[composite & 0xf];
							tilesetBitmap[pos ^ 1] = palette[composite >> 4];
						}
					}
					tilesetCtx.putImageData(new ImageData(bufToU8Clamped(tilesetBitmap), 256, 256), 0, 0);
				} else {
					tilesetCtx.clearRect(0, 0, 256, 256);
				}

				// tilesetAnimated
				const tilesetAnimatedCtx = tilesetAnimatedCanvas.getContext('2d');
				if (room.tilesetAnimated) {
					const bitmap = new Uint32Array(256 * 256);
					for (let i = 0; i * 32 < room.tilesetAnimated.length; ++i) {
						const basePos = ((i >> 5) << 11) | ((i & 0x1f) << 3); // y = i >> 5, x = i & 0x1f
						// 16-color
						for (let j = 0; j < 32; ++j) {
							const pos = basePos | ((j >> 2) << 8) | ((j & 0x3) << 1);
							const composite = room.tilesetAnimated[i * 32 + j] ?? 0;
							bitmap[pos] = palette[composite & 0xf];
							bitmap[pos ^ 1] = palette[composite >> 4];
						}
					}
					tilesetAnimatedCtx.putImageData(new ImageData(bufToU8Clamped(bitmap), 256, 256), 0, 0);
				} else {
					tilesetAnimatedCtx.clearRect(0, 0, 256, 256);
				}

				// map
				const mapCtx = mapCanvas.getContext('2d');
				if (updateMap) {
					const height = options.margins.checked ? 256 : 192;
					mapCanvas.height = height;
					if (room.tileset) {
						const mapBitmap = new Uint32Array(512 * 256);
						mapBitmap.fill(palette[0], 0, 512 * 256);
						for (let i = 2; i >= 0; --i) {
							const layerIndex = options.reverseLayers.checked ? 2 - i : i;
							const tilemap = room.tilemaps[layerIndex];
							if (!options.bgChecks[layerIndex].checked || !tilemap) continue;

							for (let j = 0; j < tilemap.length; ++j) {
								const tile = tilemap[j];
								const paletteRow = (tile >> 12) << 4;

								const basePos = ((j >> 6) << 12) | ((j & 0x3f) << 3); // y = i >> 6, x = i & 0x3f
								for (let k = 0; k < 32; ++k) {
									let pos = basePos | ((k >> 2) << 9) | ((k & 0x3) << 1);
									if (tile & 0x400) pos ^= 0x7; // horizontal flip
									if (tile & 0x800) pos ^= 0x7 << 9; // vertical flip

									const composite = layout[tile & 0x3ff][k] ?? 0;
									if (composite & 0xf) mapBitmap[pos] = palette[paletteRow | (composite & 0xf)];
									if (composite >> 4) mapBitmap[pos ^ 1] = palette[paletteRow | (composite >> 4)];
								}
							}
						}
						mapCtx.putImageData(
							new ImageData(bufToU8Clamped(mapBitmap), 512, 256),
							0,
							options.margins.checked ? 0 : -32,
						);
					} else {
						mapCtx.clearRect(0, 0, 512, height);
					}
				}
			}

			updatePalette = updateTileset = updateTilesetAnimated = updateMap = false;

			requestAnimationFrame(render);
		};
		update();
		render();

		battle.png = (roomId, bg1, bg2, bg3, reverseLayers, margins) => {
			// this is almost identical to field.png
			const rawRoom = battle.bmaps[roomId];
			const tileset = bufToU8(lzBis(rawRoom.tileset));
			const palette = rgb15To32(bufToU16(rawRoom.palette));
			const tilemaps = rawRoom.tilemaps.map((x) => (x?.byteLength ? bufToU16(x) : undefined));

			const inset = margins ? 0 : 4;

			const bitmap = new Uint32Array(512 * (margins ? 256 : 192));
			bitmap.fill(palette[0], 0, bitmap.length);
			const layers = reverseLayers ? [0, 1, 2] : [2, 1, 0];
			for (const i of layers) {
				const tilemap = tilemaps[i];
				if (![bg1, bg2, bg3][i] || !tilemap) continue;

				for (let y = inset; y < 32 - inset; ++y) {
					for (let x = 0; x < 64; ++x) {
						const basePos = ((y - inset) << 12) | (x << 3);
						const tile = tilemap[y * 64 + x];
						// 16-color
						const paletteShift = (tile >> 12) << 4;
						for (let j = 0, o = (tile & 0x3ff) * 32; j < 64; j += 2, ++o) {
							let pos = basePos | ((j >> 3) << 9) | (j & 7);
							if (tile & 0x400) pos ^= 7; // horizontal flip
							if (tile & 0x800) pos ^= 7 << 9; // vertical flip
							const composite = tileset[o] ?? 0;
							if (composite & 0xf) bitmap[pos] = palette[paletteShift | (composite & 0xf)];
							if (composite >> 4) bitmap[pos ^ 1] = palette[paletteShift | (composite >> 4)];
						}
					}
				}
			}

			return png(bitmap, 512, margins ? 256 : 192);
		};

		return battle;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Giant Battle Maps                                                                                    |
	// +---------------------------------------------------------------------------------------------------------------+

	const battleGiant = (window.battleGiant = createSection('Giant Battle Maps', (section) => {
		const battleGiant = {};

		if (!fs.has('/BMapG/BMapG.dat')) {
			addHTML(
				section,
				`<div>This version (${headers.gamecode}) doesn't have /BMapG/BMapG.dat (the giant battle map file)</div>`,
			);
			return;
		}

		const selectOptions = [];
		for (let i = 0; i < fsext.bmapg.segments.length; ++i) selectOptions.push(`BMapG 0x${i.toString(16)}`);
		const bmapgSelect = dropdown(selectOptions, 0, () => render());
		section.appendChild(bmapgSelect);

		const bgChecks = [];
		section.appendChild((bgChecks[0] = checkbox('BG1', true, () => render())));
		section.appendChild((bgChecks[1] = checkbox('BG2', true, () => render())));

		const mapCanvas = document.createElement('canvas');
		mapCanvas.style.cssText = 'width: 2048px; height: 512px;';
		mapCanvas.width = 2048;
		mapCanvas.height = 512;
		section.appendChild(mapCanvas);

		const componentPreview = document.createElement('div');
		componentPreview.style.cssText = 'height: 256px; position: relative;';
		section.appendChild(componentPreview);

		const tilesetCanvas = document.createElement('canvas');
		tilesetCanvas.style.cssText = 'position: absolute; top: 0px; left: 0px; width: 256px; height: 256px;';
		tilesetCanvas.width = tilesetCanvas.height = 256;
		componentPreview.appendChild(tilesetCanvas);

		const paletteCanvas = document.createElement('canvas');
		paletteCanvas.style.cssText = 'position: absolute; top: 0px; left: 256px; width: 128px; height: 128px;';
		paletteCanvas.width = paletteCanvas.height = 16;
		componentPreview.appendChild(paletteCanvas);

		const metaPreview = document.createElement('div');
		section.appendChild(metaPreview);

		const render = () => {
			const room = unpackSegmented(lzBis(fsext.bmapg.segments[bmapgSelect.value]));
			const palette = room[0]?.byteLength && rgb15To32(bufToU16(room[0]));
			const tileset = room[1]?.byteLength && bufToU8(room[1]);
			const tilemaps = [2, 3].map((index) => room[index]?.byteLength && bufToU16(room[index]));
			const unknown4 = room[4];
			const unknown5 = room[5];
			const unknown6 = room[6];

			// palette
			const paletteCtx = paletteCanvas.getContext('2d');
			if (palette) paletteCtx.putImageData(new ImageData(bufToU8Clamped(palette), 16, 16), 0, 0);
			else paletteCtx.clearRect(0, 0, 16, 16);

			// tileset
			const tilesetCtx = tilesetCanvas.getContext('2d');
			if (palette && tileset) {
				const tilesetBitmap = new Uint32Array(256 * 256);
				let o = 0;
				for (let i = 0; i * 64 < tileset.byteLength; ++i) {
					const basePos = ((i >> 5) << 11) | ((i & 0x1f) << 3); // y = i >> 5, x = i & 0x1f
					// 256-color
					for (let j = 0; j < 64; ++j) {
						const pos = basePos | ((j >> 3) << 8) | (j & 0x7);
						tilesetBitmap[pos] = palette[tileset[i * 64 + j] ?? 0];
					}
				}
				tilesetCtx.putImageData(new ImageData(bufToU8Clamped(tilesetBitmap), 256, 256), 0, 0);
			} else {
				tilesetCtx.clearRect(0, 0, 256, 256);
			}

			// map
			const mapCtx = mapCanvas.getContext('2d');
			if (palette && tileset) {
				const mapBitmap = new Uint32Array(2048 * 512);
				// maybe there are more layers, so use an array
				for (let i = 1; i >= 0; --i) {
					const tilemap = tilemaps[i];
					if (!bgChecks[i].checked) continue;

					for (let j = 0; j < tilemap.length; ++j) {
						const tile = tilemap[j];

						// 256-color
						const basePos = ((j >> 7) << 14) | ((j & 0x7f) << 3); // y = i >> 7, x = i & 0x7f
						const tileOffset = (tile & 0x3ff) * 64;
						for (let k = 0; k < 64; ++k) {
							let pos = basePos | ((k >> 3) << 11) | (k & 0x7);
							if (tile & 0x400) pos ^= 0x7; // horizontal flip
							if (tile & 0x800) pos ^= 0x7 << 11; // vertical flip

							const paletteIndex = tileset[tileOffset + k] ?? 0;
							if (!paletteIndex) continue;
							mapBitmap[pos] = palette[paletteIndex];
						}
					}
				}

				mapCtx.putImageData(new ImageData(bufToU8Clamped(mapBitmap), 2048, 512), 0, 0);
			} else {
				mapCtx.clearRect(0, 0, 2048, 512);
			}

			// metadata below
			metaPreview.innerHTML = '';

			const metaLines = [];
			metaLines.push(`Tilemap sizes: ${tilemaps[0]?.byteLength}, ${tilemaps[1]?.byteLength}`);
			metaLines.push(`unknown4 size: ${unknown4?.byteLength}`);
			metaLines.push(`unknown4 preview: <code>${bytes(0, 256, unknown4)}</code>`);
			metaLines.push(`unknown5 size: ${unknown5?.byteLength}`);
			metaLines.push(`unknown5 preview: <code>${bytes(0, 256, unknown5)}</code>`);
			metaLines.push(`unknown6 size: ${unknown6?.byteLength}`);
			metaLines.push(`unknown6 preview: <code>${bytes(0, 256, unknown6)}</code>`);
			for (const metaLine of metaLines) addHTML(metaPreview, '<div>' + metaLine + '</div>');
		};
		render();

		return battleGiant;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Menu Maps                                                                                            |
	// +---------------------------------------------------------------------------------------------------------------+

	const menu = (window.menu = createSection('Menu Maps', (section) => {
		const menu = {};

		const menuFile = fs.get('/MMap/MMap.dat');
		const maps = (menu.maps = unpackSegmented(menuFile));

		const tilesetOptions = [];
		const tilemapOptions = [];
		const paletteOptions = [];
		for (let i = 0; i < maps.length; ++i) {
			if (maps[i].byteLength === 512) {
				paletteOptions.push([`MMap Palette 0x${i.toString(16)}`, i]);
			} else {
				tilesetOptions.push([`MMap Tileset 0x${i.toString(16)}`, i]);
				tilemapOptions.push([`MMap Tilemap 0x${i.toString(16)}`, i]);
			}
		}

		const tilesetSelect = dropdown(
			tilesetOptions.map((x) => x[0]),
			0,
			() => render(),
		);
		section.appendChild(tilesetSelect);
		const tilemapSelect = dropdown(
			tilemapOptions.map((x) => x[0]),
			0,
			() => render(),
		);
		section.appendChild(tilemapSelect);
		const paletteSelect = dropdown(
			paletteOptions.map((x) => x[0]),
			0,
			() => render(),
		);
		section.appendChild(paletteSelect);

		const mapContainer = document.createElement('div');
		mapContainer.style.cssText = 'position: relative; height: 192px;';
		section.appendChild(mapContainer);

		const mapCanvas16 = document.createElement('canvas');
		mapCanvas16.width = 256;
		mapCanvas16.height = 192;
		mapCanvas16.style.cssText = 'position: absolute; top: 0; left: 0;';
		mapContainer.appendChild(mapCanvas16);

		const mapCanvas256 = document.createElement('canvas');
		mapCanvas256.width = 256;
		mapCanvas256.height = 192;
		mapCanvas256.style.cssText = 'position: absolute; top: 0; left: 256px;';
		mapContainer.appendChild(mapCanvas256);

		const componentContainer = document.createElement('div');
		componentContainer.style.cssText = 'position: relative; height: 256px;';
		section.appendChild(componentContainer);

		const tilesetCanvas16 = document.createElement('canvas');
		tilesetCanvas16.width = tilesetCanvas16.height = 256;
		tilesetCanvas16.style.cssText = 'position: absolute; top: 0; left: 0;';
		componentContainer.appendChild(tilesetCanvas16);

		const tilesetCanvas256 = document.createElement('canvas');
		tilesetCanvas256.width = tilesetCanvas256.height = 256;
		tilesetCanvas256.style.cssText = 'position: absolute; top: 0; left: 256px;';
		componentContainer.appendChild(tilesetCanvas256);

		const paletteCanvas = document.createElement('canvas');
		paletteCanvas.width = paletteCanvas.height = 16;
		paletteCanvas.style.cssText = 'position: absolute; top: 0; left: 512px; width: 128px; height: 128px;';
		componentContainer.appendChild(paletteCanvas);

		const render = () => {
			// palette
			const paletteDat = maps[paletteOptions[paletteSelect.value][1]];
			let palette;
			if (paletteDat.byteLength === 512) {
				palette = rgb15To32(bufToU16(paletteDat));
			}

			{
				const ctx = paletteCanvas.getContext('2d');
				if (palette) {
					ctx.putImageData(new ImageData(bufToU8Clamped(palette), 16, 16), 0, 0);
				} else {
					ctx.clearRect(0, 0, 16, 16);
				}
			}

			// tileset
			const tilesetDat = maps[tilesetOptions[tilesetSelect.value][1]];
			let tileset;
			try {
				tileset = bufToU8(lzBis(tilesetDat));
			} catch (_) {}
			{
				const ctx16 = tilesetCanvas16.getContext('2d');
				const ctx256 = tilesetCanvas256.getContext('2d');
				if (tileset && palette) {
					const bitmap16 = new Uint32Array(256 * 256);
					const bitmap256 = new Uint32Array(256 * 256);
					// 16-color
					for (let i = 0; i * 32 < tileset.length; ++i) {
						const basePos = ((i >> 5) << 11) | ((i & 0x1f) << 3); // y = i >> 5, x = i & 0x1f
						for (let j = 0; j < 32; ++j) {
							const pos = basePos | ((j >> 2) << 8) | ((j & 0x3) << 1);
							const composite = tileset[i * 32 + j];
							bitmap16[pos] = palette[composite & 0xf];
							bitmap16[pos ^ 1] = palette[composite >> 4];
						}
					}

					ctx16.putImageData(new ImageData(bufToU8Clamped(bitmap16), 256, 256), 0, 0);

					// 256-color
					for (let i = 0; i * 64 < tileset.length; ++i) {
						const basePos = ((i >> 5) << 11) | ((i & 0x1f) << 3); // y = i >> 5, x = i & 0x1f
						for (let j = 0; j < 64; ++j) {
							const pos = basePos | ((j >> 3) << 8) | (j & 0x7);
							bitmap256[pos] = palette[tileset[i * 64 + j]];
						}
					}

					ctx256.putImageData(new ImageData(bufToU8Clamped(bitmap256), 256, 256), 0, 0);
				} else {
					ctx16.clearRect(0, 0, 256, 256);
					ctx256.clearRect(0, 0, 256, 256);
				}
			}

			// tilemap
			const tilemapDat = maps[tilemapOptions[tilemapSelect.value][1]];
			let tilemap;
			try {
				tilemap = bufToU16(lzBis(tilemapDat));
			} catch (_) {}

			{
				const ctx16 = mapCanvas16.getContext('2d');
				const ctx256 = mapCanvas256.getContext('2d');

				if (tilemap && tileset && palette) {
					// 16-color
					const bitmap16 = new Uint32Array(256 * 192);
					for (let i = 0; i < tilemap.length; ++i) {
						const basePos = ((i >> 6) << 12) | ((i & 0x3f) << 3);
						const tile = tilemap[i];
						const tileOffset = (tile & 0x3ff) * 32;
						const paletteRow = (tile >> 12) << 4;
						for (let j = 0; j < 32; ++j) {
							let pos = basePos | ((j >> 2) << 9) | ((j & 0x3) << 1);
							if (tile & 0x400) pos ^= 0x7;
							if (tile & 0x800) pos ^= 0x7 << 8;

							const composite = tileset[tileOffset + j];
							if (composite & 0xf) bitmap16[pos] = palette[paletteRow | (composite & 0xf)];
							if (composite >> 4) bitmap16[pos ^ 1] = palette[paletteRow | (composite >> 4)];
						}
					}

					ctx16.putImageData(new ImageData(bufToU8Clamped(bitmap16), 256, 192), 0, 0);

					// 256-color
					const bitmap256 = new Uint32Array(256 * 192);
					for (let i = 0; i < tilemap.length; ++i) {
						const basePos = ((i >> 5) << 11) | ((i & 0x1f) << 3);
						const tile = tilemap[i];
						const tileOffset = (tile & 0x3ff) * 64;
						for (let j = 0; j < 64; ++j) {
							let pos = basePos | ((j >> 3) << 8) | (j & 0x7);
							if (tile & 0x400) pos ^= 0x7;
							if (tile & 0x800) pos ^= 0x7 << 8;

							const paletteIndex = tileset[tileOffset + j];
							if (paletteIndex) bitmap256[pos] = palette[paletteIndex];
						}
					}

					ctx256.putImageData(new ImageData(bufToU8Clamped(bitmap256), 256, 192), 0, 0);
				} else {
					ctx16.clearRect(0, 0, 256, 192);
					ctx256.clearRect(0, 0, 256, 192);
				}
			}
		};
		render();

		return menu;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Fonts                                                                                                |
	// +---------------------------------------------------------------------------------------------------------------+

	const fonts = (window.fonts = createSection('Fonts', (section) => {
		const fonts = {};

		const optionSegments = [];
		const optionNames = [];
		if (fsext.font) { // not available in PIT
			optionSegments.push(fsext.font);
			optionNames.push('Default Font');
		}

		const statSegments = unpackSegmented(fs.get('/Font/StatFontSet.dat'));
		for (let i = 0; i < statSegments.length; ++i) {
			if (!statSegments[i].byteLength) continue;
			optionSegments.push(statSegments[i]);
			optionNames.push(`StatFontSet[${i}]`);
		}

		fonts.chars = (font) => {
			const charMapSize = font.getUint32(0, true);
			const segments = unpackSegmentedUnsorted(font, 4);
			const charMap = segments.shift();

			const glyphs = [];
			for (let i = 0; i < segments.length; ++i) {
				const glyph = segments[i];
				if (!glyph.byteLength) continue;
				const glyphU8 = bufToU8(glyph);

				const glyphWidth = (glyph.getUint8(0) >> 4) * 4;
				const glyphHeight = (glyph.getUint8(0) & 0xf) * 4;
				const numGlyphs = glyph.getUint8(3) * 8;
				let glyphOffset = 4 + (numGlyphs >> 1);

				for (let j = 0; j < numGlyphs; ++j) {
					const actualWidth = (j % 2 ? (glyphU8[4 + (j >> 1)] >> 4) : (glyphU8[4 + (j >> 1)] & 0xf)) + 1;
					const bitmap = new Uint8Array(glyphWidth * glyphHeight);

					for (let xBase = 0; xBase < glyphWidth; xBase += 8) {
						const width = Math.min(8, glyphWidth - xBase);
						for (let yBase = 0; yBase < glyphHeight; yBase += 4) {
							const existsOffset = glyphOffset;
							const alphaOffset = glyphOffset + (width >> 1);
							glyphOffset += width;
							for (let x = 0, bitOffset = 0; x < width; ++x) {
								for (let y = 0; y < 4; ++y, ++bitOffset) {
									const exists = (glyphU8[existsOffset + (bitOffset >> 3)] >> (bitOffset & 7)) & 1;
									const alpha = (glyphU8[alphaOffset + (bitOffset >> 3)] >> (bitOffset & 7)) & 1;
									bitmap[(yBase + y) * glyphWidth + xBase + x] = (exists << 1) | alpha;
								}
							}
						}
					}

					glyphs.push({ actualWidth, bitmap, height: glyphHeight, width: glyphWidth });
				}
			}

			const chars = new Map();
			for (let i = 0; i * 2 < charMap.byteLength; ++i) {
				const index = charMap.getInt16(i * 2, false); // big-endian!!!
				if (!glyphs[index]) continue;
				chars.set(i, glyphs[index]);
			}

			return chars;
		};

		fonts.preview = (font, showGlyphWidth) => {
			const charMapSize = font.getUint32(0, true);
			const segments = unpackSegmentedUnsorted(font, 4);
			const charMap = segments.shift();

			const previews = [];

			for (let i = 0; i < segments.length; ++i) {
				const glyph = segments[i];
				if (!glyph.byteLength) continue;

				const glyphWidth = (glyph.getUint8(0) >> 4) * 4;
				const glyphHeight = (glyph.getUint8(0) & 0xf) * 4;
				const numGlyphs = glyph.getUint8(3) * 8;
				let glyphOffset = 4 + (numGlyphs >> 1);

				const numRows = Math.ceil(numGlyphs / 32);
				const bitmapWidth = glyphWidth * 32;
				const bitmapHeight = glyphHeight * numRows;
				const bitmap = new Uint8ClampedArray(bitmapWidth * bitmapHeight * 4);
				const bitmap32 = bufToU32(bitmap);

				const glyphU8 = bufToU8(glyph);

				for (let i = 0; i < numGlyphs; ++i) {
					const actualWidth = (i % 2 ? (glyphU8[4 + (i >> 1)] >> 4) : (glyphU8[4 + (i >> 1)] & 0xf)) + 1;
					const bitmapX = (i % 32) * glyphWidth;
					const bitmapY = (i >> 5) * glyphHeight;
					const oddTile = ((i % 32) ^ (i >> 5)) & 1;

					for (let xBase = 0; xBase < glyphWidth; xBase += 8) {
						const width = Math.min(8, glyphWidth - xBase);
						for (let yBase = 0; yBase < glyphHeight; yBase += 4) {
							const alphaOffset = glyphOffset;
							const colorOffset = glyphOffset + (width >> 1);
							glyphOffset += width;
							for (let x = 0, bitOffset = 0; x < width; ++x) {
								for (let y = 0; y < 4; ++y, ++bitOffset) {
									const alpha = glyphU8[alphaOffset + (bitOffset >> 3)] & (1 << (bitOffset & 7));
									const color = glyphU8[colorOffset + (bitOffset >> 3)] & (1 << (bitOffset & 7));
									const output = alpha 
										? (color ? 0xffdee6ef : 0xff314263) : (oddTile ? 0xffd6f7ff : 0xffa5cee6);
									bitmap32[(bitmapY + yBase + y) * bitmapWidth + bitmapX + xBase + x] = output;
								}
							}
						}
					}

					if (showGlyphWidth) {
						for (let x = 0; x < actualWidth; ++x) {
							bitmap32[(bitmapY + glyphHeight - 1) * bitmapWidth + bitmapX + x] = 0xff0099ff;
						}
					}
				}

				previews.push({ bitmap, width: bitmapWidth, height: bitmapHeight });
			}

			return previews;
		};

		fonts.textbox = (chars, alternateChars, bitmap, message, width, height) => {
			bitmap.fill(0xffd6f7ff, 0, bitmap.length);
			const u8 = bufToU8(message);
			let o = 0;
			const maxWidth = width * 8 + 10;
			let x = 0;
			let y = 0;
			let lineHeight = 0;

			let color = 0xff314263;
			let colorAlpha = 0xffdee6ef;
			let spacesAfterCharacters = true;

			const resize = () => {
				const maxY = bitmap.length / maxWidth;
				if (y + 37 > maxY) {
					const newBitmap = new Uint32Array(bitmap.length * 2);
					newBitmap.set(bitmap, 0);
					newBitmap.fill(0xffd6f7ff, bitmap.length, newBitmap.length);
					bitmap = newBitmap;
				}
			};

			for (; o < u8.length;) {
				let char = u8[o++];
				if (char === 0xff) {
					// special character
					const code = u8[o++];
					if (code === 0x00) {
						// newline
						x = 0;
						y += lineHeight + 1;
						lineHeight = 0;
						resize();
					} else if (code === 0x0a) {
						// destroy textbox
						++o; // ignore next byte
					} else if (code === 0x01 || code === 0x0b) {
						// (0x01) restart textbox, (0x0b) next page
						if (lineHeight) {
							x = 0;
							y += lineHeight + 1;
							for (let i = 0; i < maxWidth; ++i) {
								bitmap[(y + 5) * maxWidth + i] = ((i >> 3) & 1) ? 0xff0084f7 : 0xffd6f7ff;
							}
							y += 3;
							lineHeight = 0;
							resize();
						}
						++o; // ignore next byte
					} else if (code === 0x0b) {
						// ???
						++o; // ignore next byte
					} else if (code === 0x0c) {
						// delay
						++o; // next byte is the delay
					} else if (code === 0x11) {
						// button prompt
						++o; // ignore next byte
					} else if (code === 0x20) [color, colorAlpha] = [0xff314263, 0xffdee6ef]; // color: default
					else if (code === 0x2b) [color, colorAlpha] = [0xffff0000, 0xffffdddd]; // color: blue
					else if (code === 0xe8) spacesAfterCharacters = false;
					else if (code === 0xef) spacesAfterCharacters = true;
					continue;
				}

				if (char === 0x20) {
					// space
					x += 8;
					continue;
				}

				const primaryCharset = char >= 0xfa ? alternateChars : chars;
				if (char >= 0xfa) { [color, colorAlpha] = [0xff0000ff, 0xffddddff]; }
				else { [color, colorAlpha] = [0xff314263, 0xffdee6ef] };
				if (char === 0xfe) char = 0x000 + u8[o++];
				else if (char === 0xfd) char = 0x100 + u8[o++];
				else if (char === 0xfc) char = 0x200 + u8[o++];
				else if (char === 0xfb) char = 0x300 + u8[o++];
				else if (char === 0xfa) char = 0x400 + u8[o++];

				const glyph = primaryCharset.get(char) ?? chars.get(char) ?? alternateChars.get(char);
				if (!glyph) {
					console.warn(`missing glyph ${char}`);
					continue;
				}

				const { actualWidth, bitmap: glyphBitmap, width, height } = glyph;
				if (x + width >= maxWidth) {
					x = 0;
					y += lineHeight + 1;
					lineHeight = 0;
					resize();
				}

				for (let iy = 0, io = 0; iy < height; ++iy) {
					for (let ix = 0; ix < width; ++ix) {
						const pos = (y + iy + 5) * maxWidth + x + ix + 5;
						const pixel = glyphBitmap[io++];
						if (pixel & 2) bitmap[pos] = (pixel & 1) ? colorAlpha : color;
					}
				}

				if (height > lineHeight) lineHeight = height;
				x += actualWidth + (spacesAfterCharacters ? 1 : 0);
			}

			return { bitmap, width: maxWidth, height: Math.max(height, y + lineHeight + 10) };
		};

		const select = dropdown(optionNames, 0, () => update());
		section.appendChild(select);

		const showGlyphWidthCheckbox = checkbox('Show Glyph Width', true, () => update());
		section.appendChild(showGlyphWidthCheckbox);

		const list = document.createElement('div');
		list.style.cssText = 'display: grid; grid-columns: 512px 200px';
		section.appendChild(list);

		const update = () => {
			const previews = fonts.preview(optionSegments[select.value], showGlyphWidthCheckbox.checked);

			list.innerHTML = '';

			for (const preview of previews) {
				const canvas = document.createElement('canvas');
				canvas.width = preview.width;
				canvas.height = preview.height;
				canvas.style.cssText = `display: block; width: ${preview.width * 2}px; height: ${preview.height * 2}px;`;

				const ctx = canvas.getContext('2d');
				ctx.putImageData(new ImageData(preview.bitmap, preview.width, preview.height), 0, 0);

				list.appendChild(canvas);
			}
		};
		update();

		fonts.default = fsext.font ?? statSegments.find(x => x.byteLength > 200);

		return fonts;
	}));



	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: MFSet                                                                                                |
	// +---------------------------------------------------------------------------------------------------------------+

	const mfset = (window.mfset = createSection('MFSet', (section) => {
		const mfset = {};

		const mfsetFiles = [];
		for (const name of fs.keys()) {
			if (typeof name === 'string' && name.includes('mfset')) mfsetFiles.push(name);
		}

		const fileSelect = dropdown(mfsetFiles, 0, () => update());
		section.appendChild(fileSelect);

		const ignoreSpecials = checkbox('Ignore Special Characters', false, () => update());
		section.appendChild(ignoreSpecials);

		const useGameFont = checkbox('Use Game Font', false, () => update());
		section.appendChild(useGameFont);

		const metaDisplay = document.createElement('div');
		section.appendChild(metaDisplay);

		const tableContainer = document.createElement('div');
		tableContainer.style.cssText = 'width: 100%; height: fit-content; overflow-x: auto;';
		section.appendChild(tableContainer);

		const table = document.createElement('table');
		table.className = 'bordered';
		tableContainer.appendChild(table);

		const update = () => {
			const file = fs.get(mfsetFiles[fileSelect.value]);
			const segments = unpackSegmented(file);
			table.innerHTML = `<tr><td>${segments.length} segments: ${segments.map((x) => x.byteLength).join(',')}</td><tr>`;

			const zeroedColumns = [];
			const invalidColumns = [];
			const rows = [['<th></th>']];
			for (let i = 0; i < segments.length; ++i) {
				const segment = segments[i];
				if (!segment.byteLength) continue;

				// some segments are zeroed out with nothing useful
				let nonzero = false;
				const u8 = bufToU8(segment);
				for (let j = 0; j < u8.length; ++j) {
					if (u8[j] !== 0) {
						nonzero = true;
						break;
					}
				}
				if (!nonzero) {
					zeroedColumns.push(i);
					continue;
				}

				let entries;
				try {
					entries = unpackSegmented(segment);
				} catch (_) {
					invalidColumns.push(i);
					continue;
				}

				const column = rows[0].length;
				rows[0].push(`<th>Column ${i}</th>`);

				for (let j = 0; j < entries.length; ++j) {
					rows[j + 1] ??= [`<td>${j}</td>`];
					rows[j + 1][column] =
						`<td>${sanitize(readMessage(0, entries[j], ignoreSpecials.checked)).replaceAll('\n', '<br>')}</td>`;
				}
			}
			mfset.selected = { segments, rows };

			metaDisplay.innerHTML = '';
			if (invalidColumns.length) {
				addHTML(metaDisplay, `<div>Invalid columns (fonts?): ${invalidColumns.join(', ')}</div>`);
			}
			if (zeroedColumns.length) addHTML(metaDisplay, `<div>Zeroed columns: ${zeroedColumns.join(', ')}</div>`);

			const numColumns = rows[0].length;
			for (let i = 0; i < rows.length; ++i) {
				for (let j = 0; j < numColumns; ++j) {
					rows[i][j] ??= '<td></td>';
				}
			}

			if (rows.length === 1) {
				table.innerHTML = '(no data)';
			} else {
				table.innerHTML = rows.map((x) => '<tr>' + x.join('') + '</tr>').join('');
			}
		};
		update();

		return mfset;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Mes                                                                                                 |
	// +---------------------------------------------------------------------------------------------------------------+

	const mes = (window.mes = createSection('*Mes', (section) => {
		const mes = {};

		const paths = [
			'/BAI/BMes_cf.dat',
			'/BAI/BMes_ji.dat',
			'/BAI/BMes_yo.dat',
			'/MAI/MMes_yo.dat',
			'/SAI/SMes_yo.dat',
		];
		const fileSelect = dropdown(paths, 0, () => update());
		section.appendChild(fileSelect);

		let scriptSelect = dropdown([''], 0, () => {});
		section.appendChild(scriptSelect);

		const ignoreSpecials = checkbox('Ignore Special Characters', false, () => updateTable());
		section.appendChild(ignoreSpecials);

		const useGameFont = checkbox('Use Game Font', false, () => updateTable());
		section.appendChild(useGameFont);

		const gameFontScale = dropdown([
			'Game Font Scale 1x',
			'Game Font Scale 1.5x',
			'Game Font Scale 2x',
		], 2, () => updateTable());
		section.appendChild(gameFontScale);

		const metaDisplay = document.createElement('div');
		section.appendChild(metaDisplay);

		const fontTable = document.createElement('table');
		fontTable.className = 'bordered';
		section.appendChild(fontTable);

		addHTML(section, '<br>');

		const tableContainer = document.createElement('div');
		tableContainer.style.cssText = 'width: 100%; height: fit-content; overflow-x: auto;';
		section.appendChild(tableContainer);

		const table = document.createElement('table');
		table.className = 'bordered';
		tableContainer.appendChild(table);

		let bitmap = new Uint32Array(256 * 192); // pre-allocated, resized as necessary

		let updateTable;
		const update = () => {
			const file = fs.get(paths[fileSelect.value]);
			const tables = unpackSegmented(file);
			const filteredTableIds = [];
			for (let i = 0; i < tables.length; ++i) {
				if (tables[i].byteLength) filteredTableIds.push(i);
			}
			scriptSelect.replaceWith(
				(scriptSelect = dropdown(
					filteredTableIds.map((x) => `Table ${x}`),
					0,
					() => updateTable(),
				)),
			);

			updateTable = () => {
				metaDisplay.innerHTML = '';
				fontTable.innerHTML = '';
				table.innerHTML = '';

				const canvasScale = [1, 1.5, 2][gameFontScale.value];

				const columns = unpackSegmented(tables[filteredTableIds[scriptSelect.value]]);
				mes.columns = columns;

				// determine rows, fonts, and zeroed columns
				const fontColumns = [];
				const zeroedColumns = []; // some columns are zeroed out
				const textColumns = [];
				for (let i = 0; i < columns.length; ++i) {
					if (!columns[i].byteLength) continue;

					// detect zeroed column
					const u8 = bufToU8(columns[i]);
					let o = 0;
					for (; o < u8.length; ++o) {
						if (u8[o]) break;
					}
					if (o >= u8.length) {
						zeroedColumns.push(i);
						continue;
					}

					// detect font column
					if (columns[i].byteLength >= 8) {
						const hypoCharMapSize = columns[i].getUint32(0, true);
						const hypoCharMapOffset = columns[i].getUint32(4, true);
						const roundedCharMapEnd = Math.ceil((hypoCharMapOffset + hypoCharMapSize) / 4) * 4;
						console.log(i, { hypoCharMapOffset, hypoCharMapSize, byteLength: columns[i].byteLength });
						if (roundedCharMapEnd === columns[i].byteLength) {
							// definitely a font
							fontColumns.push(i);
							continue;
						}
					}

					textColumns.push(i);
				}

				addHTML(metaDisplay, `<div>zeroedColumns: ${zeroedColumns.join(', ')}</div>`);

				// decorate font table
				for (const columnId of fontColumns) {
					const tr = document.createElement('tr');
					tr.innerHTML = `<th>Column ${columnId}</th>`;

					const td = document.createElement('td');
					tr.appendChild(td);

					const previews = fonts.preview(columns[columnId]);
					for (let i = 0; i < previews.length; ++i) {
						const { bitmap, width, height } = previews[i];
						const canvas = document.createElement('canvas');
						canvas.width = width;
						canvas.height = height;
						canvas.style.cssText = `width: ${width * canvasScale}px; height: ${height * canvasScale}px;` + (i + 1 < previews.length ? 'margin-bottom: 5px;' : '');
						td.appendChild(canvas);

						const ctx = canvas.getContext('2d');
						ctx.putImageData(new ImageData(bitmap, width, height), 0, 0);
					}

					fontTable.appendChild(tr);
				}

				// decorate textbox table
				const headerTr = document.createElement('tr');
				headerTr.innerHTML = '<th></th>';
				for (const columnId of textColumns) {
					headerTr.innerHTML += `<th>Column ${columnId}</th>`;
				}
				table.appendChild(headerTr);

				const chars = fonts.chars(fonts.default);
				const fallbackChars = new Map();
				for (const columnId of fontColumns) {
					for (const [key, val] of fonts.chars(columns[columnId])) {
						if (fallbackChars.has(key)) console.warn('OVERLAP:', key);
						fallbackChars.set(key, val);
					}
				}
				console.log('fallback:', fallbackChars);

				const columnTextboxes = textColumns.map(id => unpackSegmented(columns[id]));
				const tableLength = Math.max(...columnTextboxes.map(list => list.length));
				for (let i = 0; i < tableLength; ++i) {
					const tr = document.createElement('tr');
					tr.innerHTML = `<th>${i}</th>`;
					for (const textboxes of columnTextboxes) {
						const textbox = textboxes[i];
						if (!textbox) {
							addHTML(tr, '<td></td>');
							continue;
						}

						if (useGameFont.checked) {
							const td = document.createElement('td');

							const width = textbox.getUint8(0);
							const height = textbox.getUint8(1);
							const result = fonts.textbox(chars, fallbackChars, bitmap, sliceDataView(textbox, 2, textbox.byteLength), width, height);
							bitmap = result.bitmap;

							const canvas = document.createElement('canvas');
							canvas.width = result.width;
							canvas.height = result.height;
							canvas.style.cssText = `width: ${canvas.width * canvasScale}px; height: ${canvas.height * canvasScale}px;`;
							td.appendChild(canvas);

							const ctx = canvas.getContext('2d');
							const bitmapSlice = bufToU8Clamped(bitmap).slice(0, result.width * result.height * 4);
							console.log('HI:', bitmapSlice, result.width, result.height);
							const imgData = new ImageData(bitmapSlice, result.width, result.height);
							ctx.putImageData(imgData, 0, 0);
							tr.appendChild(td);
							console.log('OK');
						} else {
							addHTML(tr, `<td>${sanitize(readMessage(0, textbox, ignoreSpecials.checked)).replaceAll('\n', '<br>')}</td>`);
						}
					}

					table.appendChild(tr);
				}

				if (textColumns.length === 0) addHTML(metaDisplay, '(no text)');
			};
			updateTable();
		};
		update();

		return mes;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Disassembler                                                                                         |
	// +---------------------------------------------------------------------------------------------------------------+

	if (!window.initDisassembler) await waitFor(() => window.initDisassembler);
	window.initDisassembler();

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Sound Data (very unfinished)                                                                         |
	// +---------------------------------------------------------------------------------------------------------------+

	const sound = (window.sound = createSection('Sound (very unfinished)', (section) => {
		const sound = {};

		const soundFile = fs.get('/Sound/sound_data.sdat');

		const symbStart = soundFile.getUint32(0x10, true);
		const symbLength = soundFile.getUint32(0x14, true);
		const symbDat = (sound.symbDat = sliceDataView(soundFile, symbStart, symbStart + symbLength));

		const infoStart = soundFile.getUint32(0x18, true);
		const infoLength = soundFile.getUint32(0x1c, true);
		const infoDat = (sound.infoDat = sliceDataView(soundFile, infoStart, infoStart + infoLength));

		const fatStart = soundFile.getUint32(0x20, true);
		const fatLength = soundFile.getUint32(0x24, true);
		const fatDat = (sound.fatDat = sliceDataView(soundFile, fatStart, fatStart + fatLength));

		const fileStart = soundFile.getUint32(0x28, true);
		const fileLength = soundFile.getUint32(0x2c, true);
		const fileDat = (sound.fileDat = sliceDataView(soundFile, fileStart, fileStart + fileLength));

		window.infoDat = infoDat;
		window.symbDat = symbDat;
		window.fatDat = fatDat;
		window.fileDat = fileDat;

		// symb block
		const symbFileList = (o) => {
			const length = symbDat.getUint32(o, true);
			const files = [];
			for (let i = 0; i < length; ++i) files.push(latin1(symbDat.getUint32(o + i * 4, true), undefined, symbDat));
			return files;
		};
		const symbFolderList = (o) => {
			const length = symbDat.getUint32(o, true);
			const folders = [];
			for (let i = 0; i < length; ++i) {
				const name = latin1(symbDat.getUint32(o + 4 + i * 8, true), undefined, symbDat);
				const files = symbFileList(symbDat.getUint32(o + 8 + i * 8, true));
				folders.push([name, files]);
			}
			return folders;
		};
		const symb = {};
		symb.sseq = symbFileList(symbDat.getUint32(8, true));
		symb.ssar = symbFolderList(symbDat.getUint32(12, true));
		symb.bank = symbFileList(symbDat.getUint32(16, true));
		symb.swar = symbFileList(symbDat.getUint32(20, true));
		symb.player = symbFileList(symbDat.getUint32(24, true));
		symb.group = symbFileList(symbDat.getUint32(28, true));
		symb.player2 = symbFileList(symbDat.getUint32(32, true));
		symb.strm = symbFileList(symbDat.getUint32(36, true));

		// LET"S try this again
		const symbSseqOffset = symbDat.byteLength ? symbDat.getUint32(8, true) : 0;
		const infoSseqOffset = infoDat.getUint32(8, true);
		const infoSseqLength = infoDat.getUint32(infoSseqOffset, true);
		for (let i = 0; i < infoSseqLength; ++i) {
			const offset = infoDat.getUint32(infoSseqOffset + 4 + i * 4, true);
			const segment = sliceDataView(infoDat, offset, offset + 12);
			const fatId = segment.getUint16(0, true);
			const bank = segment.getUint16(4, true);
			const volume = segment.getUint8(6);
			const cpr = segment.getUint8(7);
			const ppr = segment.getUint8(8);
			const ply = segment.getUint8(9);

			let name = '';
			if (symbDat.byteLength) {
				const nameOffset = symbDat.getUint32(symbSseqOffset + 4 + i * 4, true);
				name = latin1(nameOffset, undefined, symbDat);
			}

			let html = `sseq[${i}] : ${name} (fatId ${fatId}) (bank ${bank}) (volume ${volume}) (cpr ${cpr}) (ppr ${ppr}) (ply ${ply});`;
			if (12 + fatId * 16 + 8 <= fatDat.byteLength) {
				const fileStart = fatDat.getUint32(12 + fatId * 16, true);
				const fileSize = fatDat.getUint32(12 + fatId * 16 + 4, true);
				html += ` (fileStart 0x${str32(fileStart)}) (fileSize 0x${fileSize.toString(16)})`;
			}
			addHTML(section, `<div><code>${html}</code></div>`);
		}

		return sound;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Object Palette Animations (very unfinished)                                                          |
	// +---------------------------------------------------------------------------------------------------------------+

	const objpalanim = (window.objpalanim = createSection('Object Palette Animations (very unfinished)', (section) => {
		const objpalanim = {};

		const fileSelect = dropdown(['FObj'], 0, () => updateFile());
		section.appendChild(fileSelect);

		const table = document.createElement('table');
		table.style.cssText = 'border-collapse: collapse;';
		section.appendChild(table);

		const updateFile = () => {
			let paletteTable, segmentsTable;
			if (fileSelect.value === 0) paletteTable = fsext.fobjPalettes, segmentsTable = fsext.fobj;

			if (!paletteTable) {
				table.innerHTML = '<tr><td>This entry doesn\'t exist in fpaf</td></tr>';
				return;
			}

			table.innerHTML = '';
			for (let i = 0; i < paletteTable.length; ++i) {
				const palAnimIndex = paletteTable[i].getInt16(2, true);
				if (palAnimIndex === -1) continue;

				const bigSeg = fsext.fobj.segments[palAnimIndex];
				let segments;
				try {
					segments = unpackSegmented16(bigSeg);
				} catch (err) {
					addHTML(table, `<tr style="border-bottom: 1px solid #666;">
						<td><code>${i}</code></td>
						<td style="padding: 10px 0;"><code>${bytes(0, bigSeg.byteLength, bigSeg)}</code></td>
					</tr>`);
					continue;
				}

				const items = [`<li><code>${bytes(0, segments[0].byteLength, segments[0])}</code></li>`];
				for (let i = 1; i < segments.length - 1; ++i) {
					try {
						items.push(`<li><code>${fpaf.stringify([segments[i]]).join('<br>')}</code></li>`);
					} catch (err) {
						items.push(`<li><code>${bytes(0, segments[i].byteLength, segments[i])}</code></li>`);
					}
				}

				addHTML(
					table,
					`<tr style="border-bottom: 1px solid #666;">
						<td><code>${i} (s${palAnimIndex})</code></td>
						<td style="padding: 10px 0;"><ul>${items.join('')}</ul></td>
					</tr>`,
				);
			}
		};
		updateFile();

		return objpalanim;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Fx (very unfinished)                                                                                 |
	// +---------------------------------------------------------------------------------------------------------------+

	const fx = (window.fx = createSection('Fx (very unfinished)', (section) => {
		const options = [];
		for (let i = 0; i < fsext.bdfxtex.segments.length; ++i) {
			options.push({
				name: `BDfx 0x${i.toString(16)}`,
				tex: fsext.bdfxtex.segments[i],
				pal: fsext.bdfxpal.segments[i],
			});
		}
		for (let i = 0; i < fsext.bofxtex.segments.length; ++i) {
			options.push({
				name: `BOfx 0x${i.toString(16)}`,
				tex: fsext.bofxtex.segments[i],
				pal: fsext.bofxpal.segments[i],
			});
		}
		/*for (let i = 0; i < fsext.fdfxtex.segments.length; ++i) {
		options.push({ name: `FDfx 0x${i.toString(16)}`, tex: fsext.fdfxtex.segments[i], pal: fsext.fdfxpal.segments[i] });
	}
	for (let i = 0; i < fsext.fofxtex.segments.length; ++i) {
		options.push({ name: `FOfx 0x${i.toString(16)}`, tex: fsext.fofxtex.segments[i], pal: fsext.fofxpal.segments[i] });
	}
	for (let i = 0; i < fsext.mdfxtex.segments.length; ++i) {
		options.push({ name: `MDfx 0x${i.toString(16)}`, tex: fsext.mdfxtex.segments[i], pal: fsext.mdfxpal.segments[i] });
	}
	for (let i = 0; i < fsext.mofxtex.segments.length; ++i) {
		options.push({ name: `MOfx 0x${i.toString(16)}`, tex: fsext.mofxtex.segments[i], pal: fsext.mofxpal.segments[i] });
	}*/

		const select = dropdown(
			options.map((x) => x.name),
			0,
			() => render(),
		);
		section.appendChild(select);

		const paletteShift = dropdown(
			[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0xa, 0xb, 0xc, 0xd, 0xe, 0xf].map((x) => `Palette Row 0x${x.toString(16)}`),
			0,
			() => render(),
		);
		section.appendChild(paletteShift);

		const componentPreview = document.createElement('div');
		componentPreview.style.cssText = 'height: 256px; position: relative;';
		section.appendChild(componentPreview);

		const tileset256Canvas = document.createElement('canvas');
		tileset256Canvas.width = tileset256Canvas.height = 256;
		tileset256Canvas.style.cssText = 'width: 256px; height: 256px; position: absolute; top: 0; left: 0;';
		componentPreview.appendChild(tileset256Canvas);

		const tileset16Canvas = document.createElement('canvas');
		tileset16Canvas.width = tileset16Canvas.height = 256;
		tileset16Canvas.style.cssText = 'width: 256px; height: 256px; position: absolute; top: 0; left: 256px;';
		componentPreview.appendChild(tileset16Canvas);

		const paletteCanvas = document.createElement('canvas');
		paletteCanvas.width = paletteCanvas.height = 16;
		paletteCanvas.style.cssText = 'width: 128px; height: 128px; position: absolute; top: 0; left: 512px;';
		componentPreview.appendChild(paletteCanvas);

		const render = () => {
			const option = options[select.value];

			const paletteCtx = paletteCanvas.getContext('2d');
			if (option.pal.byteLength >= 516) {
				const paletteBitmap = new Uint8ClampedArray(256 * 4);
				for (let i = 0; i < 256; ++i) {
					writeRgb16(paletteBitmap, i, option.pal.getUint16(4 + i * 2, true));
				}
				paletteCtx.putImageData(new ImageData(paletteBitmap, 16, 16), 0, 0);
			} else {
				paletteCtx.clearRect(0, 0, 16, 16);
			}

			const tileset256Ctx = tileset256Canvas.getContext('2d');
			const tileset16Ctx = tileset16Canvas.getContext('2d');
			if (option.pal.byteLength >= 516) {
				const tileset = lzBis(option.tex);
				const tileset256Bitmap = new Uint8ClampedArray(256 * 256 * 4);
				const tileset16Bitmap = new Uint8ClampedArray(256 * 256 * 4);

				const paletteRow = paletteShift.value << 4;

				let o256 = 0;
				let o16 = 0;
				for (let i = 0; o256 < tileset.byteLength || o16 < tileset.byteLength; ++i) {
					const basePos = ((i >> 5) << 11) | ((i & 0x1f) << 3); // y = i >> 5, x = i & 0x1f
					// 256-color
					for (let j = 0; j < 64 && o256 < tileset.byteLength; ++j) {
						const pos = basePos | ((j >> 3) << 8) | (j & 0x7);
						const paletteIndex = tileset.getUint8(o256++);
						writeRgb16(tileset256Bitmap, pos, option.pal.getUint16(4 + paletteIndex * 2, true));
					}

					// 16-color
					for (let j = 0; j < 64 && o16 < tileset.byteLength; j += 2) {
						const pos = basePos | ((j >> 3) << 8) | (j & 0x7);
						const composite = tileset.getUint8(o16++);
						writeRgb16(
							tileset16Bitmap,
							pos,
							option.pal.getUint16(4 + (paletteRow | (composite & 0xf)) * 2, true),
						);
						writeRgb16(
							tileset16Bitmap,
							pos ^ 1,
							option.pal.getUint16(4 + (paletteRow | (composite >> 4)) * 2, true),
						);
					}
				}

				tileset256Ctx.putImageData(new ImageData(tileset256Bitmap, 256, 256), 0, 0);
				tileset16Ctx.putImageData(new ImageData(tileset16Bitmap, 256, 256), 0, 0);
			} else {
				tileset256Ctx.clearRect(0, 0, 256, 256);
				tileset16Ctx.clearRect(0, 0, 256, 256);
			}
		};
		render();
	}));

	// add spacing to the bottom of the page, for better scrolling
	addHTML(document.body, '<div style="height: 100vh;"></div>');

	// devtools console help
	const loadingEnd = performance.now();
	console.log(`File read in ${sectionLoadingStart - fileLoadingStart} ms; loaded in ${loadingEnd - sectionLoadingStart} ms`);

	console.log(
		`Dumping functions: \
	\n%clatin1(off, len, dat) \nbytes(off, len, dat) \nbits(off, len, dat) \
	\ndownload(name, dat, mime = 'application/octet-stream') %c \
	\n\nCompression/Packing functions: \
	\n%cblz(indat) \nblzCompress(indat, minimumSize?) \nlzBis(indat) \nlzBisCompress(indat, blockSize = 512) \
	\nzipStore(files) \nunpackSegmented(dat) %c \
	\n\nView functions: \
	\n%csliceDataView(dat, start, end) \nbufToU8(buf) \nbufToU8Clamped(buf) \nbufToU16(buf) \nbufToS16(buf) \
	\nbufToU32(buf) \nbufToDat(buf) \nstr8(x) \nstr16(x) \nstr32(x) %c \
	\n\nSections: \
	\n%cheaders fs fsext field fmapdataTiles battle battleGiant fx mfset mes disassembler sound %c \
	\n\nFile: %cfile%c`,
		'color: #3cc;',
		'color: unset;',
		'color: #3cc;',
		'color: unset;',
		'color: #3cc;',
		'color: unset;',
		'color: #3cc;',
		'color: unset;',
		'color: #3cc;',
		'color: unset;',
	);
})();
