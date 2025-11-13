'use strict';

(async () => {
	const loaded = document.querySelector('#loaded');
	let loadedCount = 1;
	const checks = [() => window.initDisassembler, () => window.initField];

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

	const file = (window.file = new DataView(
		await new Promise((resolve) => {
			const reader = new FileReader();
			reader.addEventListener('load', () => resolve(reader.result));
			reader.readAsArrayBuffer(fileBlob);
		}),
	));

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
			if (!silent) onchange();
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
		const container = document.createElement(el.tagName);
		container.innerHTML = html;
		for (const child of container.childNodes) el.appendChild(child);
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
	// | Compression and Packing                                                                                       |
	// +---------------------------------------------------------------------------------------------------------------+

	const blz = (window.blz = (indat) => {
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
	});

	// compresses overlay files MOSTLY EXACTLY (i.e. blzCompress(blz(overlay)) == overlay for NEARLY ALL overlays)
	// these overlays: NA 2, EU 2, KO 2, KO 123, KO 139 don't recompress exactly, there is likely some other
	// scoring system that i haven't been able to reverse engineer
	// `minimumSize` is useful for modding overlays without having to change the FAT or overlay tables or anything else
	const blzCompress = (window.blzCompress = (indat, minimumSize) => {
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
	});

	/**
	 * Decompresses the custom lzss-like used in various BIS files
	 */
	const lzBis = (window.lzBis = (indat) => {
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

		return Object.assign(new DataView(outbuf.buffer), { inoff });
	});

	/**
	 * Compresses the custom lzss-like format used in various BIS files.
	 * The compression matches **exactly** what you would find in a ROM. (i.e. lzBisCompress(lzBis(dat)) = dat)
	 * Using a custom `blockSize` larger than 512 will make the output smaller, but may cause the game to crash.
	 */
	const lzBisCompress = (window.lzBisCompress = (indat, blockSize = 512) => {
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
	});

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

	/**
	 * Creates an uncompressed .zip archive containing multiple files
	 * @param {{ name: string, dat: DataView }[]} files
	 * @returns {DataView}
	 */
	const zipStore = (window.zipStore = (files) => {
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
	});

	const rgb15To32 = (window.rgb15To32 = (in16) => {
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

	// +---------------------------------------------------------------------------------------------------------------+
	// | Misc                                                                                                          |
	// +---------------------------------------------------------------------------------------------------------------+

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
			} else if (byte <= 0x1f) {
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
				${sanitize(err.stack).replace('\n', '<br>')}</span>`,
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
			`ARM9 (len 0x${headers.arm9size.toString(16)})`,
			`ARM7 (len 0x${headers.arm7size.toString(16)})`,
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
				download('arm9.bin', fs.arm9);
				return;
			} else if (singleSelect.value === 1) {
				singleOutput.textContent = '';
				download('arm7.bin', fs.arm7);
				return;
			}
			const fsentry = fs.get(singleSelect.value - 2);

			let output;
			if (singleDecompression.value === 0) output = fsentry;
			else {
				const overlayId = fileToOverlayId.get(singleSelect.value);
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
			const files = [{ name: 'arm9.bin', dat: fs.arm9 }, { name: 'arm7.bin', dat: fs.arm7 }];

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
			headers.arm9size,
			`<code>ARM9. 0x${str32(headers.arm9ram)} - 0x${str32(headers.arm9ram + headers.arm9size)}</code>`,
		);
		overlayEntry(
			headers.arm7ram,
			headers.arm7size,
			`<code>ARM7. 0x${str32(headers.arm7ram)} - 0x${str32(headers.arm7ram + headers.arm7size)}</code>`,
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

			const lines = [];
			if (room.tileset) lines.push(`[0] tileset: 0x${Math.ceil(room.tileset.length / 32).toString(16)} tiles`);
			else lines.push('[0] tileset: none');

			lines.push(`[1] palette: ${room.palette ? 'exists' : ''}`);
			lines.push(`[2] BG1: ${room.tilemaps[0] ? room.tilemaps[0].byteLength + ' bytes' : ''}`);
			lines.push(`[3] BG2: ${room.tilemaps[1] ? room.tilemaps[1].byteLength + ' bytes' : ''}`);
			lines.push(`[4] BG3: ${room.tilemaps[2] ? room.tilemaps[2].byteLength + ' bytes' : ''}`);

			const palAnimLines = fpaf.stringify(room.paletteAnimations);
			lines.push(
				`[5] paletteAnimations: <ul>${palAnimLines.map((x) => '<li><code>' + x + '</code></li>').join('')}</ul>`,
			);

			lines.push(
				`[6] tileAnimations: <ul>${room.tileAnimations
					.map((x) => {
						return (
							'<li><code>' +
							x.parts
								.map((s, i) => `<span style="color: ${i % 2 ? '#777' : '#999'};">${s}</span>`)
								.join(' ') +
							'</code></li>'
						);
					})
					.join('')}</ul>`,
			);

			if (room.tilesetAnimated) {
				let tilesEnd = 0;
				for (const anim of room.tileAnimations) {
					const end =
						anim.tilesetAnimatedStart + anim.replacementLength * (Math.max(...anim.keyframeIndices) + 1);
					if (tilesEnd < end) tilesEnd = end;
				}
				let html = `[7] tilesetAnimated: 0x${tilesEnd} tiles`;
				if (tilesEnd * 32 < room.tilesetAnimated.byteLength) {
					html += `, debug info or unused tiles: <ul>
						<li style="overflow-wrap: anywhere;"><code>${latin1(tilesEnd * 32, Infinity, room.tilesetAnimated)}</code></li>
						<li><code>${bytes(tilesEnd * 32, Infinity, room.tilesetAnimated)}</code></li>
					</ul>`;
				}
				lines.push(html);
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

		const ignoreSpecials = checkbox('Ignore Special Characters', false, () => update());
		section.appendChild(ignoreSpecials);

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
			if (invalidColumns.length)
				addHTML(metaDisplay, `<div>Invalid columns (fonts?): ${invalidColumns.join(', ')}</div>`);
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

		const ignoreSpecials = checkbox('Ignore Special Characters', false, () => update());
		section.appendChild(ignoreSpecials);

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
				mes.columns = columns;
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
						rows[j + 1][tableColumn] =
							`<td>${sanitize(readMessage(0, entries[j], ignoreSpecials.checked)).replaceAll('\n', '<br>')}</td>`;
					}
				}

				metaDisplay.innerHTML = '';
				if (invalidColumns.length)
					addHTML(metaDisplay, `<div>Invalid columns (fonts?): ${invalidColumns.join(', ')}</div>`);
				if (zeroedColumns.length)
					addHTML(metaDisplay, `<div>Zeroed columns: ${zeroedColumns.join(', ')}</div>`);

				const numFilteredColumns = rows[0].length;
				for (let i = 1; i < rows.length; ++i) {
					for (let j = 0; j < numFilteredColumns; ++j) rows[i][j] ??= '<td></td>'; // ensure there are no holes in the array
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

		return mes;
	}));

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Disassembler                                                                                         |
	// +---------------------------------------------------------------------------------------------------------------+

	if (!window.initDisassembler) await waitFor(() => window.initDisassembler);
	window.initDisassembler();

	// +---------------------------------------------------------------------------------------------------------------+
	// | Section: Sound Data                                                                                           |
	// +---------------------------------------------------------------------------------------------------------------+

	const sound = (window.sound = createSection('Sound', (section) => {
		const sound = {};

		addHTML(section, '<div>very unfinished section</div>');

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
	// | Section: Fonts                                                                                                |
	// +---------------------------------------------------------------------------------------------------------------+

	const font = (window.font = createSection('Fonts', (section) => {
		const font = {};

		const fontFile = fs.get('/Font/StatFontSet.dat');
		const fontSegments = unpackSegmented(fontFile);
		const options = [];
		for (let i = 0; i < fontSegments.length; ++i) {
			if (fontSegments[i].byteLength) options.push(i);
		}

		const select = dropdown(
			options.map((x) => `StatFontSet ${x} (len ${fontSegments[x].byteLength})`),
			0,
			() => update(),
		);
		section.appendChild(select);

		const display = document.createElement('div');
		section.appendChild(display);

		const update = () => {
			const segment = window.OVERRIDE || fontSegments[options[select.value]];
			display.innerHTML = '';

			const charMapSize = segment.getUint32(0, true);
			const charMapOffset = segment.getUint32(4, true);
			const charMap = sliceDataView(segment, charMapOffset, charMapOffset + charMapSize);
			const glyphTableOffset = segment.getUint32(8, true);
			const glyphTable = sliceDataView(segment, glyphTableOffset, charMapOffset);

			if (!glyphTable.byteLength) return;
			const glyphWidth = (glyphTable.getUint8(0) >> 4) * 4;
			const glyphHeight = (glyphTable.getUint8(0) & 0xf) * 4;

			const x = glyphTable.getUint16(1, true);
			console.log(x);

			const charWidthBytes = glyphTable.getUint8(3) * 4;
			const glyphBitmapOffset = 4 + charWidthBytes;
			const numGlyphs = charWidthBytes * 2;

			const glyphRows = 32;

			console.log(glyphTable, glyphBitmapOffset, glyphWidth, glyphHeight, glyphRows);

			const canvas = document.createElement('canvas');
			canvas.width = glyphWidth * 16;
			canvas.height = glyphHeight * glyphRows;
			canvas.style.width = `${glyphWidth * 16 * 4}px`;
			canvas.style.height = `${glyphHeight * glyphRows * 4}px`;
			display.appendChild(canvas);

			const ctx = canvas.getContext('2d');
			const bitmap = new Uint32Array(glyphWidth * 16 * glyphHeight * glyphRows);
			const shade = (i, alpha, color) => {
				return [0xffffffff, 0xffeeeeff, 0xff000000, 0xffcccccc, 0xffeeeeee, 0xffddddee, 0xff000000, 0xffaaaaaa][
					(((i & 1) + ((i >> 4) & 1)) % 2) * 4 + alpha * 2 + color
				];
			};
			const p = (x, y) => y * glyphWidth * 16 + x;
			for (let i = 0, o = glyphBitmapOffset; o + (glyphWidth * glyphHeight) / 4 <= glyphTable.byteLength; ++i) {
				const xStart = (i & 0xf) * glyphWidth;
				const yStart = (i >> 4) * glyphHeight;
				for (let xBase = 0; xBase < glyphWidth; xBase += 8) {
					const width = Math.min(4, (glyphWidth - xBase) / 2);
					for (let y = 0; y < glyphHeight; y += 4) {
						const alphaOffset = o;
						o += width;
						const colorOffset = o;
						o += width;
						for (let z = 0; z < width * 8; ++z) {
							const alpha = (glyphTable.getUint8(alphaOffset + (z >> 3)) >> z % 8) & 1;
							const color = (glyphTable.getUint8(colorOffset + (z >> 3)) >> z % 8) & 1;
							bitmap[p(xStart + xBase + (z >> 2), yStart + y + (z % 4))] = shade(i, alpha, color);
						}
					}
				}
			}
			ctx.putImageData(new ImageData(bufToU8Clamped(bitmap), glyphWidth * 16, glyphHeight * glyphRows), 0, 0);

			addHTML(
				display,
				`<div>charMap (${charMapOffset} len ${charMapSize}): <code>${bytes(charMapOffset, charMapSize, segment)}</code></div>`,
			);
			addHTML(
				display,
				`<div>glyphTable (${glyphTableOffset}): <code>${bytes(glyphTableOffset, charMapOffset - glyphTableOffset, segment)}</code></div>`,
			);
		};
		update();

		return font;
	}));

	// add spacing to the bottom of the page, for better scrolling
	addHTML(document.body, '<div style="height: 100vh;"></div>');

	// devtools console help
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
