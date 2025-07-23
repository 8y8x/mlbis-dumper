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

	const writeRgb16 = (bitmap, pixel, rgb16) => {
		const r = rgb16 & 0x1f;
		const g = rgb16 >> 5 & 0x1f;
		const b = rgb16 >> 10 & 0x1f;
		bitmap[pixel*4] = r << 3 | r >> 2;
		bitmap[pixel*4 + 1] = g << 3 | g >> 2;
		bitmap[pixel*4 + 2] = b << 3 | b >> 2;
		bitmap[pixel*4 + 3] = 255;
	};

	Object.assign(window, { file, readString, bytes });

	//////////////////// Compression/Packing ////////////////////////////////////////////////////////////////////

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

	/**
	 * Decompresses the custom lzss-like used in various BIS files
	 */
	const lzssBis = indat => {
		let inoff = 0;
		const readFunnyVarLength = () => {
			const composite = indat.getUint8(inoff++);
			const blen = composite >> 6;
			let out = composite & 0x3f;

			for (let i = 0, shift = 6; i < blen; ++i, shift += 6) out |= indat.getUint8(inoff++) << shift;
			return out;
		};

		const outsize = readFunnyVarLength();
		const blocks = readFunnyVarLength() + 1;

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

	/**
	 * Compresses the custom lzss-like format used in various BIS files.
	 * The compression matches **exactly** what you would find in a ROM. (i.e. lzssBisCompress(lzssBis(dat)) = dat)
	 * Use `optimize` if you need the compressed output to be even smaller.
	 */
	const lzssBisCompress = (indat, optimize) => {
		const outbuf = new Uint8Array(indat.byteLength * 2);
		let outoff = 0;
		const writeFunnyVarLength = x => {
			if (x < (1 << 6)) {
				outbuf[outoff++] = x;
			} else if (x < (1 << 14)) {
				outbuf[outoff++] = (x & 0x3f) | 0x40;
				outbuf[outoff++] = x >> 6;
			} else {
				outbuf[outoff++] = (x & 0x3f) | 0x80;
				outbuf[outoff++] = x >> 6 & 0xff; // note that these two overlap, i'm not sure why,
				outbuf[outoff++] = x >> 12; // but they do, and that's how it is
			}
		};
		writeFunnyVarLength(indat.byteLength);

		// each compression block will decompress into exactly 512 bytes of output
		const blockSize = optimize ? 2048 : 512; // MLBIS crashes if this is too big (4096)
		const inblocks = [];
		for (let blockStart = 0; blockStart < indat.byteLength; blockStart += blockSize) {
			inblocks.push(sliceDataView(indat, blockStart, Math.min(blockStart + blockSize, indat.byteLength)));
		}
		writeFunnyVarLength(inblocks.length - 1);

		for (let i = 0; i < inblocks.length; ++i) {
			const inblock = inblocks[i];
			const blockLengthOffset = outoff;
			outoff += 2;

			let controlByteOffset = outoff++;
			let controlByteEntries = 0;

			for (let inoff = 0; inoff < inblock.byteLength;) {
				const byte = inblock.getUint8(inoff);
				if (inoff + 1 >= inblock.byteLength) { // only a literal makes sense right now
					++inoff;
					outbuf[outoff++] = byte;
					outbuf[controlByteOffset] |= 1 << (controlByteEntries++ * 2);

					if (controlByteEntries >= 4) {
						controlByteOffset = outoff++;
						controlByteEntries = 0;
					}
					break;
				}

				const next = inblock.getUint8(inoff + 1);

				let bestRepetitions = 1;
				let bestBackReference = 0;
				let bestBackReferenceOffset;
				if (byte === next) { // repeated bytes; see how far the repetition goes
					for (bestRepetitions = 2; bestRepetitions < 257 && inoff + bestRepetitions < inblock.byteLength; ++bestRepetitions) {
						if (inblock.getUint8(inoff + bestRepetitions) !== byte) break;
					}
				}

				// try back-references
				if (bestRepetitions <= 16) {
					const short = next << 8 | byte;
					const globalInoff = inoff + i * blockSize;
					for (let j = Math.min(4095, globalInoff); j >= 2; --j) {
						const seekedShort = indat.getUint16(globalInoff - j, true);
						if (seekedShort === short) {
							let length = 2;
							for (; length < 17 && length < j && inoff + length < inblock.byteLength; ++length) {
								if (inblock.getUint8(inoff + length) !== indat.getUint8(globalInoff - j + length)) break;
							}

							if (length > bestBackReference) {
								bestBackReference = length;
								bestBackReferenceOffset = j;
							}
						}
					}
				}

				if (bestBackReference > bestRepetitions && bestBackReference >= 2) { // prefer back references
					outbuf[outoff++] = bestBackReferenceOffset & 0xff;
					outbuf[outoff++] = (bestBackReferenceOffset >> 4 & 0xf0) | (bestBackReference - 2);
					inoff += bestBackReference;

					outbuf[controlByteOffset] |= 2 << (controlByteEntries++ * 2);
				} else if (bestRepetitions >= 2) { // prefer repetitions
					outbuf[outoff++] = bestRepetitions - 2;
					outbuf[outoff++] = byte;
					inoff += bestRepetitions;

					outbuf[controlByteOffset] |= 3 << (controlByteEntries++ * 2);
				} else { // prefer literal
					outbuf[outoff++] = byte;
					++inoff;

					outbuf[controlByteOffset] |= 1 << (controlByteEntries++ * 2);
				}

				if (controlByteEntries >= 4) {
					controlByteOffset = outoff++;
					controlByteEntries = 0;
				}
			}

			const blockLength = outoff - blockLengthOffset - 2;
			outbuf[blockLengthOffset] = blockLength & 0xff;
			outbuf[blockLengthOffset + 1] = blockLength >> 8;
		}

		return new DataView(outbuf.buffer, 0, Math.ceil(outoff / 4) * 4);
	};

	const unpackSegmented = dat => {
		if (dat.byteLength < 4) return [];
		const offsetsEnd = dat.getUint32(0, true);
		let lastSplit = offsetsEnd;
		const segments = [];
		for (let o = 4; o < offsetsEnd; o += 4) {
			const split = dat.getUint32(o, true);
			segments.push(sliceDataView(dat, lastSplit, split));
			lastSplit = split;
		}

		segments.push(sliceDataView(dat, lastSplit, dat.byteLength));
		return segments;
	};

	const unpackSegmented16 = dat => {
		if (dat.byteLength < 2) return [];
		const offsets = [dat.getUint16(0, true)];
		const segments = [];
		for (let o = 2; o < offsets[0] * 2; o += 2) {
			
		}
	};

	/**
	 * Creates an uncompressed .zip archive containing multiple files
	 * @param {{ name: string, dat: DataView }[]} files
	 * @returns {DataView}
	 */
	const zipStore = files => {
		// https://pkware.cachefly.net/webdocs/APPNOTE/APPNOTE-1.0.txt
		let expectedSize = 26; // end of central directory
		for (const file of files) {
			expectedSize += 30 + file.name.length; // local file header
			expectedSize += file.dat.byteLength; // file data
			expectedSize += 46 + file.name.length; // central directory header
		}

		const dat = new DataView(new ArrayBuffer(expectedSize));
		const out8 = new Uint8Array(dat.buffer);
		let o = 0;

		// without specifying time (in MS-DOS format), files appear modified in 1979, which looks wrong
		const now = new Date();
		const date = now.getDate() | (now.getMonth() + 1) << 5 | (now.getFullYear() - 1980) << 9;
		const time = now.getSeconds() >> 1 | now.getMinutes() << 5 | now.getHours() << 11;

		// crc table (for speed)
		// TARGET: BA 78 E8 55, or 0x55e878ba
		// https://stackoverflow.com/questions/18638900/javascript-crc32
		const crcTable = new Uint32Array(256);
		for (let i = 0; i < 256; ++i) {
			let r = i;
			for (let j = 0; j < 8; ++j) {
				if (r & 1) r = 0xedb88320 ^ (r >>> 1);
				else r >>>= 1;
			}
			crcTable[i] = r;
		}

		// local files
		const crc32s = [];
		const localHeaders = [];
		for (const { dat: fileDat, name } of files) {
			// local file header
			localHeaders.push(o);

			dat.setUint32(o, 0x04034b50, true); o += 4; // local file header signature
			dat.setUint16(o, 0, true); o += 2; // version needed to extract (0)
			dat.setUint16(o, 0, true); o += 2; // general purpose bit flag (0)
			dat.setUint16(o, 0, true); o += 2; // compression method (0 = no compression)
			dat.setUint16(o, time, true); o += 2; // last mod file time (0)
			dat.setUint16(o, date, true); o += 2; // last mod file date (0)
			const crc32LocalOffset = o; o += 4; // write crc-32 later
			dat.setUint32(o, fileDat.byteLength, true); o += 4; // compressed size (0 = no compression)
			dat.setUint32(o, fileDat.byteLength, true); o += 4; // uncompressed size
			dat.setUint16(o, name.length, true); o += 2; // file name length
			dat.setUint16(o, 0, true); o += 2; // extra field length

			// file name (part of local file header)
			for (let i = 0; i < name.length; ++i) dat.setUint8(o++, name.charCodeAt(i));

			// file data (in the meantime, calculate the crc32)
			// https://stackoverflow.com/questions/18638900/javascript-crc32
			let crc32 = 0xffffffff;
			for (let i = 0; i < fileDat.byteLength; ++i) {
				const byte = fileDat.getUint8(i);
				crc32 = (crc32 >>> 8) ^ crcTable[(crc32 & 0xff) ^ byte];
				out8[o++] = byte;
			}

			crc32 ^= 0xffffffff;
			dat.setUint32(crc32LocalOffset, crc32, true);
			crc32s.push(crc32);
		}

		// central directory
		const centralDirOffset = o;
		for (let i = 0; i < files.length; ++i) {
			const { dat: fileDat, name } = files[i];
			dat.setUint32(o, 0x02014b50, true); o += 4; // central file header signature
			dat.setUint16(o, 0x031e, true); o += 2; // version made by (3 = unix)
			dat.setUint16(o, 0, true); o += 2; // version needed to extract (0)
			dat.setUint16(o, 0, true); o += 2; // general purpose bit flag
			dat.setUint16(o, 0, true); o += 2; // compression method (0 = no compression)
			dat.setUint16(o, time, true); o += 2; // last mod file time
			dat.setUint16(o, date, true); o += 2; // last mod file date
			dat.setUint32(o, crc32s[i], true); o += 4; // crc32
			dat.setUint32(o, fileDat.byteLength, true); o += 4; // compressed size (no compression is done)
			dat.setUint32(o, fileDat.byteLength, true); o += 4; // uncompressed size
			dat.setUint16(o, name.length, true); o += 2; // file name length
			dat.setUint16(o, 0, true); o += 2; // extra field length
			dat.setUint16(o, 0, true); o += 2; // file comment length
			dat.setUint16(o, 0, true); o += 2; // disk number start
			dat.setUint16(o, 0, true); o += 2; // internal file attributes
			dat.setUint32(o, 0, true); o += 4; // external file attributes
			dat.setInt32(o, localHeaders[i], true); o += 4; // relative offset of local header

			// file name
			for (let i = 0; i < name.length; ++i) dat.setUint8(o++, name.charCodeAt(i));
		}
		const centralDirSize = o - centralDirOffset;

		// end of central dir record
		dat.setUint32(o, 0x06054b50, true); o += 4; // end of central dir signature
		dat.setUint16(o, 0, true); o += 2; // number of this disk
		dat.setUint16(o, 0, true); o += 2; // number of the disk...central directory
		dat.setUint16(o, file.length, true); o += 2; // total number of entries...on this disk
		dat.setUint16(o, file.length, true); o += 2; // total number of entries...central dir
		dat.setUint32(o, centralDirSize, true); o += 4; // size of the central directory
		dat.setInt32(o, centralDirOffset, true); o += 4; // offset of start of central directory...
		dat.setUint32(o, 0, true); o += 4; // starting disk number
		dat.setUint16(o, 0, true); o += 2; // zipfile comment length

		return dat;
	};

	const sliceDataView = (dat, start, end) => new DataView(dat.buffer, dat.byteOffset + start, end - start);

	Object.assign(window, { lzssBackwards, lzssBis, lzssBisCompress, sliceDataView, unpackSegmented, zipStore });

	//////////////////// Misc ////////////////////////////////////////////////////////////////////////////////

	const download = (name, mime, dat) => {
		const blob = new Blob([dat], { type: mime });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = name;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000); // idk if a timeout is really necessary
	};

	Object.assign(window, { download });

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

		const singleExport = document.createElement('div');
		singleExport.textContent = 'File: ';
		section.appendChild(singleExport);

		const fileSelectEntries = [];
		for (let i = 0; i < headers.fatLength / 8; ++i) {
			const fsentry = fs.get(i);
			fileSelectEntries.push(`${str8(i)}. (len 0x${(fsentry.end - fsentry.start).toString(16)}) ${sanitize(fsentry.path)}`);
		}
		const fileSelect = dropdown(fileSelectEntries, 0, () => {});
		singleExport.appendChild(fileSelect);

		const singleDecompression = dropdown(['No decompression', 'Backwards LZSS'], 0, () => {}, true);
		singleExport.appendChild(singleDecompression);

		const singleDump = document.createElement('button');
		singleDump.textContent = 'Dump';
		singleExport.appendChild(singleDump);

		const downloadOutput = document.createElement('div');
		singleExport.appendChild(downloadOutput);

		singleDump.addEventListener('mousedown', () => {
			const fsentry = fs.get(parseInt(fileSelect.value));

			let output;
			if (singleDecompression.value === '0') output = file.buffer.slice(fsentry.start, fsentry.end);
			else if (singleDecompression.value === '1') output = lzssBackwards(fsentry.end, file, fsentry.end - fsentry.start);

			if (!output) {
				downloadOutput.textContent = 'Failed to load/decompress';
				return;
			}

			downloadOutput.textContent = '';
			download(fsentry.name, 'application/octet-stream', output);
		});

		const multiExport = document.createElement('div');
		multiExport.textContent = 'Everything: ';
		section.appendChild(multiExport);

		const multiDecompression = dropdown(['Backwards LZSS only on overlays', 'No decompression'], 0, () => {}, true);
		multiExport.appendChild(multiDecompression);

		const multiDump = document.createElement('button');
		multiDump.textContent = 'Dump Everything';
		multiExport.appendChild(multiDump);
		
		multiDump.addEventListener('mousedown', () => {
			const files = [];
			for (let i = 0; i < headers.fatLength / 8; ++i) {
				const fsentry = fs.get(i);
				let dat = fsentry;
				let name = fsentry.name;
				if (multiDecompression.value === '0' && fsentry.path === '<overlay?>') {
					dat = lzssBackwards(dat.byteLength, dat, dat.byteLength);
					if (dat) { // if decompression succeeded
						// rename /dir/file.xyz => /dir/file-dec.xyz
						const parts = name.split('.');
						name = parts.pop();
						name = `${parts.join('.')}-dec.${name}`;
					} else {
						dat = fsentry;
					}
				}
				files.push({ name, dat });
			}

			const zip = zipStore(files);
			download(`${headers.gamecode}.zip`, 'application/zip', zip);
		});

		addHTML(section, '<div style="height: 1em;"></div>'); // separator

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

			if (segmentsDat) segments.push(sliceDataView(segmentsDat, offsets[offsets.length - 1], segmentsDat.byteLength));

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
			fsext.bofxtex = varLengthSegments(0x7c90, overlay0e, fs.get('/BRfx/BOfxTex.dat')); // tile data is probably right next to it, again
			fsext.bofxpal = varLengthSegments(0x7ca8, overlay0e, fs.get('/BRfx/BOfxPal.dat')); // seems like palette data
			fsext.bmapg = varLengthSegments(0x7cc0, overlay0e, fs.get('/BMapG/BMapG.dat'));
			fsext.bdfxtex = varLengthSegments(0x7cd8, overlay0e, fs.get('/BRfx/BDfxTex.dat')); // might be BDfxGAll.dat instead
			fsext.bdfxpal = varLengthSegments(0x7d0c, overlay0e, fs.get('/BRfx/BDfxPal.dat')); // all segments seem to be 514 in length, so probably palettes
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
		const showLayerAnimations = checkbox('Layer Animation Regions', false, () => { updateMaps = true; });
		options.appendChild(showLayerAnimations);

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
					rotY = Math.min(Math.max(rotY - (e.clientY - lastClientY) * 0.01, 0), Math.PI * 3 / 4);
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

		let collisionSelect, loadingZonesSelect;
		const enabledLayerAnimations = new Set();
		const enabledTileAnimations = new Set();
		let tilesets, props, room;
		const roomPicked = () => {
			room = field.rooms[parseInt(roomPicker.value)];

			const layer = index => lzssBis(fsext.fmapdata.segments[index]);
			tilesets = [room.l1, room.l2, room.l3].map(l => l !== -1 && layer(l));
			window.EXP = layer(room.props);
			props = unpackSegmented(layer(room.props));
			Object.assign(props, {
				tiles: [props[0], props[1], props[2]],
				palettes: [props[3], props[4], props[5]],
				map: props[6],
				loadingZones: props[7],
				unknown8: props[8],
				layerAnimations: props[9],
				tileAnimations: props[10],
				unknown11: props[11],
				unknown12: props[12],
				unknown13: props[13],
				collision: props[14],
				depth: props[15],
				unknown16: props[16],
				unknown17: props[17],
			});

			bottomProperties.innerHTML = sideProperties.innerHTML = '';

			addHTML(bottomProperties, `<div>Layers: <code>BG1 ${room.l1.toString(16)}, BG2 ${room.l2.toString(16)}, BG3 ${room.l3.toString(16)}, Props ${room.props.toString(16)}, ??? ${room.unknown.toString(16)}</code></div>`);

			const mapWidth = props.map.getUint16(0, true);
			const mapHeight = props.map.getUint16(2, true);
			const mapActualHeight = Math.max(props.tiles[0].byteLength, props.tiles[1].byteLength, props.tiles[2].byteLength) / 2 / mapWidth;
			const mapFlags = [0,1,2,3,4,5,6,7,8,9,10,11].map(x => props.map.getUint8(x));
			addHTML(sideProperties, `<div><code>${mapWidth}x${mapHeight} tiles (${mapWidth}x${mapActualHeight} actual),
				(${mapWidth * 8}x${mapHeight * 8} px)
			</code></div>`);

			const bgAttrs = [[], [], []];
			if (mapFlags[5] & 0x08) bgAttrs[1].push('above obj');
			if (mapFlags[5] & 0x10) bgAttrs[0].push('above obj');
			if (mapFlags[8] & 0x01) bgAttrs[2].push('above BG2');
			if (mapFlags[8] & 0x02) bgAttrs[2].push('above BG1');
			if (mapFlags[8] & 0x20) bgAttrs[0].push('autoscrolls');
			if (mapFlags[8] & 0x40) bgAttrs[1].push('autoscrolls');
			if (mapFlags[8] & 0x80) bgAttrs[2].push('autoscrolls');

			for (let i = 0; i < 3; ++i) {
				const layerFlags = mapFlags[9 + i];

				const horizontalSpeed = layerFlags & 0x07;
				const horizontalLocked = layerFlags & 0x08;
				const verticalSpeed = (layerFlags & 0x70) >> 4;
				const verticalLocked = layerFlags & 0x80;
				if (horizontalLocked && verticalLocked) bgAttrs[i].push('locked horizontally + vertically');
				else if (horizontalLocked) bgAttrs[i].push('locked horizontally');
				else if (verticalLocked) bgAttrs[i].push('locked vertically');
				if (horizontalSpeed) bgAttrs[i].push(['', '0.25x', '0.5x', '2x', '-1x', '-0.25x', '-0.5x', '-1x'][horizontalSpeed] + ' horizontal');
				if (verticalSpeed) bgAttrs[i].push(['', '0.25x', '0.5x', '2x', '-1x', '-0.25x', '-0.5x', '-1x'][verticalSpeed] + ' vertical');
			}

			for (let i = 0; i < 3; ++i) { 
				if (!bgAttrs[i].length) continue;
				addHTML(sideProperties, `<div>BG${i + 1}: ${bgAttrs[i].join(', ')}</div>`);
			}

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
				const segments = unpackSegmented(props.layerAnimations);
				enabledLayerAnimations.clear();

				const div = document.createElement('div');
				div.textContent = 'Layer animations: ';

				let j = 0;
				for (let i = 1; i < segments.length; i += 3) {
					if (segments[i].byteLength < 8) continue;

					const check = checkbox('', false, () => {
						if (check.checked) enabledLayerAnimations.add(segments[i]);
						else enabledLayerAnimations.delete(segments[i]);
						updateMaps = true;
					});
					div.appendChild(check);

					++j;
				}

				sideProperties.appendChild(div);
			}

			{
				const segments = unpackSegmented(props.tileAnimations);
				enabledTileAnimations.clear();

				const div = document.createElement('div');
				div.textContent = 'Tile animations: ';

				for (let i = 0; i < segments.length; ++i) {
					const animeIndex = segments[i].getUint16(4, true);
					const animTileset = lzssBis(fsext.fmapdata.segments[fsext.fieldAnimeIndices[animeIndex]]);
					const obj = { anim: segments[i], tileset: animTileset };
					const check = checkbox('', false, () => {
						if (check.checked) enabledTileAnimations.add(obj);
						else enabledTileAnimations.delete(obj);
						updateTiles = true;
					});
					div.appendChild(check);
				}

				sideProperties.appendChild(div);
			}

			addHTML(bottomProperties, `<div>unknown8: <code>${bytes(0, props.unknown8.byteLength, props.unknown8)}</code></div>`);

			addHTML(bottomProperties, `<div>Layer animations:</div>`);
			const animationList = document.createElement('ul');
			const animationSegments = unpackSegmented(props.layerAnimations);
			for (let i = 0; i < animationSegments.length; ++i) {
				if ((i % 3 === 1) && animationSegments[i].byteLength >= 8) {
					const x = animationSegments[i].getInt16(0, true);
					const y = animationSegments[i].getInt16(2, true);
					const w = animationSegments[i].getInt16(4, true);
					const h = animationSegments[i].getInt16(6, true);
					addHTML(animationList, `<li>${i}: (${x}, ${y}), size (${w} x ${h})</li>`);
				} else {
					addHTML(animationList, `<li>${i}: <code>${bytes(0, animationSegments[i].byteLength, animationSegments[i])}</code></li>`);
				}
			}
			bottomProperties.appendChild(animationList);

			addHTML(bottomProperties, `<div>Tile Animations:</div>`);
			const passiveAnimationList = document.createElement('ul');
			const passiveAnimationSegments = unpackSegmented(props.tileAnimations);
			for (let i = 0; i < passiveAnimationSegments.length; ++i) {
				const first = bytes(0, 4, passiveAnimationSegments[i]);
				const first32 = passiveAnimationSegments[i].getUint32(0, true);
				const firstComponents = `${first32 >> 14 & 1023} tiles, ${first32 >> 7 & 0x7f} x, ${first32 & 0x7f} y`;
				const second = bytes(4, 2, passiveAnimationSegments[i]);
				const third = bytes(6, 2, passiveAnimationSegments[i]);
				const parts = [];
				for (let o = 8; o < passiveAnimationSegments[i].byteLength; o += 4) {
					parts.push(`<span style="color: ${(o & 4) ? '#666' : '#999'}">${bytes(o, 4, passiveAnimationSegments[i])}`);
				}
				addHTML(passiveAnimationList, `<li>${i}: <code>
					<span style="color: #f99;">${first} (${firstComponents})</span> <span style="color: #9f9;">${second}</span>
					<span style="color: #99f;">${third}</span> ${parts.join(' ')}
				</code></li>`);
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

		// rendering
		const shades = [];
		const genShade = index => shades[index] || (shades[index] = Math.random() * 0.5 + 0.5);

		const render = () => {
			const mapWidth = props.map.getInt16(0, true);
			const mapHeight = props.map.getInt16(2, true);
			const mapFlags = props.map.getUint16(4, true);

			const now = performance.now();
			const tick = Math.floor(now / 1000 * 60);

			if (updatePalettes) {
				console.debug('updatePalettes');

				const bitmap = new Uint8ClampedArray(256 * 4);
				for (let i = 0; i < 3; ++i) {
					const ctx = paletteCanvases[i].getContext('2d');
					if (props.palettes[i].byteLength !== 512) {
						ctx.clearRect(0, 0, 16, 16);
						continue;
					}

					for (let j = 0; j < 256; ++j) writeRgb16(bitmap, j, props.palettes[i].getUint16(j * 2, true));

					ctx.putImageData(new ImageData(bitmap, 16, 16), 0, 0);
				}
			}

			if (enabledTileAnimations.size > 0) updateTiles = true;
			if (updateTiles || updatePalettes) {
				console.debug('updateTiles');

				for (let i = 0; i < 3; ++i) {
					const ctx = tileCanvases[i].getContext('2d');
					const palette = props.palettes[i];
					const tileset = tilesets[i];
					if (!tileset.byteLength || palette.byteLength !== 512) {
						ctx.clearRect(0, 0, 256, 256);
						continue;
					}

					const bitmap = new Uint8ClampedArray(256 * 256 * 4);
					let o = 0;
					for (let j = 0; j * 64 < tileset.byteLength; ++j) {
						let tileIndex = j;
						let thisTileset = tileset;
						for (const { anim, tileset: animTileset } of enabledTileAnimations) {
							const field = anim.getUint32(0, true);
							const layer = field & 3;
							if (room[['l1', 'l2', 'l3'][i]] !== room[['l1', 'l2', 'l3'][layer]]) continue;

							const replacementStart = field >> 4 & 0x3ff;
							const frameWidth = field >> 14 & 0x3ff;
							if (replacementStart <= j && j < replacementStart + frameWidth) {
								let animationLength = 0;
								const keyframes = anim.getUint16(6, true);
								for (let k = 0; k < keyframes; ++k) animationLength += anim.getUint16(8 + k*4 + 2, true);

								let localTick = tick % animationLength;
								for (let k = 0; k < keyframes; ++k) {
									const frameLength = anim.getUint16(8 + k*4 + 2, true);
									if (localTick >= frameLength) {
										localTick -= frameLength;
										continue;
									}

									const animeOffset = anim.getUint16(8 + k*4, true);
									tileIndex = (j - replacementStart) + animeOffset * frameWidth;
									break;
								}
								thisTileset = animTileset;
								break;
							}
						}

						const basePos = (j >> 5) << 11 | (j & 0x1f) << 3; // y = i >> 5, x = i & 0x1f
						if (mapFlags & (1 << (i + 8))) { // 256-color
							for (let k = 0, o = tileIndex * 64; k < 64 && o < thisTileset.byteLength; ++k, ++o) {
								const pos = basePos | (k >> 3) << 8 | (k & 0x7);
								const paletteIndex = thisTileset.getUint8(o);
								const rgb16 = palette.getUint16(paletteIndex * 2, true);
								writeRgb16(bitmap, pos, rgb16);
							}
						} else { // 16-color
							for (let k = 0, o = tileIndex * 32; k < 64 && o < thisTileset.byteLength; k += 2, ++o) {
								const pos = basePos | (k >> 3) << 8 | (k & 0x7);
								const composite = thisTileset.getUint8(o);
								const rgb16Left = palette.getUint16((composite & 0xf) * 2, true);
								const rgb16Right = palette.getUint16((composite >> 4) * 2, true);
								writeRgb16(bitmap, pos, rgb16Left);
								writeRgb16(bitmap, pos ^ 1, rgb16Right);
							}
						}
					}

					ctx.putImageData(new ImageData(bitmap, 256, 256), 0, 0);
				}
			}

			if (updateMaps || updateTiles || updatePalettes) {
				console.debug('updateMaps');

				const ctx = mapCanvas.getContext('2d');
				const bitmap = new Uint8ClampedArray(mapWidth * mapHeight * 64 * 4);
				for (let i = 2; i >= 0; --i) {
					if (!layerCheckboxes[i].checked) continue;

					const tiles = props.tiles[i];
					const tileset = tilesets[i];
					const palette = props.palettes[i];
					if (!tiles.byteLength || !tileset.byteLength || palette.byteLength !== 512) continue;

					let o = 0;
					for (let j = 0; j < mapWidth * mapHeight && o + 1 < tiles.byteLength; ++j) {
						const x = j % mapWidth;
						const y = Math.floor(j / mapWidth);
						const basePos = (y * mapWidth * 8 + x) * 8;
						let tile = tiles.getUint16(o, true);
						o += 2;

						for (const anim of enabledLayerAnimations) {
							const animX = anim.getInt16(0, true);
							const animY = anim.getInt16(2, true);
							const animW = anim.getInt16(4, true);
							const animH = anim.getInt16(6, true);
							if (animX <= x && x < animX + animW && animY <= y && y < animY + animH) {
								const index = (y - animY) * animW + (x - animX);
								const replacement = anim.getUint16(8 + animW * animH * 2 * i + index * 2, true);
								if (replacement === 0x3ff) continue;
								tile = replacement;
							}
						}

						let tileIndex = tile & 0x3ff;
						let thisTileset = tileset;
						for (const { anim, tileset: animTileset } of enabledTileAnimations) {
							const field = anim.getUint32(0, true);
							const layer = field & 3;
							if (room[['l1', 'l2', 'l3'][i]] !== room[['l1', 'l2', 'l3'][layer]]) continue;

							const replacementStart = field >> 4 & 0x3ff;
							const frameWidth = field >> 14 & 0x3ff;
							if (replacementStart <= tileIndex && tileIndex < replacementStart + frameWidth) {
								let animationLength = 0;
								const keyframes = anim.getUint16(6, true);
								for (let k = 0; k < keyframes; ++k) animationLength += anim.getUint16(8 + k*4 + 2, true);

								let localTick = tick % animationLength;
								for (let k = 0; k < keyframes; ++k) {
									const frameLength = anim.getUint16(8 + k*4 + 2, true);
									if (localTick >= frameLength) {
										localTick -= frameLength;
										continue;
									}

									const animeOffset = anim.getUint16(8 + k*4, true);
									tileIndex = (tileIndex - replacementStart) + animeOffset * frameWidth;
									break;
								}
								thisTileset = animTileset;
								break;
							}
						}

						if (mapFlags & (1 << (i + 8))) { // 256-color
							for (let k = 0, tileOffset = tileIndex * 64; k < 64 && tileOffset < thisTileset.byteLength; ++k, ++tileOffset) {
								const tileX = (tile & 0x400) ? 7 - (k & 7) : k & 7;
								const tileY = (tile & 0x800) ? 7 - (k >> 3) : k >> 3;
								const paletteIndex = thisTileset.getUint8(tileOffset);
								if (!paletteIndex) continue;

								const rgb16 = palette.getUint16(paletteIndex * 2, true);
								writeRgb16(bitmap, basePos + (tileY * mapWidth * 8) + tileX, rgb16);
							}
						} else { // 16-color
							const paletteShift = (tile >> 12) << 4;
							for (let k = 0, tileOffset = tileIndex * 32; k < 64 && tileOffset < thisTileset.byteLength; k += 2, ++tileOffset) {
								const tileX = (tile & 0x400) ? 7 - (k & 7) : k & 7;
								const tileY = (tile & 0x800) ? 7 - (k >> 3) : k >> 3;
								const composite = thisTileset.getUint8(tileOffset);
								if (composite & 0xf) {
									const rgb16 = palette.getUint16((paletteShift | (composite & 0xf))*2, true);
									writeRgb16(bitmap, basePos + (tileY * mapWidth * 8) + tileX, rgb16);
								}
								if (composite >> 4) {
									const rgb16 = palette.getUint16((paletteShift | composite >> 4)*2, true);
									writeRgb16(bitmap, basePos + (tileY * mapWidth * 8) + tileX ^ 1, rgb16);
								}
							}
						}
					}
				}

				if (showExtensions.checked) {
					mapCanvas.width = mapWidth * 8;
					mapCanvas.height = mapHeight * 8;
					ctx.putImageData(new ImageData(bitmap, mapWidth * 8, mapHeight * 8), 0, 0);
				} else {
					mapCanvas.width = mapWidth * 8 - 32;
					mapCanvas.height = mapHeight * 8 - 32;
					ctx.putImageData(new ImageData(bitmap, mapWidth * 8, mapHeight * 8), -16, -16);
				}

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
						ctx.strokeRect(x1 + .5, y1 + .5, x2 - x1 - 1, y2 - y1 - 1);

						ctx.fillText(str16(data), x1 + 10, y1 + 20);
						ctx.strokeText(str16(data), x1 + 10, y1 + 20);
					}
				}

				if (showLayerAnimations.checked && props.layerAnimations.byteLength > 0) {
					const segments = unpackSegmented(props.layerAnimations);
					for (let i = 1; i < segments.length; ++i) {
						if (segments[i].byteLength < 8) continue;
						const x = segments[i].getInt16(0, true);
						const y = segments[i].getInt16(2, true);
						const w = segments[i].getInt16(4, true);
						const h = segments[i].getInt16(6, true);
						ctx.fillStyle = '#fff';
						ctx.fillRect(x * 8, y * 8, w * 8, h * 8);
						ctx.strokeRect(x * 8 + .5, y * 8 + .5, w * 8 - 1, h * 8 - 1);
					}
				}

				ctx.restore();
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

	const fmapdataTiles = window.fmapdataTiles = await createSectionWrapped('FMapData Tile Viewer', async section => {
		const fmapdataTiles = {};
		const fieldFile = fs.get('/FMap/FMapData.dat');

		const options = [];
		for (let i = 0; i < fsext.fieldAnimeIndices[0]; ++i) options.push(`FMapData ${i.toString(16)}`);
		for (let i = 0; i < fsext.fieldAnimeIndices.length; ++i) options.push(`FMapData ${fsext.fieldAnimeIndices[i].toString(16)} (Anime ${i.toString(16)})`);
		const select = dropdown(options, 0, () => update());

		section.appendChild(select);

		const dump = document.createElement('button');
		dump.textContent = 'Dump';
		dump.addEventListener('click', () => {
			const index = parseInt(select.value);
			const data = lzssBis(fsext.fmapdata.segments[index]);
			download(`FMapData-${index.toString(16)}.bin`, 'application/octet-stream', data.buffer);
		});
		section.appendChild(dump);

		// generate a rainbow color palette, with later values using darker colors (0 - 0xf instead of 0 - 0x1f)
		const globalPalette256 = new DataView(new ArrayBuffer(512));
		for (let i = 0; i < 32; ++i) globalPalette256.setUint16(i*2, 0x1f << 10 | i << 5 | 0, true);
		for (let i = 31; i >= 0; --i) globalPalette256.setUint16(0x40 + i*2, i << 10 | 0x1f << 5 | 0, true);
		for (let i = 0; i < 32; ++i) globalPalette256.setUint16(0x80 + i*2, 0 << 10 | 0x1f << 5 | i, true);
		for (let i = 31; i >= 0; --i) globalPalette256.setUint16(0xc0 + i*2, 0 << 10 | i << 5 | 0x1f, true);
		for (let i = 0; i < 32; ++i) globalPalette256.setUint16(0x100 + i*2, i << 10 | 0 << 5 | 0x1f, true);
		for (let i = 31; i >= 0; --i) globalPalette256.setUint16(0x140 + i*2, 0x1f << 10 | 0 << 5 | i, true);
		for (let i = 0; i < 16; ++i) globalPalette256.setUint16(0x180 + i*2, 0xf << 10 | i << 5 | 0, true);
		for (let i = 15; i >= 0; --i) globalPalette256.setUint16(0x1a0 + i*2, i << 10 | 0xf << 5 | 0, true);
		for (let i = 0; i < 16; ++i) globalPalette256.setUint16(0x1c0 + i*2, 0 | 0xf << 5 | i, true);
		for (let i = 15; i >= 0; --i) globalPalette256.setUint16(0x1e0 + i*2, 0 | i << 5 | 0xf, true);

		const globalPalette16 = new DataView(new ArrayBuffer(512));
		const rgb16s = [[31,0,0], [31,10,0], [31,20,0], [31,31,0], [20,31,0], [10,31,0], [0,31,0], [0,31,10],
			[0,31,20], [0,31,31], [0,20,31], [0,10,31], [0,0,31], [10,0,31], [20,0,31], [31,0,31]];
		for (let i = 0; i < 16; ++i) {
			const [b, g, r] = rgb16s[i];
			const rgb16 = r << 10 | g << 5 | b;
			for (let o = 0; o < 512; o += 32) globalPalette16.setUint16(o + i*2, rgb16, true);
		}

		let paletteSelectPlaceholder = document.createElement('span');
		paletteSelectPlaceholder.textContent = '(global palette)';
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

		const animeToProps = fmapdataTiles.animeToProps = new Map();
		for (let i = 0; i < field.rooms.length; ++i) {
			const props = unpackSegmented(lzssBis(fsext.fmapdata.segments[field.rooms[i].props]));
			const passiveAnimations = unpackSegmented(props[10]);
			for (const passiveAnime of passiveAnimations) {
				const tileset = passiveAnime.getInt16(4, true);
				let arr = animeToProps.get(tileset) || [];
				arr.push(i);
				animeToProps.set(tileset, arr);
			}
		}

		let paletteOptions;
		const update = () => {
			const animeId = parseInt(select.value) - fsext.fieldAnimeIndices[0];
			if (animeId >= 0) {
				paletteOptions = animeToProps.get(animeId) || [];

				if (paletteOptions.length === 0) {
					const span = document.createElement('span');
					span.textContent = '(unused?)';
					paletteSelectPlaceholder.replaceWith(span);
					paletteSelectPlaceholder = span;
				} else {
					const select = dropdown(paletteOptions.map(x => `Palette for Room 0x${x.toString(16)}`), 0, () => render());
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

			render();
		};

		const render = () => {
			const index = parseInt(select.value);
			const data = lzssBis(fsext.fmapdata.segments[index]);

			let palettes = [globalPalette256, globalPalette16, globalPalette256, globalPalette16, globalPalette256, globalPalette16];
			if (paletteOptions.length) {
				const roomIndex = paletteOptions[parseInt(paletteSelectPlaceholder.value)];
				const room = field.rooms[roomIndex];
				const props = unpackSegmented(lzssBis(fsext.fmapdata.segments[room.props]));
				palettes = [props[3], props[3], props[4], props[4], props[5], props[5]];
			}

			// 256-color
			const bitmap256 = new Uint8ClampedArray(256 * 256 * 4);
			for (let i = 0; i < 3; ++i) {
				const ctx = tileCanvases256[i].getContext('2d');
				if (palettes[i*2].byteLength !== 512) { // if the layer doesn't exist in the room
					ctx.clearRect(0, 0, 256, 256);
					continue;
				}

				let o = 0;
				for (let j = 0; o < data.byteLength; ++j) {
					const basePos = (j >> 5) << 11 | (j & 0x1f) << 3; // y = i >> 5, x = i & 0x1f
					for (let k = 0; k < 64 && o < data.byteLength; ++k) {
						const pos = basePos | (k >> 3) << 8 | (k & 0x7);
						const paletteIndex = data.getUint8(o++);
						writeRgb16(bitmap256, pos, palettes[i*2].getUint16(paletteIndex*2, true));
					}
				}

				ctx.putImageData(new ImageData(bitmap256, 256, 256), 0, 0);
			}

			// 16-color
			const bitmap16 = new Uint8ClampedArray(256 * 256 * 4);
			for (let i = 0; i < 3; ++i) {
				const ctx = tileCanvases16[i].getContext('2d');
				if (palettes[i*2 + 1].byteLength !== 512) { // if the layer doesn't exist in the room
					ctx.clearRect(0, 0, 256, 256);
					continue;
				}

				let o = 0;
				for (let j = 0; o < data.byteLength; ++j) {
					const basePos = (j >> 5) << 11 | (j & 0x1f) << 3; // y = j >> 5, x = j & 0x1f
					for (let k = 0; k < 64 && o < data.byteLength; k += 2) {
						const pos = basePos | (k >> 3) << 8 | (k & 0x7);
						const composite = data.getUint8(o++);
						writeRgb16(bitmap16, pos, palettes[i*2 + 1].getUint16((composite & 0xf)*2, true));
						writeRgb16(bitmap16, pos ^ 1, palettes[i*2 + 1].getUint16((composite >> 4)*2, true));
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

				for (let j = 0; j < 256; ++j) writeRgb16(bitmapPal, j, palettes[i].getUint16(j*2, true));
				ctx.putImageData(new ImageData(bitmapPal, 16, 16), 0, 0);
			}
		};
		update();

		return fmapdataTiles;
	});

	const battle = window.battle = await createSectionWrapped('Battle Maps', section => {
		const battle = {};

		const bmapFile = fs.get('/BMap/BMap.dat');
		const bmap = battle.bmap = unpackSegmented(bmapFile);

		const bmaps = battle.bmaps = [];
		for (let i = 0; i < bmap.length; i += 8) {
			bmaps.push({
				unknown0: bmap[i],
				tileset: bmap[i + 1],
				palette: bmap[i + 2],
				layer1: bmap[i + 3],
				layer2: bmap[i + 4],
				layer3: bmap[i + 5],
				unknown6: bmap[i + 6],
				unknown7: bmap[i + 7],
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
					writeRgb16(paletteBitmap, i, palette.getUint16(i * 2, true));
				}
				paletteCtx.putImageData(new ImageData(paletteBitmap, 16, 16), 0, 0);
			} else {
				paletteCtx.clearRect(0, 0, 16, 16);
			}

			// tileset
			const tileset = room.tileset?.byteLength && lzssBis(room.tileset);
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
						writeRgb16(tilesetBitmap, pos, palette.getUint16((composite & 0xf) * 2, true));
						writeRgb16(tilesetBitmap, pos | 1, palette.getUint16((composite >> 4) * 2, true));
					}
				}
				tilesetCtx.putImageData(new ImageData(tilesetBitmap, 256, 256), 0, 0);
			} else {
				tilesetCtx.clearRect(0, 0, 256, 256);
			}

			// unknown0
			const unknown0 = room.unknown0?.byteLength && lzssBis(room.unknown0);
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
						writeRgb16(unknown0Bitmap, pos, palette.getUint16((composite & 0xf) * 2, true));
						writeRgb16(unknown0Bitmap, pos | 1, palette.getUint16((composite >> 4) * 2, true));
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
				for (const layerIndex of (reverseLayers.checked ? [0, 1, 2] : [2, 1, 0])) {
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
							if (composite & 0xf) writeRgb16(mapBitmap, pos, palette.getUint16((paletteRow << 4 | (composite & 0xf)) * 2, true));
							if (composite >> 4) writeRgb16(mapBitmap, pos ^ 1, palette.getUint16((paletteRow << 4 | composite >> 4) * 2, true));
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
				const decompressed = lzssBis(room.unknown0);
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

	const battleGiant = window.battleGiant = await createSectionWrapped('Giant Battle Maps', async section => {
		const battleGiant = {};

		const selectOptions = [];
		for (let i = 0; i < fsext.bmapg.segments.length; ++i) selectOptions.push(`BMapG 0x${i.toString(16)}`);
		const bmapgSelect = dropdown(selectOptions, 0, () => render());
		section.appendChild(bmapgSelect);

		const bg1Check = checkbox('BG1', true, () => render());
		section.appendChild(bg1Check);
		const bg2Check = checkbox('BG2', true, () => render());
		section.appendChild(bg2Check);

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
			const index = parseInt(bmapgSelect.value);
			const room = unpackSegmented(lzssBis(fsext.bmapg.segments[index]));
			const [palette, tileset, layer1, layer2, unknown4, unknown5, unknown6] = room;

			// palette
			const paletteCtx = paletteCanvas.getContext('2d');
			if (palette?.byteLength) {
				const paletteBitmap = new Uint8ClampedArray(256 * 4);
				for (let i = 0; i*2 + 1 < palette.byteLength; ++i) {
					writeRgb16(paletteBitmap, i, palette.getUint16(i * 2, true));
				}
				paletteCtx.putImageData(new ImageData(paletteBitmap, 16, 16), 0, 0);
			} else {
				paletteCtx.clearRect(0, 0, 16, 16);
			}

			// tileset
			const tilesetCtx = tilesetCanvas.getContext('2d');
			if (palette?.byteLength && tileset?.byteLength) {
				const tilesetBitmap = new Uint8ClampedArray(256 * 256 * 4);
				let o = 0;
				for (let i = 0; o < tileset.byteLength; ++i) {
					const basePos = (i >> 5) << 11 | (i & 0x1f) << 3; // y = i >> 5, x = i & 0x1f
					// 256-color
					for (let j = 0; j < 64 && o < tileset.byteLength; ++j) {
						const pos = basePos | (j >> 3) << 8 | (j & 0x7);
						const paletteIndex = tileset.getUint8(o++);
						writeRgb16(tilesetBitmap, pos, palette.getUint16(paletteIndex * 2, true));
					}
				}
				tilesetCtx.putImageData(new ImageData(tilesetBitmap, 256, 256), 0, 0);
			} else {
				tilesetCtx.clearRect(0, 0, 256, 256);
			}

			// map
			const mapCtx = mapCanvas.getContext('2d');
			if (palette?.byteLength && tileset?.byteLength) {
				const mapBitmap = new Uint8ClampedArray(2048 * 512 * 4);
				let o = 0;
				// maybe there are more layers, so use an array
				for (const [layer, check] of [[layer2, bg2Check], [layer1, bg1Check]]) {
					if (!layer?.byteLength || !check.checked) continue;

					for (let i = 0; i*2 + 1 < layer.byteLength; ++i) {
						const tile = layer.getUint16(i * 2, true);
						if (!(tile & 0x3ff)) continue;

						// 256-color
						const basePos = (i >> 7) << 14 | (i & 0x7f) << 3; // y = i >> 7, x = i & 0x7f
						const tileOffset = (tile & 0x3ff) * 64;
						for (let j = 0; j < 64 && tileOffset + j < tileset.byteLength; ++j) {
							let pos = basePos | (j >> 3) << 11 | (j & 0x7);
							if (tile & 0x400) pos ^= 0x7; // horizontal flip
							if (tile & 0x800) pos ^= 0x7 << 11; // vertical flip

							const paletteIndex = tileset.getUint8(tileOffset + j);
							if (!paletteIndex) continue;

							writeRgb16(mapBitmap, pos, palette.getUint16(paletteIndex * 2, true));
						}
					}
				}

				mapCtx.putImageData(new ImageData(mapBitmap, 2048, 512), 0, 0);
			} else {
				mapCtx.clearRect(0, 0, 2048, 512);
			}

			// metadata below
			metaPreview.innerHTML = '';

			addHTML(metaPreview, `<div>Layer sizes: ${layer1?.byteLength}, ${layer2?.byteLength}</div>`);
			addHTML(metaPreview, `<div>unknown4 size: ${unknown4?.byteLength}</div>`);
			addHTML(metaPreview, `<div>unknown5 size: ${unknown5?.byteLength}</div>`);
			if (unknown5?.byteLength) addHTML(metaPreview, `<div>unknown5 preview: <code>${bytes(0, 256, unknown5)}</code></div>`);
			addHTML(metaPreview, `<div>unknown6 size: ${unknown6?.byteLength}</div>`);
			if (unknown6?.byteLength) addHTML(metaPreview, `<div>unknown6 preview: <code>${bytes(0, 256, unknown6)}</code></div>`);
		};
		render();

		return battleGiant;
	});

	const fx = window.fx = await createSectionWrapped('Fx', section => {
		const options = [];
		for (let i = 0; i < fsext.bdfxtex.segments.length; ++i) {
			options.push({ name: `BDfx 0x${i.toString(16)}`, tex: fsext.bdfxtex.segments[i], pal: fsext.bdfxpal.segments[i] });
		}
		for (let i = 0; i < fsext.bofxtex.segments.length; ++i) {
			options.push({ name: `BOfx 0x${i.toString(16)}`, tex: fsext.bofxtex.segments[i], pal: fsext.bofxpal.segments[i] });
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

		const select = dropdown(options.map(x => x.name), 0, () => render());
		section.appendChild(select);

		const paletteShift = dropdown([0,1,2,3,4,5,6,7,8,9,0xa,0xb,0xc,0xd,0xe,0xf].map(x => `Palette Row 0x${x.toString(16)}`), 0, () => render());
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
			const option = options[parseInt(select.value)];

			const paletteCtx = paletteCanvas.getContext('2d');
			if (option.pal.byteLength >= 516) {
				const paletteBitmap = new Uint8ClampedArray(256 * 4);
				for (let i = 0; i < 256; ++i) {
					writeRgb16(paletteBitmap, i, option.pal.getUint16(4 + i*2, true));
				}
				paletteCtx.putImageData(new ImageData(paletteBitmap, 16, 16), 0, 0);
			} else {
				paletteCtx.clearRect(0, 0, 16, 16);
			}

			const tileset256Ctx = tileset256Canvas.getContext('2d');
			const tileset16Ctx = tileset16Canvas.getContext('2d');
			if (option.pal.byteLength >= 516) {
				const tileset = lzssBis(option.tex);
				const tileset256Bitmap = new Uint8ClampedArray(256 * 256 * 4);
				const tileset16Bitmap = new Uint8ClampedArray(256 * 256 * 4);

				const paletteRow = parseInt(paletteShift.value) << 4;

				let o256 = 0;
				let o16 = 0;
				for (let i = 0; o256 < tileset.byteLength || o16 < tileset.byteLength; ++i) {
					const basePos = (i >> 5) << 11 | (i & 0x1f) << 3; // y = i >> 5, x = i & 0x1f
					// 256-color
					for (let j = 0; j < 64 && o256 < tileset.byteLength; ++j) {
						const pos = basePos | (j >> 3) << 8 | (j & 0x7);
						const paletteIndex = tileset.getUint8(o256++);
						writeRgb16(tileset256Bitmap, pos, option.pal.getUint16(4 + paletteIndex * 2, true));
					}

					// 16-color
					for (let j = 0; j < 64 && o16 < tileset.byteLength; j += 2) {
						const pos = basePos | (j >> 3) << 8 | (j & 0x7);
						const composite = tileset.getUint8(o16++);
						writeRgb16(tileset16Bitmap, pos, option.pal.getUint16(4 + (paletteRow | (composite & 0xf))*2, true));
						writeRgb16(tileset16Bitmap, pos ^ 1, option.pal.getUint16(4 + (paletteRow | composite >> 4)*2, true));
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
	});

	// add spacing to the bottom of the page, for better scrolling
	const spacer = document.createElement('div');
	spacer.style.height = '100vh';
	document.body.appendChild(spacer);
})();
