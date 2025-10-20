'use strict';

(async () => {
	const fileBlob = await new Promise((resolve) => {
		const input = document.querySelector('#file-input');
		input.addEventListener('input', (e) => resolve(input.files[0]));
	});

	const file = new DataView(
		await new Promise((resolve) => {
			const reader = new FileReader();
			reader.addEventListener('load', () => resolve(reader.result));
			reader.readAsArrayBuffer(fileBlob);
		}),
	);

	document.querySelector('#file-input').remove();
	document.querySelector('#title').remove();

	const settings = JSON.parse(localStorage.getItem('settings') || '{}');

	// +---------------------------------------------------------------------------------------------------------------+
	// | Components                                                                                                    |
	// +---------------------------------------------------------------------------------------------------------------+

	const dropdown = (values, initialIndex, onchange, onhover, hideArrows) => {
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

		checkbox.set = (newChecked, silent) => {
			checked = newChecked;
			checkbox.checked = checked;
			if (checked) checkbox.classList.add('checked');
			else checkbox.classList.remove('checked');
			if (!silent) onchange();
		};

		checkbox.set(checked, true);
		checkbox.addEventListener('mousedown', () => checkbox.set(!checked));

		return checkbox;
	};

	const button = (name, onchange) => {
		const button = document.createElement('button');
		button.innerHTML = name;
		button.addEventListener('mousedown', () => onchange());
		return button;
	};

	// +---------------------------------------------------------------------------------------------------------------+
	// | Quick Data Display                                                                                            |
	// +---------------------------------------------------------------------------------------------------------------+

	const readString = (o, l, buf = file) => {
		let end;
		if (l !== undefined) {
			end = o + l;
		} else {
			end = o;
			while (file.getUint8(end++) !== 0);
		}

		const str = [];
		for (let i = 0; i < end - o; i += 16384) {
			const slice = buf.buffer.slice(buf.byteOffset + o + i, buf.byteOffset + Math.min(end, o + i + 16384));
			str.push(String.fromCharCode(...new Uint8Array(slice).map((x) => (x < 0x20 ? 46 : x))));
		}

		return str.join('');
	};

	const byteToHex = [];
	for (let i = 0; i < 256; ++i) byteToHex[i] = i.toString(16).padStart(2, '0');
	const bytes = (o, l, buf = file) => {
		const slice = new Uint8Array(buf.buffer.slice(Math.max(buf.byteOffset + o, 0), buf.byteOffset + o + l));
		const arr = new Array(slice.length);
		for (let i = 0; i < slice.length; ++i) arr[i] = byteToHex[slice[i]];
		return arr.join(' ');
	};

	const bits = (o, l, buf = file) => {
		const slice = buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + l);
		return Array.from(new Uint8Array(slice))
			.map((x) => x.toString(2).padStart(8, '0'))
			.join(' ');
	};

	const sanitize = (s) => s.replaceAll('<', '&lt;').replaceAll('>', '&gt;');

	const addHTML = (el, html) => {
		const container = document.createElement(el.tagName);
		container.innerHTML = html;
		for (const child of container.childNodes) el.appendChild(child);
	};

	const writeRgb16 = (bitmap, pixel, rgb16) => {
		const r = rgb16 & 0x1f;
		const g = (rgb16 >> 5) & 0x1f;
		const b = (rgb16 >> 10) & 0x1f;
		bitmap[pixel * 4] = (r << 3) | (r >> 2);
		bitmap[pixel * 4 + 1] = (g << 3) | (g >> 2);
		bitmap[pixel * 4 + 2] = (b << 3) | (b >> 2);
		bitmap[pixel * 4 + 3] = 255;
	};

	const str8 = (x) => x.toString(16).padStart(2, '0');
	const str16 = (x) => x.toString(16).padStart(4, '0');
	const str32 = (x) => x.toString(16).padStart(8, '0');

	Object.assign(window, { file, readString, bytes, bits, sanitize, addHTML, str8, str16, str32 });

	// +---------------------------------------------------------------------------------------------------------------+
	// | Compression and Packing                                                                                       |
	// +---------------------------------------------------------------------------------------------------------------+

	const blz = (indat) => {
		const composite = indat.getUint32(indat.byteLength - 8, true);
		const offset = composite >> 24;
		const compressedLength = composite & 0xffffff; // could be zero
		const additionalLength = indat.getUint32(indat.byteLength - 4, true);

		if (compressedLength > indat.byteLength || additionalLength > 1e6) {
			throw new Error('data is probably not compressed');
		}

		const outbuf = new Uint8Array(indat.byteLength + additionalLength);
		const inbuf = bufToU8(indat);
		let outoff = outbuf.byteLength;
		let inoff = inbuf.byteLength - offset;

		while (inoff > inbuf.byteLength - compressedLength) {
			const control = inbuf[--inoff];
			for (let bit = 0x80; bit && inoff > inbuf.byteLength - compressedLength; bit >>= 1) {
				if (control & bit) {
					// back-reference
					const composite = (inbuf[--inoff] << 8) | inbuf[--inoff];
					const offset = (composite & 0xfff) + 3;
					const length = (composite >> 12) + 3;
					for (let i = 0; i < length; ++i) outbuf[--outoff] = outbuf[outoff + offset];
				} else {
					// literal
					outbuf[--outoff] = inbuf[--inoff];
				}
			}
		}

		outbuf.set(inbuf.slice(0, inbuf.byteLength - compressedLength)); // copy decompressed part
		return new DataView(outbuf.buffer);
	};

	// compresses overlay files MOSTLY EXACTLY (i.e. blzCompress(blz(overlay)) == overlay for NEARLY ALL overlays)
	// these overlays: NA 2, EU 2, KO 2, KO 123, KO 139 don't recompress exactly, there is likely some other
	// scoring system that i haven't been able to reverse engineer
	// `minimumSize` is useful for modding overlays without having to change the FAT or overlay tables or anything else
	const blzCompress = (indat, minimumSize) => {
		const rightPadding = minimumSize === undefined ? 12 : 256;
		const inbuf = bufToU8(indat);
		// in the worst case, blz compression results in 9/8 (112.5%) of the original input size
		// (the size of literals and control bytes)
		// round up to 4-byte boundaries, then add 8 bytes of header (so, may add up to 12 bytes)
		const outbuf = new Uint8Array(Math.ceil((inbuf.length * 9) / 8) + rightPadding);

		const startingOutoff = outbuf.length - rightPadding;
		let outoff = startingOutoff;
		let inoff = inbuf.length - 1;

		const stops = [];
		let controlByteOffset;
		let bestNetSaves = 0;
		let netSaves = 0;

		const offsets = new Array(256);
		for (let i = 0; i < 256; ++i) offsets[i] = [];

		while (inoff >= 0) {
			--netSaves;
			controlByteOffset = --outoff;

			for (let i = 7; i >= 0 && inoff >= 0; --i) {
				const byte = inbuf[inoff];

				// find an offset between [inoff + 2, inbuf.byteLength - 3]
				// such that:
				// inbuf[inoff] == inbuf[inoff + offset]
				// inbuf[inoff - 1] == inbuf[inoff + offset - 1]
				// inbuf[inoff - 2] == inbuf[inoff + offset - 2]
				// ...
				let bestBackReference, bestBackReferenceOffset;
				for (
					let offsetIndex = offsets[byte].length - 1,
						inoffsetted = offsets[byte][offsetIndex],
						offset = (inoffsetted ?? 0) - inoff;
					offsetIndex >= 0 && offset < 4099;
					inoffsetted = offsets[byte][--offsetIndex], offset = (inoffsetted ?? 0) - inoff
				) {
					if (offset < 3) continue;
					/* for ( // this loop statement is functionally identical to the one above, but **much** slower
					let offset = 3, inoffsetted = inoff + offset;
					offset < 4099 && inoffsetted < inbuf.byteLength;
					++offset, ++inoffsetted
				) { */
					let length = 1;
					for (; length < 18 && length < offset && inoff - length >= 0; ++length) {
						if (inbuf[inoff - length] !== inbuf[inoffsetted - length]) break;
					}

					if (length >= 3 && (!bestBackReference || length > bestBackReference)) {
						// back-reference found; prefer smallest possible offset
						bestBackReference = length;
						bestBackReferenceOffset = offset;
					}
				}

				if (bestBackReference) {
					outbuf[controlByteOffset] |= 1 << i;
					const composite = (bestBackReferenceOffset - 3) | ((bestBackReference - 3) << 12);
					outbuf[--outoff] = composite >> 8;
					outbuf[--outoff] = composite & 0xff;

					let usable = false; // unusable stops still need to be checked for decompression overwrites
					if ((netSaves += bestBackReference - 2) > bestNetSaves) {
						usable = true;
						bestNetSaves = netSaves;
					}
					stops.push({ inoffStart: inoff, inoffEnd: inoff - bestBackReference, outoff, usable });

					for (let i = 0; i < bestBackReference; ++i, --inoff) offsets[inbuf[inoff]].push(inoff);
				} else {
					outbuf[--outoff] = byte;
					offsets[byte].push(inoff);
					--inoff;
				}
			}
		}

		// if there are just a few more literals remaining, just include them all in compression
		if (netSaves === bestNetSaves) stops.push({ inoffStart: inoff + 1, inoffEnd: inoff, outoff, usable: true });

		const outdat = bufToDat(outbuf);

		let instop = inoff;
		let outstop = outoff;

		cutoff: for (let i = stops.length - 1; i >= 0; --i) {
			// assume we take this stop
			if (!stops[i].usable) continue;
			const hypoDecompressedLength = stops[i].inoffEnd + 1;
			const hypoDataStart = stops[i].outoff - hypoDecompressedLength;

			for (let j = i; j >= 0; --j) {
				const decompHypoInoff = stops[j].outoff - hypoDataStart;
				const decompHypoOutoff = stops[j].inoffStart;
				// make sure not overwriting compression stream
				if (decompHypoOutoff < decompHypoInoff) continue cutoff;
			}

			if (minimumSize !== undefined) {
				const hypoNextDecompLength = stops[i].inoffEnd + 1;
				const hypoNextCompLength = startingOutoff - stops[i].outoff;
				const estimatedSize = Math.ceil((hypoNextDecompLength + hypoNextCompLength) / 4) * 4 + 8;
				if (estimatedSize <= minimumSize) {
					instop = stops[i].inoffEnd;
					outstop = stops[i].outoff;
					continue;
				}
			} else {
				// this stop is fine
				instop = stops[i].inoffEnd;
				outstop = stops[i].outoff;
			}
			break;
		}

		const decompressedLength = instop + 1;
		const dataStart = outstop - decompressedLength;
		outbuf.set(inbuf.slice(0, decompressedLength), dataStart);

		const compressedLength = startingOutoff - outstop;
		const paddingStart = startingOutoff;
		let headerStart = dataStart + Math.ceil((decompressedLength + compressedLength) / 4) * 4;
		if (minimumSize !== undefined) {
			const estimatedSize = headerStart - dataStart + 8;
			headerStart += minimumSize - estimatedSize;
		}
		const dataLength = headerStart + 8 - dataStart;
		const additionalLength = inbuf.length - dataLength;
		if (additionalLength <= 0) {
			// if compression results in a larger size, then store decompressed and with a zero'd header
			// this does mean on some custom input (e.g. [1,2,3,...,20]), blz(blzCompress(x)) == x will not hold
			// but the additionalLength part of the header (probably?) can't be negative
			if (inbuf.length >= 8 && indat.getBigUint64(inbuf.length - 8, true) === 0n) {
				// blz() includes the zero'd header in decompression, so just keep it there
				return indat;
			} else {
				outbuf.set(inbuf, 0);
				outbuf.fill(0, inbuf.length, inbuf.length + 8);
				return new DataView(outbuf.buffer, 0, inbuf.length + 8);
			}
		}

		outbuf.fill(0xff, paddingStart, headerStart);

		outdat.setUint32(
			headerStart,
			(dataLength - decompressedLength) | ((headerStart + 8 - paddingStart) << 24),
			true,
		);
		outdat.setUint32(headerStart + 4, additionalLength, true);

		return new DataView(outbuf.buffer, dataStart, dataLength);
	};

	/**
	 * Decompresses the custom lzss-like used in various BIS files
	 */
	const lzBis = (indat) => {
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
			block: for (let target = inoff + blockLength; inoff < target; ) {
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
	 * The compression matches **exactly** what you would find in a ROM. (i.e. lzBisCompress(lzBis(dat)) = dat)
	 * Using a custom `blockSize` larger than 512 will make the output smaller, but may cause the game to crash.
	 */
	const lzBisCompress = (indat, blockSize = 512) => {
		const outbuf = new Uint8Array(indat.byteLength * 2);
		let outoff = 0;
		const writeFunnyVarLength = (x) => {
			if (x < 1 << 6) {
				outbuf[outoff++] = x;
			} else if (x < 1 << 14) {
				outbuf[outoff++] = (x & 0x3f) | 0x40;
				outbuf[outoff++] = x >> 6;
			} else {
				outbuf[outoff++] = (x & 0x3f) | 0x80;
				outbuf[outoff++] = (x >> 6) & 0xff; // note that these two overlap, i'm not sure why,
				outbuf[outoff++] = x >> 12; // but they do, and that's how it is
			}
		};
		writeFunnyVarLength(indat.byteLength);

		// each compression block will decompress into exactly 512 bytes of output
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

			for (let inoff = 0; inoff < inblock.byteLength; ) {
				const byte = inblock.getUint8(inoff);
				if (inoff + 1 >= inblock.byteLength) {
					// only a literal makes sense right now
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
				if (byte === next) {
					// repeated bytes; see how far the repetition goes
					for (
						bestRepetitions = 2;
						bestRepetitions < 257 && inoff + bestRepetitions < inblock.byteLength;
						++bestRepetitions
					) {
						if (inblock.getUint8(inoff + bestRepetitions) !== byte) break;
					}
				}

				// try back-references
				if (bestRepetitions <= 16) {
					const short = (next << 8) | byte;
					const globalInoff = inoff + i * blockSize;
					for (let j = Math.min(4095, globalInoff); j >= 2; --j) {
						const seekedShort = indat.getUint16(globalInoff - j, true);
						if (seekedShort === short) {
							let length = 2;
							for (; length < 17 && length < j && inoff + length < inblock.byteLength; ++length) {
								if (inblock.getUint8(inoff + length) !== indat.getUint8(globalInoff - j + length))
									break;
							}

							if (length > bestBackReference) {
								bestBackReference = length;
								bestBackReferenceOffset = j;
							}
						}
					}
				}

				if (bestBackReference > bestRepetitions && bestBackReference >= 2) {
					// prefer back references
					outbuf[outoff++] = bestBackReferenceOffset & 0xff;
					outbuf[outoff++] = ((bestBackReferenceOffset >> 4) & 0xf0) | (bestBackReference - 2);
					inoff += bestBackReference;

					outbuf[controlByteOffset] |= 2 << (controlByteEntries++ * 2);
				} else if (bestRepetitions >= 2) {
					// prefer repetitions
					outbuf[outoff++] = bestRepetitions - 2;
					outbuf[outoff++] = byte;
					inoff += bestRepetitions;

					outbuf[controlByteOffset] |= 3 << (controlByteEntries++ * 2);
				} else {
					// prefer literal
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

	const unpackSegmented = (dat) => {
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
	};

	const unpackSegmented16 = (dat) => {
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
	};

	/**
	 * Creates an uncompressed .zip archive containing multiple files
	 * @param {{ name: string, dat: DataView }[]} files
	 * @returns {DataView}
	 */
	const zipStore = (files) => {
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
		const date = now.getDate() | ((now.getMonth() + 1) << 5) | ((now.getFullYear() - 1980) << 9);
		const time = (now.getSeconds() >> 1) | (now.getMinutes() << 5) | (now.getHours() << 11);

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

			(dat.setUint32(o, 0x04034b50, true), (o += 4)); // local file header signature
			(dat.setUint16(o, 0, true), (o += 2)); // version needed to extract (0)
			(dat.setUint16(o, 0, true), (o += 2)); // general purpose bit flag (0)
			(dat.setUint16(o, 0, true), (o += 2)); // compression method (0 = no compression)
			(dat.setUint16(o, time, true), (o += 2)); // last mod file time (0)
			(dat.setUint16(o, date, true), (o += 2)); // last mod file date (0)
			const crc32LocalOffset = o;
			o += 4; // write crc-32 later
			(dat.setUint32(o, fileDat.byteLength, true), (o += 4)); // compressed size (0 = no compression)
			(dat.setUint32(o, fileDat.byteLength, true), (o += 4)); // uncompressed size
			(dat.setUint16(o, name.length, true), (o += 2)); // file name length
			(dat.setUint16(o, 0, true), (o += 2)); // extra field length

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
			(dat.setUint32(o, 0x02014b50, true), (o += 4)); // central file header signature
			(dat.setUint16(o, 0x031e, true), (o += 2)); // version made by (3 = unix)
			(dat.setUint16(o, 0, true), (o += 2)); // version needed to extract (0)
			(dat.setUint16(o, 0, true), (o += 2)); // general purpose bit flag
			(dat.setUint16(o, 0, true), (o += 2)); // compression method (0 = no compression)
			(dat.setUint16(o, time, true), (o += 2)); // last mod file time
			(dat.setUint16(o, date, true), (o += 2)); // last mod file date
			(dat.setUint32(o, crc32s[i], true), (o += 4)); // crc32
			(dat.setUint32(o, fileDat.byteLength, true), (o += 4)); // compressed size (no compression is done)
			(dat.setUint32(o, fileDat.byteLength, true), (o += 4)); // uncompressed size
			(dat.setUint16(o, name.length, true), (o += 2)); // file name length
			(dat.setUint16(o, 0, true), (o += 2)); // extra field length
			(dat.setUint16(o, 0, true), (o += 2)); // file comment length
			(dat.setUint16(o, 0, true), (o += 2)); // disk number start
			(dat.setUint16(o, 0, true), (o += 2)); // internal file attributes
			(dat.setUint32(o, 0, true), (o += 4)); // external file attributes
			(dat.setInt32(o, localHeaders[i], true), (o += 4)); // relative offset of local header

			// file name
			for (let i = 0; i < name.length; ++i) dat.setUint8(o++, name.charCodeAt(i));
		}
		const centralDirSize = o - centralDirOffset;

		// end of central dir record
		(dat.setUint32(o, 0x06054b50, true), (o += 4)); // end of central dir signature
		(dat.setUint16(o, 0, true), (o += 2)); // number of this disk
		(dat.setUint16(o, 0, true), (o += 2)); // number of the disk...central directory
		(dat.setUint16(o, file.length, true), (o += 2)); // total number of entries...on this disk
		(dat.setUint16(o, file.length, true), (o += 2)); // total number of entries...central dir
		(dat.setUint32(o, centralDirSize, true), (o += 4)); // size of the central directory
		(dat.setInt32(o, centralDirOffset, true), (o += 4)); // offset of start of central directory...
		(dat.setUint32(o, 0, true), (o += 4)); // starting disk number
		(dat.setUint16(o, 0, true), (o += 2)); // zipfile comment length

		return dat;
	};

	const rgb15To32 = (in16) => {
		const out32 = new Uint32Array(in16.length);
		for (let i = 0; i < in16.length; ++i) {
			const r = in16[i] & 0x1f;
			const g = (in16[i] >> 5) & 0x1f;
			const b = (in16[i] >> 10) & 0x1f;
			out32[i] =
				0xff000000 |
				(b << (16 + 3)) |
				((b & 0x18) << (16 - 2)) |
				(g << (8 + 3)) |
				((g & 0x18) << (8 - 2)) |
				(r << 3) |
				(r >> 2);
		}
		return out32;
	};

	const sliceDataView = (dat, start, end) => new DataView(dat.buffer, dat.byteOffset + start, end - start);
	const bufToU8 = (buf, off = buf.byteOffset, len = buf.byteLength) => new Uint8Array(buf.buffer, off, len);
	const bufToU8Clamped = (buf, off = buf.byteOffset, len = buf.byteLength) =>
		new Uint8ClampedArray(buf.buffer, off, len);
	const bufToU16 = (buf, off = buf.byteOffset, len = buf.byteLength >> 1) => new Uint16Array(buf.buffer, off, len);
	const bufToS16 = (buf, off = buf.byteOffset, len = buf.byteLength >> 1) => new Int16Array(buf.buffer, off, len);
	const bufToU32 = (buf, off = buf.byteOffset, len = buf.byteLength >> 2) => new Uint32Array(buf.buffer, off, len);
	const bufToDat = (buf, off = buf.byteOffset, len = buf.byteLength) => new DataView(buf.buffer, off, len);

	Object.assign(window, {
		blz,
		blzCompress,
		lzBis,
		lzBisCompress,
		sliceDataView,
		unpackSegmented,
		unpackSegmented16,
		zipStore,
		rgb15To32,
		bufToU8,
		bufToU16,
		bufToS16,
		bufToU32,
	});

	// +---------------------------------------------------------------------------------------------------------------+
	// | Misc                                                                                                          |
	// +---------------------------------------------------------------------------------------------------------------+

	const download = (name, dat, mime = 'application/octet-stream') => {
		const blob = new Blob([dat], { type: mime });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = name;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000); // idk if a timeout is really necessary
	};

	const readMessage = (o, dat) => {
		const u8 = bufToU8(dat);
		const s = [];
		for (; o < u8.length; ) {
			const byte = u8[o++];
			if (byte === 0xff) {
				const next = u8[o++];
				if (next === 0) s.push('\n');
				else s.push(`<${str8(next)}>`);
			} else if (byte <= 0x1f) {
				// special symbol
				s.push(`(${str8(byte)})`);
			} else if (byte === 0x85) {
				s.push('…');
			} else {
				// assume latin1
				s.push(String.fromCharCode(byte));
			}
		}

		return s.join('');
	};

	Object.assign(window, { download, readMessage });

	const createSection = (title, cb) => {
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
				${sanitize(err.stack).replace('\n', '<br>')}</span>`,
			);
		}

		if (content.children.length) document.body.appendChild(section);
		return result;
	};

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: ROM Headers                                                                                          |
	// +---------------------------------------------------------------------------------------------------------------+

	const headers = (window.headers = createSection('ROM Headers', (section) => {
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
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: File System                                                                                          |
	// +---------------------------------------------------------------------------------------------------------------+

	const fs = (window.fs = createSection('File System', (section) => {
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

				entries.push({
					name,
					directory,
					id: directory ? subdirectoryId : fileId++,
				});
			}
		};

		const subtables = new Map();
		// root subtable is stored slightly differently
		subtables.set(
			0xf000,
			parseSubtable(file.getUint32(headers.fntOffset, true), file.getUint16(headers.fntOffset + 4, true)),
		);
		const numDirectories = file.getUint16(headers.fntOffset + 6, true);
		for (let i = 1; i < numDirectories; ++i) {
			const start = file.getUint32(headers.fntOffset + i * 8, true);
			const startingFileId = file.getUint16(headers.fntOffset + i * 8 + 4, true);
			subtables.set(0xf000 + i, parseSubtable(start, startingFileId));
		}

		const fs = new Map();
		for (let i = 0; i < headers.fatLength / 8; ++i) {
			const start = file.getUint32(headers.fatOffset + i * 8, true);
			const end = file.getUint32(headers.fatOffset + i * 8 + 4, true);
			fs.set(i, {
				index: i,
				path: `overlay ${i.toString().padStart(4, '0')}`,
				name: `overlay${i.toString().padStart(4, '0')}.bin`,
				overlay: true,
				start,
				end,
			});
		}

		const recurseDirectory = (subtable, prefix) => {
			for (const entry of subtable) {
				if (entry.directory) {
					recurseDirectory(subtables.get(entry.id), `${prefix}${entry.name}/`);
				} else {
					const start = file.getUint32(headers.fatOffset + entry.id * 8, true);
					const end = file.getUint32(headers.fatOffset + entry.id * 8 + 4, true);
					const fsentry = fs.get(entry.id);
					fsentry.path = prefix + entry.name;
					fsentry.name = entry.name;
					fsentry.overlay = false; // overlays aren't part of the file structure
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
			fileSelectEntries.push(
				`${str8(i)}. (len 0x${(fsentry.end - fsentry.start).toString(16)}) ${sanitize(fsentry.path)}`,
			);
		}
		const fileSelect = dropdown(fileSelectEntries, 0, () => {});
		singleExport.appendChild(fileSelect);

		const singleDecompression = dropdown(['No decompression', 'Backwards LZSS'], 0, () => {}, undefined, true);
		singleExport.appendChild(singleDecompression);

		const singleDump = document.createElement('button');
		singleDump.textContent = 'Dump';
		singleExport.appendChild(singleDump);

		const downloadOutput = document.createElement('div');
		singleExport.appendChild(downloadOutput);

		singleDump.addEventListener('mousedown', () => {
			const fsentry = fs.get(fileSelect.value);

			let output;
			if (singleDecompression.value === 0) output = file.buffer.slice(fsentry.start, fsentry.end);
			else if (singleDecompression.value === 1) output = blz(file); // no caching

			if (!output) {
				downloadOutput.textContent = 'Failed to load/decompress';
				return;
			}

			downloadOutput.textContent = '';
			download(fsentry.name, output);
		});

		const multiExport = document.createElement('div');
		multiExport.textContent = 'Everything: ';
		section.appendChild(multiExport);

		const multiDecompression = dropdown(
			['Backwards LZSS only on overlays', 'No decompression'],
			0,
			() => {},
			undefined,
			true,
		);
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
				if (multiDecompression.value === 0 && fsentry.overlay) {
					dat = blz(dat); // no caching
					if (dat) {
						// if decompression succeeded
						// rename /dir/file.xyz => /dir/file-decomp.xyz
						const parts = name.split('.');
						name = parts.pop();
						name = `${parts.join('.')}-decomp.${name}`;
					} else {
						dat = fsentry;
					}
				}
				files.push({ name, dat });
			}

			const zip = zipStore(files);
			download(`${headers.gamecode}.zip`, zip, 'application/zip');
		});

		addHTML(section, '<div style="height: 1em;"></div>'); // separator

		const fsList = [];
		for (let i = 0; i < headers.fatLength / 8; ++i) fsList.push(fs.get(i));

		const sorting = dropdown(['Sort by index', 'Sort by length'], 0, () => resort(), undefined, true);
		section.appendChild(sorting);
		const sorted = document.createElement('div');
		section.appendChild(sorted);
		const resort = () => {
			if (sorting.value === 0) {
				fsList.sort((a, b) => a.index - b.index); // sort by index
			} else if (sorting.value === 1) {
				fsList.sort((a, b) => a.end - a.start - (b.end - b.start)); // sort by length
			}

			sorted.innerHTML = '';
			for (const fsentry of fsList) {
				addHTML(
					sorted,
					`<div><code>${str8(fsentry.index)}. 0x${str32(fsentry.start)} - 0x${str32(fsentry.end)}
					(len 0x${(fsentry.end - fsentry.start).toString(16)})</code> ${sanitize(fsentry.path)}</div>`,
				);
			}
		};
		resort();

		// JP and demo versions don't compress their overlays, but the others do
		const SHOULD_DECOMPRESS = !['CLJJ', 'Y6PE', 'Y6PP'].includes(headers.gamecode);
		const overlayCache = new Map();
		fs.overlay = (index) => {
			if (!SHOULD_DECOMPRESS) return fs.get(index);

			const cached = overlayCache.get(index);
			if (cached) return cached;

			const file = fs.get(index);
			if (!file) return undefined;

			const decomp = blz(file);
			overlayCache.set(index, decomp);
			return decomp;
		};

		return fs;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: File System (Extended)                                                                               |
	// +---------------------------------------------------------------------------------------------------------------+

	const fsext = (window.fsext = createSection('File System (Extended)', (section) => {
		const fsext = {};

		const varLengthSegments = fsext.varLengthSegments = (start, dat, segmentsDat) => {
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
		};

		const fixedIndices = fsext.fixedIndices = (o, end, dat) => {
			const indices = [];
			for (; o < end; o += 4) indices.push(dat.getInt32(o, true));
			return indices;
		};

		const fixedSegments = fsext.fixedSegments = (o, end, size, dat) => {
			const segments = [];
			for (; o < end; o += size) segments.push(sliceDataView(dat, o, o + size));
			return segments;
		};

		const fmapdata = fs.get('/FMap/FMapData.dat');

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
			fsext.fobj = varLengthSegments(0xe8a0, fs.overlay(3));
			fsext.fobjmon = varLengthSegments(0xba3c, fs.overlay(3));
			fsext.fobjpc = varLengthSegments(0xbdb0, fs.overlay(3));
			fsext.fpaf = varLengthSegments(0xb8a0, fs.overlay(3), fs.get('/FPaf/FPaf.dat'));
			fsext.fmapmetadata = fixedSegments(0x98a0, 0x98a0 + 12 * 0x2a9, 12, fs.overlay(3));
			fsext.fieldAnimeIndices = fixedIndices(0x18e84, 0x19fd0, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0x19fd0, 0x1d504, fs.overlay(3));
		} else if (headers.gamecode === 'CLJK') {
			// KO
			fsext.fevent = varLengthSegments(0xc8ac, fs.overlay(3));
			fsext.fmapdata = varLengthSegments(0x11310, fs.overlay(3), fs.get('/FMap/FMapData.dat'));
			fsext.fobj = varLengthSegments(0xe8a0, fs.overlay(3));
			fsext.fobjmon = varLengthSegments(0xba3c, fs.overlay(3));
			fsext.fobjpc = varLengthSegments(0xbdb0, fs.overlay(3));
			fsext.fpaf = varLengthSegments(0xb8a0, fs.overlay(3), fs.get('/FPaf/FPaf.dat'));
			fsext.fmapmetadata = fixedSegments(0x98a0, 0x98a0 + 12 * 0x2a9, 12, fs.overlay(3));
			fsext.fieldAnimeIndices = fixedIndices(0x18e84, 0x19fd0, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0x19fd0, 0x1d504, fs.overlay(3));
		} else if (headers.gamecode === 'CLJJ') {
			// JP
			fsext.fevent = varLengthSegments(0xcb18, fs.overlay(3));
			fsext.fmapdata = varLengthSegments(0x11544, fs.overlay(3), fs.get('/FMap/FMapData.dat'));
			fsext.fobj = varLengthSegments(0xeb0c, fs.overlay(3));
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
			fsext.fobj = varLengthSegments(0xe8a0, fs.overlay(3));
			fsext.fobjmon = varLengthSegments(0xba3c, fs.overlay(3));
			fsext.fobjpc = varLengthSegments(0xbdb0, fs.overlay(3));
			fsext.fpaf = varLengthSegments(0xb8a0, fs.overlay(3), fs.get('/FPaf/FPaf.dat'));
			fsext.fmapmetadata = fixedSegments(0x98a0, 0x98a0 + 12 * 0x2a9, 12, fs.overlay(3));
			fsext.fieldAnimeIndices = fixedIndices(0x18e84, 0x19fd0, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0x19fd0, 0x1d504, fs.overlay(3));
		} else if (headers.gamecode === 'Y6PP') {
			// EU Demo
			fsext.fevent = varLengthSegments(0x94c8, fs.overlay(3));
			fsext.fmapdata = varLengthSegments(0x9a3c, fs.overlay(3), fs.get('/FMap/FMapData.dat'));
			fsext.fobj = varLengthSegments(0x9cb0, fs.overlay(3));
			fsext.fobjmon = varLengthSegments(0x945c, fs.overlay(3));
			fsext.fobjpc = varLengthSegments(0x97f8, fs.overlay(3));
			fsext.fpaf = varLengthSegments(0x965c, fs.overlay(3), fs.get('/FPaf/FPaf.dat'));
			fsext.fmapmetadata = fixedSegments(0x92bc, 0x92bc + 12 * 0x21, 12, fs.overlay(3));
			fsext.fieldAnimeIndices = fixedIndices(0xe220, 0xe318, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0xe498, 0xe72c, fs.overlay(3));
		} else if (headers.gamecode === 'Y6PE') {
			// NA Demo
			fsext.fevent = varLengthSegments(0x94c8, fs.overlay(3));
			fsext.fmapdata = varLengthSegments(0x9a3c, fs.overlay(3), fs.get('/FMap/FMapData.dat'));
			fsext.fobj = varLengthSegments(0x9cb0, fs.overlay(3));
			fsext.fobjmon = varLengthSegments(0x945c, fs.overlay(3));
			fsext.fobjpc = varLengthSegments(0x97f8, fs.overlay(3));
			fsext.fpaf = varLengthSegments(0x965c, fs.overlay(3), fs.get('/FPaf/FPaf.dat'));
			fsext.fmapmetadata = fixedSegments(0x92bc, 0x92bc + 12 * 0x21, 12, fs.overlay(3));
			fsext.fieldAnimeIndices = fixedIndices(0xe164, 0xe25c, fs.overlay(3));
			fsext.fieldRoomIndices = fixedIndices(0xe3dc, 0xe670, fs.overlay(3));
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

	const field = (window.field = createSection('Field Maps', (section) => {
		const field = {};

		const treasureFile = fs.get('/Treasure/TreasureInfo.dat');

		const layoutPreview = document.createElement('div');
		section.appendChild(layoutPreview);

		let maxTreasureId = 0;
		field.rooms = [];
		for (let i = 0, j = 0; i < fsext.fieldRoomIndices.length; i += 5, ++j) {
			field.rooms[j] = {
				l1: fsext.fieldRoomIndices[i],
				l2: fsext.fieldRoomIndices[i + 1],
				l3: fsext.fieldRoomIndices[i + 2],
				props: fsext.fieldRoomIndices[i + 3],
				treasure: fsext.fieldRoomIndices[i + 4],
			};
			maxTreasureId = Math.max(maxTreasureId, field.rooms[j].treasure);
		}

		field.treasure = [[]];
		for (let i = 0; field.treasure.length - 1 <= maxTreasureId; ++i) {
			const packed = treasureFile.getUint16(i * 12, true);
			field.treasure[field.treasure.length - 1].push(sliceDataView(treasureFile, i * 12, i * 12 + 12));
			if (packed & 1) field.treasure.push([]); // end of this room's treasure
		}

		let updatePalettes = true;
		let updateTiles = true;
		let updateMaps = true;
		let updateOverlay2d = true;
		let updateOverlay3d = true;
		let updateOverlay3dTriangles = true;

		// define options UI
		const options = (field.options = {});
		const optionRows = [0, 1].map(() => document.createElement('div'));
		for (const row of optionRows) section.appendChild(row);

		optionRows[0].style.cssText = 'position: sticky; top: 0; z-index: 5; background: #11111b; margin-bottom: 1px;';

		options.roomDropdown = dropdown(
			field.rooms.map((_, i) => `Room 0x${i.toString(16)}`),
			0,
			() => roomPicked(),
		);
		optionRows[0].appendChild(options.roomDropdown);

		// options about displaying the map itself
		optionRows[0].appendChild((options.bg1 = checkbox('BG1', true, () => (updateMaps = updateOverlay2d = true))));
		optionRows[0].appendChild((options.bg2 = checkbox('BG2', true, () => (updateMaps = updateOverlay2d = true))));
		optionRows[0].appendChild((options.bg3 = checkbox('BG3', true, () => (updateMaps = updateOverlay2d = true))));
		optionRows[0].appendChild(
			(options.previewPalettes = checkbox('Palettes', false, () => componentLayoutChanged())),
		);
		optionRows[0].appendChild(
			(options.previewTilesets = checkbox('Tilesets', false, () => componentLayoutChanged())),
		);
		optionRows[0].appendChild(
			(options.margins = checkbox(
				'Margins',
				true,
				() => (updateMaps = updateOverlay2d = updateOverlay3d = true),
			)),
		);
		let animationsToggledCallback = () => {};
		optionRows[0].appendChild(
			(options.animations = checkbox('Animations', false, () => {
				animationsToggledCallback();
			})),
		);

		// options about overlays of extra data, put on top of the map
		optionRows[1].appendChild((options.treasure = checkbox('Treasure', false, () => (updateOverlay2d = true))));
		optionRows[1].appendChild((options.depth = checkbox('Depth', false, () => (updateOverlay2d = true))));
		optionRows[1].appendChild(
			(options.collision = checkbox(
				'Collision',
				false,
				() => (updateOverlay3d = updateOverlay3dTriangles = true),
			)),
		);

		// preview area layout
		const previewContainer = document.createElement('div');
		previewContainer.style.cssText = `width: 100%; display: grid; grid-template-columns: 1fr 300px; gap: 8px;
			margin-top: 8px;`;
		section.appendChild(previewContainer);

		const mapContainer = document.createElement('div');
		mapContainer.style.cssText = `grid-column: 1; grid-row: 1; max-width: 100%; overflow-x: auto;
			position: relative;`;
		previewContainer.appendChild(mapContainer);

		const componentContainer = document.createElement('div');
		componentContainer.style.cssText = `grid-column: 1; grid-row: 2; display: grid;
			grid-template-columns: repeat(8, 128px); max-width: 100%; overflow-x: auto;`;
		previewContainer.appendChild(componentContainer);

		const sideProperties = document.createElement('div');
		sideProperties.style.cssText = `grid-column: 2; grid-row: 1 / 3;`;
		previewContainer.appendChild(sideProperties);

		const bottomProperties = document.createElement('div');
		bottomProperties.style.cssText = 'grid-column: 1 / 3; grid-row: 3;';
		previewContainer.appendChild(bottomProperties);

		// map preview
		const mapCanvas = document.createElement('canvas');
		mapContainer.appendChild(mapCanvas);

		const map2dOverlay = document.createElement('canvas');
		map2dOverlay.style.cssText = 'position: absolute; top: 0; left: 0;';
		mapContainer.appendChild(map2dOverlay);

		const map3dOverlay = document.createElement('canvas');
		map3dOverlay.style.cssText = 'position: absolute; top: 0; left: 0;';
		mapContainer.appendChild(map3dOverlay);

		// component preview
		const paletteCanvases = [0, 1, 2].map(() => {
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = 16;
			canvas.style.cssText = 'display: none; width: 100%; height: 100%;';
			componentContainer.appendChild(canvas);
			return canvas;
		});

		const tilesetCanvases = [0, 1, 2].map(() => {
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = 256;
			canvas.style.cssText = 'display: none; width: 100%; height: 100%;';
			componentContainer.appendChild(canvas);
			return canvas;
		});

		const componentLayoutChanged = () => {
			const apply = (canvas, column, row) => {
				canvas.style.display = '';
				canvas.style.gridColumn = column;
				canvas.style.gridRow = row;
			};
			const hide = (canvas) => (canvas.style.display = 'none');

			if (options.previewPalettes.checked && options.previewTilesets.checked) {
				apply(paletteCanvases[0], '1', '1');
				apply(paletteCanvases[1], '2', '1');
				apply(paletteCanvases[2], '1', '2');
				apply(tilesetCanvases[0], '3 / 5', '1 / 3');
				apply(tilesetCanvases[1], '5 / 7', '1 / 3');
				apply(tilesetCanvases[2], '7 / 9', '1 / 3');
				componentContainer.style.gridTemplateRows = '128px 128px';
			} else if (options.previewPalettes.checked) {
				apply(paletteCanvases[0], '1', '1');
				apply(paletteCanvases[1], '2', '1');
				apply(paletteCanvases[2], '3', '1');
				for (const canvas of tilesetCanvases) hide(canvas);
				componentContainer.style.gridTemplateRows = '128px';
			} else if (options.previewTilesets.checked) {
				for (const canvas of paletteCanvases) hide(canvas);
				apply(tilesetCanvases[0], '1 / 3', '1 / 3');
				apply(tilesetCanvases[1], '3 / 5', '1 / 3');
				apply(tilesetCanvases[2], '5 / 7', '1 / 3');
				componentContainer.style.gridTemplateRows = '128px 128px';
			} else {
				for (const canvas of paletteCanvases) hide(canvas);
				for (const canvas of tilesetCanvases) hide(canvas);
				componentContainer.style.gridTemplateRows = '';
			}
		};

		// side properties
		const side = {};
		sideProperties.appendChild((side.layerDisplay = document.createElement('div')));
		sideProperties.appendChild((side.treasureDropdown = dropdown(['0 treasures'], 0, () => {})));
		sideProperties.appendChild((side.treasureDisplay = document.createElement('div')));
		sideProperties.appendChild((side.loadingZoneDropdown = dropdown(['0 loading zones'], 0, () => {})));
		sideProperties.appendChild((side.loadingZoneDisplay = document.createElement('div')));
		sideProperties.appendChild((side.collisionDropdown = dropdown(['0 prisms, 0 specials'], 0, () => {})));
		sideProperties.appendChild((side.collisionDisplay = document.createElement('div')));
		sideProperties.appendChild((side.layerAnimList = document.createElement('div')));
		sideProperties.appendChild((side.tileAnimList = document.createElement('div')));
		sideProperties.appendChild((side.metadataDisplay = document.createElement('div')));

		// setup basic 3d overlay
		const map3d = (() => {
			const gl = map3dOverlay.getContext('webgl2', {
				alpha: true,
				depth: true,
				preserveDrawingBuffer: true,
			});

			const vs = gl.createShader(gl.VERTEX_SHADER);
			gl.shaderSource(
				vs,
				`
				#version 300 es
				precision highp float;
				layout(location = 0) in vec3 a_pos;
				layout(location = 1) in vec4 a_color;
				out vec4 v_color;

				uniform vec2 canvas_size;
				uniform vec3 pivot;
				uniform mat3 rotation1;
				uniform mat3 rotation2;
				uniform vec3 translation;

				void main() {
					v_color = a_color;
					vec3 pos = rotation2 * rotation1 * (a_pos - pivot) + translation;
					pos = vec3(pos.xy / canvas_size * 2.0, pos.z);
					gl_Position = vec4(pos.x, -pos.y, 1.0 / (pos.z + 1000.0), 1);
				}
				`.trim(),
			);
			gl.compileShader(vs);
			if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS))
				throw `map3d vertex compilation fail:\n${gl.getShaderInfoLog(vs)}`;

			const fs = gl.createShader(gl.FRAGMENT_SHADER);
			gl.shaderSource(
				fs,
				`
				#version 300 es
				precision highp float;
				in vec4 v_color;
				out vec4 out_color;

				void main() {
					out_color = v_color;
				}
				`.trim(),
			);
			gl.compileShader(fs);
			if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS))
				throw `map3d fragment compilation fail:\n${gl.getShaderInfoLog(fs)}`;

			const program = gl.createProgram();
			gl.attachShader(program, vs);
			gl.attachShader(program, fs);
			gl.linkProgram(program);
			if (!gl.getProgramParameter(program, gl.LINK_STATUS))
				throw `map3d program link fail:\n${gl.getProgramInfoLog(program)}`;

			gl.useProgram(program);

			const vao = gl.createVertexArray();
			gl.bindVertexArray(vao);

			const buffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.enableVertexAttribArray(0);
			gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 4 * 7, 0);
			gl.enableVertexAttribArray(1);
			gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 4 * 7, 4 * 3);

			const canvasSize = gl.getUniformLocation(program, 'canvas_size');
			const pivot = gl.getUniformLocation(program, 'pivot');
			const rotation1 = gl.getUniformLocation(program, 'rotation1');
			const rotation2 = gl.getUniformLocation(program, 'rotation2');
			const translation = gl.getUniformLocation(program, 'translation');

			let lastClientX;
			let lastClientY;
			let rotX = 0;
			let rotY = Math.PI / 4;
			let dragging = false;
			map3dOverlay.addEventListener('mousedown', () => void (dragging = true));
			addEventListener('mouseup', () => void ((dragging = false), (lastClientX = lastClientY = undefined)));
			addEventListener('blur', () => void ((dragging = false), (lastClientX = lastClientY = undefined)));

			map3dOverlay.addEventListener('dragstart', (e) => e.preventDefault());

			map3dOverlay.addEventListener('mousemove', (e) => {
				if (!dragging) return;
				if (lastClientX !== undefined && lastClientY !== undefined) {
					rotX = (rotX - (e.clientX - lastClientX) * 0.01) % (2 * Math.PI);
					rotY = Math.min(Math.max(rotY - (e.clientY - lastClientY) * 0.01, 0), (Math.PI * 3) / 4);
					updateOverlay3d = true;
				}
				lastClientX = e.clientX;
				lastClientY = e.clientY;
			});

			return {
				buffer,
				rotX: () => rotX,
				rotY: () => rotY,
				uniforms: { canvasSize, pivot, rotation1, rotation2, translation },
			};
		})();

		field.room = undefined;

		const paletteImages = [0, 1, 2].map(() => new ImageData(16, 16));
		const tilesetImages = [0, 1, 2].map(() => new ImageData(256, 256));
		let mapBitmap = new Uint32Array(256 * 192);
		let vertexFloats = new Float32Array(7 * 1000);
		let vertexFloatsUsed = 0;

		const roomPicked = () => {
			const indices = field.rooms[options.roomDropdown.value];

			updatePalettes = updateTiles = updateMaps = updateOverlay2d = true;
			updateOverlay3d = updateOverlay3dTriangles = true;

			const room = (field.room = {
				indices,
				props: unpackSegmented(lzBis(fsext.fmapdata.segments[indices.props])),
				tilesets: [indices.l1, indices.l2, indices.l3].map(
					(index) => index !== -1 && bufToU8(lzBis(fsext.fmapdata.segments[index])),
				),
			});
			Object.assign(room, {
				tilemaps: [room.props[0], room.props[1], room.props[2]].map((buf) => bufToU16(buf)),
				palettes: [room.props[3], room.props[4], room.props[5]].map((buf) => rgb15To32(bufToU16(buf))),
				map: room.props[6],
				loadingZones: room.props[7],
				layerAnimations: room.props[9],
				tileAnimations: room.props[10],
				paletteAnimations: [room.props[11], room.props[12], room.props[13]].map((buf) =>
					unpackSegmented16(buf),
				),
				collision: room.props[14],
				depth: room.props[15],
			});
			room.enabledLayerAnimations = new Set();
			room.enabledTileAnimations = new Set();

			const mapWidth = room.map.getUint16(0, true);
			const mapHeight = room.map.getUint16(2, true);
			const mapFlags = bufToU8(room.map);
			room.actualHeight =
				Math.max(room.tilemaps[0].length, room.tilemaps[1].length, room.tilemaps[2].length) / mapWidth;

			const targetMapBitmapSize = mapWidth * Math.max(mapHeight, room.actualHeight) * 64;
			if (mapBitmap.length < targetMapBitmapSize) {
				let size = mapBitmap.length;
				while (size < targetMapBitmapSize) size *= 2;
				mapBitmap = new Uint32Array(size);
			}

			// side properties layer info
			const bgAttributes = [[], [], []];
			if (mapFlags[5] & 0x08) bgAttributes[1].push('above obj'); // BG2 above obj
			if (mapFlags[5] & 0x10) bgAttributes[0].push('above obj'); // BG1 above obj
			if (mapFlags[8] & 0x01) bgAttributes[2].push('above BG2'); // BG3 above BG2
			if (mapFlags[8] & 0x02) bgAttributes[2].push('above BG1'); // BG3 above BG1
			if (mapFlags[8] & 0x20) bgAttributes[0].push('autoscrolls'); // BG1 autoscrolls
			if (mapFlags[8] & 0x40) bgAttributes[1].push('autoscrolls'); // BG2 autoscrolls
			if (mapFlags[8] & 0x80) bgAttributes[2].push('autoscrolls'); // BG3 autoscrolls

			const bgSpeedLookup = ['-', '0.25x', '0.5x', '2x', '-1x', '-0.25x', '-0.5x', '-1x'];
			for (let i = 0; i < 3; ++i) {
				const layerFlags = mapFlags[9 + i];

				const horizontalSpeed = layerFlags & 7;
				const horizontalLocked = layerFlags & 8;
				const verticalSpeed = (layerFlags >> 4) & 7;
				const verticalLocked = (layerFlags >> 4) & 8;

				if (horizontalLocked && verticalLocked) bgAttributes[i].push('locked horizontally and vertically');
				else if (horizontalLocked) bgAttributes[i].push('locked horizontally');
				else if (verticalLocked) bgAttributes[i].push('locked vertically');

				if (horizontalSpeed) bgAttributes[i].push(`${bgSpeedLookup[horizontalSpeed]} horizontal`);
				if (verticalSpeed) bgAttributes[i].push(`${bgSpeedLookup[verticalSpeed]} vertical`);
			}

			side.layerDisplay.innerHTML = `
				<div><code>${mapWidth}x${mapHeight} tiles
					${room.actualHeight === mapHeight ? '' : `(${mapWidth}x${room.actualHeight} actual)`}
					(${mapWidth * 8}x${mapHeight * 8}px)
				</code></div>
				<div>${bgAttributes[0].length ? 'BG1: ' + bgAttributes[0].join(', ') : ''}</div>
				<div>${bgAttributes[1].length ? 'BG2: ' + bgAttributes[1].join(', ') : ''}</div>
				<div>${bgAttributes[2].length ? 'BG3: ' + bgAttributes[2].join(', ') : ''}</div>
			`;

			// side properties treasure
			const treasureSegments = field.treasure[indices.treasure] || [];
			const treasureOptions = [`${treasureSegments.length} treasures`];
			const treasureTypeLookup = [
				'Bean',
				'Floating Block',
				'-',
				'-',
				'Brick Block',
				'Grass',
				'-',
				'Underwater Brick Block',
			];
			for (let i = 0; i < treasureSegments.length; ++i) {
				const flags = treasureSegments[i].getUint16(0, true);
				const type = (flags >> 1) & 0xf;
				treasureOptions.push(`[${i}] ${treasureTypeLookup[type]}`);
			}
			side.treasureDropdown.replaceWith(
				(side.treasureDropdown = dropdown(treasureOptions, 0, () => {
					updateOverlay2d = true;
					if (side.treasureDropdown.value === 0) {
						side.treasureDisplay.innerHTML = '';
						return;
					}

					const treasure = treasureSegments[side.treasureDropdown.value - 1];
					const flags = treasure.getUint16(0, true);
					const itemId = treasure.getUint16(2, true);
					const treasureId = treasure.getUint16(4, true);
					side.treasureDisplay.innerHTML = `<div style="border-left: 1px solid #76f;
					margin-left: 1px; padding-left: 8px;">
					Treasure 0x${treasureId.toString(16)},
					item 0x${itemId.toString(16)},
					quantity 0x${((flags >> 10) & 0x1f).toString(16)},
					count/anim 0x${((flags >> 5) & 0x1f).toString(16)}</div>`;
				})),
			);
			side.treasureDisplay.innerHTML = '';

			// side properties loading zones
			const loadingZoneOptions = [`${room.loadingZones.byteLength / 24} loading zones`];
			for (let i = 0, o = 0; o < room.loadingZones.byteLength; ++i, o += 24) {
				const flags = room.loadingZones.getUint16(o, true);
				const toRoom = room.loadingZones.getUint16(o + 2, true);
				const direction = '↑→↓←'[(flags >> 2) & 3];
				loadingZoneOptions.push(`[${i}] ${direction} 0x${toRoom.toString(16)}`);
			}

			side.loadingZoneDropdown.replaceWith(
				(side.loadingZoneDropdown = dropdown(
					loadingZoneOptions,
					0,
					() => {
						updateOverlay3d = updateOverlay3dTriangles = true;
						if (side.loadingZoneDropdown.value === 0) {
							side.loadingZoneDisplay.innerHTML = '';
							return;
						}

						const o = (side.loadingZoneDropdown.value - 1) * 24;
						const [flags, roomId, x1, y1, z, x2, y2, enterX1, enterY1, enterZ, enterX2, enterY2] = bufToU16(
							sliceDataView(room.loadingZones, o, o + 24),
						);

						const lines = [];
						lines.push(`<code>([${x1}..${x1 + x2}], [${y1}..${y1 + y2}], ${z})</code>`);
						const xRange = !(flags & 2) || enterX2 === 1 ? enterX1 : `[${enterX1}..${enterX1 + enterX2}]`;
						const yRange = !(flags & 2) || enterY2 === 1 ? enterY1 : `[${enterY1}..${enterY1 + enterY2}]`;
						lines.push(`Enter at: <code>(${xRange}, ${yRange}, ${enterZ})</code>`);

						side.loadingZoneDisplay.innerHTML = `<div style="border-left: 1px solid #76f; margin-left: 1px;
					padding-left: 8px;">${lines.map((x) => '<div>' + x + '</div>').join(' ')}</div>`;
					},
					() => {
						updateOverlay3d = updateOverlay3dTriangles = true;
					},
				)),
			);
			side.loadingZoneDisplay.innerHTML = '';

			// side properties collision
			if (room.collision.byteLength) {
				const numBoxes = room.collision.getUint32(0, true);
				const numSpecials = room.collision.getUint32(4, true);

				const options = [`${numBoxes} prisms, ${numSpecials} specials`];
				for (let i = 0, o = 8; i < numBoxes; ++i, o += 40) {
					const solidActions = room.collision.getUint16(o + 4, true);
					const attributes = room.collision.getUint16(o + 6, true);

					let color;
					if (solidActions !== 0xffff) color = '#0ff';
					if (attributes & 0xfffe) color = '#f90';
					if (attributes & 1) color = '#f00';

					options.push(`[${i}] Prism ${color ? `<span style="color: ${color}">◼︎</span>` : ''}`);
				}
				for (let i = 0; i < numSpecials; ++i) options.push(`[${i}] Special`);
				side.collisionDropdown.replaceWith(
					(side.collisionDropdown = dropdown(
						options,
						0,
						() => {
							updateOverlay3d = updateOverlay3dTriangles = true;
							if (side.collisionDropdown.value === 0) {
								side.collisionDisplay.innerHTML = '';
								return;
							}

							const index = side.collisionDropdown.value - 1;
							let o = 8;
							o += Math.min(index, numBoxes) * 40; // first chunk of prisms
							o += Math.max(index - numBoxes, 0) * 24; // second chunk of... things

							if (index < numBoxes) {
								// prism
								const config = room.collision.getUint16(o, true);
								const debugId = room.collision.getUint16(o + 2, true);
								const solidActions = room.collision.getUint16(o + 4, true);
								const attributes = room.collision.getUint16(o + 6, true);

								const html = [];

								const configStrings = [];
								if (config & 1) configStrings.push('last');
								// if (config & 2) configStrings.push('snaps up'); // needs more research
								if (config & 4) configStrings.push('simple');
								if (configStrings.length) html.push(`<div>Config: ${configStrings.join(', ')}</div>`);

								for (let i = 0; i < 4; ++i) {
									const x = room.collision.getInt16(o + 8 + i * 8, true);
									const y = room.collision.getInt16(o + 8 + i * 8 + 2, true);
									const ztop = room.collision.getInt16(o + 8 + i * 8 + 4, true);
									const zbottom = room.collision.getInt16(o + 8 + i * 8 + 6, true);

									if (i === 3 && !(config & 8)) {
										// (config & 8) means the prism is four-pointed, 0 if three-pointed
										// very few prisms have a fourth vertex that isn't zeroed out
										if (x || y || ztop || zbottom) {
											html.push(
												`<div style="color: #f99;">v4 <code>(${x}, ${y}, [${zbottom}..${ztop}])</code></div>`,
											);
										}
									} else {
										html.push(
											`<div>v${i + 1} <code>(${x}, ${y}, [${zbottom}..${ztop}])</code></div>`,
										);
									}
								}

								html.push(`<div>Debug ID: ${debugId >> 6}</div>`);

								const actions = [
									'Walking', // 0x1
									'M&L Drilling', // 0x2
									'Mini Mario', // 0x4
									'M&L Stacked (before drill/twirl)', // 0x8
									'M&L Twirling', // 0x10
									,
									,
									,
									// 0x20
									// 0x40
									// 0x80
									'B Spike Balling', // 0x100
									,
									,
									,
									// 0x200
									// 0x400
									// 0x800
									'M&L Hammering / B Punching', // 0x1000
									'B Flaming', // 0x2000
									// 0x4000
									// 0x8000
									,
									,
								];
								const solidNames = [];
								const notSolidNames = [];
								for (let bit = 1, i = 0; bit < 0xffff; bit <<= 1, ++i) {
									if (!actions[i]) continue;
									if (solidActions & bit) solidNames.push(actions[i]);
									else notSolidNames.push(actions[i]);
								}
								if (notSolidNames.length === 0) {
									// do nothing
								} else if (solidNames.length === 0) {
									// not solid at all?
									html.push('<div style="color: #0ff;">Not solid</div>');
								} else if (solidNames.length >= notSolidNames.length) {
									html.push(
										`<div style="color: #0ff;">Solid unless: ${notSolidNames.join(', ')}</div>`,
									);
								} else {
									html.push(
										`<div style="color: #0ff;">Not solid unless: ${solidNames.join(', ')}</div>`,
									);
								}

								const attributeStrings = [];
								if (attributes & 1) attributeStrings.push('no-enter');
								if (attributes & 4) attributeStrings.push('spike ball grippy');
								if (attributes & 0x40) attributeStrings.push('unisolid');

								if (attributeStrings.length)
									html.push(`<div style="color: ${attributes & 1 ? '#f00' : '#f90'}">
								Attributes: ${attributeStrings.join(', ')}</div>`);

								side.collisionDisplay.innerHTML = `<div style="border-left: 1px solid #76f;
							margin-left: 1px; padding-left: 8px;">${html.join(' ')}</div>`;
							} else {
								// special
								side.collisionDisplay.innerHTML = `<div style="border-left: 1px solid #76f;
							margin-left: 1px; padding-left: 8px;"><code>${bytes(o, 24, room.collision)}</code></div>`;
							}
						},
						() => {
							updateOverlay3d = updateOverlay3dTriangles = true;
						},
					)),
				);
			} else {
				side.collisionDropdown.replaceWith(
					(side.collisionDropdown = dropdown(['0 prisms, 0 specials'], 0, () => {})),
				);
			}
			side.collisionDisplay.innerHTML = '';

			// side properties layer animations
			const layerAnimations = unpackSegmented(room.layerAnimations);
			side.layerAnimList.innerHTML = 'Layer Animations: ';
			for (let i = 1, j = 0; i < layerAnimations.length; i += 3, ++j) {
				if (layerAnimations[i].byteLength < 8) continue;

				const container = { segment: layerAnimations[i] }; // may contain the other two layers later
				const check = checkbox('', false, () => {
					if (check.checked) room.enabledLayerAnimations.add(container);
					else room.enabledLayerAnimations.delete(container);
					updateMaps = true;
				});
				side.layerAnimList.appendChild(check);
			}

			// side properties tile animations
			const tileAnimations = unpackSegmented(room.tileAnimations);
			side.tileAnimList.innerHTML = 'Tile Animations: ';
			const tileAnimationsDefault = [];
			for (let i = 0; i < tileAnimations.length; ++i) {
				const flags = tileAnimations[i].getUint32(0, true);
				const animeIndex = tileAnimations[i].getUint16(4, true);
				const animTileset = lzBis(fsext.fmapdata.segments[fsext.fieldAnimeIndices[animeIndex]]);
				const container = {
					nextUpdateTick: undefined,
					startTick: undefined,
					segment: tileAnimations[i],
					tileset: bufToU8(animTileset),
				};

				// only auto-enable if animation is "immediately looping" (flags & 4 == 0, flags & 8 == 0)
				if (!(flags & 0xc)) {
					tileAnimationsDefault.push(container);
					if (options.animations.checked) room.enabledTileAnimations.add(container);
				}
				const check = checkbox('', options.animations.checked && !(flags & 0xc), () => {
					if (check.checked) {
						container.startTick = Math.floor((performance.now() / 1000) * 60);
						room.enabledTileAnimations.add(container);
						if (room.enabledTileAnimations.size === 1) options.animations.set(true, true);
					} else {
						room.enabledTileAnimations.delete(container);
						if (room.enabledTileAnimations.size === 0) options.animations.set(false, true);
					}
					updateTiles = updateMaps = true;
				});
				container.check = check;
				side.tileAnimList.appendChild(check);
			}

			animationsToggledCallback = () => {
				for (const { check } of room.enabledTileAnimations) check.set(false, true);
				room.enabledTileAnimations.clear();
				updatePalettes = updateTiles = updateMaps = true;
				if (!options.animations.checked) return;
				for (const container of tileAnimationsDefault) {
					room.enabledTileAnimations.add(container);
					container.check.set(true, true);
				}
			};

			// side properties map metadata
			if (fsext.fmapmetadata) {
				side.metadataDisplay.innerHTML = 'Metadata:';
				const metadata = bufToU32(fsext.fmapmetadata[options.roomDropdown.value]);
				addHTML(
					side.metadataDisplay,
					`<ul>
				<li>X.b1: ${metadata[0] & 1}</li>
				<li>X.b2: ${metadata[0] & 2}</li>
				<li>X.SELECT map ID: 0x${((metadata[0] >> 2) & 0x3ff).toString(16)}</li>
				<li>X.SELECT map anim: ${(metadata[0] >> 12) & 0x3ff}</li>
				<li>X.variable: ${metadata[0] >> 22}</li>
				<li>Y.unknown: ${metadata[1] & 0x3ffff}</li>
				<li>Y.baseX: ${metadata[1] >> 20}</li>
				<li>Z.baseY: ${metadata[2] & 0xfff}</li>
				<li>Z.musicID: ${metadata[2] >> 12}</li>
			</ul>`,
				);
			}

			// bottom properties
			bottomProperties.innerHTML = '';
			addHTML(
				bottomProperties,
				`<div>Layers: <code>
				BG1 ${indices.l1 !== -1 ? '0x' + indices.l1.toString(16) : '-1'},
				BG2 ${indices.l2 !== -1 ? '0x' + indices.l2.toString(16) : '-1'},
				BG3 ${indices.l3 !== -1 ? '0x' + indices.l3.toString(16) : '-1'},
				Props 0x${indices.props.toString(16)},
				Treasure ${indices.treasure !== -1 ? '0x' + indices.treasure.toString(16) : '-1'}
			</code></div>`,
			);

			const blendingItems = [];
			const blending = unpackSegmented(room.props[8]);
			for (let i = 0; i < blending.length; ++i) {
				blendingItems.push(`<code>${bytes(0, blending[i].byteLength, blending[i])}</code>`);
			}

			const layerAnimationItems = [];
			for (let i = 0, j = 1; j < layerAnimations.length; ++i, j += 3) {
				const segment = layerAnimations[j];
				const second = layerAnimations[j + 1];
				const third = layerAnimations[j + 2];

				let str = `<code>${i}:</code> `;
				if (segment.byteLength >= 8) {
					const x = segment.getUint16(0, true);
					const y = segment.getUint16(2, true);
					const w = segment.getUint16(4, true);
					const h = segment.getUint16(6, true);
					str += `<code>(${x}, ${y})</code> size <code>(${w}, ${h})</code>, `;

					const displays = [];
					for (let j = 0; j < 3; ++j) {
						let tally = 0;
						for (let k = 0; k < w * h; ++k) {
							const tile = segment.getUint16(8 + (j * w * h + k) * 2, true);
							if (tile !== 0x3ff) ++tally;
						}

						if (tally) displays.push(`BG${j + 1} ${Math.round((tally / (w * h)) * 100)}%`);
					}
					str += displays.join(', ');
				} else {
					str += '(no tiles)';
				}

				if (second?.byteLength || third?.byteLength) {
					str += '<ul>';
					if (second?.byteLength)
						str += `<li>second: <code>${bytes(0, second.byteLength, second)}</code></li>`;
					if (third?.byteLength) str += `<li>third: <code>${bytes(0, third.byteLength, third)}</code></li>`;
					str += '</ul>';
				}
				layerAnimationItems.push(str);
			}

			const tileAnimationItems = [];
			for (let i = 0; i < tileAnimations.length; ++i) {
				const segment = tileAnimations[i];
				const flags = segment.getUint32(0, true);
				const animeId = segment.getUint16(4, true);
				const keyframes = segment.getUint16(6, true);

				const parts = [];
				parts.push(`<code>${i}:</code>`);
				parts.push(`BG${(flags & 3) + 1},`);
				parts.push(flags & 8 ? 'scripted' : 'immediately');
				parts.push(flags & 4 ? 'one-shot,' : 'looping,');
				parts.push(`anime <code>0x${animeId.toString(16)}</code>,`);
				parts.push(`${(flags >> 14) & 0x3ff} tiles at <code>0x${((flags >> 4) & 0x3ff).toString(16)}</code>,`);
				parts.push(`${keyframes} keyframes (frame, ticks):`);

				for (let j = 0; j < keyframes; ++j) {
					const frame = segment.getUint16(8 + j * 4, true);
					const ticks = segment.getUint16(8 + j * 4 + 2, true);
					parts.push(`<code style="color: ${j % 2 ? '#999' : '#666'}">(${frame},${ticks})</code>`);
				}

				tileAnimationItems.push(parts.join(' '));
			}

			const lines = [
				`[6] map: <code>${bytes(0, room.map.byteLength, room.map)}</code>`,
				`[7] loadingZones: ${room.loadingZones.byteLength} bytes`,
				`[8] blending: <ul>${blendingItems.map((x) => '<li>' + x + '</li>').join('')}</ul>`,
				`[9] layerAnimations: <ul>${layerAnimationItems.map((x) => '<li>' + x + '</li>').join('')}</ul>`,
				`[10] tileAnimations: <ul>${tileAnimationItems.map((x) => '<li>' + x + '</li>').join('')}</ul>`,
				`[11] paletteAnimations BG1: <ul>${fpaf
					.stringify(room.paletteAnimations[0])
					.map((x) => '<li><code>' + x + '</code></li>')
					.join('')}</ul>`,
				`[12] paletteAnimations BG2: <ul>${fpaf
					.stringify(room.paletteAnimations[1])
					.map((x) => '<li><code>' + x + '</code></li>')
					.join('')}</ul>`,
				`[13] paletteAnimations BG3: <ul>${fpaf
					.stringify(room.paletteAnimations[2])
					.map((x) => '<li><code>' + x + '</code></li>')
					.join('')}</ul>`,
				`[14] collision:`,
				`[15] depth:`,
				`[16] unused: <code>${bytes(0, Math.min(1024, room.props[16].byteLength), room.props[16])}</code>`,
				`[17] unused: <code>${bytes(0, Math.min(1024, room.props[17].byteLength), room.props[17])}</code>`,
			];
			for (const line of lines) addHTML(bottomProperties, '<div>' + line + '</div>');
		};
		roomPicked();

		// i write this boilerplate a LOT so this is a nice shorthand for the devtools console
		field.props = function* () {
			for (let i = 0; i < field.rooms.length; ++i) {
				yield [i, unpackSegmented(lzBis(fsext.fmapdata.segments[field.rooms[i].props]))];
			}
		};

		const palettes = [];
		const render = () => {
			const { room } = field;

			const now = performance.now();
			const tick = Math.floor((now / 1000) * 60);

			const layerWidth = room.map.getUint16(0, true);
			const layerHeight = room.map.getUint16(2, true);
			const layerFlags = bufToU8(room.map);
			const roomHeight = Math.max(layerHeight, room.actualHeight);

			const canvasWidth = options.margins.checked ? layerWidth * 8 : layerWidth * 8 - 32;
			const canvasHeight = options.margins.checked ? roomHeight * 8 : roomHeight * 8 - 32;

			if (options.animations.checked && room.paletteAnimations.some((x) => x.length)) {
				updatePalettes = updateTiles = updateMaps = true;
			}
			if (updatePalettes) {
				for (let i = 0; i < 3; ++i) {
					const ctx = paletteCanvases[i].getContext('2d');
					if (!room.palettes[i]?.byteLength) {
						palettes[i] = room.palettes[i];
						ctx.clearRect(0, 0, 16, 16);
						continue;
					}

					if (options.animations.checked && room.paletteAnimations[i].length) {
						const palette = new Uint32Array(256);
						palette.set(room.palettes[i], 0);
						palettes[i] = palette;
						fpaf.apply(palette, room.paletteAnimations[i], tick);
					} else {
						palettes[i] = room.palettes[i];
					}

					paletteImages[i].data.set(bufToU8(palettes[i]));
					ctx.putImageData(paletteImages[i], 0, 0);
				}
			}

			for (const { nextUpdateTick } of room.enabledTileAnimations) {
				if (nextUpdateTick === undefined || nextUpdateTick <= tick) {
					updateTiles = updateMaps = true;
					break;
				}
			}

			if (updateTiles || updateMaps) {
				const layouts = [new Array(1024), new Array(1024), new Array(1024)];
				for (let i = 0; i < 3; ++i) {
					if (!room.tilesets[i]) continue;
					const tileSize = layerFlags[5] & (1 << i) ? 64 : 32;
					for (let j = 0; j < 1024; ++j) {
						layouts[i][j] = room.tilesets[i].slice(j * tileSize, (j + 1) * tileSize);
					}
				}

				for (const container of room.enabledTileAnimations) {
					const { startTick, segment, tileset } = container;
					const field = segment.getUint32(0, true);
					const layer = field & 3;

					let animationLength = 0;
					const keyframes = segment.getUint16(6, true);
					for (let j = 0; j < keyframes; ++j) animationLength += segment.getUint16(8 + j * 4 + 2, true);

					let animationFrame;
					// (field & 4) means whether the animation is one-shot
					let localTick = field & 4 ? tick - startTick : tick % animationLength;
					for (let i = 0; i < keyframes; ++i) {
						const frame = segment.getUint16(8 + i * 4, true);
						const keyframeLength = segment.getUint16(8 + i * 4 + 2, true);
						if (localTick < keyframeLength) {
							animationFrame = frame;
							container.nextUpdateTick = tick + (keyframeLength - localTick);
							break;
						}
						localTick -= keyframeLength;
					}
					if (animationFrame === undefined) continue;

					const replacementStart = (field >> 4) & 0x3ff;
					const replacementLength = (field >> 14) & 0x3ff;
					const tileSize = layerFlags[5] & (1 << layer) ? 64 : 32;
					for (let i = 0; i < replacementLength; ++i) {
						layouts[layer][replacementStart + i] = tileset.slice(
							(replacementLength * animationFrame + i) * tileSize,
							(replacementLength * animationFrame + i + 1) * tileSize,
						);
					}
				}

				if (updateTiles) {
					for (let i = 0; i < 3; ++i) {
						const ctx = tilesetCanvases[i].getContext('2d');
						if (!room.tilesets[i] || !palettes[i]) {
							ctx.clearRect(0, 0, 256, 256);
							continue;
						}

						const bitmap = bufToU32(tilesetImages[i].data);
						const tileByteSize = layerFlags[5] & (1 << i) ? 64 : 32; // 256-color or 16-color
						const numTiles = Math.ceil(room.tilesets[i].length / tileByteSize);

						bitmap.fill(0, 0, 256 * 256);

						for (let j = 0; j < numTiles; ++j) {
							const basePos = ((j >> 5) << 11) | ((j & 0x1f) << 3); // y << 8 | x

							const tile = layouts[i][j];
							if (layerFlags[5] & (1 << i)) {
								// 256-color
								for (let k = 0; k < 64; ++k) {
									const pos = basePos | ((k >> 3) << 8) | (k & 7);
									bitmap[pos] = palettes[i][tile[k] || 0];
								}
							} else {
								// 16-color
								for (let k = 0, o = 0; k < 64; k += 2, ++o) {
									const pos = basePos | ((k >> 3) << 8) | (k & 7);
									const composite = tile[o] || 0;
									bitmap[pos] = palettes[i][composite & 0xf];
									bitmap[pos ^ 1] = palettes[i][composite >> 4];
								}
							}
						}

						ctx.putImageData(tilesetImages[i], 0, 0);
					}
				}

				if (updateMaps) {
					// rooms are always cleared with BG3's 0th color
					mapBitmap.fill(palettes[2][0], 0, layerWidth * roomHeight * 64);

					const mapLayouts = [
						new Uint16Array(layerWidth * roomHeight),
						new Uint16Array(layerWidth * roomHeight),
						new Uint16Array(layerWidth * roomHeight),
					];
					for (let i = 0; i < 3; ++i) {
						for (let j = 0; j < layerWidth * roomHeight; ++j) {
							mapLayouts[i][j] = room.tilemaps[i][j];
						}
					}

					// layer animations first
					for (const { segment } of room.enabledLayerAnimations) {
						const segmentU16 = bufToU16(segment);
						const x = segment.getInt16(0, true);
						const y = segment.getInt16(2, true);
						const w = segment.getInt16(4, true);
						const h = segment.getInt16(6, true);
						for (let i = 0; i < 3; ++i) {
							for (let j = 0; j < w * h; ++j) {
								const jx = j % w;
								const jy = Math.floor(j / w);
								const newTile = segmentU16[4 + i * w * h + j];
								if (newTile !== 0x3ff) mapLayouts[i][(y + jy) * layerWidth + x + jx] = newTile;
							}
						}
					}

					// then draw
					for (let i = 2; i >= 0; --i) {
						if (
							!room.tilemaps[i] ||
							!room.tilesets[i] ||
							!palettes[i] ||
							![options.bg1, options.bg2, options.bg3][i].checked
						)
							continue;
						const layout = mapLayouts[i];

						for (let j = 0; j < layout.length; ++j) {
							const tileX = j % layerWidth;
							const tileY = Math.floor(j / layerWidth);
							const basePos = tileY * 64 * layerWidth + tileX * 8;

							const baseTile = layout[j] & 0x3ff;
							const tile = layouts[i][baseTile];

							const horizontalFlip = layout[j] & 0x400 ? 7 : 0;
							const verticalFlip = layout[j] & 0x800 ? 7 : 0;
							if (layerFlags[5] & (1 << i)) {
								// 256-color
								for (let o = 0; o < 64; ++o) {
									const pos =
										basePos +
										((o >> 3) ^ verticalFlip) * 8 * layerWidth +
										((o & 7) ^ horizontalFlip);
									if (tile[o]) mapBitmap[pos] = palettes[i][tile[o]];
								}
							} else {
								// 16-color
								const paletteShift = (layout[j] >> 12) << 4;
								for (let k = 0, o = 0; k < 64; k += 2, ++o) {
									const pos =
										basePos +
										((k >> 3) ^ verticalFlip) * 8 * layerWidth +
										((k & 7) ^ horizontalFlip);
									const composite = tile[o] || 0;
									if (composite & 0xf) mapBitmap[pos] = palettes[i][paletteShift | (composite & 0xf)];
									if (composite >> 4)
										mapBitmap[pos ^ 1] = palettes[i][paletteShift | (composite >> 4)];
								}
							}
						}
					}

					const imageData = new ImageData(
						bufToU8Clamped(mapBitmap, 0, layerWidth * roomHeight * 64 * 4),
						layerWidth * 8,
						roomHeight * 8,
					);
					const ctx = mapCanvas.getContext('2d');

					mapCanvas.width = canvasWidth;
					mapCanvas.height = canvasHeight;
					if (options.margins.checked) ctx.putImageData(imageData, 0, 0);
					else ctx.putImageData(imageData, -16, -16);
				}
			}

			if (updateOverlay2d) {
				const ctx = map2dOverlay.getContext('2d');
				map2dOverlay.width = canvasWidth;
				map2dOverlay.height = canvasHeight;

				ctx.save();
				ctx.font = 'bold 14px "Red Hat Mono"';

				if (options.treasure.checked) {
					const selectedIndex = side.treasureDropdown.value - 1;
					const treasureSegments = field.treasure[room.indices.treasure] || [];
					for (let i = 0; i < treasureSegments.length; ++i) {
						const treasure = treasureSegments[i];
						const flags = treasure.getUint16(0, true);
						const type = (flags >> 1) & 0xf;
						const x = treasure.getInt16(6, true);
						const y = treasure.getInt16(8, true);
						const z = treasure.getInt16(10, true);

						const drawX = x + (options.margins.checked ? 16 : 0);
						const drawY = y - z + (options.margins.checked ? 16 : 0);

						ctx.fillStyle = selectedIndex === i ? '#fff8' : '#ff08';
						ctx.strokeStyle = '#000';
						ctx.lineWidth = 1;
						ctx.fillRect(drawX - 8, drawY - 8, 16, 16);
						ctx.strokeRect(drawX - 7.5, drawY - 7.5, 15, 15);

						const str = ['B Bean', 'f Block', '-', '-', 'b Block', 'G Grass', '-', 'u Block'][type];
						ctx.fillStyle = selectedIndex === i ? '#888' : '#880';
						ctx.strokeStyle = selectedIndex === i ? '#fff' : '#ff0';
						ctx.lineWidth = 5;
						ctx.strokeText(str, drawX - 4, drawY + 4);
						ctx.fillText(str, drawX - 4, drawY + 4);
					}
				}

				if (options.depth.checked && room.depth.byteLength >= 4) {
					const numDepths = room.depth.getUint32(0, true);
					const enabledLayers =
						!!options.bg1.checked | (!!options.bg2.checked << 1) | (!!options.bg3.checked << 2);
					for (let i = 0, o = 4; i < numDepths; ++i, o += 12) {
						const data = room.depth.getUint16(o, true);
						const flags = room.depth.getUint16(o + 2, true);
						if (!(flags & enabledLayers)) continue; // don't show if none of its layers are drawn

						const x1 = room.depth.getInt16(o + 4, true);
						const x2 = room.depth.getInt16(o + 6, true);
						const y1 = room.depth.getInt16(o + 8, true);
						const y2 = room.depth.getInt16(o + 10, true);

						const drawX = x1 - (options.margins.checked ? 0 : 16);
						const drawY = y1 - (options.margins.checked ? 0 : 16);

						ctx.fillStyle =
							'#' + [0, 1, 2].map((i) => (flags & enabledLayers & (1 << i) ? 'f' : '6')).join('') + '8';
						ctx.strokeStyle = '#000';
						ctx.lineWidth = 1;
						ctx.fillRect(drawX, drawY, x2 - x1, y2 - y1);
						ctx.strokeRect(drawX + 0.5, drawY + 0.5, x2 - x1 - 1, y2 - y1 - 1);

						ctx.fillStyle =
							'#' + [0, 1, 2].map((i) => (flags & enabledLayers & (1 << i) ? 'f' : '6')).join('');
						ctx.lineWidth = 5;
						ctx.strokeText(str16(data), drawX + 5, drawY + 15);
						ctx.fillText(str16(data), drawX + 5, drawY + 15);
					}
				}

				ctx.restore();
			}

			if (updateOverlay3d) {
				const gl = map3dOverlay.getContext('webgl2');
				map3dOverlay.width = canvasWidth;
				map3dOverlay.height = canvasHeight;
				gl.viewport(0, 0, canvasWidth, canvasHeight);

				gl.enable(gl.DEPTH_TEST);
				gl.depthFunc(gl.LEQUAL);

				gl.clearColor(0, 0, 0, 0);
				gl.clearDepth(1);
				gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

				if (updateOverlay3dTriangles) {
					vertexFloatsUsed = 0;
					let minX, maxX, minY, maxY, minZ, maxZ;
					const vertex = (xyz, rgb) => {
						if (vertexFloatsUsed * 7 + 6 >= vertexFloats.length) {
							// resize float array as necessary
							const old = vertexFloats;
							vertexFloats = new Float32Array(old.length * 2);
							vertexFloats.set(old, 0);
						}

						vertexFloats.set([xyz[0], xyz[1], xyz[2], rgb[0], rgb[1], rgb[2], 1], vertexFloatsUsed * 7);

						if (!vertexFloatsUsed || xyz[0] < minX) minX = xyz[0];
						if (!vertexFloatsUsed || maxX < xyz[0]) maxX = xyz[0];
						if (!vertexFloatsUsed || xyz[1] < minY) minY = xyz[1];
						if (!vertexFloatsUsed || maxY < xyz[1]) maxY = xyz[1];
						if (!vertexFloatsUsed || xyz[2] < minZ) minZ = xyz[2];
						if (!vertexFloatsUsed || maxZ < xyz[2]) maxZ = xyz[2];
						++vertexFloatsUsed;
					};

					const tri = (v1, v2, v3, rgb) => {
						vertex(v1, rgb);
						vertex(v2, rgb);
						vertex(v3, rgb);
					};

					/** v1 -> v4 should go around in a circle, clockwise or counter-clockwise */
					const quad = (v1, v2, v3, v4, rgb) => {
						tri(v1, v2, v3, rgb);
						tri(v3, v4, v1, rgb);
					};

					const cube = (b1, b2, b3, b4, t1, t2, t3, t4, rgb1, rgb2, rgb3, rgb4, rgb5, rgb6) => {
						quad(b1, b2, b3, b4, rgb1);
						quad(b1, b2, t2, t1, rgb2);
						quad(b2, b3, t3, t2, rgb3);
						quad(b3, b4, t4, t3, rgb4);
						quad(b1, b4, t4, t1, rgb5);
						quad(t1, t2, t3, t4, rgb6);
					};

					const prism = (b1, b2, b3, t1, t2, t3, rgb1, rgb2, rgb3, rgb4, rgb5) => {
						tri(b1, b2, b3, rgb1);
						quad(b1, b2, t2, t1, rgb2);
						quad(b2, b3, t3, t2, rgb3);
						quad(b1, b3, t3, t2, rgb4);
						tri(t1, t2, t3, rgb5);
					};

					if (options.collision.checked) {
						// loading zones
						const selectedLoadingZone =
							(side.loadingZoneDropdown.hovered ?? side.loadingZoneDropdown.value) - 1;
						for (let i = 0, o = 0; o < room.loadingZones.byteLength; ++i, o += 24) {
							const flags = room.loadingZones.getUint16(o, true);
							const x1 = room.loadingZones.getInt16(o + 4, true);
							const y1 = room.loadingZones.getInt16(o + 6, true);
							const z = room.loadingZones.getInt16(o + 8, true);
							const x2 = room.loadingZones.getInt16(o + 10, true);
							const y2 = room.loadingZones.getInt16(o + 12, true);

							const baseColor = selectedLoadingZone === i ? [0, 0, 1] : [1, 0, 1];
							const frontColor = selectedLoadingZone === i ? [0.5, 0.5, 1] : [1, 0.5, 1];

							const colors = [baseColor, baseColor, baseColor, baseColor, baseColor, baseColor];
							const direction = (flags >> 2) & 3;
							// [3, 4, 1, 2] <=> [upwards, rightwards, downwards, leftwards] exit
							colors[[3, 4, 1, 2][direction]] = frontColor;
							// upwards: x1 +>, prefer lower y => color 1
							// downwards: x1 +>, prefer higher y => color 3
							// leftwards: prefer lower x, y1 +> => color 4
							// rightwards: prefer higher x, y1 +> => color 2

							cube(
								[x1, y1, z],
								[x1 + x2, y1, z],
								[x1 + x2, y1 + y2, z],
								[x1, y1 + y2, z],
								[x1, y1, z + 24],
								[x1 + x2, y1, z + 24],
								[x1 + x2, y1 + y2, z + 24],
								[x1, y1 + y2, z + 24],
								...colors,
							);
						}

						// actual collision
						if (room.collision.byteLength > 0) {
							const numPrisms = room.collision.getUint32(0, true);
							const numSpecials = room.collision.getUint32(4, true);
							const selectedPrism = (side.collisionDropdown.hovered ?? side.collisionDropdown.value) - 1;

							let o = 8;
							for (let i = 0; i < numPrisms; ++i, o += 40) {
								const flags1 = room.collision.getUint16(o, true);
								const flags2 = room.collision.getUint16(o + 2, true);
								const flags3 = room.collision.getUint16(o + 4, true);
								const flags4 = room.collision.getUint16(o + 6, true);

								const fourPointed = flags1 & 8;
								const top = [];
								const bottom = [];
								for (let j = 0; j < (fourPointed ? 4 : 3); ++j) {
									const x = room.collision.getInt16(o + 8 + j * 8, true);
									const y = room.collision.getInt16(o + 8 + j * 8 + 2, true);
									const z1 = room.collision.getInt16(o + 8 + j * 8 + 4, true);
									const z2 = room.collision.getInt16(o + 8 + j * 8 + 6, true);
									top.push([x, y, z1]);
									bottom.push([x, y, z2]);
								}

								const flat =
									bottom[0][2] === top[0][2] &&
									bottom[1][2] === top[1][2] &&
									bottom[2][2] === top[2][2] &&
									bottom[3]?.[2] === top[3]?.[2];

								let color = [1, 1, 1];
								if (flags3 !== 0xffff) color = [0, 1, 1]; // not solid in at least one action
								if (flags4 & 1) color = [1, 0, 0]; // can't enter
								if (flags4 & 0xfffc) color = [1, 0.6, 0.1]; // strange attributes (unisolid, grippy, ..)

								if (selectedPrism === i) color = [0, 0, 1];

								// random-ish but predictable shading, so depth is way easier to see
								const rotr8 = (x, r) => (x >> r) | (x << (8 - r));
								const multiplier =
									0.9 + (((rotr8(i, 1) ^ rotr8(i, 3) ^ rotr8(i, 6)) & 0xff) / 0xff) * 0.1;
								color = color.map((x) => x * multiplier);

								const midColor = color.map((x) => x * 0.8);
								const lowColor = color.map((x) => x * 0.6);

								if (flat) {
									if (fourPointed) quad(...bottom, color);
									else tri(...bottom, color);
								} else if (fourPointed) {
									cube(...bottom, ...top, lowColor, midColor, midColor, midColor, midColor, color);
								} else {
									prism(...bottom, ...top, lowColor, midColor, midColor, midColor, color);
								}
							}

							for (let i = 0; i < numSpecials; ++i, o += 24) {
								const x1 = room.collision.getUint16(o + 4, true);
								const x2 = room.collision.getUint16(o + 6, true);
								const y1 = room.collision.getUint16(o + 8, true);
								const y2 = room.collision.getUint16(o + 10, true);
								const z = room.collision.getUint16(o + 12, true);
								quad([x1, y1, z], [x2, y1, z], [x2, y2, z], [x1, y2, z], [0.25, 1, 0.25]);
							}
						}
					}

					gl.bindBuffer(gl.ARRAY_BUFFER, map3d.buffer);
					gl.bufferData(gl.ARRAY_BUFFER, vertexFloats, gl.STATIC_DRAW);

					gl.uniform3f(map3d.uniforms.pivot, (minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
				}

				const sinX = Math.sin(map3d.rotX());
				const cosX = Math.cos(map3d.rotX());
				const sinY = Math.sin(map3d.rotY());
				const cosY = Math.cos(map3d.rotY());
				gl.uniformMatrix3fv(
					map3d.uniforms.rotation1,
					false,
					new Float32Array([cosX, sinX, 0, -sinX, cosX, 0, 0, 0, 1]),
				);
				gl.uniformMatrix3fv(
					map3d.uniforms.rotation2,
					false,
					new Float32Array([1, 0, 0, 0, cosY, sinY, 0, -sinY, cosY]),
				);
				if (options.margins.checked) gl.uniform3f(map3d.uniforms.translation, 8, 8, 0);
				else gl.uniform3f(map3d.uniforms.translation, 0, 0, 0);
				gl.uniform2f(map3d.uniforms.canvasSize, canvasWidth, canvasHeight);

				if (vertexFloatsUsed) gl.drawArrays(gl.TRIANGLES, 0, vertexFloatsUsed);
			}

			updatePalettes = updateTiles = updateMaps = updateOverlay2d = false;
			updateOverlay3d = updateOverlay3dTriangles = false;

			requestAnimationFrame(render);
		};
		render();

		return field;
	}));

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
		const rgb16s = [
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
			const [b, g, r] = rgb16s[i];
			const rgb16 = (r << 10) | (g << 5) | b;
			for (let o = 0; o < 512; o += 32) globalPalette16.setUint16(o + i * 2, rgb16, true);
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

				let o = 1;
				while (o < segment.length) {
					const command = segment[o] & 0xff;
					const params = segment[o] >> 8;
					++o;

					switch (command) {
						case 0x41:
							tilesetStart = segment[o++];
							break;
						case 0x19:
							replacementLength = segment[o++];
							break;
						case 0x1a:
							tilesetAnimatedStart = segment[o++];
							break;
						case 0x00:
							for (let j = 0; j <= params / 2; ++j) keyframeIndices.push(segment[o++]);
							break;
						case 0x1b:
							for (let j = 0; j < keyframeIndices.length; ++j) {
								const length = segment[o++];
								totalLength += length;
								keyframeLengths.push(length);
							}
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
				});
			}

			// metadata below
			metaPreview.innerHTML = '';

			const lines = [];
			if (room.tileset) lines.push(`[0] tileset: 0x${Math.ceil(room.tileset.length / 32).toString(16)} tiles`);
			else lines.push('[0] tileset: none');

			lines.push(`[1] palette: ${room.palette ? 'exists' : ''}`);
			lines.push(`[2] BG1: ${room.tilemaps[0] ? room.tilemaps[0].byteLength + ' bytes' : ''}`);
			lines.push(`[3] BG1: ${room.tilemaps[1] ? room.tilemaps[1].byteLength + ' bytes' : ''}`);
			lines.push(`[4] BG1: ${room.tilemaps[2] ? room.tilemaps[2].byteLength + ' bytes' : ''}`);

			const palAnimLines = fpaf.stringify(room.paletteAnimations);
			lines.push(
				`[5] paletteAnimations: <ul>${palAnimLines.map((x) => '<li><code>' + x + '</code></li>').join('')}</ul>`,
			);

			const tileAnimLines = [];
			for (let i = 0; i < room.tileAnimations.length; ++i) {
				const anim = room.tileAnimations[i];
				const parts = [];
				parts.push(`0x${anim.replacementLength.toString(16)} tiles from
				0x${anim.tilesetAnimatedStart.toString(16)} (animated) into 0x${anim.tilesetStart.toString(16)}`);

				const keyframes = [];
				for (let i = 0; i < anim.keyframeLengths.length; ++i) {
					const index = anim.keyframeIndices[i];
					const length = anim.keyframeLengths[i];
					keyframes.push(`<span style="color: ${i % 2 ? '#999' : '#666'}">(${index}, ${length})</span>`);
				}
				parts.push('keyframes (index, length): <code>' + keyframes.join(' ') + '</code>');

				tileAnimLines.push(`<code>${i}:</code> ${parts.join(', ')}`);
			}
			lines.push(`[6] tileAnimations: <ul>${tileAnimLines.map((x) => '<li>' + x + '</li>').join('')}</ul>`);

			if (room.tilesetAnimated) {
				lines.push(`[7] tilesetAnimated: 0x${Math.ceil(room.tilesetAnimated.length / 32).toString(16)} tiles`);
			} else {
				lines.push('[7] tilesetAnimated:');
			}

			for (const line of lines) addHTML(metaPreview, '<div>' + line + '</div>');

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
	// | Section: Fx                                                                                                   |
	// +---------------------------------------------------------------------------------------------------------------+

	const fx = (window.fx = createSection('Fx', (section) => {
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
					rows[j + 1][column] = `<td>${sanitize(readMessage(0, entries[j])).replaceAll('\n', '<br>')}</td>`;
				}
			}
			mfset.selected = { segments, rows };

			metaDisplay.innerHTML = '';
			if (invalidColumns.length)
				addHTML(metaDisplay, `<div>Invalid columns (fonts?): ${invalidColumns.join(', ')}</div>`);
			if (zeroedColumns.length)
				addHTML(metaDisplay, `<div>Zeroed columns: ${zeroedColumns.join(', ')}</div>`);

			const numColumns = rows[0].length;
			for (let i = 0; i < rows.length; ++i) {
				for (let j = 0; j < numColumns; ++j) {
					rows[i][j] ??= '<td></td>';
				}
			}

			if (rows.length === 1) {
				table.innerHTML = '(no data)';
			} else {
				table.innerHTML = rows.map(x => '<tr>' + x.join('') + '</tr>').join('');
			}
		};
		update();

		return mfset;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: BMes                                                                                                 |
	// +---------------------------------------------------------------------------------------------------------------+

	const bmes = (window.bmes = createSection('Battle Messages', (section) => {
		const bmes = {};

		const paths = ['/BAI/BMes_cf.dat', '/BAI/BMes_ji.dat', '/BAI/BMes_yo.dat'];
		const fileSelect = dropdown(paths, 0, () => update());
		section.appendChild(fileSelect);

		let scriptSelect = dropdown([''], 0, () => {});
		section.appendChild(scriptSelect);

		const metaDisplay = document.createElement('div');
		section.appendChild(metaDisplay);

		const tableContainer = document.createElement('div');
		tableContainer.style.cssText = 'width: 100%; height: fit-content; overflow-x: auto;';
		section.appendChild(tableContainer);

		const table = document.createElement('table');
		table.className = 'bordered';
		tableContainer.appendChild(table);

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

			const updateTable = () => {
				table.innerHTML = '';

				const columns = unpackSegmented(tables[filteredTableIds[scriptSelect.value]]);
				bmes.columns = columns;
				const invalidColumns = [];
				const zeroedColumns = [];
				const rows = [['<td></td>']];
				for (let i = 0; i < columns.length; ++i) {
					if (!columns[i].byteLength) continue;

					// some columns are zeroed out
					const u8 = bufToU8(columns[i]);
					let j = 0;
					for (; j < u8.length; ++j) {
						if (u8[j]) break;
					}
					if (j >= u8.length) {
						zeroedColumns.push(i);
						continue;
					}

					// some columns don't have a complete segmented thing
					let entries;
					try {
						entries = unpackSegmented(columns[i]);
					} catch (_) {
						invalidColumns.push(i);
						continue;
					}

					const tableColumn = rows[0].length;
					rows[0].push(`<th>Column ${i}</th>`);

					for (let j = 0; j < entries.length; ++j) {
						rows[j + 1] ??= [`<td>${j}</td>`];
						rows[j + 1][tableColumn]
							= `<td>${sanitize(readMessage(0, entries[j])).replaceAll('\n', '<br>')}</td>`;
					}
				}

				metaDisplay.innerHTML = '';
				if (invalidColumns.length)
					addHTML(metaDisplay, `<div>Invalid columns (fonts?): ${invalidColumns.join(', ')}</div>`);
				if (zeroedColumns.length)
					addHTML(metaDisplay, `<div>Zeroed columns: ${zeroedColumns.join(', ')}</div>`);

				const numFilteredColumns = rows[0].length;
				for (let i = 1; i < rows.length; ++i) {
					for (let j = 0; j < numFilteredColumns; ++j)
						rows[i][j] ??= '<td></td>'; // ensure there are no holes in the array
				}

				if (rows[0].length === 1) {
					table.innerHTML = '(no data)';
				} else {
					table.innerHTML = rows.map((row, i) => '<tr>' + row.join('') + '</tr>').join('');
				}
			};
			updateTable();
		};
		update();

		return bmes;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Disassembler                                                                                         |
	// +---------------------------------------------------------------------------------------------------------------+

	const disassembler = (window.disassembler = createSection('Disassembler', (section) => {
		const disassembler = {};

		const options = [
			'Select an overlay',
			`arm9 entry (${headers.arm9size} bytes)`,
			`arm7 entry (${headers.arm7size} bytes)`,
		];
		for (let i = 0;; ++i) {
			const file = fs.get(i);
			if (!file) break;
			if (file.overlay) options.push(`${file.name} (${file.byteLength} bytes)`);
		}
		const select = dropdown(options, 0, () => update(), undefined, true);
		section.appendChild(select);

		const setSelect = dropdown(['ARM9 (ARMv5TE)', 'ARM7 (ARMv4T)', 'Thumb (ARMv5TE)', 'Thumb (ARMv4T)'], 0, () => update(), undefined, true);
		section.appendChild(setSelect);

		section.appendChild(button('Download All', () => {
			const textEncoder = new TextEncoder();
			const encode = lines => new DataView(textEncoder.encode(lines.join('\n')).buffer);
			const arm7 = sliceDataView(file, headers.arm7offset, headers.arm7offset + headers.arm7size);
			const arm9 = sliceDataView(file, headers.arm9offset, headers.arm9offset + headers.arm9size);
			const files = [
				{ name: 'arm9-entry.txt', dat: encode(disassembler.arm(arm9, 'asm', true)) },
				{ name: 'arm9-entry-thumb.txt', dat: encode(disassembler.thumb(arm9, 'asm', true)) },
				{ name: 'arm7-entry.txt', dat: encode(disassembler.arm(arm7, 'asm', false)) },
				{ name: 'arm7-entry-thumb.txt', dat: encode(disassembler.thumb(arm7, 'asm', false)) },
			];
			for (let i = 0;; ++i) {
				const file = fs.get(i);
				if (!file) break;
				if (!file.overlay) continue;

				const overlay = fs.overlay(i);
				const baseName = `overlay${i.toString().padStart(4, '0')}`;
				files.push(
					{ name: `${baseName}-arm9.txt`, dat: encode(disassembler.arm(overlay, 'asm', true)) },
					{ name: `${baseName}-thumb9.txt`, dat: encode(disassembler.thumb(overlay, 'asm', true)) },
					{ name: `${baseName}-arm7.txt`, dat: encode(disassembler.arm(overlay, 'asm', false)) },
					{ name: `${baseName}-thumb7.txt`, dat: encode(disassembler.thumb(overlay, 'asm', false)) },
				);
			}
			download(`${headers.gamecode}-disassembly.zip`, zipStore(files), 'application/zip');
		}));

		addHTML(section, `<div style="color: #f99;">
			Rendering disassembly in the browser can take a LONG time on large files. <br>
			You should download the disassembly instead and use your own code editor.
		</div>`);
		addHTML(section, `<ul>
			<li><code>(UNPREDICTABLE)</code> means the instruction is not formatted correctly.</li>
			<li><code>---</code> means the instruction is undefined.</li>
		</ul>`);

		const display = document.createElement('div');
		section.appendChild(display);

		/* `style` can be 'object' or 'asm' */
		const disassembleArm = disassembler.arm = (overlay, style, isArmv5) => {
			const OBJECT = style === 'object';
			const ASM = style === 'asm';

			const u32 = bufToU32(overlay);
			const instructions = [];

			// see figure A3.2.1
			const condTable = [
				'eq', 'ne', 'cs/hs', 'cc/lo',
				'mi', 'pl', 'vs', 'vc',
				'hi', 'ls', 'ge', 'lt',
				'gt', 'le', '', '',
			].map(atom);

			return instructions;
		};

		/* `style` can be 'object', 'asm_color', or 'asm' */
		const disassembleThumb = disassembler.thumb = (binary, style, isArmv5) => {
			const OBJECT = style === 'object';
			const ASM = style === 'asm';

			const u16 = bufToU16(binary);
			const lines = [];

			const conds = [
				'eq', 'ne', 'cs/hs', 'cc/lo',
				'mi', 'pl', 'vs', 'vc',
				'hi', 'ls', 'ge', 'lt',
				'gt', 'le', '', '',
			]
			const imm = x => x <= -10 ? '-0x' + (-x).toString(16) : x <= 10 ? x : '0x' + x.toString(16);
			const unpredictable = c => c ? ' (UNPREDICTABLE)' : '';

			next: for (let i = 0; i < u16.length; ++i) {
				const inst = u16[i];
				
				// ADC (A7.1.2) OK
				if ((inst & 0xffc0) === 0x4140) {
					const Rm = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`adc r${Rd}, r${Rm}`);
					continue;
				}

				// ADD (A7.1.3 - A7.1.9) SYNTAX MOD
				if ((inst & 0xfe00) === 0x1c00) { // (1) (A7.1.3)
					// TODO: if immed is 0, recognize this as a mov instruction
					const immed = inst >> 6 & 7;
					const Rn = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`add r${Rd}, r${Rn}, #${imm(immed)}`);
					continue;
				} else if ((inst & 0xf800) === 0x3000) { // (2) (A7.1.4)
					const Rd = inst >> 8 & 7;
					const immed = inst & 0xff;
					if (ASM) lines.push(`add r${Rd}, #${imm(immed)}`);
					continue;
				} else if ((inst & 0xfe00) === 0x1800) { // (3) (A7.1.5)
					const Rm = inst >> 6 & 7;
					const Rn = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`add r${Rd}, r${Rn}, r${Rm}`);
					continue;
				} else if ((inst & 0xff00) === 0x4400) { // (4) (A7.1.6)
					const H1 = inst >> 7 & 1;
					const H2 = inst >> 6 & 1;
					const Rm = inst >> 3 & 7;
					const Rd = inst & 7;
					const u = unpredictable(H1 === 0 && H2 === 0);
					if (ASM) lines.push(`add r${(H1 << 3) | Rd}, r${(H2 << 3) | Rm}` + u);
					continue;
				} else if ((inst & 0xf800) === 0xa000) { // (5) (A7.1.7)
					const Rd = inst >> 8 & 7;
					const immed = inst & 0xff;
					if (ASM) lines.push(`add r${Rd}, PC, #${imm(immed)} * 4`);
					continue;
				} else if ((inst & 0xf800) === 0xa800) { // (6) (A7.1.8)
					const Rd = inst >> 8 & 7;
					const immed = inst & 0xff;
					if (ASM) lines.push(`add r${Rd}, SP, #${imm(immed)} * 4`);
					continue;
				} else if ((inst & 0xff80) === 0xb000) { // (7) (A7.1.9)
					const immed = inst & 0x7f;
					if (ASM) lines.push(`add SP, #${imm(immed)} * 4`);
					continue;
				}

				// AND (A7.1.10) OK
				if ((inst & 0xffc0) === 0x4000) {
					const Rm = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`and r${Rd}, r${Rm}`);
					continue;
				}

				// ASR (A7.1.11 - A7.1.12) OK
				if ((inst & 0xf800) === 0x1000) { // (1) (A7.1.11)
					const immed = inst >> 6 & 0x1f;
					const Rm = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`asr r${Rd}, r${Rm}, #${imm(immed || 32)}`);
					continue;
				} else if ((inst & 0xffc0) === 0x4100) { // (2) (A7.1.12)
					const Rs = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`asr r${Rd}, r${Rs}`);
					continue;
				}

				// B (A7.1.13 - A7.1.14) ORIGINALLY WRONG
				if ((inst & 0xf000) === 0xd000) { // (1) (A7.1.13)
					const cond = inst >> 8 & 0xf;
					const immed = (inst & 0xff) - (inst & 0x80) * 2; // signed
					if (cond === 0b1110); // undefined
					else if (cond !== 0b1111) { // 0b1111 is a SWI instruction
						if (ASM) lines.push(`b${conds[cond]} ${imm(immed * 2)}`);
						continue;
					}
				} else if ((inst & 0xf800) === 0xe000) { // (2) (A7.1.14)
					const immed = (inst & 0x7ff) - (inst & 0x400) * 2; // signed
					if (ASM) lines.push(`b ${imm(immed * 2)}`);
					continue;
				}

				// BIC (A7.1.15) OK
				if ((inst & 0xffc0) === 0x4380) {
					const Rm = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`bic r${Rd}, r${Rm}`);
					continue;
				}

				// BKPT (A7.1.16) SYNTAX MOD
				if ((inst & 0xff00) === 0xbe00 && isArmv5) {
					const immed = inst & 0xff;
					if (ASM) lines.push(`bkpt ${imm(immed)}`);
					continue;
				}

				// BL, BLX (A7.1.17 - A7.1.18) ORIGINALLY WRONG, SYNTAX MOD
				if ((inst & 0xe000) === 0xe000) { // (1) (A7.1.17)
					const H = inst >> 11 & 3;
					const offsetHigh = inst & 0x7ff;
					if (H === 2) {
						const next = u16[i + 1];
						if (next !== undefined && (next & 0xe000) === 0xe000) {
							const Hnext = next >> 11 & 3;
							const offsetLow = next & 0x7ff;
							if (Hnext === 1 && isArmv5) {
								const u = unpredictable(offsetLow & 1);
								if (ASM) lines.push(`blx ${imm(offsetHigh << 12 | offsetLow << 1)}` + u, '');
								++i;
								continue;
							} else if (Hnext === 3) {
								if (ASM) lines.push(`bl ${imm(offsetHigh << 12 | offsetLow << 1)}`, '');
								++i;
								continue;
							}
						}
						
						if (ASM) lines.push(`bl?` + unpredictable(true));
						continue;
					} else if (H === 3) {
						if (ASM) lines.push(`bl` + unpredictable(true));
						continue;
					} else if (H === 1 && isArmv5) {
						if (ASM) lines.push(`blx` + unpredictable(true));
						continue;
					}
				} else if ((inst & 0xff80) === 0x4780 && isArmv5) { // (2) (A7.1.18)
					const H2 = inst >> 6 & 1;
					const Rm = inst >> 3 & 7;
					const u = unpredictable(inst & 7);
					if (ASM) lines.push(`blx r${H2 << 3 | Rm}` + u);
					continue;
				}

				// BX (A7.1.19) OK
				if ((inst & 0xff80) === 0x4700) {
					const H2 = inst >> 6 & 1;
					const Rm = inst >> 3 & 7;
					const u = unpredictable(inst & 7);
					if (ASM) lines.push(`bx r${H2 << 3 | Rm}` + u);
					continue;
				}

				// CMN (A7.1.20) ORIGINALLY WRONG
				if ((inst & 0xffc0) === 0x42c0) {
					const Rm = inst >> 3 & 7;
					const Rn = inst & 7;
					if (ASM) lines.push(`cmn r${Rn}, r${Rm}`);
					continue;
				}

				// CMP (A7.1.21 - A7.1.23) ORIGINALLY WRONG
				if ((inst & 0xf800) === 0x2800) { // (1) (A7.1.21)
					const Rn = inst >> 8 & 7;
					const immed = inst & 0xff;
					if (ASM) lines.push(`cmp r${Rn}, #${imm(immed)}`);
					continue;
				} else if ((inst & 0xffc0) === 0x4280) { // (2) (A7.1.22)
					const Rm = inst >> 3 & 7;
					const Rn = inst & 7;
					if (ASM) lines.push(`cmp r${Rn}, r${Rm}`);
					continue;
				} else if ((inst & 0xff00) === 0x4500) { // (3) (A7.1.23)
					const H1 = inst >> 7 & 1;
					const H2 = inst >> 6 & 1;
					const Rm = inst >> 3 & 7;
					const Rn = inst & 7;
					const u = unpredictable((H1 << 3 | Rn) === 0xf || (H1 === 0 && H2 === 0));
					if (ASM) lines.push(`cmp r${H1 << 3 | Rn}, r${H2 << 3 | Rm}` + u);
					continue;
				}

				// EOR (A7.1.26) OK
				if ((inst & 0xffc0) === 0x4040) {
					const Rm = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`eor r${Rd}, r${Rm}`);
					continue;
				}

				// LDMIA (A7.1.27) OK
				if ((inst & 0xf800) === 0xc800) {
					const Rn = inst >> 8 & 7;
					const registers = inst & 0xff;
					const u = unpredictable(registers === 0);
					if (ASM) {
						const list = [];
						for (let bit = 1, i = 0; i < 8; bit <<= 1, ++i) {
							if (registers & bit) list.push(`r${i}`);
						}
						lines.push(`ldmia r${Rn}!, {${list.join(', ')}}` + u);
					}
					continue;
				}

				// LDR (A7.1.28 - A7.1.31) SYNTAX MOD
				if ((inst & 0xf800) === 0x6800) { // (1) (A7.1.28)
					const immed = inst >> 6 & 0x1f;
					const Rn = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`ldr r${Rd}, [r${Rn}, #${imm(immed)} * 4]`);
					continue;
				} else if ((inst & 0xfe00) === 0x5800) { // (2) (A7.1.29)
					const Rm = inst >> 6 & 7;
					const Rn = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`ldr r${Rd}, [r${Rn}, r${Rm}]`);
					continue;
				} else if ((inst & 0xf800) === 0x4800) { // (3) (A7.1.30)
					const Rd = inst >> 8 & 7;
					const immed = inst & 0xff;
					if (ASM) lines.push(`ldr r${Rd}, [PC, #${imm(immed)} * 4]`);
					continue;
				} else if ((inst & 0xf800) === 0x9800) { // (4) (A7.1.31)
					const Rd = inst >> 8 & 7;
					const immed = inst & 0xff;
					if (ASM) lines.push(`ldr r${Rd}, [SP, #${imm(immed)} * 4]`);
					continue;
				}

				// LDRB (A7.1.32 - A7.1.33) OK
				if ((inst & 0xf800) === 0x7800) { // (1) (A7.1.32)
					const immed = inst >> 6 & 0x1f;
					const Rn = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`ldrb r${Rd}, [r${Rn}, #${imm(immed)}]`);
					continue;
				} else if ((inst & 0xfe00) === 0x5c00) { // (2) (A7.1.33)
					const Rm = inst >> 6 & 7;
					const Rn = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`ldrb r${Rd}, [r${Rn}, r${Rm}]`);
					continue;
				}

				// LDRH (A7.1.34 - A7.1.35) SYNTAX MOD
				if ((inst & 0xf800) === 0x8800) { // (1) (A7.1.34)
					const immed = inst >> 6 & 0x1f;
					const Rn = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`ldrh r${Rd}, [r${Rn}, #${imm(immed)} * 2]`);
					continue;
				} else if ((inst & 0xfe00) === 0x5a00) { // (2) (A7.1.35)
					const Rm = inst >> 6 & 7;
					const Rn = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`ldrh r${Rd}, [r${Rn}, r${Rm}]`);
					continue;
				}

				// LDRSB (A7.1.36) OK
				if ((inst & 0xfe00) === 0x5600) {
					const Rm = inst >> 6 & 7;
					const Rn = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`ldrsb r${Rd}, [r${Rn}, r${Rm}]`);
					continue;
				}

				// LDRSH (A7.1.37) OK
				if ((inst & 0xfe00) === 0x5e00) {
					const Rm = inst >> 6 & 7;
					const Rn = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`ldrsh r${Rd}, [r${Rn}, r${Rm}]`);
					continue;
				}

				// LSL (A7.1.38 - A7.1.39) OK
				if ((inst & 0xf800) === 0) { // (1) (A7.1.38)
					const immed = inst >> 6 & 0x1f;
					const Rm = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`lsl r${Rd}, r${Rm}, #${imm(immed)}`);
					continue;
				} else if ((inst & 0xffc0) === 0x4080) { // (2) (A7.1.39)
					const Rs = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`lsl r${Rd}, r${Rs}`);
					continue;
				}

				// LSR (A7.1.40 - A7.1.41) OK
				if ((inst & 0xf800) === 0x0800) { // (1) (A7.1.40)
					const immed = inst >> 6 & 0x1f;
					const Rm = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`lsr r${Rd}, r${Rm}, #${imm(immed || 32)}`);
					continue;
				} else if ((inst & 0xffc0) === 0x40c0) { // (2) (A7.1.41)
					const Rs = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`lsr r${Rd}, r${Rs}`);
					continue;
				}

				// MOV (A7.1.42 - A7.1.44) OK
				if ((inst & 0xf800) === 0x2000) { // (1) (A7.1.42)
					const Rd = inst >> 8 & 7;
					const immed = inst & 0xff;
					if (ASM) lines.push(`mov r${Rd}, #${imm(immed)}`);
					continue;
				} else if ((inst & 0xffc0) === 0x1c00) { // (2) (A7.1.43)
					// (This is just an `ADD Rd, [Rn, #0]` instruction. This code does not get reached.)
					const Rn = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`mov r${Rd}, r${Rn}`);
					continue;
				} else if ((inst & 0xff00) === 0x4600) { // (3) (A7.1.44)
					const H1 = inst >> 7 & 1;
					const H2 = inst >> 6 & 1;
					const Rm = inst >> 3 & 7;
					const Rd = inst & 7;
					const u = unpredictable(H1 === 0 && H2 === 0);
					if (ASM) lines.push(`mov r${H1 << 3 | Rd}, r${H2 << 3 | Rm}` + u);
					continue;
				}

				// MUL (A7.1.45) OK
				if ((inst & 0xffc0) === 0x4340) {
					const Rm = inst >> 3 & 7;
					const Rd = inst & 7;
					const u = unpredictable(Rm === Rd);
					if (ASM) lines.push(`mul r${Rd}, r${Rm}` + u);
					continue;
				}

				// MVN (A7.1.46) OK
				if ((inst & 0xffc0) === 0x43c0) {
					const Rm = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`mvn r${Rd}, r${Rm}`);
					continue;
				}

				// NEG (A7.1.47) OK
				if ((inst & 0xffc0) === 0x4240) {
					const Rm = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`neg r${Rd}, r${Rm}`);
					continue;
				}

				// ORR (A7.1.48) OK
				if ((inst & 0xffc0) === 0x4300) {
					const Rm = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`orr r${Rd}, r${Rm}`);
					continue;
				}

				// POP (A7.1.49) OK
				if ((inst & 0xfe00) === 0xbc00) {
					const R = inst >> 8 & 1;
					const registers = inst & 0xff;
					const u = unpredictable(R === 0 && registers === 0);
					if (ASM) {
						const list = [];
						for (let bit = 1, i = 0; i < 8; bit <<= 1, ++i) {
							if (registers & bit) list.push(`r${i}`);
						}
						lines.push(`pop {${list.join(', ')}}` + u);
					}
					continue;
				}

				// PUSH (A7.1.50) OK
				if ((inst & 0xfe00) === 0xb400) {
					const R = inst >> 8 & 1;
					const registers = inst & 0xff;
					const u = unpredictable(R === 0 && registers === 0);
					if (ASM) {
						const list = [];
						for (let bit = 1, i = 0; i < 8; bit <<= 1, ++i) {
							if (registers & bit) list.push(`r${i}`);
						}
						lines.push(`push {${list.join(', ')}}` + u);
					}
					continue;
				}

				// ROR (A7.1.54) OK
				if ((inst & 0xffc0) === 0x41c0) {
					const Rs = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`ror r${Rd}, r${Rs}`);
					continue;
				}

				// SBC (A7.1.55) OK
				if ((inst & 0xffc0) === 0x4180) {
					const Rm = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`sbc r${Rd}, r${Rm}`);
					continue;
				}

				// STMIA (A7.1.57) OK
				if ((inst & 0xf800) === 0xc000) {
					const Rn = inst >> 8 & 7;
					const registers = inst & 0xff;
					const u = unpredictable(registers === 0 || ((1 << Rn) - 1) & registers);
					if (ASM) {
						const list = [];
						for (let bit = 1, i = 0; i < 8; bit <<= 1, ++i) {
							if (registers & bit) list.push(`r${i}`);
						}
						lines.push(`stmia r${Rn}!, {${list.join(', ')}}` + u);
					}
					continue;
				}

				// STR (A7.1.58 - A7.1.60) SYNTAX MOD
				if ((inst & 0xf800) === 0x6000) { // (1) (A7.1.58)
					const immed = inst >> 6 & 0x1f;
					const Rn = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`str r${Rd}, [r${Rn}, #${imm(immed)} * 4]`);
					continue;
				} else if ((inst & 0xfe00) === 0x5000) { // (2) (A7.1.59)
					const Rm = inst >> 6 & 7;
					const Rn = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`str r${Rd}, [r${Rn}, r${Rm}]`);
					continue;
				} else if ((inst & 0xf800) === 0x9000) { // (3) (A7.1.60)
					const Rd = inst >> 8 & 7;
					const immed = inst & 0xff;
					if (ASM) lines.push(`str r${Rd}, [SP, #${imm(immed)} * 4]`);
					continue;
				}

				// STRB (A7.1.61 - A7.1.62) OK
				if ((inst & 0xf800) === 0x7000) { // (1) (A7.1.61)
					const immed = inst >> 6 & 0x1f;
					const Rn = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`strb r${Rd}, [r${Rn}, #${imm(immed)}]`);
					continue;
				} else if ((inst & 0xfe00) === 0x5400) { // (2) (A7.1.62)
					const Rm = inst >> 6 & 7;
					const Rn = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`strb r${Rd}, [r${Rn}, r${Rm}]`);
					continue;
				}

				// STRH (A7.1.63 - A7.1.64) OK
				if ((inst & 0xf800) === 0x8000) { // (1) (A7.1.63)
					const immed = inst >> 6 & 0x1f;
					const Rn = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`strh r${Rd}, [r${Rn}, #${imm(immed)} * 2]`);
					continue;
				} else if ((inst & 0xfe00) === 0x5200) { // (2) (A7.1.64)
					const Rm = inst >> 6 & 7;
					const Rn = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`strh r${Rd}, [r${Rn}, r${Rm}]`);
					continue;
				}

				// SUB (A7.1.65 - A7.1.68) SYNTAX MOD
				if ((inst & 0xfe00) === 0x1e00) { // (1) (A7.1.65)
					const immed = inst >> 6 & 7;
					const Rn = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`sub r${Rd}, r${Rn}, #${imm(immed)}`);
					continue;
				} else if ((inst & 0xf800) === 0x3800) { // (2) (A7.1.66)
					const immed = inst & 0xff;
					const Rd = inst >> 8 & 7;
					if (ASM) lines.push(`sub r${Rd}, #${imm(immed)}`);
					continue;
				} else if ((inst & 0xfe00) === 0x1a00) { // (3) (A7.1.67)
					const Rm = inst >> 6 & 7;
					const Rn = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`sub r${Rd}, r${Rn}, r${Rm}`);
					continue;
				} else if ((inst & 0xff80) === 0xb080) { // (4) (A7.1.68)
					const immed = inst & 0x7f;
					if (ASM) lines.push(`sub SP, #${imm(immed)} * 4`);
					continue;
				}

				// SWI (A7.1.69) SYNTAX MOD
				if ((inst & 0xff00) === 0xdf00) {
					const immed = inst & 0xff;
					if (ASM) lines.push(`swi ${imm(immed)}`);
					continue;
				}

				// TST (A7.1.72) OK
				if ((inst & 0xffc0) === 0x4200) {
					const Rm = inst >> 3 & 7;
					const Rd = inst & 7;
					if (ASM) lines.push(`tst r${Rd}, r${Rm}`);
					continue;
				}

				/* unknown */ if (ASM) lines.push(`---`);
			}

			return lines;
		};

		const update = () => {
			display.innerHTML = '';
			if (select.value === 0) return;
			let binary;
			if (select.value === 1) {
				binary = sliceDataView(file, headers.arm9offset, headers.arm9offset + headers.arm9size);
			} else if (select.value === 2) {
				binary = sliceDataView(file, headers.arm7offset, headers.arm7offset + headers.arm7size);
			} else {
				binary = fs.overlay(select.value - 3);
			}

			// supported by V5TE:
			// adc add and b bic bkpt bl blx bx cdp cdp2 clz cmn cmp eor ldc ldc2 ldm ldr ldrb ldrd ldrbt ldrh ldrsb ldrsh ldrt mcr mcr2 mcrr mla mov mrc mrc2 mrrc mrs msr mul mvn orr pld qadd qdadd qdsub qsub rsb rsc sbc smlal smla<x><y> smlal<x><y> smlaw<y> smull smul<x><y> smulw<y> stc stc2 stm str strb strbt strd strh strt sub swi swp swpb teq tst umlal umull

			const instSize = (setSelect.value === 2 || setSelect.value === 3) ? 2 : 4;

			const disassembleStart = performance.now();
			const instructions = [
				() => disassembleArm(binary, 'asm', true),
				() => disassembleArm(binary, 'asm', false),
				() => disassembleThumb(binary, 'asm', true),
				() => disassembleThumb(binary, 'asm', false),
			][setSelect.value]();
			const disassembleTime = performance.now() - disassembleStart;

			const stats = document.createElement('div');
			display.appendChild(stats);

			const renderStart = performance.now();
			addHTML(display, `<table>${instructions.map((x, i) => {
				return `<tr>
					<td style="padding-right: 32px;"><code>${str16(i * instSize)}</code></td>
					<td style="color: #666; padding-right: 64px;"><code>
						${bytes(i * instSize, instSize, binary)}
					</code></td>
					<td><code>${x}</code></td>
				</tr>`;
			}).join('\r\n')}</table>`);

			requestAnimationFrame(() => {
				const renderTime = performance.now() - renderStart;
				stats.innerHTML = `Disassembled in ${(disassembleTime / 1000).toFixed(3)}s, rendered in ${(renderTime / 1000).toFixed(3)}s`;
			});
		};
		update();

		return disassembler;
	}));

	// add spacing to the bottom of the page, for better scrolling
	addHTML(document.body, '<div style="height: 100vh;"></div>');

	// devtools console help
	console.log(
		`Dumping functions: \
	\n%creadString(off, len, dat) \nbytes(off, len, dat) \nbits(off, len, dat) \
	\ndownload(name, dat, mime = 'application/octet-stream') %c \
	\n\nCompression/Packing functions: \
	\n%cblz(indat) \nblzCompress(indat) \nlzBis(indat) \nlzBisCompress(indat, blockSize = 512) \
	\nzipStore(files) \nunpackSegmented(dat) \nsliceDataView(dat, start, end) %c \
	\n\nSections: \
	\n%cheaders fs fsext field fmapdataTiles battle battleGiant fx %c \
	\n\nFile: %cfile%c`,
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
